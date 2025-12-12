const { test, expect } = require('@playwright/test');

test('long-press flips only (no rotate)', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const piece = page.locator('#corner');
  const box = await piece.boundingBox();
  expect(box).toBeTruthy();

  const clientX = box.x + box.width * 0.35;
  const clientY = box.y + box.height * 0.45;

  // Snapshot SVG transform before (to verify no rotation happens)
  const beforeTransform = await page.evaluate(() => {
    const node = document.getElementById('corner');
    return node.getAttribute('transform') || '';
  });

  // Simulate a touch long-press: pointerdown, wait > LONG_PRESS_MS, pointerup.
  await page.dispatchEvent('#corner', 'pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  });

  await page.waitForTimeout(650);

  await page.dispatchEvent('#corner', 'pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX,
    clientY,
  });

  // Wait for flip animation to complete (ROTATION_DURATION_MS = 150)
  await page.waitForTimeout(200);

  // Check flip happened by looking at the inner polygon's CSS transform
  const flipScale = await page.evaluate(() => {
    const node = document.getElementById('corner');
    const polNode = node.querySelector('polygon');
    return polNode?._scale || 1;
  });
  expect(flipScale).toBe(-1);  // Now flipped

  // Verify SVG transform unchanged (no rotation happened)
  const afterTransform = await page.evaluate(() => {
    const node = document.getElementById('corner');
    return node.getAttribute('transform') || '';
  });
  expect(afterTransform).toBe(beforeTransform);  // SVG transform should be unchanged
});
