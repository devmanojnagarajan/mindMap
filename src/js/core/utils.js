/**
 * Utility Functions
 * Common utility functions used throughout the application
 */
const Utils = {
    
    /**
     * Debounce function calls
     */
    debounce(func, wait, immediate = false) {
        let timeout;
        
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func.apply(this, args);
            };
            
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            
            if (callNow) func.apply(this, args);
        };
    },
    
    /**
     * Throttle function calls
     */
    throttle(func, limit) {
        let inThrottle;
        
        return function(...args) {
            if (!inThrottle) {
                func.apply(this, args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    },
    
    /**
     * Deep clone object
     */
    deepClone(obj) {
        if (obj === null || typeof obj !== 'object') {
            return obj;
        }
        
        if (obj instanceof Date) {
            return new Date(obj.getTime());
        }
        
        if (obj instanceof Array) {
            return obj.map(item => this.deepClone(item));
        }
        
        if (obj instanceof Object) {
            const cloned = {};
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    cloned[key] = this.deepClone(obj[key]);
                }
            }
            return cloned;
        }
        
        return obj;
    },
    
    /**
     * Merge objects deeply
     */
    deepMerge(target, source) {
        const result = { ...target };
        
        for (const key in source) {
            if (source[key] !== null && typeof source[key] === 'object' && !Array.isArray(source[key])) {
                result[key] = this.deepMerge(result[key] || {}, source[key]);
            } else {
                result[key] = source[key];
            }
        }
        
        return result;
    },
    
    /**
     * Check if value is empty
     */
    isEmpty(value) {
        if (value === null || value === undefined) return true;
        if (typeof value === 'string') return value.trim().length === 0;
        if (Array.isArray(value)) return value.length === 0;
        if (typeof value === 'object') return Object.keys(value).length === 0;
        return false;
    },
    
    /**
     * Generate UUID v4
     */
    uuid() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
            const r = Math.random() * 16 | 0;
            const v = c === 'x' ? r : (r & 0x3 | 0x8);
            return v.toString(16);
        });
    },
    
    /**
     * Generate short ID
     */
    shortId(prefix = '') {
        return prefix + Date.now().toString(36) + Math.random().toString(36).substr(2);
    },
    
    /**
     * Validate email format
     */
    isValidEmail(email) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return emailRegex.test(email);
    },
    
    /**
     * Sanitize HTML string
     */
    sanitizeHtml(str) {
        const temp = document.createElement('div');
        temp.textContent = str;
        return temp.innerHTML;
    },
    
    /**
     * Format file size
     */
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },
    
    /**
     * Calculate distance between two points
     */
    distance(x1, y1, x2, y2) {
        return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
    },
    
    /**
     * Clamp value between min and max
     */
    clamp(value, min, max) {
        return Math.min(Math.max(value, min), max);
    },
    
    /**
     * Linear interpolation
     */
    lerp(start, end, factor) {
        return start + (end - start) * factor;
    },
    
    /**
     * Convert degrees to radians
     */
    degToRad(degrees) {
        return degrees * (Math.PI / 180);
    },
    
    /**
     * Convert radians to degrees
     */
    radToDeg(radians) {
        return radians * (180 / Math.PI);
    },
    
    /**
     * Check if point is inside rectangle
     */
    pointInRect(px, py, rx, ry, rw, rh) {
        return px >= rx && px <= rx + rw && py >= ry && py <= ry + rh;
    },
    
    /**
     * Check if rectangles intersect
     */
    rectsIntersect(r1x, r1y, r1w, r1h, r2x, r2y, r2w, r2h) {
        return !(r1x + r1w < r2x || r2x + r2w < r1x || r1y + r1h < r2y || r2y + r2h < r1y);
    },
    
    /**
     * Get bounding box of multiple points
     */
    getBoundingBox(points) {
        if (!points || points.length === 0) {
            return { x: 0, y: 0, width: 0, height: 0 };
        }
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        points.forEach(point => {
            minX = Math.min(minX, point.x);
            minY = Math.min(minY, point.y);
            maxX = Math.max(maxX, point.x);
            maxY = Math.max(maxY, point.y);
        });
        
        return {
            x: minX,
            y: minY,
            width: maxX - minX,
            height: maxY - minY
        };
    },
    
    /**
     * Wait for specified milliseconds
     */
    sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    /**
     * Retry function with exponential backoff
     */
    async retry(fn, maxAttempts = 3, delay = 1000) {
        for (let attempt = 1; attempt <= maxAttempts; attempt++) {
            try {
                return await fn();
            } catch (error) {
                if (attempt === maxAttempts) {
                    throw error;
                }
                
                const backoffDelay = delay * Math.pow(2, attempt - 1);
                await this.sleep(backoffDelay);
            }
        }
    },
    
    /**
     * Check if browser supports feature
     */
    supports: {
        localStorage: (() => {
            try {
                const test = 'test';
                localStorage.setItem(test, test);
                localStorage.removeItem(test);
                return true;
            } catch {
                return false;
            }
        })(),
        
        canvas: (() => {
            const canvas = document.createElement('canvas');
            return !!(canvas.getContext && canvas.getContext('2d'));
        })(),
        
        svg: (() => {
            return !!(document.createElementNS && document.createElementNS('http://www.w3.org/2000/svg', 'svg').createSVGRect);
        })(),
        
        touch: 'ontouchstart' in window || navigator.maxTouchPoints > 0,
        
        fileApi: !!(window.File && window.FileReader && window.FileList && window.Blob)
    }
};

// Export for use
if (typeof window !== 'undefined') {
    window.Utils = Utils;
}