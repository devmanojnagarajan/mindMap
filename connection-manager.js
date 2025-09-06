/**
 * Connection Manager - Handles all connection-related functionality
 * Features:
 * - Connection creation and deletion
 * - Control points for curve manipulation
 * - Smooth animations and interactions
 * - Efficient rendering and event handling
 */

class ConnectionManager {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.canvas = mindMap.canvas;
        this.connectionLayer = mindMap.connectionLayer;
        this.controlLayer = mindMap.controlLayer;
        this.viewBox = mindMap.viewBox;
        
        // Connection storage
        this.connections = new Map();
        this.controlPoints = new Map();
        this.selectedConnection = null; // Explicitly set to null
        
        // Drag state
        this.isDragging = false;
        this.dragTarget = null;
        
        // Performance optimization
        this.animationFrameId = null;
        this.pendingRenders = new Set();
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupGlobalEventHandlers();
        
        // Ensure gradients are ready
        this.ensureGradientsReady();
        
        // Ensure no connections are selected by default
        this.deselectAllConnections();
    }
    
    ensureGradientsReady() {
        // Check if gradients exist in DOM, if not wait a bit
        const connectionGradient = document.getElementById('connectionGradient');
        if (!connectionGradient) {
            console.warn('⚠️ Connection gradient not found, waiting for DOM to be ready...');
            setTimeout(() => this.ensureGradientsReady(), 50);
            return false;
        }
        return true;
    }
    
    setupEventListeners() {
        // Canvas background clicks for deselecting
        this.canvas.addEventListener('click', this.handleCanvasClick.bind(this));
        
        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeydown.bind(this));
    }
    
    setupGlobalEventHandlers() {
        // Global mouse events for dragging
        document.addEventListener('mousemove', this.handleGlobalMouseMove.bind(this));
        document.addEventListener('mouseup', this.handleGlobalMouseUp.bind(this));
    }
    
    handleCanvasClick(e) {
        // Only deselect when clicking canvas background
        if (e.target === this.canvas || e.target.id === 'grid-background') {
            if (!this.isClickingInteractiveElement(e)) {
                this.deselectAllConnections();
            }
        }
    }
    
    isClickingInteractiveElement(e) {
        return e.target.closest('.node-inner-hit-area') ||
               e.target.closest('.node-outer-hit-area') ||
               e.target.closest('.connection-overlay') ||
               e.target.closest('.control-point-handle');
    }
    
    handleKeydown(e) {
        // Note: Delete key handling is now handled centrally by NodeManager
        // to coordinate deletion of both nodes and connections
        if (e.key === 'Escape') {
            this.deselectAllConnections();
        }
    }
    
    handleGlobalMouseMove(e) {
        if (!this.isDragging || !this.dragTarget) return;
        
        const worldPos = this.screenToWorldCoords(e.clientX, e.clientY);
        this.updateControlPointPosition(
            this.dragTarget.connectionId, 
            this.dragTarget.pointId, 
            worldPos.x, 
            worldPos.y
        );
        
        // Visual update - handle both circle and group elements
        if (this.dragTarget.handle.setAttribute) {
            if (this.dragTarget.handle.tagName === 'circle') {
                // Direct circle - update cx, cy
                this.dragTarget.handle.setAttribute('cx', worldPos.x);
                this.dragTarget.handle.setAttribute('cy', worldPos.y);
            } else {
                // Group element - update transform
                this.dragTarget.handle.setAttribute('transform', 
                    `translate(${worldPos.x}, ${worldPos.y})`);
            }
        }
        
        // Throttled connection render
        this.scheduleConnectionRender(this.dragTarget.connectionId);
    }
    
    handleGlobalMouseUp() {
        if (this.isDragging) {
            this.isDragging = false;
            this.dragTarget = null;
        }
    }
    
    screenToWorldCoords(screenX, screenY) {
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = screenX - rect.left;
        const canvasY = screenY - rect.top;
        
        return {
            x: this.viewBox.x + (canvasX / rect.width) * this.viewBox.width,
            y: this.viewBox.y + (canvasY / rect.height) * this.viewBox.height
        };
    }
    
    // Connection Management
    createConnection(fromNode, toNode, options = {}) {
        
        // Check for existing connection
        const existingId = this.findConnection(fromNode.id, toNode.id);
        if (existingId) {
            this.selectConnection(existingId);
            return existingId;
        }
        
        // Save state before making changes
        if (this.mindMap.historyManager) {
            this.mindMap.historyManager.saveState('connection', `Connected ${fromNode.text || fromNode.id} to ${toNode.text || toNode.id}`);
        }
        
        const connectionId = this.generateId('conn');
        const connection = {
            id: connectionId,
            from: fromNode.id,
            to: toNode.id,
            style: {
                stroke: options.stroke || 'url(#connectionGradient)',
                strokeWidth: options.strokeWidth || 3,
                strokeDasharray: options.strokeDasharray || 'none'
            },
            ...options
        };
        
        // Initialize control points storage for this connection
        connection.controlPoints = [];
        
        this.connections.set(connectionId, connection);
        this.controlPoints.set(connectionId, { points: [], visible: false });
        
        // Add to mindMap for compatibility
        this.mindMap.connections.push(connection);
        
        this.renderConnection(connectionId);
        
        // Ensure this connection is not selected after creation
        this.selectedConnection = null;
        
        // Temporarily disable default control points
        // this.addDefaultControlPoints(connectionId);
        
        return connectionId;
    }
    
    addDefaultControlPoints(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;
        
        // Check both old nodes array and new nodeManager structure
        let fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
        let toNode = this.mindMap.nodes.find(n => n.id === connection.to);
        
        // Fallback to nodeManager if available
        if (!fromNode && this.mindMap.nodeManager) {
            fromNode = this.mindMap.nodeManager.nodes.get(connection.from);
        }
        if (!toNode && this.mindMap.nodeManager) {
            toNode = this.mindMap.nodeManager.nodes.get(connection.to);
        }
        
        if (!fromNode || !toNode) return;
        
        // Calculate start and end points on the connection line
        const { startX, startY, endX, endY } = this.calculateConnectionPoints(fromNode, toNode);
        
        // Create default control points at start and end positions
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData) return;
        
        // Add start point
        const startPoint = {
            id: this.generateId('cp'),
            x: startX,
            y: startY,
            isDefault: true
        };
        
        // Add end point
        const endPoint = {
            id: this.generateId('cp'),
            x: endX,
            y: endY,
            isDefault: true
        };
        
        // Store in both places
        controlData.points.push(startPoint, endPoint);
        connection.controlPoints.push(startPoint, endPoint);
        controlData.visible = true;
        
        // Show the control points
        this.showControlPoints(connectionId);
    }
    
    deleteConnection(connectionId) {
        if (!this.connections.has(connectionId)) return false;
        
        const connection = this.connections.get(connectionId);
        
        // Save state before making changes
        if (this.mindMap.historyManager) {
            this.mindMap.historyManager.saveState('connection', `Deleted connection ${connection.from} to ${connection.to}`);
        }
        
        // Remove visual elements
        this.removeConnectionElements(connectionId);
        
        // Remove data
        this.connections.delete(connectionId);
        this.controlPoints.delete(connectionId);
        
        // Remove from mindMap array
        const index = this.mindMap.connections.findIndex(c => c.id === connectionId);
        if (index !== -1) {
            this.mindMap.connections.splice(index, 1);
        }
        
        return true;
    }
    
    findConnection(fromId, toId) {
        for (const [id, connection] of this.connections) {
            if ((connection.from === fromId && connection.to === toId) ||
                (connection.from === toId && connection.to === fromId)) {
                return id;
            }
        }
        return null;
    }
    
    // Connection Rendering
    renderConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) {
            console.warn('⚠️ Cannot render connection - not found:', connectionId);
            return;
        }
        
        
        // Check both old nodes array and new nodeManager structure
        let fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
        let toNode = this.mindMap.nodes.find(n => n.id === connection.to);
        
        // Fallback to nodeManager if available
        if (!fromNode && this.mindMap.nodeManager) {
            fromNode = this.mindMap.nodeManager.nodes.get(connection.from);
        }
        if (!toNode && this.mindMap.nodeManager) {
            toNode = this.mindMap.nodeManager.nodes.get(connection.to);
        }
        
        if (!fromNode || !toNode) {
            console.warn('⚠️ Could not find nodes for connection:', {
                connectionId,
                fromNode: connection.from,
                toNode: connection.to,
                fromNodeExists: !!fromNode,
                toNodeExists: !!toNode
            });
            return;
        }
        
        // Remove existing elements
        this.removeConnectionElements(connectionId);
        
        // Calculate path
        const pathData = this.createConnectionPath(fromNode, toNode, connectionId);
        
        // Create elements
        this.createConnectionElements(connectionId, pathData, connection);
    }
    
    createConnectionPath(fromNode, toNode, connectionId) {
        const { startX, startY, endX, endY } = this.calculateConnectionPoints(fromNode, toNode);
        const controlData = this.controlPoints.get(connectionId);
        
        if (!controlData || controlData.points.length === 0) {
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        }
        
        // Create curved path with control points
        return this.createCurvedPath(startX, startY, endX, endY, controlData.points);
    }
    
    calculateConnectionPoints(fromNode, toNode) {
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return { startX: fromNode.x, startY: fromNode.y, endX: toNode.x, endY: toNode.y };
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        const radius = 40; // Node radius
        
        return {
            startX: fromNode.x + unitX * radius,
            startY: fromNode.y + unitY * radius,
            endX: toNode.x - unitX * radius,
            endY: toNode.y - unitY * radius
        };
    }
    
    createCurvedPath(startX, startY, endX, endY, controlPoints) {
        if (controlPoints.length === 1) {
            const cp = controlPoints[0];
            return `M ${startX} ${startY} Q ${cp.x} ${cp.y} ${endX} ${endY}`;
        } else if (controlPoints.length === 2) {
            const cp1 = controlPoints[0];
            const cp2 = controlPoints[1];
            return `M ${startX} ${startY} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${endX} ${endY}`;
        }
        return `M ${startX} ${startY} L ${endX} ${endY}`;
    }
    
    createConnectionElements(connectionId, pathData, connection) {
        const isSelected = this.selectedConnection === connectionId;
        
        // Main path
        const path = this.createSVGElement('path', {
            class: 'connection-line',
            'data-connection-id': connectionId,
            d: pathData,
            fill: 'none',
            'marker-end': isSelected ? 'url(#arrowhead-selected)' : 'url(#arrowhead)',
            stroke: isSelected ? '#38BDF8' : 'url(#connectionGradient)',
            'stroke-width': isSelected ? '4' : '3'
        });
        
        if (isSelected) {
            path.style.filter = 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.8)) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))';
        } else {
            path.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))';
        }
        
        // Overlay for clicking - transparent by default
        const overlay = this.createSVGElement('path', {
            class: 'connection-overlay',
            'data-connection-id': connectionId,
            d: pathData,
            stroke: 'transparent',
            'stroke-width': '20',
            fill: 'none'
        });
        
        overlay.style.cursor = 'pointer';
        overlay.style.pointerEvents = 'all';
        
        // Add interaction
        overlay.addEventListener('click', (e) => this.handleConnectionClick(e, connectionId));
        overlay.addEventListener('contextmenu', (e) => this.handleConnectionContextMenu(e, connectionId));
        
        // Add hover effects
        overlay.addEventListener('mouseenter', () => {
            if (this.selectedConnection !== connectionId) {
                overlay.setAttribute('stroke', 'rgba(56, 189, 248, 0.2)'); // Subtle blue highlight on hover
            }
        });
        
        overlay.addEventListener('mouseleave', () => {
            if (this.selectedConnection !== connectionId) {
                overlay.setAttribute('stroke', 'transparent');
            }
        });
        
        // Add to DOM
        this.connectionLayer.appendChild(path);
        this.connectionLayer.appendChild(overlay);
    }
    
    handleConnectionClick(event, connectionId) {
        event.stopPropagation();
        event.preventDefault();
        
        if (event.ctrlKey || event.metaKey) {
            this.deleteConnection(connectionId);
            return;
        }
        
        // Select the connection first
        this.selectConnection(connectionId);
        
        // Create a control point and add it to the connection's data
        const worldPos = this.screenToWorldCoords(event.clientX, event.clientY);
        
        // Add control point to the connection's data
        const controlData = this.controlPoints.get(connectionId);
        if (controlData && controlData.points.length < 2) {
            const newPoint = {
                id: this.generateId('cp'),
                x: worldPos.x,
                y: worldPos.y
            };
            
            controlData.points.push(newPoint);
            connection.controlPoints.push(newPoint);
            controlData.visible = true;
            
            // Re-render the connection with the new curve
            this.renderConnection(connectionId);
            
            // Create visual control point
            const controlPoint = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
            controlPoint.setAttribute('cx', worldPos.x);
            controlPoint.setAttribute('cy', worldPos.y);
            controlPoint.setAttribute('r', '15');
            controlPoint.setAttribute('fill', '#FF6B35');
            controlPoint.setAttribute('stroke', 'white');
            controlPoint.setAttribute('stroke-width', '3');
            controlPoint.setAttribute('data-point-id', newPoint.id);
            controlPoint.style.cursor = 'move';
            controlPoint.style.opacity = '1';
            
            // Add drag functionality
            this.addControlPointDragBehavior(controlPoint, connectionId, newPoint.id);
            
            // Add to connection layer
            this.connectionLayer.appendChild(controlPoint);
        }
    }
    
    addControlPointDragBehavior(element, connectionId, pointId) {
        let isDragging = false;
        let wasDragged = false;
        let startPos = null;
        
        element.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            isDragging = true;
            wasDragged = false;
            startPos = { x: e.clientX, y: e.clientY };
            this.isDragging = true;
            this.dragTarget = { connectionId, pointId, handle: element };
            
            element.setPointerCapture(e.pointerId);
            element.style.filter = 'drop-shadow(0 0 15px rgba(255, 107, 53, 0.8))';
        });
        
        element.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            
            // Check if we've moved enough to consider this a drag
            if (startPos && !wasDragged) {
                const deltaX = e.clientX - startPos.x;
                const deltaY = e.clientY - startPos.y;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (distance > 3) { // 3 pixel threshold
                    wasDragged = true;
                }
            }
            
            e.stopPropagation();
            e.preventDefault();
            
            const worldPos = this.screenToWorldCoords(e.clientX, e.clientY);
            
            // Update visual position
            element.setAttribute('cx', worldPos.x);
            element.setAttribute('cy', worldPos.y);
            
            // Update stored position
            this.updateControlPointPosition(connectionId, pointId, worldPos.x, worldPos.y);
            
            // Update connection curve
            this.renderConnection(connectionId);
        });
        
        element.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            this.isDragging = false;
            this.dragTarget = null;
            
            element.releasePointerCapture(e.pointerId);
            element.style.filter = '';
            
            // Reset drag flag after a small delay to allow click event to check it
            setTimeout(() => {
                wasDragged = false;
            }, 10);
        });
        
        // Single-click to delete
        element.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Don't delete if this was part of a drag operation
            if (wasDragged) {
                return;
            }
            
            this.deleteControlPoint(connectionId, pointId);
        });
    }
    
    handleConnectionContextMenu(event, connectionId) {
        event.preventDefault();
        event.stopPropagation();
        
        this.showConnectionContextMenu(event, connectionId);
    }
    
    // Control Points
    addControlPoint(connectionId, x, y) {
        
        const connection = this.connections.get(connectionId);
        const controlData = this.controlPoints.get(connectionId);
        
        
        if (!connection || !controlData || controlData.points.length >= 2) {
            return false;
        }
        
        const newPoint = {
            id: this.generateId('cp'),
            x: x,
            y: y
        };
        
        // Store in both places for compatibility
        controlData.points.push(newPoint);
        connection.controlPoints.push(newPoint);
        controlData.visible = true;
        
        this.renderConnection(connectionId);
        this.showControlPoints(connectionId);
        
        return true;
    }
    
    showControlPoints(connectionId) {
        
        const controlData = this.controlPoints.get(connectionId);
        
        if (!controlData || controlData.points.length === 0) {
            return;
        }
        
        this.hideAllControlPoints();
        
        controlData.visible = true;
        
        controlData.points.forEach((point, index) => {
            this.createControlPointHandle(connectionId, point, index);
        });
        
        this.renderConnection(connectionId);
    }
    
    createControlPointHandle(connectionId, point, index) {
        // Use the same direct approach as the working red test circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', point.x);
        circle.setAttribute('cy', point.y);
        
        // Style differently for default points
        if (point.isDefault) {
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', '#10B981');
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '2');
        } else {
            circle.setAttribute('r', '15');
            circle.setAttribute('fill', '#FF6B35');
            circle.setAttribute('stroke', 'white');
            circle.setAttribute('stroke-width', '3');
        }
        
        circle.setAttribute('class', 'control-point-circle');
        circle.setAttribute('data-connection-id', connectionId);
        circle.setAttribute('data-point-id', point.id);
        circle.style.cursor = 'move';
        circle.style.opacity = '1';
        
        // Add drag behavior
        this.addControlPointDragBehavior(circle, connectionId, point.id);
        
        // Add directly to connection layer (we know this works)
        this.connectionLayer.appendChild(circle);
        
        return circle;
    }
    
    addControlPointBehaviors(handle, hitArea, connectionId, pointId) {
        let wasDragged = false;
        let startPos = null;
        
        // Drag behavior
        hitArea.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            wasDragged = false;
            startPos = { x: e.clientX, y: e.clientY };
            this.isDragging = true;
            this.dragTarget = { connectionId, pointId, handle };
            
            hitArea.setPointerCapture(e.pointerId);
            handle.classList.add('dragging');
        });
        
        // Track movement to detect actual dragging
        hitArea.addEventListener('pointermove', (e) => {
            if (this.isDragging && startPos && !wasDragged) {
                const deltaX = e.clientX - startPos.x;
                const deltaY = e.clientY - startPos.y;
                const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
                if (distance > 3) { // 3 pixel threshold
                    wasDragged = true;
                }
            }
        });
        
        // Reset drag flag on pointer up
        hitArea.addEventListener('pointerup', (e) => {
            if (this.isDragging) {
                // Reset drag flag after a small delay to allow click event to check it
                setTimeout(() => {
                    wasDragged = false;
                }, 10);
            }
        });
        
        // Single-click to delete
        hitArea.addEventListener('click', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            // Don't delete if this was part of a drag operation
            if (wasDragged) {
                return;
            }
            
            this.deleteControlPoint(connectionId, pointId);
        });
        
        // Hover effects
        hitArea.addEventListener('mouseenter', () => {
            if (!this.isDragging) {
                const circle = handle.querySelector('.control-point-circle');
                circle.setAttribute('r', '14');
            }
        });
        
        hitArea.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                const circle = handle.querySelector('.control-point-circle');
                circle.setAttribute('r', '12');
            }
        });
    }
    
    deleteControlPoint(connectionId, pointId) {
        const connection = this.connections.get(connectionId);
        const controlData = this.controlPoints.get(connectionId);
        if (!connection || !controlData) return;
        
        const pointIndex = controlData.points.findIndex(p => p.id === pointId);
        if (pointIndex === -1) return;
        
        // Remove from control layer
        const handle = this.connectionLayer.querySelector(
            `[data-point-id="${pointId}"]`
        );
        
        if (handle) {
            handle.remove();
        }
        
        // Remove from both storage locations
        controlData.points.splice(pointIndex, 1);
        const connectionPointIndex = connection.controlPoints.findIndex(p => p.id === pointId);
        if (connectionPointIndex !== -1) {
            connection.controlPoints.splice(connectionPointIndex, 1);
        }
        
        // Re-render connection
        this.renderConnection(connectionId);
        
        if (controlData.points.length > 0) {
            this.showControlPoints(connectionId);
        } else {
            controlData.visible = false;
            this.selectedConnection = null;
        }
    }
    
    hideAllControlPoints() {
        // Remove from both layers to be safe
        const handles = this.controlLayer.querySelectorAll('.control-point-handle');
        handles.forEach(handle => handle.remove());
        
        const circles = this.connectionLayer.querySelectorAll('.control-point-circle');
        circles.forEach(circle => circle.remove());
        
        for (const controlData of this.controlPoints.values()) {
            controlData.visible = false;
        }
        
        const prevSelected = this.selectedConnection;
        this.selectedConnection = null;
        
        if (prevSelected) {
            this.renderConnection(prevSelected);
        }
    }
    
    updateControlPointPosition(connectionId, pointId, x, y) {
        const connection = this.connections.get(connectionId);
        const controlData = this.controlPoints.get(connectionId);
        if (!connection || !controlData) return;
        
        // Update in controlData
        const point = controlData.points.find(p => p.id === pointId);
        if (point) {
            point.x = x;
            point.y = y;
        }
        
        // Update in connection storage
        const connectionPoint = connection.controlPoints.find(p => p.id === pointId);
        if (connectionPoint) {
            connectionPoint.x = x;
            connectionPoint.y = y;
        }
    }
    
    // Connection Selection
    selectConnection(connectionId) {
        // Clear previous selection visual only (don't re-render to avoid clearing control points)
        if (this.selectedConnection && this.selectedConnection !== connectionId) {
            const prevOverlay = this.connectionLayer.querySelector(`[data-connection-id="${this.selectedConnection}"].connection-overlay`);
            if (prevOverlay) {
                prevOverlay.setAttribute('stroke', 'transparent');
            }
            const prevPath = this.connectionLayer.querySelector(`[data-connection-id="${this.selectedConnection}"].connection-line`);
            if (prevPath) {
                prevPath.setAttribute('stroke', '#6B7280');
                prevPath.setAttribute('stroke-width', '2');
                prevPath.style.filter = '';
            }
        }
        
        this.selectedConnection = connectionId;
        
        // Update visual selection without re-rendering (which clears control points)
        const overlay = this.connectionLayer.querySelector(`[data-connection-id="${connectionId}"].connection-overlay`);
        if (overlay) {
            overlay.setAttribute('stroke', 'rgba(255, 0, 0, 0.3)'); // Red highlight when selected
        }
        const path = this.connectionLayer.querySelector(`[data-connection-id="${connectionId}"].connection-line`);
        if (path) {
            path.setAttribute('stroke', '#38BDF8');
            path.setAttribute('stroke-width', '4');
            path.setAttribute('marker-end', 'url(#arrowhead-selected)');
            path.style.filter = 'drop-shadow(0 0 12px rgba(56, 189, 248, 0.8)) drop-shadow(0 3px 6px rgba(0, 0, 0, 0.3))';
            path.classList.add('selected');
        }
        
        // Show existing control points without clearing them
        const controlData = this.controlPoints.get(connectionId);
        if (controlData && controlData.points.length > 0) {
            this.showExistingControlPoints(connectionId);
        }
    }
    
    deselectAllConnections() {
        // Clear overlay highlights for ALL connections
        const allOverlays = this.connectionLayer.querySelectorAll('.connection-overlay');
        allOverlays.forEach(overlay => {
            overlay.setAttribute('stroke', 'transparent');
        });
        
        // Clear main path highlights for ALL connections  
        const allPaths = this.connectionLayer.querySelectorAll('.connection-line');
        allPaths.forEach(path => {
            path.setAttribute('stroke', 'url(#connectionGradient)'); // Use gradient for elegant appearance
            path.setAttribute('stroke-width', '3');
            path.setAttribute('marker-end', 'url(#arrowhead)');
            path.style.filter = 'drop-shadow(0 2px 4px rgba(0, 0, 0, 0.15)) drop-shadow(0 1px 2px rgba(0, 0, 0, 0.1))';
            path.classList.remove('selected');
        });
        
        this.selectedConnection = null;
        this.hideAllControlPoints();
    }
    
    showExistingControlPoints(connectionId) {
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData || controlData.points.length === 0) return;
        
        // Only show control points for this connection, don't clear others
        controlData.visible = true;
        
        controlData.points.forEach((point, index) => {
            // Check if control point already exists in DOM
            const existingPoint = this.connectionLayer.querySelector(`[data-point-id="${point.id}"]`);
            if (!existingPoint) {
                this.createControlPointHandle(connectionId, point, index);
            }
        });
    }
    
    renderAllConnections() {
        this.connectionLayer.innerHTML = '';
        
        // Force no selection during initial render
        this.selectedConnection = null;
        
        for (const connectionId of this.connections.keys()) {
            this.renderConnection(connectionId);
        }
        
        // Don't auto-restore any selection - let user manually select
    }
    
    // Performance Optimization
    scheduleConnectionRender(connectionId) {
        if (this.pendingRenders.has(connectionId)) return;
        
        this.pendingRenders.add(connectionId);
        
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        this.animationFrameId = requestAnimationFrame(() => {
            for (const id of this.pendingRenders) {
                this.renderConnection(id);
            }
            this.pendingRenders.clear();
            this.animationFrameId = null;
        });
    }
    
    // Utility Methods
    createSVGElement(tag, attributes = {}) {
        const element = document.createElementNS('http://www.w3.org/2000/svg', tag);
        for (const [key, value] of Object.entries(attributes)) {
            element.setAttribute(key, value);
        }
        return element;
    }
    
    generateId(prefix) {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    removeConnectionElements(connectionId) {
        const elements = this.connectionLayer.querySelectorAll(`[data-connection-id="${connectionId}"]`);
        elements.forEach(el => el.remove());
        
        const controlHandles = this.controlLayer.querySelectorAll(`[data-connection-id="${connectionId}"]`);
        controlHandles.forEach(handle => handle.remove());
    }
    
    animateIn(element, delay = 0) {
        // Use SVG-compatible animation instead of CSS transform
        element.style.opacity = '0';
        element.style.transition = 'opacity 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        // Add scale animation using SVG transform
        const originalTransform = element.getAttribute('transform');
        element.setAttribute('transform', originalTransform + ' scale(0)');
        
        setTimeout(() => {
            element.style.opacity = '1';
            element.setAttribute('transform', originalTransform + ' scale(1)');
            
            setTimeout(() => {
                element.style.transition = '';
                element.setAttribute('transform', originalTransform); // Clean up transform
            }, 300);
        }, delay * 100);
    }
    
    animateOut(element, callback) {
        element.style.transition = 'opacity 0.3s ease-out';
        element.style.opacity = '0';
        
        // Use SVG transform for scale
        const originalTransform = element.getAttribute('transform');
        element.setAttribute('transform', originalTransform + ' scale(0)');
        
        setTimeout(() => {
            if (element.parentNode) {
                element.remove();
            }
            if (callback) callback();
        }, 300);
    }
    
    // Data Export/Import
    exportConnections() {
        const data = [];
        for (const [id, connection] of this.connections) {
            const controlData = this.controlPoints.get(id);
            data.push({
                ...connection,
                controlPoints: controlData ? controlData.points : []
            });
        }
        return data;
    }
    
    importConnections(data) {
        this.clearAllConnections();
        
        data.forEach(connectionData => {
            const { controlPoints, ...connection } = connectionData;
            
            this.connections.set(connection.id, connection);
            this.mindMap.connections.push(connection);
            
            this.controlPoints.set(connection.id, {
                points: controlPoints || [],
                visible: false
            });
        });
        
        this.renderAllConnections();
    }
    
    clearAllConnections() {
        this.connectionLayer.innerHTML = '';
        this.controlLayer.innerHTML = '';
        this.connections.clear();
        this.controlPoints.clear();
        this.selectedConnection = null;
        this.mindMap.connections = [];
    }
    
    // Cleanup
    destroy() {
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
        }
        
        document.removeEventListener('mousemove', this.handleGlobalMouseMove);
        document.removeEventListener('mouseup', this.handleGlobalMouseUp);
        document.removeEventListener('keydown', this.handleKeydown);
        
        this.clearAllConnections();
    }
    
    showConnectionContextMenu(event, connectionId) {
        // Remove existing context menu
        const existingMenu = document.querySelector('.connection-context-menu');
        if (existingMenu) existingMenu.remove();
        
        const controlData = this.controlPoints.get(connectionId);
        const hasControlPoints = controlData && controlData.points.length > 0;
        
        const menu = document.createElement('div');
        menu.className = 'context-menu connection-context-menu';
        menu.style.position = 'absolute';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        menu.style.zIndex = '10000';
        
        const menuItems = [
            { 
                text: '🎯 Add Control Point', 
                action: () => {
                    const worldPos = this.screenToWorldCoords(event.clientX, event.clientY);
                    this.addControlPoint(connectionId, worldPos.x, worldPos.y);
                },
                enabled: !controlData || controlData.points.length < 2
            },
            { 
                text: hasControlPoints ? '👁️ Hide Control Points' : '👁️ Show Control Points', 
                action: () => {
                    if (hasControlPoints && controlData.visible) {
                        this.hideAllControlPoints();
                    } else {
                        this.showControlPoints(connectionId);
                    }
                }
            },
            { text: '---', separator: true },
            { 
                text: '🗑️ Delete Connection', 
                action: () => this.deleteConnection(connectionId),
                style: 'color: #F43F5E;'
            }
        ];
        
        menuItems.forEach(item => {
            if (item.separator) {
                const separator = document.createElement('div');
                separator.className = 'context-menu-separator';
                separator.style.height = '1px';
                separator.style.background = '#555';
                separator.style.margin = '5px 0';
                menu.appendChild(separator);
            } else {
                const menuItem = document.createElement('button');
                menuItem.className = 'context-menu-item';
                menuItem.textContent = item.text;
                menuItem.disabled = item.enabled === false;
                if (item.style) menuItem.style.cssText += item.style;
                
                menuItem.addEventListener('click', () => {
                    item.action();
                    menu.remove();
                });
                
                menu.appendChild(menuItem);
            }
        });
        
        document.body.appendChild(menu);
        
        // Remove menu on click outside or escape
        const removeMenu = (e) => {
            if (!menu.contains(e.target)) {
                menu.remove();
                document.removeEventListener('click', removeMenu);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        
        const handleEscape = (e) => {
            if (e.key === 'Escape') {
                menu.remove();
                document.removeEventListener('click', removeMenu);
                document.removeEventListener('keydown', handleEscape);
            }
        };
        
        setTimeout(() => {
            document.addEventListener('click', removeMenu);
            document.addEventListener('keydown', handleEscape);
        }, 10);
    }
}

// Export
window.ConnectionManager = ConnectionManager;