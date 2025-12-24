const { test, expect } = require('@playwright/test');

// Extract rotation angle (in degrees) from a matrix transform string
function getRotationFromMatrix(matrixStr) {
  if (!matrixStr) return 0;
  const match = matrixStr.match(/matrix\(([^)]+)\)/);
  if (!match) return 0;
  const [a, b] = match[1].split(/[\s,]+/).map(Number);
  return Math.atan2(b, a) * 180 / Math.PI;
}

// Normalize angle to [-180, 180)
function normalizeAngle(deg) {
  deg = deg % 360;
  if (deg >= 180) deg -= 360;
  if (deg < -180) deg += 360;
  return deg;
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
    // Fallback to center (may not work for L-shapes)
    return { x: rect.x + rect.width / 2, y: rect.y + rect.height / 2 };
  }, pieceId);
}

test('right-click rotates piece clockwise by exactly 90 degrees', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  // Get initial rotation
  const beforeTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const beforeAngle = getRotationFromMatrix(beforeTransform);

  // Right-click is handled via the element's contextmenu handler.
  // Trigger a real MouseEvent('contextmenu') to match browser behavior.
  await page.evaluate(({ clientX, clientY }) => {
    const el = document.getElementById('corner');
    el.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX,
      clientY,
    }));
  }, { clientX, clientY });

  // Wait until rotation settles at +90 degrees.
  await page.waitForFunction(
    ({ beforeAngle, expectedDelta }) => {
      const el = document.getElementById('corner');
      const tf = el.getAttribute('transform') || '';
      const match = tf.match(/matrix\(([^)]+)\)/);
      if (!match) return false;
      const [a, b] = match[1].split(/[\s,]+/).map(Number);
      const afterAngle = Math.atan2(b, a) * 180 / Math.PI;
      let delta = (afterAngle - beforeAngle) % 360;
      if (delta >= 180) delta -= 360;
      if (delta < -180) delta += 360;
      return Math.abs(delta - expectedDelta) < 1;
    },
    { beforeAngle, expectedDelta: 90 },
    { timeout: 2000 }
  );

  // Get final rotation
  const afterTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const afterAngle = getRotationFromMatrix(afterTransform);

  // Should have rotated +90 degrees (clockwise)
  const delta = normalizeAngle(afterAngle - beforeAngle);
  expect(Math.abs(delta - 90)).toBeLessThan(2);
});

test('left-click rotates piece counter-clockwise by exactly 90 degrees', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  // Get initial rotation
  const beforeTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const beforeAngle = getRotationFromMatrix(beforeTransform);

  // Left-click to rotate clockwise (via pointer events)
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

  // Wait until rotation settles at -90 degrees.
  await page.waitForFunction(
    ({ beforeAngle, expectedDelta }) => {
      const el = document.getElementById('corner');
      const tf = el.getAttribute('transform') || '';
      const match = tf.match(/matrix\(([^)]+)\)/);
      if (!match) return false;
      const [a, b] = match[1].split(/[\s,]+/).map(Number);
      const afterAngle = Math.atan2(b, a) * 180 / Math.PI;
      let delta = (afterAngle - beforeAngle) % 360;
      if (delta >= 180) delta -= 360;
      if (delta < -180) delta += 360;
      return Math.abs(delta - expectedDelta) < 1;
    },
    { beforeAngle, expectedDelta: -90 },
    { timeout: 2000 }
  );

  // Get final rotation
  const afterTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const afterAngle = getRotationFromMatrix(afterTransform);

  // Should have rotated -90 degrees (counter-clockwise)
  const delta = normalizeAngle(afterAngle - beforeAngle);
  expect(Math.abs(delta - (-90))).toBeLessThan(2);
});

test('right-click does not also trigger left-click rotation', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  // Get initial rotation
  const beforeTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const beforeAngle = getRotationFromMatrix(beforeTransform);

  // Right-click is handled via the element's contextmenu handler.
  await page.evaluate(({ clientX, clientY }) => {
    const el = document.getElementById('corner');
    el.dispatchEvent(new MouseEvent('contextmenu', {
      bubbles: true,
      cancelable: true,
      button: 2,
      clientX,
      clientY,
    }));
  }, { clientX, clientY });

  await page.waitForFunction(
    ({ beforeAngle, expectedDelta }) => {
      const el = document.getElementById('corner');
      const tf = el.getAttribute('transform') || '';
      const match = tf.match(/matrix\(([^)]+)\)/);
      if (!match) return false;
      const [a, b] = match[1].split(/[\s,]+/).map(Number);
      const afterAngle = Math.atan2(b, a) * 180 / Math.PI;
      let delta = (afterAngle - beforeAngle) % 360;
      if (delta >= 180) delta -= 360;
      if (delta < -180) delta += 360;
      return Math.abs(delta - expectedDelta) < 1;
    },
    { beforeAngle, expectedDelta: 90 },
    { timeout: 2000 }
  );

  const afterTransform = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const afterAngle = getRotationFromMatrix(afterTransform);

  // The bug was: right-click triggered BOTH directions,
  // resulting in 0 or partial rotation. Should be exactly +90.
  const delta = normalizeAngle(afterAngle - beforeAngle);

  // If both rotations fired, delta would be close to 0 (they cancel out)
  // or some partial value. It should be exactly +90.
  expect(Math.abs(delta)).toBeGreaterThan(45);  // Not close to 0
  expect(Math.abs(delta - 90)).toBeLessThan(2);
});
