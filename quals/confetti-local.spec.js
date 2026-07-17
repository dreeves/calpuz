const { test, expect } = require('@playwright/test');

// Replicata: solve today's puzzle (place a real solution's pieces), which
// triggers checkPuzzleSolved's dynamic import of canvas-confetti.
// Expectata: the confetti module loads from the local vendored copy
// (js/vendor/confetti.module.mjs) and a confetti canvas appears -- even with
// cdn.skypack.dev unreachable.
// Resultata (pre-fix): "TypeError: Failed to fetch dynamically imported
// module: https://cdn.skypack.dev/canvas-confetti" and no confetti.
test('solving today fires confetti from the local vendored module', async ({ page, baseURL }) => {
  // Keep the celebration sound quiet/deterministic in headless runs.
  await page.addInitScript(() => localStorage.setItem('calpuz-muted', 'true'));

  // Simulate skypack being down (which it is, in practice).
  await page.route(url => url.hostname.includes('skypack'), route => route.abort());

  const requests = [];
  page.on('request', req => requests.push(req.url()));

  const pageErrors = [];
  page.on('pageerror', err => pageErrors.push(String(err)));

  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const result = await page.evaluate(async () => {
    const shapes = getShapesArray();
    const today = new Date();
    const targetCells = Solver.getDateCells(today.getMonth(), today.getDate());
    const res = Solver.solveOnce(shapes, targetCells);
    if (!res.success) throw new Error('solveOnce found no solution for today');
    if (res.placements.length !== 8) {
      throw new Error(`Expected 8 placements, got ${res.placements.length}`);
    }
    for (const p of res.placements) visualizePlacement(p);
    await checkPuzzleSolved();
    return { placed: res.placements.length };
  });
  expect(result.placed).toBe(8);

  // Confetti fires EXCELLENT_CONFETTI_DELAY_MS (100ms) after the check;
  // canvas-confetti appends its canvas to <body> on first fire.
  await page.waitForSelector('body > canvas', { state: 'attached', timeout: 5000 });

  const confettiRequests = requests.filter(u => u.includes('confetti'));
  expect(confettiRequests.some(u => u.endsWith('/js/vendor/confetti.module.mjs'))).toBe(true);
  expect(requests.filter(u => u.includes('skypack'))).toEqual([]);
  expect(pageErrors).toEqual([]);
});
