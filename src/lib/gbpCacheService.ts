// Google Business Profile Cache Service
// Implements caching to reduce API calls and improve performance

interface CacheEntry<T> {
  data: T;
  timestamp: number;
  expiresAt: number;
}

class GBPCacheService {
  private cache: Map<string, CacheEntry<any>> = new Map();
  private readonly DEFAULT_TTL = 5 * 60 * 1000; // 5 minutes cache
  private readonly LONG_TTL = 30 * 60 * 1000; // 30 minutes for rarely changing data
  
  constructor() {
    // Load cache from localStorage on init
    this.loadCacheFromStorage();
    
    // Save cache to localStorage periodically
    setInterval(() => this.saveCacheToStorage(), 30000); // Every 30 seconds
  }

  // Get cached data
  get<T>(key: string): T | null {
    const entry = this.cache.get(key);
    
    if (!entry) {
      console.log(`[Cache] MISS: ${key}`);
      return null;
    }
    
    // Check if expired
    if (Date.now() > entry.expiresAt) {
      console.log(`[Cache] EXPIRED: ${key}`);
      this.cache.delete(key);
      return null;
    }
    
    console.log(`[Cache] HIT: ${key}`);
    return entry.data as T;
  }

  // Set cached data with custom TTL
  set<T>(key: string, data: T, ttlMs?: number): void {
    const ttl = ttlMs || this.DEFAULT_TTL;
    const entry: CacheEntry<T> = {
      data,
      timestamp: Date.now(),
      expiresAt: Date.now() + ttl
    };
    
    this.cache.set(key, entry);
    console.log(`[Cache] SET: ${key} (TTL: ${ttl}ms)`);
  }

  // Clear specific cache entry
  invalidate(key: string): void {
    this.cache.delete(key);
    console.log(`[Cache] INVALIDATED: ${key}`);
  }

  // Clear all cache entries matching a pattern
  invalidatePattern(pattern: string): void {
    const regex = new RegExp(pattern);
    const keysToDelete: string[] = [];
    
    this.cache.forEach((_, key) => {
      if (regex.test(key)) {
        keysToDelete.push(key);
      }
    });
    
    keysToDelete.forEach(key => this.cache.delete(key));
    console.log(`[Cache] INVALIDATED ${keysToDelete.length} entries matching pattern: ${pattern}`);
  }

  // Clear all cache
  clear(): void {
    this.cache.clear();
    console.log('[Cache] CLEARED all entries');
    this.saveCacheToStorage();
  }

  // Load cache from localStorage
  private loadCacheFromStorage(): void {
    try {
      const stored = localStorage.getItem('gbp_cache');
      if (stored) {
        const data = JSON.parse(stored);
        const now = Date.now();
        
        // Restore non-expired entries
        Object.entries(data).forEach(([key, entry]: [string, any]) => {
          if (entry.expiresAt > now) {
            this.cache.set(key, entry);
          }
        });
        
        console.log(`[Cache] Loaded ${this.cache.size} entries from storage`);
      }
    } catch (error) {
      console.error('[Cache] Failed to load from storage:', error);
    }
  }

  // Save cache to localStorage
  private saveCacheToStorage(): void {
    try {
      const data: Record<string, CacheEntry<any>> = {};
      this.cache.forEach((entry, key) => {
        data[key] = entry;
      });
      
      localStorage.setItem('gbp_cache', JSON.stringify(data));
      console.log(`[Cache] Saved ${this.cache.size} entries to storage`);
    } catch (error) {
      console.error('[Cache] Failed to save to storage:', error);
    }
  }

  // Generate cache key for accounts
  getAccountsCacheKey(userId?: string): string {
    return `accounts:${userId || 'default'}`;
  }

  // Generate cache key for locations
  getLocationsCacheKey(accountId: string): string {
    return `locations:${accountId}`;
  }

  // Generate cache key for reviews
  getReviewsCacheKey(locationId: string): string {
    return `reviews:${locationId}`;
  }

  // Generate cache key for posts
  getPostsCacheKey(locationId: string): string {
    return `posts:${locationId}`;
  }

  // Cache accounts with longer TTL (they don't change often)
  cacheAccounts(accounts: any[], userId?: string): void {
    const key = this.getAccountsCacheKey(userId);
    this.set(key, accounts, this.LONG_TTL);
  }

  // Get cached accounts
  getCachedAccounts(userId?: string): any[] | null {
    const key = this.getAccountsCacheKey(userId);
    return this.get(key);
  }

  // Cache locations with standard TTL
  cacheLocations(accountId: string, locations: any[]): void {
    const key = this.getLocationsCacheKey(accountId);
    this.set(key, locations, this.DEFAULT_TTL);
  }

  // Get cached locations
  getCachedLocations(accountId: string): any[] | null {
    const key = this.getLocationsCacheKey(accountId);
    return this.get(key);
  }

  // Batch cache multiple data types
  batchCache(data: { accounts?: any[], locations?: Record<string, any[]> }): void {
    if (data.accounts) {
      this.cacheAccounts(data.accounts);
    }
    
    if (data.locations) {
      Object.entries(data.locations).forEach(([accountId, locs]) => {
        this.cacheLocations(accountId, locs);
      });
    }
  }
}

// Export singleton instance
export const gbpCache = new GBPCacheService();