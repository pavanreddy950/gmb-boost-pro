/**
 * Cache Manager - In-Memory with TTL
 * 
 * Features:
 * - Automatic expiration cleanup
 * - Cache hit/miss statistics
 * - Namespaced keys for organization
 * - Production-ready (can swap for Redis later)
 */
class CacheManager {
    constructor() {
        this.cache = new Map();
        this.ttls = new Map();
        this.stats = {
            hits: 0,
            misses: 0,
            sets: 0,
            evictions: 0,
            startTime: Date.now()
        };

        // Clean expired entries every 60 seconds
        this.cleanupInterval = setInterval(() => this.cleanExpired(), 60000);

        console.log('[CacheManager] ✅ Initialized with automatic cleanup (60s interval)');
    }

    /**
     * Set cache entry with TTL
     */
    set(key, value, ttlSeconds = 300) {
        this.cache.set(key, value);
        this.ttls.set(key, Date.now() + (ttlSeconds * 1000));
        this.stats.sets++;

        console.log(`[Cache] ✅ SET: ${key} (TTL: ${ttlSeconds}s)`);
        return true;
    }

    /**
     * Get cache entry (null if expired/missing)
     */
    get(key) {
        const expiry = this.ttls.get(key);

        // Expired or doesn't exist
        if (!expiry || expiry < Date.now()) {
            if (this.cache.has(key)) {
                this.delete(key);
            }
            this.stats.misses++;
            return null;
        }

        this.stats.hits++;
        const value = this.cache.get(key);

        console.log(`[Cache] 🎯 HIT: ${key}`);
        return value;
    }

    /**
     * Delete cache entry
     */
    delete(key) {
        const existed = this.cache.has(key);
        this.cache.delete(key);
        this.ttls.delete(key);

        if (existed) {
            console.log(`[Cache] 🗑️  DELETE: ${key}`);
        }

        return existed;
    }

    /**
     * Clear all cache entries
     */
    clear() {
        const size = this.cache.size;
        this.cache.clear();
        this.ttls.clear();
        this.stats.evictions++;

        console.log(`[Cache] 🧹 CLEAR: Removed ${size} entries`);
    }

    /**
     * Clean expired entries
     */
    cleanExpired() {
        const now = Date.now();
        let cleaned = 0;

        for (const [key, expiry] of this.ttls.entries()) {
            if (expiry < now) {
                this.cache.delete(key);
                this.ttls.delete(key);
                cleaned++;
            }
        }

        if (cleaned > 0) {
            console.log(`[Cache] 🧹 Cleaned ${cleaned} expired entries`);
        }
    }

    /**
     * Get cache statistics
     */
    getStats() {
        const total = this.stats.hits + this.stats.misses;
        const hitRate = total > 0 ? ((this.stats.hits / total) * 100).toFixed(2) : '0.00';
        const uptime = Math.floor((Date.now() - this.stats.startTime) / 1000);

        return {
            size: this.cache.size,
            hits: this.stats.hits,
            misses: this.stats.misses,
            hitRate: `${hitRate}%`,
            sets: this.stats.sets,
            evictions: this.stats.evictions,
            uptime: `${uptime}s`,
            performance: {
                total: total,
                hitRate: parseFloat(hitRate)
            }
        };
    }

    /**
     * Health check
     */
    healthCheck() {
        const stats = this.getStats();

        return {
            status: 'healthy',
            cache: {
                enabled: true,
                type: 'in-memory',
                ...stats
            },
            timestamp: new Date().toISOString()
        };
    }

    // ========================================
    // Namespaced Key Helpers
    // ========================================

    /**
     * User-related cache keys
     */
    getUserKey(userId, suffix = '') {
        return `user:${userId}${suffix ? ':' + suffix : ''}`;
    }

    /**
     * Location-related cache keys
     */
    getLocationKey(locationId, suffix = '') {
        return `location:${locationId}${suffix ? ':' + suffix : ''}`;
    }

    /**
     * Automation-related cache keys
     */
    getAutomationKey(locationId) {
        return `automation:${locationId}`;
    }

    /**
     * Token-related cache keys
     */
    getTokenKey(userId) {
        return `token:${userId}`;
    }

    /**
     * Settings cache key
     */
    getSettingsKey(type) {
        return `settings:${type}`;
    }

    /**
     * Invalidate all keys matching pattern
     */
    invalidatePattern(pattern) {
        let invalidated = 0;

        for (const key of this.cache.keys()) {
            if (key.includes(pattern)) {
                this.delete(key);
                invalidated++;
            }
        }

        if (invalidated > 0) {
            console.log(`[Cache] 🔄 Invalidated ${invalidated} keys matching: ${pattern}`);
        }

        return invalidated;
    }

    /**
     * Stop cleanup interval (for graceful shutdown)
     */
    destroy() {
        if (this.cleanupInterval) {
            clearInterval(this.cleanupInterval);
            console.log('[CacheManager] 🛑 Cleanup interval stopped');
        }
    }
}

// Singleton instance
const cacheManager = new CacheManager();

export default cacheManager;
