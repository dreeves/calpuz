const { test, expect } = require('@playwright/test');

test('solver finds a solution for all 372 date slots', async ({ page, baseURL }) => {
  test.setTimeout(120000); // 2 minutes - this test is slow

  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof Solver !== 'undefined' && Solver.getPieceData());

  const result = await page.evaluate(() => {
    const shapes = getShapesArray();
    let solved = 0;
    let failed = [];

    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const targetCells = Solver.getDateCells(month, day);
        const res = Solver.solveOnce(shapes, targetCells);
        if (res.success) {
          solved++;
        } else {
          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          failed.push(`${monthNames[month]} ${day}`);
        }
      }
    }

    return { solved, failed };
  });

  expect(result.failed).toEqual([]);
  expect(result.solved).toBe(372); // 12 months × 31 days (includes "invalid" dates like Feb 31)
});

test('hint checker agrees with solver for all 372 date slots', async ({ page, baseURL }) => {
  test.setTimeout(120000);

  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => typeof Solver !== 'undefined' && Solver.getPieceData());

  const result = await page.evaluate(() => {
    const shapes = getShapesArray();
    let passed = 0;
    let failed = [];

    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const targetCells = Solver.getDateCells(month, day);

        // With no pieces placed, should always be solvable
        const hintResult = Solver.checkSolvableWithPlacements(shapes, targetCells, []);

        if (hintResult.solvable) {
          passed++;
        } else {
          const monthNames = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
          failed.push(`${monthNames[month]} ${day}: ${hintResult.reason}`);
        }
      }
    }

    return { passed, failed };
  });

  expect(result.failed).toEqual([]);
  expect(result.passed).toBe(372); // 12 months × 31 days
});
