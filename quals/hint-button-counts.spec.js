const { test, expect } = require('@playwright/test');

// Replicata: place 7 pieces of a known solution for today, then click the
// lightbulb (hint) button.
// Expectata: the hint panel opens and reports a nonzero solution count
// (at least the known solution completes from here).
// This exercises the real checkHint -> refreshHint -> countSolutions path,
// including coverage detection with the hint panel already visible.
test('hint button counts solutions for a nearly-solved board', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  await page.evaluate(() => {
    const shapes = getShapesArray();
    const today = new Date();
    const targetCells = Solver.getDateCells(today.getMonth(), today.getDate());
    const res = Solver.solveOnce(shapes, targetCells);
    if (!res.success) throw new Error('solveOnce found no solution for today');
    // Place 7 of the 8 solution pieces; park the 8th fully off the calendar.
    // (At its default scatter spot a piece can clip the calendar -- e.g. the
    // chair covers the JAN cell's center -- which the hint rightly counts as
    // an invalid placement and reports 0 solutions.)
    scatterShapes();
    movePoly(res.placements[0].name, 12, 12, 0, false);
    for (const p of res.placements.slice(1)) visualizePlacement(p);
  });

  await page.click('#hint-btn');

  await expect(page.locator('#hint-panel')).toHaveClass(/active/);

  // Status goes 'counting solutions' then settles on the count.
  await page.waitForFunction(() => {
    const text = document.getElementById('hint-status').textContent;
    return /^[\d,]+ solutions?$/.test(text);
  }, null, { timeout: 10000 });

  const status = await page.locator('#hint-status').textContent();
  expect(status).not.toBe('0 solutions');
});
