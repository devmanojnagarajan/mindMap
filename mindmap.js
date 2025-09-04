/**
 * MindMap Application Class
 * Main application controller extending BaseManager with EventEmitter
 */
class MindMap extends EventEmitter {
    constructor(container, options = {}) {
        super();
        
        console.log('🚀 Initializing MindMap...');
        
        // Initialize configuration
        this.config = Config;
        this.options = Utils.deepMerge(this.config.getAll(), options);
        
        // Initialize DOM elements
        this.initializeDOM(container);
        
        // Initialize state
        this.initializeState();
        
        // Initialize managers
        this.initializeManagers();
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initialize canvas
        this.initializeCanvas();
        
        // Load any existing data
        this.loadInitialData();
        
        console.log('✅ MindMap initialized successfully');
        this.emit('initialized');
    }
    
    /**
     * Initialize DOM elements
     */
    initializeDOM(container) {
        if (typeof container === 'string') {
            this.container = document.querySelector(container);
        } else if (container instanceof Element) {
            this.container = container;
        } else {
            this.container = document.getElementById('app');
        }
        
        if (!this.container) {
            throw new Error('MindMap: Container element not found');
        }
        
        // Get essential DOM elements
        this.canvas = this.container.querySelector('#canvas');
        this.canvasContainer = this.container.querySelector('#canvas-container');
        
        if (!this.canvas) {
            throw new Error('MindMap: Canvas element not found');
        }
        
        console.log('📊 DOM elements initialized');
    }
    
    /**
     * Initialize application state
     */
    initializeState() {
        this.state = {
            nodes: new Map(),
            connections: new Map(),
            selectedNodes: new Set(),
            selectedConnections: new Set(),
            clipboardData: null,
            history: [],
            historyIndex: -1,
            isModified: false,
            lastSaveTime: null
        };
        
        this.viewport = {
            x: 0,
            y: 0,
            width: 0,
            height: 0,
            zoom: 1
        };
        
        this.interaction = {
            isDragging: false,
            isPanning: false,
            isSelecting: false,
            dragStart: { x: 0, y: 0 },
            panStart: { x: 0, y: 0 },
            selectionStart: { x: 0, y: 0 },
            dragThreshold: this.config.get('nodes.dragThreshold', 5)
        };
        
        console.log('🔧 State initialized');
    }
    
    /**
     * Initialize managers
     */
    initializeManagers() {
        this.managers = {};
        
        try {
            // Initialize node manager
            this.managers.nodes = new NodeManager(this, {
                debug: this.config.get('app.debug', false)
            });
            
            // Initialize connection manager
            this.managers.connections = new ConnectionManager(this, {
                debug: this.config.get('app.debug', false)
            });
            
            // Initialize panel manager
            this.managers.panel = new PanelManager(this, {
                debug: this.config.get('app.debug', false)
            });
            
            console.log('🎛️ Managers initialized');
            
            // Initialize all managers
            Object.values(this.managers).forEach(manager => {
                if (manager.init) {
                    manager.init();
                }
            });
            
        } catch (error) {
            console.error('❌ Failed to initialize managers:', error);
            throw error;
        }
    }
    
    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', this.onMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.onMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.onMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.onWheel.bind(this));
        this.canvas.addEventListener('contextmenu', this.onContextMenu.bind(this));
        
        // Keyboard events
        document.addEventListener('keydown', this.onKeyDown.bind(this));
        document.addEventListener('keyup', this.onKeyUp.bind(this));
        
        // Window events
        window.addEventListener('resize', this.onResize.bind(this));
        window.addEventListener('beforeunload', this.onBeforeUnload.bind(this));
        
        // Toolbar events
        this.setupToolbarEvents();
        
        console.log('🎧 Event listeners setup');
    }
    
    /**
     * Setup toolbar event listeners
     */
    setupToolbarEvents() {
        const buttons = {
            'add-node': () => this.addNode(),
            'connect-mode': () => this.toggleConnectMode(),
            'zoom-in': () => this.zoomIn(),
            'zoom-out': () => this.zoomOut(),
            'zoom-reset': () => this.resetZoom(),
            'save-map': () => this.saveMap(),
            'load-map': () => this.loadMap(),
            'delete-map': () => this.deleteMap()
        };
        
        Object.entries(buttons).forEach(([id, handler]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', handler);
            }
        });
    }
    
    /**
     * Initialize canvas layers and viewport
     */
    initializeCanvas() {
        this.updateCanvasSize();
        this.initializeLayers();
        this.updateViewport();
        
        console.log('🖼️ Canvas initialized');
    }
    
    /**
     * Initialize SVG layers with proper z-ordering
     */
    initializeLayers() {
        // Clear existing content except defs
        const defs = this.canvas.querySelector('defs');
        this.canvas.innerHTML = defs ? defs.outerHTML : '';
        
        // Re-create essential UI elements
        this.createEssentialUIElements();
        
        // Create layers in correct order (bottom to top)
        this.layers = {
            background: this.createLayer('background-layer'),
            connections: this.createLayer('connections-layer'),
            nodes: this.createLayer('nodes-layer'),
            controls: this.createLayer('controls-layer'),
            ui: this.createLayer('ui-layer')
        };
        
        console.log('📚 Layers initialized');
    }
    
    /**
     * Create SVG layer
     */
    createLayer(id) {
        const layer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        layer.setAttribute('id', id);
        this.canvas.appendChild(layer);
        return layer;
    }
    
    /**
     * Create essential UI elements
     */
    createEssentialUIElements() {
        // Grid background
        this.createGridBackground();
        
        // Selection rectangle
        this.createSelectionRectangle();
        
        // Drag connection line
        this.createDragConnectionLine();
        
        // Add node indicator
        this.createAddNodeIndicator();
    }
    
    /**
     * Create grid background
     */
    createGridBackground() {
        if (this.canvas.querySelector('#grid-background')) return;
        
        const gridSize = this.config.get('canvas.gridSize', 50);
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        
        rect.setAttribute('id', 'grid-background');
        rect.setAttribute('x', '-10000');
        rect.setAttribute('y', '-10000');
        rect.setAttribute('width', '20000');
        rect.setAttribute('height', '20000');
        rect.setAttribute('fill', 'url(#grid)');
        rect.style.opacity = this.config.get('canvas.gridVisible') ? '1' : '0';
        
        this.canvas.appendChild(rect);
    }
    
    /**
     * Create selection rectangle
     */
    createSelectionRectangle() {
        if (this.canvas.querySelector('#selection-rectangle')) return;
        
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('id', 'selection-rectangle');
        rect.setAttribute('x', '0');
        rect.setAttribute('y', '0');
        rect.setAttribute('width', '0');
        rect.setAttribute('height', '0');
        rect.setAttribute('fill', 'rgba(33, 150, 243, 0.2)');
        rect.setAttribute('stroke', '#2196F3');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('stroke-dasharray', '5,5');
        rect.style.display = 'none';
        
        this.canvas.appendChild(rect);
        this.selectionRectangle = rect;
    }
    
    /**
     * Create drag connection line
     */
    createDragConnectionLine() {
        if (this.canvas.querySelector('#drag-connection')) return;
        
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('id', 'drag-connection');
        path.setAttribute('d', '');
        path.setAttribute('stroke', '#3498db');
        path.setAttribute('stroke-width', '3');
        path.setAttribute('fill', 'none');
        path.setAttribute('stroke-dasharray', '8,4');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        path.style.display = 'none';
        path.style.pointerEvents = 'none';
        
        this.canvas.appendChild(path);
        this.dragConnectionLine = path;
    }
    
    /**
     * Create add node indicator
     */
    createAddNodeIndicator() {
        if (this.canvas.querySelector('#add-node-indicator')) return;
        
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('id', 'add-node-indicator');
        group.style.display = 'none';
        group.style.cursor = 'pointer';
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', '0');
        circle.setAttribute('cy', '0');
        circle.setAttribute('r', '25');
        circle.setAttribute('fill', 'rgba(52, 152, 219, 0.3)');
        circle.setAttribute('stroke', '#3498db');
        circle.setAttribute('stroke-width', '2');
        circle.setAttribute('stroke-dasharray', '5,3');
        circle.style.pointerEvents = 'all';
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '0');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('fill', '#3498db');
        text.setAttribute('font-size', '12');
        text.setAttribute('font-family', 'var(--font-family)');
        text.style.pointerEvents = 'none';
        text.textContent = 'Click to add';
        
        group.appendChild(circle);
        group.appendChild(text);
        this.canvas.appendChild(group);
        this.addNodeIndicator = group;
    }
    
    /**
     * Update canvas size
     */
    updateCanvasSize() {
        if (!this.canvasContainer) return;
        
        const rect = this.canvasContainer.getBoundingClientRect();
        this.canvas.setAttribute('width', rect.width);
        this.canvas.setAttribute('height', rect.height);
        
        this.viewport.width = rect.width;
        this.viewport.height = rect.height;
    }
    
    /**
     * Update viewport
     */
    updateViewport() {
        if (!this.canvas) return;
        
        const viewBox = `${this.viewport.x} ${this.viewport.y} ${this.viewport.width / this.viewport.zoom} ${this.viewport.height / this.viewport.zoom}`;
        this.canvas.setAttribute('viewBox', viewBox);
    }
    
    /**
     * Load initial data
     */
    loadInitialData() {
        // Try to load from localStorage
        this.loadFromStorage();
        
        // If no data, create initial node
        if (this.state.nodes.size === 0) {
            this.createInitialNode();
        }
        
        console.log('💾 Initial data loaded');
    }
    
    /**
     * Create initial root node
     */
    createInitialNode() {
        const node = this.createNode({
            x: 0,
            y: 0,
            text: 'Root Node',
            isRoot: true
        });
        
        this.state.nodes.set(node.id, node);
        
        if (this.managers.nodes) {
            this.managers.nodes.renderNode(node);
        }
    }
    
    /**
     * Create a new node
     */
    createNode(options = {}) {
        const defaults = {
            id: Utils.shortId('node_'),
            x: 0,
            y: 0,
            text: 'New Node',
            width: this.config.get('nodes.defaultWidth'),
            height: this.config.get('nodes.defaultHeight'),
            shape: this.config.get('nodes.defaultShape'),
            color: this.config.get('nodes.defaultColor'),
            textColor: this.config.get('nodes.defaultTextColor'),
            fontFamily: this.config.get('nodes.defaultFontFamily'),
            fontSize: this.config.get('nodes.defaultFontSize'),
            fontWeight: this.config.get('nodes.defaultFontWeight'),
            created: Date.now(),
            modified: Date.now()
        };
        
        return Utils.deepMerge(defaults, options);
    }
    
    /**
     * Add a new node
     */
    addNode(x = 0, y = 0, text = 'New Node') {
        const node = this.createNode({ x, y, text });
        this.state.nodes.set(node.id, node);
        
        if (this.managers.nodes) {
            this.managers.nodes.renderNode(node);
        }
        
        this.emit('nodeAdded', node);
        this.markModified();
        
        return node;
    }
    
    /**
     * Mouse event handlers
     */
    onMouseDown(event) {
        this.emit('mouseDown', event);
    }
    
    onMouseMove(event) {
        this.emit('mouseMove', event);
    }
    
    onMouseUp(event) {
        this.emit('mouseUp', event);
    }
    
    onWheel(event) {
        this.emit('wheel', event);
    }
    
    onContextMenu(event) {
        this.emit('contextMenu', event);
    }
    
    /**
     * Keyboard event handlers
     */
    onKeyDown(event) {
        this.emit('keyDown', event);
    }
    
    onKeyUp(event) {
        this.emit('keyUp', event);
    }
    
    /**
     * Window event handlers
     */
    onResize() {
        this.updateCanvasSize();
        this.updateViewport();
        this.emit('resize');
    }
    
    onBeforeUnload(event) {
        if (this.state.isModified) {
            event.preventDefault();
            event.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
            return event.returnValue;
        }
    }
    
    /**
     * Mark as modified
     */
    markModified() {
        this.state.isModified = true;
        this.emit('modified');
    }
    
    /**
     * Save to localStorage
     */
    saveToStorage() {
        try {
            const data = {
                nodes: Array.from(this.state.nodes.entries()),
                connections: Array.from(this.state.connections.entries()),
                viewport: this.viewport,
                saved: Date.now()
            };
            
            localStorage.setItem(this.config.get('storage.key'), JSON.stringify(data));
            this.state.isModified = false;
            this.state.lastSaveTime = Date.now();
            
            this.emit('saved');
            return true;
        } catch (error) {
            console.error('Failed to save to storage:', error);
            this.emit('saveError', error);
            return false;
        }
    }
    
    /**
     * Load from localStorage
     */
    loadFromStorage() {
        try {
            const data = JSON.parse(localStorage.getItem(this.config.get('storage.key')) || '{}');
            
            if (data.nodes) {
                this.state.nodes = new Map(data.nodes);
            }
            
            if (data.connections) {
                this.state.connections = new Map(data.connections);
            }
            
            if (data.viewport) {
                this.viewport = { ...this.viewport, ...data.viewport };
            }
            
            this.state.lastSaveTime = data.saved || null;
            this.state.isModified = false;
            
            this.emit('loaded');
            return true;
        } catch (error) {
            console.error('Failed to load from storage:', error);
            this.emit('loadError', error);
            return false;
        }
    }
    
    /**
     * Placeholder methods for toolbar actions
     */
    toggleConnectMode() {
        // TODO: Implement
    }
    
    zoomIn() {
        // TODO: Implement
    }
    
    zoomOut() {
        // TODO: Implement
    }
    
    resetZoom() {
        // TODO: Implement
    }
    
    saveMap() {
        this.saveToStorage();
    }
    
    loadMap() {
        this.loadFromStorage();
    }
    
    deleteMap() {
        if (confirm('Are you sure you want to delete this map?')) {
            this.state.nodes.clear();
            this.state.connections.clear();
            this.saveToStorage();
            this.createInitialNode();
        }
    }
    
    /**
     * Destroy the mind map instance
     */
    destroy() {
        // Remove event listeners
        this.removeAllListeners();
        
        // Destroy managers
        Object.values(this.managers).forEach(manager => {
            if (manager.destroy) {
                manager.destroy();
            }
        });
        
        // Clear state
        this.state = null;
        this.managers = null;
        this.canvas = null;
        
        console.log('🔥 MindMap destroyed');
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.MindMap = MindMap;
}