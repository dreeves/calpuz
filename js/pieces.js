/* Previous way of defining the pieces, as polygons instead of list of cells:
["rectangle", [[0,0],[2,0],[2,3],[0,3]]],
//  X X
//  X X
//  X X
["z-shape",   [[0,1],[0,3],[1,3],[1,2],[3,2],[3,0],[2,0],[2,1]]],
//  X X
//    X
//    X X
["stair",     [[0,0],[0,2],[1,2],[1,4],[2,4],[2,1],[1,1],[1,0]]],
//    X
//    X
//  X X
//  X
["corner",    [[0,0],[0,3],[3,3],[3,2],[1,2],[1,0]]],
//  X
//  X
//  X X X
["c-shape",   [[0,0],[2,0],[2,3],[0,3],[0,2],[1,2],[1,1],[0,1]]],
//  X X
//  X
//  X X
["stilt",     [[0,0],[1,0],[1,1],[2,1],[2,2],[1,2],[1,4],[0,4]]],
//  X
//  X X
//  X
//  X
["l-shape",   [[0,0],[0,1],[3,1],[3,2],[4,2],[4,0]]],
//  X
//  X
//  X
//  X X
["chair",     [[1,0],[2,0],[2,3],[0,3],[0,1],[1,1]]],
//    X
//  X X
//  X X
*/

// Array of 8 shapes aka puzzle pieces, ordered by best-known search efficiency:
//   rectangle, z-shape, stair, corner, c-shape, stilt, l-shape, chair
// (Not that that matters for the current solver which dynamically reorders 
// pieces by most-constrained-first.)
const PIECE_DEFINITIONS = [
  { // 1. green rectangle (2 orientations)
    name: "rectangle",
    color: "#2ecc71",
    cells: [[0,0], [0,1], [1,0], [1,1], [2,0], [2,1]],
    chiral: false
  },
  { // 2. yellow z-shape (4 orientations)
    name: "z-shape",
    color: "#f1c40f",
    cells: [[0,0], [0,1], [1,1], [2,1], [2,2]],
    chiral: true
  },
  { // 3. orange stair (8 orientations)
    name: "stair",
    color: "#e67e22",
    cells: [[0,1], [1,1], [2,0], [2,1], [3,0]],
    chiral: true
  },
  { // 4. red corner (4 orientations)
    name: "corner",
    color: "#e74c3c",
    cells: [[0,0], [1,0], [2,0], [2,1], [2,2]],
    chiral: false
  },
  { // 5. cyan c-shape (4 orientations)
    name: "c-shape",
    color: "#77FFFF",
    cells: [[0,0], [0,1], [1,0], [2,0], [2,1]],
    chiral: false
  },
  { // 6. pink stilt (8 orientations)
    name: "stilt",
    color: "#ff99ab",
    cells: [[0,0], [1,0], [1,1], [2,0], [3,0]],
    chiral: true
  },
  {  // 7. blue l-shape (8 orientations)
    name: "l-shape",
    color: "#3498db",
    cells: [[0,0], [1,0], [2,0], [3,0], [3,1]],
    chiral: true
  },
  {  // 8. purple chair (8 orientations)
    name: "chair",
    color: "#9966cc",
    cells: [[0,1], [1,0], [1,1], [2,0], [2,1]],
    chiral: true
  }
];

function cellsToPolygon(cells) {
  const grid = {};
  for (const [r, c] of cells) {
    grid[`${r},${c}`] = true;
  }
  
  const edges = [];
  for (const [r, c] of cells) {
    if (!grid[`${r-1},${c}`]) edges.push([[c, r], [c+1, r]]);
    if (!grid[`${r+1},${c}`]) edges.push([[c+1, r+1], [c, r+1]]);
    if (!grid[`${r},${c-1}`]) edges.push([[c, r+1], [c, r]]);
    if (!grid[`${r},${c+1}`]) edges.push([[c+1, r], [c+1, r+1]]);
  }
  
  const edgeMap = {};
  for (const [start, end] of edges) {
    edgeMap[`${start[0]},${start[1]}`] = end;
  }
  
  const polygon = [];
  let current = edges[0][0];
  const startKey = `${current[0]},${current[1]}`;
  do {
    polygon.push(current);
    current = edgeMap[`${current[0]},${current[1]}`];
  } while (`${current[0]},${current[1]}` !== startKey);
  
  return polygon;
}

function getShapesArray() {
  return PIECE_DEFINITIONS.map(p => [p.name, p.color, cellsToPolygon(p.cells)]);
}

function getPieceCells() {
  const cells = {};
  for (const p of PIECE_DEFINITIONS) {
    cells[p.name] = p.cells;
  }
  return cells;
}

function getChiralPieces() {
  return new Set(PIECE_DEFINITIONS.filter(p => p.chiral).map(p => p.name));
}
