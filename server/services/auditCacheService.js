/**
 * Audit Cache Service - High-performance caching for audit data
 * Reduces Google API calls and improves response times
 */
class AuditCacheService {
  constructor() {
    // In-memory cache with TTL
    this.cache = new Map();
    this.cacheTTL = 10 * 60 * 1000; // 10 minutes cache
    this.maxCacheSize = 1000; // Max cached items
    
    // Performance tracking
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      evictions: 0
    };
    
    // Auto-cleanup expired entries every 5 minutes
    setInterval(() => this.cleanupExpired(), 5 * 60 * 1000);
    
    console.log('[AuditCache] Initialized with 10-minute TTL');
  }
  
  /**
   * Generate cache key for location audit data
   */
  generateKey(locationId, startDate, endDate, type = 'performance') {
    return `audit:${type}:${locationId}:${startDate}:${endDate}`;
  }
  
  /**
   * Get cached audit data
   */
  get(key) {
    const entry = this.cache.get(key);
    
    if (!entry) {
      this.stats.misses++;
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      this.cache.delete(key);
      this.stats.misses++;
      return null;
    }
    
    this.stats.hits++;
    console.log(`[AuditCache] 🎯 HIT: ${key}`);
    return entry.data;
  }
  
  /**
   * Set cached audit data
   */
  set(key, data) {
    // Enforce max cache size (LRU eviction)
    if (this.cache.size >= this.maxCacheSize) {
      const oldestKey = this.cache.keys().next().value;
      this.cache.delete(oldestKey);
      this.stats.evictions++;
    }
    
    const entry = {
      data,
      cachedAt: Date.now(),
      expiresAt: Date.now() + this.cacheTTL
    };
    
    this.cache.set(key, entry);
    this.stats.sets++;
    
    console.log(`[AuditCache] 💾 SET: ${key} (expires in ${Math.round(this.cacheTTL / 60000)}min)`);
  }
  
  /**
   * Check if data exists in cache (without retrieving)
   */
  has(key) {
    const entry = this.cache.get(key);
    return entry && Date.now() <= entry.expiresAt;
  }
  
  /**
   * Clear cache for specific location
   */
  clearLocation(locationId) {
    let cleared = 0;
    for (const key of this.cache.keys()) {
      if (key.includes(`:${locationId}:`)) {
        this.cache.delete(key);
        cleared++;
      }
    }
    console.log(`[AuditCache] 🧹 Cleared ${cleared} entries for location ${locationId}`);
    return cleared;
  }
  
  /**
   * Clear all cache
   */
  clear() {
    const size = this.cache.size;
    this.cache.clear();
    console.log(`[AuditCache] 🧹 Cleared all ${size} cache entries`);
  }
  
  /**
   * Clean up expired entries
   */
  cleanupExpired() {
    const now = Date.now();
    let cleaned = 0;
    
    for (const [key, entry] of this.cache.entries()) {
      if (now > entry.expiresAt) {
        this.cache.delete(key);
        cleaned++;
      }
    }
    
    if (cleaned > 0) {
      console.log(`[AuditCache] 🧹 Cleaned ${cleaned} expired entries`);
    }
  }
  
  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0 
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(1)
      : 0;
      
    return {
      ...this.stats,
      hitRate: `${hitRate}%`,
      cacheSize: this.cache.size,
      maxSize: this.maxCacheSize,
      ttlMinutes: this.cacheTTL / 60000
    };
  }
  
  /**
   * Warm up cache for multiple locations
   */
  async warmupCache(locations, accessToken, fetchFunction) {
    console.log(`[AuditCache] 🔥 Warming up cache for ${locations.length} locations...`);
    
    const promises = locations.map(async (locationId) => {
      try {
        const endDate = new Date().toISOString().split('T')[0];
        const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
        
        const key = this.generateKey(locationId, startDate, endDate);
        
        // Only fetch if not cached
        if (!this.has(key)) {
          const data = await fetchFunction(locationId, startDate, endDate, accessToken);
          if (data) {
            this.set(key, data);
          }
        }
      } catch (error) {
        console.error(`[AuditCache] ❌ Warmup failed for location ${locationId}:`, error.message);
      }
    });
    
    await Promise.allSettled(promises);
    console.log(`[AuditCache] ✅ Cache warmup complete`);
  }
}

// Singleton instance
const auditCacheService = new AuditCacheService();

export default auditCacheService;


