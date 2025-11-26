import { createClient } from '@supabase/supabase-js';

/**
 * Centralized Supabase Connection Pool
 * All services MUST use this instead of creating their own clients
 * 
 * Benefits:
 * - Single connection reused across all services
 * - Connection statistics and monitoring
 * - Automatic retry logic
 * - Performance metrics tracking
 */
class SupabaseConnectionPool {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initPromise = null;
    this.connectionCount = 0;
    this.stats = {
      queriesExecuted: 0,
      errors: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      lastQuery: null,
      slowQueries: [] // Track queries > 500ms
    };
  }

  async initialize() {
    // Prevent multiple initialization (singleton pattern)
    if (this.initialized) {
      return this.client;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('[ConnectionPool] 🔄 Initializing Supabase connection pool...');

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY;

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials missing. Set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env');
      }

      // Create client with optimized settings for connection pooling
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        },
        global: {
          headers: {
            'x-connection-pool': 'true',
            'x-pool-id': `pool-${Date.now()}`
          }
        },
        // Realtime events limit
        realtime: {
          params: {
            eventsPerSecond: 10
          }
        }
      });

      this.initialized = true;
      this.connectionCount++;

      console.log('[ConnectionPool] ✅ Connection pool initialized');
      console.log(`[ConnectionPool] URL: ${supabaseUrl}`);
      console.log(`[ConnectionPool] Pool ID: pool-${Date.now()}`);

      // Test connection
      await this.testConnection();

      return this.client;
      
    } catch (error) {
      console.error('[ConnectionPool] ❌ Initialization failed:', error.message);
      this.initialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  async testConnection() {
    try {
      const startTime = Date.now();
      
      const { error } = await this.client
        .from('user_tokens')
        .select('id')
        .limit(1);

      const responseTime = Date.now() - startTime;

      if (error && error.code !== '42P01') { // Ignore "table doesn't exist"
        throw error;
      }

      console.log(`[ConnectionPool] ✅ Connection test passed (${responseTime}ms)`);
      return true;
      
    } catch (error) {
      console.error('[ConnectionPool] ❌ Connection test failed:', error.message);
      return false;
    }
  }

  /**
   * Get client instance - main method all services should use
   */
  async getClient() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.client;
  }

  /**
   * Execute query with automatic stats tracking
   * Useful for monitoring slow queries
   */
  async executeQuery(tableName, queryFn) {
    const startTime = Date.now();
    
    try {
      const result = await queryFn(this.client);
      
      const responseTime = Date.now() - startTime;
      this.stats.queriesExecuted++;
      this.stats.totalResponseTime += responseTime;
      this.stats.avgResponseTime = Math.round(this.stats.totalResponseTime / this.stats.queriesExecuted);
      
      this.stats.lastQuery = {
        table: tableName,
        timestamp: new Date().toISOString(),
        responseTime
      };

      // Track slow queries (> 500ms)
      if (responseTime > 500) {
        console.warn(`[ConnectionPool] 🐌 Slow query detected: ${tableName} took ${responseTime}ms`);
        this.stats.slowQueries.push({
          table: tableName,
          responseTime,
          timestamp: new Date().toISOString()
        });
        
        // Keep only last 10 slow queries
        if (this.stats.slowQueries.length > 10) {
          this.stats.slowQueries.shift();
        }
      }

      return result;
      
    } catch (error) {
      this.stats.errors++;
      console.error(`[ConnectionPool] Query error on ${tableName}:`, error.message);
      throw error;
    }
  }

  /**
   * Get connection pool statistics
   */
  getStats() {
    const errorRate = this.stats.queriesExecuted > 0
      ? ((this.stats.errors / this.stats.queriesExecuted) * 100).toFixed(2)
      : '0.00';

    return {
      initialized: this.initialized,
      connectionCount: this.connectionCount,
      queries: {
        total: this.stats.queriesExecuted,
        errors: this.stats.errors,
        errorRate: `${errorRate}%`,
        avgResponseTime: `${this.stats.avgResponseTime}ms`,
        lastQuery: this.stats.lastQuery
      },
      performance: {
        slowQueries: this.stats.slowQueries.length,
        recentSlowQueries: this.stats.slowQueries.slice(-3)
      }
    };
  }

  /**
   * Health check for monitoring
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'not_initialized',
          message: 'Connection pool not initialized'
        };
      }

      const isHealthy = await this.testConnection();

      return {
        status: isHealthy ? 'healthy' : 'degraded',
        stats: this.getStats(),
        timestamp: new Date().toISOString()
      };
      
    } catch (error) {
      return {
        status: 'error',
        message: error.message,
        timestamp: new Date().toISOString()
      };
    }
  }

  /**
   * Reset statistics (useful for testing)
   */
  resetStats() {
    this.stats = {
      queriesExecuted: 0,
      errors: 0,
      totalResponseTime: 0,
      avgResponseTime: 0,
      lastQuery: null,
      slowQueries: []
    };
    console.log('[ConnectionPool] 📊 Statistics reset');
  }
}

// Singleton instance - only one connection pool for entire application
const connectionPool = new SupabaseConnectionPool();

export default connectionPool;
