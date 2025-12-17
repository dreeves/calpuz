const { test, expect } = require('@playwright/test');

// Find a clickable point inside a piece (not covered by other pieces)
async function findClickablePoint(page, pieceId) {
  return await page.evaluate((id) => {
    const piece = document.getElementById(id);
    const poly = piece.querySelector('polygon');
    const rect = poly.getBoundingClientRect();

    for (let dx = 0.1; dx <= 0.9; dx += 0.1) {
      for (let dy = 0.1; dy <= 0.9; dy += 0.1) {
        const x = rect.x + rect.width * dx;
        const y = rect.y + rect.height * dy;
        const el = document.elementFromPoint(x, y);
        if (el && el.parentElement && el.parentElement.id === id) {
          return { x, y };
        }
      }
    }
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, pieceId);
}

test('reset button scatters pieces back to default', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const piece = page.locator('#corner');
  await expect(piece).toHaveCount(1);

  const initialTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');
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
  await page.waitForTimeout(250);

  const afterRotateTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  expect(afterRotateTransform).not.toEqual(initialTransform);

  await page.click('#reset-btn');
  await page.waitForTimeout(50);

  const afterResetTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });

  expect(afterResetTransform).toEqual(initialTransform);
});

