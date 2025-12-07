const PIECE_DEFINITIONS = [
  {
    name: "rectangle",
    color: "#2ecc71",
    cells: [[0,0], [0,1], [1,0], [1,1], [2,0], [2,1]],
    chiral: false
  },
  {
    name: "z-shape",
    color: "#f1c40f",
    cells: [[0,0], [0,1], [1,1], [2,1], [2,2]],
    chiral: true
  },
  {
    name: "stair",
    color: "#e67e22",
    cells: [[0,1], [1,1], [2,0], [2,1], [3,0]],
    chiral: true
  },
  {
    name: "corner",
    color: "#e74c3c",
    cells: [[0,0], [1,0], [2,0], [2,1], [2,2]],
    chiral: false
  },
  {
    name: "c-shape",
    color: "#77FFFF",
    cells: [[0,0], [0,1], [1,0], [2,0], [2,1]],
    chiral: false
  },
  {
    name: "stilt",
    color: "#ff99ab",
    cells: [[0,0], [1,0], [1,1], [2,0], [3,0]],
    chiral: true
  },
  {
    name: "l-shape",
    color: "#3498db",
    cells: [[0,0], [1,0], [2,0], [3,0], [3,1]],
    chiral: true
  },
  {
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
