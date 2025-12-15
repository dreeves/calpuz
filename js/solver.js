// Calendar Puzzle Solver
// Brute-force backtracking solver with visualization

window.Solver = (function() {
  
  // The puzzle grid: 1 = valid cell, 0 = out of bounds
  const gridTemplate = [
    [1,1,1,1,1,1,0],  // JAN-JUN, empty
    [1,1,1,1,1,1,0],  // JUL-DEC, empty  
    [1,1,1,1,1,1,1],  // 1-7
    [1,1,1,1,1,1,1],  // 8-14
    [1,1,1,1,1,1,1],  // 15-21
    [1,1,1,1,1,1,1],  // 22-28
    [1,1,1,0,0,0,0],  // 29-31, empty
  ];

  // Rotate cells 90 degrees clockwise
  function rotateCells(cells) {
    // (row, col) -> (col, -row)
    const rotated = cells.map(([r, c]) => [c, -r]);
    return normalizeCells(rotated);
  }
  
  // Flip cells horizontally
  function flipCells(cells) {
    const flipped = cells.map(([r, c]) => [r, -c]);
    return normalizeCells(flipped);
  }
  
  // Normalize cells so min row and col are 0
  function normalizeCells(cells) {
    const minR = Math.min(...cells.map(([r, c]) => r));
    const minC = Math.min(...cells.map(([r, c]) => c));
    return cells.map(([r, c]) => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  }
  
  // Generate all unique orientations (rotations + flips)
  function getAllOrientations(baseCells, isChiral) {
    const seen = new Set();
    const orientations = [];
    
    let current = normalizeCells(baseCells);
    
    // 4 rotations
    for (let rot = 0; rot < 4; rot++) {
      const key = JSON.stringify(current);
      if (!seen.has(key)) {
        seen.add(key);
        orientations.push({ cells: current, rotation: rot, flipped: false });
      }
      current = rotateCells(current);
    }
    
    // If chiral, also try flipped versions
    if (isChiral) {
      current = flipCells(baseCells);
      for (let rot = 0; rot < 4; rot++) {
        const key = JSON.stringify(current);
        if (!seen.has(key)) {
          seen.add(key);
          orientations.push({ cells: current, rotation: rot, flipped: true });
        }
        current = rotateCells(current);
      }
    }
    
    return orientations;
  }
  
  const pieceCells = getPieceCells();
  
  // Create canonical shape key: translate to origin, sort, stringify
  function shapeKey(cells) {
    const minR = Math.min(...cells.map(c => c[0]));
    const minC = Math.min(...cells.map(c => c[1]));
    const translated = cells.map(([r, c]) => [r - minR, c - minC]);
    translated.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    return translated.map(([r, c]) => `${r},${c}`).join('|');
  }
  
  // Precompute piece data from shapes array
  let pieceData = null;
  let shapeToPiece = {}; // Maps normalized shape key → piece name
  let shapeKeyToOrientation = {}; // Maps shape key → { pieceName, orientationIndex }
  
  function initPieceData(shapes) {
    pieceData = {};
    shapeToPiece = {};
    shapeKeyToOrientation = {};
    
    const chiralPieces = getChiralPieces();
    
    for (const [name, color, vertices] of shapes) {
      const baseCells = pieceCells[name];
      const isChiral = chiralPieces.has(name);
      const orientations = getAllOrientations(baseCells, isChiral);
      
      pieceData[name] = {
        name,
        color,
        baseCells,
        orientations,
        numCells: baseCells.length
      };
      
      // Register all orientations in the shape lookup
      for (let i = 0; i < orientations.length; i++) {
        const orientation = orientations[i];
        const key = shapeKey(orientation.cells);
        shapeToPiece[key] = name;
        shapeKeyToOrientation[key] = { pieceName: name, orientationIndex: i };
      }
    }
  }
  
  // Find the exact placement for a forced piece given the region it must fill
  function findForcedPlacement(regionCells, pieceName) {
    const regionKey = shapeKey(regionCells);
    const orientationInfo = shapeKeyToOrientation[regionKey];
    
    if (!orientationInfo || orientationInfo.pieceName !== pieceName) {
      return null; // Shape doesn't match this piece
    }
    
    const piece = pieceData[pieceName];
    const orientation = piece.orientations[orientationInfo.orientationIndex];
    
    // Calculate position offset: region's min corner - piece's min corner
    const regionMinR = Math.min(...regionCells.map(c => c[0]));
    const regionMinC = Math.min(...regionCells.map(c => c[1]));
    const pieceMinR = Math.min(...orientation.cells.map(c => c[0]));
    const pieceMinC = Math.min(...orientation.cells.map(c => c[1]));
    
    const offsetR = regionMinR - pieceMinR;
    const offsetC = regionMinC - pieceMinC;
    
    return {
      name: pieceName,
      orientationIndex: orientationInfo.orientationIndex,
      totalOrientations: piece.orientations.length,
      cells: orientation.cells,
      row: offsetR,
      col: offsetC
    };
  }
  
  // Check if piece can be placed at position
  function canPlace(grid, cells, row, col) {
    for (const [dr, dc] of cells) {
      const r = row + dr;
      const c = col + dc;
      if (r < 0 || r >= 7 || c < 0 || c >= 7) return false;
      if (grid[r][c] !== 1) return false;
    }
    return true;
  }
  
  // Place/remove piece on grid
  function setPiece(grid, cells, row, col, value) {
    for (const [dr, dc] of cells) {
      grid[row + dr][col + dc] = value;
    }
  }
  
  // Copy grid
  function copyGrid(grid) {
    return grid.map(row => [...row]);
  }
  
  // Get date cells for month (0-11) and day (1-31)
  function getDateCells(month, day) {
    const monthRow = Math.floor(month / 6);
    const monthCol = month % 6;
    const dayRow = Math.floor((day - 1) / 7) + 2;
    const dayCol = (day - 1) % 7;
    return [[monthRow, monthCol], [dayRow, dayCol]];
  }
  
  // Solver state
  let solving = false;
  let paused = false;
  let foundSolution = false; // True when paused at a solution
  let exhausted = false; // True when search finished (no more solutions)
  let stepMode = false; // True for single-step mode
  let solutionCount = 0;
  let attempts = 0;
  let backtracks = 0;
  let currentDepth = 0;
  let placements = [];
  let currentDelay = 50; // Dynamic delay that can be changed mid-solve
  
  // Async delay for animation (uses currentDelay if no ms specified)
  // Also waits while paused
  function delay(ms) {
    const actualDelay = ms !== undefined ? ms : currentDelay;
    return new Promise(async resolve => {
      await new Promise(r => setTimeout(r, actualDelay));
      // Wait while paused
      while (paused && solving) {
        await new Promise(r => setTimeout(r, 50));
      }
      resolve();
    });
  }
  
  // Set speed dynamically (can be called during solve)
  function setSpeed(ms) {
    currentDelay = ms;
  }
  
  // Pause/resume functions
  function pause() {
    paused = true;
  }
  
  function resume() {
    paused = false;
  }
  
  function togglePause() {
    paused = !paused;
    return paused;
  }
  
  function isPaused() {
    return paused;
  }
  
  function isExhausted() {
    return exhausted;
  }
  
  function setStepMode(enabled) {
    stepMode = enabled;
  }
  
  function isStepMode() {
    return stepMode;
  }
  
  // Get all valid positions for placing a piece orientation on current grid
  function getValidPositions(grid, cells) {
    const positions = [];
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 7; col++) {
        if (canPlace(grid, cells, row, col)) {
          positions.push([row, col]);
        }
      }
    }
    return positions;
  }
  
  // Check if a region size can be filled with remaining pieces (bounded subset-sum)
  // pieceSizes is array of sizes of remaining pieces (with duplicates for each piece)
  function isFillableSize(size, pieceSizes) {
    if (pieceSizes.length === 0) return size === 0;
    if (size <= 0) return size === 0;
    
    const minSize = Math.min(...pieceSizes);
    if (size < minSize) return false;
    
    // Check if all pieces are same size (uniform queue - fast path)
    // NOTE: For this puzzle, the hexomino (6 cells, only 2 orientations) is always
    // placed first due to "most constrained first" ordering. This means the queue
    // quickly becomes uniform (all pentominoes), so the fast path is used almost
    // exclusively. The DP slow path below is correct but effectively untested.
    if (pieceSizes.every(s => s === pieceSizes[0])) {
      const uq = pieceSizes[0];
      return size % uq === 0 && size / uq <= pieceSizes.length;
    }
    
    // General case: bounded subset-sum DP (rarely exercised - see note above)
    // dp[i] = true if size i is reachable using some subset of pieces
    const dp = new Array(size + 1).fill(false);
    dp[0] = true;
    
    for (const pieceSize of pieceSizes) {
      // Iterate backwards to avoid using same piece twice
      for (let s = size; s >= pieceSize; s--) {
        if (dp[s - pieceSize]) dp[s] = true;
      }
    }
    
    return dp[size];
  }
  
  // Analyze all regions for pruning opportunities and forced placements.
  // DESIGN NOTE: We find ALL unfillable regions of each type rather than stopping
  // at the first one found. This is intentional for visualization purposes - it's
  // more educational and interesting when watching the solver to see all the
  // unfillable regions highlighted simultaneously. The performance cost is trivial
  // since we're already doing flood-fill on all components anyway.
  //
  // PRUNING TYPES (can accumulate on same region):
  // 1. SIZE PRUNING: Region size can't be filled by any subset of remaining pieces
  //    (e.g., region of 7 cells when all pieces are 5 or 6 cells)
  // 2. SHAPE PRUNING: Region size matches a piece size, but shape doesn't match
  //    any available piece (e.g., 5-cell region that's not a valid pentomino)
  // 3. TUNNEL PRUNING: A "tunnel" (dead-end corridor) within a larger region
  //    doesn't match any available piece shape
  // 4. FORCED PLACEMENT: Region/tunnel matches exactly one piece - must place it
  //
  // CURRENT BEHAVIOR: All checks run on every region (no early exits). A region
  // can accumulate multiple shading types. This is intentional for visualization.
  //
  function analyzeRegions(grid, remainingPieces = []) {
    const visited = Array(7).fill(null).map(() => Array(7).fill(false));
    const deadCells = [];
    // Three distinct pruning types with their cell arrays and sizes
    const sizePruning = { cells: [], sizes: [] };      // (1) unfillable size
    const shapePruning = { cells: [], sizes: [] };     // (2) unfillable shape
    const tunnelPruning = { cells: [], sizes: [] };    // (3) unfillable tunnels
    const forcedRegions = { cells: [], sizes: [] };    // (4) regions that force a piece placement
    const allRegionSizes = [];                         // All region sizes (for legend)
    const forcedPlacements = [];                       // Pieces that must be placed in specific regions
    const tunnelDebug = { nadirs: [], paths: [] };     // Debug info for tunnel visualization
    const remainingSet = new Set(remainingPieces);
    
    // Compute piece sizes for generalized pruning
    const pieceSizes = remainingPieces.map(name => pieceData[name]?.numCells || 0);
    const distinctSizes = [...new Set(pieceSizes)];
    
    // Check for uniform queue size (all remaining pieces same size)
    let uniformQueueSize = null;
    if (distinctSizes.length === 1) {
      uniformQueueSize = distinctSizes[0];
    }
    
    function floodFill(startR, startC) {
      const component = [];
      const stack = [[startR, startC]];
      while (stack.length > 0) {
        const [r, c] = stack.pop();
        if (r < 0 || r >= 7 || c < 0 || c >= 7) continue;
        if (visited[r][c]) continue;
        if (grid[r][c] !== 1) continue;
        visited[r][c] = true;
        component.push([r, c]);
        stack.push([r-1, c], [r+1, c], [r, c-1], [r, c+1]);
      }
      return component;
    }
    
    // Count vacant neighbors for a cell within a component
    function countVacantNeighbors(r, c, vacantSet) {
      let count = 0;
      for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
        if (vacantSet.has(`${r+dr},${c+dc}`)) count++;
      }
      return count;
    }
    
    // Find tunnels using the README's cavity-growth algorithm.
    // A tunnel is a dead-end corridor of exactly uq cells.
    // Key insight: grow each tunnel INDEPENDENTLY from each nadir, so tunnels
    // can't merge and overshoot. A tunnel grows until it hits uq or a junction.
    // Returns { tunnels: [...], debug: { nadirs: [...], paths: [...] } }
    //
    // NOTE: This implementation is preserved for reference/debugging, but the
    // solver now uses the README's "Alternate Tunnel Detection Algorithm".
    function findTunnels(component, uq) {
      const debug = { nadirs: [], paths: [] };

      const componentSet = new Set(component.map(([r,c]) => `${r},${c}`));

      // Get neighbors of a cell that are in the component
      function getNeighbors(key) {
        const [r, c] = key.split(',').map(Number);
        const neighbors = [];
        for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
          const nkey = `${r+dr},${c+dc}`;
          if (componentSet.has(nkey)) neighbors.push(nkey);
        }
        return neighbors;
      }

      // Find nadirs - cells with ≤1 neighbor in component (dead ends)
      const nadirs = [];
      for (const [r, c] of component) {
        const key = `${r},${c}`;
        if (getNeighbors(key).length <= 1) nadirs.push(key);
      }

      // Record nadirs for debug visualization
      debug.nadirs = nadirs.map(k => k.split(',').map(Number));

      // Try growing a tunnel from each nadir independently
      for (const nadirKey of nadirs) {
        const tunnel = new Set([nadirKey]);
        const path = [nadirKey]; // Track growth order for visualization

        // Grow until we reach uq cells or can't grow anymore
        while (tunnel.size < uq) {
          // Find a tunnel cell with exactly 1 non-tunnel neighbor (the "front")
          let cellToAdd = null;
          for (const key of tunnel) {
            const nonTunnelNeighbors = getNeighbors(key).filter(n => !tunnel.has(n));
            if (nonTunnelNeighbors.length === 1) {
              cellToAdd = nonTunnelNeighbors[0];
              break;
            }
          }
          if (!cellToAdd) break; // Hit a junction or dead end
          tunnel.add(cellToAdd);
          path.push(cellToAdd);
        }

        // Record the growth path (from nadir to quiescence)
        debug.paths.push(path.map(k => k.split(',').map(Number)));

        if (tunnel.size === uq) {
          const cells = [...tunnel].map(k => k.split(',').map(Number));
          return { tunnels: [cells], debug };
        }
      }

      return { tunnels: [], debug };
    }

    // Find tunnels using the README's "Alternate Tunnel Detection Algorithm".
    //
    // For each degree-2 cell c with neighbors nbr1,nbr2:
    // - Flood-fill the component from nbr1 excluding c to get comp1.
    //   If |comp1| == uq -> comp1 is a tunnel.
    //   If |comp1| == uq-1 -> comp1 ∪ {c} is a tunnel.
    //   If |comp1| == uq-2 -> comp1 ∪ {c,nbr2} is a tunnel.
    // - Repeat symmetrically from nbr2.
    //
    // Debug visualization:
    // - nadirs: all degree<=1 cells
    // - paths: for each nadir, follow the corridor (unique continuation) until
    //          reaching a junction / dead-end.
    // Returns { tunnels: [...], debug: { nadirs: [...], paths: [...] } }
    function findTunnelsAlternate(component, uq) {
      const debug = { nadirs: [], paths: [] };
      const componentSet = new Set(component.map(([r, c]) => `${r},${c}`));

      function getNeighbors(key) {
        const [r, c] = key.split(',').map(Number);
        const neighbors = [];
        for (const [dr, dc] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
          const nkey = `${r + dr},${c + dc}`;
          if (componentSet.has(nkey)) neighbors.push(nkey);
        }
        return neighbors;
      }

      // Nadirs for visualization
      const nadirKeys = [];
      for (const [r, c] of component) {
        const key = `${r},${c}`;
        if (getNeighbors(key).length <= 1) nadirKeys.push(key);
      }
      debug.nadirs = nadirKeys.map(k => k.split(',').map(Number));

      // Corridor paths for visualization
      for (const nadirKey of nadirKeys) {
        const path = [nadirKey];
        let prev = null;
        let cur = nadirKey;
        while (true) {
          const neighbors = getNeighbors(cur);
          const forward = prev === null ? neighbors : neighbors.filter(n => n !== prev);
          if (forward.length !== 1) break;
          const next = forward[0];
          path.push(next);
          prev = cur;
          cur = next;
        }
        debug.paths.push(path.map(k => k.split(',').map(Number)));
      }

      function floodFillExcluding(blockedKey, startKey) {
        const visited = new Set();
        const stack = [startKey];
        while (stack.length) {
          const key = stack.pop();
          if (key === blockedKey) continue;
          if (visited.has(key)) continue;
          if (!componentSet.has(key)) continue;
          visited.add(key);
          for (const n of getNeighbors(key)) stack.push(n);
        }
        return visited;
      }

      const tunnels = [];
      const seen = new Set();

      for (const [r, c] of component) {
        const key = `${r},${c}`;
        const neighbors = getNeighbors(key);
        if (neighbors.length !== 2) continue;
        const [nbr1, nbr2] = neighbors;

        for (const [start, other] of [[nbr1, nbr2], [nbr2, nbr1]]) {
          const side = floodFillExcluding(key, start);
          // README alternate algorithm (procedural):
          // - Start with the component reachable via `start` without going through `key`.
          // - If it's still smaller than uq, add `key`.
          // - If it's still smaller than uq, add `other`.
          // - It's a tunnel iff the resulting set has size exactly uq.
          const candidate = new Set(side);
          if (candidate.size < uq) candidate.add(key);
          if (candidate.size < uq) candidate.add(other);
          if (candidate.size !== uq) continue;

          const id = [...candidate].sort().join(';');
          if (seen.has(id)) continue;
          seen.add(id);
          tunnels.push([...candidate].map(k => k.split(',').map(Number)));
        }
      }

      return { tunnels, debug };
    }
    
    // Find connected components within cavity set
    function findConnectedCavities(cavitySet) {
      const visited = new Set();
      const components = [];
      
      for (const key of cavitySet) {
        if (visited.has(key)) continue;
        
        const component = [];
        const stack = [key];
        while (stack.length > 0) {
          const k = stack.pop();
          if (visited.has(k) || !cavitySet.has(k)) continue;
          visited.add(k);
          const [r, c] = k.split(',').map(Number);
          component.push([r, c]);
          for (const [dr, dc] of [[0,1],[0,-1],[1,0],[-1,0]]) {
            stack.push(`${r+dr},${c+dc}`);
          }
        }
        if (component.length > 0) components.push(component);
      }
      
      return components;
    }
    
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (grid[r][c] === 1 && !visited[r][c]) {
          const component = floodFill(r, c);
          const size = component.length;
          allRegionSizes.push(size);  // Track all region sizes

          // (1) Size pruning: region size not fillable by any combo of remaining pieces
          if (!isFillableSize(size, pieceSizes)) {
            deadCells.push(...component);
            sizePruning.cells.push(component);
            sizePruning.sizes.push(size);
            // EARLY EXIT: Skip shape/tunnel checks since region is already dead.
            // Remove this `continue` to also run shape/tunnel checks on this region
            // (they'd add redundant shading but might be useful for visualization).
            //continue;
          }
          
          // (2) Shape check: region size matches a piece size in queue
          if (distinctSizes.includes(size)) {
            const matchingPiece = shapeToPiece[shapeKey(component)];
            if (!matchingPiece || !remainingSet.has(matchingPiece)) {
              // Pruning: region doesn't match any available piece shape
              deadCells.push(...component);
              shapePruning.cells.push(component);
              shapePruning.sizes.push(size);
              // No `continue` here - tunnel check below still runs on larger regions
              // (though this region is already marked dead, tunnels are sub-regions)
            } else {
              // Forced placement: region matches exactly one piece shape
              const placement = findForcedPlacement(component, matchingPiece);
              if (!placement) throw new Error(`findForcedPlacement failed for ${matchingPiece}`);
              forcedPlacements.push(placement);
              forcedRegions.cells.push(component);
              forcedRegions.sizes.push(size);
            }
          }
          
          // (3) Tunnel check: only if uniform queue (all remaining pieces same size)
          // NOTE: Tunnels are WITHIN a larger region (size > uniformQueueSize).
          // A tunnel is a dead-end corridor of exactly uniformQueueSize cells.
          // If a tunnel's shape doesn't match any available piece, the whole
          // region is effectively dead (you can't fill the tunnel).
          // This check runs INDEPENDENTLY of shape check above - a region could
          // pass shape check but still have an unfillable tunnel inside it.
          if (uniformQueueSize /*&& size > uniformQueueSize*/) {
            const { tunnels, debug } = findTunnelsAlternate(component, uniformQueueSize);
            // Accumulate debug info for visualization
            tunnelDebug.nadirs.push(...debug.nadirs);
            tunnelDebug.paths.push(...debug.paths);
            for (const tunnel of tunnels) {
              const tunnelKey = shapeKey(tunnel);
              const matchingPiece = shapeToPiece[tunnelKey];
              if (!matchingPiece || !remainingSet.has(matchingPiece)) {
                // Pruning: tunnel doesn't match any available piece
                deadCells.push(...tunnel);
                tunnelPruning.cells.push(tunnel);
                tunnelPruning.sizes.push(tunnel.length);
              } else {
                // Forced placement: tunnel matches exactly one piece shape
                const placement = findForcedPlacement(tunnel, matchingPiece);
                if (!placement) throw new Error(`findForcedPlacement failed for ${matchingPiece}`);
                forcedPlacements.push(placement);
                forcedRegions.cells.push(tunnel);
                forcedRegions.sizes.push(tunnel.length);
              }
            }
          }
        }
      }
    }

    return { deadCells, sizePruning, shapePruning, tunnelPruning, forcedRegions, forcedPlacements, allRegionSizes, tunnelDebug };
  }
  
  function countValidPlacements(grid, pieceName) {
    const piece = pieceData[pieceName];
    let count = 0;
    for (const orientation of piece.orientations) {
      count += getValidPositions(grid, orientation.cells).length;
    }
    return count;
  }
  
  function getEffectiveCounts(grid, remainingPieces) {
    const { deadCells, sizePruning, shapePruning, tunnelPruning, forcedRegions, forcedPlacements, allRegionSizes, tunnelDebug } = analyzeRegions(grid, remainingPieces);
    const counts = remainingPieces.map(name => ({ name, count: countValidPlacements(grid, name) }));
    return { counts, deadCells, sizePruning, shapePruning, tunnelPruning, forcedRegions, forcedPlacements, allRegionSizes, tunnelDebug };
  }
  
  // Main solve function
  async function solve(shapes, targetCells, visualizeCallback, animationDelay = 0) {
    if (!pieceData) {
      initPieceData(shapes);
    }
    
    // Initialize speed from parameter
    currentDelay = animationDelay;
    
    const allPieceNames = shapes.map(s => s[0]);
    
    // Initialize grid
    const grid = copyGrid(gridTemplate);
    for (const [r, c] of targetCells) {
      grid[r][c] = 2; // Mark date cells as occupied (don't cover)
    }
    
    solving = true;
    paused = false;
    foundSolution = false;
    exhausted = false;
    solutionCount = 0;
    attempts = 0;
    backtracks = 0;
    currentDepth = 0;
    
    // Use object keyed by piece name instead of array by index
    const placementsByName = {};
    
    async function backtrack(remainingPieces, placedPieces) {
      if (!solving) return false;
      
      if (remainingPieces.length === 0) {
        // Found a solution!
        solutionCount++;
        foundSolution = true;
        paused = true;
        
        // Build progress from placed pieces (in order they were placed)
        const allPiecesProgress = placedPieces.map(name => {
          const p = placementsByName[name];
          return { name, status: 'placed',
              orientation: p.orientationIndex + 1, totalOrientations: p.totalOrientations,
              positionIndex: p.positionIndex + 1, totalPositions: p.totalPositions };
        });
        // Convert to array format for visualization
        placements = placedPieces.map(name => placementsByName[name]);
        const emptyPruning = { cells: [], sizes: [] };
        const emptyTunnelDebug = { nadirs: [], paths: [] };
        visualizeCallback(placements, attempts, allPiecesProgress, [], emptyPruning, emptyPruning, emptyPruning, emptyPruning, null, false, [], [], emptyTunnelDebug);
        
        // Wait while paused (user can resume to find next solution)
        while (paused && solving) {
          await new Promise(r => setTimeout(r, 50));
        }
        foundSolution = false;
        
        // If stopped while paused, return true to unwind gracefully
        if (!solving) return true;
        
        // Continue searching for more solutions (don't return true)
        return false;
      }
      
      // Check for forced placements and dead cells BEFORE choosing which piece to branch on
      const analysis = getEffectiveCounts(grid, remainingPieces);
      
      // If dead cells exist at this level, prune immediately
      if (analysis.deadCells.length > 0) {
        return false;
      }
      
      // If a forced placement exists, treat it as "the try" for this level
      // This routes forced placements through the same visualization path as normal tries
      if (analysis.forcedPlacements.length > 0) {
        const forced = analysis.forcedPlacements[0];
        const depth = placedPieces.length;
        
        // Place the forced piece
        setPiece(grid, forced.cells, forced.row, forced.col, 3 + depth);
        placementsByName[forced.name] = {
          name: forced.name,
          row: forced.row,
          col: forced.col,
          cells: forced.cells,
          rotation: 0,
          flipped: false,
          orientationIndex: forced.orientationIndex,
          totalOrientations: forced.totalOrientations,
          positionIndex: 0,
          totalPositions: 1,
          forced: true
        };
        attempts++;
        currentDepth = depth + 1;
        
        const newPlaced = [...placedPieces, forced.name];
        const newRemaining = remainingPieces.filter(n => n !== forced.name);
        
        // Reanalyze after forced placement for visualization
        const newAnalysis = getEffectiveCounts(grid, newRemaining);
        newAnalysis.counts.sort((a, b) => a.count - b.count);
        const orderedNewRemaining = newAnalysis.counts.map(x => x.name);
        
        const allPiecesProgress = [
          ...placedPieces.map(name => {
            const p = placementsByName[name];
            return { name, status: p.forced ? 'forced' : 'placed',
                orientation: p.orientationIndex + 1, totalOrientations: p.totalOrientations,
                positionIndex: p.positionIndex + 1, totalPositions: p.totalPositions };
          }),
          { name: forced.name, status: 'forced',
              orientation: forced.orientationIndex + 1, totalOrientations: forced.totalOrientations,
              positionIndex: 1, totalPositions: 1 },
          ...orderedNewRemaining.map(name => {
            const pd = pieceData[name];
            return { name, status: 'pending',
                orientation: 0, totalOrientations: pd.orientations.length,
                positionIndex: 0, totalPositions: 0 };
          })
        ];
        
        const nextPieceName = orderedNewRemaining.length > 0 ? orderedNewRemaining[0] : null;
        placements = newPlaced.map(name => placementsByName[name]);
        visualizeCallback(placements, attempts, allPiecesProgress, newAnalysis.deadCells,
            newAnalysis.sizePruning, newAnalysis.shapePruning, newAnalysis.tunnelPruning,
          newAnalysis.forcedRegions, nextPieceName, false, orderedNewRemaining, newAnalysis.allRegionSizes, newAnalysis.tunnelDebug);
        
        // Step mode or delay
        if (stepMode) {
          paused = true;
          while (paused && solving) {
            await new Promise(r => setTimeout(r, 50));
          }
        } else {
          await delay(currentDelay);
        }
        
        // Recurse (next level will handle next forced placement or normal search)
        if (newAnalysis.deadCells.length === 0) {
          if (await backtrack(newRemaining, newPlaced)) {
            return true;
          }
        }
        
        // Backtrack: undo forced placement
        setPiece(grid, forced.cells, forced.row, forced.col, 1);
        delete placementsByName[forced.name];
        backtracks++;
        currentDepth = depth;
        return false;
      }
      
      // Sort remaining pieces by count (most constrained first)
      analysis.counts.sort((a, b) => a.count - b.count);
      const orderedRemaining = analysis.counts.map(p => p.name);
      const currentRemaining = orderedRemaining;
      const currentPlaced = placedPieces;
      
      // Pick the most constrained piece (first in sorted order)
      const pieceName = orderedRemaining[0];
      const piece = pieceData[pieceName];
      const totalOrientations = piece.orientations.length;
      const depth = currentPlaced.length;  // Use currentPlaced (includes forced pieces)
      const forcedAtThisLevel = currentPlaced.slice(placedPieces.length);  // Track forced pieces for cleanup
      
      // Track if any placement was ever possible
      let hadValidPlacement = false;
      
      // Try each orientation
      for (let orientIdx = 0; orientIdx < totalOrientations; orientIdx++) {
        const orientation = piece.orientations[orientIdx];
        const validPositions = getValidPositions(grid, orientation.cells);
        const totalPositions = validPositions.length;
        
        if (totalPositions > 0) {
          hadValidPlacement = true;
        }
        
        // Try each valid position
        for (let posIdx = 0; posIdx < totalPositions; posIdx++) {
          const [row, col] = validPositions[posIdx];
          
          // Place piece
          setPiece(grid, orientation.cells, row, col, 3 + depth);
          placementsByName[pieceName] = {
            name: pieceName,
            row,
            col,
            cells: orientation.cells,
            rotation: orientation.rotation,
            flipped: orientation.flipped,
            orientationIndex: orientIdx,
            totalOrientations,
            positionIndex: posIdx,
            totalPositions
          };
          attempts++;
          currentDepth = depth + 1;
          
          // Analyze regions for this placement (forced placements handled by recursion)
          const newPlaced = [...currentPlaced, pieceName];
          const rawRemaining = orderedRemaining.slice(1);
          const tryAnalysis = getEffectiveCounts(grid, rawRemaining);
          
          const { counts: remainingCounts, deadCells, sizePruning, shapePruning, tunnelPruning, forcedRegions, allRegionSizes, tunnelDebug } = tryAnalysis;
          remainingCounts.sort((a, b) => a.count - b.count);
          const newRemaining = remainingCounts.map(x => x.name);

          const allPiecesProgress = [
            ...placedPieces.map(name => {
              const p = placementsByName[name];
              return { name, status: p.forced ? 'forced' : 'placed',
                  orientation: p.orientationIndex + 1, totalOrientations: p.totalOrientations,
                  positionIndex: p.positionIndex + 1, totalPositions: p.totalPositions };
            }),
            { name: pieceName, status: 'current',
                orientation: orientIdx + 1, totalOrientations,
                positionIndex: posIdx + 1, totalPositions },
            ...newRemaining.map(name => {
              const pd = pieceData[name];
              return { name, status: 'pending',
                  orientation: 0, totalOrientations: pd.orientations.length,
                  positionIndex: 0, totalPositions: 0 };
            })
          ];

          // Next piece to try (first of remaining after current)
          const nextPieceName = newRemaining.length > 0 ? newRemaining[0] : null;

          // Convert to array for visualization
          placements = newPlaced.map(name => placementsByName[name]);
          visualizeCallback(placements, attempts, allPiecesProgress, deadCells, sizePruning, shapePruning, tunnelPruning, forcedRegions, nextPieceName, false, newRemaining, allRegionSizes, tunnelDebug);
          
          // Step mode: pause after each placement
          if (stepMode) {
            paused = true;
            while (paused && solving) {
              await new Promise(r => setTimeout(r, 50));
            }
          } else {
            await delay(currentDelay);
          }
          
          // Prune if dead cells exist, otherwise recurse
          if (deadCells.length === 0) {
            if (await backtrack(newRemaining, newPlaced)) {
              return true;
            }
          }
          
          // Backtrack: undo this piece
          setPiece(grid, orientation.cells, row, col, 1);
          delete placementsByName[pieceName];
          backtracks++;
          currentDepth = depth;
        }
      }
      
      // Only show failure X if this piece had ZERO valid placements
      if (!hadValidPlacement && depth > 0) {
        const allPiecesProgress = [
          ...currentPlaced.map(name => {
            const p = placementsByName[name];
            return { name, status: p.forced ? 'forced' : 'placed',
                orientation: p.orientationIndex + 1, totalOrientations: p.totalOrientations,
                positionIndex: p.positionIndex + 1, totalPositions: p.totalPositions };
          }),
          ...orderedRemaining.map(name => {
            const pd = pieceData[name];
            return { name, status: 'pending',
                orientation: 0, totalOrientations: pd.orientations.length,
                positionIndex: 0, totalPositions: 0 };
          })
        ];
        placements = currentPlaced.map(name => placementsByName[name]);
        const emptyPruning2 = { cells: [], sizes: [] };
        const emptyTunnelDebug2 = { nadirs: [], paths: [] };
        visualizeCallback(placements, attempts, allPiecesProgress, [], emptyPruning2, emptyPruning2, emptyPruning2, emptyPruning2, pieceName, true, orderedRemaining, [], emptyTunnelDebug2);
        
        // Step mode or normal delay
        if (stepMode) {
          paused = true;
          while (paused && solving) {
            await new Promise(r => setTimeout(r, 50));
          }
        } else {
          await delay(currentDelay);
        }
      }
      
      // Undo forced placements made at the start of this backtrack level
      for (let i = forcedAtThisLevel.length - 1; i >= 0; i--) {
        const forcedName = forcedAtThisLevel[i];
        const fp = placementsByName[forcedName];
        setPiece(grid, fp.cells, fp.row, fp.col, 1);
        delete placementsByName[forcedName];
      }
      
      return false;
    }
    
    const success = await backtrack(allPieceNames, []);
    solving = false;
    exhausted = true; // Search finished
    
    return { success, attempts };
  }
  
  function stop() {
    solving = false;
    paused = false;
    foundSolution = false;
  }
  
  function isSolving() {
    return solving;
  }
  
  function hasFoundSolution() {
    return foundSolution;
  }
  
  function getSolutionCount() {
    return solutionCount;
  }
  
  function getBacktracks() {
    return backtracks;
  }
  
  function getCurrentDepth() {
    return currentDepth;
  }
  
  function getPieceData() {
    return pieceData;
  }
  
  // Find first solution for a given date (synchronous, no visualization)
  // NOTE: Uses fixed piece order, not dynamic "most constrained first" ordering
  function solveOnce(shapes, targetCells) {
    if (!pieceData) {
      initPieceData(shapes);
    }
    
    const pieceNames = shapes.map(s => s[0]);
    const grid = copyGrid(gridTemplate);
    for (const [r, c] of targetCells) {
      grid[r][c] = 2;
    }
    
    let attempts = 0;
    
    function backtrack(pieceIndex) {
      if (pieceIndex === 8) return true; // Found a solution - stop
      
      const pieceName = pieceNames[pieceIndex];
      const piece = pieceData[pieceName];
      
      for (const orientation of piece.orientations) {
        const validPositions = getValidPositions(grid, orientation.cells);
        for (const [row, col] of validPositions) {
          setPiece(grid, orientation.cells, row, col, 3 + pieceIndex);
          attempts++;
          
          const { deadCells } = analyzeRegions(grid);
          if (deadCells.length === 0 && backtrack(pieceIndex + 1)) {
            return true;
          }
          
          setPiece(grid, orientation.cells, row, col, 1);
        }
      }
      return false;
    }
    
    const success = backtrack(0);
    return { success, attempts };
  }
  
  // Solve once for all 366 dates, return total attempts
  // NOTE: Uses fixed piece order, not dynamic "most constrained first" ordering
  // If threshold is provided, aborts early when total exceeds it
  function solveOnceAllDates(shapes, quiet = false, threshold = Infinity) {
    let totalAttempts = 0;
    let solved = 0;
    
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const targetCells = getDateCells(month, day);
        const result = solveOnce(shapes, targetCells);
        totalAttempts += result.attempts;
        if (result.success) solved++;
        if (totalAttempts >= threshold) return Infinity; // Aborted - not a valid result
      }
    }
    
    if (!quiet) {
      console.log(`Solved ${solved}/366 dates in ${totalAttempts.toLocaleString()} total tries`);
    }
    return totalAttempts;
  }
  
  // Count all solutions for a given date (synchronous, no visualization)
  // NOTE: Uses fixed piece order, not dynamic "most constrained first" ordering
  function countSolutions(shapes, targetCells) {
    if (!pieceData) {
      initPieceData(shapes);
    }
    
    const pieceNames = shapes.map(s => s[0]);
    const grid = copyGrid(gridTemplate);
    for (const [r, c] of targetCells) {
      grid[r][c] = 2;
    }
    
    let solutionCount = 0;
    let attempts = 0;
    let firstSolutionAttempts = null;
    
    function backtrack(pieceIndex) {
      if (pieceIndex === 8) {
        solutionCount++;
        if (firstSolutionAttempts === null) {
          firstSolutionAttempts = attempts;
        }
        return; // Don't stop - continue to find more solutions
      }
      
      const pieceName = pieceNames[pieceIndex];
      const piece = pieceData[pieceName];
      
      for (const orientation of piece.orientations) {
        const validPositions = getValidPositions(grid, orientation.cells);
        for (const [row, col] of validPositions) {
          setPiece(grid, orientation.cells, row, col, 3 + pieceIndex);
          attempts++;
          
          // Prune if dead cells exist
          const { deadCells } = analyzeRegions(grid);
          if (deadCells.length === 0) {
            backtrack(pieceIndex + 1);
          }
          
          setPiece(grid, orientation.cells, row, col, 1); // Backtrack
        }
      }
    }
    
    backtrack(0);
    return { solutions: solutionCount, firstAt: firstSolutionAttempts, totalAttempts: attempts };
  }
  
  // Debug function: count solutions for all dates
  function solveAll(shapes) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const results = [];
    let totalSolutions = 0;
    let totalAttempts = 0;
    
    console.log('=== FINDING ALL SOLUTIONS FOR ALL DATES ===\n');
    
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const targetCells = getDateCells(month, day);
        const result = countSolutions(shapes, targetCells);
        
        const dateStr = `${monthNames[month]} ${day}`;
        results.push({ month, day, dateStr, ...result });
        totalSolutions += result.solutions;
        totalAttempts += result.totalAttempts;
        
        const firstStr = result.firstAt !== null 
          ? `first at ${result.firstAt.toLocaleString().padStart(8)}`
          : 'no solution';
        console.log(`${dateStr.padEnd(7)}: ${firstStr}, ${result.solutions.toLocaleString().padStart(5)} total in ${result.totalAttempts.toLocaleString().padStart(10)} attempts`);
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total dates: ${results.length}`);
    console.log(`Total solutions: ${totalSolutions.toLocaleString()}`);
    console.log(`Total attempts: ${totalAttempts.toLocaleString()}`);
    console.log(`Average solutions per date: ${Math.round(totalSolutions / results.length).toLocaleString()}`);
    
    // Find dates with most and fewest solutions
    const withSolutions = results.filter(r => r.solutions > 0);
    if (withSolutions.length > 0) {
      const mostSolutions = withSolutions.reduce((a, b) => a.solutions > b.solutions ? a : b);
      const fewestSolutions = withSolutions.reduce((a, b) => a.solutions < b.solutions ? a : b);
      console.log(`Most solutions: ${mostSolutions.dateStr} (${mostSolutions.solutions.toLocaleString()})`);
      console.log(`Fewest solutions: ${fewestSolutions.dateStr} (${fewestSolutions.solutions.toLocaleString()})`);
    }
    
    return results;
  }
  
  return {
    solve,
    solveOnce,
    solveOnceAllDates,
    solveAll,
    stop,
    isSolving,
    pause,
    resume,
    togglePause,
    isPaused,
    isExhausted,
    setStepMode,
    isStepMode,
    hasFoundSolution,
    getSolutionCount,
    getBacktracks,
    getCurrentDepth,
    getDateCells,
    initPieceData,
    getPieceData,
    setSpeed
  };
})();
