const { test, expect } = require('@playwright/test');

test('snap-to-grid only snaps to a valid, non-overlapping placement', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const result = await page.evaluate(() => {
    window.omnisnap = false;
    const anchor = document.getElementById('corner');
    const other = document.getElementById('stair');

    // Put anchor piece snapped at a known valid cell.
    setGroupPosition(anchor, x0 + 0 * boxel, y0 + 2 * boxel);
    snapToGrid({ node: anchor });

    // Put the other piece near that same cell, but slightly offset.
    // If snap were unconditional, it would round to the occupied cell.
    setGroupPosition(other, x0 + 0.2 * boxel, y0 + 2.2 * boxel);
    const before = {
      x: parseFloat(other.dataset.x),
      y: parseFloat(other.dataset.y),
    };

    snapToGrid({ node: other });

    const after = {
      x: parseFloat(other.dataset.x),
      y: parseFloat(other.dataset.y),
    };

    return { before, after };
  });

  expect(result.after).toEqual(result.before);
});
