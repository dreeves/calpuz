const { test, expect } = require('@playwright/test');

function parseMatrix(matrixStr) {
  const match = (matrixStr || '').match(/matrix\(([^)]+)\)/);
  if (!match) return null;
  const parts = match[1].split(/[\s,]+/).map(Number);
  if (parts.length < 6 || parts.some((n) => Number.isNaN(n))) return null;
  const [a, b, c, d, e, f] = parts;
  return { a, b, c, d, e, f };
}

function determinant2x2(m) {
  return m.a * m.d - m.b * m.c;
}

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

test('dragging while a flip is in-progress does not leave piece squished', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  const before = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const beforeM = parseMatrix(before);
  expect(beforeM).not.toBeNull();
  const beforeDet = determinant2x2(beforeM);

  // Start a long-press (touch) to trigger flip, then move enough to start a pan
  // while the flip animation is still running.
  await page.dispatchEvent('#corner', 'pointerdown', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX,
    clientY,
  });

  // LONG_PRESS_MS is 500ms; wait beyond that, then into the midpoint of the
  // (currently slowed-down) flip animation.
  await page.waitForTimeout(900);

  // Move > 5px threshold to trigger Hammer panstart/panmove.
  await page.dispatchEvent('#corner', 'pointermove', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 1,
    clientX: clientX + 30,
    clientY: clientY + 10,
  });

  // Finish the drag.
  await page.dispatchEvent('#corner', 'pointerup', {
    pointerId: 1,
    pointerType: 'touch',
    isPrimary: true,
    button: 0,
    buttons: 0,
    clientX: clientX + 30,
    clientY: clientY + 10,
  });

  // Give RAF animations time to settle.
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const afterM = parseMatrix(after);
  expect(afterM).not.toBeNull();

  const afterDet = determinant2x2(afterM);

  // Squished state corresponds to determinant magnitude near 0 (scale collapses).
  expect(Math.abs(afterDet)).toBeGreaterThan(0.2);

  // It should also complete the flip (determinant sign should toggle).
  expect(Math.sign(afterDet)).toBe(-Math.sign(beforeDet));
});

test('ctrl+click flip then immediate drag does not leave piece squished', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  const before = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const beforeM = parseMatrix(before);
  expect(beforeM).not.toBeNull();
  const beforeDet = determinant2x2(beforeM);

  // ctrl+click triggers flip on pointerup path.
  await page.keyboard.down('Control');
  await page.mouse.click(clientX, clientY, { button: 'left' });
  await page.keyboard.up('Control');

  // Wait into the midpoint of the (currently slowed-down) flip animation.
  await page.waitForTimeout(400);

  // Immediately start a drag while the 150ms flip animation is likely still running.
  await page.mouse.move(clientX, clientY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(clientX + 40, clientY + 10);
  await page.mouse.up({ button: 'left' });

  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const afterM = parseMatrix(after);
  expect(afterM).not.toBeNull();
  const afterDet = determinant2x2(afterM);

  expect(Math.abs(afterDet)).toBeGreaterThan(0.2);
  expect(Math.sign(afterDet)).toBe(-Math.sign(beforeDet));
});

test('tap rotate then drag mid-rotation does not leave piece partially rotated', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { x: clientX, y: clientY } = await findClickablePoint(page, 'corner');

  const before = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const beforeM = parseMatrix(before);
  expect(beforeM).not.toBeNull();

  // Tap rotates 90° (counter-clockwise in current implementation).
  await page.mouse.click(clientX, clientY, { button: 'left' });

  // Start drag at the midpoint of the (currently slowed-down) rotation animation.
  await page.waitForTimeout(400);
  await page.mouse.move(clientX, clientY);
  await page.mouse.down({ button: 'left' });
  await page.mouse.move(clientX + 40, clientY + 10);
  await page.mouse.up({ button: 'left' });

  // Give RAF animations time to settle.
  await page.waitForTimeout(1200);

  const after = await page.evaluate(() => {
    return document.getElementById('corner').getAttribute('transform') || '';
  });
  const afterM = parseMatrix(after);
  expect(afterM).not.toBeNull();

  // Rotation should settle to a real 90° step, not be stuck mid-way.
  // We check that the 2x2 part is (approximately) orthonormal.
  const col1Len = Math.hypot(afterM.a, afterM.b);
  const col2Len = Math.hypot(afterM.c, afterM.d);
  expect(Math.abs(col1Len - 1)).toBeLessThan(0.05);
  expect(Math.abs(col2Len - 1)).toBeLessThan(0.05);
});
