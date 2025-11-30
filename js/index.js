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

window.solvePuzzle = function () {

  movePoly("corner",     4,  2,  TAU/4)
  movePoly("stair",      3, -1,  TAU/4)
  movePoly("z-shape",    2,  3,  TAU/4)
  movePoly("rectangle",  5,  3)
  movePoly("c-shape",    .5,  4.5,  TAU/4)
  movePoly("chair",      0,  3,  TAU/2, true)
  movePoly("stilt",      1,  -1, -TAU/4, true)
  movePoly("l-shape",    0,  1,  TAU/2)
  /* this version works if we rotate around the corner instead of the center:
  movePoly("corner",     7,  2,  TAU/4)
  movePoly("stair",      6,  0,  TAU/4)
  movePoly("z-shape",    5,  3,  TAU/4)
  movePoly("rectangle",  5,  3)
  movePoly("c-shape",    3,  5,  TAU/4)
  movePoly("chair",      0,  6,  TAU/2, true)
  movePoly("stilt",      0,  0, -TAU/4, true)
  movePoly("l-shape",    4,  3,  TAU/2)
  */
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

  Crossy(pol.node, "transform", 
        `rotate(${(angle * 180 / Math.PI) % 360}deg) scaleX(${flip ? -1 : 1})`);
  const bbox = pol.node.getBBox();
  const centerX = bbox.x + bbox.width / 2;
  const centerY = bbox.y + bbox.height / 2;
  pol.node.setAttribute("style", `transform-origin: ${centerX}px ${centerY}px;`)
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