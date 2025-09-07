/**
 * History Manager - Handles undo/redo functionality for the mind map
 * Features:
 * - Captures snapshots of application state
 * - Manages undo/redo stack with configurable limits
 * - Supports different operation types (node, connection, bulk)
 * - Provides efficient state restoration
 */

class HistoryManager {
    constructor(mindMap, options = {}) {
        this.mindMap = mindMap;
        
        // Configuration
        this.maxHistorySize = options.maxHistorySize || 50;
        this.enableDebug = options.debug || false;
        
        // History stacks
        this.undoStack = [];
        this.redoStack = [];
        
        // Current operation tracking
        this.isRestoring = false;
        this.operationInProgress = false;
        
        // Debounce settings for batching operations
        this.batchTimeout = null;
        this.batchDelay = 500; // ms
        
        this.init();
    }
    
    init() {
        this.log('History Manager initialized');
        
        // Create initial snapshot
        this.saveInitialState();
    }
    
    /**
     * Save the initial state of the application
     */
    saveInitialState() {
        try {
            const initialState = this.captureState('initial', 'Application initialized');
            this.undoStack.push(initialState);
            this.log('Initial state saved');
        } catch (error) {
            console.error('Error saving initial state:', error);
            // Create a minimal initial state
            const fallbackState = {
                timestamp: Date.now(),
                operationType: 'initial',
                description: 'Application initialized (fallback)',
                nodes: [],
                connections: [],
                viewport: { x: 0, y: 0, zoom: 1 },
                selectedNodeId: null,
                selectedNodes: []
            };
            this.undoStack.push(fallbackState);
        }
    }
    
    /**
     * Capture current application state
     * @param {string} operationType - Type of operation (node, connection, bulk, etc.)
     * @param {string} description - Human-readable description
     * @returns {Object} State snapshot
     */
    captureState(operationType = 'unknown', description = '') {
        const nodeManager = this.mindMap.nodeManager;
        const connectionManager = this.mindMap.connectionManager;
        
        // Serialize nodes
        const nodes = [];
        try {
            if (nodeManager && nodeManager.nodes && typeof nodeManager.nodes.entries === 'function') {
                for (const [id, node] of nodeManager.nodes) {
                    if (node && typeof node === 'object') {
                        nodes.push({
                            id: node.id,
                            x: node.x || 0,
                            y: node.y || 0,
                            text: node.text || '',
                            style: node.style ? { ...node.style } : {},
                            shape: node.shape ? { ...node.shape } : {},
                            image: node.image ? { ...node.image } : null
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error serializing nodes:', error);
        }
        
        // Serialize connections
        const connections = [];
        try {
            if (connectionManager && connectionManager.connections && typeof connectionManager.connections.entries === 'function') {
                for (const [id, connection] of connectionManager.connections) {
                    if (connection && typeof connection === 'object') {
                        const controlPoints = connectionManager.controlPoints ? connectionManager.controlPoints.get(id) || [] : [];
                        connections.push({
                            id: connection.id,
                            from: connection.from,
                            to: connection.to,
                            controlPoints: Array.isArray(controlPoints) ? 
                                controlPoints.map(cp => ({ x: cp.x || 0, y: cp.y || 0 })) : []
                        });
                    }
                }
            }
        } catch (error) {
            console.error('Error serializing connections:', error);
        }
        
        // Capture viewport state
        const viewport = {
            x: (this.mindMap.viewBox && this.mindMap.viewBox.x) || 0,
            y: (this.mindMap.viewBox && this.mindMap.viewBox.y) || 0,
            zoom: this.mindMap.zoomLevel || 1
        };
        
        const state = {
            timestamp: Date.now(),
            operationType,
            description,
            nodes,
            connections,
            viewport,
            selectedNodeId: this.mindMap.selectedNode?.id || null,
            selectedNodes: Array.from(this.mindMap.selectedNodes || [])
        };
        
        this.log(`State captured: ${operationType} - ${description}`, { nodes: nodes.length, connections: connections.length });
        
        return state;
    }
    
    /**
     * Save current state to undo stack
     * @param {string} operationType - Type of operation
     * @param {string} description - Description of the operation
     */
    saveState(operationType, description = '') {
        if (this.isRestoring) {
            this.log('Skipping save during restore operation');
            return;
        }
        
        const state = this.captureState(operationType, description);
        
        // Clear redo stack when new action is performed
        this.redoStack = [];
        
        // Add to undo stack
        this.undoStack.push(state);
        
        // Limit stack size
        if (this.undoStack.length > this.maxHistorySize) {
            this.undoStack.shift();
        }
        
        this.log(`State saved: ${operationType} - ${description}`);
        this.updateUIState();
    }
    
    /**
     * Start a batch operation to group multiple changes
     * @param {string} operationType - Type of operation
     * @param {string} description - Description of the batch operation
     */
    startBatch(operationType, description) {
        this.operationInProgress = true;
        this.batchOperationType = operationType;
        this.batchDescription = description;
        
        this.log(`Batch operation started: ${operationType} - ${description}`);
    }
    
    /**
     * End a batch operation and save the state
     */
    endBatch() {
        if (!this.operationInProgress) return;
        
        this.operationInProgress = false;
        
        // Clear any pending batch timeout
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
            this.batchTimeout = null;
        }
        
        this.saveState(this.batchOperationType, this.batchDescription);
        
        this.log(`Batch operation ended: ${this.batchOperationType} - ${this.batchDescription}`);
    }
    
    /**
     * Save state with debouncing for rapid operations
     * @param {string} operationType - Type of operation
     * @param {string} description - Description of the operation
     */
    saveStateDebounced(operationType, description = '') {
        if (this.isRestoring || this.operationInProgress) return;
        
        // Clear existing timeout
        if (this.batchTimeout) {
            clearTimeout(this.batchTimeout);
        }
        
        // Set new timeout
        this.batchTimeout = setTimeout(() => {
            this.saveState(operationType, description);
            this.batchTimeout = null;
        }, this.batchDelay);
    }
    
    /**
     * Restore application state
     * @param {Object} state - State to restore
     */
    restoreState(state) {
        this.log(`Restoring state: ${state.operationType} - ${state.description}`);
        
        this.isRestoring = true;
        
        try {
            const nodeManager = this.mindMap.nodeManager;
            const connectionManager = this.mindMap.connectionManager;
            
            // Clear current state
            if (nodeManager && typeof nodeManager.clearAllNodes === 'function') {
                nodeManager.clearAllNodes();
            } else if (nodeManager) {
                // Fallback: clear nodes manually
                nodeManager.nodes.clear();
                this.mindMap.nodes = [];
            }
            if (connectionManager && typeof connectionManager.clearAllConnections === 'function') {
                connectionManager.clearAllConnections();
            } else if (connectionManager) {
                // Fallback: clear connections manually
                connectionManager.connections.clear();
                this.mindMap.connections = [];
            }
            
            // Restore nodes
            for (const nodeData of state.nodes) {
                if (nodeManager) {
                    let node;
                    if (typeof nodeManager.createNode === 'function') {
                        // Create node and then update its ID
                        node = nodeManager.createNode(nodeData.x, nodeData.y, nodeData.text);
                        if (node) {
                            // Manually set the ID to match the saved state
                            const oldId = node.id;
                            node.id = nodeData.id;
                            
                            // Update in nodeManager's map
                            nodeManager.nodes.delete(oldId);
                            nodeManager.nodes.set(nodeData.id, node);
                            
                            // Update in mindMap array
                            const mindMapNodeIndex = this.mindMap.nodes.findIndex(n => n.id === oldId);
                            if (mindMapNodeIndex !== -1) {
                                this.mindMap.nodes[mindMapNodeIndex].id = nodeData.id;
                            }
                        }
                    } else {
                        // Fallback: create node manually
                        node = {
                            id: nodeData.id,
                            x: nodeData.x,
                            y: nodeData.y,
                            text: nodeData.text,
                            style: { ...nodeData.style },
                            shape: { ...nodeData.shape },
                            image: nodeData.image ? { ...nodeData.image } : null
                        };
                        nodeManager.nodes.set(nodeData.id, node);
                        this.mindMap.nodes.push(node);
                    }
                    
                    if (node) {
                        // Apply saved styling
                        if (nodeData.style) {
                            Object.assign(node.style, nodeData.style);
                        }
                        if (nodeData.shape) {
                            Object.assign(node.shape, nodeData.shape);
                        }
                        if (nodeData.image) {
                            node.image = { ...nodeData.image };
                        }
                        
                        if (typeof nodeManager.updateNodeVisual === 'function') {
                            nodeManager.updateNodeVisual(node);
                        } else if (typeof nodeManager.renderNode === 'function') {
                            nodeManager.renderNode(node);
                        }
                    }
                }
            }
            
            // Restore connections
            for (const connData of state.connections) {
                if (connectionManager && nodeManager) {
                    let fromNode, toNode;
                    
                    // Get nodes with fallback
                    if (typeof nodeManager.getNode === 'function') {
                        fromNode = nodeManager.getNode(connData.from);
                        toNode = nodeManager.getNode(connData.to);
                    } else {
                        fromNode = nodeManager.nodes.get(connData.from);
                        toNode = nodeManager.nodes.get(connData.to);
                    }
                    
                    if (fromNode && toNode) {
                        let connection;
                        if (typeof connectionManager.createConnection === 'function') {
                            // Create connection and then update its ID
                            connection = connectionManager.createConnection(fromNode, toNode);
                            if (connection && typeof connection === 'string') {
                                // createConnection returns the connection ID, get the actual connection
                                const actualConnection = connectionManager.connections.get(connection);
                                if (actualConnection) {
                                    // Update the ID
                                    const oldId = connection;
                                    actualConnection.id = connData.id;
                                    
                                    // Update in connectionManager's map
                                    connectionManager.connections.delete(oldId);
                                    connectionManager.connections.set(connData.id, actualConnection);
                                    
                                    // Update in mindMap array
                                    const mindMapConnIndex = this.mindMap.connections.findIndex(c => c.id === oldId);
                                    if (mindMapConnIndex !== -1) {
                                        this.mindMap.connections[mindMapConnIndex].id = connData.id;
                                    }
                                    
                                    connection = actualConnection;
                                }
                            }
                        } else {
                            // Fallback: create connection manually
                            connection = {
                                id: connData.id,
                                from: connData.from,
                                to: connData.to
                            };
                            connectionManager.connections.set(connData.id, connection);
                            this.mindMap.connections.push(connection);
                        }
                        
                        // Restore control points
                        if (connData.controlPoints && connData.controlPoints.length > 0) {
                            connectionManager.controlPoints.set(connData.id, connData.controlPoints);
                            if (typeof connectionManager.renderConnection === 'function') {
                                connectionManager.renderConnection(connection);
                            }
                        }
                    }
                }
            }
            
            // Restore viewport
            if (state.viewport) {
                if (typeof this.mindMap.setViewBox === 'function') {
                    this.mindMap.setViewBox(state.viewport.x, state.viewport.y);
                }
                if (typeof this.mindMap.setZoom === 'function') {
                    this.mindMap.setZoom(state.viewport.zoom);
                }
            }
            
            // Restore selections
            if (typeof this.mindMap.clearSelection === 'function') {
                this.mindMap.clearSelection();
            }
            if (state.selectedNodeId && nodeManager) {
                const selectedNode = nodeManager.getNode(state.selectedNodeId);
                if (selectedNode && typeof this.mindMap.selectNode === 'function') {
                    this.mindMap.selectNode(selectedNode);
                }
            }
            
            this.log('State restored successfully');
            
        } catch (error) {
            console.error('Error restoring state:', error);
        } finally {
            this.isRestoring = false;
            this.updateUIState();
        }
    }
    
    /**
     * Perform undo operation
     * @returns {boolean} True if undo was performed
     */
    undo() {
        if (this.undoStack.length <= 1) {
            this.log('No more undo operations available');
            return false;
        }
        
        // Move current state to redo stack
        const currentState = this.undoStack.pop();
        this.redoStack.push(currentState);
        
        // Get previous state and restore it
        const previousState = this.undoStack[this.undoStack.length - 1];
        this.restoreState(previousState);
        
        this.log(`Undo performed: ${previousState.operationType} - ${previousState.description}`);
        return true;
    }
    
    /**
     * Perform redo operation
     * @returns {boolean} True if redo was performed
     */
    redo() {
        if (this.redoStack.length === 0) {
            this.log('No more redo operations available');
            return false;
        }
        
        // Get state from redo stack and restore it
        const nextState = this.redoStack.pop();
        this.undoStack.push(nextState);
        this.restoreState(nextState);
        
        this.log(`Redo performed: ${nextState.operationType} - ${nextState.description}`);
        return true;
    }
    
    /**
     * Check if undo is available
     * @returns {boolean}
     */
    canUndo() {
        return this.undoStack.length > 1;
    }
    
    /**
     * Check if redo is available
     * @returns {boolean}
     */
    canRedo() {
        return this.redoStack.length > 0;
    }
    
    /**
     * Clear all history
     */
    clearHistory() {
        this.undoStack = [];
        this.redoStack = [];
        this.saveInitialState();
        this.updateUIState();
        this.log('History cleared');
    }
    
    /**
     * Get history statistics
     * @returns {Object} History stats
     */
    getStats() {
        return {
            undoCount: this.undoStack.length - 1, // -1 because first item is initial state
            redoCount: this.redoStack.length,
            canUndo: this.canUndo(),
            canRedo: this.canRedo()
        };
    }
    
    /**
     * Update UI state (enable/disable buttons)
     */
    updateUIState() {
        // Update undo/redo button states
        const undoBtn = document.getElementById('undo-btn');
        const redoBtn = document.getElementById('redo-btn');
        
        if (undoBtn) {
            undoBtn.disabled = !this.canUndo();
            undoBtn.style.opacity = this.canUndo() ? '1' : '0.5';
        }
        
        if (redoBtn) {
            redoBtn.disabled = !this.canRedo();
            redoBtn.style.opacity = this.canRedo() ? '1' : '0.5';
        }
        
        // Dispatch event for other components
        if (typeof CustomEvent !== 'undefined') {
            const event = new CustomEvent('historyStateChanged', {
                detail: this.getStats()
            });
            document.dispatchEvent(event);
        }
    }
    
    /**
     * Debug logging
     * @param {string} message - Log message
     * @param {Object} data - Additional data to log
     */
    log(message, data = null) {
        if (this.enableDebug) {
            console.log(`[HistoryManager] ${message}`, data || '');
        }
    }
}

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = HistoryManager;
}