/**
 * Base Manager Class
 * Provides common functionality for all manager classes
 */
class BaseManager {
    constructor(mindMap, options = {}) {
        if (!mindMap) {
            throw new Error(`${this.constructor.name}: MindMap instance is required`);
        }
        
        this.mindMap = mindMap;
        this.options = this.mergeOptions(this.getDefaultOptions(), options);
        this.initialized = false;
        
        // Bind common methods to prevent context loss
        this.init = this.init.bind(this);
        this.destroy = this.destroy.bind(this);
        this.handleError = this.handleError.bind(this);
    }
    
    /**
     * Get default options for the manager
     * Override in subclasses
     */
    getDefaultOptions() {
        return {
            debug: false,
            logPrefix: this.constructor.name
        };
    }
    
    /**
     * Deep merge options objects
     */
    mergeOptions(defaults, custom) {
        const result = { ...defaults };
        
        for (const key in custom) {
            if (custom[key] !== null && typeof custom[key] === 'object' && !Array.isArray(custom[key])) {
                result[key] = this.mergeOptions(result[key] || {}, custom[key]);
            } else {
                result[key] = custom[key];
            }
        }
        
        return result;
    }
    
    /**
     * Initialize the manager
     * Must be implemented by subclasses
     */
    init() {
        if (this.initialized) {
            this.log('warn', 'Manager already initialized');
            return;
        }
        
        try {
            this.doInit();
            this.initialized = true;
            this.log('info', 'Initialized successfully');
        } catch (error) {
            this.handleError('Failed to initialize', error);
            throw error;
        }
    }
    
    /**
     * Actual initialization logic
     * Override in subclasses
     */
    doInit() {
        // Override in subclasses
    }
    
    /**
     * Clean up resources
     * Override in subclasses
     */
    destroy() {
        if (!this.initialized) {
            return;
        }
        
        try {
            this.doDestroy();
            this.initialized = false;
            this.log('info', 'Destroyed successfully');
        } catch (error) {
            this.handleError('Failed to destroy', error);
        }
    }
    
    /**
     * Actual cleanup logic
     * Override in subclasses
     */
    doDestroy() {
        // Override in subclasses
    }
    
    /**
     * Check if manager is initialized
     */
    isInitialized() {
        return this.initialized;
    }
    
    /**
     * Assert that manager is initialized
     */
    assertInitialized() {
        if (!this.initialized) {
            throw new Error(`${this.constructor.name}: Manager not initialized`);
        }
    }
    
    /**
     * Standardized logging
     */
    log(level, message, ...args) {
        if (!this.options.debug && level === 'debug') {
            return;
        }
        
        const prefix = `[${this.options.logPrefix}]`;
        const fullMessage = `${prefix} ${message}`;
        
        switch (level) {
            case 'error':
                console.error(fullMessage, ...args);
                break;
            case 'warn':
                console.warn(fullMessage, ...args);
                break;
            case 'info':
                console.info(fullMessage, ...args);
                break;
            case 'debug':
                console.debug(fullMessage, ...args);
                break;
            default:
                console.log(fullMessage, ...args);
        }
    }
    
    /**
     * Standardized error handling
     */
    handleError(message, error) {
        const fullMessage = `${this.constructor.name}: ${message}`;
        console.error(fullMessage, error);
        
        // Optionally emit error events if event system is available
        if (this.mindMap.emit) {
            this.mindMap.emit('error', {
                manager: this.constructor.name,
                message: fullMessage,
                error: error
            });
        }
    }
    
    /**
     * Safe DOM element selection
     */
    querySelector(selector, context = document) {
        try {
            return context.querySelector(selector);
        } catch (error) {
            this.handleError(`Invalid selector: ${selector}`, error);
            return null;
        }
    }
    
    /**
     * Safe DOM element selection (all)
     */
    querySelectorAll(selector, context = document) {
        try {
            return context.querySelectorAll(selector);
        } catch (error) {
            this.handleError(`Invalid selector: ${selector}`, error);
            return [];
        }
    }
    
    /**
     * Create SVG element with proper namespace
     */
    createSVGElement(tagName, attributes = {}) {
        try {
            const element = document.createElementNS('http://www.w3.org/2000/svg', tagName);
            
            for (const [key, value] of Object.entries(attributes)) {
                if (key === 'class') {
                    element.setAttribute('class', value);
                } else if (key.startsWith('data-')) {
                    element.setAttribute(key, value);
                } else {
                    element.setAttribute(key, value);
                }
            }
            
            return element;
        } catch (error) {
            this.handleError(`Failed to create SVG element: ${tagName}`, error);
            return null;
        }
    }
    
    /**
     * Generate unique ID
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }
    
    /**
     * Validate required parameters
     */
    validateRequired(params, requiredKeys) {
        for (const key of requiredKeys) {
            if (params[key] === undefined || params[key] === null) {
                throw new Error(`${this.constructor.name}: Required parameter '${key}' is missing`);
            }
        }
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.BaseManager = BaseManager;
}