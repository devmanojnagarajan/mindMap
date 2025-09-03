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
        this.selectedConnection = null;
        
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
        if (e.key === 'Delete' && this.selectedConnection) {
            this.deleteConnection(this.selectedConnection);
        } else if (e.key === 'Escape') {
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
        
        // Visual update
        this.dragTarget.handle.setAttribute('transform', 
            `translate(${worldPos.x}, ${worldPos.y})`);
        
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
        
        const connectionId = this.generateId('conn');
        const connection = {
            id: connectionId,
            from: fromNode.id,
            to: toNode.id,
            style: {
                stroke: options.stroke || '#6B7280',
                strokeWidth: options.strokeWidth || 2,
                strokeDasharray: options.strokeDasharray || 'none'
            },
            ...options
        };
        
        this.connections.set(connectionId, connection);
        this.controlPoints.set(connectionId, { points: [], visible: false });
        
        // Add to mindMap for compatibility
        this.mindMap.connections.push(connection);
        
        this.renderConnection(connectionId);
        return connectionId;
    }
    
    deleteConnection(connectionId) {
        if (!this.connections.has(connectionId)) return false;
        
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
        if (!connection) return;
        
        const fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
        const toNode = this.mindMap.nodes.find(n => n.id === connection.to);
        
        if (!fromNode || !toNode) return;
        
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
            'marker-end': 'url(#arrowhead)',
            stroke: isSelected ? '#38BDF8' : connection.style.stroke,
            'stroke-width': isSelected ? '3' : connection.style.strokeWidth
        });
        
        if (isSelected) {
            path.style.filter = 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))';
        }
        
        // Invisible overlay for easier clicking
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
        
        const worldPos = this.screenToWorldCoords(event.clientX, event.clientY);
        this.addControlPoint(connectionId, worldPos.x, worldPos.y);
    }
    
    // Control Points
    addControlPoint(connectionId, x, y) {
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData || controlData.points.length >= 2) return false;
        
        const newPoint = {
            id: this.generateId('cp'),
            x: x,
            y: y
        };
        
        controlData.points.push(newPoint);
        controlData.visible = true;
        
        this.renderConnection(connectionId);
        this.showControlPoints(connectionId);
        
        return true;
    }
    
    showControlPoints(connectionId) {
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData || controlData.points.length === 0) return;
        
        this.hideAllControlPoints();
        
        controlData.visible = true;
        this.selectedConnection = connectionId;
        
        controlData.points.forEach((point, index) => {
            this.createControlPointHandle(connectionId, point, index);
        });
        
        this.renderConnection(connectionId);
    }
    
    createControlPointHandle(connectionId, point, index) {
        const handle = this.createSVGElement('g', {
            class: 'control-point-handle',
            'data-connection-id': connectionId,
            'data-point-id': point.id,
            transform: `translate(${point.x}, ${point.y})`
        });
        
        // Visual circle
        const circle = this.createSVGElement('circle', {
            class: 'control-point-circle',
            r: '12',
            fill: '#FF6B35',
            stroke: '#FFFFFF',
            'stroke-width': '3'
        });
        circle.style.filter = 'drop-shadow(0 3px 6px rgba(255,107,53,0.5))';
        
        // Hit area
        const hitArea = this.createSVGElement('circle', {
            class: 'control-point-hit-area',
            r: '20',
            fill: 'transparent'
        });
        hitArea.style.cursor = 'move';
        hitArea.style.pointerEvents = 'all';
        
        handle.appendChild(circle);
        handle.appendChild(hitArea);
        
        this.addControlPointBehaviors(handle, hitArea, connectionId, point.id);
        this.controlLayer.appendChild(handle);
        
        // Animate in
        this.animateIn(handle, index);
        
        return handle;
    }
    
    addControlPointBehaviors(handle, hitArea, connectionId, pointId) {
        // Drag behavior
        hitArea.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            this.isDragging = true;
            this.dragTarget = { connectionId, pointId, handle };
            
            hitArea.setPointerCapture(e.pointerId);
            handle.classList.add('dragging');
        });
        
        // Delete on double-click
        let clickCount = 0;
        hitArea.addEventListener('click', (e) => {
            e.stopPropagation();
            clickCount++;
            
            if (clickCount === 1) {
                setTimeout(() => { clickCount = 0; }, 300);
            } else if (clickCount === 2) {
                this.deleteControlPoint(connectionId, pointId);
            }
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
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData) return;
        
        const pointIndex = controlData.points.findIndex(p => p.id === pointId);
        if (pointIndex === -1) return;
        
        // Animate out
        const handle = this.controlLayer.querySelector(
            `[data-connection-id="${connectionId}"][data-point-id="${pointId}"]`
        );
        
        if (handle) {
            this.animateOut(handle, () => {
                controlData.points.splice(pointIndex, 1);
                this.renderConnection(connectionId);
                
                if (controlData.points.length > 0) {
                    this.showControlPoints(connectionId);
                } else {
                    controlData.visible = false;
                    this.selectedConnection = null;
                }
            });
        }
    }
    
    hideAllControlPoints() {
        const handles = this.controlLayer.querySelectorAll('.control-point-handle');
        handles.forEach(handle => handle.remove());
        
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
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData) return;
        
        const point = controlData.points.find(p => p.id === pointId);
        if (point) {
            point.x = x;
            point.y = y;
        }
    }
    
    // Connection Selection
    selectConnection(connectionId) {
        this.selectedConnection = connectionId;
        this.renderConnection(connectionId);
        
        const controlData = this.controlPoints.get(connectionId);
        if (controlData && controlData.points.length > 0) {
            this.showControlPoints(connectionId);
        }
    }
    
    deselectAllConnections() {
        this.hideAllControlPoints();
    }
    
    renderAllConnections() {
        this.connectionLayer.innerHTML = '';
        
        for (const connectionId of this.connections.keys()) {
            this.renderConnection(connectionId);
        }
        
        // Re-show selected control points
        if (this.selectedConnection && this.controlPoints.has(this.selectedConnection)) {
            const controlData = this.controlPoints.get(this.selectedConnection);
            if (controlData.visible) {
                this.showControlPoints(this.selectedConnection);
            }
        }
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
        element.style.opacity = '0';
        element.style.transform = element.getAttribute('transform') + ' scale(0)';
        element.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        setTimeout(() => {
            element.style.opacity = '1';
            element.style.transform = element.getAttribute('transform') + ' scale(1)';
            
            setTimeout(() => {
                element.style.transition = '';
            }, 300);
        }, delay * 100);
    }
    
    animateOut(element, callback) {
        element.style.transition = 'all 0.3s ease-out';
        element.style.transform = element.getAttribute('transform') + ' scale(0)';
        element.style.opacity = '0';
        
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
}

// Export
window.ConnectionManager = ConnectionManager;