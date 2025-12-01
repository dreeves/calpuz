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
  
  // Manually defined cell patterns for each piece
  // These are verified to match the actual puzzle pieces
  // Format: [row, col] relative to top-left of bounding box
  const manualPieceCells = {
    // Corner: L-shape, 5 cells
    //  X
    //  X
    //  X X X
    "corner": [[0,0], [1,0], [2,0], [2,1], [2,2]],
    
    // Stair: N-pentomino pattern, 5 cells (truly chiral)
    //    X
    //    X
    //  X X
    //  X
    "stair": [[0,1], [1,1], [2,0], [2,1], [3,0]],
    
    // Z-shape: Z pattern, 5 cells
    //  X X
    //    X
    //    X X
    "z-shape": [[0,0], [0,1], [1,1], [2,1], [2,2]],
    
    // Rectangle: 2x3, 6 cells
    //  X X
    //  X X
    //  X X
    "rectangle": [[0,0], [0,1], [1,0], [1,1], [2,0], [2,1]],
    
    // C-shape: C/U pattern, 5 cells
    //  X X
    //  X
    //  X X
    "c-shape": [[0,0], [0,1], [1,0], [2,0], [2,1]],
    
    // Chair: chair pattern, 5 cells
    //    X
    //  X X
    //  X X
    "chair": [[0,1], [1,0], [1,1], [2,0], [2,1]],
    
    // Stilt: T-like pattern, 5 cells
    //  X
    //  X X
    //  X
    //  X
    "stilt": [[0,0], [1,0], [1,1], [2,0], [3,0]],
    
    // L-shape: L pattern, 5 cells  
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
      
      // Try each orientation
      for (const orientation of piece.orientations) {
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
                flipped: orientation.flipped
              };
              attempts++;
              
              // Visualize periodically
              if (animationDelay > 0 && attempts % 5 === 0) {
                visualizeCallback(placements, attempts);
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
  
  return {
    solve,
    stop,
    isSolving,
    getDateCells,
    initPieceData
  };
})();
