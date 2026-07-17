const { test, expect } = require('@playwright/test');

// Replicata: place a piece via movePoly at each of the 8 (rot, flip)
// orientation states, then decode its transform via dumpPieceLayoutInternal.
// Expectata: the decoded (rot, flip) equals what was applied, for all 8 states.
// Resultata (pre-fix): the LINEAR_TO_ROT_FLIP entries for flipped 90/270 were
// swapped, so dump->apply silently changed the orientation of those pieces.
test('dump/apply roundtrip is identity for all 8 rot/flip states', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const mismatches = await page.evaluate(() => {
    const bad = [];
    for (const rot of [0, 90, 180, 270]) {
      for (const flip of [false, true]) {
        // Use a chiral, asymmetric piece so every state is geometrically distinct.
        movePoly('stair', 1, 2, rot * Math.PI / 180, flip);
        const dumped = dumpPieceLayoutInternal().pieces['stair'];
        if (dumped.rot !== rot || dumped.flip !== flip ||
            Math.abs(dumped.x - 1) > 1e-9 || Math.abs(dumped.y - 2) > 1e-9) {
          bad.push({ applied: { rot, flip }, dumped });
        }
      }
    }
    return bad;
  });

  expect(mismatches).toEqual([]);
});

// The frame layout is captured via copyPieceLayout and re-applied via
// applyCellLayout, so it must survive the roundtrip exactly.
test('frame layout roundtrips exactly through dumpPieceLayout', async ({ page, baseURL }) => {
  await page.goto(`${baseURL}/`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!document.getElementById('corner'));

  const { stored, dumped } = await page.evaluate(() => {
    window.framePieces();
    return {
      stored: LAYOUTS.frame.pieces,
      dumped: dumpPieceLayoutInternal().pieces,
    };
  });

  for (const name of Object.keys(stored)) {
    expect(dumped[name].rot).toBe(stored[name].rot);
    expect(dumped[name].flip).toBe(stored[name].flip);
    expect(dumped[name].x).toBeCloseTo(stored[name].x, 9);
    expect(dumped[name].y).toBeCloseTo(stored[name].y, 9);
  }
});
