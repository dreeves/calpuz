const { test, expect } = require('@playwright/test');

test('unplaceable next piece shows a red X in the docket', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  await page.evaluate(() => {
    const emptyPruning = { cells: [], sizes: [] };
    const emptyTunnels = { nadirs: [], paths: [] };

    const nextPiece = 'corner';
    const orderedRemaining = [nextPiece];

    const progress = [
      {
        name: nextPiece,
        status: 'pending',
        orientation: 0,
        totalOrientations: 0,
        positionIndex: 0,
        totalPositions: 0,
      },
    ];

    visualizeAllPlacements(
      [],
      0,
      progress,
      [],
      emptyPruning,
      emptyPruning,
      emptyPruning,
      emptyPruning,
      nextPiece,
      true,
      orderedRemaining,
      [],
      emptyTunnels,
    );
  });

  const xLines = page.locator('#pending-pieces line');
  await expect(xLines).toHaveCount(2);

  const strokes = await xLines.evaluateAll(nodes => nodes.map(n => n.getAttribute('stroke')));
  expect(strokes).toEqual(['#ff0000', '#ff0000']);
});
