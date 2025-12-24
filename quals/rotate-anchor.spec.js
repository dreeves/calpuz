const { test, expect } = require('@playwright/test');

test('piece rotates around clicked point (anchor stays fixed)', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });

  // Wait for pieces to be created by scatterShapes().
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const piece = page.locator('#corner');
  await expect(piece).toHaveCount(1);

  const box = await piece.boundingBox();
  expect(box).toBeTruthy();

  // Choose a deterministic point inside the piece.
  const clientX = box.x + box.width * 0.37;
  const clientY = box.y + box.height * 0.42;

  const before = await page.evaluate(({ clientX, clientY }) => {
    const node = document.getElementById('corner');
    const svgEl = node.ownerSVGElement;

    // screenToSvg takes (screenX, screenY, invCtm) - compute inverse CTM first
    const invCtm = svgEl.getScreenCTM().inverse();
    const pivot = screenToSvg(clientX, clientY, invCtm);

    // Find the local point on the element that currently maps to pivot.
    const local = new DOMPoint(pivot.x, pivot.y).matrixTransform(node.getCTM().inverse());

    return {
      pivot: { x: pivot.x, y: pivot.y },
      local: { x: local.x, y: local.y },
    };
  }, { clientX, clientY });

  await page.dispatchEvent('#corner', 'pointerdown', {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  });
  await page.dispatchEvent('#corner', 'pointerup', {
    pointerId: 1,
    pointerType: 'mouse',
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX,
    clientY,
  });

  // ROTATION_DURATION_MS is 150, give it slack.
  await page.waitForTimeout(300);

  const { anchorError, angleChanged } = await page.evaluate(({ pivot, local }) => {
    const node = document.getElementById('corner');
    const global2 = new DOMPoint(local.x, local.y).matrixTransform(node.getCTM());
    const dx = global2.x - pivot.x;
    const dy = global2.y - pivot.y;
    const tf = node.getAttribute('transform') || '';
    const match = tf.match(/matrix\(([^)]+)\)/);
    if (!match) throw new Error('Expected matrix() transform after rotation');
    const [a, b] = match[1].split(/[\s,]+/).map(Number);
    const angle = Math.atan2(b, a) * 180 / Math.PI;
    return { anchorError: Math.sqrt(dx * dx + dy * dy), angleChanged: Math.abs(angle) > 1 };
  }, before);

  // Allow tiny floating-point error.
  expect(anchorError).toBeLessThan(1e-4);
  expect(angleChanged).toBe(true);
});
