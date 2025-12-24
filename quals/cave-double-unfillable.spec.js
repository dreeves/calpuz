const { test, expect } = require('@playwright/test');

test('6-cell corridor yields two distinct unfillable uq=5 caves', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });

  // Ensure solver piece data is initialized (needed for shape lookup).
  await page.waitForFunction(() => typeof window.Solver?.initPieceData === 'function');
  await page.evaluate(() => {
    window.Solver.initPieceData(getShapesArray());
  });

  const result = await page.evaluate(() => {
    // Build a custom 7x7 grid with a single 1x6 corridor.
    const grid = Array.from({ length: 7 }, () => Array(7).fill(0));
    const r = 3;
    for (let c = 0; c < 6; c++) grid[r][c] = 1;

    // Uniform queue of pentominoes only (uq=5).
    const pieceData = window.Solver.getPieceData();
    const remainingPieces = Object.keys(pieceData).filter(name => pieceData[name].numCells === 5);

    const analysis = window.Solver.__testOnly_analyzeRegions(grid, remainingPieces);
    return {
      caveSizes: analysis.cavePruning.sizes,
      caveCells: analysis.cavePruning.cells,
      sizeSizes: analysis.sizePruning.sizes,
    };
  });

  // The region is size 6 which is unfillable by 5s.
  expect(result.sizeSizes).toContain(6);

  // But it contains two distinct 5-cell caves (cells 0-4 and 1-5).
  expect(result.caveSizes).toEqual([5, 5]);
  expect(result.caveCells).toHaveLength(2);
  expect(result.caveCells[0]).toHaveLength(5);
  expect(result.caveCells[1]).toHaveLength(5);

  const caveKey = (cells) => cells.map(([rr, cc]) => `${rr},${cc}`).sort().join(';');
  expect(caveKey(result.caveCells[0])).not.toEqual(caveKey(result.caveCells[1]));
});

test('non-bottleneck degree-2 cells yield no caves (cycle)', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });

  await page.waitForFunction(() => typeof window.Solver?.initPieceData === 'function');
  await page.evaluate(() => {
    window.Solver.initPieceData(getShapesArray());
  });

  const result = await page.evaluate(() => {
    // 2x3 filled rectangle is cyclic enough that corner degree-2 cells are not bottlenecks.
    // With uq=5, the old (incorrect) logic could manufacture caves; the new algorithm
    // must reject them because nbr1 can still reach nbr2 when excluding c.
    const grid = Array.from({ length: 7 }, () => Array(7).fill(0));
    for (let r = 2; r <= 3; r++) {
      for (let c = 1; c <= 3; c++) grid[r][c] = 1;
    }

    const pieceData = window.Solver.getPieceData();
    const remainingPieces = Object.keys(pieceData).filter(name => pieceData[name].numCells === 5);

    const analysis = window.Solver.__testOnly_analyzeRegions(grid, remainingPieces);
    return {
      caveSizes: analysis.cavePruning.sizes,
      caveCells: analysis.cavePruning.cells,
      sizeSizes: analysis.sizePruning.sizes,
    };
  });

  expect(result.sizeSizes).toContain(6);
  expect(result.caveSizes).toEqual([]);
  expect(result.caveCells).toHaveLength(0);
});

test('legend shows cave count (2 unfillable caves)', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });

  await page.waitForFunction(() => typeof window.Solver?.initPieceData === 'function');
  await page.waitForFunction(() => typeof window.visualizeAllPlacements === 'function');
  await page.evaluate(() => {
    window.Solver.initPieceData(getShapesArray());
  });

  const legendText = await page.evaluate(() => {
    const grid = Array.from({ length: 7 }, () => Array(7).fill(0));
    const r = 3;
    for (let c = 0; c < 6; c++) grid[r][c] = 1;

    const pieceData = window.Solver.getPieceData();
    const remainingPieces = Object.keys(pieceData).filter(name => pieceData[name].numCells === 5);
    const analysis = window.Solver.__testOnly_analyzeRegions(grid, remainingPieces);

    window.visualizeAllPlacements(
      [],
      0,
      [],
      analysis.deadCells,
      analysis.sizePruning,
      analysis.shapePruning,
      analysis.cavePruning,
      analysis.forcedRegions,
      null,
      false,
      [],
      analysis.allRegionSizes,
      { nadirs: [], paths: [] }
    );

    const deadGroup = document.getElementById('dead-cells');
    if (!deadGroup) throw new Error('dead-cells group missing after visualizeAllPlacements');
    return deadGroup.textContent || '';
  });

  expect(legendText).toMatch(/\b2 unfillable caves\b/);
  expect(legendText).not.toMatch(/\b1 unfillable cave\b/);
});
