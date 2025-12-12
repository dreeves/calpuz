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

    // screenToSvg is defined in js/index.js
    const pivot = screenToSvg(svgEl, clientX, clientY);

    // Find the local point on the element that currently maps to pivot.
    const local = new DOMPoint(pivot.x, pivot.y).matrixTransform(node.getCTM().inverse());

    return {
      pivot: { x: pivot.x, y: pivot.y },
      local: { x: local.x, y: local.y },
    };
  }, { clientX, clientY });

  await page.mouse.click(clientX, clientY);

  // ROTATION_DURATION_MS is 150, give it slack.
  await page.waitForTimeout(300);

  const anchorError = await page.evaluate(({ pivot, local }) => {
    const node = document.getElementById('corner');
    const global2 = new DOMPoint(local.x, local.y).matrixTransform(node.getCTM());
    const dx = global2.x - pivot.x;
    const dy = global2.y - pivot.y;
    return Math.sqrt(dx * dx + dy * dy);
  }, before);

  // Allow tiny floating-point error.
  expect(anchorError).toBeLessThan(1e-4);
});
