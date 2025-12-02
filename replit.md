[Um, I think Claude spontaneously generated this?]

# Overview

Calendar Puzzle is an interactive browser-based puzzle game where users arrange geometric pieces (pentominoes and one hexomino) to fit within a calendar grid, revealing the current date. The application includes a brute-force solver with visualization capabilities that demonstrates how to solve the puzzle automatically.

This is a static web application that runs entirely in the browser with no backend dependencies beyond serving HTML/CSS/JavaScript files.

# User Preferences

Preferred communication style: Simple, everyday language.

# System Architecture

## Frontend Architecture

**Technology Stack:**
- Pure vanilla JavaScript with SVG.js library for graphics manipulation
- HTML5 and CSS3 for structure and styling
- No framework dependencies (React, Vue, etc.)

**Key Design Decisions:**

1. **SVG-Based Graphics System**
   - Problem: Need smooth, scalable drag-and-drop puzzle pieces
   - Solution: SVG.js (v2.0.2) with custom plugins for drag, rotate, and select functionality
   - Benefits: Resolution-independent graphics, smooth transformations, precise positioning
   - Trade-offs: More complex DOM manipulation vs. Canvas, but better for interactive elements

2. **Plugin-Based Interaction Model**
   - Custom SVG.js plugins handle specialized behaviors:
     - `svg.draggy.js`: Draggable elements with constraint support
     - `svg.select.min.js`: Selection management
     - `css.rotate.js`: Rotation transformations
     - `crossy.js`: Additional geometric operations
   - Rationale: Modular approach allows independent development and testing of interaction features

3. **Grid-Based Layout System**
   - Fixed 7x7 calendar grid with dynamic sizing based on viewport
   - Responsive positioning: `boxel = w/20` (viewport-relative cell size)
   - Centering logic accounts for header and sidebar, with fallback positioning
   - Ensures puzzle remains playable across different screen sizes

4. **Shape Representation**
   - Shapes defined as polygon vertex arrays with metadata (name, color, vertices)
   - Format: `[name, color, [[x1,y1], [x2,y2], ...]]`
   - 8 total pieces with varying symmetry properties (chiral vs. non-chiral)
   - Enables easy rotation/flipping through coordinate transformation

5. **Solver Architecture**
   - Brute-force backtracking algorithm with visualization
   - Grid template (7x7 boolean matrix) defines valid placement cells
   - `polygonToCells()`: Converts polygon vertices to grid cell coverage
   - Point-in-polygon ray casting for collision detection
   - Adjustable animation speed (`solverSpeed` variable) for educational purposes

## UI/UX Design Patterns

1. **Interaction Methods**
   - Click/tap: 90-degree rotation
   - Right-click or triple-click: Counter-rotation
   - Ctrl-click or long-press: Flip piece
   - Drag: Move pieces freely
   - Tutorial system using SweetAlert2 for instructions

2. **Fixed Layout Components**
   - Title header (z-index: 10, pointer-events disabled for non-interference)
   - Sidebar (z-index: 999, fixed right position)
   - Graph/puzzle area (z-index: 9, full viewport)
   - Layered approach prevents interaction conflicts

3. **Color Scheme**
   - Distinct colors for 8 puzzle pieces for easy identification
   - Header/UI: Dark blue-gray (#3b495e, #425066)
   - Pieces: Red, orange, yellow, green, cyan, purple, pink, blue
   - High contrast ensures pieces are distinguishable

## State Management

- No formal state management library
- State maintained through DOM and JavaScript variables
- Global variables for configuration (grid dimensions, solver speed)
- Piece positions tracked via SVG transformations
- Solver state implicit in backtracking algorithm recursion

## Deployment Strategy

**Static File Serving:**
- Primary: Direct HTML/CSS/JS serving via Replit
- Fallback: `server.py` provides simple Python HTTP server on port 5000
- Note: Server includes no-cache headers for development convenience
- Production hosted at calpuz.replit.app

**Rationale:** No backend logic required; puzzle logic runs entirely client-side. Server exists only for local development convenience.

# External Dependencies

## CDN-Hosted Libraries

1. **SVG.js (v2.0.2)**
   - Purpose: Core SVG manipulation and drawing
   - Source: cdnjs.cloudflare.com
   - Why: Simplifies complex SVG operations vs. native DOM manipulation

2. **SweetAlert2 (v11)**
   - Purpose: Modern modal dialogs and alerts
   - Source: cdn.jsdelivr.net
   - Usage: Tutorial/instructions display

3. **SweetAlert (v1.1.3)**
   - Purpose: Legacy alert compatibility
   - Source: cdnjs.cloudflare.com
   - Note: May be redundant with SweetAlert2; consider removing

4. **Octicons (v3.5.0)**
   - Purpose: Icon font (likely for UI buttons)
   - Source: cdnjs.cloudflare.com

## No Backend Services

- No database required (no data persistence)
- No authentication/authorization (public game)
- No API endpoints (fully client-side)
- No analytics or tracking services referenced

## Browser APIs Used

- SVG DOM manipulation
- Viewport/window sizing (responsive layout)
- Event handling (mouse, touch)
- No localStorage or cookies mentioned

## Development Environment

- Designed for Replit hosting
- Python SimpleHTTPServer for local development
- No build process or transpilation required
- Direct file serving of static assets