# 📚 Coggle Clone API Documentation

This document describes the internal JavaScript API for the Coggle Clone application. The API is organized into manager classes that handle different aspects of the mind mapping functionality.

## 🏗️ Architecture Overview

The application follows a manager-based architecture with the following core components:

```
MindMap (Main Class)
├── NodeManager        # Node operations
├── ConnectionManager  # Connection handling  
├── PanelManager       # UI panel management
├── HistoryManager     # Undo/redo system
├── ConfigManager      # Configuration
└── EventEmitter       # Event system
```

## 🎯 MindMap (Main Class)

The central coordinator class that orchestrates all managers.

### Constructor
```javascript
new MindMap()
```

### Properties
- `canvas` - SVG canvas element
- `nodes` - Array of node objects
- `connections` - Array of connection objects
- `selectedNode` - Currently selected node
- `selectedNodes` - Set of selected node IDs
- `viewBox` - Current viewport configuration
- `zoomLevel` - Current zoom level

### Methods

#### Node Operations
```javascript
// Add a new node
addNode(x?, y?, text?) → Node

// Delete a node
deleteNode(node) → void

// Select a node
selectNode(node) → void

// Clear selection
clearSelection() → void
```

#### Zoom & Pan
```javascript
// Set zoom level
setZoom(level) → void

// Zoom in
zoomIn() → void

// Zoom out  
zoomOut() → void

// Reset zoom
resetZoom() → void

// Set viewport
setViewBox(x, y) → void
```

#### History Operations
```javascript
// Undo last action
undo() → boolean

// Redo action
redo() → boolean
```

#### Map Management
```javascript
// Save current map
saveMap() → void

// Load saved map
loadMap() → void

// Clear entire map
clearMap() → void

// Delete entire map
deleteMap() → void
```

## 🎯 NodeManager

Handles all node-related operations including creation, editing, deletion, and visual rendering.

### Constructor
```javascript
new NodeManager(mindMap)
```

### Node Structure
```javascript
Node {
    id: string,           // Unique identifier
    x: number,            // X coordinate
    y: number,            // Y coordinate  
    text: string,         // Node text content
    style: {              // Visual styling
        fontFamily: string,
        fontSize: number,
        fontWeight: number,
        textColor: string,
        backgroundColor: string,
        borderColor: string
    },
    shape: {              // Shape configuration
        type: string,     // 'circle', 'rect', 'diamond', 'hexagon'
        width: number,
        height: number,
        cornerRadius: number
    },
    image: {              // Optional image
        src: string,
        position: string, // 'before', 'after', 'above', 'below'
        width: number,
        height: number
    }
}
```

### Methods

#### Node Creation & Management
```javascript
// Create a new node
createNode(x, y, text, options?) → Node

// Add node with automatic positioning
addNode(x?, y?, text?) → Node

// Delete node by ID
deleteNode(nodeId) → boolean

// Update node properties
updateNode(nodeId, updates) → boolean

// Get node by ID
getNode(nodeId) → Node

// Get all nodes
getAllNodes() → Node[]

// Clear all nodes
clearAllNodes() → void
```

#### Node Selection
```javascript
// Select a single node
selectNode(node) → void

// Select multiple nodes
selectNodes(nodeIds) → void

// Add node to selection
addToSelection(nodeId) → void

// Remove from selection
removeFromSelection(nodeId) → void

// Clear selection
clearSelection() → void

// Get selected nodes
getSelectedNodes() → Node[]
```

#### Node Operations
```javascript
// Copy selected nodes
copySelectedNodes() → void

// Paste copied nodes
pasteNodes() → void

// Delete selected nodes
deleteSelectedNodes() → void

// Update node position
updateNodePosition(node, x, y) → void

// Start node editing
startNodeEditing(node) → void

// End node editing
endNodeEditing(node, newText) → void
```

#### Visual Management
```javascript
// Render node
renderNode(node, update?) → void

// Update node visual
updateNodeVisual(node) → void

// Add node interactions
addNodeInteractions(nodeGroup, node) → void

// Show node context menu
showNodeContextMenu(event, node) → void
```

## 🔗 ConnectionManager

Manages connections between nodes, including creation, deletion, and control points.

### Constructor
```javascript
new ConnectionManager(mindMap)
```

### Connection Structure
```javascript
Connection {
    id: string,           // Unique identifier
    from: string,         // Source node ID
    to: string,           // Target node ID
    controlPoints: [{     // Bezier control points
        x: number,
        y: number
    }],
    style: {              // Visual styling
        stroke: string,
        strokeWidth: number,
        strokeDasharray: string
    }
}
```

### Methods

#### Connection Management
```javascript
// Create connection between nodes
createConnection(fromNode, toNode, options?) → string

// Delete connection
deleteConnection(connectionId) → boolean

// Find connection between nodes
findConnection(fromId, toId) → string

// Get all connections for node
getNodeConnections(nodeId) → Connection[]

// Clear all connections
clearAllConnections() → void
```

#### Connection Rendering
```javascript
// Render single connection
renderConnection(connection) → void

// Render all connections
renderAllConnections() → void

// Update connection path
updateConnectionPath(connectionId) → void

// Create connection path data
createConnectionPath(fromNode, toNode, connectionId) → string
```

#### Control Points
```javascript
// Show control points for connection
showControlPoints(connectionId) → void

// Hide control points
hideControlPoints(connectionId) → void

// Add control point
addControlPoint(connectionId, point) → void

// Remove control point
removeControlPoint(connectionId, pointIndex) → void

// Update control point position
updateControlPoint(connectionId, pointIndex, position) → void
```

#### Selection & Interaction
```javascript
// Select connection
selectConnection(connectionId) → void

// Deselect all connections
deselectAllConnections() → void

// Handle connection click
handleConnectionClick(event, connectionId) → void

// Show connection context menu
showConnectionContextMenu(event, connectionId) → void
```

## 🎛️ PanelManager

Manages UI panels for node and connection property editing.

### Constructor
```javascript
new PanelManager(mindMap)
```

### Methods

#### Panel Management
```javascript
// Show node properties panel
showNodePanel(node) → void

// Hide node properties panel
hideNodePanel() → void

// Update panel for selected node
updatePanelForNode(node) → void

// Setup panel event listeners
setupPanelEventListeners() → void
```

#### Property Updates
```javascript
// Update node text properties
updateTextProperties(node, properties) → void

// Update node shape properties
updateShapeProperties(node, properties) → void

// Update node color properties
updateColorProperties(node, properties) → void

// Update node image properties
updateImageProperties(node, properties) → void
```

#### UI Controls
```javascript
// Setup color picker
setupColorPicker(inputId, callback) → void

// Setup range slider
setupRangeSlider(inputId, callback) → void

// Setup dropdown
setupDropdown(selectId, callback) → void

// Setup image upload
setupImageUpload() → void
```

## ⏪ HistoryManager

Provides comprehensive undo/redo functionality with state management.

### Constructor
```javascript
new HistoryManager(mindMap, options?)
```

### Options
```javascript
{
    maxHistorySize: number,  // Maximum history entries (default: 50)
    debug: boolean          // Enable debug logging
}
```

### Methods

#### State Management
```javascript
// Capture current state
captureState(operationType, description) → Object

// Save current state to history
saveState(operationType, description?) → void

// Save state with debouncing
saveStateDebounced(operationType, description?) → void

// Restore specific state
restoreState(state) → void
```

#### History Operations
```javascript
// Undo last action
undo() → boolean

// Redo action  
redo() → boolean

// Check if undo available
canUndo() → boolean

// Check if redo available
canRedo() → boolean

// Get history statistics
getStats() → Object

// Clear all history
clearHistory() → void
```

#### Batch Operations
```javascript
// Start batch operation
startBatch(operationType, description) → void

// End batch operation
endBatch() → void
```

## ⚙️ ConfigManager

Manages application configuration and settings.

### Constructor
```javascript
new ConfigManager()
```

### Methods

#### Configuration
```javascript
// Get configuration value
get(key, defaultValue?) → any

// Set configuration value
set(key, value) → void

// Get all configuration
getAll() → Object

// Reset to defaults
resetToDefaults() → void

// Load from storage
loadFromStorage() → void

// Save to storage
saveToStorage() → void
```

#### Theme Management
```javascript
// Get theme configuration
getTheme() → Object

// Set theme
setTheme(theme) → void

// Get color palette
getColors() → Object
```

## 📡 EventEmitter

Custom event system for component communication.

### Constructor
```javascript
new EventEmitter()
```

### Methods

#### Event Management
```javascript
// Add event listener
on(event, callback) → void

// Remove event listener
off(event, callback) → void

// Add one-time listener
once(event, callback) → void

// Emit event
emit(event, data?) → void

// Remove all listeners
removeAllListeners(event?) → void

// Get listener count
listenerCount(event) → number
```

## 🎛️ Events

The application emits various events that can be listened to:

### Node Events
```javascript
// Node lifecycle
'nodeCreated' → { node }
'nodeDeleted' → { nodeId }
'nodeUpdated' → { node, changes }
'nodeSelected' → { node }
'nodeDeselected' → { node }

// Node interactions
'nodeTextChanged' → { node, oldText, newText }
'nodeMoved' → { node, oldPosition, newPosition }
'nodeStyleChanged' → { node, property, value }
```

### Connection Events
```javascript
// Connection lifecycle
'connectionCreated' → { connection }
'connectionDeleted' → { connectionId }
'connectionSelected' → { connection }

// Connection modifications
'controlPointAdded' → { connectionId, point }
'controlPointMoved' → { connectionId, pointIndex, position }
'controlPointRemoved' → { connectionId, pointIndex }
```

### History Events
```javascript
// History operations
'historyStateChanged' → { undoCount, redoCount, canUndo, canRedo }
'stateRestored' → { operationType, description }
'batchStarted' → { operationType, description }
'batchEnded' → { operationType, description }
```

### UI Events
```javascript
// Viewport changes
'zoomChanged' → { level, oldLevel }
'panChanged' → { x, y }
'viewportChanged' → { viewBox }

// Selection changes
'selectionChanged' → { selectedNodes, selectedConnections }
'multiSelectionStarted' → { startPoint }
'multiSelectionEnded' → { selectedNodes }
```

## 🔧 Utility Functions

### Core Utilities (`src/js/core/utils.js`)

```javascript
// Math utilities
calculateDistance(point1, point2) → number
getAngleBetweenPoints(point1, point2) → number
getPointOnCircle(center, radius, angle) → Point

// DOM utilities
createSVGElement(tagName, attributes?) → Element
setAttributes(element, attributes) → void
addClass(element, className) → void
removeClass(element, className) → void

// Geometry utilities
isPointInRect(point, rect) → boolean
getNodeBounds(node) → Rectangle
calculateBezierPoint(p0, p1, p2, p3, t) → Point

// Color utilities
hexToRgb(hex) → {r, g, b}
rgbToHex(r, g, b) → string
getContrastColor(color) → string

// Validation utilities
isValidNodeId(id) → boolean
isValidPosition(x, y) → boolean
sanitizeText(text) → string
```

## 🎯 Usage Examples

### Creating a Custom Tool
```javascript
// Create a custom tool that adds numbered nodes
class NumberedNodeTool {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.counter = 1;
    }
    
    addNumberedNode(x, y) {
        const text = `Node ${this.counter++}`;
        return this.mindMap.nodeManager.createNode(x, y, text);
    }
}

// Usage
const tool = new NumberedNodeTool(mindMap);
tool.addNumberedNode(100, 100);
```

### Listening to Events
```javascript
// Listen for node creation
mindMap.eventEmitter.on('nodeCreated', (data) => {
    console.log('New node created:', data.node);
    // Custom logic here
});

// Listen for history changes
mindMap.eventEmitter.on('historyStateChanged', (data) => {
    console.log(`Can undo: ${data.canUndo}, Can redo: ${data.canRedo}`);
});
```

### Custom Node Styling
```javascript
// Apply custom styling to a node
const node = mindMap.nodeManager.getNode('node_1');
mindMap.nodeManager.updateNode(node.id, {
    style: {
        backgroundColor: '#ff6b6b',
        textColor: '#ffffff',
        fontSize: 16
    },
    shape: {
        type: 'diamond',
        width: 120,
        height: 80
    }
});
```

This API provides comprehensive access to all mind mapping functionality, allowing for extensive customization and extension of the application.