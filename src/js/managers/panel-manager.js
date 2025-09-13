/**
 * Panel Manager - Handles all properties panel functionality
 * Features:
 * - Node properties editing
 * - Panel visibility management
 * - Event handling for all panel controls
 * - Data validation and persistence
 * - Modular design with clear separation of concerns
 */

class PanelManager {
    constructor(mindMap) {
        this.mindMap = mindMap;
        this.panel = document.getElementById('node-panel');
        this.currentEditingNode = null;
        
        // Cache all DOM elements for better performance
        this.elements = this.cacheElements();
        
        // Configuration
        this.config = {
            imageMaxSize: 100,
            compressionQuality: 0.8,
            panelAnimationDuration: 200
        };
        
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupCloseButton();
    }
    
    /**
     * Cache all DOM elements for better performance
     */
    cacheElements() {
        return {
            // Image controls
            imageUpload: document.getElementById('image-upload'),
            uploadImageBtn: document.getElementById('upload-image-btn'),
            previewImg: document.getElementById('preview-img'),
            imagePreview: document.getElementById('image-preview'),
            imagePosition: document.getElementById('image-position'),
            removeImage: document.getElementById('remove-image'),
            
            // Text styling controls
            fontFamily: document.getElementById('font-family'),
            fontSize: document.getElementById('font-size'),
            fontSizeValue: document.getElementById('font-size-value'),
            fontWeight: document.getElementById('font-weight'),
            textColor: document.getElementById('text-color'),
            textAlign: document.getElementById('text-align'),
            
            // Shape controls
            nodeShape: document.getElementById('node-shape'),
            nodeWidth: document.getElementById('node-width'),
            nodeWidthValue: document.getElementById('node-width-value'),
            nodeHeight: document.getElementById('node-height'),
            nodeHeightValue: document.getElementById('node-height-value'),
            cornerRadius: document.getElementById('corner-radius'),
            cornerRadiusValue: document.getElementById('corner-radius-value'),
            cornerRadiusControl: document.getElementById('corner-radius-control'),
            sizeControls: document.getElementById('size-controls'),
            autoSizeBtn: document.getElementById('auto-size-btn'),
            
            // Color controls
            nodeBgColor: document.getElementById('node-bg-color'),
            nodeBorderColor: document.getElementById('node-border-color'),
            
            // Share controls
            exportImage: document.getElementById('export-image'),
            copyShareLink: document.getElementById('copy-share-link')
        };
    }
    
    /**
     * Setup all event listeners
     */
    setupEventListeners() {
        this.setupImageControls();
        this.setupTextControls();
        this.setupShapeControls();
        this.setupColorControls();
        this.setupShareControls();
    }
    
    /**
     * Setup close button functionality
     */
    setupCloseButton() {
        const closeBtn = this.panel.querySelector('.panel-header button');
        if (closeBtn) {
            closeBtn.addEventListener('click', () => this.close());
        }
    }
    
    /**
     * Setup image control event listeners
     */
    setupImageControls() {
        // Upload button click
        this.elements.uploadImageBtn.addEventListener('click', () => {
            this.elements.imageUpload.click();
        });
        
        // File input change
        this.elements.imageUpload.addEventListener('change', (e) => {
            this.handleImageUpload(e.target.files[0]);
        });
        
        // Image position change
        this.elements.imagePosition.addEventListener('change', (e) => {
            this.updateNodeProperty('imagePosition', e.target.value);
        });
        
        // Remove image
        this.elements.removeImage.addEventListener('click', () => {
            this.removeNodeImage();
        });
    }
    
    /**
     * Setup text control event listeners
     */
    setupTextControls() {
        this.elements.fontFamily.addEventListener('change', (e) => {
            this.updateNodeStyle('fontFamily', e.target.value);
        });
        
        this.elements.fontSize.addEventListener('input', (e) => {
            const size = e.target.value;
            this.elements.fontSizeValue.textContent = size + 'px';
            this.updateNodeStyle('fontSize', parseInt(size));
        });
        
        this.elements.fontWeight.addEventListener('change', (e) => {
            this.updateNodeStyle('fontWeight', e.target.value);
        });
        
        this.elements.textColor.addEventListener('input', (e) => {
            this.updateNodeStyle('textColor', e.target.value);
        });
        
        this.elements.textAlign.addEventListener('change', (e) => {
            this.updateNodeStyle('textAlign', e.target.value);
        });
    }
    
    /**
     * Setup shape control event listeners
     */
    setupShapeControls() {
        this.elements.nodeShape.addEventListener('change', (e) => {
            this.updateNodeShape('type', e.target.value);
            this.toggleShapeControls(e.target.value);
        });
        
        this.elements.nodeWidth.addEventListener('input', (e) => {
            const width = e.target.value;
            this.elements.nodeWidthValue.textContent = width + 'px';
            this.updateNodeShape('width', parseInt(width));
            // Mark as manually resized to prevent dynamic sizing override
            this.updateNodeShape('manuallyResized', true);
        });
        
        this.elements.nodeHeight.addEventListener('input', (e) => {
            const height = e.target.value;
            this.elements.nodeHeightValue.textContent = height + 'px';
            this.updateNodeShape('height', parseInt(height));
            // Mark as manually resized to prevent dynamic sizing override
            this.updateNodeShape('manuallyResized', true);
        });
        
        this.elements.cornerRadius.addEventListener('input', (e) => {
            const radius = e.target.value;
            this.elements.cornerRadiusValue.textContent = radius + 'px';
            this.updateNodeShape('cornerRadius', parseInt(radius));
        });
        
        // Auto-size button
        this.elements.autoSizeBtn.addEventListener('click', () => {
            this.enableAutoSizing();
        });
    }
    
    /**
     * Setup color control event listeners
     */
    setupColorControls() {
        this.elements.nodeBgColor.addEventListener('input', (e) => {
            this.updateNodeStyle('backgroundColor', e.target.value);
        });
        
        this.elements.nodeBorderColor.addEventListener('input', (e) => {
            this.updateNodeStyle('borderColor', e.target.value);
        });
    }
    
    /**
     * Setup share control event listeners
     */
    setupShareControls() {
        this.elements.exportImage.addEventListener('click', () => {
            this.exportAsImage();
        });
        
        this.elements.copyShareLink.addEventListener('click', () => {
            this.copyShareLink();
        });
    }
    
    /**
     * Open panel for a specific node
     */
    open(node) {
        if (!node) {
            console.warn('PanelManager: Cannot open panel without a node');
            return;
        }
        
        // Opening panel for node
        this.openedAt = Date.now();
        this.currentEditingNode = node;
        this.populatePanel(node);
        this.show();
    }
    
    /**
     * Close panel
     */
    close() {
        if (this.openedAt) {
            const timeSinceOpen = Date.now() - this.openedAt;
            
            // Log more details about what's trying to close the panel
            
            // Prevent unwanted closing if panel was just opened (within 5 seconds for more protection)
            if (timeSinceOpen < 5000 && this.currentEditingNode) {
                return;
            }
        }
        this.hide();
        this.currentEditingNode = null;
    }
    
    /**
     * Force close panel (bypasses timing protection)
     */
    forceClose() {
        this.hide();
        this.currentEditingNode = null;
    }
    
    /**
     * Show panel with animation
     */
    show() {
        this.panel.style.display = 'block';
        // Trigger reflow for animation
        this.panel.offsetHeight;
        this.panel.style.opacity = '1';
        this.panel.style.transform = 'translateX(0)';
    }
    
    /**
     * Hide panel with animation
     */
    hide() {
        this.panel.style.opacity = '0';
        this.panel.style.transform = 'translateX(100%)';
        
        setTimeout(() => {
            this.panel.style.display = 'none';
        }, this.config.panelAnimationDuration);
    }
    
    /**
     * Populate panel with node data
     */
    populatePanel(node) {
        this.ensureNodeProperties(node);
        this.populateImageControls(node);
        this.populateTextControls(node);
        this.populateShapeControls(node);
        this.populateColorControls(node);
    }
    
    /**
     * Ensure node has all required properties for backward compatibility
     */
    ensureNodeProperties(node) {
        if (!node.shape) {
            node.shape = {
                type: 'circle',
                width: 80,
                height: 80,
                cornerRadius: 15
            };
        }
        
        if (!node.style) {
            node.style = {
                fontFamily: 'Poppins',
                fontSize: 14,
                fontWeight: '400',
                textColor: '#F9FAFB',
                textAlign: 'center',
                backgroundColor: '#374151',
                borderColor: '#4B5563'
            };
        }
    }
    
    /**
     * Populate image controls
     */
    populateImageControls(node) {
        if (node.image) {
            this.elements.previewImg.src = node.image;
            this.elements.imagePreview.style.display = 'block';
            this.elements.imagePosition.value = node.imagePosition || 'before';
        } else {
            this.elements.imagePreview.style.display = 'none';
        }
    }
    
    /**
     * Populate text controls
     */
    populateTextControls(node) {
        this.elements.fontFamily.value = node.style.fontFamily || 'Poppins';
        this.elements.fontSize.value = node.style.fontSize || 14;
        this.elements.fontSizeValue.textContent = (node.style.fontSize || 14) + 'px';
        this.elements.fontWeight.value = node.style.fontWeight || '400';
        this.elements.textColor.value = node.style.textColor || '#F9FAFB';
        this.elements.textAlign.value = node.style.textAlign || 'center';
    }
    
    /**
     * Populate shape controls
     */
    populateShapeControls(node) {
        this.elements.nodeShape.value = node.shape.type || 'circle';
        this.elements.nodeWidth.value = node.shape.width || 80;
        this.elements.nodeWidthValue.textContent = (node.shape.width || 80) + 'px';
        this.elements.nodeHeight.value = node.shape.height || 80;
        this.elements.nodeHeightValue.textContent = (node.shape.height || 80) + 'px';
        this.elements.cornerRadius.value = node.shape.cornerRadius || 15;
        this.elements.cornerRadiusValue.textContent = (node.shape.cornerRadius || 15) + 'px';
        
        this.toggleShapeControls(node.shape.type || 'circle');
    }
    
    /**
     * Populate color controls
     */
    populateColorControls(node) {
        this.elements.nodeBgColor.value = node.style.backgroundColor || '#374151';
        this.elements.nodeBorderColor.value = node.style.borderColor || '#4B5563';
    }
    
    /**
     * Toggle shape-specific controls
     */
    toggleShapeControls(shapeType) {
        // Show corner radius control only for rounded rectangle
        if (shapeType === 'rounded-rectangle') {
            this.elements.cornerRadiusControl.style.display = 'flex';
        } else {
            this.elements.cornerRadiusControl.style.display = 'none';
        }
        
        // Show size controls for all shapes except circle
        if (shapeType === 'circle') {
            this.elements.sizeControls.style.display = 'none';
        } else {
            this.elements.sizeControls.style.display = 'flex';
        }
    }
    
    /**
     * Update node property and re-render
     */
    updateNodeProperty(property, value) {
        if (!this.currentEditingNode) {
            console.warn('PanelManager: No node selected for property update');
            return;
        }
        
        this.currentEditingNode[property] = value;
        this.renderNode();
    }
    
    /**
     * Update node style property and re-render
     */
    updateNodeStyle(property, value) {
        if (!this.currentEditingNode) {
            console.warn('PanelManager: No node selected for style update');
            return;
        }
        
        this.currentEditingNode.style[property] = value;
        this.renderNode();
    }
    
    /**
     * Update node shape property and re-render
     */
    updateNodeShape(property, value) {
        if (!this.currentEditingNode) {
            console.warn('PanelManager: No node selected for shape update');
            return;
        }
        
        this.currentEditingNode.shape[property] = value;
        this.renderNode();
    }
    
    /**
     * Enable automatic sizing for the current node
     */
    enableAutoSizing() {
        if (!this.currentEditingNode) return;
        
        // Remove the manually resized flag to re-enable dynamic sizing
        this.currentEditingNode.shape.manuallyResized = false;
        
        // Force recalculate and update the size
        if (this.mindMap.nodeManager && this.mindMap.nodeManager.updateNodeShapeForText) {
            this.mindMap.nodeManager.updateNodeShapeForText(this.currentEditingNode);
        }
        
        // Update the panel controls to reflect new size
        this.elements.nodeWidth.value = this.currentEditingNode.shape.width;
        this.elements.nodeWidthValue.textContent = this.currentEditingNode.shape.width + 'px';
        this.elements.nodeHeight.value = this.currentEditingNode.shape.height;
        this.elements.nodeHeightValue.textContent = this.currentEditingNode.shape.height + 'px';
        
        // Re-render the node
        this.renderNode();
        
        // Show feedback
        this.showNotification('Auto-sizing enabled! Node will resize with text changes.', 'success');
    }

    /**
     * Handle image upload
     */
    handleImageUpload(file) {
        if (!file || !this.currentEditingNode) return;
        
        this.compressAndResizeImage(file, (compressedDataUrl) => {
            this.currentEditingNode.image = compressedDataUrl;
            this.elements.previewImg.src = compressedDataUrl;
            this.elements.imagePreview.style.display = 'block';
            this.renderNode();
        });
    }
    
    /**
     * Remove node image
     */
    removeNodeImage() {
        if (!this.currentEditingNode) return;
        
        this.currentEditingNode.image = null;
        this.elements.imagePreview.style.display = 'none';
        this.elements.imageUpload.value = '';
        this.renderNode();
    }
    
    /**
     * Compress and resize image for optimal performance
     */
    compressAndResizeImage(file, callback) {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        img.onload = () => {
            // Calculate new dimensions (max 100x100 while maintaining aspect ratio)
            const maxSize = this.config.imageMaxSize;
            let { width, height } = img;
            
            if (width > height) {
                if (width > maxSize) {
                    height = (height * maxSize) / width;
                    width = maxSize;
                }
            } else {
                if (height > maxSize) {
                    width = (width * maxSize) / height;
                    height = maxSize;
                }
            }
            
            canvas.width = width;
            canvas.height = height;
            
            // Draw and compress
            ctx.drawImage(img, 0, 0, width, height);
            const compressedDataUrl = canvas.toDataURL('image/jpeg', this.config.compressionQuality);
            
            callback(compressedDataUrl);
        };
        
        img.src = URL.createObjectURL(file);
    }
    
    /**
     * Export current view as image
     */
    exportAsImage() {
        if (!this.mindMap || !this.mindMap.canvas) {
            console.warn('PanelManager: Cannot export - no canvas available');
            return;
        }
        
        // Create a serializer and convert SVG to string
        const serializer = new XMLSerializer();
        const svgString = serializer.serializeToString(this.mindMap.canvas);
        
        // Create canvas and draw SVG
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        const img = new Image();
        
        // Set canvas size based on viewBox
        const viewBox = this.mindMap.viewBox;
        canvas.width = viewBox.width;
        canvas.height = viewBox.height;
        
        img.onload = () => {
            ctx.fillStyle = '#111827'; // Background color
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            ctx.drawImage(img, 0, 0);
            
            // Download the image
            const link = document.createElement('a');
            link.download = 'mindmap.png';
            link.href = canvas.toDataURL();
            link.click();
        };
        
        const svgBlob = new Blob([svgString], { type: 'image/svg+xml;charset=utf-8' });
        const url = URL.createObjectURL(svgBlob);
        img.src = url;
    }
    
    /**
     * Copy share link to clipboard
     */
    copyShareLink() {
        if (!this.mindMap || !this.mindMap.generateShareLink) {
            console.warn('PanelManager: Cannot generate share link');
            return;
        }
        
        const shareLink = this.mindMap.generateShareLink();
        
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareLink).then(() => {
                this.showNotification('Share link copied to clipboard!');
            }).catch(() => {
                this.fallbackCopyToClipboard(shareLink);
            });
        } else {
            this.fallbackCopyToClipboard(shareLink);
        }
    }
    
    /**
     * Fallback method for copying to clipboard
     */
    fallbackCopyToClipboard(text) {
        const textArea = document.createElement('textarea');
        textArea.value = text;
        textArea.style.position = 'fixed';
        textArea.style.opacity = '0';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        try {
            document.execCommand('copy');
            this.showNotification('Share link copied to clipboard!');
        } catch (err) {
            console.error('Failed to copy to clipboard:', err);
            this.showNotification('Failed to copy link. Please copy manually: ' + text);
        }
        
        document.body.removeChild(textArea);
    }
    
    /**
     * Show notification to user
     */
    showNotification(message, type = 'success') {
        // Create notification element
        const notification = document.createElement('div');
        notification.className = `panel-notification ${type}`;
        notification.textContent = message;
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'success' ? '#10B981' : '#F43F5E'};
            color: white;
            padding: 12px 20px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            z-index: 10000;
            font-family: var(--font-family);
            font-size: 14px;
            opacity: 0;
            transform: translateX(100%);
            transition: all 0.3s ease;
        `;
        
        document.body.appendChild(notification);
        
        // Trigger animation
        setTimeout(() => {
            notification.style.opacity = '1';
            notification.style.transform = 'translateX(0)';
        }, 10);
        
        // Remove after delay
        setTimeout(() => {
            notification.style.opacity = '0';
            notification.style.transform = 'translateX(100%)';
            setTimeout(() => {
                if (notification.parentNode) {
                    notification.remove();
                }
            }, 300);
        }, 3000);
    }
    
    /**
     * Re-render the current editing node
     */
    renderNode() {
        if (!this.currentEditingNode) return;
        
        if (this.mindMap.nodeManager && this.mindMap.nodeManager.renderNode) {
            this.mindMap.nodeManager.renderNode(this.currentEditingNode, true);
        } else if (this.mindMap.renderNode) {
            this.mindMap.renderNode(this.currentEditingNode, true);
        } else {
            console.warn('PanelManager: No render method available');
        }
    }
    
    /**
     * Check if panel is currently open
     */
    isOpen() {
        return this.panel.style.display === 'block';
    }
    
    /**
     * Get current editing node
     */
    getCurrentNode() {
        return this.currentEditingNode;
    }
    
    /**
     * Clean up resources
     */
    destroy() {
        this.currentEditingNode = null;
        // Remove event listeners would go here if we tracked them
        // For now, the browser will handle cleanup when the page unloads
    }
}

// Export for use
window.PanelManager = PanelManager;