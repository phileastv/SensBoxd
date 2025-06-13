/**
 * State management for SensBoxd application
 * Encapsulates all global state and provides methods to manipulate it
 */
class StateManager {
    constructor() {
        this.state = {
            username: null,
            offset: 0,
            products: [],
            currentPage: 0,
            isLoading: false,
            loadingMessages: CONFIG.MESSAGES.FR.LOADING,
            currentMessageIndex: 0,
            total: 0,
            exportType: 'diary',
            csvGeneratorInstance: null
        };
        
        this.listeners = new Map();
    }
    
    /**
     * Get current state
     */
    getState() {
        return { ...this.state };
    }
    
    /**
     * Get specific state property
     */
    get(key) {
        return this.state[key];
    }
    
    /**
     * Set specific state property
     */
    set(key, value) {
        const oldValue = this.state[key];
        this.state[key] = value;
        this.notifyListeners(key, value, oldValue);
    }
    
    /**
     * Update multiple state properties
     */
    update(updates) {
        const changes = [];
        for (const [key, value] of Object.entries(updates)) {
            const oldValue = this.state[key];
            this.state[key] = value;
            changes.push({ key, value, oldValue });
        }
        
        changes.forEach(({ key, value, oldValue }) => {
            this.notifyListeners(key, value, oldValue);
        });
    }
    
    /**
     * Reset state to initial values
     */
    reset() {
        this.state = {
            username: null,
            offset: 0,
            products: [],
            currentPage: 0,
            isLoading: false,
            loadingMessages: CONFIG.MESSAGES.FR.LOADING,
            currentMessageIndex: 0,
            total: 0,
            exportType: 'diary',
            csvGeneratorInstance: null
        };
        this.notifyListeners('reset', this.state, null);
    }
    
    /**
     * Add a new product to the collection
     */
    addProduct(product) {
        this.state.products.push(product);
        this.notifyListeners('products', this.state.products, null);
    }
    
    /**
     * Add multiple products to the collection
     */
    addProducts(products) {
        this.state.products.push(...products);
        this.notifyListeners('products', this.state.products, null);
    }
    
    /**
     * Clear all products
     */
    clearProducts() {
        this.state.products = [];
        this.notifyListeners('products', this.state.products, null);
    }
    
    /**
     * Increment offset for pagination
     */
    incrementOffset(amount = CONFIG.API.DEFAULT_LIMIT) {
        this.state.offset += amount;
        this.notifyListeners('offset', this.state.offset, this.state.offset - amount);
    }
    
    /**
     * Increment page counter
     */
    incrementPage() {
        this.state.currentPage += 1;
        this.notifyListeners('currentPage', this.state.currentPage, this.state.currentPage - 1);
    }
    
    /**
     * Get next loading message (cycling through available messages)
     */
    getNextLoadingMessage() {
        const message = this.state.loadingMessages[this.state.currentMessageIndex];
        this.state.currentMessageIndex = (this.state.currentMessageIndex + 1) % this.state.loadingMessages.length;
        return message;
    }
    
    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.listeners.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }
    
    /**
     * Notify all listeners for a specific key
     */
    notifyListeners(key, newValue, oldValue) {
        const callbacks = this.listeners.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    console.error(`Error in state listener for key "${key}":`, error);
                }
            });
        }
    }
    
    /**
     * Get username validation status
     */
    isUsernameValid() {
        return this.state.username && this.state.username.trim().length > 0;
    }
    
    /**
     * Get products count
     */
    getProductsCount() {
        return this.state.products.length;
    }
    
    /**
     * Check if all products have been loaded
     */
    hasMoreProducts() {
        return this.state.total > this.state.products.length;
    }
    
    /**
     * Get current progress percentage
     */
    getProgress() {
        if (this.state.total === 0) return 0;
        return Math.round((this.state.products.length / this.state.total) * 100);
    }
}

// Create and export singleton instance
const stateManager = new StateManager(); 