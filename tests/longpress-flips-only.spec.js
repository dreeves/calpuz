const { test, expect } = require('@playwright/test');

test('long-press flips only (no rotate)', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const piece = page.locator('#corner');
  const box = await piece.boundingBox();
  expect(box).toBeTruthy();

  const clientX = box.x + box.width * 0.35;
  const clientY = box.y + box.height * 0.45;

  // Snapshot transform before.
  const before = await page.evaluate(() => {
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

  // Give Hammer a moment to emit events.
  await page.waitForTimeout(50);

  const after = await page.evaluate(() => {
    const node = document.getElementById('corner');
    return node.getAttribute('transform') || '';
  });

  expect(after).toBe(before);
});
