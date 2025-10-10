import { createClient } from '@supabase/supabase-js';

/**
 * Supabase Configuration and Client
 * Replaces Firebase/Firestore with Supabase PostgreSQL
 */
class SupabaseConfig {
  constructor() {
    this.client = null;
    this.initialized = false;
  }

  /**
   * Initialize Supabase client with direct connection
   */
  async initialize() {
    if (this.initialized && this.client) {
      return this.client;
    }

    try {
      console.log('[Supabase] Initializing Supabase client...');

      const supabaseUrl = process.env.SUPABASE_URL;
      const supabaseKey = process.env.SUPABASE_SERVICE_KEY; // Use service role key for backend

      if (!supabaseUrl || !supabaseKey) {
        throw new Error('Supabase credentials not found. Please set SUPABASE_URL and SUPABASE_SERVICE_KEY');
      }

      // Create Supabase client with service role key (bypasses RLS)
      this.client = createClient(supabaseUrl, supabaseKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false
        },
        db: {
          schema: 'public'
        }
      });

      this.initialized = true;
      console.log('[Supabase] ✅ Supabase client initialized successfully');
      console.log(`[Supabase] URL: ${supabaseUrl}`);

      // Test connection
      await this.testConnection();

      return this.client;
    } catch (error) {
      console.error('[Supabase] ❌ Failed to initialize Supabase:', error.message);
      
      if (error.message.includes('credentials')) {
        console.error('[Supabase] 💡 Solution: Set SUPABASE_URL and SUPABASE_SERVICE_KEY in your .env file');
        console.error('[Supabase] Get these from: https://app.supabase.com/project/_/settings/api');
      }
      
      throw error;
    }
  }

  /**
   * Test Supabase connection
   */
  async testConnection() {
    try {
      // Test query to check if database is accessible
      const { data, error } = await this.client
        .from('user_tokens')
        .select('id')
        .limit(1);

      if (error) {
        // If table doesn't exist, that's ok - it will be created when schema is run
        if (error.code === '42P01') {
          console.warn('[Supabase] ⚠️ Tables not found. Please run the schema.sql file in Supabase SQL Editor');
          console.warn('[Supabase] Location: server/database/schema.sql');
          return false;
        }
        throw error;
      }

      console.log('[Supabase] ✅ Connection test successful');
      return true;
    } catch (error) {
      console.error('[Supabase] ⚠️ Connection test failed:', error.message);
      console.error('[Supabase] 💡 Make sure you have run the schema.sql file in your Supabase project');
      return false;
    }
  }

  /**
   * Get Supabase client instance
   */
  getClient() {
    if (!this.initialized || !this.client) {
      throw new Error('Supabase not initialized. Call initialize() first.');
    }
    return this.client;
  }

  /**
   * Ensure Supabase is initialized
   */
  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
    return this.client;
  }

  /**
   * Check if Supabase is available
   */
  isAvailable() {
    return this.initialized && this.client !== null;
  }

  /**
   * Get database schema information
   */
  async getSchemaInfo() {
    try {
      await this.ensureInitialized();

      const { data, error } = await this.client.rpc('get_schema_info', {});

      if (error) {
        console.warn('[Supabase] Could not fetch schema info:', error.message);
        return null;
      }

      return data;
    } catch (error) {
      console.error('[Supabase] Error getting schema info:', error);
      return null;
    }
  }

  /**
   * Health check
   */
  async healthCheck() {
    try {
      if (!this.initialized) {
        return {
          status: 'not_initialized',
          message: 'Supabase client not initialized'
        };
      }

      const isConnected = await this.testConnection();

      return {
        status: isConnected ? 'healthy' : 'degraded',
        message: isConnected ? 'Supabase connection healthy' : 'Supabase connection issues',
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
}

// Create singleton instance
const supabaseConfig = new SupabaseConfig();

export default supabaseConfig;
export { SupabaseConfig };


