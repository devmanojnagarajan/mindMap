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
            } else if (e.key === ' ') {
                e.preventDefault();
                this.isSpacePressed = true;
            } else if (e.ctrlKey && e.key === 'c') {
                e.preventDefault();
                this.copySelectedNodes();
            } else if (e.ctrlKey && e.key === 'v') {
                e.preventDefault();
                this.pasteNodes();
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
        this.canvas.appendChild(group);

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
                    
                    // Create curved path for more elegant connections
                    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
                    path.setAttribute('class', 'connection-line');
                    path.setAttribute('data-connection-id', connection.id);
                    
                    // Create Coggle-style Bézier curve with proper control points
                    const pathData = this.createCoggleConnectionPath(startX, startY, endX, endY, fromNode, toNode);
                    path.setAttribute('d', pathData);
                    
                    // Add click handler for deletion
                    path.addEventListener('click', (e) => {
                        if (e.ctrlKey || e.altKey) {
                            e.stopPropagation();
                            this.deleteConnection(connection.id);
                        }
                    });
                    
                    // Add hover effect with tooltip
                    path.addEventListener('mouseenter', (e) => {
                        path.style.strokeWidth = '4';
                    });
                    
                    path.addEventListener('mouseleave', (e) => {
                        path.style.strokeWidth = '2';
                    });
                    
                    this.canvas.insertBefore(path, this.canvas.firstChild);
                }
            }
        });
    }

    onMouseDown(e) {
        if (!e.target.closest('.node')) {
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
    }

    renderAll() {
        this.canvas.innerHTML = this.canvas.querySelector('defs').outerHTML;
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
        this.renderConnections();
    }

    createCoggleConnectionPath(startX, startY, endX, endY, fromNode, toNode) {
        // Calculate the vector from start to end
        const dx = endX - startX;
        const dy = endY - startY;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance < 1) {
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        }
        
        // Calculate the angle of the connection
        const angle = Math.atan2(dy, dx);
        
        // Control point distance - longer for distant nodes, shorter for close nodes
        const controlDistance = Math.min(distance * 0.4, 150);
        
        // Calculate tangent directions for organic curves
        // From node: tangent pointing outward from center
        const fromCenterDx = startX - fromNode.x;
        const fromCenterDy = startY - fromNode.y;
        const fromCenterDistance = Math.sqrt(fromCenterDx * fromCenterDx + fromCenterDy * fromCenterDy);
        
        let fromTangentX, fromTangentY;
        if (fromCenterDistance > 0) {
            fromTangentX = (fromCenterDx / fromCenterDistance) * controlDistance;
            fromTangentY = (fromCenterDy / fromCenterDistance) * controlDistance;
        } else {
            fromTangentX = Math.cos(angle) * controlDistance;
            fromTangentY = Math.sin(angle) * controlDistance;
        }
        
        // To node: tangent pointing toward center
        const toCenterDx = endX - toNode.x;
        const toCenterDy = endY - toNode.y;
        const toCenterDistance = Math.sqrt(toCenterDx * toCenterDx + toCenterDy * toCenterDy);
        
        let toTangentX, toTangentY;
        if (toCenterDistance > 0) {
            toTangentX = -(toCenterDx / toCenterDistance) * controlDistance;
            toTangentY = -(toCenterDy / toCenterDistance) * controlDistance;
        } else {
            toTangentX = -Math.cos(angle) * controlDistance;
            toTangentY = -Math.sin(angle) * controlDistance;
        }
        
        // Apply some organic variation based on node positions
        const organicFactor = 0.3;
        const organicVariationX = Math.sin(fromNode.x * 0.01 + toNode.y * 0.01) * controlDistance * organicFactor;
        const organicVariationY = Math.cos(fromNode.y * 0.01 + toNode.x * 0.01) * controlDistance * organicFactor;
        
        // Calculate control points
        const cp1X = startX + fromTangentX + organicVariationX;
        const cp1Y = startY + fromTangentY + organicVariationY;
        const cp2X = endX + toTangentX - organicVariationX;
        const cp2Y = endY + toTangentY - organicVariationY;
        
        // Create cubic Bézier curve (more sophisticated than quadratic)
        return `M ${startX} ${startY} C ${cp1X} ${cp1Y}, ${cp2X} ${cp2Y}, ${endX} ${endY}`;
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
        
        // TEMPORARY: Use simple straight line for testing
        const simplePathData = `M ${startX} ${startY} L ${endX} ${endY}`;
        console.log('Using simple path data for testing:', simplePathData);
        this.dragConnectionLine.setAttribute('d', simplePathData);
        
        // Original Coggle-style path (commented out for testing):
        // const pathData = this.createCoggleConnectionPath(startX, startY, endX, endY, this.dragConnectionStart, endNode);
        // console.log('Generated path data:', pathData);
        // this.dragConnectionLine.setAttribute('d', pathData);
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
        // Connect to it with a real connection
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