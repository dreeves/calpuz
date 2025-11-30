const TAU = 2*Math.PI;
const w = window.innerWidth;
const h = window.innerHeight;
const boxel = w/20;           // size in pixels of a calendar cell
const calw = boxel*7;         // width of the calendar
const calh = boxel*7;         // height of the calendar
const headh = 63;             // height of the header
const sbarw = 68.5;           // width of the sidebar on the right
const x0 = (w-calw-sbarw)/2;  // (x0, y0) = left top corner of the calendar grid
const y0 = (h-calh+headh)/2;
let svg;                      // this gets initialized when the page loads
let solving = false;          // flag to prevent multiple solves at once

// The puzzle grid: 1 = valid cell, 0 = out of bounds
// Row 0-1: months (6 cells each, last column empty)
// Row 2-6: days 1-31
// Row 6: only first 3 cells are valid (days 29-31)
const gridTemplate = [
  [1,1,1,1,1,1,0],  // JAN-JUN, empty
  [1,1,1,1,1,1,0],  // JUL-DEC, empty  
  [1,1,1,1,1,1,1],  // 1-7
  [1,1,1,1,1,1,1],  // 8-14
  [1,1,1,1,1,1,1],  // 15-21
  [1,1,1,1,1,1,1],  // 22-28
  [1,1,1,0,0,0,0],  // 29-31, empty
];

// Get grid cell for a given month (0-11) and day (1-31)
function getDateCells(month, day) {
  const monthRow = Math.floor(month / 6);
  const monthCol = month % 6;
  const dayRow = Math.floor((day - 1) / 7) + 2;
  const dayCol = (day - 1) % 7;
  return [[monthRow, monthCol], [dayRow, dayCol]];
}

// Piece definitions as cells they cover (relative to origin)
// Each piece has multiple orientations from rotations (0, 90, 180, 270) and flips
const pieceCells = {
  // corner: L-shape covering 6 cells
  "corner": [[0,0],[0,1],[0,2],[1,2],[2,2],[2,1]],
  // stair: 6 cells in stair pattern  
  "stair": [[0,0],[1,0],[1,1],[2,1],[2,2],[2,3]],
  // z-shape: 6 cells
  "z-shape": [[0,1],[0,2],[1,0],[1,1],[2,0],[2,1]],
  // rectangle: 2x3 = 6 cells
  "rectangle": [[0,0],[0,1],[0,2],[1,0],[1,1],[1,2]],
  // c-shape: 6 cells
  "c-shape": [[0,0],[0,1],[0,2],[1,0],[1,2],[2,0]],
  // chair: 6 cells
  "chair": [[0,0],[0,1],[0,2],[1,2],[2,1],[2,2]],
  // stilt: 6 cells
  "stilt": [[0,0],[0,1],[1,1],[2,1],[2,2],[3,1]],
  // l-shape: 6 cells
  "l-shape": [[0,0],[0,1],[1,0],[2,0],[3,0],[3,1]],
};

// Rotate a piece 90 degrees clockwise
function rotateCells(cells) {
  return cells.map(([r, c]) => [c, -r]);
}

// Flip a piece horizontally
function flipCells(cells) {
  return cells.map(([r, c]) => [-r, c]);
}

// Normalize cells so minimum row and col are 0
function normalizeCells(cells) {
  const minR = Math.min(...cells.map(([r, c]) => r));
  const minC = Math.min(...cells.map(([r, c]) => c));
  return cells.map(([r, c]) => [r - minR, c - minC]).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
}

// Generate all unique orientations for a piece
function getAllOrientations(cells, isChiral) {
  const orientations = new Set();
  let current = cells;
  
  // 4 rotations
  for (let i = 0; i < 4; i++) {
    orientations.add(JSON.stringify(normalizeCells(current)));
    current = rotateCells(current);
  }
  
  // If chiral, also do flipped versions
  if (isChiral) {
    current = flipCells(cells);
    for (let i = 0; i < 4; i++) {
      orientations.add(JSON.stringify(normalizeCells(current)));
      current = rotateCells(current);
    }
  }
  
  return [...orientations].map(s => JSON.parse(s));
}

// Precompute all orientations for all pieces
const pieceOrientations = {
  "corner": getAllOrientations(pieceCells["corner"], false),
  "stair": getAllOrientations(pieceCells["stair"], true),
  "z-shape": getAllOrientations(pieceCells["z-shape"], true),
  "rectangle": getAllOrientations(pieceCells["rectangle"], false),
  "c-shape": getAllOrientations(pieceCells["c-shape"], false),
  "chair": getAllOrientations(pieceCells["chair"], true),
  "stilt": getAllOrientations(pieceCells["stilt"], true),
  "l-shape": getAllOrientations(pieceCells["l-shape"], true),
};

// Check if a piece placement is valid
function canPlace(grid, cells, row, col) {
  for (const [dr, dc] of cells) {
    const r = row + dr;
    const c = col + dc;
    if (r < 0 || r >= 7 || c < 0 || c >= 7) return false;
    if (grid[r][c] !== 1) return false;
  }
  return true;
}

// Place a piece on the grid (mutates grid)
function placePiece(grid, cells, row, col, value) {
  for (const [dr, dc] of cells) {
    grid[row + dr][col + dc] = value;
  }
}

// Copy grid
function copyGrid(grid) {
  return grid.map(row => [...row]);
}

// Solver state for visualization
let solverState = {
  placements: [],
  attempts: 0,
};

// Async delay for animation
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Visualize current solver state
function visualizePlacements(placements) {
  const pieceNames = ["corner", "stair", "z-shape", "rectangle", "c-shape", "chair", "stilt", "l-shape"];
  
  // Clear all pieces first by scattering them off-screen
  pieceNames.forEach((name, i) => {
    const group = SVG.get(name);
    if (group) group.remove();
  });
  
  // Place pieces according to current placements
  placements.forEach(p => {
    if (p) {
      placePolyForSolver(p.name, p.col, p.row, p.orientation, p.orientationIndex);
    }
  });
}

// Simplified piece placement for solver (no drag events, just visual)
function placePolyForSolver(polyId, x, y, cells, orientationIndex) {
  const [nom, hue, fig] = shapes.find(shape => shape[0] === polyId);
  const targetGroup = SVG.get(polyId);
  if (targetGroup) { targetGroup.remove() }
  
  const newGroup = svg.group().id("elements").group().id(nom);
  const pol = newGroup.polygon(polygen(fig, boxel)).fill(hue).opacity('0.8');
  
  // Calculate rotation and flip from orientation index
  const numRotations = orientationIndex % 4;
  const isFlipped = orientationIndex >= 4;
  const angle = numRotations * TAU / 4;
  
  newGroup.translate(x0 + x * boxel, y0 + y * boxel);
  
  const bbox = pol.node.getBBox();
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  pol.node.style.transformOrigin = `${centerX}px ${centerY}px`;
  Crossy(pol.node, "transform", 
        `rotate(${(angle * 180 / Math.PI) % 360}deg) scaleX(${isFlipped ? -1 : 1})`);
}

// Main solver function (async for visualization)
async function solve(targetCells, animationDelay = 50) {
  const pieceNames = ["corner", "stair", "z-shape", "rectangle", "c-shape", "chair", "stilt", "l-shape"];
  
  // Initialize grid - mark target cells as 2 (to leave uncovered)
  const grid = copyGrid(gridTemplate);
  for (const [r, c] of targetCells) {
    grid[r][c] = 2;
  }
  
  solverState = { placements: new Array(8).fill(null), attempts: 0 };
  
  async function backtrack(pieceIndex) {
    if (!solving) return false; // Allow cancellation
    
    if (pieceIndex === 8) {
      // All pieces placed successfully!
      return true;
    }
    
    const pieceName = pieceNames[pieceIndex];
    const orientations = pieceOrientations[pieceName];
    
    // Try each orientation
    for (let oi = 0; oi < orientations.length; oi++) {
      const cells = orientations[oi];
      
      // Try each position
      for (let row = 0; row < 7; row++) {
        for (let col = 0; col < 7; col++) {
          if (canPlace(grid, cells, row, col)) {
            // Place the piece
            placePiece(grid, cells, row, col, 3 + pieceIndex);
            solverState.placements[pieceIndex] = {
              name: pieceName,
              row: row,
              col: col,
              orientation: cells,
              orientationIndex: oi
            };
            solverState.attempts++;
            
            // Visualize
            if (animationDelay > 0 && solverState.attempts % 10 === 0) {
              visualizePlacements(solverState.placements);
              await delay(animationDelay);
            }
            
            // Recurse
            if (await backtrack(pieceIndex + 1)) {
              return true;
            }
            
            // Backtrack
            placePiece(grid, cells, row, col, 1);
            solverState.placements[pieceIndex] = null;
          }
        }
      }
    }
    
    return false;
  }
  
  const success = await backtrack(0);
  
  if (success) {
    visualizePlacements(solverState.placements);
    console.log(`Solution found after ${solverState.attempts} attempts!`);
  } else {
    console.log(`No solution found after ${solverState.attempts} attempts.`);
  }
  
  return success;
}

let shapes = [                // array of 8 shapes aka puzzle pieces
  // 1. red corner (4 orientations, non-chiral)
  ["corner", "#e74c3c", [[0,0],[0,3],[3,3],[3,2],[1,2],[1,0]]],
  // 2. orange stair (8 orientations, chiral)
  ["stair", "#e67e22", [[0,0],[0,2],[1,2],[1,4],[2,4],[2,1],[1,1],[1,0]]],
  // 3. yellow z-shape (4 orientations, chiral)
  ["z-shape", "#f1c40f", [[0,1],[0,3],[1,3],[1,2],[3,2],[3,0],[2,0],[2,1]]],
  // 4. green rectangle (2 orientations, non-chiral)
  ["rectangle", "#2ecc71", [[0,0],[2,0],[2,3],[0,3]]],
  // 5. cyan c-shape (4 orientations, non-chiral) (was #3498db for blue)
  ["c-shape", "#77FFFF", [[0,0],[2,0],[2,3],[0,3],[0,2],[1,2],[1,1],[0,1]]],
  // 6. purple chair (8 orientations, chiral)
  ["chair", "#9966cc", [[1,0],[2,0],[2,3],[0,3],[0,1],[1,1]]],
  // 7. pink stilt (8 orientations, chiral) (was #34495e for gray)
  ["stilt", "#ff99ab", [[0,0],[1,0],[1,1],[2,1],[2,2],[1,2],[1,4],[0,4]]],
  // 8. blue l-shape (8 orientations, chiral) (was #6400ff for dark purple)
  ["l-shape", "#3498db", [[0,0],[0,1],[3,1],[3,2],[4,2],[4,0]]],
]; 

// -----------------------------------------------------------------------------

function getRandomColor() {
  const hexdigs = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) { color += hexdigs[Math.floor(Math.random()*16)] }
  return color
}

window.showTutorial = function () {
  Swal.fire({ // "sweet alert"
    title: "Mini Tutorial",
    confirmButtonText: "Got it!",
    html: "<ul>" +
      "<li><strong>Left click</strong>: rotate left</li>" +
      "<li><strong>Right click</strong>: rotate right</li>" +
      "<li><strong>CTRL + left click</strong>: flip</li>" +
      "<li><strong>Drag</strong>: move</li>" +
      "</ul>"
  })
};

window.colorChangeButton = function () {
  const polygons = document.querySelectorAll('.graph #elements g polygon');
  polygons.forEach(polygon => polygon.style.fill = getRandomColor())
};

window.solvePuzzle = async function () {
  if (solving) {
    solving = false;
    return;
  }
  
  solving = true;
  
  // Get today's date
  const today = new Date();
  const month = today.getMonth(); // 0-11
  const day = today.getDate();    // 1-31
  
  console.log(`Solving for ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })}...`);
  
  // Get the cells to leave uncovered
  const targetCells = getDateCells(month, day);
  console.log(`Target cells: month at [${targetCells[0]}], day at [${targetCells[1]}]`);
  
  // Start the solver with animation
  const success = await solve(targetCells, 30);
  
  if (success) {
    Swal.fire({
      title: "Solved!",
      text: `Found a solution for ${today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })} after ${solverState.attempts} attempts!`,
      icon: "success",
      confirmButtonText: "Nice!"
    });
  } else {
    Swal.fire({
      title: "No solution",
      text: "Could not find a solution. This shouldn't happen!",
      icon: "error"
    });
  }
  
  solving = false;
}

// This function moves a polygon to the specified position, rotated a certain
// amount, and flipped or not. It also sets up the mouse events. It's probably
// dumb to do this every time we move a shape but without doing all this from
// scratch like this, the dragging was ending up fubar.
function movePoly(polyId, x, y, angle = 0, flip = false) {
  // hmm, the shapes array would be nicer as a dictionary
  const [nom, hue, fig] = shapes.find(shape => shape[0] === polyId);
  const targetGroup = SVG.get(polyId);
  if (targetGroup) { targetGroup.remove() } // remove it, set it up from scratch
  const newGroup = svg.group().id("elements").group().id(nom);
  const pol = newGroup.polygon(polygen(fig, boxel)).fill(hue).opacity('0.8')
  newGroup.translate(x0 + x * boxel, y0 + y * boxel);

  const bbox = pol.node.getBBox();
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  pol.node.style.transformOrigin = `${centerX}px ${centerY}px`;
  Crossy(pol.node, "transform", 
        `rotate(${(angle * 180 / Math.PI) % 360}deg) scaleX(${flip ? -1 : 1})`);
  // the stuff above works to make the shapes rotate nicely around their centers, 
  // but for solvePuzzle i don't think we want that. and the stuff below seems to 
  // fail to undo the stuff above :(
  /*
    //pol.node.removeAttribute("style");
    //pol.node.setAttribute("style", "transform-origin: 0 0;");
    const currentTransformOrigin = window.getComputedStyle(pol.node).transformOrigin;
    console.log(currentTransformOrigin); // this claims it starts as 0px 0px
  */

  
  let moved = false;
  let ang = 0;
  const cPol = newGroup.children()[0];
  newGroup.draggy();
  newGroup.on("dragmove", () => { moved = true  });
  cPol.on("mousedown",    () => { moved = false });
  cPol.on("contextmenu",  e => { e.preventDefault() });
  cPol.on("mouseup",      e => {
    if (!moved) {
      const targetNode = e.currentTarget; // or e.target, depending, I guess?
      if (e.ctrlKey) {
        targetNode._scale = (targetNode._scale || 1) === 1 ? -1 : 1;
      } else {
        ang += 90 * (e.button === 2 ? 1 : -1);
      }
      Crossy(targetNode, "transform", 
                     `rotate(${ang}deg) scaleX(${targetNode._scale || 1})`);
    }
    moved = false;
    e.preventDefault()
  })
}

function drawCalendar() {
  const numRows = 7;
  const numCols = 7;
  const labels = [ ["JAN", "FEB", "MAR", "APR", "MAY", "JUN",   ""],
                   ["JUL", "AUG", "SEP", "OCT", "NOV", "DEC",   ""],
                   [  "1",   "2",   "3",   "4",   "5",   "6",  "7"],
                   [  "8",   "9",  "10",  "11",  "12",  "13", "14"],
                   [ "15",  "16",  "17",  "18",  "19",  "20", "21"],
                   [ "22",  "23",  "24",  "25",  "26",  "27", "28"],
                   [ "29",  "30",  "31",    "",    "",    "",   ""] ];

  const gridGroup = svg.group().id('grid');
  gridGroup.addClass('grid-lines');

  const trX = x => x + x0;   // Translate x and y values to calendar coordinates
  const trY = y => y + y0;

  // Draw one of the thin lines of the calendar grid
  const gline = (x1, y1, x2, y2) =>
    gridGroup.line(trX(x1), trY(y1), trX(x2), trY(y2))
             .stroke({ width: 1, color: '#ccc' });

  labels.forEach((row, i) => {
    row.forEach((col, j) => {
      gridGroup.text(labels[i][j]).x(trX(j * boxel + boxel / 2))
                                  .y(trY(i * boxel + boxel / 2))
        .font({ family: 'Arial', size: boxel / 4, anchor: 'middle' })
    })
  });

  for (let i = 0; i <= numCols; i++) {                // draw the vertical lines
    if      (i < 4) gline(i*boxel, 0,       i*boxel,     numRows*boxel)
    else if (i < 7) gline(i*boxel, 0,       i*boxel, (numRows-1)*boxel)
    else if (i===7) gline(i*boxel, 2*boxel, i*boxel, (numRows-1)*boxel)
  } 
  for (let i = 0; i <= numRows; i++) {              // draw the horizontal lines
    if      (i < 2) gline(0, i*boxel, (numCols-1)*boxel, i*boxel)
    else if (i < 7) gline(0, i*boxel,     numCols*boxel, i*boxel)
    else if (i===7) gline(0, i*boxel,           3*boxel, i*boxel)
  }
}

// Turn a list of coordinates outlining the shape of a puzzle piece into an svg
// path string or whatever.
function polygen(tuples, x) {
  return tuples.map(([a,b]) => [x*a, x*b].join(',')).join(' ')
}

// Not currently used but tested and works fine. See scatterShapes().
function spreadAround(angle) {
  return [x0 + 2*boxel + 4.5*boxel * Math.cos(angle),
          y0 + 2*boxel + 4.5*boxel * Math.sin(angle)]
}

// We can do this scattering programmatically with
// shape.translate(...spreadAround(i / shapes.length * TAU))
// where i is the index of the shape in the shapes array.
// But right now movePoly is also where various initialization happens and we
// need to call movePoly on each shape to initialize it, so, here we are.
function scatterShapes() {
  movePoly("corner",      6.5, 1.8)
  movePoly("stair",       5.3, 5.3)
  movePoly("z-shape",       2, 6.3)
  movePoly("rectangle",  -1.2, 5.6)
  movePoly("c-shape",    -2.2, 2)
  movePoly("chair",      -1.3, -1.3)
  movePoly("stilt",       2.2, -2.5)
  movePoly("l-shape",     5.2, -1.3)
}

window.addEventListener("load", function () {
  svg = new SVG(document.querySelector(".graph")).size("100%", "100%");
  drawCalendar();
  scatterShapes();
  //window.solvePuzzle(); // handy for debugging to do this on page load
});