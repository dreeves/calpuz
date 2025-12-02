const TAU = 2*Math.PI;
const w = window.innerWidth;
const h = window.innerHeight;
const boxel = w/20;           // size in pixels of a calendar cell
const calw = boxel*7;         // width of the calendar
const calh = boxel*7;         // height of the calendar
const headh = 63;             // height of the header
const sbarw = 68.5;           // width of the sidebar on the right
const x0 = (w-calw-sbarw)/2;  // (x0, y0) = left top corner of the calendar grid
const y0 = Math.min((h-calh+headh)/2, headh + boxel*4);  // centered or near top, whichever is higher
let svg;                      // this gets initialized when the page loads
let solverSpeed = 50;         // animation delay in ms (adjustable via speed buttons)

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
    title: "Instructions",
    confirmButtonText: "Roger",
    html: `
<p>Drag / rotate / flip the pentominoes (and one hexomino) to fit them all in the grid, covering everything except today's date.</p>
<p>
Clicking or tapping rotates 90 degrees. 
(Right-clicking, or of course just clicking three times, rotates the other way.)
Control-click or long-press to flip a piece over.
</p>
<p>
Made by Bethany, Danny, and Claude.
With original inspiration from Nicky.
</p>
<p>
Thanks also to Christopher for 3D-printing one of these!
</p>
`
  })
};

window.colorChangeButton = function () {
  document.querySelectorAll('.graph #elements > g').forEach(group => {
    const color = getRandomColor();
    group.querySelectorAll('*').forEach(el => el.style.fill = color);
  });
};

// Cached elements container to prevent DOM leak
let elementsContainer = null;

// Add touch support for rotate (tap) and flip (long press)
function addTouchGestures(element, onRotate, onFlip) {
  let touchStartTime = 0;
  let touchStartPos = { x: 0, y: 0 };
  let longPressTimer = null;
  let didLongPress = false;
  const LONG_PRESS_DURATION = 500;
  const MOVE_THRESHOLD = 10;
  
  element.addEventListener('touchstart', (e) => {
    if (e.touches.length !== 1) return;
    touchStartTime = Date.now();
    touchStartPos = { x: e.touches[0].clientX, y: e.touches[0].clientY };
    didLongPress = false;
    
    longPressTimer = setTimeout(() => {
      didLongPress = true;
      onFlip();
      // Haptic feedback if available
      if (navigator.vibrate) navigator.vibrate(50);
    }, LONG_PRESS_DURATION);
  }, { passive: true });
  
  element.addEventListener('touchmove', (e) => {
    if (e.touches.length !== 1) return;
    const dx = e.touches[0].clientX - touchStartPos.x;
    const dy = e.touches[0].clientY - touchStartPos.y;
    if (Math.abs(dx) > MOVE_THRESHOLD || Math.abs(dy) > MOVE_THRESHOLD) {
      // User is dragging, cancel long press
      clearTimeout(longPressTimer);
    }
  }, { passive: true });
  
  element.addEventListener('touchend', (e) => {
    clearTimeout(longPressTimer);
    const elapsed = Date.now() - touchStartTime;
    
    // If it was a quick tap (not a long press or drag), rotate
    if (!didLongPress && elapsed < LONG_PRESS_DURATION) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - touchStartPos.x;
      const dy = touch.clientY - touchStartPos.y;
      if (Math.abs(dx) < MOVE_THRESHOLD && Math.abs(dy) < MOVE_THRESHOLD) {
        onRotate();
      }
    }
  }, { passive: true });
}

// Get or create the elements container (reuse to prevent DOM leak)
function getElementsContainer() {
  if (!elementsContainer) {
    elementsContainer = svg.group().id('elements');
  }
  return elementsContainer;
}

// Visualize a placement from the solver using actual cell positions
function visualizePlacement(placement) {
  if (!placement) return;
  
  const [nom, hue, fig] = shapes.find(shape => shape[0] === placement.name);
  const targetGroup = SVG.get(placement.name);
  if (targetGroup) targetGroup.remove();
  
  const container = getElementsContainer();
  const newGroup = container.group().id(nom);
  
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
    
    // Create new interactive group (reuse container)
    // Outer group handles drag, inner group handles rotation (to avoid conflicts)
    const container = getElementsContainer();
    const newGroup = container.group().id(nom);
    const innerGroup = newGroup.group();
    
    // Draw each cell as a rectangle (same as visualization but interactive)
    for (const [dr, dc] of p.cells) {
      const cellRow = p.row + dr;
      const cellCol = p.col + dc;
      const cellX = x0 + cellCol * boxel;
      const cellY = y0 + cellRow * boxel;
      innerGroup.rect(boxel, boxel).move(cellX, cellY).fill(hue).opacity('0.8');
    }
    
    // Add interactivity: drag on outer group, rotation on inner group
    let moved = false;
    let ang = 0;
    newGroup.draggy();
    newGroup.on("dragmove", () => { moved = true });
    innerGroup.on("mousedown", () => { moved = false });
    innerGroup.on("contextmenu", e => { e.preventDefault() });
    innerGroup.on("mouseup", e => {
      if (!moved) {
        if (e.ctrlKey) {
          innerGroup.node._scale = (innerGroup.node._scale || 1) === 1 ? -1 : 1;
        } else {
          ang += 90 * (e.button === 2 ? 1 : -1);
        }
        const bbox = innerGroup.node.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        innerGroup.node.style.transformOrigin = `${centerX}px ${centerY}px`;
        Crossy(innerGroup.node, "transform", `rotate(${ang}deg) scaleX(${innerGroup.node._scale || 1})`);
      }
      moved = false;
      e.preventDefault();
    });
    
    // Touch support: tap to rotate, long press to flip
    addTouchGestures(innerGroup.node, 
      () => {
        ang += 90;
        const bbox = innerGroup.node.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        innerGroup.node.style.transformOrigin = `${centerX}px ${centerY}px`;
        Crossy(innerGroup.node, "transform", `rotate(${ang}deg) scaleX(${innerGroup.node._scale || 1})`);
      },
      () => {
        innerGroup.node._scale = (innerGroup.node._scale || 1) === 1 ? -1 : 1;
        const bbox = innerGroup.node.getBBox();
        const centerX = bbox.x + bbox.width / 2;
        const centerY = bbox.y + bbox.height / 2;
        innerGroup.node.style.transformOrigin = `${centerX}px ${centerY}px`;
        Crossy(innerGroup.node, "transform", `rotate(${ang}deg) scaleX(${innerGroup.node._scale || 1})`);
      }
    );
  }
}

// Initialize progress panel with table rows for each piece
function initProgressPanel() {
  const container = document.getElementById('pieces-table');
  container.innerHTML = '';
  
  // Header row
  const header = document.createElement('div');
  header.className = 'header-row';
  header.innerHTML = '<span></span><span>Piece</span><span>Orient</span><span>Pos</span>';
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
  
  // Update solution count
  const solutionCount = Solver.getSolutionCount();
  const solutionsEl = document.querySelector('.solver-progress .solutions');
  const countEl = document.getElementById('solution-count');
  if (solutionCount > 0) {
    solutionsEl.style.display = 'block';
    countEl.textContent = solutionCount;
  } else {
    solutionsEl.style.display = 'none';
  }
  
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
      posEl.textContent = `${piece.positionIndex}/${piece.totalPositions}`;
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

// Set solver animation speed (global for speed buttons)
window.setSpeed = function(ms) {
  const delay = parseInt(ms) || 0;
  solverSpeed = delay;
  Solver.setSpeed(delay);
  // Update button active states
  document.querySelectorAll('.speed-btn').forEach(btn => {
    const btnSpeed = parseInt(btn.getAttribute('onclick').match(/\d+/)[0]);
    btn.classList.toggle('active', btnSpeed === delay);
  });
}

// Debug: count solutions for all dates (call from browser console)
window.solveAll = function() { return Solver.solveAll(shapes) }

// Draw circles around target date cells
function drawDateCircles(targetCells) {
  removeeDateCircles(); // Clean up any existing
  const circleGroup = svg.group().id('date-circles');
  for (const [r, c] of targetCells) {
    const cx = x0 + c * boxel + boxel / 2;
    const cy = y0 + r * boxel + boxel / 2;
    circleGroup.circle(boxel * 0.85)
      .center(cx, cy)
      .fill('none')
      .stroke({ width: 3, color: '#ff6b6b', dasharray: '5,3' });
  }
}

// Remove date circles
function removeeDateCircles() {
  const circles = SVG.get('date-circles');
  if (circles) circles.remove();
}

// Draw all pending pieces below the grid in order
function drawPendingPieces(progress, failedPieceName = null) {
  // Remove old pending pieces display
  const oldPending = SVG.get('pending-pieces');
  if (oldPending) oldPending.remove();
  
  if (!progress) return;
  
  // Get only pending pieces (current piece is already on the grid)
  const pendingPieces = progress.filter(p => p.status === 'pending');
  if (pendingPieces.length === 0) return;
  
  const pendingGroup = svg.group().id('pending-pieces');
  
  // Calculate layout - pieces in a row below the grid
  const previewScale = boxel * 0.4;
  const spacing = boxel * 2.5; // Space between pieces
  const startX = x0;
  const startY = y0 + calh + boxel * 1.0; // Padding below grid
  
  // Draw each pending piece
  pendingPieces.forEach((piece, index) => {
    const shape = shapes.find(s => s[0] === piece.name);
    if (!shape) return;
    
    const [name, color, vertices] = shape;
    const pieceGroup = pendingGroup.group();
    
    // Position this piece in the row
    const px = startX + index * spacing;
    const py = startY;
    
    // Draw the piece
    const poly = pieceGroup.polygon(polygen(vertices, previewScale))
      .fill(color)
      .opacity(0.85)
      .stroke({ width: 2, color: '#333' });
    
    pieceGroup.translate(px, py);
    
    // If this is the failed piece, draw X over it
    if (name === failedPieceName) {
      const bbox = poly.bbox();
      const cx = bbox.cx;
      const cy = bbox.cy;
      const size = Math.max(bbox.width, bbox.height) * 0.5;
      pieceGroup.line(cx - size, cy - size, cx + size, cy + size)
        .stroke({ width: 6, color: '#ff0000' });
      pieceGroup.line(cx - size, cy + size, cx + size, cy - size)
        .stroke({ width: 6, color: '#ff0000' });
    }
  });
}

// Visualize all placements (callback for solver)
function visualizeAllPlacements(placements, attempts, progress, deadCells = [], deadRegionSizes = [], nextPiece = null, pieceFailed = false) {
  // Clear all pieces
  for (const [name, , ] of shapes) {
    const group = SVG.get(name);
    if (group) group.remove();
  }
  
  // Clear any existing dead cell markers and text
  const oldDeadMarkers = SVG.get('dead-cells');
  if (oldDeadMarkers) oldDeadMarkers.remove();
  
  // Draw current placements
  for (const p of placements) {
    if (p) visualizePlacement(p);
  }
  
  // Draw red X's on dead cells and show unfillable sizes text
  if (deadCells.length > 0) {
    const deadGroup = svg.group().id('dead-cells');
    for (const [r, c] of deadCells) {
      const cx = x0 + c * boxel + boxel / 2;
      const cy = y0 + r * boxel + boxel / 2;
      const size = boxel * 0.3;
      deadGroup.line(cx - size, cy - size, cx + size, cy + size)
        .stroke({ width: 3, color: '#ff0000' });
      deadGroup.line(cx - size, cy + size, cx + size, cy - size)
        .stroke({ width: 3, color: '#ff0000' });
    }
    
    // Show unfillable region sizes text - starts right of "31", extends as needed
    if (deadRegionSizes.length > 0) {
      const sizesText = `Unfillable region sizes: ${deadRegionSizes.join(', ')}`;
      // Position: starts at column 3 (right of cell 31), vertically centered in row 6
      const textX = x0 + 3 * boxel + boxel * 0.2; // Padding after column 2
      const textY = y0 + 6 * boxel + boxel / 2 - boxel * 0.15; // Vertically centered in row 6
      const fontSize = Math.max(10, Math.min(16, boxel * 0.28)); // Responsive font size
      deadGroup.text(sizesText)
        .font({ size: fontSize, weight: 'bold', family: 'Arial' })
        .fill('#ff0000')
        .move(textX, textY);
    }
  }
  
  // Draw all pending pieces below the grid
  drawPendingPieces(progress, pieceFailed ? nextPiece : null);
  
  // Update progress panel
  updateProgressPanel(attempts, progress);
}

window.solvePuzzle = async function () {
  if (Solver.isSolving()) {
    // Toggle pause/resume instead of stopping
    const nowPaused = Solver.togglePause();
    // Update UI to show paused state (optional: could add visual indicator)
    return;
  }
  
  // Get today's date
  const today = new Date();
  const month = today.getMonth(); // zero-based so Jan = 0, Dec = 11
  const day = today.getDate(); // one-based so the 1st = 1 etc
  
  const dateStr = today.toLocaleDateString('en-US', { month: 'long', day: 'numeric' });
  
  // Show progress panel
  showProgressPanel(true);
  
  /* POPUP DISABLED - uncomment to restore
  Swal.fire({
    title: `Solving for ${dateStr}`,
    text: "Whee!",
    icon: "info",
    timer: 1500,
    showConfirmButton: false
  });
  */
  
  const targetCells = Solver.getDateCells(month, day);
  
  drawDateCircles(targetCells);
  
  const result = await Solver.solve(shapes, targetCells, visualizeAllPlacements, solverSpeed);
  
  removeeDateCircles();
  // Clean up pending pieces display
  const pending = SVG.get('pending-pieces');
  if (pending) pending.remove();
  
  // Panel stays visible - user can dismiss with X button
  
  if (result.success) {
    // Restore interactive pieces at solved positions
    restoreInteractivePieces(result.placements);
    
    /* POPUP DISABLED - uncomment to restore
    Swal.fire({
      title: "Solved!",
      text: `Found a solution for ${dateStr} after ${result.attempts.toLocaleString()} attempts`,
      icon: "success",
      confirmButtonText: "Phew"
    });
    */
  } else {
    /* POPUP DISABLED - uncomment to restore
    Swal.fire({
      title: "No solution found",
      text: `Tried ${result.attempts.toLocaleString()} positions. Then presumably you aborted by clicking the little key again?`,
      icon: "error"
    });
    */
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
  });
  
  // Touch support: tap to rotate, long press to flip
  addTouchGestures(cPol.node, 
    () => {
      ang += 90;
      Crossy(cPol.node, "transform", `rotate(${ang}deg) scaleX(${cPol.node._scale || 1})`);
    },
    () => {
      cPol.node._scale = (cPol.node._scale || 1) === 1 ? -1 : 1;
      Crossy(cPol.node, "transform", `rotate(${ang}deg) scaleX(${cPol.node._scale || 1})`);
    }
  );
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
