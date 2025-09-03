/**
 * Connection Manager Module for Mind Map
 * Handles all connection-related functionality including:
 * - Connection creation and deletion
 * - Control points management and manipulation
 * - Connection rendering with Bézier curves
 * - Smooth animations and interactions
 * - Visual feedback and hover effects
 */

class ConnectionManager {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.canvas = mindMap.canvas;
        this.connectionLayer = mindMap.connectionLayer;
        this.controlLayer = mindMap.controlLayer;
        this.viewBox = mindMap.viewBox;
        
        // Connection storage
        this.connections = new Map(); // id -> connection data
        this.controlPoints = new Map(); // connectionId -> {points: [], visible: bool}
        this.interpolationPoints = new Map(); // connectionId -> {points: [], visible: bool}
        
        // Curve interpolation settings
        this.interpolationSettings = {
            tension: 0.5, // Curve smoothness (0-1)
            segmentResolution: 20, // Points per curve segment for smooth rendering
            minDistance: 30 // Minimum distance between interpolation points
        };
        
        // Interaction state
        this.selectedConnection = null;
        this.isDraggingControlPoint = false;
        this.dragTarget = null;
        this.dragStartPos = { x: 0, y: 0 };
        
        // Animation frame management
        this.pendingRenders = new Set();
        this.renderQueue = [];
        
        console.log('🔗 ConnectionManager initialized');
        console.log('📊 Canvas:', this.canvas);
        console.log('📊 Connection layer:', this.connectionLayer);
        console.log('📊 Control layer:', this.controlLayer);
        console.log('📊 Control layer parent:', this.controlLayer ? this.controlLayer.parentElement : 'null');
        
        this.setupEventListeners();
    }
    

    /**
     * Handle global mouse move for control point dragging
     */
    handleGlobalMouseMove(e) {
        if (!this.isDraggingControlPoint || !this.dragTarget) return;
        
        const rect = this.mindMap.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Convert mouse position to world coordinates
        const worldMouseX = this.mindMap.viewBox.x + (mouseX / rect.width) * this.mindMap.viewBox.width;
        const worldMouseY = this.mindMap.viewBox.y + (mouseY / rect.height) * this.mindMap.viewBox.height;
        
        if (this.dragTarget.type === 'interpolation') {
            // Update interpolation point position
            const interpolationData = this.interpolationPoints.get(this.dragTarget.connectionId);
            if (interpolationData && interpolationData.points[this.dragTarget.pointId]) {
                interpolationData.points[this.dragTarget.pointId].x = worldMouseX;
                interpolationData.points[this.dragTarget.pointId].y = worldMouseY;
                
                // Update visual position
                this.dragTarget.handle.setAttribute('transform', `translate(${worldMouseX}, ${worldMouseY})`);
                
                // Re-render connection with updated points
                this.renderConnection(this.dragTarget.connectionId);
            }
        } else {
            // Update control point position
            const controlPoints = this.connectionControlPoints.get(this.dragTarget.connectionId);
            if (controlPoints && controlPoints[this.dragTarget.pointId]) {
                controlPoints[this.dragTarget.pointId].x = worldMouseX;
                controlPoints[this.dragTarget.pointId].y = worldMouseY;
                
                // Update visual position
                this.dragTarget.handle.setAttribute('transform', `translate(${worldMouseX}, ${worldMouseY})`);
                
                // Re-render connection with updated points
                this.renderConnection(this.dragTarget.connectionId);
            }
        }
    }
    
    /**
     * Handle global mouse up for control point dragging
     */
    handleGlobalMouseUp(e) {
        if (this.isDraggingControlPoint) {
            this.isDraggingControlPoint = false;
            this.dragTarget = null;
            console.log('🎯 Control point drag ended via global mouse up');
        }
    }

    /**
     * Setup global event listeners for connection interactions
     */
    setupEventListeners() {
        // Handle canvas clicks for deselecting connections
        this.canvas.addEventListener('click', (e) => {
            // Only deselect if clicking on the canvas background itself, not on interactive elements
            if ((e.target === this.canvas || e.target.id === 'grid-background') &&
                !e.target.closest('.node-inner-hit-area') &&
                !e.target.closest('.node-outer-hit-area') &&
                !e.target.closest('.connection-overlay') &&
                !e.target.closest('.control-point-handle')) {
                
                console.log('🖱️ Canvas background clicked, deselecting connections');
                this.deselectAllConnections();
            }
        });

        // Keyboard shortcuts for connection operations
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && this.selectedConnection) {
                this.deleteConnection(this.selectedConnection);
            }
            if (e.key === 'Escape') {
                this.deselectAllConnections();
            }
        });
    }

    /**
     * Create a new connection between two nodes
     */
    createConnection(fromNode, toNode, options = {}) {
        // Check if connection already exists
        const existingId = this.findExistingConnection(fromNode.id, toNode.id);
        if (existingId) {
            console.log('🔄 Connection already exists, toggling selection');
            this.toggleConnectionSelection(existingId);
            return existingId;
        }

        const connectionId = `conn_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
        
        const connection = {
            id: connectionId,
            from: fromNode.id,
            to: toNode.id,
            isTemporary: options.isTemporary || false,
            style: {
                stroke: options.stroke || '#6B7280',
                strokeWidth: options.strokeWidth || 2,
                strokeDasharray: options.strokeDasharray || 'none'
            },
            ...options
        };

        this.connections.set(connectionId, connection);
        
        // Initialize control points data
        this.controlPoints.set(connectionId, {
            points: [],
            visible: false
        });
        
        // Initialize interpolation points data
        this.interpolationPoints.set(connectionId, {
            points: [],
            visible: false
        });

        // Add to mindMap connections array for compatibility
        this.mindMap.connections.push(connection);

        console.log('✅ Connection created:', connectionId);
        this.renderConnection(connectionId);
        
        // Automatically show control points for new connections
        setTimeout(() => {
            this.selectConnection(connectionId);
            // Add a default control point to make the curve visible
            const fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
            const toNode = this.mindMap.nodes.find(n => n.id === connection.to);
            if (fromNode && toNode) {
                const midX = (fromNode.x + toNode.x) / 2;
                const midY = (fromNode.y + toNode.y) / 2 - 50; // Offset above the middle
                this.addControlPoint(connectionId, midX, midY);
            }
        }, 100);
        
        return connectionId;
    }

    /**
     * Delete a connection
     */
    deleteConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;

        // Remove visual elements
        this.removeConnectionElements(connectionId);
        
        // Remove from data structures
        this.connections.delete(connectionId);
        this.controlPoints.delete(connectionId);
        this.interpolationPoints.delete(connectionId);
        
        // Remove from mindMap connections array
        const index = this.mindMap.connections.findIndex(c => c.id === connectionId);
        if (index !== -1) {
            this.mindMap.connections.splice(index, 1);
        }

        console.log('🗑️ Connection deleted:', connectionId);
        return true;
    }

    /**
     * Find existing connection between two nodes
     */
    findExistingConnection(fromId, toId) {
        for (const [id, connection] of this.connections) {
            if ((connection.from === fromId && connection.to === toId) ||
                (connection.from === toId && connection.to === fromId)) {
                return id;
            }
        }
        return null;
    }

    /**
     * Render a specific connection
     */
    renderConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (!connection) return;

        const fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
        const toNode = this.mindMap.nodes.find(n => n.id === connection.to);
        
        if (!fromNode || !toNode) {
            console.warn('⚠️ Missing nodes for connection:', connectionId);
            return;
        }

        // Remove existing elements
        this.removeConnectionElements(connectionId);

        // Calculate connection points
        const { startX, startY, endX, endY } = this.calculateConnectionPoints(fromNode, toNode);
        
        // Create path with control points
        const pathData = this.createConnectionPath(startX, startY, endX, endY, connectionId);
        
        // Create visual elements
        this.createConnectionElements(connectionId, pathData, connection);
        
        console.log('🎨 Connection rendered:', connectionId);
    }

    /**
     * Render all connections
     */
    renderAllConnections() {
        console.log('🔄 Rendering all connections...');
        
        // Clear existing elements
        this.connectionLayer.innerHTML = '';
        
        // Render each connection
        for (const connectionId of this.connections.keys()) {
            this.renderConnection(connectionId);
        }
        
        // Re-show control points for selected connection
        if (this.selectedConnection && this.controlPoints.has(this.selectedConnection)) {
            const controlData = this.controlPoints.get(this.selectedConnection);
            if (controlData.visible) {
                this.showControlPoints(this.selectedConnection);
            }
        }
    }

    /**
     * Calculate connection points on node edges
     */
    calculateConnectionPoints(fromNode, toNode) {
        const dx = toNode.x - fromNode.x;
        const dy = toNode.y - fromNode.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) {
            return { startX: fromNode.x, startY: fromNode.y, endX: toNode.x, endY: toNode.y };
        }
        
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        // Calculate radius based on node shape
        const fromRadius = this.getNodeRadius(fromNode);
        const toRadius = this.getNodeRadius(toNode);
        
        const startX = fromNode.x + unitX * fromRadius;
        const startY = fromNode.y + unitY * fromRadius;
        const endX = toNode.x - unitX * toRadius;
        const endY = toNode.y - unitY * toRadius;
        
        return { startX, startY, endX, endY };
    }

    /**
     * Get node radius based on shape and size
     */
    getNodeRadius(node) {
        if (node.shape && node.shape.type === 'circle') {
            return Math.max(node.shape.width, node.shape.height) / 2;
        }
        return node.radius || 40;
    }

    /**
     * Create SVG path data for connection with interpolation points
     */
    createConnectionPath(startX, startY, endX, endY, connectionId) {
        const interpolationData = this.interpolationPoints.get(connectionId);
        
        // If no interpolation points, use legacy control points for backward compatibility
        if (!interpolationData || interpolationData.points.length === 0) {
            return this.createLegacyControlPath(startX, startY, endX, endY, connectionId);
        }
        
        // Create path with interpolation points
        const allPoints = [
            { x: startX, y: startY },
            ...interpolationData.points,
            { x: endX, y: endY }
        ];
        
        if (allPoints.length === 2) {
            // Straight line
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        }
        
        // Generate smooth curve through all points using Catmull-Rom splines
        return this.generateSmoothCurvePath(allPoints);
    }

    /**
     * Legacy control points path (for backward compatibility)
     */
    createLegacyControlPath(startX, startY, endX, endY, connectionId) {
        const controlData = this.controlPoints.get(connectionId);
        
        if (!controlData || controlData.points.length === 0) {
            return `M ${startX} ${startY} L ${endX} ${endY}`;
        }
        
        const points = controlData.points;
        
        if (points.length === 1) {
            const cp = points[0];
            return `M ${startX} ${startY} Q ${cp.x} ${cp.y} ${endX} ${endY}`;
        } else if (points.length === 2) {
            const cp1 = points[0];
            const cp2 = points[1];
            return `M ${startX} ${startY} C ${cp1.x} ${cp1.y} ${cp2.x} ${cp2.y} ${endX} ${endY}`;
        }
        
        return `M ${startX} ${startY} L ${endX} ${endY}`;
    }

    /**
     * Generate smooth curve path using Catmull-Rom spline interpolation
     */
    generateSmoothCurvePath(points) {
        if (points.length < 3) {
            return `M ${points[0].x} ${points[0].y} L ${points[1].x} ${points[1].y}`;
        }
        
        let path = `M ${points[0].x} ${points[0].y}`;
        
        // For smooth curves, we need to create control points between each pair of interpolation points
        for (let i = 0; i < points.length - 1; i++) {
            const p0 = points[i - 1] || points[0];
            const p1 = points[i];
            const p2 = points[i + 1];
            const p3 = points[i + 2] || points[points.length - 1];
            
            // Calculate control points using Catmull-Rom to Bézier conversion
            const tension = this.interpolationSettings.tension;
            
            // Control point 1 (from p1 towards p2)
            const cp1x = p1.x + (p2.x - p0.x) * tension / 6;
            const cp1y = p1.y + (p2.y - p0.y) * tension / 6;
            
            // Control point 2 (from p2 towards p1)
            const cp2x = p2.x - (p3.x - p1.x) * tension / 6;
            const cp2y = p2.y - (p3.y - p1.y) * tension / 6;
            
            // Add cubic Bézier curve segment
            path += ` C ${cp1x} ${cp1y} ${cp2x} ${cp2y} ${p2.x} ${p2.y}`;
        }
        
        return path;
    }

    /**
     * Create visual elements for a connection
     */
    createConnectionElements(connectionId, pathData, connection) {
        const controlData = this.controlPoints.get(connectionId);
        const isSelected = controlData && controlData.visible;
        
        // Create main path
        const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        path.setAttribute('class', 'connection-line');
        path.setAttribute('data-connection-id', connectionId);
        path.setAttribute('d', pathData);
        path.setAttribute('fill', 'none');
        path.setAttribute('marker-end', 'url(#arrowhead)');
        
        // Apply styling
        if (isSelected) {
            path.setAttribute('stroke', '#38BDF8');
            path.setAttribute('stroke-width', '3');
            path.style.filter = 'drop-shadow(0 0 6px rgba(56, 189, 248, 0.4))';
        } else {
            path.setAttribute('stroke', connection.style.stroke);
            path.setAttribute('stroke-width', connection.style.strokeWidth);
            if (connection.style.strokeDasharray !== 'none') {
                path.setAttribute('stroke-dasharray', connection.style.strokeDasharray);
            }
        }
        
        // Create click overlay for easier interaction
        const overlay = document.createElementNS('http://www.w3.org/2000/svg', 'path');
        overlay.setAttribute('class', 'connection-overlay');
        overlay.setAttribute('data-connection-id', connectionId);
        overlay.setAttribute('d', pathData);
        overlay.setAttribute('stroke', 'transparent');
        overlay.setAttribute('stroke-width', '20');
        overlay.setAttribute('fill', 'none');
        overlay.style.cursor = 'pointer';
        overlay.style.pointerEvents = 'all';
        
        // Add interaction handlers
        this.addConnectionInteractions(overlay, connectionId);
        
        // Add to layer
        this.connectionLayer.appendChild(path);
        this.connectionLayer.appendChild(overlay);
        
        // Add hover effects
        this.addConnectionHoverEffects(overlay, path, isSelected);
    }

    /**
     * Add interaction handlers to connection
     */
    addConnectionInteractions(overlay, connectionId) {
        overlay.addEventListener('click', (e) => {
            console.log('🖱️ Connection overlay clicked for:', connectionId);
            console.log('🖱️ Event target:', e.target);
            console.log('🖱️ Current target:', e.currentTarget);
            e.stopPropagation();
            e.preventDefault();
            console.log('🖱️ Event propagation stopped and default prevented');
            
            if (e.ctrlKey || e.metaKey) {
                // Delete connection
                this.deleteConnection(connectionId);
            } else if (e.altKey) {
                // Add interpolation point at click position
                this.handleConnectionClick(e, connectionId);
            } else if (e.shiftKey) {
                // Toggle interpolation point visibility
                this.toggleInterpolationPointVisibility(connectionId);
            } else {
                // Default behavior: select connection and show existing control points, or add new ones
                this.selectConnection(connectionId);
                
                const controlData = this.controlPoints.get(connectionId);
                if (controlData && controlData.points.length > 0) {
                    // If control points exist, just show them
                    this.showControlPoints(connectionId);
                } else {
                    // If no control points exist, add one at click position
                    this.handleConnectionClick(e, connectionId);
                }
            }
        });
        
        overlay.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.showConnectionContextMenu(e, connectionId);
        });
    }

    /**
     * Add hover effects to connection
     */
    addConnectionHoverEffects(overlay, path, isSelected) {
        overlay.addEventListener('mouseenter', () => {
            if (isSelected) {
                path.setAttribute('stroke-width', '4');
                path.setAttribute('stroke', '#0EA5E9');
            } else {
                path.setAttribute('stroke-width', '3');
                path.setAttribute('stroke', '#9CA3AF');
            }
            overlay.style.cursor = 'crosshair';
        });
        
        overlay.addEventListener('mouseleave', () => {
            if (isSelected) {
                path.setAttribute('stroke-width', '3');
                path.setAttribute('stroke', '#38BDF8');
            } else {
                path.setAttribute('stroke-width', '2');
                path.setAttribute('stroke', '#6B7280');
            }
            overlay.style.cursor = 'pointer';
        });
    }

    /**
     * Handle connection click for adding interpolation points
     */
    handleConnectionClick(event, connectionId) {
        console.log('🖱️ Connection clicked:', connectionId, 'Alt key:', event.altKey, 'Shift key:', event.shiftKey);
        
        const rect = this.canvas.getBoundingClientRect();
        const clickX = event.clientX - rect.left;
        const clickY = event.clientY - rect.top;
        
        // Convert to world coordinates
        const worldX = this.viewBox.x + (clickX / rect.width) * this.viewBox.width;
        const worldY = this.viewBox.y + (clickY / rect.height) * this.viewBox.height;
        
        // Check if Alt key is pressed for interpolation points, otherwise add control points
        if (event.altKey) {
            // Add interpolation point at the optimal position along the curve
            console.log('🟢 Adding interpolation point at:', worldX, worldY);
            const success = this.addInterpolationPointAtPosition(connectionId, worldX, worldY);
            
            if (success) {
                this.showTemporaryFeedback('Green interpolation point added!', worldX, worldY, '#10b981');
                this.selectConnection(connectionId);
            } else {
                this.showTemporaryFeedback('Cannot add point here', worldX, worldY, '#ef4444');
            }
        } else {
            // Add control point (default behavior)
            console.log('🟠 Adding control point at:', worldX, worldY);
            const success = this.addControlPoint(connectionId, worldX, worldY);
            
            if (success) {
                this.showTemporaryFeedback('Control point added! Drag to reshape curve.', worldX, worldY, '#f97316');
                this.selectConnection(connectionId);
            } else {
                this.showTemporaryFeedback('Max 2 control points per connection', worldX, worldY, '#ef4444');
            }
        }
    }

    /**
     * Add a control point to a connection
     */
    addControlPoint(connectionId, x, y) {
        console.log(`➕ Adding control point to ${connectionId} at (${x}, ${y})`);
        
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData) {
            console.error(`❌ No control data found for connection ${connectionId}`);
            return false;
        }
        
        // Limit to 2 control points for cubic Bézier
        if (controlData.points.length >= 2) {
            console.log(`⚠️ Connection ${connectionId} already has maximum control points (${controlData.points.length})`);
            return false;
        }
        
        const newPoint = {
            id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            x: x,
            y: y
        };
        
        controlData.points.push(newPoint);
        controlData.visible = true;
        
        console.log(`✅ Control point added to ${connectionId}. Total: ${controlData.points.length}`, newPoint);
        
        // Re-render connection
        this.renderConnection(connectionId);
        
        // Show control points
        setTimeout(() => {
            console.log(`👁️ Attempting to show control points for ${connectionId}`);
            this.showControlPoints(connectionId);
        }, 50);
        
        return true;
    }

    /**
     * Add interpolation point at the best position along the curve near click
     */
    addInterpolationPointAtPosition(connectionId, clickX, clickY) {
        const connection = this.connections.get(connectionId);
        if (!connection) return false;
        
        const interpolationData = this.interpolationPoints.get(connectionId);
        if (!interpolationData) return false;
        
        // Get connection endpoints
        const fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
        const toNode = this.mindMap.nodes.find(n => n.id === connection.to);
        if (!fromNode || !toNode) return false;
        
        const { startX, startY, endX, endY } = this.calculateConnectionPoints(fromNode, toNode);
        
        // Find the best position to insert the new point
        const insertPosition = this.findOptimalInsertPosition(
            connectionId, startX, startY, endX, endY, clickX, clickY
        );
        
        if (insertPosition === -1) return false;
        
        // Create new interpolation point
        const newPoint = {
            id: `ip_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            x: clickX,
            y: clickY,
            index: insertPosition
        };
        
        // Insert at the calculated position
        interpolationData.points.splice(insertPosition, 0, newPoint);
        interpolationData.visible = true;
        
        // Update indices for points after the inserted one
        for (let i = insertPosition + 1; i < interpolationData.points.length; i++) {
            interpolationData.points[i].index = i;
        }
        
        // Re-render connection
        this.renderConnection(connectionId);
        
        // Show interpolation points
        setTimeout(() => {
            this.showInterpolationPoints(connectionId);
        }, 50);
        
        console.log(`➕ Interpolation point added to ${connectionId}. Total: ${interpolationData.points.length}`);
        return true;
    }

    /**
     * Find optimal position to insert new interpolation point
     */
    findOptimalInsertPosition(connectionId, startX, startY, endX, endY, clickX, clickY) {
        const interpolationData = this.interpolationPoints.get(connectionId);
        
        // Build current point sequence
        const currentPoints = [
            { x: startX, y: startY },
            ...interpolationData.points,
            { x: endX, y: endY }
        ];
        
        let bestPosition = -1;
        let minDistance = Infinity;
        
        // Find the best position by checking distances to each segment
        for (let i = 0; i < currentPoints.length - 1; i++) {
            const p1 = currentPoints[i];
            const p2 = currentPoints[i + 1];
            
            // Calculate distance from click point to line segment
            const distance = this.pointToLineSegmentDistance(clickX, clickY, p1.x, p1.y, p2.x, p2.y);
            const segmentLength = Math.sqrt((p2.x - p1.x) ** 2 + (p2.y - p1.y) ** 2);
            
            // Prefer segments that are longer and closer to click
            const score = distance / Math.max(segmentLength / 100, 1);
            
            if (score < minDistance && segmentLength > this.interpolationSettings.minDistance) {
                minDistance = score;
                bestPosition = i; // Insert after point i, which is index i in interpolationData.points
            }
        }
        
        // Check minimum distance constraint
        if (minDistance > 100) return -1; // Too far from any segment
        
        return bestPosition;
    }

    /**
     * Calculate distance from point to line segment
     */
    pointToLineSegmentDistance(px, py, x1, y1, x2, y2) {
        const A = px - x1;
        const B = py - y1;
        const C = x2 - x1;
        const D = y2 - y1;
        
        const dot = A * C + B * D;
        const lenSq = C * C + D * D;
        
        let param = -1;
        if (lenSq !== 0) {
            param = dot / lenSq;
        }
        
        let xx, yy;
        if (param < 0) {
            xx = x1;
            yy = y1;
        } else if (param > 1) {
            xx = x2;
            yy = y2;
        } else {
            xx = x1 + param * C;
            yy = y1 + param * D;
        }
        
        const dx = px - xx;
        const dy = py - yy;
        return Math.sqrt(dx * dx + dy * dy);
    }

    /**
     * Show control points for a connection
     */
    showControlPoints(connectionId) {
        console.log(`👁️ showControlPoints called for ${connectionId}`);
        
        const controlData = this.controlPoints.get(connectionId);
        console.log(`📊 Control data:`, controlData);
        
        if (!controlData || controlData.points.length === 0) {
            console.log(`❌ No control data or points for ${connectionId}`);
            return;
        }
        
        // Hide other connection's control points
        this.hideAllControlPoints();
        
        controlData.visible = true;
        this.selectedConnection = connectionId;
        
        console.log(`🎯 Creating handles for ${controlData.points.length} control points`);
        console.log(`🎯 Control layer:`, this.controlLayer);
        
        // Create visual handles for each control point
        controlData.points.forEach((point, index) => {
            console.log(`🎨 Creating handle ${index + 1}/${controlData.points.length}:`, point);
            this.createControlPointHandle(connectionId, point, index);
        });
        
        // Re-render connection with selection styling
        this.renderConnection(connectionId);
        
        console.log(`✅ Showing ${controlData.points.length} control points for ${connectionId}`);
        console.log(`✅ Control layer children count:`, this.controlLayer.children.length);
    }

    /**
     * Show interpolation points for a connection
     */
    showInterpolationPoints(connectionId) {
        console.log(`👁️ showInterpolationPoints called for ${connectionId}`);
        
        const interpolationData = this.interpolationPoints.get(connectionId);
        console.log(`📊 Interpolation data:`, interpolationData);
        
        if (!interpolationData || interpolationData.points.length === 0) {
            console.log(`❌ No interpolation data or points for ${connectionId}`);
            return;
        }
        
        // Hide all other points first
        this.hideAllInterpolationPoints();
        
        interpolationData.visible = true;
        this.selectedConnection = connectionId;
        
        console.log(`🎯 Creating handles for ${interpolationData.points.length} interpolation points`);
        
        // Create visual handles for each interpolation point
        interpolationData.points.forEach((point, index) => {
            console.log(`🎨 Creating handle ${index + 1}/${interpolationData.points.length}:`, point);
            this.createInterpolationPointHandle(connectionId, point, index);
        });
        
        // Re-render connection with selection styling
        this.renderConnection(connectionId);
        
        console.log(`✅ Showing ${interpolationData.points.length} interpolation points for ${connectionId}`);
    }

    /**
     * Hide all interpolation points
     */
    hideAllInterpolationPoints() {
        // Remove all interpolation point handles
        const handles = this.controlLayer.querySelectorAll('.interpolation-point-handle');
        handles.forEach(handle => handle.remove());
        
        // Update visibility state
        for (const interpolationData of this.interpolationPoints.values()) {
            interpolationData.visible = false;
        }
        
        const previouslySelected = this.selectedConnection;
        this.selectedConnection = null;
        
        // Re-render previously selected connection to remove selection styling
        if (previouslySelected) {
            this.renderConnection(previouslySelected);
        }
        
        console.log('🙈 All interpolation points hidden');
    }

    /**
     * Create a draggable interpolation point handle
     */
    createInterpolationPointHandle(connectionId, point, index) {
        console.log(`🎨 Creating interpolation point handle for ${connectionId} at (${point.x}, ${point.y}), index: ${index}`);
        console.log(`🎨 Control layer:`, this.controlLayer);
        
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handle.setAttribute('class', 'interpolation-point-handle');
        handle.setAttribute('data-connection-id', connectionId);
        handle.setAttribute('data-point-id', point.id);
        handle.setAttribute('transform', `translate(${point.x}, ${point.y})`);
        handle.style.opacity = '1'; // Ensure visibility
        
        console.log(`🎨 Handle created:`, handle);
        
        // Visual circle - different style from control points
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'interpolation-point-circle');
        circle.setAttribute('r', '9'); // Made larger for better visibility
        circle.setAttribute('fill', '#10B981'); // Green color for interpolation points
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '3'); // Thicker stroke for visibility
        circle.style.filter = 'drop-shadow(0 3px 6px rgba(16,185,129,0.6))';
        
        console.log(`🎨 Circle created:`, circle);
        
        // Hit area for easier interaction
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitArea.setAttribute('class', 'interpolation-point-hit-area');
        hitArea.setAttribute('r', '25'); // Made larger for easier clicking
        hitArea.setAttribute('fill', 'rgba(16,185,129,0.1)'); // Slightly visible for debugging
        hitArea.setAttribute('stroke', '#10B981'); // Visible stroke for debugging
        hitArea.setAttribute('stroke-width', '1');
        hitArea.style.cursor = 'move';
        hitArea.style.pointerEvents = 'all';
        
        console.log(`🎨 Hit area created:`, hitArea);
        
        // Index indicator for debugging/development
        const indexText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        indexText.setAttribute('x', '0');
        indexText.setAttribute('y', '-15');
        indexText.setAttribute('text-anchor', 'middle');
        indexText.setAttribute('fill', '#10B981');
        indexText.setAttribute('font-size', '12');
        indexText.setAttribute('font-weight', 'bold');
        indexText.style.pointerEvents = 'none';
        indexText.textContent = index + 1; // 1-based index for user
        
        console.log(`🎨 Index text created:`, indexText);
        
        handle.appendChild(circle);
        handle.appendChild(hitArea);
        handle.appendChild(indexText);
        
        // Add behaviors
        this.addInterpolationPointDragBehavior(handle, hitArea, connectionId, point.id);
        this.addInterpolationPointDeleteBehavior(handle, hitArea, connectionId, point.id);
        this.addInterpolationPointHoverEffects(handle, circle);
        
        console.log(`🎨 Adding handle to control layer:`, this.controlLayer);
        this.controlLayer.appendChild(handle);
        console.log(`🎨 Handle added. Control layer children count:`, this.controlLayer.children.length);
        
        // Skip animation for now to debug visibility
        // this.animateInterpolationPointIn(handle, index);
        console.log(`🎨 Interpolation point handle should be visible at (${point.x}, ${point.y})`);
        
        return handle;
    }

    /**
     * Add drag behavior to interpolation point
     */
    addInterpolationPointDragBehavior(handle, hitArea, connectionId, pointId) {
        let isDragging = false;
        
        hitArea.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            isDragging = true;
            this.isDraggingControlPoint = true; // Reuse the same flag
            this.dragTarget = { connectionId, pointId, handle, type: 'interpolation' };
            
            hitArea.setPointerCapture(e.pointerId);
            
            // Visual feedback
            const circle = handle.querySelector('.interpolation-point-circle');
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', '#059669'); // Darker green when dragging
            circle.style.filter = 'drop-shadow(0 4px 8px rgba(5,150,105,0.6))';
            hitArea.style.cursor = 'grabbing';
            
            handle.classList.add('dragging');
            
            console.log('🖱️ Interpolation point drag started:', pointId);
        });
        
        hitArea.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Convert to world coordinates
            const worldX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
            const worldY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
            
            // Update interpolation point position
            this.updateInterpolationPointPosition(connectionId, pointId, worldX, worldY);
            
            // Move handle visually
            handle.setAttribute('transform', `translate(${worldX}, ${worldY})`);
            
            // Re-render connection smoothly
            this.scheduleConnectionRender(connectionId);
        });
        
        hitArea.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            this.isDraggingControlPoint = false;
            this.dragTarget = null;
            
            hitArea.releasePointerCapture(e.pointerId);
            
            // Reset visual feedback
            const circle = handle.querySelector('.interpolation-point-circle');
            circle.setAttribute('r', '6');
            circle.setAttribute('fill', '#10B981');
            circle.style.filter = 'drop-shadow(0 2px 4px rgba(16,185,129,0.4))';
            hitArea.style.cursor = 'move';
            
            handle.classList.remove('dragging');
            
            // Final render
            this.renderConnection(connectionId);
            
            console.log('🖱️ Interpolation point drag ended:', pointId);
        });
    }

    /**
     * Add delete behavior to interpolation point
     */
    addInterpolationPointDeleteBehavior(handle, hitArea, connectionId, pointId) {
        let clickCount = 0;
        let clickTimer = null;
        
        hitArea.addEventListener('click', (e) => {
            e.stopPropagation();
            clickCount++;
            
            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                clickCount = 0;
                this.deleteInterpolationPoint(connectionId, pointId);
            }
        });
        
        hitArea.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.deleteInterpolationPoint(connectionId, pointId);
        });
    }

    /**
     * Add hover effects to interpolation point
     */
    addInterpolationPointHoverEffects(handle, circle) {
        const hitArea = handle.querySelector('.interpolation-point-hit-area');
        
        hitArea.addEventListener('mouseenter', () => {
            if (!this.isDraggingControlPoint) {
                circle.setAttribute('r', '7');
                circle.style.filter = 'drop-shadow(0 3px 6px rgba(16,185,129,0.6))';
            }
        });
        
        hitArea.addEventListener('mouseleave', () => {
            if (!this.isDraggingControlPoint) {
                circle.setAttribute('r', '6');
                circle.style.filter = 'drop-shadow(0 2px 4px rgba(16,185,129,0.4))';
            }
        });
    }

    /**
     * Animate interpolation point appearance
     */
    animateInterpolationPointIn(handle, index) {
        handle.style.opacity = '0';
        handle.style.transform = handle.getAttribute('transform') + ' scale(0)';
        handle.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        setTimeout(() => {
            handle.style.opacity = '1';
            handle.style.transform = handle.getAttribute('transform') + ' scale(1)';
            
            setTimeout(() => {
                handle.style.transition = '';
            }, 400);
        }, index * 80); // Slightly faster than control points
    }

    /**
     * Update interpolation point position in data
     */
    updateInterpolationPointPosition(connectionId, pointId, x, y) {
        const interpolationData = this.interpolationPoints.get(connectionId);
        if (!interpolationData) return;
        
        const point = interpolationData.points.find(p => p.id === pointId);
        if (point) {
            point.x = x;
            point.y = y;
        }
    }

    /**
     * Delete an interpolation point
     */
    deleteInterpolationPoint(connectionId, pointId) {
        const interpolationData = this.interpolationPoints.get(connectionId);
        if (!interpolationData) return;
        
        const pointIndex = interpolationData.points.findIndex(p => p.id === pointId);
        if (pointIndex === -1) return;
        
        // Animate out
        const handle = document.querySelector(`[data-connection-id="${connectionId}"][data-point-id="${pointId}"].interpolation-point-handle`);
        if (handle) {
            handle.style.transition = 'all 0.3s ease-out';
            handle.style.transform = handle.getAttribute('transform') + ' scale(0)';
            handle.style.opacity = '0';
            
            setTimeout(() => {
                if (handle.parentNode) {
                    handle.remove();
                }
            }, 300);
        }
        
        // Remove from data and update indices
        interpolationData.points.splice(pointIndex, 1);
        
        // Update indices for remaining points
        for (let i = pointIndex; i < interpolationData.points.length; i++) {
            interpolationData.points[i].index = i;
        }
        
        // Update connection
        setTimeout(() => {
            this.renderConnection(connectionId);
            if (interpolationData.points.length > 0) {
                this.showInterpolationPoints(connectionId);
            } else {
                interpolationData.visible = false;
                this.selectedConnection = null;
            }
        }, 150);
        
        console.log(`🗑️ Interpolation point deleted. Remaining: ${interpolationData.points.length}`);
    }

    /**
     * Toggle interpolation point visibility
     */
    toggleInterpolationPointVisibility(connectionId) {
        const interpolationData = this.interpolationPoints.get(connectionId);
        if (!interpolationData) return;
        
        if (interpolationData.visible) {
            this.hideAllInterpolationPoints();
        } else {
            this.showInterpolationPoints(connectionId);
        }
    }

    /**
     * Hide all control points
     */
    hideAllControlPoints() {
        console.log('🙈 hideAllControlPoints called');
        console.log('🙈 Stack trace:', new Error().stack);
        
        // Remove all control point handles
        const handles = this.controlLayer.querySelectorAll('.control-point-handle');
        console.log('🙈 Removing', handles.length, 'control point handles');
        handles.forEach(handle => handle.remove());
        
        // Update visibility state
        for (const controlData of this.controlPoints.values()) {
            controlData.visible = false;
        }
        
        const previouslySelected = this.selectedConnection;
        this.selectedConnection = null;
        
        // Re-render previously selected connection to remove selection styling
        if (previouslySelected) {
            this.renderConnection(previouslySelected);
        }
        
        console.log('🙈 All control points hidden');
    }

    /**
     * Create a draggable control point handle
     */
    createControlPointHandle(connectionId, point, index) {
        console.log(`🎨 Creating control point handle for ${connectionId} at (${point.x}, ${point.y}), index: ${index}`);
        console.log(`🎨 Control layer:`, this.controlLayer);
        
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handle.setAttribute('class', 'control-point-handle');
        handle.setAttribute('data-connection-id', connectionId);
        handle.setAttribute('data-point-id', point.id);
        handle.setAttribute('transform', `translate(${point.x}, ${point.y})`);
        handle.style.opacity = '1'; // Ensure visibility
        handle.style.display = 'block'; // Force display
        handle.style.visibility = 'visible'; // Force visibility
        handle.style.zIndex = '9999'; // Force high z-index
        handle.style.pointerEvents = 'all'; // Ensure interactivity
        
        console.log(`🎨 Handle created:`, handle);
        
        // Visual circle - made larger and more prominent
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'control-point-circle');
        circle.setAttribute('r', '12'); // Larger for better visibility
        circle.setAttribute('fill', '#FF6B35'); // Orange color
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '3');
        circle.style.filter = 'drop-shadow(0 3px 6px rgba(255,107,53,0.5))';
        circle.style.opacity = '1';
        circle.style.visibility = 'visible';
        
        console.log(`🎨 Control point circle created with radius 12 and orange color`);
        
        // Hit area for easier interaction - made larger
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitArea.setAttribute('class', 'control-point-hit-area');
        hitArea.setAttribute('r', '25');
        hitArea.setAttribute('fill', 'rgba(255,107,53,0.1)'); // Slightly visible for debugging
        hitArea.setAttribute('stroke', '#FF6B35');
        hitArea.setAttribute('stroke-width', '1');
        hitArea.setAttribute('stroke-dasharray', '2,2');
        hitArea.style.cursor = 'move';
        hitArea.style.pointerEvents = 'all';
        
        // Index indicator for control points (1, 2)
        const indexText = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        indexText.setAttribute('x', '0');
        indexText.setAttribute('y', '-18');
        indexText.setAttribute('text-anchor', 'middle');
        indexText.setAttribute('fill', '#FF6B35');
        indexText.setAttribute('font-size', '14');
        indexText.setAttribute('font-weight', 'bold');
        indexText.style.pointerEvents = 'none';
        indexText.textContent = `C${index + 1}`; // C1, C2 for control points
        
        handle.appendChild(circle);
        handle.appendChild(hitArea);
        handle.appendChild(indexText);
        
        // Add behaviors
        this.addControlPointDragBehavior(handle, hitArea, connectionId, point.id);
        this.addControlPointDeleteBehavior(handle, hitArea, connectionId, point.id);
        this.addControlPointHoverEffects(handle, circle);
        
        console.log(`🎨 Adding handle to control layer:`, this.controlLayer);
        this.controlLayer.appendChild(handle);
        console.log(`🎨 Handle added. Control layer children count:`, this.controlLayer.children.length);
        
        // Skip animation for debugging - set directly visible
        // this.animateControlPointIn(handle, index);
        
        // Comprehensive debugging of visual properties
        setTimeout(() => {
            console.log('🔍 === CONTROL POINT VISIBILITY DEBUG ===');
            console.log(`🔍 Handle element:`, handle);
            console.log(`🔍 Handle in DOM:`, document.contains(handle));
            console.log(`🔍 Handle parent:`, handle.parentElement);
            console.log(`🔍 Handle transform:`, handle.getAttribute('transform'));
            console.log(`🔍 Handle class:`, handle.getAttribute('class'));
            console.log(`🔍 Handle style.opacity:`, handle.style.opacity);
            console.log(`🔍 Handle style.display:`, handle.style.display);
            console.log(`🔍 Handle style.visibility:`, handle.style.visibility);
            console.log(`🔍 Handle style.zIndex:`, handle.style.zIndex);
            
            // Check computed styles
            const computedStyle = getComputedStyle(handle);
            console.log(`🔍 Computed opacity:`, computedStyle.opacity);
            console.log(`🔍 Computed display:`, computedStyle.display);
            console.log(`🔍 Computed visibility:`, computedStyle.visibility);
            console.log(`🔍 Computed zIndex:`, computedStyle.zIndex);
            console.log(`🔍 Computed transform:`, computedStyle.transform);
            
            // Check control layer properties
            console.log(`🔍 Control layer:`, this.controlLayer);
            console.log(`🔍 Control layer children:`, this.controlLayer.children.length);
            console.log(`🔍 Control layer style.opacity:`, this.controlLayer.style.opacity);
            console.log(`🔍 Control layer style.display:`, this.controlLayer.style.display);
            console.log(`🔍 Control layer style.visibility:`, this.controlLayer.style.visibility);
            
            // Check canvas/SVG hierarchy
            console.log(`🔍 Canvas:`, this.canvas);
            console.log(`🔍 Canvas viewBox:`, this.canvas.getAttribute('viewBox'));
            console.log(`🔍 Canvas style:`, this.canvas.style.cssText);
            
            // Check circle element specifically
            const circle = handle.querySelector('.control-point-circle');
            if (circle) {
                console.log(`🔍 Circle element:`, circle);
                console.log(`🔍 Circle r:`, circle.getAttribute('r'));
                console.log(`🔍 Circle fill:`, circle.getAttribute('fill'));
                console.log(`🔍 Circle stroke:`, circle.getAttribute('stroke'));
                console.log(`🔍 Circle stroke-width:`, circle.getAttribute('stroke-width'));
                console.log(`🔍 Circle style.filter:`, circle.style.filter);
            }
            
            // Check position in viewport
            const bbox = handle.getBBox ? handle.getBBox() : null;
            console.log(`🔍 Handle bounding box:`, bbox);
            
            console.log('🔍 === END DEBUG ===');
        }, 100);
        
        console.log(`🎨 Control point handle should be visible at (${point.x}, ${point.y})`);
        
        return handle;
    }

    /**
     * Add drag behavior to control point
     */
    addControlPointDragBehavior(handle, hitArea, connectionId, pointId) {
        let isDragging = false;
        
        hitArea.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            isDragging = true;
            this.isDraggingControlPoint = true;
            this.dragTarget = { connectionId, pointId, handle };
            
            hitArea.setPointerCapture(e.pointerId);
            
            // Visual feedback
            const circle = handle.querySelector('.control-point-circle');
            circle.setAttribute('r', '10');
            circle.setAttribute('fill', '#FF8C00');
            circle.style.filter = 'drop-shadow(0 4px 8px rgba(255,140,0,0.6))';
            hitArea.style.cursor = 'grabbing';
            
            handle.classList.add('dragging');
            
            console.log('🖱️ Control point drag started:', pointId);
        });
        
        hitArea.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Convert to world coordinates
            const worldX = this.viewBox.x + (mouseX / rect.width) * this.viewBox.width;
            const worldY = this.viewBox.y + (mouseY / rect.height) * this.viewBox.height;
            
            // Update control point position
            this.updateControlPointPosition(connectionId, pointId, worldX, worldY);
            
            // Move handle visually
            handle.setAttribute('transform', `translate(${worldX}, ${worldY})`);
            
            // Re-render connection smoothly
            this.scheduleConnectionRender(connectionId);
        });
        
        hitArea.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            
            isDragging = false;
            this.isDraggingControlPoint = false;
            this.dragTarget = null;
            
            hitArea.releasePointerCapture(e.pointerId);
            
            // Reset visual feedback
            const circle = handle.querySelector('.control-point-circle');
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', '#FF6B35');
            circle.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
            hitArea.style.cursor = 'move';
            
            handle.classList.remove('dragging');
            
            // Final render
            this.renderConnection(connectionId);
            
            console.log('🖱️ Control point drag ended:', pointId);
        });
    }

    /**
     * Add delete behavior to control point
     */
    addControlPointDeleteBehavior(handle, hitArea, connectionId, pointId) {
        let clickCount = 0;
        let clickTimer = null;
        
        hitArea.addEventListener('click', (e) => {
            e.stopPropagation();
            clickCount++;
            
            if (clickCount === 1) {
                clickTimer = setTimeout(() => {
                    clickCount = 0;
                }, 300);
            } else if (clickCount === 2) {
                clearTimeout(clickTimer);
                clickCount = 0;
                this.deleteControlPoint(connectionId, pointId);
            }
        });
        
        hitArea.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            this.deleteControlPoint(connectionId, pointId);
        });
    }

    /**
     * Add hover effects to control point
     */
    addControlPointHoverEffects(handle, circle) {
        const hitArea = handle.querySelector('.control-point-hit-area');
        
        hitArea.addEventListener('mouseenter', () => {
            if (!this.isDraggingControlPoint) {
                circle.setAttribute('r', '9');
                circle.style.filter = 'drop-shadow(0 3px 6px rgba(255,107,53,0.5))';
            }
        });
        
        hitArea.addEventListener('mouseleave', () => {
            if (!this.isDraggingControlPoint) {
                circle.setAttribute('r', '8');
                circle.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
            }
        });
    }

    /**
     * Animate control point appearance
     */
    animateControlPointIn(handle, index) {
        handle.style.opacity = '0';
        handle.style.transform = handle.getAttribute('transform') + ' scale(0)';
        handle.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        setTimeout(() => {
            handle.style.opacity = '1';
            handle.style.transform = handle.getAttribute('transform') + ' scale(1)';
            
            setTimeout(() => {
                handle.style.transition = '';
            }, 300);
        }, index * 100);
    }

    /**
     * Update control point position in data
     */
    updateControlPointPosition(connectionId, pointId, x, y) {
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData) return;
        
        const point = controlData.points.find(p => p.id === pointId);
        if (point) {
            point.x = x;
            point.y = y;
        }
    }

    /**
     * Delete a control point
     */
    deleteControlPoint(connectionId, pointId) {
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData) return;
        
        const pointIndex = controlData.points.findIndex(p => p.id === pointId);
        if (pointIndex === -1) return;
        
        // Animate out
        const handle = document.querySelector(`[data-connection-id="${connectionId}"][data-point-id="${pointId}"]`);
        if (handle) {
            handle.style.transition = 'all 0.3s ease-out';
            handle.style.transform = handle.getAttribute('transform') + ' scale(0)';
            handle.style.opacity = '0';
            
            setTimeout(() => {
                if (handle.parentNode) {
                    handle.remove();
                }
            }, 300);
        }
        
        // Remove from data
        controlData.points.splice(pointIndex, 1);
        
        // Update connection
        setTimeout(() => {
            this.renderConnection(connectionId);
            if (controlData.points.length > 0) {
                this.showControlPoints(connectionId);
            } else {
                controlData.visible = false;
                this.selectedConnection = null;
            }
        }, 150);
        
        console.log(`🗑️ Control point deleted. Remaining: ${controlData.points.length}`);
    }

    /**
     * Schedule connection render (throttled)
     */
    scheduleConnectionRender(connectionId) {
        if (this.pendingRenders.has(connectionId)) return;
        
        this.pendingRenders.add(connectionId);
        
        requestAnimationFrame(() => {
            if (this.pendingRenders.has(connectionId)) {
                this.renderConnection(connectionId);
                this.pendingRenders.delete(connectionId);
            }
        });
    }

    /**
     * Toggle control point visibility
     */
    toggleControlPointVisibility(connectionId) {
        const controlData = this.controlPoints.get(connectionId);
        if (!controlData || controlData.points.length === 0) return;
        
        if (controlData.visible) {
            this.hideAllControlPoints();
        } else {
            this.showControlPoints(connectionId);
        }
    }

    /**
     * Select a connection
     */
    selectConnection(connectionId) {
        this.selectedConnection = connectionId;
        this.renderConnection(connectionId);
        
        // Show control points if they exist
        const controlData = this.controlPoints.get(connectionId);
        if (controlData && controlData.points.length > 0) {
            this.showControlPoints(connectionId);
        }
    }

    /**
     * Toggle connection selection
     */
    toggleConnectionSelection(connectionId) {
        if (this.selectedConnection === connectionId) {
            this.deselectAllConnections();
        } else {
            this.selectConnection(connectionId);
        }
    }

    /**
     * Deselect all connections
     */
    deselectAllConnections() {
        this.hideAllControlPoints();
    }

    /**
     * Remove visual elements for a connection
     */
    removeConnectionElements(connectionId) {
        const elements = this.connectionLayer.querySelectorAll(`[data-connection-id="${connectionId}"]`);
        elements.forEach(el => el.remove());
        
        const controlHandles = this.controlLayer.querySelectorAll(`[data-connection-id="${connectionId}"].control-point-handle`);
        controlHandles.forEach(handle => handle.remove());
        
        const interpolationHandles = this.controlLayer.querySelectorAll(`[data-connection-id="${connectionId}"].interpolation-point-handle`);
        interpolationHandles.forEach(handle => handle.remove());
    }

    /**
     * Show connection context menu
     */
    showConnectionContextMenu(event, connectionId) {
        console.log('🔗 Connection context menu:', connectionId);
        
        const interpolationData = this.interpolationPoints.get(connectionId);
        const controlData = this.controlPoints.get(connectionId);
        
        // Create context menu
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.cssText = `
            position: fixed;
            left: ${event.clientX}px;
            top: ${event.clientY}px;
            background: white;
            border: 1px solid #ccc;
            border-radius: 4px;
            padding: 4px 0;
            box-shadow: 0 2px 10px rgba(0,0,0,0.2);
            z-index: 1000;
            min-width: 200px;
        `;
        
        const menuItems = [
            {
                text: '🟢 Add Interpolation Point',
                action: () => {
                    // Add interpolation point at connection center
                    const connection = this.connections.get(connectionId);
                    const fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
                    const toNode = this.mindMap.nodes.find(n => n.id === connection.to);
                    const centerX = (fromNode.x + toNode.x) / 2;
                    const centerY = (fromNode.y + toNode.y) / 2;
                    this.addInterpolationPointAtPosition(connectionId, centerX, centerY);
                    this.showTemporaryFeedback('Interpolation point added!', centerX, centerY, '#10b981');
                }
            },
            {
                text: '🟠 Add Control Point', 
                action: () => {
                    const connection = this.connections.get(connectionId);
                    const fromNode = this.mindMap.nodes.find(n => n.id === connection.from);
                    const toNode = this.mindMap.nodes.find(n => n.id === connection.to);
                    const centerX = (fromNode.x + toNode.x) / 2;
                    const centerY = (fromNode.y + toNode.y) / 2 - 50; // Offset above center
                    this.addControlPoint(connectionId, centerX, centerY);
                    this.showTemporaryFeedback('Control point added!', centerX, centerY, '#f97316');
                }
            },
            {
                text: interpolationData?.visible ? '👁️ Hide Interpolation Points' : '👁️ Show Interpolation Points',
                action: () => this.toggleInterpolationPointVisibility(connectionId)
            },
            {
                text: controlData?.visible ? '👁️ Hide Control Points' : '👁️ Show Control Points',
                action: () => this.toggleControlPointVisibility(connectionId)
            },
            {
                text: '🗑️ Delete Connection',
                action: () => this.deleteConnection(connectionId)
            }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('div');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.text;
            menuItem.style.cssText = `
                padding: 8px 12px;
                cursor: pointer;
                font-size: 14px;
            `;
            menuItem.addEventListener('mouseenter', () => {
                menuItem.style.backgroundColor = '#f0f0f0';
            });
            menuItem.addEventListener('mouseleave', () => {
                menuItem.style.backgroundColor = 'transparent';
            });
            menuItem.addEventListener('click', () => {
                item.action();
                menu.remove();
            });
            menu.appendChild(menuItem);
        });
        
        // Remove menu when clicking elsewhere
        const removeMenu = () => {
            menu.remove();
            document.removeEventListener('click', removeMenu);
        };
        setTimeout(() => document.addEventListener('click', removeMenu), 100);
        
        document.body.appendChild(menu);
    }

    /**
     * Show temporary feedback
     */
    showTemporaryFeedback(message, x, y, color = '#38BDF8') {
        const feedback = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        feedback.setAttribute('class', 'temporary-feedback');
        feedback.setAttribute('transform', `translate(${x}, ${y})`);
        
        const bg = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        bg.setAttribute('r', '20');
        bg.setAttribute('fill', color);
        bg.setAttribute('fill-opacity', '0.2');
        bg.setAttribute('stroke', color);
        bg.setAttribute('stroke-width', '2');
        
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

    /**
     * Clear all connections
     */
    clearAllConnections() {
        this.connectionLayer.innerHTML = '';
        this.controlLayer.innerHTML = '';
        this.connections.clear();
        this.controlPoints.clear();
        this.interpolationPoints.clear();
        this.selectedConnection = null;
        this.mindMap.connections = [];
        
        console.log('🧹 All connections cleared');
    }

    /**
     * Get connection data for export
     */
    exportConnections() {
        const connectionsData = [];
        
        for (const [id, connection] of this.connections) {
            const controlData = this.controlPoints.get(id);
            const interpolationData = this.interpolationPoints.get(id);
            connectionsData.push({
                ...connection,
                controlPoints: controlData ? controlData.points : [],
                interpolationPoints: interpolationData ? interpolationData.points : []
            });
        }
        
        return connectionsData;
    }

    /**
     * Import connections data
     */
    importConnections(connectionsData) {
        this.clearAllConnections();
        
        connectionsData.forEach(connectionData => {
            const { controlPoints, interpolationPoints, ...connection } = connectionData;
            
            this.connections.set(connection.id, connection);
            this.mindMap.connections.push(connection);
            
            this.controlPoints.set(connection.id, {
                points: controlPoints || [],
                visible: false
            });
            
            this.interpolationPoints.set(connection.id, {
                points: interpolationPoints || [],
                visible: false
            });
        });
        
        this.renderAllConnections();
        console.log(`📥 Imported ${connectionsData.length} connections`);
    }
}

// Export for use
window.ConnectionManager = ConnectionManager;