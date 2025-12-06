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
  
  // (This is presumably redundant with the shapes array in index.js)
  // Manually defined cell patterns for each piece
  // These are verified to match the actual puzzle pieces
  // Format: [row, col] relative to top-left of bounding box
  const manualPieceCells = {
    // Red Corner: L-shape, 5 cells, non-chiral
    //  X
    //  X
    //  X X X
    "corner": [[0,0], [1,0], [2,0], [2,1], [2,2]],
    
    // Orange Stair: 3x1 plus 2x1 pattern, 5 cells, chiral
    //    X
    //    X
    //  X X
    //  X
    "stair": [[0,1], [1,1], [2,0], [2,1], [3,0]],
    
    // Yellow Z-shape: 3x1 w/ bumps, 5 cells, chiral
    //  X X
    //    X
    //    X X
    "z-shape": [[0,0], [0,1], [1,1], [2,1], [2,2]],
    
    // Green Rectangle: 2x3, 6 cells, non-chiral
    //  X X
    //  X X
    //  X X
    "rectangle": [[0,0], [0,1], [1,0], [1,1], [2,0], [2,1]],
    
    // Cyan C-shape: C/U pattern, 5 cells, non-chiral
    //  X X
    //  X
    //  X X
    "c-shape": [[0,0], [0,1], [1,0], [2,0], [2,1]],
    
    // Purple Chair: 2x2 plus a bump, 5 cells, chiral
    //    X
    //  X X
    //  X X
    "chair": [[0,1], [1,0], [1,1], [2,0], [2,1]],
    
    // Pink Stilt: T-like pattern, 5 cells, chiral
    //  X
    //  X X
    //  X
    //  X
    "stilt": [[0,0], [1,0], [1,1], [2,0], [3,0]],
    
    // Blue L-shape: 5 cells, chiral
    //  X
    //  X
    //  X
    //  X X
    "l-shape": [[0,0], [1,0], [2,0], [3,0], [3,1]],
  };
  
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
  
  function initPieceData(shapes) {
    pieceData = {};
    shapeToPiece = {};
    
    const chiralPieces = new Set(["stair", "z-shape", "chair", "stilt", "l-shape"]);
    
    for (const [name, color, vertices] of shapes) {
      // Use manually defined cells instead of computing from polygon
      const baseCells = manualPieceCells[name];
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
      for (const orientation of orientations) {
        const key = shapeKey(orientation.cells);
        shapeToPiece[key] = name;
      }
    }
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
  
  // Find connected components of empty cells and return any "dead" cells
  // (cells in components too small to be filled by any remaining piece)
  // Check if a region size can be filled with pieces
  // With 7 pentominoes (5 cells) and 1 hexomino (6 cells), valid sizes are:
  // - 5k (all pentominoes): 5, 10, 15, 20, 25, 30, 35
  // - 5k + 1 (pentominoes + hexomino): 6, 11, 16, 21, 26, 31, 36, 41
  // Invalid: 1-4, 7-9, 12-14, 17-19, 22-24, 27-29, 32-34, 37-39, 42+
  function isFillableSize(size) {
    if (size < 5) return false;
    const remainder = size % 5;
    return remainder === 0 || remainder === 1;
  }
  
  function analyzeRegions(grid, remainingPieces = []) {
    const visited = Array(7).fill(null).map(() => Array(7).fill(false));
    const deadCells = [];
    const unfillableSizes = [];
    const unfillableRegionSizes = [];
    const remainingSet = new Set(remainingPieces);
    
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
    
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (grid[r][c] === 1 && !visited[r][c]) {
          const component = floodFill(r, c);
          const size = component.length;
          
          if (!isFillableSize(size)) {
            deadCells.push(...component);
            unfillableSizes.push(size);
            continue;
          }
          
          if (size === 5 || size === 6) {
            const matchingPiece = shapeToPiece[shapeKey(component)];
            if (!matchingPiece || !remainingSet.has(matchingPiece)) {
              deadCells.push(...component);
              unfillableRegionSizes.push(size);
            }
          }
        }
      }
    }
    
    return { deadCells, unfillableSizes, unfillableRegionSizes };
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
    const { deadCells, unfillableSizes, unfillableRegionSizes } = analyzeRegions(grid, remainingPieces);
    const counts = remainingPieces.map(name => ({ name, count: countValidPlacements(grid, name) }));
    return { counts, deadCells, unfillableSizes, unfillableRegionSizes };
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
        visualizeCallback(placements, attempts, allPiecesProgress, [], [], null, false, []);
        
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
      
      // Sort remaining pieces by count (most constrained first)
      const { counts: piecesWithCounts } = getEffectiveCounts(grid, remainingPieces);
      piecesWithCounts.sort((a, b) => a.count - b.count);
      const orderedRemaining = piecesWithCounts.map(p => p.name);
      
      // Pick the most constrained piece (first in sorted order)
      const pieceName = orderedRemaining[0];
      const piece = pieceData[pieceName];
      const totalOrientations = piece.orientations.length;
      const depth = placedPieces.length;
      
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
          
          // Analyze regions: get dead cells AND recompute ordering with forced pieces
          const newPlaced = [...placedPieces, pieceName];
          const rawRemaining = orderedRemaining.slice(1);
          const { counts: remainingCounts, deadCells, unfillableSizes, unfillableRegionSizes } = getEffectiveCounts(grid, rawRemaining);
          remainingCounts.sort((a, b) => a.count - b.count);
          const newRemaining = remainingCounts.map(x => x.name);
          
          const allPiecesProgress = [
            ...placedPieces.map(name => {
              const p = placementsByName[name];
              return { name, status: 'placed',
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
          visualizeCallback(placements, attempts, allPiecesProgress, deadCells, unfillableSizes, unfillableRegionSizes, nextPieceName, false, newRemaining);
          
          // Step mode: pause after each placement
          if (stepMode) {
            paused = true;
            while (paused && solving) {
              await new Promise(r => setTimeout(r, 50));
            }
          } else {
            await delay(currentDelay);
          }
          
          // Prune if dead cells exist OR any remaining piece has count=0
          const hasUnplaceablePiece = remainingCounts.length > 0 && remainingCounts[0].count === 0;
          if (deadCells.length === 0 && !hasUnplaceablePiece) {
            // Recurse with updated lists
            if (await backtrack(newRemaining, newPlaced)) {
              return true;
            }
          }
          
          // Backtrack
          setPiece(grid, orientation.cells, row, col, 1);
          delete placementsByName[pieceName];
          backtracks++;
          currentDepth = depth;
        }
      }
      
      // Only show failure X if this piece had ZERO valid placements
      if (!hadValidPlacement && depth > 0) {
        const allPiecesProgress = [
          ...placedPieces.map(name => {
            const p = placementsByName[name];
            return { name, status: 'placed',
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
        placements = placedPieces.map(name => placementsByName[name]);
        visualizeCallback(placements, attempts, allPiecesProgress, [], [], pieceName, true, orderedRemaining);
        
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
