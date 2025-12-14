// ============ CONFIGURATION CONSTANTS ============

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
const TUNNEL_PRUNE_ANGLE = 45;           // Perpendicular to red (-45)
const TUNNEL_PRUNE_OPACITY = 0.15;

// Type 4: FORCED regions (regions that force a specific piece placement)
const FORCED_REGION_COLOR_1 = '#00cc00';
const FORCED_REGION_COLOR_2 = '#ffffff';  // Green/white = go/forced
const FORCED_REGION_WIDTH = 0.1;
const FORCED_REGION_ANGLE = -45;          // Same as red (opposite to blue/yellow)
const FORCED_REGION_OPACITY = 0.2;

// Legend swatches (small pattern previews next to text)
const LEGEND_SWATCH_OPACITY = 0.33;

// Date circle highlighting
const DATE_CIRCLE_RADIUS = 0.85;   // As fraction of boxel
const DATE_CIRCLE_STROKE = 3;
const DATE_CIRCLE_COLOR = '#ff6b6b';

// Touch gestures
const LONG_PRESS_MS = 500;

// Animation timing
const ROTATION_DURATION_MS = 150;

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
const headh = 63;             // height of the header
const sbarw = 68.5;           // width of the sidebar on the right
// Ensure minimum cell size for touch targets, and max to fit screen
const minBoxel = 32;          // Minimum practical touch target size
const maxBoxel = 80;          // Maximum reasonable size
const boxel = Math.max(minBoxel, Math.min(maxBoxel, (w - sbarw - 20) / 9));  // Fit 7 cols + margins for pieces
const calw = boxel*7;         // width of the calendar
const calh = boxel*7;         // height of the calendar
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

// Helper to find SVG element by ID (SVG.js v3 compatible)
function svgGet(id) {
  return SVG.find('#' + id)[0];
}

// ============ PIECE MANIPULATION HELPERS ============

// Convert screen coordinates to SVG coordinates using precomputed inverse CTM
function screenToSvg(screenX, screenY, invCtm) {
  return {
    x: invCtm.a * screenX + invCtm.c * screenY + invCtm.e,
    y: invCtm.b * screenX + invCtm.d * screenY + invCtm.f,
  };
}

// Read the element's *local* SVG transform matrix (ignores parent CTMs)
function getLocalTransformMatrix(node) {
  const baseVal = node.transform && node.transform.baseVal;
  const consolidated = baseVal && baseVal.consolidate && baseVal.consolidate();
  if (!consolidated) return new DOMMatrix();
  return DOMMatrix.fromMatrix(consolidated.matrix);
}

// Set the element's local transform matrix and keep dataset position in sync
function setLocalTransformMatrix(node, m) {
  node.setAttribute('transform', `matrix(${m.a} ${m.b} ${m.c} ${m.d} ${m.e} ${m.f})`);
  node.dataset.x = String(m.e);
  node.dataset.y = String(m.f);
}

// Simple position update (no rotation change)
function setGroupPosition(node, x, y) {
  // Preserve current linear components (rotation/shear/scale), replace translation.
  const m = getLocalTransformMatrix(node);
  const next = new DOMMatrix([m.a, m.b, m.c, m.d, x, y]);
  setLocalTransformMatrix(node, next);
}

// Easing functions
function easeOutCubic(t) {
  return 1 - Math.pow(1 - t, 3);
}

function easeInOutSine(t) {
  return (1 - Math.cos(Math.PI * t)) / 2;
}

// ============ PER-PIECE ACTION QUEUE ============

function ensurePieceQueue(node) {
  if (!node.__calpuzPieceQueue) {
    node.__calpuzPieceQueue = { running: false, queue: [] };
  }
  return node.__calpuzPieceQueue;
}

async function processPieceQueue(node) {
  const state = ensurePieceQueue(node);
  if (state.running) return;
  state.running = true;
  try {
    while (state.queue.length) {
      const action = state.queue.shift();
      await action();
    }
  } finally {
    state.running = false;
  }
}

function enqueuePieceAction(node, action) {
  const state = ensurePieceQueue(node);
  state.queue.push(action);
  void processPieceQueue(node);
}

// Flip piece around a vertical line through the click point with smooth animation.
// Returns a promise that resolves when animation completes.
function flipPiece(node, screenX, screenY) {
  return new Promise((resolve) => {
    const svgEl = node.ownerSVGElement;
    const invScreenCtm = svgEl.getScreenCTM().inverse();
    const pivot = screenToSvg(screenX, screenY, invScreenCtm);
    const startMatrix = getLocalTransformMatrix(node);
    const startTime = performance.now();

    requestAnimationFrame(function tick(now) {
      const t = Math.min((now - startTime) / ROTATION_DURATION_MS, 1);
      const eased = easeInOutSine(t);
      const scale = 1 - 2 * eased;  // 1 → 0 → -1

      const flipAboutPivot = new DOMMatrix()
        .translate(pivot.x, 0)
        .scale(scale, 1)
        .translate(-pivot.x, 0);

      setLocalTransformMatrix(node, flipAboutPivot.multiply(startMatrix));
      if (t < 1) requestAnimationFrame(tick);
      else resolve();
    });
  });
}

// Rotate piece 90° around the click point with smooth animation.
// Returns a promise that resolves when animation completes.
function rotatePiece(node, getAngle, setAngle, screenX, screenY, clockwise) {
  return new Promise((resolve) => {
    const deltaAngle = clockwise ? 90 : -90;
    const svgEl = node.ownerSVGElement;
    const invScreenCtm = svgEl.getScreenCTM().inverse();
    const pivot = screenToSvg(screenX, screenY, invScreenCtm);
    const startMatrix = getLocalTransformMatrix(node);
    const startAngle = getAngle();
    const startTime = performance.now();

    requestAnimationFrame(function tick(now) {
      const t = Math.min((now - startTime) / ROTATION_DURATION_MS, 1);
      const currentDelta = deltaAngle * easeOutCubic(t);

      const rotAboutPivot = new DOMMatrix()
        .translate(pivot.x, pivot.y)
        .rotate(currentDelta)
        .translate(-pivot.x, -pivot.y);

      setLocalTransformMatrix(node, rotAboutPivot.multiply(startMatrix));
      if (t < 1) requestAnimationFrame(tick);
      else {
        setAngle(startAngle + deltaAngle);
        resolve();
      }
    });
  });
}

// Bring element to front (SVG uses DOM order for z-index)
function bringToFront(node) {
  node.parentNode.appendChild(node);
}

// ============ GESTURE HANDLING (via Hammer.js) ============

// Extract client coordinates from a Hammer event (works for mouse and touch)
function getEventClientCoords(e) {
  // Hammer's center is most reliable
  if (e.center && typeof e.center.x === 'number') {
    return { x: e.center.x, y: e.center.y };
  }
  // Fallback to source event
  const src = e.srcEvent;
  if (!src) throw new Error('No event coordinates available');
  // Mouse events
  if (typeof src.clientX === 'number') {
    return { x: src.clientX, y: src.clientY };
  }
  // Touch events: use touches (finger down) before changedTouches (finger up)
  const touch = src.touches?.[0] || src.changedTouches?.[0];
  if (touch) {
    return { x: touch.clientX, y: touch.clientY };
  }
  throw new Error('No event coordinates available');
}

// Setup draggable with tap-to-rotate and hold-to-flip
function setupDraggable(group, onDragEnd, rotateState) {
  const node = group.node;
  node.style.touchAction = 'none';  // Required for mobile

  if (!node.dataset.x) node.dataset.x = '0';
  if (!node.dataset.y) node.dataset.y = '0';

  // Use Hammer.js only for pan (dragging)
  const hammer = new Hammer(node);
  node.__hammer = hammer;  // Store for cleanup when element is removed
  hammer.get('pan').set({ threshold: 5, direction: Hammer.DIRECTION_ALL });
  hammer.get('tap').set({ enable: false });    // We handle tap ourselves
  hammer.get('press').set({ enable: false });  // We handle press ourselves

  let startMatrix, startPt, invScreenCtm;

  hammer.on('panstart', (e) => {
    cancelPressTimer();  // Drag started, not a tap or press
    startMatrix = getLocalTransformMatrix(node);
    invScreenCtm = node.ownerSVGElement.getScreenCTM().inverse();
    const { x, y } = getEventClientCoords(e);
    startPt = screenToSvg(x, y, invScreenCtm);
    bringToFront(node);
  });

  hammer.on('panmove', (e) => {
    const { x, y } = getEventClientCoords(e);
    const curPt = screenToSvg(x, y, invScreenCtm);
    setLocalTransformMatrix(node, new DOMMatrix([
      startMatrix.a, startMatrix.b, startMatrix.c, startMatrix.d,
      startMatrix.e + curPt.x - startPt.x,
      startMatrix.f + curPt.y - startPt.y,
    ]));
  });

  hammer.on('panend', () => {
    if (onDragEnd) onDragEnd(group);
  });

  // Manual tap/long-press handling with pointer events (works for mouse + touch)
  // This is deterministic: exactly one of tap/long-press/drag fires, never two.
  let pressTimer = null;
  let didLongPress = false;
  let pointerDownCoords = null;
  let lastPointerType = null;  // 'mouse', 'touch', or 'pen'

  function cancelPressTimer() {
    clearTimeout(pressTimer);
    pressTimer = null;
  }

  function doFlip(x, y) {
    if (didLongPress) return;  // Already handled
    didLongPress = true;
    cancelPressTimer();
    if (!rotateState) return;
    enqueuePieceAction(node, () => flipPiece(node, x, y));
    if (navigator.vibrate) navigator.vibrate(50);
  }

  node.addEventListener('pointerdown', (e) => {
    pointerDownCoords = { x: e.clientX, y: e.clientY };
    lastPointerType = e.pointerType;
    didLongPress = false;

    pressTimer = setTimeout(() => {
      pressTimer = null;
      doFlip(pointerDownCoords.x, pointerDownCoords.y);
    }, LONG_PRESS_MS);
  });

  node.addEventListener('pointerup', (e) => {
    cancelPressTimer();
    if (didLongPress) return;  // Already handled as long press
    if (!pointerDownCoords) return;  // Pointer wasn't down on this element
    if (e.button === 2) return;  // Right-click handled by contextmenu

    // Check if it was a drag (moved too far to be a tap)
    const dx = e.clientX - pointerDownCoords.x;
    const dy = e.clientY - pointerDownCoords.y;
    if (dx * dx + dy * dy > 25) return;  // 5px threshold, same as pan

    // It's a tap
    if (!rotateState) return;
    if (e.ctrlKey || e.metaKey) {
      enqueuePieceAction(node, () => flipPiece(node, e.clientX, e.clientY));
    } else {
      enqueuePieceAction(node, () => rotatePiece(node, rotateState.getAngle, rotateState.setAngle, e.clientX, e.clientY, true));
    }
    bringToFront(node);
  });

  node.addEventListener('pointercancel', cancelPressTimer);

  node.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    // On touch, long-press triggers contextmenu - treat it as flip (same as our timer)
    // On mouse, right-click triggers contextmenu - treat it as counter-clockwise rotate
    // On macOS, ctrl+click triggers contextmenu - treat it as flip
    if (lastPointerType === 'touch') {
      doFlip(e.clientX, e.clientY);
      return;
    }
    cancelPressTimer();
    didLongPress = true;  // Prevent pointerup from also acting
    if (!rotateState) return;
    if (e.ctrlKey) {
      enqueuePieceAction(node, () => flipPiece(node, e.clientX, e.clientY));
      bringToFront(node);
      return;
    }
    enqueuePieceAction(node, () => rotatePiece(node, rotateState.getAngle, rotateState.setAngle, e.clientX, e.clientY, false));
    bringToFront(node);
  });
}

// Clean up and remove a group (destroys Hammer instance to prevent memory leak)
function removeGroup(group) {
  if (!group) return;
  if (group.node.__hammer) group.node.__hammer.destroy();
  group.remove();
}

// Get or create the elements container (reuse to prevent DOM leak)
function getElementsContainer() {
  // Always check if cached container still exists in DOM
  if (elementsContainer && !elementsContainer.node.parentNode) {
    elementsContainer = null;
  }
  if (!elementsContainer) {
    elementsContainer = svgGet('elements') || svg.group().attr('id', 'elements');
  }
  return elementsContainer;
}

// Snap a group to the nearest grid position
function snapToGrid(group) {
  const node = group.node;
  // Get current position from data attributes
  const currentX = parseFloat(node.dataset.x) || 0;
  const currentY = parseFloat(node.dataset.y) || 0;
  
  // Get visual position via bounding rect
  const rect = node.getBoundingClientRect();
  const svgRect = svg.node.getBoundingClientRect();
  const visualX = rect.left - svgRect.left;
  const visualY = rect.top - svgRect.top;
  
  // Compute nearest grid cell
  const col = Math.round((visualX - x0) / boxel);
  const row = Math.round((visualY - y0) / boxel);
  
  // Calculate how far visual position is from stored position
  const deltaX = visualX - currentX;
  const deltaY = visualY - currentY;
  
  // Snap: move to grid cell, accounting for the visual offset
  setGroupPosition(node, x0 + col * boxel - deltaX, y0 + row * boxel - deltaY);
}

// Visualize a placement from the solver using actual cell positions
function visualizePlacement(placement) {
  if (!placement) return;

  const [nom, hue] = shapeMap.get(placement.name);
  const targetGroup = svgGet(placement.name);
  removeGroup(targetGroup);  // Clean up Hammer instance before removing

  const container = getElementsContainer();
  const newGroup = container.group().attr('id', nom);
  const innerGroup = newGroup.group();

  for (const [dr, dc] of placement.cells) {
    innerGroup.rect(boxel, boxel).move(dc * boxel, dr * boxel).fill(hue).opacity(0.8).stroke({ width: 1, color: '#fff' });
  }

  setGroupPosition(newGroup.node, x0 + placement.col * boxel, y0 + placement.row * boxel);
  let ang = 0;

  setupDraggable(newGroup, snapToGrid, {
    getAngle: () => ang,
    setAngle: (a) => { ang = a; }
  });
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
  const circleGroup = svg.group().attr('id', 'date-circles');
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
  const circles = svgGet('date-circles');
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
  const oldPending = svgGet('pending-pieces');
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
  
  const pendingGroup = svg.group().attr('id', 'pending-pieces');
  
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
      .css('cursor', 'pointer');
    
    const bbox = poly.bbox();
    
    // Position at currentX, startY (aligning bottom of piece to startY)
    const tx = currentX - bbox.x;
    const ty = startY - bbox.y - bbox.height;
    
    pieceGroup.translate(tx, ty);
    
    // Click to spawn full-sized draggable piece (and re-render docket)
    poly.on('click', () => {
      takenFromDocket.add(name);
      drawPendingPieces(progress, failedPieceName, orderedRemaining); // Re-render without this piece
      movePoly(name, 0, 0, 0, false);
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
// sizePruning, shapePruning, tunnelPruning, forcedRegions are { cells: [[r,c],...], sizes: [n,...] }
function visualizeAllPlacements(placements, attempts, progress, deadCells = [], sizePruning = {cells:[], sizes:[]}, shapePruning = {cells:[], sizes:[]}, tunnelPruning = {cells:[], sizes:[]}, forcedRegions = {cells:[], sizes:[]}, nextPiece = null, pieceFailed = false, orderedRemaining = [], allRegionSizes = []) {
  // Clear all pieces (use removeGroup to clean up Hammer instances)
  for (const [name, , ] of shapes) {
    const group = svgGet(name);
    removeGroup(group);
  }
  
  // Clear any existing dead cell markers, text, and patterns
  const oldDeadMarkers = svgGet('dead-cells');
  if (oldDeadMarkers) oldDeadMarkers.remove();
  
  // Remove old patterns from defs to prevent memory leak
  document.querySelectorAll('pattern[id^="prune-"], pattern[id^="swatch-"]').forEach(p => p.remove());
  
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
  
  // Helper to draw checkerboard regions
  function drawCheckerboardRegions(group, regions, color1, color2, cellSize, opacity, patternPrefix) {
    regions.forEach((region, idx) => {
      const patternId = `${patternPrefix}-${idx}`;
      const size = boxel * cellSize;
      const period = size * 2;

      const pattern = svg.pattern(period, period, function(add) {
        add.rect(size, size).move(0, 0).fill(color1);
        add.rect(size, size).move(size, 0).fill(color2);
        add.rect(size, size).move(0, size).fill(color2);
        add.rect(size, size).move(size, size).fill(color1);
      }).id(patternId).attr({ patternUnits: 'userSpaceOnUse' });
      
      for (const [r, c] of region) {
        const cx = x0 + c * boxel;
        const cy = y0 + r * boxel;
        group.rect(boxel, boxel).move(cx, cy).fill(pattern).opacity(opacity);
      }
    });
  }
  
  // Draw pruned regions and legend (legend hidden only when solution found)
  const deadGroup = svg.group().attr('id', 'dead-cells');
  
  // Draw striped overlays on pruned cells and forced regions
  drawPrunedRegions(deadGroup, sizePruning.cells,
    SIZE_PRUNE_COLOR_1, SIZE_PRUNE_COLOR_2, SIZE_PRUNE_WIDTH, SIZE_PRUNE_ANGLE, SIZE_PRUNE_OPACITY, 'prune-size');
  drawPrunedRegions(deadGroup, shapePruning.cells,
    SHAPE_PRUNE_COLOR_1, SHAPE_PRUNE_COLOR_2, SHAPE_PRUNE_WIDTH, SHAPE_PRUNE_ANGLE, SHAPE_PRUNE_OPACITY, 'prune-shape');
  drawPrunedRegions(deadGroup, tunnelPruning.cells,
    TUNNEL_PRUNE_COLOR_1, TUNNEL_PRUNE_COLOR_2, TUNNEL_PRUNE_WIDTH, TUNNEL_PRUNE_ANGLE, TUNNEL_PRUNE_OPACITY, 'prune-tunnel');
  drawCheckerboardRegions(deadGroup, forcedRegions.cells,
    FORCED_REGION_COLOR_1, FORCED_REGION_COLOR_2, FORCED_REGION_WIDTH, FORCED_REGION_OPACITY, 'prune-forced');
  
  // Legend with color swatches (anti-magic: always show all 3 lines, hide only on solution)
  const showLegend = !allPlaced;
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
    deadGroup.rect(swatchSize, swatchSize).move(swatchX, y).fill(pattern).opacity(LEGEND_SWATCH_OPACITY).stroke({ width: 1, color: '#666' });
  }
  
  // Helper to draw a checkerboard swatch
  function drawCheckerboardSwatch(y, color1, color2, patternId) {
    const cellSize = swatchSize * 0.15;
    const period = cellSize * 2;
    const pattern = svg.pattern(period, period, function(add) {
      add.rect(cellSize, cellSize).move(0, 0).fill(color1);
      add.rect(cellSize, cellSize).move(cellSize, 0).fill(color2);
      add.rect(cellSize, cellSize).move(0, cellSize).fill(color2);
      add.rect(cellSize, cellSize).move(cellSize, cellSize).fill(color1);
    }).id(patternId).attr({ patternUnits: 'userSpaceOnUse' });
    deadGroup.rect(swatchSize, swatchSize).move(swatchX, y).fill(pattern).opacity(LEGEND_SWATCH_OPACITY).stroke({ width: 1, color: '#666' });
  }
  
  // Helper to render sizes in braces with specified ones struck through in red
  function addSizes(add, sizes, strikethroughSet) {
    add.tspan(' — {');
    sizes.forEach((size, i) => {
      const span = add.tspan(String(size));
      if (strikethroughSet.has(size)) {
        span.fill('#cc0000').attr('text-decoration', 'line-through');
      }
      if (i < sizes.length - 1) add.tspan(', ');
    });
    add.tspan('}');
  }

  // Helper to draw legend text showing all sizes with unfillable ones struck through
  function drawLegendText(y, unfillableSizes, italicWord, allSizes) {
    const sorted = [...allSizes].sort((a, b) => a - b);
    const text = deadGroup.text(function(add) {
      add.tspan(`${splur(unfillableSizes.length, "region")} of unfillable `);
      add.tspan(italicWord).attr('font-style', 'italic');
      addSizes(add, sorted, new Set(unfillableSizes));
    });
    text.font({ size: fontSize, weight: 'bold', family: 'Arial' }).fill('#000000').move(textX, y);
  }
  
  // All 3 legend lines unconditionally (opacity 0 when solution found to hide without conditionals)
  const legendOpacity = showLegend ? 1 : 0;
  
  drawSwatch(textY, SIZE_PRUNE_COLOR_1, SIZE_PRUNE_COLOR_2, SIZE_PRUNE_ANGLE, 'swatch-size');
  drawLegendText(textY, sizePruning.sizes, 'size', allRegionSizes);
  textY += lineHeight;

  drawSwatch(textY, SHAPE_PRUNE_COLOR_1, SHAPE_PRUNE_COLOR_2, SHAPE_PRUNE_ANGLE, 'swatch-shape');
  drawLegendText(textY, shapePruning.sizes, 'shape', allRegionSizes);
  textY += lineHeight;
  
  drawSwatch(textY, TUNNEL_PRUNE_COLOR_1, TUNNEL_PRUNE_COLOR_2, TUNNEL_PRUNE_ANGLE, 'swatch-tunnel');
  const tunnelText = deadGroup.text(function(add) {
    add.tspan(splur(tunnelPruning.sizes.length, "unfillable tunnel"));
    addSizes(add, tunnelPruning.sizes, new Set(tunnelPruning.sizes));
  });
  tunnelText.font({ size: fontSize, weight: 'bold', family: 'Arial' }).fill('#000000').move(textX, textY);
  textY += lineHeight;

  drawCheckerboardSwatch(textY, FORCED_REGION_COLOR_1, FORCED_REGION_COLOR_2, 'swatch-forced');
  deadGroup.text(`${splur(forcedRegions.sizes.length, "forced placement")} — {${forcedRegions.sizes.join(', ')}}`)
    .font({ size: fontSize, weight: 'bold', family: 'Arial' })
    .fill('#000000')
    .move(textX, textY);
  
  deadGroup.opacity(legendOpacity);
  
  // Draw all pending pieces in dynamic order
  drawPendingPieces(progress, pieceFailed ? nextPiece : null, orderedRemaining);
  
  // Update progress panel
  updateProgressPanel(attempts, progress);
}

// Solve button just opens the panel - speed buttons control the search
window.solvePuzzle = function() {
  showProgressPanel(true);
}

function movePoly(polyId, x, y, angle, flip) {
  const [nom, hue, fig] = shapeMap.get(polyId);
  const targetGroup = svgGet(polyId);
  removeGroup(targetGroup);  // Clean up Hammer instance before removing

  const container = getElementsContainer();
  const newGroup = container.group().attr('id', nom);
  newGroup.polygon(polygen(fig, boxel)).fill(hue).opacity(0.8);

  // Build initial transform matrix: position, then rotation, then flip
  const px = x0 + x * boxel;
  const py = y0 + y * boxel;
  let m = new DOMMatrix().translate(px, py);
  if (angle) m = m.rotate(angle * 180 / Math.PI);
  if (flip) m = m.scale(-1, 1);
  setLocalTransformMatrix(newGroup.node, m);

  let ang = (angle * 180 / Math.PI) % 360;

  setupDraggable(newGroup, snapToGrid, {
    getAngle: () => ang,
    setAngle: (a) => { ang = a; }
  });
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

  const gridGroup = svg.group().attr('id', 'grid');
  gridGroup.addClass('grid-lines');

  const trX = x => x + x0;
  const trY = y => y + y0;

  const gline = (x1, y1, x2, y2) =>
    gridGroup.line(trX(x1), trY(y1), trX(x2), trY(y2))
             .stroke({ width: 1, color: '#ccc' });

  labels.forEach((row, i) => {
    row.forEach((col, j) => {
      const t = gridGroup.text(labels[i][j])
        .font({ family: 'Arial', size: boxel / 4, anchor: 'middle' })
        .attr({ 'text-anchor': 'middle' });

      // Use geometric (bbox) centering for consistent visual centering across
      // browsers. Baseline-based centering varies by font and SVG implementation.
      t.center(trX(j * boxel + boxel / 2), trY(i * boxel + boxel / 2));
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
  movePoly("corner",      6.5, 1.8, 0, false)
  movePoly("stair",       5.3, 5.3, 0, false)
  movePoly("z-shape",       2, 6.3, 0, false)
  movePoly("rectangle",  -1.2, 5.6, 0, false)
  movePoly("c-shape",    -2.2, 2,   0, false)
  movePoly("chair",      -1.3, -1.3, 0, false)
  movePoly("stilt",       2.2, -2.5, 0, false)
  movePoly("l-shape",     5.2, -1.3, 0, false)
}

window.addEventListener("load", function () {
  svg = SVG().addTo(document.querySelector(".graph")).size("100%", "100%");
  // Ensure SVG element doesn't intercept touch for scrolling
  svg.node.style.touchAction = 'none';
  drawCalendar();
  scatterShapes();

  // Initialize solver with piece data
  Solver.initPieceData(shapes);
});
