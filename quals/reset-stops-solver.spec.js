const { test, expect } = require('@playwright/test');

// Replicata: start the solver at a slow speed, let it place a few pieces,
// then hit reset while it's running.
// Expectata: the search actually stops -- pieces stay scattered, pruning
// overlays stay gone, and the solver ends up neither solving nor exhausted
// (so the speed buttons still work for a fresh solve).
// Resultata (pre-fix): every stack frame of the search kept looping after
// stop(), repainting solver placements and overlays over the scattered pieces
// for minutes, and then marked the search exhausted, which disabled the speed
// buttons until a page reload.
test('reset during a slow solve stops the solver for real', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const pristine = await page.evaluate(() =>
    document.getElementById('corner').getAttribute('transform'));

  await page.evaluate(async () => {
    window.runSpeed(300);
    // Let the solver make several placements.
    await new Promise(r => setTimeout(r, 1500));
    window.resetPieces();
  });

  // Wait past several solver delay periods; a zombie search would repaint here.
  await page.waitForTimeout(1500);

  const after = await page.evaluate(() => ({
    cornerTransform: document.getElementById('corner')?.getAttribute('transform') ?? 'MISSING',
    deadCellsOverlay: !!document.getElementById('dead-cells'),
    pendingDocket: !!document.getElementById('pending-pieces'),
    solving: Solver.isSolving(),
    exhausted: Solver.isExhausted(),
  }));

  expect(after.cornerTransform).toBe(pristine);
  expect(after.deadCellsOverlay).toBe(false);
  expect(after.pendingDocket).toBe(false);
  expect(after.solving).toBe(false);
  expect(after.exhausted).toBe(false);

  // And the speed buttons must still be usable for a fresh solve.
  const speedBtnDisabled = await page.evaluate(() => {
    window.showProgressPanel(true);
    updateSpeedButtons();
    return document.querySelector('.speed-btn[data-speed="100"]').classList.contains('disabled');
  });
  expect(speedBtnDisabled).toBe(false);
});
