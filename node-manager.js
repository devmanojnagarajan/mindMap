/**
 * Node Manager Module for Mind Map
 * Handles all node-related functionality including:
 * - Node creation, deletion, and updates
 * - Visual rendering with shapes, images, and styling
 * - Interactive behaviors (drag, select, edit)
 * - Node customization and appearance management
 * - Clipboard operations and context menus
 */

class NodeManager {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.canvas = mindMap.canvas;
        this.nodeLayer = mindMap.nodeLayer;
        
        // Node storage and management
        this.nodes = new Map(); // id -> node data
        this.nodeIdCounter = 1;
        this.selectedNodes = new Set();
        this.selectedNode = null;
        
        // Interaction state
        this.isDragging = false;
        this.dragTarget = null;
        this.dragStartPos = { x: 0, y: 0 };
        this.dragOffset = { x: 0, y: 0 };
        
        // Clipboard for copy/paste operations
        this.clipboard = [];
        
        // Node defaults
        this.defaultNodeStyle = {
            fontFamily: 'Poppins',
            fontSize: 14,
            fontWeight: 400,
            textColor: '#F9FAFB',
            textAlign: 'center',
            backgroundColor: '#374151',
            borderColor: '#4B5563'
        };
        
        this.defaultNodeShape = {
            type: 'circle',
            width: 80,
            height: 80,
            cornerRadius: 15
        };
        
        this.setupEventListeners();
    }

    /**
     * Setup global event listeners for node interactions
     */
    setupEventListeners() {
        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Delete' && (this.selectedNodes.size > 0 || (this.mindMap.connectionManager && this.mindMap.connectionManager.selectedConnection))) {
                
                // Delete selected nodes
                if (this.selectedNodes.size > 0) {
                    this.deleteSelectedNodes();
                }
                
                // Delete selected connections
                if (this.mindMap.connectionManager && this.mindMap.connectionManager.selectedConnection) {
                    this.mindMap.connectionManager.deleteConnection(this.mindMap.connectionManager.selectedConnection);
                }
            }
            if (e.key === 'Escape') {
                this.deselectAllNodes();
            }
            if (e.ctrlKey || e.metaKey) {
                if (e.key === 'c') {
                    e.preventDefault();
                    this.copySelectedNodes();
                }
                if (e.key === 'v') {
                    e.preventDefault();
                    this.pasteNodes();
                }
                if (e.key === 'a') {
                    e.preventDefault();
                    this.selectAllNodes();
                    
                    // Also select all connections if connection manager exists
                    if (this.mindMap.connectionManager) {
                        // For now, just ensure we can delete connections when selected individually
                        // TODO: Implement multi-connection selection in connection manager
                    }
                }
            }
        });
    }

    /**
     * Create a new node
     */
    createNode(x, y, text = 'New Node', options = {}) {
        const nodeId = `node_${this.nodeIdCounter++}`;
        
        const node = {
            id: nodeId,
            x: x,
            y: y,
            text: text,
            radius: options.radius || 40,
            image: options.image || null,
            imagePosition: options.imagePosition || 'before',
            shape: { ...this.defaultNodeShape, ...options.shape },
            style: { ...this.defaultNodeStyle, ...options.style },
            metadata: options.metadata || {},
            created: Date.now(),
            modified: Date.now()
        };
        
        this.nodes.set(nodeId, node);
        
        // Add to mindMap nodes array for compatibility
        this.mindMap.nodes.push(node);
        
        // Update minimap bounds
        this.updateMinimapBounds(x, y);
        
        // Render the node
        this.renderNode(node);
        
        return node;
    }

    /**
     * Add node with automatic positioning and connection logic
     */
    addNode(x = null, y = null, text = 'New Node') {
        // Determine position if not specified
        if (x === null || y === null) {
            if (this.selectedNode) {
                const parentNode = this.selectedNode;
                const angle = Math.random() * 2 * Math.PI;
                const distance = 150;
                x = parentNode.x + Math.cos(angle) * distance;
                y = parentNode.y + Math.sin(angle) * distance;
            } else {
                x = Math.random() * (this.mindMap.viewBox.width - 200) + 100;
                y = Math.random() * (this.mindMap.viewBox.height - 200) + 100;
            }
        }
        
        // Create node
        const newNode = this.createNode(x, y, text);
        
        // Create connection to parent if there was a selected node
        if (this.selectedNode && this.mindMap.connectionManager) {
            this.mindMap.connectionManager.createConnection(this.selectedNode, newNode);
        }
        
        // Select the new node
        this.selectNode(newNode);
        
        return newNode;
    }

    /**
     * Delete a node and cleanup connections
     */
    deleteNode(nodeId) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        // Remove from visual layer
        const nodeElement = this.nodeLayer.querySelector(`[data-node-id="${nodeId}"]`);
        if (nodeElement) {
            // Animate out
            nodeElement.style.transition = 'all 0.3s ease-out';
            nodeElement.style.transform = nodeElement.getAttribute('transform') + ' scale(0)';
            nodeElement.style.opacity = '0';
            
            setTimeout(() => {
                if (nodeElement.parentNode) {
                    nodeElement.remove();
                }
            }, 300);
        }
        
        // Remove from data structures
        this.nodes.delete(nodeId);
        this.selectedNodes.delete(nodeId);
        
        // Remove from mindMap nodes array
        const index = this.mindMap.nodes.findIndex(n => n.id === nodeId);
        if (index !== -1) {
            this.mindMap.nodes.splice(index, 1);
        }
        
        // Clear selection if this was the selected node
        if (this.selectedNode && this.selectedNode.id === nodeId) {
            this.selectedNode = null;
        }
        
        // Delete related connections
        if (this.mindMap.connectionManager) {
            this.deleteNodeConnections(nodeId);
        }
        
        return true;
    }

    /**
     * Delete all connections related to a node
     */
    deleteNodeConnections(nodeId) {
        const connectionsToDelete = [];
        
        for (const [connectionId, connection] of this.mindMap.connectionManager.connections) {
            if (connection.from === nodeId || connection.to === nodeId) {
                connectionsToDelete.push(connectionId);
            }
        }
        
        connectionsToDelete.forEach(connectionId => {
            this.mindMap.connectionManager.deleteConnection(connectionId);
        });
    }

    /**
     * Update node properties
     */
    updateNode(nodeId, updates) {
        const node = this.nodes.get(nodeId);
        if (!node) return false;
        
        // Apply updates
        Object.assign(node, updates);
        node.modified = Date.now();
        
        // Update in mindMap array
        const mindMapNode = this.mindMap.nodes.find(n => n.id === nodeId);
        if (mindMapNode) {
            Object.assign(mindMapNode, updates);
        }
        
        // Re-render node
        this.renderNode(node, true);
        
        // Update connections if position changed
        if (updates.x !== undefined || updates.y !== undefined) {
            if (this.mindMap.connectionManager) {
                this.mindMap.connectionManager.renderAllConnections();
            }
        }
        
        console.log('📝 Node updated:', nodeId);
        return true;
    }

    /**
     * Render a node with all its visual elements
     */
    renderNode(node, isUpdate = false) {
        // Remove existing node element if updating
        if (isUpdate) {
            const existing = this.nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
            if (existing) existing.remove();
        }
        
        // Update minimap bounds
        this.updateMinimapBounds(node.x, node.y);
        
        // Create node group
        const nodeGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        nodeGroup.setAttribute('class', 'node-group');
        nodeGroup.setAttribute('data-node-id', node.id);
        nodeGroup.setAttribute('transform', `translate(${node.x}, ${node.y})`);
        
        // Create node shape
        const shapeElement = this.createShapeElement(node);
        nodeGroup.appendChild(shapeElement);
        
        // Add image if present
        if (node.image) {
            const imageElement = this.createImageElement(node);
            if (imageElement) {
                nodeGroup.appendChild(imageElement);
            }
        }
        
        // Add text
        const textElement = this.createTextElement(node);
        nodeGroup.appendChild(textElement);
        
        // Add interaction behaviors
        this.addNodeInteractions(nodeGroup, node);
        
        // Add to layer
        this.nodeLayer.appendChild(nodeGroup);
        
        // Animate in if new node
        if (!isUpdate) {
            this.animateNodeIn(nodeGroup);
        }
        
        return nodeGroup;
    }

    /**
     * Create shape element based on node shape type
     */
    createShapeElement(node) {
        const shape = node.shape;
        const style = node.style;
        
        let shapeElement;
        
        switch (shape.type) {
            case 'rectangle':
                shapeElement = this.createRectangleShape(shape, style);
                break;
            case 'rounded-rectangle':
                shapeElement = this.createRoundedRectangleShape(shape, style);
                break;
            case 'triangle':
                shapeElement = this.createTriangleShape(shape, style);
                break;
            case 'diamond':
                shapeElement = this.createDiamondShape(shape, style);
                break;
            case 'hexagon':
                shapeElement = this.createHexagonShape(shape, style);
                break;
            case 'pentagon':
                shapeElement = this.createPentagonShape(shape, style);
                break;
            default: // circle
                shapeElement = this.createCircleShape(shape, style);
        }
        
        // Apply common styling
        shapeElement.setAttribute('fill', style.backgroundColor);
        shapeElement.setAttribute('stroke', style.borderColor);
        shapeElement.setAttribute('stroke-width', '2');
        shapeElement.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
        
        return shapeElement;
    }

    /**
     * Create circle shape
     */
    createCircleShape(shape, style) {
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('r', Math.max(shape.width, shape.height) / 2);
        return circle;
    }

    /**
     * Create rectangle shape
     */
    createRectangleShape(shape, style) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -shape.width / 2);
        rect.setAttribute('y', -shape.height / 2);
        rect.setAttribute('width', shape.width);
        rect.setAttribute('height', shape.height);
        return rect;
    }

    /**
     * Create rounded rectangle shape
     */
    createRoundedRectangleShape(shape, style) {
        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', -shape.width / 2);
        rect.setAttribute('y', -shape.height / 2);
        rect.setAttribute('width', shape.width);
        rect.setAttribute('height', shape.height);
        rect.setAttribute('rx', shape.cornerRadius || 10);
        rect.setAttribute('ry', shape.cornerRadius || 10);
        return rect;
    }

    /**
     * Create triangle shape
     */
    createTriangleShape(shape, style) {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const w = shape.width / 2;
        const h = shape.height / 2;
        polygon.setAttribute('points', `0,${-h} ${w},${h} ${-w},${h}`);
        return polygon;
    }

    /**
     * Create diamond shape
     */
    createDiamondShape(shape, style) {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const w = shape.width / 2;
        const h = shape.height / 2;
        polygon.setAttribute('points', `0,${-h} ${w},0 0,${h} ${-w},0`);
        return polygon;
    }

    /**
     * Create hexagon shape
     */
    createHexagonShape(shape, style) {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const w = shape.width / 2;
        const h = shape.height / 2;
        const points = [];
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x = w * Math.cos(angle);
            const y = h * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        polygon.setAttribute('points', points.join(' '));
        return polygon;
    }

    /**
     * Create pentagon shape
     */
    createPentagonShape(shape, style) {
        const polygon = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        const w = shape.width / 2;
        const h = shape.height / 2;
        const points = [];
        for (let i = 0; i < 5; i++) {
            const angle = (i * 2 * Math.PI) / 5 - Math.PI / 2;
            const x = w * Math.cos(angle);
            const y = h * Math.sin(angle);
            points.push(`${x},${y}`);
        }
        polygon.setAttribute('points', points.join(' '));
        return polygon;
    }

    /**
     * Create text element for node
     */
    createTextElement(node) {
        const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        text.setAttribute('class', 'node-text');
        text.setAttribute('text-anchor', 'middle');
        text.setAttribute('dominant-baseline', 'central');
        text.setAttribute('font-family', node.style.fontFamily);
        text.setAttribute('font-size', node.style.fontSize);
        text.setAttribute('font-weight', node.style.fontWeight);
        text.setAttribute('fill', node.style.textColor);
        text.style.pointerEvents = 'none';
        text.style.userSelect = 'none';
        
        // Handle multi-line text
        const lines = node.text.split('\n');
        if (lines.length === 1) {
            text.textContent = node.text;
        } else {
            lines.forEach((line, index) => {
                const tspan = document.createElementNS('http://www.w3.org/2000/svg', 'tspan');
                tspan.setAttribute('x', '0');
                tspan.setAttribute('dy', index === 0 ? '0' : '1.2em');
                tspan.textContent = line;
                text.appendChild(tspan);
            });
        }
        
        return text;
    }

    /**
     * Create image element for node
     */
    createImageElement(node) {
        if (!node.image) return null;
        
        const image = document.createElementNS('http://www.w3.org/2000/svg', 'image');
        image.setAttribute('class', 'node-image');
        
        // Position image based on imagePosition
        const imageSize = 30;
        let x, y;
        
        switch (node.imagePosition) {
            case 'before':
                x = -imageSize / 2;
                y = -node.shape.height / 2 - imageSize - 5;
                break;
            case 'after':
                x = -imageSize / 2;
                y = node.shape.height / 2 + 5;
                break;
            default:
                x = -imageSize / 2;
                y = -imageSize / 2;
        }
        
        image.setAttribute('x', x);
        image.setAttribute('y', y);
        image.setAttribute('width', imageSize);
        image.setAttribute('height', imageSize);
        image.setAttribute('href', node.image);
        image.style.pointerEvents = 'none';
        
        return image;
    }

    /**
     * Add interaction behaviors to node
     */
    addNodeInteractions(nodeGroup, node) {
        // Create separate hit areas for different interactions
        this.createNodeHitAreas(nodeGroup, node);
        
        // Double-click for editing (on the whole node)
        nodeGroup.addEventListener('dblclick', (e) => this.startNodeEditing(node));
        
        // Context menu (on the whole node)
        nodeGroup.addEventListener('contextmenu', (e) => this.showNodeContextMenu(e, node));
        
        // Hover effects
        this.addNodeHoverEffects(nodeGroup, node);
        
        // Make interactive
        nodeGroup.style.pointerEvents = 'all';
    }
    
    /**
     * Create separate hit areas for node interactions
     */
    createNodeHitAreas(nodeGroup, node) {
        const shape = node.shape;
        const nodeRadius = Math.max(shape.width, shape.height) / 2;
        
        // Create outer ring for connections using a proper ring shape (annulus)
        const outerRingGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
        outerRingGroup.setAttribute('class', 'node-outer-hit-group');
        
        // Create a proper ring (annulus) for connection area - only the ring area should be clickable
        const outerRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        outerRing.setAttribute('r', nodeRadius + 15);
        outerRing.setAttribute('fill', 'transparent');
        outerRing.setAttribute('stroke', 'transparent');
        outerRing.setAttribute('stroke-width', '30'); // Wide ring area for easy clicking
        outerRing.style.cursor = 'crosshair';
        outerRing.style.pointerEvents = 'all';
        
        // Create an inner hole to prevent clicks in the center from triggering connection
        const innerHole = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerHole.setAttribute('r', nodeRadius + 2);
        innerHole.setAttribute('fill', 'transparent');
        innerHole.style.pointerEvents = 'none'; // Allow clicks to pass through
        
        // Visual indicator ring (for showing connection possibility)
        const visualRing = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        visualRing.setAttribute('class', 'node-connection-indicator');
        visualRing.setAttribute('r', nodeRadius + 12);
        visualRing.setAttribute('fill', 'transparent');
        visualRing.setAttribute('stroke', '#38BDF8');
        visualRing.setAttribute('stroke-width', '3');
        visualRing.setAttribute('stroke-dasharray', '6,4');
        visualRing.style.opacity = '0'; // Hidden by default
        visualRing.style.transition = 'opacity 0.2s ease';
        visualRing.style.pointerEvents = 'none'; // Don't interfere with interaction
        visualRing.style.animation = 'dash 2s linear infinite';
        
        outerRingGroup.appendChild(outerRing);
        outerRingGroup.appendChild(innerHole);
        outerRingGroup.appendChild(visualRing);
        
        // Create inner hit area for moving/dragging (MUST NOT overlap with outer ring)
        const innerHitArea = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        innerHitArea.setAttribute('class', 'node-inner-hit-area');
        innerHitArea.setAttribute('r', nodeRadius); // Same size as the actual node, no overlap with outer ring
        innerHitArea.setAttribute('fill', 'transparent');
        innerHitArea.style.cursor = 'move';
        innerHitArea.style.pointerEvents = 'all';
        
        // Add event listeners for inner area (move/drag)
        innerHitArea.addEventListener('pointerdown', (e) => {
            this.handleNodePointerDown(e, node, innerHitArea);
        });
        
        // Add event listeners for outer ring (connections)
        outerRing.addEventListener('pointerdown', (e) => {
            // Only handle left mouse button clicks on outer ring
            if (e.button === 0) {
                this.handleNodeConnectionStart(e, node);
            }
        });
        
        // Show/hide connection indicator on hover
        nodeGroup.addEventListener('mouseenter', () => {
            visualRing.style.opacity = '1';
            outerRing.style.fill = 'rgba(56, 189, 248, 0.1)';
        });
        
        nodeGroup.addEventListener('mouseleave', () => {
            visualRing.style.opacity = '0';
            outerRing.style.fill = 'transparent';
        });
        
        // Add hit areas to node group - ORDER MATTERS!
        // Outer ring first (will be behind)
        nodeGroup.appendChild(outerRingGroup);
        // Inner area last (will be on top in center)
        nodeGroup.appendChild(innerHitArea);
        
    }
    
    /**
     * Handle connection start from node border
     */
    handleNodeConnectionStart(e, node) {
        e.preventDefault();
        e.stopPropagation();
        
        // CRITICAL: Disable any potential node dragging during connection creation
        this.isDragging = false;
        this.dragTarget = null;
        
        // Get starting node position
        const nodeGroup = this.nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
        const rect = this.canvas.getBoundingClientRect();
        
        // Use node center as start point
        const startPoint = { x: node.x, y: node.y };
        
        // Visual feedback - highlight source node (using only filter to avoid transform conflicts)
        nodeGroup.style.filter = 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.8)) brightness(1.1)';
        
        // Show drag connection line
        const dragLine = this.mindMap.dragConnectionLine;
        dragLine.style.display = 'block';
        dragLine.setAttribute('stroke', '#38BDF8');
        dragLine.setAttribute('stroke-width', '3');
        dragLine.setAttribute('stroke-dasharray', '5,5');
        dragLine.style.filter = 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.6))';
        
        let currentTarget = null;
        
        const handleMouseMove = (moveEvent) => {
            const mouseX = moveEvent.clientX - rect.left;
            const mouseY = moveEvent.clientY - rect.top;
            
            // Convert mouse position to world coordinates for the drag line
            const worldMouseX = this.mindMap.viewBox.x + (mouseX / rect.width) * this.mindMap.viewBox.width;
            const worldMouseY = this.mindMap.viewBox.y + (mouseY / rect.height) * this.mindMap.viewBox.height;
            
            // Update drag line
            dragLine.setAttribute('d', `M ${startPoint.x} ${startPoint.y} L ${worldMouseX} ${worldMouseY}`);
            
            // Temporarily hide drag line for accurate hit detection
            const originalDisplay = dragLine.style.display;
            dragLine.style.display = 'none';
            
            // Check for potential drop targets
            const element = document.elementFromPoint(moveEvent.clientX, moveEvent.clientY);
            const targetNodeGroup = element?.closest('[data-node-id]');
            const targetNodeId = targetNodeGroup?.getAttribute('data-node-id');
            
            // Restore drag line
            dragLine.style.display = originalDisplay;
            
            // Enhanced debug logging for hit detection (only when target changes)
            if (targetNodeId !== currentTarget) {
                // Target changed logic could go here if needed
            }
            
            // Debug logging (can be removed for production)
            if (targetNodeId && targetNodeId !== node.id) {
                // Target node detected
            }
            
            // Update target highlighting
            if (currentTarget && currentTarget !== targetNodeId) {
                // Remove previous highlight
                const prevTarget = this.nodeLayer.querySelector(`[data-node-id="${currentTarget}"]`);
                if (prevTarget) {
                    prevTarget.style.filter = '';
                }
            }
            
            if (targetNodeId && targetNodeId !== node.id && targetNodeId !== currentTarget) {
                // Highlight new target (using only filter to avoid transform conflicts)
                const targetElement = this.nodeLayer.querySelector(`[data-node-id="${targetNodeId}"]`);
                if (targetElement) {
                    targetElement.style.filter = 'drop-shadow(0 0 12px rgba(34, 197, 94, 0.8)) brightness(1.1)';
                }
            }
            
            const previousTarget = currentTarget;
            currentTarget = (targetNodeId && targetNodeId !== node.id) ? targetNodeId : null;
            
            // Debug logging for target detection
            if (currentTarget !== previousTarget) {
                // Target changed
            }
        };
        
        const handleMouseUp = (upEvent) => {
            
            // Hide drag line first to prevent it from blocking hit detection
            dragLine.style.display = 'none';
            
            // Final hit detection check at mouse up position (after hiding drag line)
            const finalElement = document.elementFromPoint(upEvent.clientX, upEvent.clientY);
            const finalTargetGroup = finalElement?.closest('[data-node-id]');
            const finalTargetId = finalTargetGroup?.getAttribute('data-node-id');
            
            
            // Use the final hit detection result, but fallback to currentTarget if available
            let actualTarget = (finalTargetId && finalTargetId !== node.id) ? finalTargetId : null;
            
            // If final hit detection failed but we had a target during mouse move, use that
            if (!actualTarget && currentTarget) {
                actualTarget = currentTarget;
            }
            
            // Remove source node highlight
            nodeGroup.style.filter = '';
            
            // Remove target highlight (check both currentTarget and actualTarget)
            if (currentTarget) {
                const targetElement = this.nodeLayer.querySelector(`[data-node-id="${currentTarget}"]`);
                if (targetElement) {
                    targetElement.style.filter = '';
                }
            }
            if (actualTarget && actualTarget !== currentTarget) {
                const targetElement = this.nodeLayer.querySelector(`[data-node-id="${actualTarget}"]`);
                if (targetElement) {
                    targetElement.style.filter = '';
                }
            }
            
            
            if (actualTarget) {
                const targetNode = this.nodes.get(actualTarget);
                
                if (targetNode && this.mindMap.connectionManager) {
                    this.mindMap.connectionManager.createConnection(node, targetNode);
                    this.showConnectionFeedback(node, targetNode);
                } else {
                    console.warn('Target node or connection manager not found:', { targetNode: !!targetNode, connectionManager: !!this.mindMap.connectionManager });
                }
            } else {
                // Create new node at drop location
                const mouseX = upEvent.clientX - rect.left;
                const mouseY = upEvent.clientY - rect.top;
                const worldX = this.mindMap.viewBox.x + (mouseX / rect.width) * this.mindMap.viewBox.width;
                const worldY = this.mindMap.viewBox.y + (mouseY / rect.height) * this.mindMap.viewBox.height;
                
                // Create new node at drop position
                const newNode = this.createNode(worldX, worldY, 'New Node');
                
                // Create connection to the new node
                if (this.mindMap.connectionManager) {
                    this.mindMap.connectionManager.createConnection(node, newNode);
                    this.showConnectionFeedback(node, newNode);
                }
            }
            
            // Clean up
            document.removeEventListener('pointermove', handleMouseMove);
            document.removeEventListener('pointerup', handleMouseUp);
        };
        
        document.addEventListener('pointermove', handleMouseMove);
        document.addEventListener('pointerup', handleMouseUp);
    }
    
    /**
     * Calculate connection point on node edge closest to mouse position
     */
    calculateNodeEdgePoint(node, mouseX, mouseY) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseCanvasX = mouseX - rect.left;
        const mouseCanvasY = mouseY - rect.top;
        
        // Convert to world coordinates
        const mouseWorldX = this.mindMap.viewBox.x + (mouseCanvasX / rect.width) * this.mindMap.viewBox.width;
        const mouseWorldY = this.mindMap.viewBox.y + (mouseCanvasY / rect.height) * this.mindMap.viewBox.height;
        
        // Calculate direction from node center to mouse
        const dx = mouseWorldX - node.x;
        const dy = mouseWorldY - node.y;
        const distance = Math.sqrt(dx * dx + dy * dy);
        
        if (distance === 0) return { x: node.x, y: node.y };
        
        // Get node radius (assuming circular for now)
        const nodeRadius = node.shape ? Math.max(node.shape.width, node.shape.height) / 2 : 40;
        
        // Calculate point on node edge
        const unitX = dx / distance;
        const unitY = dy / distance;
        
        const edgeX = node.x + unitX * nodeRadius;
        const edgeY = node.y + unitY * nodeRadius;
        
        // Convert back to canvas coordinates for the drag line
        const canvasX = ((edgeX - this.mindMap.viewBox.x) / this.mindMap.viewBox.width) * rect.width;
        const canvasY = ((edgeY - this.mindMap.viewBox.y) / this.mindMap.viewBox.height) * rect.height;
        
        return { x: canvasX, y: canvasY };
    }
    
    /**
     * Show brief success feedback when connection is created
     */
    showConnectionFeedback(fromNode, toNode) {
        // Create temporary success indicator
        const feedback = document.createElementNS('http://www.w3.org/2000/svg', 'text');
        feedback.setAttribute('x', (fromNode.x + toNode.x) / 2);
        feedback.setAttribute('y', (fromNode.y + toNode.y) / 2);
        feedback.setAttribute('text-anchor', 'middle');
        feedback.setAttribute('fill', '#10B981');
        feedback.setAttribute('font-size', '14');
        feedback.setAttribute('font-weight', 'bold');
        feedback.textContent = '✓ Connected';
        feedback.style.opacity = '1';
        feedback.style.transition = 'all 0.8s ease-out';
        
        this.nodeLayer.appendChild(feedback);
        
        // Animate out
        requestAnimationFrame(() => {
            feedback.style.opacity = '0';
            feedback.style.transform = 'translateY(-20px)';
        });
        
        setTimeout(() => {
            if (feedback.parentNode) {
                feedback.remove();
            }
        }, 800);
    }

    /**
     * Start connection creation with drag line
     */
    startConnectionCreation(e, sourceNode) {
        // Set up connection dragging state
        this.mindMap.isDraggingConnection = true;
        this.mindMap.connectionStart = sourceNode;
        
        const rect = this.canvas.getBoundingClientRect();
        const startPoint = { x: sourceNode.x, y: sourceNode.y };
        
        // Show drag connection line
        const dragLine = this.mindMap.dragConnectionLine;
        dragLine.style.display = 'block';
        dragLine.setAttribute('stroke', '#38BDF8');
        dragLine.setAttribute('stroke-width', '3');
        dragLine.setAttribute('stroke-dasharray', '5,5');
        dragLine.style.filter = 'drop-shadow(0 0 4px rgba(56, 189, 248, 0.6))';
        
        // Visual feedback - highlight source node
        const nodeGroup = this.nodeLayer.querySelector(`[data-node-id="${sourceNode.id}"]`);
        if (nodeGroup) {
            nodeGroup.style.filter = 'drop-shadow(0 0 12px rgba(59, 130, 246, 0.8)) brightness(1.1)';
        }
        
        this.currentTarget = null;
        this.hasFoundTarget = false; // Reset target found flag
    }
    
    /**
     * Switch from connection creation to node dragging mode
     */
    switchToNodeDragMode(sourceNode) {
        // Clean up connection creation visuals
        const dragLine = this.mindMap.dragConnectionLine;
        dragLine.style.display = 'none';
        
        // Remove source node highlight
        const sourceNodeGroup = this.nodeLayer.querySelector(`[data-node-id="${sourceNode.id}"]`);
        if (sourceNodeGroup) {
            sourceNodeGroup.style.filter = '';
        }
        
        // Reset connection state
        this.isCreatingConnection = false;
        this.mindMap.isDraggingConnection = false;
        this.mindMap.connectionStart = null;
        
        // Switch to node dragging mode
        this.isDragging = true;
    }
    
    /**
     * Handle connection dragging
     */
    handleConnectionDrag(e, sourceNode) {
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Convert mouse position to world coordinates for the drag line
        const worldMouseX = this.mindMap.viewBox.x + (mouseX / rect.width) * this.mindMap.viewBox.width;
        const worldMouseY = this.mindMap.viewBox.y + (mouseY / rect.height) * this.mindMap.viewBox.height;
        
        // Update drag line
        const dragLine = this.mindMap.dragConnectionLine;
        dragLine.setAttribute('d', `M ${sourceNode.x} ${sourceNode.y} L ${worldMouseX} ${worldMouseY}`);
        
        // Check for potential drop targets - temporarily hide drag line for accurate detection
        const originalDisplay = dragLine.style.display;
        dragLine.style.display = 'none';
        
        const element = document.elementFromPoint(e.clientX, e.clientY);
        const targetNodeGroup = element?.closest('[data-node-id]');
        const targetNodeId = targetNodeGroup?.getAttribute('data-node-id');
        
        // Restore drag line
        dragLine.style.display = originalDisplay;
        
        // Only log when target changes to reduce noise
        if (targetNodeId !== this.currentTarget) {
        }
        
        // If we've moved significantly and haven't found a target, switch to node drag mode
        if (!targetNodeId && !this.hasFoundTarget && this.initialPointerPos) {
            const deltaX = e.clientX - this.initialPointerPos.x;
            const deltaY = e.clientY - this.initialPointerPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance > this.dragThreshold * 3) { // Give more distance for connection attempt
                this.switchToNodeDragMode(sourceNode);
                return;
            }
        }
        
        // Track if we've ever found a valid target
        if (targetNodeId && targetNodeId !== sourceNode.id) {
            this.hasFoundTarget = true;
        }
        
        // Update target highlighting
        if (this.currentTarget && this.currentTarget !== targetNodeId) {
            // Remove previous highlight
            const prevTarget = this.nodeLayer.querySelector(`[data-node-id="${this.currentTarget}"]`);
            if (prevTarget) {
                prevTarget.style.filter = '';
            }
        }
        
        if (targetNodeId && targetNodeId !== sourceNode.id && targetNodeId !== this.currentTarget) {
            // Highlight new target
            const targetElement = this.nodeLayer.querySelector(`[data-node-id="${targetNodeId}"]`);
            if (targetElement) {
                targetElement.style.filter = 'drop-shadow(0 0 12px rgba(34, 197, 94, 0.8)) brightness(1.1)';
            }
        }
        
        this.currentTarget = (targetNodeId && targetNodeId !== sourceNode.id) ? targetNodeId : null;
    }
    
    /**
     * Complete connection creation
     */
    completeConnectionCreation(e, sourceNode) {
        
        // Use the current target we've been tracking during the drag
        const actualTarget = this.currentTarget;
        
        
        // Clean up visual elements
        const dragLine = this.mindMap.dragConnectionLine;
        dragLine.style.display = 'none';
        
        // Remove source node highlight
        const sourceNodeGroup = this.nodeLayer.querySelector(`[data-node-id="${sourceNode.id}"]`);
        if (sourceNodeGroup) {
            sourceNodeGroup.style.filter = '';
        }
        
        // Remove target highlight
        if (this.currentTarget) {
            const targetElement = this.nodeLayer.querySelector(`[data-node-id="${this.currentTarget}"]`);
            if (targetElement) {
                targetElement.style.filter = '';
            }
        }
        
        // Create connection if we have a valid target
        if (actualTarget) {
            const targetNode = this.nodes.get(actualTarget);
            if (targetNode && this.mindMap.connectionManager) {
                
                this.mindMap.connectionManager.createConnection(sourceNode, targetNode);
                this.showConnectionFeedback(sourceNode, targetNode);
            } else {
                console.warn('❌ Target node or connection manager not found');
            }
        } else {
        }
        
        // Reset connection state
        this.isCreatingConnection = false;
        this.mindMap.isDraggingConnection = false;
        this.mindMap.connectionStart = null;
        this.currentTarget = null;
        this.hasFoundTarget = false;
        this.connectionSourceNode = null;
        
        // Clean up drag state
        this.isDragging = false;
        this.dragTarget = null;
        this.initialPointerPos = null;
    }

    /**
     * Handle node pointer down (start drag or select)
     */
    handleNodePointerDown(e, node, hitArea) {
        e.preventDefault();
        e.stopPropagation();
        
        // Check for middle mouse button - use for connection creation from anywhere on the node
        if (e.button === 1) {
            this.handleNodeConnectionStart(e, node);
            return;
        }
        
        // Only proceed with normal interaction for left mouse button
        if (e.button !== 0) return;
        
        // Don't set isDragging immediately - wait for actual movement
        this.dragTarget = node;
        this.isDragging = false; // Will be set to true only when actual dragging starts
        
        const rect = this.canvas.getBoundingClientRect();
        this.dragStartPos.x = e.clientX - rect.left;
        this.dragStartPos.y = e.clientY - rect.top;
        
        // Calculate drag offset for when dragging actually starts
        const worldMouseX = this.mindMap.viewBox.x + (this.dragStartPos.x / rect.width) * this.mindMap.viewBox.width;
        const worldMouseY = this.mindMap.viewBox.y + (this.dragStartPos.y / rect.height) * this.mindMap.viewBox.height;
        
        this.dragOffset.x = worldMouseX - node.x;
        this.dragOffset.y = worldMouseY - node.y;
        
        // Store initial position to detect if dragging actually occurs
        this.initialPointerPos = { x: e.clientX, y: e.clientY };
        this.dragThreshold = 5; // pixels - minimum movement to start dragging
        
        // Handle selection immediately on mouse down (not on drag)
        // But don't select if we're in the middle of dragging a connection OR if another node is in connection creation mode
        if (!this.mindMap.isDraggingConnection && !this.mindMap.connectionStart && !this.isCreatingConnection) {
            if (e.ctrlKey || e.metaKey) {
                this.toggleNodeSelection(node);
            } else if (!this.selectedNodes.has(node.id)) {
                this.selectNode(node);
            }
        } else {
            // If this is a target node during connection creation, prevent further processing
            if (this.isCreatingConnection && this.connectionSourceNode && node.id !== this.connectionSourceNode.id) {
                e.preventDefault();
                e.stopPropagation();
                return;
            }
        }
        
        // Capture pointer for smooth dragging
        const nodeGroup = e.target.closest('.node-group');
        nodeGroup.setPointerCapture(e.pointerId);
        
        // Add temporary move and up listeners
        const handleMove = (moveEvent) => this.handleNodePointerMove(moveEvent, node);
        const handleUp = (upEvent) => {
            this.handleNodePointerUp(upEvent, node);
            // Remove temporary listeners
            document.removeEventListener('pointermove', handleMove);
            document.removeEventListener('pointerup', handleUp);
        };
        
        document.addEventListener('pointermove', handleMove);
        document.addEventListener('pointerup', handleUp);
        
    }

    /**
     * Handle node pointer move (drag)
     */
    handleNodePointerMove(e, node) {
        if (!this.dragTarget) return;
        
        // Check if we should start dragging based on movement threshold
        if (!this.isDragging && this.initialPointerPos) {
            const deltaX = e.clientX - this.initialPointerPos.x;
            const deltaY = e.clientY - this.initialPointerPos.y;
            const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
            
            if (distance < this.dragThreshold) {
                return; // Not enough movement to start dragging yet
            }
            
            // Start in connection creation mode initially - we'll switch to node dragging
            // if we don't find a target after moving a bit more
            this.isCreatingConnection = true;
            this.connectionSourceNode = node;
            this.startConnectionCreation(e, node);
        }
        
        if (this.isCreatingConnection) {
            // Handle connection creation dragging
            this.handleConnectionDrag(e, node);
            return;
        }
        
        if (!this.isDragging) return;
        
        const rect = this.canvas.getBoundingClientRect();
        const mouseX = e.clientX - rect.left;
        const mouseY = e.clientY - rect.top;
        
        // Convert to world coordinates
        const worldMouseX = this.mindMap.viewBox.x + (mouseX / rect.width) * this.mindMap.viewBox.width;
        const worldMouseY = this.mindMap.viewBox.y + (mouseY / rect.height) * this.mindMap.viewBox.height;
        
        // Calculate new position
        const newX = worldMouseX - this.dragOffset.x;
        const newY = worldMouseY - this.dragOffset.y;
        
        // Update all selected nodes if multiple selection
        if (this.selectedNodes.size > 1 && this.selectedNodes.has(node.id)) {
            const deltaX = newX - node.x;
            const deltaY = newY - node.y;
            
            this.selectedNodes.forEach(nodeId => {
                const selectedNode = this.nodes.get(nodeId);
                if (selectedNode) {
                    this.updateNodePosition(selectedNode, selectedNode.x + deltaX, selectedNode.y + deltaY);
                }
            });
        } else {
            // Update single node
            this.updateNodePosition(node, newX, newY);
        }
    }

    /**
     * Handle node pointer up (end drag)
     */
    handleNodePointerUp(e, node) {
        e.preventDefault();
        e.stopPropagation();
        
        // Handle connection creation completion
        if (this.isCreatingConnection) {
            this.completeConnectionCreation(e, node);
            return;
        }
        
        // Clean up drag state regardless of whether dragging actually occurred
        const wasDragging = this.isDragging;
        this.isDragging = false;
        this.dragTarget = null;
        this.initialPointerPos = null;
        
        if (!wasDragging) {
            // This was just a click, not a drag - no need for connection updates
            return;
        }
        
        // Release pointer capture
        const nodeGroup = e.target.closest('.node-group');
        if (nodeGroup) {
            nodeGroup.releasePointerCapture(e.pointerId);
        }
        
        // Update connections after drag
        if (this.mindMap.connectionManager) {
            this.mindMap.connectionManager.renderAllConnections();
        }
        
    }

    /**
     * Update node position
     */
    updateNodePosition(node, x, y) {
        node.x = x;
        node.y = y;
        node.modified = Date.now();
        
        // Update visual position
        const nodeGroup = this.nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
        if (nodeGroup) {
            nodeGroup.setAttribute('transform', `translate(${x}, ${y})`);
        }
        
        // Update minimap bounds
        this.updateMinimapBounds(x, y);
    }

    /**
     * Add hover effects to node
     */
    addNodeHoverEffects(nodeGroup, node) {
        nodeGroup.addEventListener('mouseenter', () => {
            if (!this.isDragging) {
                const shape = nodeGroup.querySelector('circle, rect, polygon');
                if (shape) {
                    shape.style.filter = 'drop-shadow(0 4px 8px rgba(0,0,0,0.2)) brightness(1.05)';
                    shape.style.transition = 'all 0.2s ease';
                }
            }
        });
        
        nodeGroup.addEventListener('mouseleave', () => {
            if (!this.isDragging) {
                const shape = nodeGroup.querySelector('circle, rect, polygon');
                if (shape) {
                    shape.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
                }
            }
        });
    }

    /**
     * Animate node appearance
     */
    animateNodeIn(nodeGroup) {
        nodeGroup.style.opacity = '0';
        nodeGroup.style.transform = nodeGroup.getAttribute('transform') + ' scale(0)';
        nodeGroup.style.transition = 'all 0.4s cubic-bezier(0.34, 1.56, 0.64, 1)';
        
        requestAnimationFrame(() => {
            nodeGroup.style.opacity = '1';
            nodeGroup.style.transform = nodeGroup.getAttribute('transform') + ' scale(1)';
            
            setTimeout(() => {
                nodeGroup.style.transition = '';
            }, 400);
        });
    }

    /**
     * Start inline text editing for node
     */
    startNodeEditing(node) {
        const nodeGroup = this.nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
        if (!nodeGroup) return;
        
        // Create input element
        const input = document.createElement('input');
        input.type = 'text';
        input.value = node.text;
        input.className = 'node-input';
        input.style.position = 'absolute';
        input.style.zIndex = '1000';
        input.style.background = node.style.backgroundColor;
        input.style.color = node.style.textColor;
        input.style.border = `2px solid ${node.style.borderColor}`;
        input.style.borderRadius = '4px';
        input.style.padding = '4px 8px';
        input.style.fontSize = node.style.fontSize + 'px';
        input.style.fontFamily = node.style.fontFamily;
        input.style.textAlign = node.style.textAlign;
        
        // Position input over node
        const rect = this.canvas.getBoundingClientRect();
        const canvasX = rect.left + (node.x - this.mindMap.viewBox.x) * rect.width / this.mindMap.viewBox.width;
        const canvasY = rect.top + (node.y - this.mindMap.viewBox.y) * rect.height / this.mindMap.viewBox.height;
        
        input.style.left = (canvasX - 60) + 'px';
        input.style.top = (canvasY - 10) + 'px';
        input.style.width = '120px';
        
        document.body.appendChild(input);
        input.focus();
        input.select();
        
        // Handle input completion
        const completeEditing = () => {
            const newText = input.value.trim() || 'New Node';
            this.updateNode(node.id, { text: newText });
            input.remove();
        };
        
        input.addEventListener('blur', completeEditing);
        input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                completeEditing();
            } else if (e.key === 'Escape') {
                input.remove();
            }
        });
    }

    /**
     * Select a node
     */
    selectNode(node, multiSelect = false) {
        
        // Set timestamp to prevent immediate clearing
        this.lastNodeSelectionTime = Date.now();
        
        if (!multiSelect) {
            // Deselect nodes without closing the panel - we'll open it for the new node
            this.deselectAllNodesWithoutClosingPanel();
        }
        
        this.selectedNodes.add(node.id);
        this.selectedNode = node;
        this.highlightNode(node);
        
        // Open properties panel for the selected node
        if (this.mindMap.panelManager) {
            this.mindMap.panelManager.open(node);
        }
        
    }

    /**
     * Toggle node selection
     */
    toggleNodeSelection(node) {
        if (this.selectedNodes.has(node.id)) {
            this.selectedNodes.delete(node.id);
            this.unhighlightNode(node);
            
            // Update selected node reference
            if (this.selectedNode && this.selectedNode.id === node.id) {
                this.selectedNode = this.selectedNodes.size > 0 
                    ? this.nodes.get([...this.selectedNodes][0])
                    : null;
            }
        } else {
            this.selectedNodes.add(node.id);
            this.selectedNode = node;
            this.highlightNode(node);
        }
    }

    /**
     * Deselect all nodes
     */
    deselectAllNodes() {
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) this.unhighlightNode(node);
        });
        
        this.selectedNodes.clear();
        this.selectedNode = null;
        
        // Close properties panel when no nodes are selected
        if (this.mindMap.panelManager) {
            this.mindMap.panelManager.forceClose();
        }
        
    }
    
    /**
     * Deselect all nodes without closing the properties panel
     * (used when switching to a new node selection)
     */
    deselectAllNodesWithoutClosingPanel() {
        
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) this.unhighlightNode(node);
        });
        
        this.selectedNodes.clear();
        this.selectedNode = null;
        
        // Don't close the panel - we're switching to a new node
    }

    /**
     * Select all nodes
     */
    selectAllNodes() {
        this.selectedNodes.clear();
        
        for (const node of this.nodes.values()) {
            this.selectedNodes.add(node.id);
            this.highlightNode(node);
        }
        
        if (this.nodes.size > 0) {
            this.selectedNode = [...this.nodes.values()][0];
        }
        
    }

    /**
     * Highlight selected node
     */
    highlightNode(node, highlightType = 'selected') {
        const nodeGroup = this.nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
        if (!nodeGroup) return;
        
        const shape = nodeGroup.querySelector('circle, rect, polygon');
        if (!shape) return;
        
        switch (highlightType) {
            case 'selected':
                shape.setAttribute('stroke', '#F59E0B');
                shape.setAttribute('stroke-width', '3');
                shape.style.filter = 'drop-shadow(0 0 8px rgba(245, 158, 11, 0.5))';
                break;
            case 'connecting':
                shape.setAttribute('stroke', '#10B981');
                shape.setAttribute('stroke-width', '3');
                shape.style.filter = 'drop-shadow(0 0 8px rgba(16, 185, 129, 0.5))';
                break;
            case 'multi-selected':
                shape.setAttribute('stroke', '#8B5CF6');
                shape.setAttribute('stroke-width', '3');
                shape.style.filter = 'drop-shadow(0 0 8px rgba(139, 92, 246, 0.5))';
                break;
        }
    }

    /**
     * Remove highlighting from node
     */
    unhighlightNode(node) {
        const nodeGroup = this.nodeLayer.querySelector(`[data-node-id="${node.id}"]`);
        if (!nodeGroup) return;
        
        const shape = nodeGroup.querySelector('circle, rect, polygon');
        if (!shape) return;
        
        shape.setAttribute('stroke', node.style.borderColor);
        shape.setAttribute('stroke-width', '2');
        shape.style.filter = 'drop-shadow(0 2px 4px rgba(0,0,0,0.1))';
    }

    /**
     * Clear all selections
     */
    clearSelection(force = false) {
        
        // Check if we recently selected a node (within last 1 second) and not forced
        if (!force && this.lastNodeSelectionTime && (Date.now() - this.lastNodeSelectionTime) < 1000) {
            return;
        }
        
        // Clear multi-selection
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) this.unhighlightNode(node);
        });
        this.selectedNodes.clear();
        
        // Clear single selection
        if (this.selectedNode) {
            this.unhighlightNode(this.selectedNode);
            this.selectedNode = null;
        }
        
        // Clear connection start (handled by main script)
        if (this.mindMap.connectionStart) {
            this.unhighlightNode(this.mindMap.connectionStart);
            this.mindMap.connectionStart = null;
        }
        
        // Close properties panel
        if (this.mindMap.panelManager) {
            this.mindMap.panelManager.forceClose();
        }
        
    }

    /**
     * Delete selected nodes
     */
    deleteSelectedNodes() {
        const nodeIds = [...this.selectedNodes];
        
        nodeIds.forEach(nodeId => {
            this.deleteNode(nodeId);
        });
        
        this.selectedNodes.clear();
        this.selectedNode = null;
        
    }

    /**
     * Copy selected nodes to clipboard
     */
    copySelectedNodes() {
        this.clipboard = [];
        
        this.selectedNodes.forEach(nodeId => {
            const node = this.nodes.get(nodeId);
            if (node) {
                this.clipboard.push({ ...node });
            }
        });
        
    }

    /**
     * Paste nodes from clipboard
     */
    pasteNodes(x = null, y = null) {
        if (this.clipboard.length === 0) return;
        
        // Calculate paste position
        const pasteX = x !== null ? x : (this.selectedNode ? this.selectedNode.x + 100 : 400);
        const pasteY = y !== null ? y : (this.selectedNode ? this.selectedNode.y + 50 : 300);
        
        // Clear current selection
        this.deselectAllNodes();
        
        // Paste nodes
        this.clipboard.forEach((nodeData, index) => {
            const offsetX = pasteX + (index * 20);
            const offsetY = pasteY + (index * 20);
            
            const pastedNode = this.createNode(offsetX, offsetY, nodeData.text, {
                shape: { ...nodeData.shape },
                style: { ...nodeData.style },
                image: nodeData.image,
                imagePosition: nodeData.imagePosition
            });
            
            this.selectNode(pastedNode, true);
        });
        
    }

    /**
     * Show context menu for node
     */
    showNodeContextMenu(event, node) {
        event.preventDefault();
        event.stopPropagation();
        
        // Hide existing context menu
        this.hideContextMenu();
        
        const menu = document.createElement('div');
        menu.className = 'context-menu';
        menu.style.left = event.clientX + 'px';
        menu.style.top = event.clientY + 'px';
        
        const menuItems = [
            { text: '✏️ Edit Text', action: () => this.startNodeEditing(node) },
            { text: '🎨 Customize', action: () => this.openNodeCustomization(node) },
            { text: '📋 Copy', action: () => { this.selectNode(node); this.copySelectedNodes(); } },
            { text: '📄 Paste', action: () => this.pasteNodes(node.x + 50, node.y + 50) },
            { text: '🗑️ Delete', action: () => this.deleteNode(node.id) }
        ];
        
        menuItems.forEach(item => {
            const menuItem = document.createElement('button');
            menuItem.className = 'context-menu-item';
            menuItem.textContent = item.text;
            menuItem.onclick = () => {
                item.action();
                this.hideContextMenu();
            };
            menu.appendChild(menuItem);
        });
        
        document.body.appendChild(menu);
        
        // Remove menu on click outside
        setTimeout(() => {
            document.addEventListener('click', () => this.hideContextMenu(), { once: true });
        }, 10);
    }

    /**
     * Hide context menu
     */
    hideContextMenu() {
        const menu = document.querySelector('.context-menu');
        if (menu) {
            menu.remove();
        }
    }

    /**
     * Open node customization panel
     */
    openNodeCustomization(node) {
        this.selectNode(node);
        if (this.mindMap.panelManager) {
            this.mindMap.panelManager.open(node);
        }
    }

    /**
     * Update minimap bounds
     */
    updateMinimapBounds(x, y) {
        if (!this.mindMap.minimapBounds) return;
        
        const padding = 200;
        this.mindMap.minimapBounds.x = Math.min(this.mindMap.minimapBounds.x, x - padding);
        this.mindMap.minimapBounds.y = Math.min(this.mindMap.minimapBounds.y, y - padding);
        this.mindMap.minimapBounds.width = Math.max(this.mindMap.minimapBounds.width, (x + padding) - this.mindMap.minimapBounds.x);
        this.mindMap.minimapBounds.height = Math.max(this.mindMap.minimapBounds.height, (y + padding) - this.mindMap.minimapBounds.y);
    }

    /**
     * Render all nodes
     */
    renderAllNodes() {
        this.nodeLayer.innerHTML = '';
        
        for (const node of this.nodes.values()) {
            this.renderNode(node);
        }
        
    }

    /**
     * Clear all nodes
     */
    clearAllNodes() {
        this.nodeLayer.innerHTML = '';
        this.nodes.clear();
        this.selectedNodes.clear();
        this.selectedNode = null;
        this.mindMap.nodes = [];
        this.nodeIdCounter = 1;
        
    }

    /**
     * Get node data for export
     */
    exportNodes() {
        return [...this.nodes.values()];
    }

    /**
     * Import node data
     */
    importNodes(nodeData) {
        this.clearAllNodes();
        
        nodeData.forEach(data => {
            const node = { ...data };
            this.nodes.set(node.id, node);
            this.mindMap.nodes.push(node);
            
            // Update counter to avoid ID conflicts
            const nodeNum = parseInt(node.id.split('_')[1]) || 0;
            this.nodeIdCounter = Math.max(this.nodeIdCounter, nodeNum + 1);
        });
        
        this.renderAllNodes();
    }

    /**
     * Find node by ID
     */
    getNode(nodeId) {
        return this.nodes.get(nodeId);
    }

    /**
     * Get all nodes
     */
    getAllNodes() {
        return [...this.nodes.values()];
    }

    /**
     * Get selected nodes
     */
    getSelectedNodes() {
        return [...this.selectedNodes].map(id => this.nodes.get(id)).filter(Boolean);
    }
}

// Export for use
window.NodeManager = NodeManager;