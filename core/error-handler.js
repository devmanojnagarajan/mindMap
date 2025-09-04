/**
 * Error Handler
 * Centralized error handling for the application
 */
class ErrorHandler {
    constructor() {
        this.errors = [];
        this.maxErrors = 100;
        this.setupGlobalHandlers();
    }
    
    /**
     * Setup global error handlers
     */
    setupGlobalHandlers() {
        // Handle unhandled JavaScript errors
        window.addEventListener('error', (event) => {
            this.handleError({
                type: 'javascript',
                message: event.message,
                filename: event.filename,
                lineno: event.lineno,
                colno: event.colno,
                error: event.error,
                timestamp: Date.now()
            });
        });
        
        // Handle unhandled promise rejections
        window.addEventListener('unhandledrejection', (event) => {
            this.handleError({
                type: 'promise',
                message: event.reason?.message || 'Unhandled promise rejection',
                error: event.reason,
                timestamp: Date.now()
            });
        });
    }
    
    /**
     * Handle an error
     */
    handleError(errorInfo) {
        // Add to error log
        this.addError(errorInfo);
        
        // Log to console in development
        if (Config.get('app.debug', false)) {
            console.error('ErrorHandler:', errorInfo);
        }
        
        // Show user-friendly message for critical errors
        this.showUserError(errorInfo);
        
        // Send to analytics/logging service if configured
        this.reportError(errorInfo);
    }
    
    /**
     * Add error to internal log
     */
    addError(errorInfo) {
        this.errors.unshift({
            id: Utils.uuid(),
            ...errorInfo
        });
        
        // Keep only the most recent errors
        if (this.errors.length > this.maxErrors) {
            this.errors = this.errors.slice(0, this.maxErrors);
        }
    }
    
    /**
     * Show user-friendly error message
     */
    showUserError(errorInfo) {
        const severity = this.getSeverity(errorInfo);
        
        if (severity === 'critical') {
            this.showCriticalError(errorInfo);
        } else if (severity === 'warning') {
            this.showWarning(errorInfo);
        }
        // Info level errors are logged but not shown to user
    }
    
    /**
     * Get error severity
     */
    getSeverity(errorInfo) {
        const criticalPatterns = [
            /cannot read prop/i,
            /is not a function/i,
            /canvas.*not found/i,
            /failed to initialize/i
        ];
        
        const warningPatterns = [
            /failed to save/i,
            /connection.*failed/i,
            /invalid.*data/i
        ];
        
        const message = errorInfo.message || '';
        
        if (criticalPatterns.some(pattern => pattern.test(message))) {
            return 'critical';
        } else if (warningPatterns.some(pattern => pattern.test(message))) {
            return 'warning';
        }
        
        return 'info';
    }
    
    /**
     * Show critical error dialog
     */
    showCriticalError(errorInfo) {
        const message = this.getFriendlyMessage(errorInfo);
        
        // Create error dialog
        const dialog = this.createErrorDialog({
            title: 'Application Error',
            message: message,
            type: 'error',
            actions: [
                {
                    text: 'Reload Page',
                    action: () => window.location.reload(),
                    primary: true
                },
                {
                    text: 'Continue',
                    action: () => this.closeDialog(dialog)
                }
            ]
        });
        
        document.body.appendChild(dialog);
    }
    
    /**
     * Show warning notification
     */
    showWarning(errorInfo) {
        const message = this.getFriendlyMessage(errorInfo);
        
        // Use existing notification system if available
        if (window.notie) {
            notie.alert({
                type: 'warning',
                text: message,
                time: 5
            });
        } else {
            // Fallback notification
            this.showToast(message, 'warning');
        }
    }
    
    /**
     * Get user-friendly error message
     */
    getFriendlyMessage(errorInfo) {
        const friendlyMessages = {
            'canvas.*not found': 'Failed to initialize the drawing canvas. Please refresh the page.',
            'cannot read prop': 'An unexpected error occurred. Please try refreshing the page.',
            'is not a function': 'A component failed to load properly. Please refresh the page.',
            'failed to save': 'Failed to save your work. Your changes may be lost.',
            'failed to load': 'Failed to load your saved work. Starting with a new document.',
            'connection.*failed': 'Failed to create connection between nodes.',
            'invalid.*data': 'Invalid data encountered. Some features may not work correctly.'
        };
        
        const message = errorInfo.message || '';
        
        for (const [pattern, friendlyMsg] of Object.entries(friendlyMessages)) {
            if (new RegExp(pattern, 'i').test(message)) {
                return friendlyMsg;
            }
        }
        
        return 'An unexpected error occurred. Please try again.';
    }
    
    /**
     * Create error dialog
     */
    createErrorDialog({ title, message, type, actions }) {
        const dialog = document.createElement('div');
        dialog.className = `error-dialog error-dialog--${type}`;
        dialog.innerHTML = `
            <div class="error-dialog__backdrop"></div>
            <div class="error-dialog__content">
                <div class="error-dialog__header">
                    <h3 class="error-dialog__title">${title}</h3>
                </div>
                <div class="error-dialog__body">
                    <p class="error-dialog__message">${message}</p>
                </div>
                <div class="error-dialog__footer">
                    ${actions.map(action => 
                        `<button class="error-dialog__button ${action.primary ? 'error-dialog__button--primary' : ''}" 
                                data-action="${action.text}">${action.text}</button>`
                    ).join('')}
                </div>
            </div>
        `;
        
        // Add event listeners
        actions.forEach(action => {
            const button = dialog.querySelector(`[data-action="${action.text}"]`);
            button.addEventListener('click', action.action);
        });
        
        return dialog;
    }
    
    /**
     * Close error dialog
     */
    closeDialog(dialog) {
        dialog.classList.add('error-dialog--closing');
        setTimeout(() => {
            if (dialog.parentNode) {
                dialog.parentNode.removeChild(dialog);
            }
        }, 200);
    }
    
    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `error-toast error-toast--${type}`;
        toast.innerHTML = `
            <div class="error-toast__content">
                <span class="error-toast__message">${message}</span>
                <button class="error-toast__close">&times;</button>
            </div>
        `;
        
        // Position toast
        toast.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: ${type === 'warning' ? '#f59e0b' : '#ef4444'};
            color: white;
            padding: 12px 16px;
            border-radius: 6px;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
            z-index: 10000;
            max-width: 400px;
            animation: slideInRight 0.3s ease;
        `;
        
        // Add close handler
        const closeBtn = toast.querySelector('.error-toast__close');
        closeBtn.addEventListener('click', () => {
            toast.style.animation = 'slideOutRight 0.3s ease';
            setTimeout(() => {
                if (toast.parentNode) {
                    toast.parentNode.removeChild(toast);
                }
            }, 300);
        });
        
        document.body.appendChild(toast);
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            if (toast.parentNode) {
                closeBtn.click();
            }
        }, 5000);
    }
    
    /**
     * Report error to analytics/logging service
     */
    reportError(errorInfo) {
        // This would send to your error reporting service
        // For now, just log to console in production
        if (!Config.get('app.debug', false)) {
            console.warn('Error reported:', {
                message: errorInfo.message,
                type: errorInfo.type,
                timestamp: errorInfo.timestamp
            });
        }
    }
    
    /**
     * Get all errors
     */
    getErrors() {
        return [...this.errors];
    }
    
    /**
     * Get errors by type
     */
    getErrorsByType(type) {
        return this.errors.filter(error => error.type === type);
    }
    
    /**
     * Clear all errors
     */
    clearErrors() {
        this.errors = [];
    }
    
    /**
     * Export errors for debugging
     */
    exportErrors() {
        return JSON.stringify(this.errors, null, 2);
    }
}

// Create singleton instance
const ErrorHandlerInstance = new ErrorHandler();

// Export for use
if (typeof window !== 'undefined') {
    window.ErrorHandler = ErrorHandlerInstance;
}