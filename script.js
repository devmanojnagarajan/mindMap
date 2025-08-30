class MindMap {
    constructor() {
        this.canvas = document.getElementById('canvas');
        this.nodes = [];
        this.connections = [];
        this.pendingConnections = []; // Persistent pending connections
        this.selectedNode = null;
        this.selectedNodes = new Set();
        this.isConnectMode = false;
        this.connectionStart = null;
        this.connectionControlPoints = new Map(); // Store custom control points for connections
        this.clipboard = [];
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        this.isSelecting = false;
        this.selectionStart = { x: 0, y: 0 };
        this.selectionRectangle = document.getElementById('selection-rectangle');
        this.dragConnectionLine = document.getElementById('drag-connection');
        this.isDraggingConnection = false;
        this.dragConnectionStart = null;
        this.dragConnectionStartPoint = { x: 0, y: 0 };
        this.pendingConnection = null;
        this.addNodeClickHandler = null;
        this.escapeHandler = null;
        this.isPanning = false;
        this.isSpacePressed = false;
        this.panStart = { x: 0, y: 0 };
        this.viewBox = { x: 0, y: 0, width: window.innerWidth, height: window.innerHeight };
        this.zoomLevel = 1;
        this.minZoom = 0.1;
        this.maxZoom = 5;
        this.nodeIdCounter = 0;
        this.minimap = document.getElementById('minimap');
        this.minimapBounds = { x: -1000, y: -1000, width: 2000, height: 2000 };
        
        this.init();
        this.setupEventListeners();
        this.addRootNode();
    }

    init() {
        this.updateCanvasSize();
        this.updateViewBox();
        this.initializeLayers();
    }

    initializeLayers() {
        // Create separate layers for proper z-ordering
        const defs = this.canvas.querySelector('defs');
        
        // Create connection layer (should be behind nodes)
        this.connectionLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.connectionLayer.setAttribute('id', 'connection-layer');
        this.canvas.appendChild(this.connectionLayer);
        
        // Create node layer (should be above connections)
        this.nodeLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.nodeLayer.setAttribute('id', 'node-layer');
        this.canvas.appendChild(this.nodeLayer);
        
        // Create control point layer (should be above everything)
        this.controlLayer = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        this.controlLayer.setAttribute('id', 'control-layer');
        this.canvas.appendChild(this.controlLayer);
        
        console.log('Layers initialized: connection, node, control');
        console.log('Connection layer:', this.connectionLayer);
        console.log('Node layer:', this.nodeLayer);
        console.log('Control layer:', this.controlLayer);
    }

    setupEventListeners() {
        document.getElementById('add-node').addEventListener('click', () => this.addNode());
        document.getElementById('connect-mode').addEventListener('click', () => this.toggleConnectMode());
        document.getElementById('zoom-in').addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out').addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-reset').addEventListener('click', () => this.resetZoom());
        document.getElementById('save-map').addEventListener('click', () => this.saveMap());
        document.getElementById('load-map').addEventListener('click', () => this.loadMap());
        document.getElementById('delete-map').addEventListener('click', () => this.deleteMap());
        
        window.addEventListener('resize', () => this.updateCanvasSize());
        
        this.canvas.addEventListener('mousedown', (e) => this.onMouseDown(e));
        this.canvas.addEventListener('mousemove', (e) => this.onMouseMove(e));
        this.canvas.addEventListener('mouseup', (e) => this.onMouseUp(e));
        this.canvas.addEventListener('contextmenu', (e) => this.onContextMenu(e));
        this.canvas.addEventListener('wheel', (e) => this.onWheel(e));
        
        this.minimap.addEventListener('click', (e) => this.onMinimapClick(e));
        
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete') {
                if (this.selectedNodes.size > 0) {
                    this.deleteSelectedNodes();
                } else if (this.selectedNode) {
                    this.deleteNode(this.selectedNode);
                }
            } else if (e.key === 'Escape') {
                this.clearSelection();
                this.isConnectMode = false;
                this.updateConnectModeButton();
                this.hideAllControlPoints();
            } else if (e.key === ' ') {
                e.preventDefault();
                this.isSpacePressed = true;
            } else if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                this.copySelectedNodes();
            } else if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                this.pasteNodes();
            } else if (e.key === 't' || e.key === 'T') {
                // TEMPORARY: Press 'T' to create a test control point
                console.log('Creating test control point with T key');
                this.createTestControlPoint();
                
                // TEMPORARY: Press 'C' to test connection clicking
                console.log('Creating test connection with C key');
                this.createTestConnection();
            }
        });
        
        document.addEventListener('keyup', (e) => {
            if (e.key === ' ') {
                this.isSpacePressed = false;
            }
        });
        
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.context-menu')) {
                this.hideContextMenu();
            }
        });
    }

    updateCanvasSize() {
        const container = document.getElementById('canvas-container');
        this.canvas.setAttribute('width', container.clientWidth);
        this.canvas.setAttribute('height', container.clientHeight);
        this.viewBox.width = container.clientWidth;
        this.viewBox.height = container.clientHeight;
    }

    addRootNode() {
        const centerX = this.viewBox.width / 2;
        const centerY = this.viewBox.height / 2;
        this.addNode(centerX, centerY, 'Central Idea');
    }

    addNode(x = null, y = null, text = 'New Node') {
        if (x === null || y === null) {
            if (this.selectedNode) {
                const parentNode = this.selectedNode;
                const angle = Math.random() * 2 * Math.PI;
                const distance = 150;
                x = parentNode.x + Math.cos(angle) * distance;
                y = parentNode.y + Math.sin(angle) * distance;
                
                const connection = {
                    id: `conn_${this.nodeIdCounter}`,
                    from: parentNode.id,
                    to: `node_${this.nodeIdCounter}`
                };
                this.connections.push(connection);
            } else {
                x = Math.random() * (this.viewBox.width - 200) + 100;
                y = Math.random() * (this.viewBox.height - 200) + 100;
            }
        }

        const node = {
            id: `node_${this.nodeIdCounter++}`,
            x: x,
            y: y,
            text: text,
            radius: 40
        };

        this.nodes.push(node);
        this.renderNode(node);
        
        
        if (this.connections.length > 0) {
            this.renderConnections();
        }
    }

    renderNode(node) {
        this.updateMinimapBounds(node.x, node.y);
        const group = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        group.setAttribute('class', 'node');
        group.setAttribute('data-node-id', node.id);
        group.setAttribute('transform', `translate(${node.x}, ${node.y})`);

        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'node-circle');
        circle.setAttribute('r', node.radius);
        circle.setAttribute('cx', 0);
        circle.setAttribute('cy', 0);

        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'node-text');
        text.setAttribute('x', 0);
        text.setAttribute('y', 0);
        text.textContent = node.text;

        group.appendChild(circle);
        group.appendChild(text);
        this.nodeLayer.appendChild(group);

        group.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            
            if (this.isConnectMode) {
                this.handleConnectionClick(node);
            } else if (e.ctrlKey) {
                this.toggleNodeSelection(node);
            } else {
                const rect = this.canvas.getBoundingClientRect();
                const mouseX = e.clientX - rect.left;
                const mouseY = e.clientY - rect.top;
                
                // Convert mouse position to world coordinates
                const worldMouseX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
                const worldMouseY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
                
                // Calculate distance from mouse to node center
                const dx = worldMouseX - node.x;
                const dy = worldMouseY - node.y;
                const distanceFromCenter = Math.sqrt(dx * dx + dy * dy);
                
                // Check if click is on outer edge (within 15 pixels of circumference)
                const isOnEdge = distanceFromCenter >= (node.radius - 15) && distanceFromCenter <= (node.radius + 10);
                
                console.log('Node clicked', {
                    nodeId: node.id, 
                    distance: distanceFromCenter, 
                    radius: node.radius, 
                    isOnEdge: isOnEdge,
                    edgeRange: `${node.radius - 15} to ${node.radius + 10}`
                });
                
                if (isOnEdge) {
                    // Start connection from edge
                    console.log('Starting drag connection from edge');
                    this.startDragConnection(node, e, worldMouseX, worldMouseY);
                } else {
                    // Normal node dragging
                    console.log('Starting normal node drag');
                    this.dragOffset.x = node.x - worldMouseX;
                    this.dragOffset.y = node.y - worldMouseY;
                    
                    this.dragStart.x = mouseX;
                    this.dragStart.y = mouseY;
                    
                    if (!this.selectedNodes.has(node.id)) {
                        this.selectNode(node);
                    }
                    this.isDragging = true;
                }
            }
        });

        group.addEventListener('dblclick', (e) => {
            e.stopPropagation();
            this.editNode(node, text);
        });
    }

    selectNode(node) {
        if (this.selectedNode) {
            const prevSelected = document.querySelector(`[data-node-id="${this.selectedNode.id}"] .node-circle`);
            if (prevSelected) {
                prevSelected.classList.remove('selected');
            }
        }

        this.selectedNode = node;
        const circle = document.querySelector(`[data-node-id="${node.id}"] .node-circle`);
        if (circle) {
            circle.classList.add('selected');
        }
    }

    editNode(node, textElement) {
        const input = document.createElement('input');
        input.type = 'text';
        input.value = node.text;
        input.className = 'node-input';
        
        const rect = this.canvas.getBoundingClientRect();
        input.style.left = (rect.left + node.x - 40) + 'px';
        input.style.top = (rect.top + node.y - 10) + 'px';
        input.style.width = '80px';
        input.style.height = '20px';
        
        document.body.appendChild(input);
        input.focus();
        input.select();

        const finishEdit = () => {
            node.text = input.value || 'New Node';
            textElement.textContent = node.text;
            document.body.removeChild(input);
        };

        input.addEventListener('blur', finishEdit);
        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                finishEdit();
            }
        });
    }

    deleteNode(node) {
        this.nodes = this.nodes.filter(n => n.id !== node.id);
        this.connections = this.connections.filter(c => c.from !== node.id && c.to !== node.id);
        
        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeElement) {
            nodeElement.remove();
        }
        
        this.renderConnections();
        this.selectedNode = null;
    }

    renderConnections() {
        console.log('renderConnections called, current connections:', this.connections.length);
        console.log('Has temporary connection?', this.connections.some(c => c.isTemporary));
        console.log('Call stack:', new Error().stack);
        
        const existingConnections = document.querySelectorAll('.connection-line');
        console.log('Removing', existingConnections.length, 'existing connection lines');
        existingConnections.forEach(conn => conn.remove());

        this.connections.forEach(connection => {
            console.log('Processing connection:', connection.id, 'isTemporary:', connection.isTemporary);
            const fromNode = this.nodes.find(n => n.id === connection.from);
            const toNode = this.nodes.find(n => n.id === connection.to);
            console.log('Found nodes - from:', fromNode?.id, 'to:', toNode?.id);
            
            if (fromNode && toNode) {
                // Calculate connection points on node edges instead of centers
                const dx = toNode.x - fromNode.x;
                const dy = toNode.y - fromNode.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 0) {
                    const unitX = dx / distance;
                    const unitY = dy / distance;
                    
                    // Start and end points on node circumference
                    const startX = fromNode.x + unitX * fromNode.radius;
                    const startY = fromNode.y + unitY * fromNode.radius;
                    const endX = toNode.x - unitX * toNode.radius;
                    const endY = toNode.y - unitY * toNode.radius;
                    
                    // Create Coggle-style Bézier curve with proper control points
                    const pathData = this.createCoggleConnectionPath(startX, startY, endX, endY, fromNode, toNode, connection.id);
                    
                    // Create curved path for more elegant connections
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('class', 'connection-line');
                    path.setAttribute('data-connection-id', connection.id);
                    path.setAttribute('d', pathData);
                    
                    // Check if this connection is selected (has visible control points)
                    const controlData = this.connectionControlPoints.get(connection.id);
                    const isSelected = controlData && controlData.visible;
                    
                    // Set up visual appearance based on selection state
                    if (isSelected) {
                        path.setAttribute('stroke', '#38BDF8'); // Bright blue for selected
                        path.setAttribute('stroke-width', '3');
                        path.style.filter = 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.5))';
                    } else {
                        path.setAttribute('stroke', '#6B7280'); // Default gray
                        path.setAttribute('stroke-width', '2');
                        path.style.filter = 'none';
                    }
                    
                    path.setAttribute('fill', 'none');
                    path.setAttribute('marker-end', 'url(#arrowhead)');
                    
                    // Create invisible thicker overlay for easier clicking
                    const clickOverlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    clickOverlay.setAttribute('d', pathData);
                    clickOverlay.setAttribute('stroke', 'transparent');
                    clickOverlay.setAttribute('stroke-width', '15'); // Thicker for easier clicking
                    clickOverlay.setAttribute('fill', 'none');
                    clickOverlay.style.pointerEvents = 'all';
                    clickOverlay.style.cursor = 'pointer';
                    
                    // Add click handler for control points and deletion to the overlay
                    clickOverlay.addEventListener('click', (e) => {
                        console.log('Connection line clicked!', {connectionId: connection.id, ctrlKey: e.ctrlKey, shiftKey: e.shiftKey});
                        
                        if (e.ctrlKey || e.altKey) {
                            e.stopPropagation();
                            this.deleteConnection(connection.id);
                        } else if (e.shiftKey) {
                            e.stopPropagation();
                            this.toggleConnectionControlPoints(connection.id);
                        } else {
                            // Regular click - add/remove control point
                            e.stopPropagation();
                            console.log('Calling handleCurveClick...');
                            this.handleCurveClick(e, connection.id, path);
                        }
                    });
                    
                    // TEMPORARY: Add a simple test circle to make sure we can create SVG elements
                    if (connection.id.includes('test')) {
                        const testCircle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                        testCircle.setAttribute('cx', startX);
                        testCircle.setAttribute('cy', startY);
                        testCircle.setAttribute('r', '10');
                        testCircle.setAttribute('fill', 'red');
                        testCircle.setAttribute('class', 'test-circle');
                        this.connectionLayer.appendChild(testCircle);
                        console.log('Test circle added at connection start');
                    }
                    
                    // Add hover effect with tooltip on the overlay
                    clickOverlay.addEventListener('mouseenter', (e) => {
                        if (isSelected) {
                            path.style.strokeWidth = '4';
                            path.style.stroke = '#0EA5E9'; // Darker blue on hover for selected
                        } else {
                            path.style.strokeWidth = '3';
                            path.style.stroke = '#9CA3AF'; // Lighter gray on hover for unselected
                        }
                    });
                    
                    clickOverlay.addEventListener('mouseleave', (e) => {
                        if (isSelected) {
                            path.style.strokeWidth = '3';
                            path.style.stroke = '#38BDF8'; // Back to selected blue
                        } else {
                            path.style.strokeWidth = '2';
                            path.style.stroke = '#6B7280'; // Back to default gray
                        }
                    });
                    
                    // Add both elements to connection layer (behind nodes)
                    this.connectionLayer.appendChild(path);
                    this.connectionLayer.appendChild(clickOverlay);
                    console.log('Connection line added to canvas with clickable styling');
                }
            }
        });
    }

    onMouseDown(e) {
        // Check if clicking on empty canvas area (not on nodes or connections)
        if (!e.target.closest('.node') && !e.target.closest('.connection-line') && 
            !e.target.closest('.control-point-handle') && e.target.tagName.toLowerCase() !== 'path') {
            
            // Deselect all connections when clicking on empty space
            this.deselectAllConnections();
            
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            const worldX = this.viewBox.x + (canvasX / rect.width) * this.viewBox.width;
            const worldY = this.viewBox.y + (canvasY / rect.height) * this.viewBox.height;
            
            if (e.button === 1 || this.isSpacePressed || (e.button === 0 && e.altKey)) {
                // Middle mouse, Space+drag, or Alt+drag for panning
                this.isPanning = true;
                this.panStart.x = e.clientX;
                this.panStart.y = e.clientY;
                e.preventDefault(); // Prevent middle mouse scroll behavior
            } else if (e.button === 0) {
                // Left click for selection
                this.isSelecting = true;
                this.selectionStart.x = worldX;
                this.selectionStart.y = worldY;
                this.dragThreshold = 5; // pixels
                this.dragDistance = 0;
                this.panStart.x = e.clientX;
                this.panStart.y = e.clientY;
            }
        }
    }

    onMouseMove(e) {
        if (this.isDragging) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Convert mouse position to world coordinates
            const worldMouseX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
            const worldMouseY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
            
            if (this.selectedNodes.size > 0) {
                // Calculate the delta from the previous mouse position
                const worldDragStartX = this.viewBox.x + (this.dragStart.x / rect.width) * this.viewBox.width;
                const worldDragStartY = this.viewBox.y + (this.dragStart.y / rect.height) * this.viewBox.height;
                
                const deltaX = worldMouseX - worldDragStartX;
                const deltaY = worldMouseY - worldDragStartY;
                
                this.selectedNodes.forEach(nodeId => {
                    const node = this.nodes.find(n => n.id === nodeId);
                    if (node) {
                        node.x += deltaX;
                        node.y += deltaY;
                        const nodeElement = document.querySelector(`[data-node-id="${node.id}"]`);
                        if (nodeElement) {
                            nodeElement.setAttribute('transform', `translate(${node.x}, ${node.y})`);
                        }
                    }
                });
                
                // Update control points for moved nodes
                this.updateControlPointsForMovedNodes();
                
                this.dragStart.x = mouseX;
                this.dragStart.y = mouseY;
            } else if (this.selectedNode) {
                // Use the stored offset to position the node correctly
                this.selectedNode.x = worldMouseX + this.dragOffset.x;
                this.selectedNode.y = worldMouseY + this.dragOffset.y;
                
                const nodeElement = document.querySelector(`[data-node-id="${this.selectedNode.id}"]`);
                if (nodeElement) {
                    nodeElement.setAttribute('transform', `translate(${this.selectedNode.x}, ${this.selectedNode.y})`);
                }
                
                // Update control points for moved nodes
                this.updateControlPointsForMovedNodes();
            }
            
            this.renderConnections();
        } else if (this.isDraggingConnection) {
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            const worldMouseX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
            const worldMouseY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
            
            this.updateDragConnection(worldMouseX, worldMouseY, e);
        } else if (this.isSelecting) {
            // Calculate drag distance to determine if we should select or pan
            const deltaX = e.clientX - this.panStart.x;
            const deltaY = e.clientY - this.panStart.y;
            this.dragDistance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (this.dragDistance > this.dragThreshold) {
                // Show selection rectangle
                if (this.selectionRectangle.style.display === 'none') {
                    this.selectionRectangle.style.display = 'block';
                }
                
                const rect = this.canvas.getBoundingClientRect();
                const currentX = e.clientX - rect.left;
                const currentY = e.clientY - rect.top;
                
                const worldCurrentX = this.viewBox.x + (currentX / rect.width) * this.viewBox.width;
                const worldCurrentY = this.viewBox.y + (currentY / rect.height) * this.viewBox.height;
                
                this.updateSelectionRectangle(this.selectionStart.x, this.selectionStart.y, worldCurrentX, worldCurrentY);
            }
        } else if (this.isPanning) {
            const deltaX = e.clientX - this.panStart.x;
            const deltaY = e.clientY - this.panStart.y;
            
            this.viewBox.x -= deltaX;
            this.viewBox.y -= deltaY;
            
            this.updateViewBox();
            
            this.panStart.x = e.clientX;
            this.panStart.y = e.clientY;
        }
    }

    onMouseUp(e) {
        if (this.isDraggingConnection) {
            this.finishDragConnection(e);
        } else if (this.isSelecting) {
            if (this.dragDistance > this.dragThreshold) {
                // User dragged - perform selection
                this.finishSelection();
            } else {
                // User just clicked - clear selection and potentially start panning on next drag
                if (!e.ctrlKey) {
                    this.clearSelection();
                }
                this.selectionRectangle.style.display = 'none';
            }
        }
        this.isDragging = false;
        // Note: isDraggingConnection is handled in finishDragConnection
        this.isPanning = false;
        this.isSelecting = false;
        this.dragDistance = 0;
    }

    onContextMenu(e) {
        e.preventDefault();
        
        if (e.target.closest('.node')) {
            const nodeId = e.target.closest('.node').getAttribute('data-node-id');
            const node = this.nodes.find(n => n.id === nodeId);
            this.showNodeContextMenu(e.clientX, e.clientY, node);
        } else {
            const rect = this.canvas.getBoundingClientRect();
            const canvasX = e.clientX - rect.left;
            const canvasY = e.clientY - rect.top;
            
            const worldX = this.viewBox.x + (canvasX / rect.width) * this.viewBox.width;
            const worldY = this.viewBox.y + (canvasY / rect.height) * this.viewBox.height;
            
            this.showCanvasContextMenu(e.clientX, e.clientY, worldX, worldY);
        }
    }

    showNodeContextMenu(x, y, node) {
        this.hideContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        const addNode = document.createElement('button');
        addNode.className = 'context-menu-item';
        addNode.innerHTML = '<i class="ri-add-circle-line"></i> Add Child Node';
        addNode.onclick = () => {
            this.selectNode(node);
            this.addNode();
            this.hideContextMenu();
        };

        const copyNode = document.createElement('button');
        copyNode.className = 'context-menu-item';
        copyNode.innerHTML = '<i class="ri-file-copy-line"></i> Copy';
        copyNode.onclick = () => {
            this.clipboard = [{text: node.text, radius: node.radius}];
            this.hideContextMenu();
        };

        const paste = document.createElement('button');
        paste.className = 'context-menu-item';
        paste.innerHTML = '<i class="ri-clipboard-line"></i> Paste';
        paste.disabled = this.clipboard.length === 0;
        paste.onclick = () => {
            this.pasteNodes();
            this.hideContextMenu();
        };

        const separator = document.createElement('div');
        separator.className = 'context-menu-separator';

        const deleteNode = document.createElement('button');
        deleteNode.className = 'context-menu-item';
        deleteNode.innerHTML = '<i class="ri-delete-bin-line"></i> Delete Node';
        deleteNode.onclick = () => {
            this.deleteNode(node);
            this.hideContextMenu();
        };
        
        menu.appendChild(addNode);
        menu.appendChild(copyNode);
        menu.appendChild(paste);
        menu.appendChild(separator);
        menu.appendChild(deleteNode);
        document.body.appendChild(menu);
    }

    showCanvasContextMenu(x, y, worldX, worldY) {
        this.hideContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = x + 'px';
        menu.style.top = y + 'px';
        
        const addNode = document.createElement('button');
        addNode.className = 'context-menu-item';
        addNode.innerHTML = '<i class="ri-add-circle-line"></i> Add Node';
        addNode.onclick = () => {
            this.addNode(worldX, worldY, 'New Node');
            this.hideContextMenu();
        };

        const copy = document.createElement('button');
        copy.className = 'context-menu-item';
        copy.innerHTML = '<i class="ri-file-copy-line"></i> Copy';
        copy.disabled = true;

        const paste = document.createElement('button');
        paste.className = 'context-menu-item';
        paste.innerHTML = '<i class="ri-clipboard-line"></i> Paste';
        paste.disabled = this.clipboard.length === 0;
        paste.onclick = () => {
            this.pasteNodes();
            this.hideContextMenu();
        };
        
        menu.appendChild(addNode);
        menu.appendChild(copy);
        menu.appendChild(paste);
        document.body.appendChild(menu);
    }

    hideContextMenu() {
        const menu = document.querySelector('.context-menu');
        if (menu) {
            menu.remove();
        }
    }

    saveMap() {
        const data = {
            nodes: this.nodes,
            connections: this.connections
        };
        
        fetch('http://localhost:3000/save', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(data)
        })
        .then(response => response.json())
        .then(data => {
            notie.alert({ type: 'success', text: data.message });
        })
        .catch(error => {
            notie.alert({ type: 'error', text: 'Error saving map!' });
            console.error('Error saving map:', error);
        });
    }

    loadMap() {
        fetch('http://localhost:3000/load')
        .then(response => response.json())
        .then(data => {
            this.clearMap();
            this.nodes = data.mapData.nodes || [];
            this.connections = data.mapData.connections || [];
            this.renderAll();
            notie.alert({ type: 'success', text: 'Map loaded successfully!' });
        })
        .catch(error => {
            notie.alert({ type: 'error', text: 'Error loading map!' });
            console.error('Error loading map:', error);
        });
    }

    deleteMap() {
        notie.confirm({
            text: 'Are you sure you want to delete the entire map?',
            submitText: 'Yes, Delete It',
            cancelText: 'Cancel',
            position: 'center',
            submitCallback: () => {
                this.nodes = [];
                this.connections = [];
                this.selectedNode = null;
                this.canvas.innerHTML = this.canvas.querySelector('defs').outerHTML;
                this.initializeLayers();
                this.addRootNode();
                notie.alert({ type: 'success', text: 'Map deleted successfully!' });
            }
        });
    }

    clearMap() {
        this.nodes = [];
        this.connections = [];
        this.selectedNode = null;
        this.selectedNodes.clear();
        this.canvas.innerHTML = this.canvas.querySelector('defs').outerHTML;
        this.initializeLayers();
    }

    renderAll() {
        this.canvas.innerHTML = this.canvas.querySelector('defs').outerHTML;
        this.initializeLayers();
        this.nodes.forEach(node => this.renderNode(node));
        this.renderConnections();
        this.updateMinimap();
    }

    updateMinimapBounds(x, y) {
        const padding = 200;
        this.minimapBounds.x = Math.min(this.minimapBounds.x, x - padding);
        this.minimapBounds.y = Math.min(this.minimapBounds.y, y - padding);
        this.minimapBounds.width = Math.max(this.minimapBounds.width, (x + padding) - this.minimapBounds.x);
        this.minimapBounds.height = Math.max(this.minimapBounds.height, (y + padding) - this.minimapBounds.y);
    }

    zoomIn() {
        this.setZoom(this.zoomLevel * 1.2);
    }

    zoomOut() {
        this.setZoom(this.zoomLevel / 1.2);
    }

    resetZoom() {
        this.setZoom(1);
        this.viewBox.x = 0;
        this.viewBox.y = 0;
        this.updateViewBox();
    }

    setZoom(newZoom) {
        newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, newZoom));
        
        const container = document.getElementById('canvas-container');
        const centerX = this.viewBox.x + (this.viewBox.width / 2);
        const centerY = this.viewBox.y + (this.viewBox.height / 2);
        
        this.zoomLevel = newZoom;
        this.viewBox.width = container.clientWidth / this.zoomLevel;
        this.viewBox.height = container.clientHeight / this.zoomLevel;
        
        this.viewBox.x = centerX - (this.viewBox.width / 2);
        this.viewBox.y = centerY - (this.viewBox.height / 2);
        
        this.updateViewBox();
    }

    onWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        const worldX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
        const worldY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
        
        const zoomFactor = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(this.minZoom, Math.min(this.maxZoom, this.zoomLevel * zoomFactor));
        
        if (newZoom !== this.zoomLevel) {
            const container = document.getElementById('canvas-container');
            
            this.zoomLevel = newZoom;
            this.viewBox.width = container.clientWidth / this.zoomLevel;
            this.viewBox.height = container.clientHeight / this.zoomLevel;
            
            this.viewBox.x = worldX - (mouseX / rect.width) * this.viewBox.width;
            this.viewBox.y = worldY - (mouseY / rect.height) * this.viewBox.height;
            
            this.updateViewBox();
        }
    }

    updateViewBox() {
        this.canvas.setAttribute('viewBox', `${this.viewBox.x} ${this.viewBox.y} ${this.viewBox.width} ${this.viewBox.height}`);
        this.updateGrid();
        this.updateMinimap();
    }

    updateGrid() {
        const gridSize = 50 / this.zoomLevel;
        const gridPattern = document.getElementById('grid');
        if (gridPattern) {
            gridPattern.setAttribute('width', gridSize);
            gridPattern.setAttribute('height', gridSize);
            
            const gridPath = gridPattern.querySelector('path');
            if (gridPath) {
                gridPath.setAttribute('d', `M ${gridSize} 0 L 0 0 0 ${gridSize}`);
                gridPath.setAttribute('stroke-width', Math.max(0.5, 0.5 / this.zoomLevel));
            }
        }
    }

    updateMinimap() {
        const minimapRect = this.minimap.getBoundingClientRect();
        const scaleX = minimapRect.width / this.minimapBounds.width;
        const scaleY = minimapRect.height / this.minimapBounds.height;
        
        const viewportIndicator = document.getElementById('viewport-indicator');
        if (viewportIndicator) {
            const x = (this.viewBox.x - this.minimapBounds.x) * scaleX;
            const y = (this.viewBox.y - this.minimapBounds.y) * scaleY;
            const width = this.viewBox.width * scaleX;
            const height = this.viewBox.height * scaleY;
            
            viewportIndicator.setAttribute('x', Math.max(0, Math.min(minimapRect.width - width, x)));
            viewportIndicator.setAttribute('y', Math.max(0, Math.min(minimapRect.height - height, y)));
            viewportIndicator.setAttribute('width', Math.min(width, minimapRect.width));
            viewportIndicator.setAttribute('height', Math.min(height, minimapRect.height));
        }
        
        this.renderMinimapNodes();
    }

    renderMinimapNodes() {
        const existingMinimapNodes = this.minimap.querySelectorAll('.minimap-node');
        existingMinimapNodes.forEach(node => node.remove());
        
        const minimapRect = this.minimap.getBoundingClientRect();
        const scaleX = minimapRect.width / this.minimapBounds.width;
        const scaleY = minimapRect.height / this.minimapBounds.height;
        
        this.nodes.forEach(node => {
            const x = (node.x - this.minimapBounds.x) * scaleX;
            const y = (node.y - this.minimapBounds.y) * scaleY;
            
            if (x >= 0 && x <= minimapRect.width && y >= 0 && y <= minimapRect.height) {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('class', 'minimap-node');
                circle.setAttribute('cx', x);
                circle.setAttribute('cy', y);
                circle.setAttribute('r', 2);
                circle.setAttribute('fill', '#4CAF50');
                circle.setAttribute('opacity', '0.8');
                this.minimap.appendChild(circle);
            }
        });
    }

    onMinimapClick(e) {
        const rect = this.minimap.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const scaleX = this.minimapBounds.width / rect.width;
        const scaleY = this.minimapBounds.height / rect.height;
        
        const worldX = this.minimapBounds.x + (x * scaleX);
        const worldY = this.minimapBounds.y + (y * scaleY);
        
        this.viewBox.x = worldX - (this.viewBox.width / 2);
        this.viewBox.y = worldY - (this.viewBox.height / 2);
        
        this.updateViewBox();
    }

    toggleConnectMode() {
        this.isConnectMode = !this.isConnectMode;
        this.connectionStart = null;
        this.updateConnectModeButton();
    }

    updateConnectModeButton() {
        const button = document.getElementById('connect-mode');
        if (this.isConnectMode) {
            button.classList.add('active');
            button.setAttribute('data-tippy-content', 'Exit Connect Mode');
        } else {
            button.classList.remove('active');
            button.setAttribute('data-tippy-content', 'Connect Mode');
        }
    }

    handleConnectionClick(node) {
        if (!this.connectionStart) {
            this.connectionStart = node;
            this.highlightNode(node, 'connecting');
        } else if (this.connectionStart.id !== node.id) {
            this.createConnection(this.connectionStart, node);
            this.unhighlightNode(this.connectionStart);
            this.connectionStart = null;
        }
    }

    createConnection(fromNode, toNode) {
        const existingConnection = this.connections.find(c => 
            (c.from === fromNode.id && c.to === toNode.id) ||
            (c.from === toNode.id && c.to === fromNode.id)
        );
        
        if (existingConnection) {
            // If connection already exists, remove it (toggle behavior)
            this.deleteConnection(existingConnection.id);
        } else {
            // Create new connection
            const connection = {
                id: `conn_${Date.now()}`,
                from: fromNode.id,
                to: toNode.id
            };
            this.connections.push(connection);
            this.renderConnections();
        }
    }

    toggleNodeSelection(node) {
        if (this.selectedNodes.has(node.id)) {
            this.selectedNodes.delete(node.id);
            this.unhighlightNode(node);
        } else {
            this.selectedNodes.add(node.id);
            this.highlightNode(node, 'multi-selected');
        }
        this.selectedNode = null;
    }

    clearSelection() {
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) this.unhighlightNode(node);
        });
        this.selectedNodes.clear();
        if (this.selectedNode) {
            this.unhighlightNode(this.selectedNode);
            this.selectedNode = null;
        }
        if (this.connectionStart) {
            this.unhighlightNode(this.connectionStart);
            this.connectionStart = null;
        }
    }

    highlightNode(node, type = 'selected') {
        const circle = document.querySelector(`[data-node-id="${node.id}"] .node-circle`);
        if (circle) {
            circle.classList.remove('selected', 'multi-selected', 'connecting');
            circle.classList.add(type);
        }
    }

    unhighlightNode(node) {
        const circle = document.querySelector(`[data-node-id="${node.id}"] .node-circle`);
        if (circle) {
            circle.classList.remove('selected', 'multi-selected', 'connecting');
        }
    }

    deleteSelectedNodes() {
        const nodeIds = Array.from(this.selectedNodes);
        nodeIds.forEach(nodeId => {
            const node = this.nodes.find(n => n.id === nodeId);
            if (node) this.deleteNode(node);
        });
        this.selectedNodes.clear();
    }

    copySelectedNodes() {
        const selectedNodesList = Array.from(this.selectedNodes).map(nodeId => 
            this.nodes.find(n => n.id === nodeId)
        ).filter(node => node);
        
        if (selectedNodesList.length > 0) {
            this.clipboard = selectedNodesList.map(node => ({
                text: node.text,
                radius: node.radius
            }));
        }
    }

    pasteNodes() {
        if (this.clipboard.length > 0) {
            const centerX = this.viewBox.x + this.viewBox.width / 2;
            const centerY = this.viewBox.y + this.viewBox.height / 2;
            
            this.clipboard.forEach((nodeData, index) => {
                const offsetX = (index % 3) * 100;
                const offsetY = Math.floor(index / 3) * 100;
                this.addNode(centerX + offsetX, centerY + offsetY, nodeData.text);
            });
        }
    }

    deleteConnection(connectionId) {
        this.connections = this.connections.filter(c => c.id !== connectionId);
        // Remove control points for this connection
        this.connectionControlPoints.delete(connectionId);
        // Remove any visible control point handles
        document.querySelectorAll(`[data-connection-id="${connectionId}"]`).forEach(handle => handle.remove());
        this.renderConnections();
    }

    handleCurveClick(event, connectionId, pathElement) {
        // Get click position on the curve
        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Convert to world coordinates
        const worldX = this.viewBox.x + (clickX / rect.width) * this.viewBox.width;
        const worldY = this.viewBox.y + (clickY / rect.height) * this.viewBox.height;
        
        console.log('Curve clicked at:', {worldX, worldY, connectionId});
        
        // Get connection endpoints to avoid placing control points too close to them
        const connection = this.connections.find(c => c.id === connectionId);
        if (!connection) {
            console.error('Connection not found:', connectionId);
            return;
        }
        
        const fromNode = this.nodes.find(n => n.id === connection.from);
        const toNode = this.nodes.find(n => n.id === connection.to);
        
        if (!fromNode || !toNode) {
            console.error('Nodes not found for connection');
            return;
        }
        
        // Calculate actual connection endpoints (on node circumference)
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            const unitX = dx / distance;
            const unitY = dy / distance;
            const startX = fromNode.x + unitX * fromNode.radius;
            const startY = fromNode.y + unitY * fromNode.radius;
            const endX = toNode.x - unitX * toNode.radius;
            const endY = toNode.y - unitY * toNode.radius;
            
            // Check if click is too close to endpoints
            const startDistance = Math.sqrt(Math.pow(worldX - startX, 2) + Math.pow(worldY - startY, 2));
            const endDistance = Math.sqrt(Math.pow(worldX - endX, 2) + Math.pow(worldY - endY, 2));
            
            if (startDistance < 30 || endDistance < 30) {
                console.log('Click too close to connection endpoints, ignoring');
                return;
            }
        }
        
        // Initialize control points if they don't exist
        let controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData) {
            console.log('Initializing control points for connection:', connectionId);
            this.initializeControlPointsForConnection(connectionId);
            controlData = this.connectionControlPoints.get(connectionId);
        }
        
        if (!controlData) {
            console.error('Failed to initialize control points');
            return;
        }
        
        // Check if this connection is already selected (control points visible)
        const wasAlreadySelected = controlData.visible;
        
        // Check if clicking near existing control point to remove it (increased detection area)
        let clickedPointIndex = -1;
        for (let i = 0; i < controlData.points.length; i++) {
            const cp = controlData.points[i];
            const distance = Math.sqrt(
                Math.pow(worldX - cp.x, 2) + Math.pow(worldY - cp.y, 2)
            );
            if (distance < 25) { // Increased from 15 to 25 for easier deletion
                clickedPointIndex = i;
                break;
            }
        }
        
        if (!wasAlreadySelected) {
            // First click - just select the connection and show control points
            console.log('First click - selecting connection and showing control points');
            controlData.visible = true;
            
            // Hide all other control points first
            this.hideAllControlPoints();
            this.showControlPoints(connectionId);
            
            // Visual feedback for selection
            this.showTemporaryFeedback('Connection selected', worldX, worldY, '#38BDF8');
            
        } else if (clickedPointIndex >= 0) {
            // Already selected + clicking on control point = delete it
            console.log('Removing control point at index:', clickedPointIndex);
            
            // Visual feedback for deletion
            this.showTemporaryFeedback('Control point deleted', worldX, worldY, '#ff4444');
            
            // Remove control point
            this.removeControlPoint(connectionId, clickedPointIndex);
            
        } else {
            // Already selected + clicking on empty area = add control point
            console.log('Adding new control point at:', {worldX, worldY});
            
            // Visual feedback for addition
            this.showTemporaryFeedback('Control point added', worldX, worldY, '#44ff44');
            
            // Add new control point at click location
            this.addControlPoint(connectionId, worldX, worldY);
            
            // Show control points after addition
            this.hideAllControlPoints();
            this.showControlPoints(connectionId);
        }
    }

    initializeControlPointsForConnection(connectionId) {
        console.log('Initializing control points for connection:', connectionId);
        
        // Initialize control points for a connection that doesn't have them yet
        const connection = this.connections.find(c => c.id === connectionId);
        if (!connection) {
            console.error('Connection not found:', connectionId);
            return;
        }
        
        const fromNode = this.nodes.find(n => n.id === connection.from);
        const toNode = this.nodes.find(n => n.id === connection.to);
        
        if (!fromNode || !toNode) {
            console.error('Nodes not found for connection:', connection);
            return;
        }
        
        // Calculate default control points
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        const angle = Math.atan2(dy, dx);
        const perpAngle = angle + Math.PI / 2;
        const curvature = Math.min(distance * 0.3, 60);
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        const startX = fromNode.x + unitX * fromNode.radius;
        const startY = fromNode.y + unitY * fromNode.radius;
        
        const cp1X = startX + Math.cos(angle) * (distance * 0.33) + Math.cos(perpAngle) * curvature;
        const cp1Y = startY + Math.sin(angle) * (distance * 0.33) + Math.sin(perpAngle) * curvature;
        const cp2X = startX + Math.cos(angle) * (distance * 0.67) + Math.cos(perpAngle) * curvature;
        const cp2Y = startY + Math.sin(angle) * (distance * 0.67) + Math.sin(perpAngle) * curvature;
        
        const controlData = {
            points: [
                { id: 'cp1', x: cp1X, y: cp1Y },
                { id: 'cp2', x: cp2X, y: cp2Y }
            ],
            visible: false
        };
        
        this.connectionControlPoints.set(connectionId, controlData);
        console.log('Control points initialized:', controlData);
    }

    addControlPoint(connectionId, x, y) {
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData) {
            console.error('No control data found for connection:', connectionId);
            return;
        }
        
        // Generate unique ID for new control point
        const newId = `cp${controlData.points.length + 1}_${Date.now()}`;
        
        // Add new control point
        controlData.points.push({ id: newId, x: x, y: y });
        controlData.visible = true; // Ensure they're visible
        
        console.log(`Added control point. Total: ${controlData.points.length}`, controlData.points);
        this.updateCurveTypeInfo(connectionId, controlData.points.length);
        
        // Re-render the connection with updated control points
        this.renderConnections();
    }

    removeControlPoint(connectionId, pointIndex) {
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData || pointIndex < 0 || pointIndex >= controlData.points.length) return;
        
        // Remove the control point
        controlData.points.splice(pointIndex, 1);
        
        // Re-render the connection with updated control points
        this.renderConnections();
        
        // If control points are visible, update the display
        if (controlData.visible) {
            this.showControlPoints(connectionId);
        }
        
        console.log(`Removed control point. Total: ${controlData.points.length}`);
        this.updateCurveTypeInfo(connectionId, controlData.points.length);
    }

    updateCurveTypeInfo(connectionId, numPoints) {
        let curveType;
        if (numPoints === 0) {
            curveType = 'Straight Line';
        } else if (numPoints === 1) {
            curveType = 'Quadratic Bézier (2nd degree)';
        } else if (numPoints === 2) {
            curveType = 'Cubic Bézier (3rd degree)';
        } else {
            curveType = `Complex Curve (${numPoints} control points)`;
        }
        
        console.log(`Connection ${connectionId}: ${curveType}`);
    }

    toggleConnectionControlPoints(connectionId) {
        if (!this.connectionControlPoints.has(connectionId)) {
            this.initializeControlPointsForConnection(connectionId);
        }
        
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData) return;
        
        controlData.visible = !controlData.visible;
        
        // Hide all other control points first
        this.hideAllControlPoints();
        
        if (controlData.visible) {
            this.showControlPoints(connectionId);
        }
    }

    hideAllControlPoints() {
        // Set all control points to invisible
        this.connectionControlPoints.forEach(controlData => {
            controlData.visible = false;
        });
        // Remove all control point handles from DOM
        document.querySelectorAll('.control-point-handle').forEach(handle => handle.remove());
    }

    deselectAllConnections() {
        console.log('Deselecting all connections');
        this.hideAllControlPoints();
        // Re-render connections to update their visual state
        this.renderConnections();
    }

    showControlPoints(connectionId) {
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData) {
            console.error('No control data found for showing points:', connectionId);
            return;
        }
        
        console.log('Showing control points for connection:', connectionId, controlData.points);
        
        // Remove any existing handles for this connection first
        document.querySelectorAll(`[data-connection-id="${connectionId}"]`).forEach(handle => {
            if (handle.classList.contains('control-point-handle')) {
                handle.remove();
            }
        });
        
        // Create draggable handles for each control point
        controlData.points.forEach((point, index) => {
            console.log(`Creating handle for point ${index + 1}:`, point);
            this.createControlPointHandle(
                connectionId, 
                point.id, 
                point.x, 
                point.y, 
                (index + 1).toString()
            );
        });
    }

    createControlPointHandle(connectionId, pointId, x, y, label) {
        console.log(`Creating control point handle at (${x}, ${y}) with label ${label}`);
        
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handle.setAttribute('class', 'control-point-handle');
        handle.setAttribute('data-connection-id', connectionId);
        handle.setAttribute('data-point-id', pointId);
        handle.setAttribute('transform', `translate(${x}, ${y})`);
        
        // Control point circle - make it larger and more visible
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '10'); // Increased from 8 for better interaction
        circle.setAttribute('fill', '#ff6b35');
        circle.setAttribute('stroke', '#fff');
        circle.setAttribute('stroke-width', '3');
        circle.setAttribute('class', 'control-point-circle');
        
        // Add hover effects
        circle.style.transition = 'all 0.2s ease';
        circle.style.cursor = 'move';
        
        // Label text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '4'); // Adjusted for larger circle
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'white');
        text.setAttribute('font-size', '10'); // Increased from 8
        text.setAttribute('font-weight', 'bold');
        text.textContent = label;
        
        handle.appendChild(circle);
        handle.appendChild(text);
        
        // Add hover effects to the handle group
        handle.addEventListener('mouseenter', () => {
            circle.setAttribute('r', '12');
            circle.setAttribute('fill', '#ff8c00');
            circle.style.filter = 'drop-shadow(0 0 8px rgba(255, 107, 53, 0.6))';
        });
        
        handle.addEventListener('mouseleave', () => {
            circle.setAttribute('r', '10');
            circle.setAttribute('fill', '#ff6b35');
            circle.style.filter = 'none';
        });
        
        // Add to control layer (above everything else)
        this.controlLayer.appendChild(handle);
        
        console.log('Control point handle created and added to canvas');
        
        // Add drag functionality
        this.addControlPointDragBehavior(handle, connectionId, pointId);
        
        // TEMPORARY: Also add the handle to a global array for debugging
        if (!window.debugControlHandles) window.debugControlHandles = [];
        window.debugControlHandles.push(handle);
        console.log('Total control handles created:', window.debugControlHandles.length);
    }
    
    // TEMPORARY: Add a simple function to test control point creation
    createTestControlPoint(x = 500, y = 300) {
        console.log('Creating test control point at', x, y);
        
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handle.setAttribute('class', 'test-control-point');
        handle.setAttribute('transform', `translate(${x}, ${y})`);
        
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', '12');
        circle.setAttribute('fill', 'lime');
        circle.setAttribute('stroke', 'black');
        circle.setAttribute('stroke-width', '2');
        
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '4');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', 'black');
        text.setAttribute('font-size', '10');
        text.setAttribute('font-weight', 'bold');
        text.textContent = 'TEST';
        
        handle.appendChild(circle);
        handle.appendChild(text);
        this.controlLayer.appendChild(handle);
        
        console.log('Test control point created and should be visible');
        return handle;
    }

    // TEMPORARY: Test function to create a connection for testing clicks
    createTestConnection() {
        console.log('Creating test connection for click testing');
        
        // Create two test nodes if they don't exist
        let node1 = this.nodes.find(n => n.text === 'Test1');
        let node2 = this.nodes.find(n => n.text === 'Test2');
        
        if (!node1) {
            node1 = {
                id: 'test-node-1',
                x: 300,
                y: 200,
                text: 'Test1',
                radius: 50
            };
            this.nodes.push(node1);
            this.renderNode(node1);
        }
        
        if (!node2) {
            node2 = {
                id: 'test-node-2', 
                x: 600,
                y: 300,
                text: 'Test2',
                radius: 50
            };
            this.nodes.push(node2);
            this.renderNode(node2);
        }
        
        // Create test connection
        const connection = {
            id: 'test-connection-1',
            from: node1.id,
            to: node2.id
        };
        
        this.connections.push(connection);
        this.renderConnections();
        
        console.log('Test connection created between Test1 and Test2');
        console.log('Try clicking on the connection line!');
    }

    addControlPointDragBehavior(handle, connectionId, pointId) {
        let isDragging = false;
        let dragStartPos = { x: 0, y: 0 };
        let animationFrameId = null;
        let pendingUpdate = false;
        
        const updateCurve = () => {
            if (pendingUpdate) {
                this.renderConnections();
                pendingUpdate = false;
            }
            animationFrameId = null;
        };
        
        const requestCurveUpdate = () => {
            if (!animationFrameId) {
                pendingUpdate = true;
                animationFrameId = requestAnimationFrame(updateCurve);
            }
        };
        
        handle.addEventListener('mousedown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            isDragging = true;
            
            // Store drag start position for smooth interaction
            dragStartPos.x = e.clientX;
            dragStartPos.y = e.clientY;
            
            handle.style.cursor = 'grabbing';
            
            // Enhanced visual feedback during drag
            const circle = handle.querySelector('.control-point-circle');
            if (circle) {
                circle.setAttribute('r', '15');
                circle.style.filter = 'drop-shadow(0 0 15px rgba(255, 107, 53, 1))';
                circle.setAttribute('fill', '#ff8c00');
            }
            
            // Add dragging class for additional CSS effects
            handle.classList.add('dragging');
        });
        
        document.addEventListener('mousemove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Convert to world coordinates
            const worldX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
            const worldY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
            
            // Update control point position
            const controlData = this.connectionControlPoints.get(connectionId);
            const point = controlData.points.find(p => p.id === pointId);
            if (point) {
                point.x = worldX;
                point.y = worldY;
                
                // Update handle position immediately for ultra-smooth interaction
                handle.setAttribute('transform', `translate(${worldX}, ${worldY})`);
                
                // Request curve update using requestAnimationFrame for smooth performance
                requestCurveUpdate();
            }
        });
        
        document.addEventListener('mouseup', (e) => {
            if (isDragging) {
                isDragging = false;
                handle.style.cursor = 'move';
                
                // Reset visual feedback with smooth transition
                const circle = handle.querySelector('.control-point-circle');
                if (circle) {
                    circle.style.transition = 'all 0.3s ease';
                    circle.setAttribute('r', '10');
                    circle.style.filter = 'none';
                    circle.setAttribute('fill', '#ff6b35');
                    
                    // Remove transition after animation
                    setTimeout(() => {
                        if (circle.style) {
                            circle.style.transition = 'all 0.2s ease';
                        }
                    }, 300);
                }
                
                // Remove dragging class
                handle.classList.remove('dragging');
                
                // Final render to ensure accuracy
                this.renderConnections();
                
                // Cancel any pending animation frame
                if (animationFrameId) {
                    cancelAnimationFrame(animationFrameId);
                    animationFrameId = null;
                }
            }
        });
        
        // Prevent default drag behavior
        handle.addEventListener('dragstart', (e) => e.preventDefault());
        
        handle.style.cursor = 'move';
    }

    showTemporaryFeedback(message, x, y, color = '#38BDF8') {
        // Create temporary feedback element
        const feedback = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        feedback.setAttribute('class', 'temporary-feedback');
        feedback.setAttribute('transform', `translate(${x}, ${y})`);
        
        // Background circle
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('r', '20');
        bg.setAttribute('fill', color);
        bg.setAttribute('fill-opacity', '0.2');
        bg.setAttribute('stroke', color);
        bg.setAttribute('stroke-width', '2');
        
        // Text
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('x', '0');
        text.setAttribute('y', '-25');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('fill', color);
        text.setAttribute('font-size', '12');
        text.setAttribute('font-weight', 'bold');
        text.textContent = message;
        
        feedback.appendChild(bg);
        feedback.appendChild(text);
        this.controlLayer.appendChild(feedback);
        
        // Animate and remove
        let scale = 1;
        let opacity = 1;
        const animate = () => {
            scale += 0.05;
            opacity -= 0.05;
            
            if (opacity <= 0) {
                feedback.remove();
                return;
            }
            
            feedback.setAttribute('transform', `translate(${x}, ${y}) scale(${scale})`);
            feedback.style.opacity = opacity;
            
            requestAnimationFrame(animate);
        };
        
        requestAnimationFrame(animate);
    }

    updateControlPointsForMovedNodes() {
        // Update control points when nodes move to maintain curve proportions
        this.connectionControlPoints.forEach((controlData, connectionId) => {
            const connection = this.connections.find(c => c.id === connectionId);
            if (!connection) return;
            
            const fromNode = this.nodes.find(n => n.id === connection.from);
            const toNode = this.nodes.find(n => n.id === connection.to);
            
            if (!fromNode || !toNode) return;
            
            // Calculate current connection parameters
            const dx = toNode.x - fromNode.x;
            const dy = toNode.y - fromNode.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            
            if (distance < 1) return;
            
            // Calculate the center of the new connection
            const centerX = (fromNode.x + toNode.x) / 2;
            const centerY = (fromNode.y + toNode.y) / 2;
            
            // For each control point, apply a proportional shift to maintain curve shape
            controlData.points.forEach(point => {
                // Simple proportional shift - you could make this more sophisticated
                const shiftFactor = 0.5; // How much control points follow the nodes
                
                // Calculate current offset from connection center
                const currentCenterX = controlData.points.reduce((sum, p) => sum + p.x, 0) / controlData.points.length;
                const currentCenterY = controlData.points.reduce((sum, p) => sum + p.y, 0) / controlData.points.length;
                
                // Shift towards new center
                const shiftX = (centerX - currentCenterX) * shiftFactor;
                const shiftY = (centerY - currentCenterY) * shiftFactor;
                
                point.x += shiftX;
                point.y += shiftY;
            });
            
            // Update control point handles if they're visible
            if (controlData.visible) {
                controlData.points.forEach(point => {
                    const handle = document.querySelector(`[data-connection-id="${connectionId}"][data-point-id="${point.id}"]`);
                    if (handle) {
                        handle.setAttribute('transform', `translate(${point.x}, ${point.y})`);
                    }
                });
            }
        });
    }


    createCoggleConnectionPath(startX, startY, endX, endY, fromNode, toNode, connectionId = null) {
        // Check if this connection has custom control points
        if (connectionId && this.connectionControlPoints.has(connectionId)) {
            const controlData = this.connectionControlPoints.get(connectionId);
            return this.generateCurveFromControlPoints(startX, startY, endX, endY, controlData.points);
        }
        
        // Calculate the vector from start to end
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 1) {
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        }
        
        // Calculate the angle of the connection
        const angle = Math.atan2(dy, dx);
        
        // Control point distance for proper Bézier curves
        const controlDistance = Math.min(distance * 0.4, 100);
        
        // Create curved Bézier by offsetting control points perpendicular to the connection
        // Calculate perpendicular direction (rotated 90 degrees)
        const perpAngle = angle + Math.PI / 2;
        const curvature = Math.min(distance * 0.3, 60); // How much the curve bends
        
        // First control point: 1/3 along connection + perpendicular offset
        const cp1BaseX = startX + Math.cos(angle) * (distance * 0.33);
        const cp1BaseY = startY + Math.sin(angle) * (distance * 0.33);
        const cp1X = cp1BaseX + Math.cos(perpAngle) * curvature;
        const cp1Y = cp1BaseY + Math.sin(perpAngle) * curvature;
        
        // Second control point: 2/3 along connection + same perpendicular offset
        const cp2BaseX = startX + Math.cos(angle) * (distance * 0.67);
        const cp2BaseY = startY + Math.sin(angle) * (distance * 0.67);
        const cp2X = cp2BaseX + Math.cos(perpAngle) * curvature;
        const cp2Y = cp2BaseY + Math.sin(perpAngle) * curvature;
        
        // Store default control points for this connection if not already stored
        if (connectionId && !this.connectionControlPoints.has(connectionId)) {
            this.connectionControlPoints.set(connectionId, {
                points: [
                    { id: 'cp1', x: cp1X, y: cp1Y },
                    { id: 'cp2', x: cp2X, y: cp2Y }
                ],
                visible: false
            });
        }
        
        // Create proper cubic Bézier curve
        return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
    }

    generateCurveFromControlPoints(startX, startY, endX, endY, controlPoints) {
        const numPoints = controlPoints.length;
        
        if (numPoints === 0) {
            // Straight line
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        } else if (numPoints === 1) {
            // Quadratic Bézier curve (2nd degree)
            const cp = controlPoints[0];
            return `M ${startX} ${startY} Q ${cp.x} ${cp.y} ${endX} ${endY}`;
        } else if (numPoints === 2) {
            // Cubic Bézier curve (3rd degree)
            const cp1 = controlPoints[0];
            const cp2 = controlPoints[1];
            return `M ${startX} ${startY} C ${cp1.x} ${cp1.y}, ${cp2.x} ${cp2.y}, ${endX} ${endY}`;
        } else {
            // Multiple control points - create smooth path using cubic Bézier segments
            let path = `M ${startX} ${startY}`;
            
            if (numPoints === 3) {
                // For 3 points, create a smooth curve through all points
                const cp1 = controlPoints[0];
                const cp2 = controlPoints[1];
                const cp3 = controlPoints[2];
                
                // Create two connected cubic Bézier segments
                const midX = (cp1.x + cp2.x) / 2;
                const midY = (cp1.y + cp2.y) / 2;
                
                path += ` C ${cp1.x} ${cp1.y}, ${midX} ${midY}, ${cp2.x} ${cp2.y}`;
                path += ` S ${cp3.x} ${cp3.y}, ${endX} ${endY}`;
            } else {
                // For more than 3 points, create a smooth spline
                for (let i = 0; i < numPoints; i++) {
                    const cp = controlPoints[i];
                    if (i === 0) {
                        path += ` C ${cp.x} ${cp.y},`;
                    } else if (i === numPoints - 1) {
                        path += ` ${cp.x} ${cp.y}, ${endX} ${endY}`;
                    } else {
                        path += ` ${cp.x} ${cp.y},`;
                    }
                }
            }
            
            return path;
        }
    }

    startDragConnection(node, event, startX = null, startY = null) {
        console.log('startDragConnection called', {node, startX, startY});
        console.log('dragConnectionLine element:', this.dragConnectionLine);
        this.isDraggingConnection = true;
        this.dragConnectionStart = node;
        this.dragConnectionLine.style.display = 'block';
        console.log('Set dragConnectionLine display to block');
        
        // Highlight the start node
        this.highlightNode(node, 'connecting');
        
        // Store the exact click point if provided
        if (startX !== null && startY !== null) {
            this.dragConnectionStartPoint.x = startX;
            this.dragConnectionStartPoint.y = startY;
        } else {
            // Fallback to node center
            this.dragConnectionStartPoint.x = node.x;
            this.dragConnectionStartPoint.y = node.y;
        }
        
        // Initialize the connection line
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;
        const worldMouseX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
        const worldMouseY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
        
        this.updateDragConnection(worldMouseX, worldMouseY);
    }

    updateDragConnection(mouseX, mouseY, event = null) {
        if (!this.isDraggingConnection || !this.dragConnectionStart) return;
        
        // Use the stored start point (click location on edge)
        const startX = this.dragConnectionStartPoint.x;
        const startY = this.dragConnectionStartPoint.y;
        
        // Calculate distance and create Coggle-style curved path
        const dx = mouseX - startX;
        const dy = mouseY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance > 0) {
            // Create a temporary target "node" at mouse position for consistent curve calculation
            const mouseNode = { x: mouseX, y: mouseY };
            
            // Use the same Coggle-style path generation as rendered connections
            const pathData = this.createCoggleConnectionPath(startX, startY, mouseX, mouseY, this.dragConnectionStart, mouseNode);
            this.dragConnectionLine.setAttribute('d', pathData);
        }
        
        // Check if we're over a node or empty space
        let targetNode = null;
        if (event) {
            targetNode = this.getNodeUnderMouse(event);
        }
        
        const indicator = document.getElementById('add-node-indicator');
        if (targetNode && targetNode.id !== this.dragConnectionStart.id) {
            // Over a valid target node - hide indicator
            if (indicator) {
                indicator.style.display = 'none';
            }
        } else {
            // Over empty space - show "click to add" indicator
            if (indicator) {
                indicator.setAttribute('transform', `translate(${mouseX}, ${mouseY})`);
                indicator.style.display = 'block';
                const circle = indicator.querySelector('circle');
                if (circle) circle.style.animation = 'pulse 1.5s infinite';
            }
        }
    }

    finishDragConnection(event) {
        console.log('finishDragConnection called', {isDraggingConnection: this.isDraggingConnection, dragConnectionStart: this.dragConnectionStart});
        if (!this.isDraggingConnection || !this.dragConnectionStart) return;
        
        // Check if we're over a node
        const targetNode = this.getNodeUnderMouse(event);
        console.log('Target node:', targetNode);
        
        if (targetNode && targetNode.id !== this.dragConnectionStart.id) {
            // Create connection to existing node immediately
            this.createConnection(this.dragConnectionStart, targetNode);
            this.cleanupDragConnection();
        } else {
            // Over empty space - create a temporary connection that persists
            console.log('Dropped on empty space, creating persistent connection');
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = event.clientX - rect.left;
            const mouseY = event.clientY - rect.top;
            const worldX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
            const worldY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
            
            // Create a temporary "ghost" node at the drop position
            const tempEndNode = {
                id: 'temp_connection_end',
                x: worldX,
                y: worldY,
                radius: 0 // Invisible node
            };
            
            // Create a temporary connection
            const tempConnection = {
                id: 'temp_connection',
                from: this.dragConnectionStart.id,
                to: tempEndNode.id,
                isTemporary: true
            };
            
            // Add temporary node and connection to arrays
            this.nodes.push(tempEndNode);
            this.connections.push(tempConnection);
            
            // Store connection info for when real node is created
            this.pendingConnection = {
                startNode: this.dragConnectionStart,
                endX: worldX,
                endY: worldY,
                tempConnection: tempConnection,
                tempNode: tempEndNode
            };
            
            // Re-render all connections (this will include our temporary one)
            this.renderConnections();
            console.log('Created temporary connection and re-rendered');
            
            // Show the add-node indicator
            const indicator = document.getElementById('add-node-indicator');
            if (indicator) {
                indicator.setAttribute('transform', `translate(${worldX}, ${worldY})`);
                indicator.style.display = 'block';
                const circle = indicator.querySelector('circle');
                if (circle) circle.style.animation = 'pulse 1.5s infinite';
            }
                
            // Set up persistent event handlers
            this.setupPendingConnectionHandlers();
            
            // Keep drag connection state but reset dragging flag
            this.isDraggingConnection = false;
        }
    }

    updateDragConnectionToPosition(endX, endY) {
        console.log('updateDragConnectionToPosition called', {endX, endY, dragConnectionStart: this.dragConnectionStart});
        if (!this.dragConnectionStart) return;
        
        // Use the stored start point (click location on edge)
        const startX = this.dragConnectionStartPoint.x;
        const startY = this.dragConnectionStartPoint.y;
        console.log('Start point:', {startX, startY});
        
        // Create a temporary target "node" at the end position for consistent curve calculation
        const endNode = { x: endX, y: endY };
        
        // Use the original Coggle-style path generation
        const pathData = this.createCoggleConnectionPath(startX, startY, endX, endY, this.dragConnectionStart, endNode);
        this.dragConnectionLine.setAttribute('d', pathData);
        console.log('Updated dragConnectionLine d attribute');
    }

    setupPendingConnectionHandlers() {
        // Remove any existing handlers
        this.removePendingConnectionHandlers();
        
        // Click to add node handler
        this.addNodeClickHandler = (e) => {
            const indicator = document.getElementById('add-node-indicator');
            if (e.target.closest('#add-node-indicator')) {
                e.stopPropagation();
                this.createPendingNode();
            } else if (e.target.closest('.context-menu')) {
                // Don't cancel on context menu clicks
                return;
            } else if (e.target.closest('.node')) {
                // Don't cancel on node clicks - allow node interaction
                return;
            } else {
                // Only cancel on clicks far from the connection area
                const rect = this.canvas.getBoundingClientRect();
                const clickX = e.clientX - rect.left;
                const clickY = e.clientY - rect.top;
                const worldClickX = this.viewBox.x + (clickX / rect.width) * this.viewBox.width;
                const worldClickY = this.viewBox.y + (clickY / rect.height) * this.viewBox.height;
                
                // Calculate distance from click to connection endpoint
                const endX = this.pendingConnection.endX;
                const endY = this.pendingConnection.endY;
                const distanceToEnd = Math.sqrt((worldClickX - endX) ** 2 + (worldClickY - endY) ** 2);
                
                // Only cancel if click is more than 100 pixels from the endpoint
                if (distanceToEnd > 100) {
                    console.log('Clicking far from connection, canceling', {distance: distanceToEnd});
                    this.cancelPendingConnection();
                } else {
                    console.log('Click near connection, keeping it active', {distance: distanceToEnd});
                }
            }
        };
        
        // Escape key handler
        this.escapeHandler = (e) => {
            if (e.key === 'Escape') {
                this.cancelPendingConnection();
            }
        };
        
        // Add a small delay before enabling the click handler to prevent immediate cancellation
        console.log('Setting up pending connection handlers with delay');
        setTimeout(() => {
            document.addEventListener('click', this.addNodeClickHandler);
            console.log('Click handler activated after delay');
        }, 100); // 100ms delay
        
        document.addEventListener('keydown', this.escapeHandler);
    }

    createPendingNode() {
        if (!this.pendingConnection) return;
        
        // Remove temporary connection and node first
        if (this.pendingConnection.tempConnection) {
            this.connections = this.connections.filter(c => c.id !== this.pendingConnection.tempConnection.id);
        }
        if (this.pendingConnection.tempNode) {
            this.nodes = this.nodes.filter(n => n.id !== this.pendingConnection.tempNode.id);
        }
        
        // Create new real node at stored position
        this.addNode(this.pendingConnection.endX, this.pendingConnection.endY, 'New Node');
        
        // Get the newly created node
        const createdNode = this.nodes[this.nodes.length - 1];
        
        // Connect to it with a real connection (using existing createConnection logic)
        this.createConnection(this.pendingConnection.startNode, createdNode);
        
        this.cancelPendingConnection();
    }

    cancelPendingConnection() {
        // Remove temporary connection and node if they exist
        if (this.pendingConnection && this.pendingConnection.tempConnection) {
            this.connections = this.connections.filter(c => c.id !== this.pendingConnection.tempConnection.id);
        }
        if (this.pendingConnection && this.pendingConnection.tempNode) {
            this.nodes = this.nodes.filter(n => n.id !== this.pendingConnection.tempNode.id);
        }
        
        // Re-render to remove the temporary connection
        if (this.pendingConnection) {
            this.renderConnections();
        }
        
        this.cleanupDragConnection();
        this.removePendingConnectionHandlers();
        this.pendingConnection = null;
    }

    removePendingConnectionHandlers() {
        if (this.addNodeClickHandler) {
            document.removeEventListener('click', this.addNodeClickHandler);
            this.addNodeClickHandler = null;
        }
        if (this.escapeHandler) {
            document.removeEventListener('keydown', this.escapeHandler);
            this.escapeHandler = null;
        }
    }

    cleanupDragConnection() {
        // Clean up visual elements
        this.dragConnectionLine.style.display = 'none';
        // Restore original drag connection styling
        this.dragConnectionLine.setAttribute('stroke', '#3498db');
        this.dragConnectionLine.setAttribute('stroke-width', '3');
        this.dragConnectionLine.setAttribute('stroke-dasharray', '8,4');
        this.hideAddNodeIndicator();
        if (this.dragConnectionStart) {
            this.unhighlightNode(this.dragConnectionStart);
        }
        this.isDraggingConnection = false;
        this.dragConnectionStart = null;
    }

    getNodeUnderMouse(event) {
        const elements = document.elementsFromPoint(event.clientX, event.clientY);
        for (let element of elements) {
            const nodeGroup = element.closest('.node');
            if (nodeGroup) {
                const nodeId = nodeGroup.getAttribute('data-node-id');
                return this.nodes.find(n => n.id === nodeId);
            }
        }
        return null;
    }


    hideAddNodeIndicator() {
        const indicator = document.getElementById('add-node-indicator');
        if (indicator) {
            indicator.style.display = 'none';
            const circle = indicator.querySelector('circle');
            circle.style.animation = '';
        }
    }


    updateSelectionRectangle(startX, startY, endX, endY) {
        const x = Math.min(startX, endX);
        const y = Math.min(startY, endY);
        const width = Math.abs(endX - startX);
        const height = Math.abs(endY - startY);
        
        this.selectionRectangle.setAttribute('x', x);
        this.selectionRectangle.setAttribute('y', y);
        this.selectionRectangle.setAttribute('width', width);
        this.selectionRectangle.setAttribute('height', height);
    }

    finishSelection() {
        const rectBounds = this.getSelectionRectangleBounds();
        const selectedNodes = this.getNodesInRectangle(rectBounds);
        
        if (!this.isConnectMode) {
            this.clearSelection();
            
            selectedNodes.forEach(node => {
                this.selectedNodes.add(node.id);
                this.highlightNode(node, 'multi-selected');
            });
        }
        
        this.selectionRectangle.style.display = 'none';
    }

    getSelectionRectangleBounds() {
        const rect = this.selectionRectangle;
        return {
            x: parseFloat(rect.getAttribute('x')),
            y: parseFloat(rect.getAttribute('y')),
            width: parseFloat(rect.getAttribute('width')),
            height: parseFloat(rect.getAttribute('height'))
        };
    }

    getNodesInRectangle(rectBounds) {
        return this.nodes.filter(node => {
            const nodeRight = node.x + node.radius;
            const nodeLeft = node.x - node.radius;
            const nodeBottom = node.y + node.radius;
            const nodeTop = node.y - node.radius;
            
            const rectRight = rectBounds.x + rectBounds.width;
            const rectBottom = rectBounds.y + rectBounds.height;
            
            return !(nodeLeft > rectRight || 
                     nodeRight < rectBounds.x || 
                     nodeTop > rectBottom || 
                     nodeBottom < rectBounds.y);
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const mindMap = new MindMap();

    tippy('[data-tippy-content]', {
        animation: 'scale-subtle',
        theme: 'translucent',
    });
});