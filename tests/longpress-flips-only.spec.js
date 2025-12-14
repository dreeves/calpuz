const { test, expect } = require('@playwright/test');

// Extract rotation angle (in degrees) from a matrix transform string
function getRotationFromMatrix(matrixStr) {
  if (!matrixStr) return 0;
  const match = matrixStr.match(/matrix\(([^)]+)\)/);
  if (!match) return 0;
  const [a, b] = match[1].split(/[\s,]+/).map(Number);
  return Math.atan2(b, a) * 180 / Math.PI;
}

// Check if matrix represents a flipped state (negative determinant)
function isFlipped(matrixStr) {
  if (!matrixStr) return false;
  const match = matrixStr.match(/matrix\(([^)]+)\)/);
  if (!match) return false;
  const [a, b, c, d] = match[1].split(/[\s,]+/).map(Number);
  // Determinant of 2x2 rotation/scale matrix: a*d - b*c
  // Positive = normal, Negative = flipped
  return (a * d - b * c) < 0;
}

// Find a clickable point inside a piece (not covered by other pieces)
async function findClickablePoint(page, pieceId) {
  return await page.evaluate((id) => {
    const piece = document.getElementById(id);
    const poly = piece.querySelector('polygon');
    const rect = poly.getBoundingClientRect();

    // Try different points to find one where this piece is the top element
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
    // Fallback to center
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, pieceId);
}

test('long-press flips piece (no rotation)', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  // Get initial state
  const beforeTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const beforeAngle = getRotationFromMatrix(beforeTransform);
  const beforeFlipped = isFlipped(beforeTransform);

  // Simulate a touch long-press: pointerdown, wait > LONG_PRESS_MS (500), pointerup
  await page.dispatchEvent('#corner', 'pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  });

  await page.waitForTimeout(650);  // > 500ms LONG_PRESS_MS

  await page.dispatchEvent('#corner', 'pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX,
    clientY,
  });

  // Wait for flip to complete (determinant sign toggles).
  await page.waitForFunction(
    ({ beforeFlipped }) => {
      const tf = document.getElementById('corner').getAttribute('transform') || '';
      const match = tf.match(/matrix\(([^)]+)\)/);
      if (!match) return false;
      const [a, b, c, d] = match[1].split(/[\s,]+/).map(Number);
      const flipped = (a * d - b * c) < 0;
      return flipped !== beforeFlipped;
    },
    { beforeFlipped },
    { timeout: 2000 }
  );

  // Get final state
  const afterTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const afterAngle = getRotationFromMatrix(afterTransform);
  const afterFlipped = isFlipped(afterTransform);

  // Flip should have toggled
  expect(afterFlipped).toBe(!beforeFlipped);

  // Flipping changes the angle by 180° (mathematically expected).
  // A tap rotation would change it by 90°. Check it's 0° or 180°, not 90°.
  const angleDelta = Math.abs(afterAngle - beforeAngle);
  const isFlipAngle = angleDelta < 1 || Math.abs(angleDelta - 180) < 1;
  expect(isFlipAngle).toBe(true);
});

test('long-press does not trigger tap rotation', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  // Capture state BEFORE the long press
  const beforeAngle = getRotationFromMatrix(
    await page.evaluate(() => document.getElementById('corner').getAttribute('transform') || '')
  );
  const beforeFlipped = isFlipped(
    await page.evaluate(() => document.getElementById('corner').getAttribute('transform') || '')
  );

  // Long-press
  await page.dispatchEvent('#corner', 'pointerdown', {
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 1, clientX, clientY,
  });
  await page.waitForTimeout(650);
  await page.dispatchEvent('#corner', 'pointerup', {
    pointerId: 1, pointerType: 'touch', isPrimary: true, button: 0, buttons: 0, clientX, clientY,
  });

  // Wait for flip to complete (determinant sign toggles)
  await page.waitForFunction(
    ({ beforeFlipped }) => {
      const tf = document.getElementById('corner').getAttribute('transform') || '';
      const match = tf.match(/matrix\(([^)]+)\)/);
      if (!match) return false;
      const [a, b, c, d] = match[1].split(/[\s,]+/).map(Number);
      const flipped = (a * d - b * c) < 0;
      return flipped !== beforeFlipped;
    },
    { beforeFlipped },
    { timeout: 2000 }
  );

  const afterAngle = getRotationFromMatrix(
    await page.evaluate(() => document.getElementById('corner').getAttribute('transform') || '')
  );

  // Flip changes angle by 0° or 180°. A tap rotation would add 90°.
  // So valid results are: 0°, 180°. Invalid would be ~90° or ~270°.
  const delta = Math.abs(afterAngle - beforeAngle);
  const isValidFlipOnly = delta < 1 || Math.abs(delta - 180) < 1;
  expect(isValidFlipOnly).toBe(true);
});
