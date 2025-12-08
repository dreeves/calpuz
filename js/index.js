const TAU = 2*Math.PI;

// ============ CONFIGURATION CONSTANTS ============

// Piece rendering
const PIECE_OPACITY = 0.8;
const ROTATION_DEGREES = 90;

// Docket (pending pieces row)
const DOCKET_SCALE = 0.35;    // Preview piece size as fraction of boxel
const DOCKET_GAP = 0.3;       // Gap between pieces as fraction of boxel

// Pruning visualization (distinct stripes for each type)
// Type 1: Unfillable SIZE (region size can't be covered by piece combos)
const SIZE_PRUNE_COLOR_1 = '#000000';
const SIZE_PRUNE_COLOR_2 = '#ffff00';  // Black/yellow = classic hazard
const SIZE_PRUNE_WIDTH = 0.1;          // Stripe width as fraction of boxel
const SIZE_PRUNE_ANGLE = 45;           // Stripe angle in degrees
const SIZE_PRUNE_OPACITY = 0.15;

// Type 2: Unfillable SHAPE (size-5/6 region doesn't match any available piece)
const SHAPE_PRUNE_COLOR_1 = '#ff0000';
const SHAPE_PRUNE_COLOR_2 = '#ffffff';  // Red/white = danger
const SHAPE_PRUNE_WIDTH = 0.1;
const SHAPE_PRUNE_ANGLE = -45;          // Opposite angle for distinction
const SHAPE_PRUNE_OPACITY = 0.15;

// Type 3: Unfillable TUNNEL (dead-end corridor can't be filled)
const TUNNEL_PRUNE_COLOR_1 = '#0000ff';
const TUNNEL_PRUNE_COLOR_2 = '#ffffff';  // Blue/white = tunnel
const TUNNEL_PRUNE_WIDTH = 0.1;
const TUNNEL_PRUNE_ANGLE = 45;           // Same angle as size, different colors
const TUNNEL_PRUNE_OPACITY = 0.15;

// Date circle highlighting
const DATE_CIRCLE_RADIUS = 0.85;   // As fraction of boxel
const DATE_CIRCLE_STROKE = 3;
const DATE_CIRCLE_COLOR = '#ff6b6b';

// Touch gestures
const LONG_PRESS_MS = 500;
const MOVE_THRESHOLD_PX = 10;

// ============ END CONFIGURATION ============

// Singular or plural with comma formatting. Eg, splur(1000, "cat") returns "1,000 cats"
// or for irregular plurals, eg, splur(1, "child", "children") returns "1 child".
function splur(n, s, p=null) { 
  const formatted = n.toLocaleString();
  return n === 1    ? `${formatted} ${s}`
       : p === null ? `${formatted} ${s}s`
       :              `${formatted} ${p}`;
}

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
window.pauseOnSolution = true;  // set to false in console to skip pausing on solutions

const shapes = getShapesArray();
const shapeMap = new Map(shapes.map(s => [s[0], s]));  // O(1) lookup by name

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
  const LONG_PRESS_DURATION = LONG_PRESS_MS;
  const MOVE_THRESHOLD = MOVE_THRESHOLD_PX;
  
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

// Snap a group to the nearest grid position
function snapToGrid(group) {
  // Use getBoundingClientRect to get visual position (includes CSS transforms)
  const rect = group.node.getBoundingClientRect();
  const svgRect = svg.node.getBoundingClientRect();
  const visualX = rect.left - svgRect.left;
  const visualY = rect.top - svgRect.top;
  // Compute nearest grid cell
  const col = Math.round((visualX - x0) / boxel);
  const row = Math.round((visualY - y0) / boxel);
  // Get current transform position 
  const matrix = group.transform();
  const currentX = matrix.x || 0;
  const currentY = matrix.y || 0;
  // Calculate how far visual position is from transform position
  const deltaX = visualX - currentX;
  const deltaY = visualY - currentY;
  // Snap: move to grid cell, accounting for the visual offset
  group.translate(x0 + col * boxel - deltaX, y0 + row * boxel - deltaY);
}

// Visualize a placement from the solver using actual cell positions
function visualizePlacement(placement) {
  if (!placement) return;
  
  const [nom, hue, fig] = shapeMap.get(placement.name);
  const targetGroup = SVG.get(placement.name);
  if (targetGroup) targetGroup.remove();
  
  const container = getElementsContainer();
  const newGroup = container.group().id(nom);
  const innerGroup = newGroup.group();
  
  // Draw cells at LOCAL coordinates (relative to piece origin)
  for (const [dr, dc] of placement.cells) {
    innerGroup.rect(boxel, boxel).move(dc * boxel, dr * boxel).fill(hue).opacity('0.8').stroke({ width: 1, color: '#fff' });
  }
  // Translate the GROUP to board position (matches manual piece convention)
  newGroup.translate(x0 + placement.col * boxel, y0 + placement.row * boxel);
  
  // Always interactive - drag on outer group, rotation on inner group
  let moved = false;
  let ang = 0;
  newGroup.draggy();
  newGroup.on("dragmove", () => { moved = true });
  newGroup.on("dragend", () => { snapToGrid(newGroup); });
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
  
  // Touch support
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

// Initialize progress panel with table rows for each piece (runs once)
let panelInitialized = false;
function initProgressPanel() {
  if (panelInitialized) return;
  panelInitialized = true;
  
  const container = document.getElementById('pieces-table');
  
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

// Update progress panel with all pieces' state - mutate existing rows for performance
let lastRowOrder = [];  // Track row order to detect reordering
const rowCache = {};    // Cache DOM references per piece name

function updateProgressPanel(attempts, allPiecesProgress) {
  const sols = Solver.getSolutionCount();
  document.getElementById('attempts-text').textContent = 
    `${splur(sols, "sol'n")} in ${splur(attempts, "try", "tries")}`;
  
  if (!allPiecesProgress) return;
  
  // Ensure header exists before updating rows
  initProgressPanel();
  
  const container = document.getElementById('pieces-table');
  const currentOrder = allPiecesProgress.map(p => p.name);
  const orderChanged = currentOrder.join(',') !== lastRowOrder.join(',');
  
  // Only rebuild DOM if order changed
  if (orderChanged) {
    lastRowOrder = currentOrder;
    const header = container.querySelector('.header-row');
    container.innerHTML = '';
    if (header) container.appendChild(header);
    
    for (const piece of allPiecesProgress) {
      const color = shapeMap.get(piece.name)?.[1] || '#999';
      const row = document.createElement('div');
      row.className = `piece-row ${piece.status}`;
      row.id = `row-${piece.name}`;
      row.innerHTML = `
        <div class="progress-bar orient-bar"></div>
        <div class="progress-bar pos-bar"></div>
        <div class="piece-color" style="background-color: ${color}"></div>
        <div class="piece-name">${piece.name}</div>
        <div class="piece-orient"></div>
        <div class="piece-pos"></div>
      `;
      container.appendChild(row);
      // Cache DOM references for fast updates
      rowCache[piece.name] = {
        row,
        orientBar: row.children[0],
        posBar: row.children[1],
        orientText: row.children[4],
        posText: row.children[5]
      };
    }
  }
  
  // Update values in existing rows (fast mutation, no DOM queries)
  for (const piece of allPiecesProgress) {
    const cached = rowCache[piece.name];
    if (!cached) continue;
    
    cached.row.className = `piece-row ${piece.status}`;
    
    const orientPct = piece.totalOrientations > 0 ? (piece.orientation / piece.totalOrientations * 100) : 0;
    const posPct = piece.totalPositions > 0 ? (piece.positionIndex / piece.totalPositions * 100) : 0;
    
    cached.orientBar.style.width = orientPct + '%';
    cached.posBar.style.width = posPct + '%';
    cached.orientText.textContent = `${piece.orientation}/${piece.totalOrientations}`;
    cached.posText.textContent = `${piece.positionIndex}/${piece.totalPositions}`;
  }
}

// Show/hide progress panel (global for close button)
window.showProgressPanel = function(show) {
  const panel = document.getElementById('solver-progress');
  const solveBtn = document.getElementById('solve-btn');
  if (show) initProgressPanel();
  panel.classList.toggle('active', show);
  solveBtn.classList.toggle('disabled', show);
}

// Make solver panel draggable by its header (mouse + touch)
document.addEventListener('DOMContentLoaded', () => {
  const panel = document.getElementById('solver-progress');
  const handle = panel.querySelector('h3');
  let dragging = false, startX, startY, startLeft, startBottom;
  
  function startDrag(x, y) {
    dragging = true;
    startX = x;
    startY = y;
    const rect = panel.getBoundingClientRect();
    startLeft = rect.left;
    startBottom = window.innerHeight - rect.bottom;
  }
  
  function doDrag(x, y) {
    if (!dragging) return;
    panel.style.left = (startLeft + x - startX) + 'px';
    panel.style.bottom = (startBottom - (y - startY)) + 'px';
  }
  
  function endDrag() { dragging = false; }
  
  // Mouse events
  handle.addEventListener('mousedown', e => { startDrag(e.clientX, e.clientY); e.preventDefault(); });
  document.addEventListener('mousemove', e => doDrag(e.clientX, e.clientY));
  document.addEventListener('mouseup', endDrag);
  
  // Touch events
  handle.addEventListener('touchstart', e => { startDrag(e.touches[0].clientX, e.touches[0].clientY); e.preventDefault(); }, { passive: false });
  document.addEventListener('touchmove', e => { if (dragging) doDrag(e.touches[0].clientX, e.touches[0].clientY); }, { passive: true });
  document.addEventListener('touchend', endDrag);
});

// Update speed button states - computes everything from solver state
function updateSpeedButtons() {
  const exhausted = Solver.isExhausted();
  const runningAtSpeed = Solver.isSolving() && !Solver.isPaused() && !Solver.isStepMode();
  
  document.querySelectorAll('.speed-btn').forEach(btn => {
    btn.classList.toggle('disabled', exhausted);
    // Highlight only when running at this specific speed
    const btnSpeed = btn.dataset.speed;
    btn.classList.toggle('active', runningAtSpeed && btnSpeed === String(solverSpeed));
  });
  
  // Step button emoji: ⏸️ only when running at speed
  const stepBtn = document.querySelector('.speed-btn[data-speed="step"]');
  if (stepBtn) {
    stepBtn.textContent = runningAtSpeed ? '⏸️' : '↩️';
  }
}

// Start or resume the search at a given speed
window.runSpeed = async function(ms) {
  solverSpeed = parseInt(ms) || 0;
  Solver.setSpeed(solverSpeed);
  Solver.setStepMode(false);
  
  if (Solver.isSolving() && Solver.isPaused()) {
    Solver.resume();
    return;
  }
  
  if (!Solver.isSolving()) {
    await startSolve();
  }
}

// Single step mode - do one placement then pause
window.stepOnce = async function() {
  Solver.setStepMode(true);
  
  if (Solver.isSolving() && Solver.isPaused()) {
    Solver.resume();
    return;
  }
  
  if (!Solver.isSolving()) {
    await startSolve();
  }
}

// Start the solver for today's date
async function startSolve() {
  resetDocket(); // Clear any manually taken pieces
  lastRowOrder = []; // Reset progress panel row order cache
  
  const today = new Date();
  const month = today.getMonth();
  const day = today.getDate();
  const targetCells = Solver.getDateCells(month, day);
  
  drawDateCircles(targetCells);
  
  await Solver.solve(shapes, targetCells, visualizeAllPlacements, solverSpeed);
  
  // Search exhausted - update button states
  updateSpeedButtons();
}

// Debug: count solutions for all dates (call from browser console)
window.solveAll = function() { return Solver.solveAll(shapes) }
window.solveOnceAllDates = function() { return Solver.solveOnceAllDates(shapes) }

// Draw circles around target date cells
function drawDateCircles(targetCells) {
  removeDateCircles(); // Clean up any existing
  const circleGroup = svg.group().id('date-circles');
  for (const [r, c] of targetCells) {
    const cx = x0 + c * boxel + boxel / 2;
    const cy = y0 + r * boxel + boxel / 2;
    circleGroup.circle(boxel * DATE_CIRCLE_RADIUS)
      .center(cx, cy)
      .fill('none')
      .stroke({ width: DATE_CIRCLE_STROKE, color: DATE_CIRCLE_COLOR, dasharray: '5,3' });
  }
}

// Remove date circles
function removeDateCircles() {
  const circles = SVG.get('date-circles');
  if (circles) circles.remove();
}

// Track pieces that user has manually taken from the docket
const takenFromDocket = new Set();

// Clear taken pieces (called when solver restarts)
function resetDocket() {
  takenFromDocket.clear();
}

// Draw all pending pieces above the grid in order (rotated to be short & wide)
function drawPendingPieces(progress, failedPieceName = null, orderedRemaining = []) {
  // Remove old pending pieces display
  const oldPending = SVG.get('pending-pieces');
  if (oldPending) oldPending.remove();
  
  if (!progress) return;
  
  // Use orderedRemaining for order, filter out manually taken pieces
  // orderedRemaining is the dynamically-sorted list from the solver
  const pendingNames = orderedRemaining.length > 0
    ? orderedRemaining.filter(name => !takenFromDocket.has(name))
    : progress.filter(p => p.status === 'pending' && !takenFromDocket.has(p.name)).map(p => p.name);
  
  if (pendingNames.length === 0) return;
  
  // Convert names to piece objects for drawing
  const pendingPieces = pendingNames.map(name => ({ name }));
  
  const pendingGroup = svg.group().id('pending-pieces');
  
  // Calculate layout - pieces in a row ABOVE the grid
  const previewScale = boxel * DOCKET_SCALE;
  const gap = boxel * DOCKET_GAP;
  const startY = y0 - boxel * 0.8; // Above grid
  
  // Start at left edge of grid - first piece always in same position
  let currentX = x0;
  
  // Draw each pending piece
  pendingPieces.forEach((piece) => {
    const shape = shapeMap.get(piece.name);
    if (!shape) return;
    
    const [name, color, vertices] = shape;
    const pieceGroup = pendingGroup.group();
    
    // Calculate bounding info
    const xs = vertices.map(v => v[0]);
    const ys = vertices.map(v => v[1]);
    const rawW = (Math.max(...xs) - Math.min(...xs)) * previewScale;
    const rawH = (Math.max(...ys) - Math.min(...ys)) * previewScale;
    const rotate = rawH > rawW;
    const pieceWidth = rotate ? rawH : rawW;
    const pieceHeight = rotate ? rawW : rawH;
    
    // Pre-rotate vertices if needed (rotate coords, not the SVG element)
    let drawVerts = vertices;
    if (rotate) {
      // Rotate 90 degrees: (x, y) -> (y, -x), then shift to positive coords
      const rotated = vertices.map(v => [v[1], -v[0]]);
      const minX = Math.min(...rotated.map(v => v[0]));
      const minY = Math.min(...rotated.map(v => v[1]));
      drawVerts = rotated.map(v => [v[0] - minX, v[1] - minY]);
    }
    
    // Draw the piece with pre-rotated vertices (no border)
    const poly = pieceGroup.polygon(polygen(drawVerts, previewScale))
      .fill(color)
      .opacity(0.85)
      .style('cursor', 'pointer');
    
    const bbox = poly.bbox();
    
    // Position at currentX, startY (aligning bottom of piece to startY)
    const tx = currentX - bbox.x;
    const ty = startY - bbox.y - bbox.height;
    
    pieceGroup.translate(tx, ty);
    
    // Click to spawn full-sized draggable piece (and re-render docket)
    poly.on('click', () => {
      takenFromDocket.add(name);
      drawPendingPieces(progress, failedPieceName, orderedRemaining); // Re-render without this piece
      movePoly(name, 0, 0);
    });
    
    // If this is the failed piece, draw X over it
    if (name === failedPieceName) {
      const pcx = currentX + pieceWidth / 2;
      const pcy = startY - pieceHeight / 2;
      const size = Math.max(pieceWidth, pieceHeight) * 0.4;
      pendingGroup.line(pcx - size, pcy - size, pcx + size, pcy + size)
        .stroke({ width: 4, color: '#ff0000' });
      pendingGroup.line(pcx - size, pcy + size, pcx + size, pcy - size)
        .stroke({ width: 4, color: '#ff0000' });
    }
    
    currentX += pieceWidth + gap;
  });
}

// Visualize all placements (callback for solver)
// sizePruning, shapePruning, tunnelPruning are { cells: [[r,c],...], sizes: [n,...] }
function visualizeAllPlacements(placements, attempts, progress, deadCells = [], sizePruning = {cells:[], sizes:[]}, shapePruning = {cells:[], sizes:[]}, tunnelPruning = {cells:[], sizes:[]}, nextPiece = null, pieceFailed = false, orderedRemaining = []) {
  // Clear all pieces
  for (const [name, , ] of shapes) {
    const group = SVG.get(name);
    if (group) group.remove();
  }
  
  // Clear any existing dead cell markers, text, and patterns
  const oldDeadMarkers = SVG.get('dead-cells');
  if (oldDeadMarkers) oldDeadMarkers.remove();
  
  // Remove old hazard patterns from defs to prevent memory leak
  document.querySelectorAll('pattern[id^="prune-"]').forEach(p => p.remove());
  
  // Draw all placements
  for (const p of placements) {
    if (p) visualizePlacement(p);
  }
  
  // Update button states
  updateSpeedButtons();
  
  // Auto-resume after showing solution briefly (when pauseOnSolution is false)
  const allPlaced = placements.filter(p => p !== null).length === 8;
  if (!window.pauseOnSolution && allPlaced && Solver.hasFoundSolution() && Solver.isPaused()) {
    setTimeout(() => {
      if (!window.pauseOnSolution && Solver.isSolving() && Solver.isPaused()) {
        Solver.resume();
      }
    }, Math.max(50, solverSpeed));
  }
  
  // Helper to draw striped regions with configurable style
  function drawPrunedRegions(group, regions, color1, color2, width, angle, opacity, patternPrefix) {
    regions.forEach((region, idx) => {
      const patternId = `${patternPrefix}-${idx}`;
      const stripeWidth = boxel * width;
      const period = stripeWidth * 2;
      const offset = idx * period * 0.4;  // offset per region for visual distinction

      const pattern = svg.pattern(period, period, function(add) {
        add.rect(period, stripeWidth).fill(color1);
        add.rect(period, stripeWidth).move(0, stripeWidth).fill(color2);
      }).id(patternId).attr({
        patternUnits: 'userSpaceOnUse',
        patternTransform: `rotate(${angle}) translate(${offset}, 0)`
      });
      
      for (const [r, c] of region) {
        const cx = x0 + c * boxel;
        const cy = y0 + r * boxel;
        group.rect(boxel, boxel).move(cx, cy).fill(pattern).opacity(opacity);
      }
    });
  }
  
  // Draw pruned regions if any exist
  const hasPruning = deadCells.length > 0;
  if (hasPruning) {
    const deadGroup = svg.group().id('dead-cells');
    
    // Draw each pruning type with its distinct style
    if (sizePruning.cells.length > 0) {
      drawPrunedRegions(deadGroup, sizePruning.cells,
        SIZE_PRUNE_COLOR_1, SIZE_PRUNE_COLOR_2, SIZE_PRUNE_WIDTH, SIZE_PRUNE_ANGLE, SIZE_PRUNE_OPACITY, 'prune-size');
    }
    if (shapePruning.cells.length > 0) {
      drawPrunedRegions(deadGroup, shapePruning.cells,
        SHAPE_PRUNE_COLOR_1, SHAPE_PRUNE_COLOR_2, SHAPE_PRUNE_WIDTH, SHAPE_PRUNE_ANGLE, SHAPE_PRUNE_OPACITY, 'prune-shape');
    }
    if (tunnelPruning.cells.length > 0) {
      drawPrunedRegions(deadGroup, tunnelPruning.cells,
        TUNNEL_PRUNE_COLOR_1, TUNNEL_PRUNE_COLOR_2, TUNNEL_PRUNE_WIDTH, TUNNEL_PRUNE_ANGLE, TUNNEL_PRUNE_OPACITY, 'prune-tunnel');
    }
    
    // Legend with color swatches and black text (anti-magic: no conditionals, always show all 3)
    const fontSize = Math.max(10, Math.min(16, boxel * 0.28));
    const lineHeight = fontSize * 1.5;
    const swatchSize = fontSize * 0.9;
    const swatchX = x0;  // Left-align with grid
    const textX = swatchX + swatchSize + fontSize * 0.4;
    let textY = y0 + 7 * boxel + fontSize;  // Below the grid
    
    // Helper to draw a striped swatch
    function drawSwatch(y, color1, color2, angle, patternId) {
      const stripeWidth = swatchSize * 0.15;
      const period = stripeWidth * 2;
      const pattern = svg.pattern(period, period, function(add) {
        add.rect(period, stripeWidth).fill(color1);
        add.rect(period, stripeWidth).move(0, stripeWidth).fill(color2);
      }).id(patternId).attr({
        patternUnits: 'userSpaceOnUse',
        patternTransform: `rotate(${angle})`
      });
      deadGroup.rect(swatchSize, swatchSize).move(swatchX, y).fill(pattern).stroke({ width: 1, color: '#666' });
    }
    
    // Helper to draw text with italic portion (SVG tspan for styling)
    function drawLegendText(y, count, label, italicWord, sizes) {
      const sizesStr = sizes.length > 0 ? ` — {${sizes.join(', ')}}` : '';
      const text = deadGroup.text(function(add) {
        add.tspan(`${count} ${label} `);
        add.tspan(italicWord).attr('font-style', 'italic');
        add.tspan(sizesStr);
      });
      text.font({ size: fontSize, weight: 'bold', family: 'Arial' }).fill('#000000').move(textX, y);
    }
    
    // Size pruning legend (always shown)
    drawSwatch(textY, SIZE_PRUNE_COLOR_1, SIZE_PRUNE_COLOR_2, SIZE_PRUNE_ANGLE, 'swatch-size');
    drawLegendText(textY, sizePruning.sizes.length, 'regions of unfillable', 'size', sizePruning.sizes);
    textY += lineHeight;
    
    // Shape pruning legend (always shown)
    drawSwatch(textY, SHAPE_PRUNE_COLOR_1, SHAPE_PRUNE_COLOR_2, SHAPE_PRUNE_ANGLE, 'swatch-shape');
    drawLegendText(textY, shapePruning.sizes.length, 'regions of unfillable', 'shape', shapePruning.sizes);
    textY += lineHeight;
    
    // Tunnel pruning legend (always shown)
    drawSwatch(textY, TUNNEL_PRUNE_COLOR_1, TUNNEL_PRUNE_COLOR_2, TUNNEL_PRUNE_ANGLE, 'swatch-tunnel');
    const tunnelSizesStr = tunnelPruning.sizes.length > 0 ? ` — {${tunnelPruning.sizes.join(', ')}}` : '';
    deadGroup.text(`${tunnelPruning.sizes.length} unfillable tunnels${tunnelSizesStr}`)
      .font({ size: fontSize, weight: 'bold', family: 'Arial' })
      .fill('#000000')
      .move(textX, textY);
  }
  
  // Draw all pending pieces in dynamic order
  drawPendingPieces(progress, pieceFailed ? nextPiece : null, orderedRemaining);
  
  // Update progress panel
  updateProgressPanel(attempts, progress);
}

// Solve button just opens the panel - speed buttons control the search
window.solvePuzzle = function() {
  showProgressPanel(true);
}

function movePoly(polyId, x, y, angle = 0, flip = false) {
  const [nom, hue, fig] = shapeMap.get(polyId);
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
  newGroup.on("dragmove", () => { moved = true });
  newGroup.on("dragend", () => { snapToGrid(newGroup); });
  cPol.on("mousedown", () => { moved = false });
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
