/**
 * Control Points Module for Mind Map Connections
 * Handles all control point creation, manipulation, and interaction
 */

class ControlPointsManager {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.canvas = mindMap.canvas;
        this.controlLayer = mindMap.controlLayer;
        this.connectionControlPoints = mindMap.connectionControlPoints;
        
        // Track active drag state
        this.isDragging = false;
        this.dragTarget = null;
        this.dragStartPos = { x: 0, y: 0 };
        
        console.log('🎯 ControlPointsManager initialized');
    }

    /**
     * Create a control point handle for a connection
     */
    createControlPointHandle(connectionId, point, index) {
        console.log('📍 Creating control point handle:', { connectionId, point, index });
        
        const handle = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        handle.setAttribute('class', 'control-point-handle');
        handle.setAttribute('data-connection-id', connectionId);
        handle.setAttribute('data-point-id', point.id);
        handle.setAttribute('transform', `translate(${point.x}, ${point.y})`);
        
        // Create visible circle
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('class', 'control-point-circle');
        circle.setAttribute('r', '8');
        circle.setAttribute('fill', '#FF6B35');
        circle.setAttribute('stroke', '#FFFFFF');
        circle.setAttribute('stroke-width', '2');
        circle.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
        
        // Create larger invisible hit area for easier interaction
        const hitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        hitArea.setAttribute('class', 'control-point-hit-area');
        hitArea.setAttribute('r', '20');
        hitArea.setAttribute('fill', 'transparent');
        hitArea.style.cursor = 'move';
        hitArea.style.pointerEvents = 'all';
        
        handle.appendChild(circle);
        handle.appendChild(hitArea);
        
        // Add interaction behaviors
        this.addDragBehavior(handle, hitArea, connectionId, point.id);
        this.addDeleteBehavior(handle, hitArea, connectionId, point.id);
        this.addHoverEffects(handle, circle);
        
        this.controlLayer.appendChild(handle);
        
        // Animate in
        this.animateControlPointIn(handle, index);
        
        console.log('✅ Control point handle created and added to DOM');
        return handle;
    }

    /**
     * Add drag behavior to control point
     */
    addDragBehavior(handle, hitArea, connectionId, pointId) {
        let isDragging = false;
        let dragStart = { x: 0, y: 0 };
        
        hitArea.addEventListener('pointerdown', (e) => {
            e.stopPropagation();
            e.preventDefault();
            
            console.log('🔥 Control point drag started:', { connectionId, pointId });
            
            isDragging = true;
            this.isDragging = true;
            this.dragTarget = { connectionId, pointId, handle };
            
            // Capture pointer
            hitArea.setPointerCapture(e.pointerId);
            
            // Store start position
            const rect = this.canvas.getBoundingClientRect();
            dragStart.x = e.clientX - rect.left;
            dragStart.y = e.clientY - rect.top;
            
            // Visual feedback
            const circle = handle.querySelector('.control-point-circle');
            circle.setAttribute('r', '10');
            circle.setAttribute('fill', '#FF8C00');
            circle.style.filter = 'drop-shadow(0 4px 8px rgba(255,140,0,0.6))';
            hitArea.style.cursor = 'grabbing';
            
            handle.classList.add('dragging');
        });
        
        hitArea.addEventListener('pointermove', (e) => {
            if (!isDragging) return;
            e.preventDefault();
            
            const rect = this.canvas.getBoundingClientRect();
            const mouseX = e.clientX - rect.left;
            const mouseY = e.clientY - rect.top;
            
            // Convert to world coordinates
            const worldX = this.mindMap.viewBox.x + (mouseX / rect.width) * this.mindMap.viewBox.width;
            const worldY = this.mindMap.viewBox.y + (mouseY / rect.height) * this.mindMap.viewBox.height;
            
            // Update control point position
            this.updateControlPointPosition(connectionId, pointId, worldX, worldY);
            
            // Move the handle visually
            handle.setAttribute('transform', `translate(${worldX}, ${worldY})`);
            
            // Re-render connection with updated curve
            requestAnimationFrame(() => {
                this.mindMap.renderConnections();
            });
        });
        
        hitArea.addEventListener('pointerup', (e) => {
            if (!isDragging) return;
            
            console.log('🔥 Control point drag ended');
            
            isDragging = false;
            this.isDragging = false;
            this.dragTarget = null;
            
            // Release pointer
            hitArea.releasePointerCapture(e.pointerId);
            
            // Reset visual feedback
            const circle = handle.querySelector('.control-point-circle');
            circle.setAttribute('r', '8');
            circle.setAttribute('fill', '#FF6B35');
            circle.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
            hitArea.style.cursor = 'move';
            
            handle.classList.remove('dragging');
            
            // Final render
            this.mindMap.renderConnections();
        });
    }

    /**
     * Add delete behavior (double-click and right-click)
     */
    addDeleteBehavior(handle, hitArea, connectionId, pointId) {
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
                
                console.log('🗑️ Double-click delete control point:', { connectionId, pointId });
                this.deleteControlPoint(connectionId, pointId);
            }
        });
        
        hitArea.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            e.stopPropagation();
            
            console.log('🗑️ Right-click delete control point:', { connectionId, pointId });
            this.deleteControlPoint(connectionId, pointId);
        });
    }

    /**
     * Add hover effects
     */
    addHoverEffects(handle, circle) {
        const hitArea = handle.querySelector('.control-point-hit-area');
        
        hitArea.addEventListener('mouseenter', () => {
            if (!this.isDragging) {
                circle.setAttribute('r', '9');
                circle.style.filter = 'drop-shadow(0 3px 6px rgba(255,107,53,0.5))';
            }
        });
        
        hitArea.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                circle.setAttribute('r', '8');
                circle.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.3))';
            }
        });
    }

    /**
     * Animate control point appearance
     */
    animateControlPointIn(handle, index) {
        // Start invisible and scaled down
        handle.style.opacity = '0';
        handle.style.transform = handle.getAttribute('transform') + ' scale(0)';
        handle.style.transition = 'all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        // Staggered animation
        setTimeout(() => {
            handle.style.opacity = '1';
            handle.style.transform = handle.getAttribute('transform') + ' scale(1)';
            
            // Remove transition after animation
            setTimeout(() => {
                handle.style.transition = '';
            }, 300);
        }, index * 100);
    }

    /**
     * Update control point position in data structure
     */
    updateControlPointPosition(connectionId, pointId, x, y) {
        const controlData = this.connectionControlPoints.get(connectionId);
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
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData) return;
        
        // Find and remove the control point
        const pointIndex = controlData.points.findIndex(p => p.id === pointId);
        if (pointIndex === -1) return;
        
        // Animate out the handle
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
            this.mindMap.renderConnections();
            if (controlData.visible && controlData.points.length > 0) {
                this.showControlPoints(connectionId);
            } else {
                controlData.visible = false;
            }
        }, 150);
        
        console.log(`✅ Control point deleted. Remaining: ${controlData.points.length}`);
    }

    /**
     * Add control point to connection at click position
     */
    addControlPoint(connectionId, worldX, worldY) {
        console.log('➕ Adding control point:', { connectionId, worldX, worldY });
        
        let controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData) {
            controlData = { points: [], visible: false };
            this.connectionControlPoints.set(connectionId, controlData);
        }
        
        // Create new control point
        const newPoint = {
            id: `cp_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            x: worldX,
            y: worldY
        };
        
        // Add to array (limit to 2 control points for cubic bezier)
        if (controlData.points.length < 2) {
            controlData.points.push(newPoint);
            controlData.visible = true;
            
            // Re-render connection
            this.mindMap.renderConnections();
            
            // Show control points
            setTimeout(() => {
                this.showControlPoints(connectionId);
            }, 50);
            
            console.log(`✅ Control point added. Total: ${controlData.points.length}`);
            return true;
        } else {
            console.log('⚠️ Maximum control points reached (2)');
            return false;
        }
    }

    /**
     * Show control points for a connection
     */
    showControlPoints(connectionId) {
        console.log('👁️ Showing control points for:', connectionId);
        
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData || controlData.points.length === 0) {
            console.log('⚠️ No control points to show');
            return;
        }
        
        // Hide all other control points first
        this.hideAllControlPoints();
        
        // Mark this connection's control points as visible
        controlData.visible = true;
        
        // Create handles for each control point
        controlData.points.forEach((point, index) => {
            this.createControlPointHandle(connectionId, point, index);
        });
        
        console.log(`✅ Showing ${controlData.points.length} control points`);
    }

    /**
     * Hide all control points
     */
    hideAllControlPoints() {
        // Remove all existing control point handles
        const existingHandles = this.controlLayer.querySelectorAll('.control-point-handle');
        existingHandles.forEach(handle => {
            handle.remove();
        });
        
        // Mark all as not visible
        this.connectionControlPoints.forEach(controlData => {
            controlData.visible = false;
        });
        
        console.log('🙈 All control points hidden');
    }

    /**
     * Toggle control point visibility for a connection
     */
    toggleControlPoints(connectionId) {
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData || controlData.points.length === 0) {
            console.log('⚠️ No control points to toggle');
            return;
        }
        
        if (controlData.visible) {
            this.hideAllControlPoints();
        } else {
            this.showControlPoints(connectionId);
        }
        
        console.log(`🔄 Toggled control points for ${connectionId}: ${controlData.visible ? 'visible' : 'hidden'}`);
    }

    /**
     * Clear all control points for a connection (make it straight)
     */
    clearControlPoints(connectionId) {
        const controlData = this.connectionControlPoints.get(connectionId);
        if (!controlData) return;
        
        // Animate out all handles
        const handles = this.controlLayer.querySelectorAll(`[data-connection-id="${connectionId}"]`);
        handles.forEach(handle => {
            handle.style.transition = 'all 0.3s ease-out';
            handle.style.transform = handle.getAttribute('transform') + ' scale(0)';
            handle.style.opacity = '0';
            
            setTimeout(() => {
                if (handle.parentNode) {
                    handle.remove();
                }
            }, 300);
        });
        
        // Clear data
        controlData.points = [];
        controlData.visible = false;
        
        // Re-render connection
        setTimeout(() => {
            this.mindMap.renderConnections();
        }, 150);
        
        console.log('🧹 Control points cleared - connection is now straight');
    }
}

// Export for use in main script
window.ControlPointsManager = ControlPointsManager;