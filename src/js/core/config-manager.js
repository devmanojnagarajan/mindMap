/**
 * Configuration Manager
 * Centralized configuration management for the application
 */
class ConfigManager {
    constructor() {
        this.config = this.getDefaultConfig();
        this.loadConfig();
    }
    
    /**
     * Get default configuration
     */
    getDefaultConfig() {
        return {
            // Application settings
            app: {
                name: 'Mind Map',
                version: '1.0.0',
                debug: false,
                maxNodes: 1000,
                maxConnections: 2000,
                autosave: true,
                autosaveInterval: 30000 // 30 seconds
            },
            
            // Canvas settings
            canvas: {
                defaultWidth: 2000,
                defaultHeight: 1500,
                minZoom: 0.1,
                maxZoom: 5.0,
                zoomStep: 0.1,
                panSpeed: 1.0,
                gridSize: 25,
                gridVisible: true
            },
            
            // Node settings
            nodes: {
                defaultWidth: 80,
                defaultHeight: 80,
                minWidth: 30,
                maxWidth: 300,
                minHeight: 20,
                maxHeight: 200,
                defaultShape: 'circle',
                defaultColor: '#374151',
                defaultTextColor: '#F9FAFB',
                defaultFontFamily: 'Poppins',
                defaultFontSize: 14,
                defaultFontWeight: '400',
                dragThreshold: 5, // pixels
                snapToGrid: false
            },
            
            // Connection settings
            connections: {
                defaultStroke: '#6B7280',
                defaultStrokeWidth: 2,
                selectedStroke: '#38BDF8',
                selectedStrokeWidth: 3,
                maxControlPoints: 4,
                controlPointRadius: 12,
                hitAreaWidth: 20,
                curveType: 'bezier' // 'bezier' or 'straight'
            },
            
            // Panel settings
            panel: {
                width: 320,
                animationDuration: 200,
                autoOpen: true,
                position: 'right'
            },
            
            // Performance settings
            performance: {
                renderThrottle: 16, // ~60fps
                dragThrottle: 8, // ~120fps
                enableVirtualization: false,
                maxVisibleNodes: 500,
                enableAnimations: true
            },
            
            // Keyboard shortcuts
            shortcuts: {
                delete: ['Delete', 'Backspace'],
                escape: ['Escape'],
                copy: ['Control+c', 'Meta+c'],
                paste: ['Control+v', 'Meta+v'],
                undo: ['Control+z', 'Meta+z'],
                redo: ['Control+y', 'Meta+y', 'Control+Shift+z', 'Meta+Shift+z'],
                selectAll: ['Control+a', 'Meta+a'],
                zoomIn: ['Control+=', 'Meta+='],
                zoomOut: ['Control+-', 'Meta+-'],
                zoomReset: ['Control+0', 'Meta+0']
            },
            
            // Storage settings
            storage: {
                key: 'mindmap',
                compression: true,
                maxSaveStates: 10,
                saveImages: true,
                imageQuality: 0.8,
                maxImageSize: 1024 * 1024 // 1MB
            },
            
            // Export settings
            export: {
                defaultFormat: 'png',
                imageQuality: 0.9,
                backgroundColor: '#1F2937',
                padding: 50
            },
            
            // Theme settings
            theme: {
                name: 'dark',
                colors: {
                    background: '#1F2937',
                    foreground: '#F9FAFB',
                    primary: '#3B82F6',
                    secondary: '#6B7280',
                    accent: '#F59E0B',
                    success: '#10B981',
                    warning: '#F59E0B',
                    error: '#EF4444',
                    grid: '#374151'
                }
            }
        };
    }
    
    /**
     * Load configuration from localStorage
     */
    loadConfig() {
        try {
            const savedConfig = localStorage.getItem('mindmap-config');
            if (savedConfig) {
                const parsed = JSON.parse(savedConfig);
                this.config = Utils.deepMerge(this.config, parsed);
            }
        } catch (error) {
            console.warn('ConfigManager: Failed to load saved config:', error);
        }
    }
    
    /**
     * Save configuration to localStorage
     */
    saveConfig() {
        try {
            localStorage.setItem('mindmap-config', JSON.stringify(this.config));
            return true;
        } catch (error) {
            console.error('ConfigManager: Failed to save config:', error);
            return false;
        }
    }
    
    /**
     * Get configuration value by path
     */
    get(path, defaultValue = undefined) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (current && typeof current === 'object' && key in current) {
                current = current[key];
            } else {
                return defaultValue;
            }
        }
        
        return current;
    }
    
    /**
     * Set configuration value by path
     */
    set(path, value, save = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;
        
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                current[key] = {};
            }
            current = current[key];
        }
        
        current[lastKey] = value;
        
        if (save) {
            this.saveConfig();
        }
        
        return this;
    }
    
    /**
     * Reset configuration to defaults
     */
    reset() {
        this.config = this.getDefaultConfig();
        this.saveConfig();
        return this;
    }
    
    /**
     * Get entire configuration
     */
    getAll() {
        return Utils.deepClone(this.config);
    }
    
    /**
     * Set entire configuration
     */
    setAll(config, save = true) {
        this.config = Utils.deepMerge(this.getDefaultConfig(), config);
        
        if (save) {
            this.saveConfig();
        }
        
        return this;
    }
    
    /**
     * Check if key exists
     */
    has(path) {
        const keys = path.split('.');
        let current = this.config;
        
        for (const key of keys) {
            if (!current || typeof current !== 'object' || !(key in current)) {
                return false;
            }
            current = current[key];
        }
        
        return true;
    }
    
    /**
     * Delete configuration key
     */
    delete(path, save = true) {
        const keys = path.split('.');
        const lastKey = keys.pop();
        let current = this.config;
        
        for (const key of keys) {
            if (!current[key] || typeof current[key] !== 'object') {
                return false;
            }
            current = current[key];
        }
        
        if (lastKey in current) {
            delete current[lastKey];
            
            if (save) {
                this.saveConfig();
            }
            
            return true;
        }
        
        return false;
    }
    
    /**
     * Validate configuration
     */
    validate() {
        const errors = [];
        
        // Validate numeric ranges
        const numericValidations = [
            { path: 'canvas.minZoom', min: 0.01, max: 1 },
            { path: 'canvas.maxZoom', min: 1, max: 20 },
            { path: 'nodes.minWidth', min: 10, max: 100 },
            { path: 'nodes.maxWidth', min: 100, max: 1000 },
            { path: 'panel.animationDuration', min: 0, max: 1000 },
            { path: 'storage.maxSaveStates', min: 1, max: 50 }
        ];
        
        for (const validation of numericValidations) {
            const value = this.get(validation.path);
            if (typeof value === 'number') {
                if (value < validation.min || value > validation.max) {
                    errors.push(`${validation.path}: Value ${value} is outside valid range [${validation.min}, ${validation.max}]`);
                }
            }
        }
        
        // Validate required string values
        const stringValidations = [
            'app.name',
            'nodes.defaultShape',
            'nodes.defaultFontFamily',
            'theme.name'
        ];
        
        for (const path of stringValidations) {
            const value = this.get(path);
            if (!value || typeof value !== 'string' || value.trim().length === 0) {
                errors.push(`${path}: Must be a non-empty string`);
            }
        }
        
        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }
    
    /**
     * Export configuration as JSON
     */
    export() {
        return JSON.stringify(this.config, null, 2);
    }
    
    /**
     * Import configuration from JSON
     */
    import(jsonString) {
        try {
            const imported = JSON.parse(jsonString);
            const validation = this.validate.call({ config: imported, get: this.get.bind({ config: imported }) });
            
            if (!validation.isValid) {
                throw new Error('Invalid configuration: ' + validation.errors.join(', '));
            }
            
            this.setAll(imported);
            return true;
        } catch (error) {
            console.error('ConfigManager: Failed to import config:', error);
            return false;
        }
    }
}

// Create singleton instance
const Config = new ConfigManager();

// Export for use
if (typeof window !== 'undefined') {
    window.Config = Config;
    window.ConfigManager = ConfigManager;
}