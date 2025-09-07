/**
 * EventEmitter Class
 * Provides event handling capabilities for managers
 */
class EventEmitter {
    constructor() {
        this.events = new Map();
        this.maxListeners = 10;
    }
    
    /**
     * Add event listener
     */
    on(eventName, listener) {
        if (typeof listener !== 'function') {
            throw new Error('Listener must be a function');
        }
        
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        
        const listeners = this.events.get(eventName);
        
        if (listeners.length >= this.maxListeners) {
            console.warn(`EventEmitter: Maximum listeners (${this.maxListeners}) exceeded for event: ${eventName}`);
        }
        
        listeners.push(listener);
        return this;
    }
    
    /**
     * Add one-time event listener
     */
    once(eventName, listener) {
        const onceWrapper = (...args) => {
            this.off(eventName, onceWrapper);
            listener.apply(this, args);
        };
        
        return this.on(eventName, onceWrapper);
    }
    
    /**
     * Remove event listener
     */
    off(eventName, listener) {
        if (!this.events.has(eventName)) {
            return this;
        }
        
        const listeners = this.events.get(eventName);
        const index = listeners.indexOf(listener);
        
        if (index !== -1) {
            listeners.splice(index, 1);
            
            if (listeners.length === 0) {
                this.events.delete(eventName);
            }
        }
        
        return this;
    }
    
    /**
     * Remove all listeners for an event
     */
    removeAllListeners(eventName) {
        if (eventName) {
            this.events.delete(eventName);
        } else {
            this.events.clear();
        }
        
        return this;
    }
    
    /**
     * Emit event to all listeners
     */
    emit(eventName, ...args) {
        if (!this.events.has(eventName)) {
            return false;
        }
        
        const listeners = this.events.get(eventName).slice(); // Copy to avoid modification during iteration
        
        for (const listener of listeners) {
            try {
                listener.apply(this, args);
            } catch (error) {
                console.error(`EventEmitter: Error in listener for event '${eventName}':`, error);
                
                // Emit error event if not already emitting error to prevent infinite loop
                if (eventName !== 'error') {
                    this.emit('error', error, eventName);
                }
            }
        }
        
        return true;
    }
    
    /**
     * Get all listeners for an event
     */
    listeners(eventName) {
        return this.events.get(eventName) ? [...this.events.get(eventName)] : [];
    }
    
    /**
     * Get listener count for an event
     */
    listenerCount(eventName) {
        return this.events.get(eventName)?.length || 0;
    }
    
    /**
     * Get all event names
     */
    eventNames() {
        return Array.from(this.events.keys());
    }
    
    /**
     * Set maximum listeners
     */
    setMaxListeners(max) {
        if (typeof max !== 'number' || max < 0) {
            throw new Error('Max listeners must be a non-negative number');
        }
        
        this.maxListeners = max;
        return this;
    }
    
    /**
     * Get maximum listeners
     */
    getMaxListeners() {
        return this.maxListeners;
    }
}

// Export for use
if (typeof window !== 'undefined') {
    window.EventEmitter = EventEmitter;
}