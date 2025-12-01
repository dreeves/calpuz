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

function getRandomColor() {
  const hexdigs = '0123456789ABCDEF';
  let color = '#';
  for (let i = 0; i < 6; i++) { color += hexdigs[Math.floor(Math.random()*16)] }
  return color
}

window.showTutorial = function () {
  Swal.fire({
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

// Visualize a placement from the solver using actual cell positions
function visualizePlacement(placement) {
  if (!placement) return;
  
  const [nom, hue, fig] = shapes.find(shape => shape[0] === placement.name);
  const targetGroup = SVG.get(placement.name);
  if (targetGroup) targetGroup.remove();
  
  const newGroup = svg.group().id("elements").group().id(nom);
  
  // Draw each cell as a square, based on the solver's actual cell placement
  for (const [dr, dc] of placement.cells) {
    const cellRow = placement.row + dr;
    const cellCol = placement.col + dc;
    const cellX = x0 + cellCol * boxel;
    const cellY = y0 + cellRow * boxel;
    newGroup.rect(boxel, boxel).move(cellX, cellY).fill(hue).opacity('0.8').stroke({ width: 1, color: '#fff' });
  }
}

// Restore interactive pieces after solving - use simple rectangles like visualization
function restoreInteractivePieces(placements) {
  for (const p of placements) {
    if (!p) continue;
    
    // Remove the solver's cell-based visualization
    const group = SVG.get(p.name);
    if (group) group.remove();
    
    // Get the piece color
    const [nom, hue, fig] = shapes.find(shape => shape[0] === p.name);
    
    // Create new interactive group
    const newGroup = svg.group().id("elements").group().id(nom);
    
    // Draw each cell as a rectangle (same as visualization but interactive)
    for (const [dr, dc] of p.cells) {
      const cellRow = p.row + dr;
      const cellCol = p.col + dc;
      const cellX = x0 + cellCol * boxel;
      const cellY = y0 + cellRow * boxel;
      newGroup.rect(boxel, boxel).move(cellX, cellY).fill(hue).opacity('0.8');
    }
    
    // Add interactivity to the group
    let moved = false;
    let ang = 0;
    newGroup.draggy();
    newGroup.on("dragmove", () => { moved = true });
    newGroup.on("mousedown", () => { moved = false });
    newGroup.on("contextmenu", e => { e.preventDefault() });
    newGroup.on("mouseup", e => {
      if (!moved) {
        if (e.ctrlKey) {
          newGroup.node._scale = (newGroup.node._scale || 1) === 1 ? -1 : 1;
        } else {
          ang += 90 * (e.button === 2 ? 1 : -1);
        }
        const bbox = newGroup.node.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        newGroup.node.style.transformOrigin = `${centerX}px ${centerY}px`;
        Crossy(newGroup.node, "transform", `rotate(${ang}deg) scaleX(${newGroup.node._scale || 1})`);
      }
      moved = false;
      e.preventDefault();
    });
  }
}

// Initialize progress panel with table rows for each piece
function initProgressPanel() {
  const container = document.getElementById('pieces-table');
  container.innerHTML = '';
  
  // Header row
  const header = document.createElement('div');
  header.className = 'header-row';
  header.innerHTML = '<span></span><span>Piece</span><span>Orient</span><span>Position</span>';
  container.appendChild(header);
  
  // Row for each piece
  for (const [name, color] of shapes) {
    const row = document.createElement('div');
    row.className = 'piece-row pending';
    row.id = `row-${name}`;
    row.innerHTML = `
      <div class="piece-color" style="background-color: ${color}"></div>
      <div class="piece-name">${name}</div>
      <div class="piece-orient">-</div>
      <div class="piece-pos">-</div>
    `;
    container.appendChild(row);
  }
}

// Update progress panel with all pieces' state
function updateProgressPanel(attempts, allPiecesProgress) {
  document.querySelector('.solver-progress .attempts').textContent = 
    `${attempts.toLocaleString()} attempts`;
  
  if (!allPiecesProgress) return;
  
  // Update each piece row
  for (const piece of allPiecesProgress) {
    const row = document.getElementById(`row-${piece.name}`);
    if (!row) continue;
    
    row.classList.remove('placed', 'current', 'pending');
    row.classList.add(piece.status);
    
    const orientEl = row.querySelector('.piece-orient');
    const posEl = row.querySelector('.piece-pos');
    
    if (piece.status === 'pending') {
      orientEl.textContent = '-';
      posEl.textContent = '-';
    } else {
      orientEl.textContent = `${piece.orientation}/${piece.totalOrientations}`;
      posEl.textContent = `(${piece.row}, ${piece.col})`;
    }
  }
}

// Show/hide progress panel (global for close button)
window.showProgressPanel = function(show) {
  const panel = document.getElementById('solver-progress');
  if (show) {
    initProgressPanel();
    panel.classList.add('active');
  } else {
    panel.classList.remove('active');
  }
}

// Visualize all placements (callback for solver)
function visualizeAllPlacements(placements, attempts, progress) {
  // Clear all pieces
  for (const [name, , ] of shapes) {
    const group = SVG.get(name);
    if (group) group.remove();
  }
  
  // Draw current placements
  for (const p of placements) {
    if (p) visualizePlacement(p);
  }
  
  // Update progress panel
  updateProgressPanel(attempts, progress);
}

window.solvePuzzle = async function () {
  if (Solver.isSolving()) {
    Solver.stop();
    showProgressPanel(false);
    Swal.fire({
      title: "Stopped",
      text: "Solver stopped.",
      icon: "info",
      timer: 1500,
      showConfirmButton: false
    });
    scatterShapes();
    return;
  }
  
  // Get today's date
  const today = new Date();
  const month = 0; //today.getMonth();
  const day = 1; //today.getDate();
  
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  
  // Show progress panel
  showProgressPanel(true);
  
  Swal.fire({
    title: `Solving for ${dateStr}`,
    text: "Watch the progress panel!",
    icon: "info",
    timer: 1500,
    showConfirmButton: false
  });
  
  const targetCells = Solver.getDateCells(month, day);
  
  const result = await Solver.solve(shapes, targetCells, visualizeAllPlacements, 20);
  
  // Panel stays visible - user can dismiss with X button
  
  if (result.success) {
    // Restore interactive pieces at solved positions
    restoreInteractivePieces(result.placements);
    
    Swal.fire({
      title: "Solved!",
      text: `Found a solution for ${dateStr} after ${result.attempts.toLocaleString()} attempts`,
      icon: "success",
      confirmButtonText: "Phew"
    });
  } else {
    Swal.fire({
      title: "No solution found",
      text: `Tried ${result.attempts.toLocaleString()} positions. This may be a bug.`,
      icon: "error"
    });
    scatterShapes();
  }
}

function movePoly(polyId, x, y, angle = 0, flip = false) {
  const [nom, hue, fig] = shapes.find(shape => shape[0] === polyId);
  const targetGroup = SVG.get(polyId);
  if (targetGroup) { targetGroup.remove() }
  const newGroup = svg.group().id("elements").group().id(nom);
  const pol = newGroup.polygon(polygen(fig, boxel)).fill(hue).opacity('0.8')
  newGroup.translate(x0 + x * boxel, y0 + y * boxel);

  const bbox = pol.node.getBBox();
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  pol.node.style.transformOrigin = `${centerX}px ${centerY}px`;
  Crossy(pol.node, "transform", 
        `rotate(${(angle * 180 / Math.PI) % 360}deg) scaleX(${flip ? -1 : 1})`);

  let moved = false;
  let ang = 0;
  const cPol = newGroup.children()[0];
  newGroup.draggy();
  newGroup.on("dragmove", () => { moved = true  });
  cPol.on("mousedown",    () => { moved = false });
  cPol.on("contextmenu",  e => { e.preventDefault() });
  cPol.on("mouseup",      e => {
    if (!moved) {
      const targetNode = e.currentTarget;
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

  const trX = x => x + x0;
  const trY = y => y + y0;

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

  for (let i = 0; i <= numCols; i++) {
    if      (i < 4) gline(i*boxel, 0,       i*boxel,     numRows*boxel)
    else if (i < 7) gline(i*boxel, 0,       i*boxel, (numRows-1)*boxel)
    else if (i===7) gline(i*boxel, 2*boxel, i*boxel, (numRows-1)*boxel)
  } 
  for (let i = 0; i <= numRows; i++) {
    if      (i < 2) gline(0, i*boxel, (numCols-1)*boxel, i*boxel)
    else if (i < 7) gline(0, i*boxel,     numCols*boxel, i*boxel)
    else if (i===7) gline(0, i*boxel,           3*boxel, i*boxel)
  }
}

function polygen(tuples, x) {
  return tuples.map(([a,b]) => [x*a, x*b].join(',')).join(' ')
}

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
  
  // Initialize solver with piece data
  Solver.initPieceData(shapes);
});
