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
            csvGeneratorInstance: null,
            // Multi-universe support
            universes: {}, // Will store products by universe ID
            availableUniverses: [], // List of detected universes with counts
            activeUniverse: 1, // Currently selected universe (default to Films)
            universeCounts: {}, // Count of products per universe
            autoScrollEnabled: true, // Whether auto-scroll is currently enabled
            userScrolledUp: false, // Whether user has manually scrolled up
            totalItemsCount: 0 // Total count of items loaded across all universes
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
        const changes = {};
        for (const [key, value] of Object.entries(updates)) {
            const oldValue = this.state[key];
            this.state[key] = value;
            changes[key] = { newValue: value, oldValue };
        }
        this.notifyListeners('batch_update', changes, null);
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
            csvGeneratorInstance: null,
            universes: {},
            availableUniverses: [],
            activeUniverse: 1,
            universeCounts: {},
            autoScrollEnabled: true,
            userScrolledUp: false,
            totalItemsCount: 0
        };
        this.notifyListeners('reset', this.state, null);
    }
    
    /**
     * Add products to the collection, organizing by universe
     */
    addProducts(products) {
        products.forEach(product => {
            const universeId = product.universe;
            
            // Initialize universe array if it doesn't exist
            if (!this.state.universes[universeId]) {
                this.state.universes[universeId] = [];
            }
            
            // Add product to the appropriate universe
            this.state.universes[universeId].push(product);
            
            // Update universe count
            this.state.universeCounts[universeId] = (this.state.universeCounts[universeId] || 0) + 1;
        });
        
        // Update available universes list
        this.updateAvailableUniverses();
        
        // Also add to the general products array for backward compatibility
        this.state.products.push(...products);
        
        // Update total items count
        this.state.totalItemsCount += products.length;
        
        this.notifyListeners('products_added', products, null);
    }
    
    /**
     * Update available universes based on current data
     */
    updateAvailableUniverses() {
        const universes = [];
        for (const [universeId, products] of Object.entries(this.state.universes)) {
            if (products.length > 0) {
                const universeConfig = CONFIG.UNIVERSES[universeId];
                if (universeConfig) {
                    universes.push({
                        id: parseInt(universeId),
                        label: universeConfig.label,
                        count: products.length
                    });
                }
            }
        }
        
        // Sort by universe ID to maintain consistent order
        universes.sort((a, b) => a.id - b.id);
        
        this.state.availableUniverses = universes;
        this.notifyListeners('universes_updated', universes, null);
    }
    
    /**
     * Get products for a specific universe
     */
    getUniverseProducts(universeId) {
        return this.state.universes[universeId] || [];
    }
    
    /**
     * Get products for the currently active universe
     */
    getActiveUniverseProducts() {
        return this.getUniverseProducts(this.state.activeUniverse);
    }
    
    /**
     * Set the active universe
     */
    setActiveUniverse(universeId) {
        const oldUniverse = this.state.activeUniverse;
        this.state.activeUniverse = universeId;
        this.notifyListeners('active_universe_changed', universeId, oldUniverse);
    }
    
    /**
     * Get available universes with counts
     */
    getAvailableUniverses() {
        return this.state.availableUniverses;
    }
    
    /**
     * Set auto-scroll enabled state
     */
    setAutoScrollEnabled(enabled) {
        const oldValue = this.state.autoScrollEnabled;
        this.state.autoScrollEnabled = enabled;
        this.notifyListeners('auto_scroll_changed', enabled, oldValue);
    }
    
    /**
     * Get auto-scroll enabled state
     */
    isAutoScrollEnabled() {
        return this.state.autoScrollEnabled;
    }
    
    /**
     * Set user scrolled up state
     */
    setUserScrolledUp(scrolledUp) {
        const oldValue = this.state.userScrolledUp;
        this.state.userScrolledUp = scrolledUp;
        this.notifyListeners('user_scroll_changed', scrolledUp, oldValue);
    }
    
    /**
     * Get user scrolled up state
     */
    hasUserScrolledUp() {
        return this.state.userScrolledUp;
    }
    
    /**
     * Increment offset for pagination
     */
    incrementOffset(amount = CONFIG.API.DEFAULT_LIMIT) {
        this.state.offset += amount;
        this.notifyListeners('offset_incremented', this.state.offset, this.state.offset - amount);
    }
    
    /**
     * Increment page counter
     */
    incrementPage() {
        this.state.currentPage += 1;
        this.notifyListeners('page_incremented', this.state.currentPage, this.state.currentPage - 1);
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
     * Add a state change listener (alias for subscribe)
     */
    addListener(key, callback) {
        if (!this.listeners.has(key)) {
            this.listeners.set(key, []);
        }
        this.listeners.get(key).push(callback);
    }
    
    /**
     * Remove a state change listener
     */
    removeListener(key, callback) {
        if (this.listeners.has(key)) {
            const callbacks = this.listeners.get(key);
            const index = callbacks.indexOf(callback);
            if (index > -1) {
                callbacks.splice(index, 1);
            }
        }
    }
    
    /**
     * Notify all listeners for a specific key
     */
    notifyListeners(key, newValue, oldValue) {
        if (this.listeners.has(key)) {
            this.listeners.get(key).forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    console.error(`Error in state listener for key "${key}":`, error);
                }
            });
        }
        
        // Also notify global listeners
        if (this.listeners.has('*')) {
            this.listeners.get('*').forEach(callback => {
                try {
                    callback(newValue, oldValue, key);
                } catch (error) {
                    console.error('Error in global state listener:', error);
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
    
    /**
     * Get total items count across all universes
     */
    getTotalItemsCount() {
        return this.state.totalItemsCount;
    }
}

// Create and export singleton instance
const stateManager = new StateManager(); 