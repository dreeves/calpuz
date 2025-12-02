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

  // Convert polygon vertices to grid cells covered
  // Polygon vertices are in (x, y) format where each unit = 1 grid cell
  function polygonToCells(vertices) {
    // Find bounding box
    const xs = vertices.map(v => v[0]);
    const ys = vertices.map(v => v[1]);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    
    const cells = [];
    
    // Check each potential cell (using center point)
    for (let row = minY; row < maxY; row++) {
      for (let col = minX; col < maxX; col++) {
        // Test if cell center is inside polygon
        const cx = col + 0.5;
        const cy = row + 0.5;
        if (pointInPolygon(cx, cy, vertices)) {
          cells.push([row - minY, col - minX]); // Normalize to origin
        }
      }
    }
    
    return cells;
  }
  
  // Point-in-polygon test using ray casting
  function pointInPolygon(x, y, vertices) {
    let inside = false;
    const n = vertices.length;
    
    for (let i = 0, j = n - 1; i < n; j = i++) {
      const xi = vertices[i][0], yi = vertices[i][1];
      const xj = vertices[j][0], yj = vertices[j][1];
      
      if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
        inside = !inside;
      }
    }
    
    return inside;
  }
  
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
  
  // Precompute piece data from shapes array
  let pieceData = null;
  
  function initPieceData(shapes) {
    pieceData = {};
    
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
      
      console.log(`${name}: ${baseCells.length} cells, ${orientations.length} orientations`);
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
  let attempts = 0;
  let placements = [];
  
  // Async delay for animation
  function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
  
  // Main solve function
  async function solve(shapes, targetCells, visualizeCallback, animationDelay = 30) {
    if (!pieceData) {
      initPieceData(shapes);
    }
    
    const pieceNames = shapes.map(s => s[0]);
    
    // Initialize grid
    const grid = copyGrid(gridTemplate);
    for (const [r, c] of targetCells) {
      grid[r][c] = 2; // Mark date cells as occupied (don't cover)
    }
    
    solving = true;
    attempts = 0;
    placements = new Array(8).fill(null);
    
    async function backtrack(pieceIndex) {
      if (!solving) return false;
      
      if (pieceIndex === 8) {
        return true; // All pieces placed!
      }
      
      const pieceName = pieceNames[pieceIndex];
      const piece = pieceData[pieceName];
      
      const totalOrientations = piece.orientations.length;
      
      // Try each orientation
      for (let orientIdx = 0; orientIdx < totalOrientations; orientIdx++) {
        const orientation = piece.orientations[orientIdx];
        // Try each position
        for (let row = 0; row < 7; row++) {
          for (let col = 0; col < 7; col++) {
            if (canPlace(grid, orientation.cells, row, col)) {
              // Place piece
              setPiece(grid, orientation.cells, row, col, 3 + pieceIndex);
              placements[pieceIndex] = {
                name: pieceName,
                row,
                col,
                cells: orientation.cells,
                rotation: orientation.rotation,
                flipped: orientation.flipped,
                orientationIndex: orientIdx,
                totalOrientations
              };
              attempts++;
              
              // Visualize periodically with progress info for ALL pieces
              // Update every 20 attempts to reduce DOM overhead
              if (animationDelay > 0 && attempts % 20 === 0) {
                // Build progress state for all pieces
                const allPiecesProgress = pieceNames.map((name, idx) => {
                  const piece = pieceData[name];
                  if (idx < pieceIndex) {
                    // Already placed - use stored orientationIndex for correct odometer display
                    const p = placements[idx];
                    return {
                      name,
                      status: 'placed',
                      orientation: p ? p.orientationIndex + 1 : '-',
                      totalOrientations: p ? p.totalOrientations : piece.orientations.length,
                      row: p ? p.row : 0,
                      col: p ? p.col : 0
                    };
                  } else if (idx === pieceIndex) {
                    // Currently being placed
                    return {
                      name,
                      status: 'current',
                      orientation: orientIdx + 1,
                      totalOrientations,
                      row,
                      col
                    };
                  } else {
                    // Not yet attempted
                    return {
                      name,
                      status: 'pending',
                      orientation: 0,
                      totalOrientations: piece.orientations.length,
                      row: 0,
                      col: 0
                    };
                  }
                });
                visualizeCallback(placements, attempts, allPiecesProgress);
                await delay(animationDelay);
              }
              
              // Recurse
              if (await backtrack(pieceIndex + 1)) {
                return true;
              }
              
              // Backtrack
              setPiece(grid, orientation.cells, row, col, 1);
              placements[pieceIndex] = null;
            }
          }
        }
      }
      
      return false;
    }
    
    const success = await backtrack(0);
    solving = false;
    
    // Final visualization
    visualizeCallback(placements, attempts);
    
    return { success, attempts, placements };
  }
  
  function stop() {
    solving = false;
  }
  
  function isSolving() {
    return solving;
  }
  
  function getPieceData() {
    return pieceData;
  }
  
  // Debug function: solve for all dates and log attempts
  async function solveAll(shapes) {
    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const results = [];
    let totalAttempts = 0;
    let solved = 0;
    let failed = 0;
    
    console.log('=== SOLVING ALL DATES ===\n');
    
    for (let month = 0; month < 12; month++) {
      for (let day = 1; day <= 31; day++) {
        const targetCells = getDateCells(month, day);
        
        // Solve without visualization (animationDelay = 0, no callback)
        const result = await solve(shapes, targetCells, () => {}, 0);
        
        const dateStr = `${monthNames[month]} ${day}`;
        results.push({ month, day, dateStr, ...result });
        totalAttempts += result.attempts;
        
        if (result.success) {
          solved++;
          console.log(`${dateStr.padEnd(7)}: ${result.attempts.toLocaleString().padStart(10)} attempts`);
        } else {
          failed++;
          console.log(`${dateStr.padEnd(7)}: FAILED after ${result.attempts.toLocaleString()} attempts`);
        }
      }
    }
    
    console.log('\n=== SUMMARY ===');
    console.log(`Total dates: ${results.length}`);
    console.log(`Solved: ${solved}`);
    console.log(`Failed: ${failed}`);
    console.log(`Total attempts: ${totalAttempts.toLocaleString()}`);
    console.log(`Average attempts: ${Math.round(totalAttempts / results.length).toLocaleString()}`);
    
    // Find hardest and easiest dates
    const successfulResults = results.filter(r => r.success);
    if (successfulResults.length > 0) {
      const hardest = successfulResults.reduce((a, b) => a.attempts > b.attempts ? a : b);
      const easiest = successfulResults.reduce((a, b) => a.attempts < b.attempts ? a : b);
      console.log(`Hardest: ${hardest.dateStr} (${hardest.attempts.toLocaleString()} attempts)`);
      console.log(`Easiest: ${easiest.dateStr} (${easiest.attempts.toLocaleString()} attempts)`);
    }
    
    return results;
  }
  
  return {
    solve,
    solveAll,
    stop,
    isSolving,
    getDateCells,
    initPieceData,
    getPieceData
  };
})();
