export interface AutoPostingConfig {
  locationId: string;
  businessName: string;
  locationName?: string; // Full location name for API calls
  websiteUrl?: string; // Website URL for call-to-action
  categories: string[];
  keywords: string[];
  enabled: boolean;
  schedule: {
    frequency: 'daily' | 'alternative' | 'weekly' | 'custom' | 'test30s';
    time: string; // Format: "HH:MM"
    customTimes?: string[]; // For custom frequency
  };
  button?: {
    enabled: boolean;
    type: 'auto' | 'none' | 'book' | 'order' | 'buy' | 'learn_more' | 'sign_up' | 'call_now';
    customUrl?: string; // Custom URL for most button types
    phoneNumber?: string; // Phone number for call_now button
  };
  lastPost?: string; // ISO timestamp
  nextPost?: string; // ISO timestamp
  stats: {
    totalPosts: number;
    successfulPosts: number;
    failedPosts: number;
    lastPostStatus?: 'success' | 'failed';
  };
}

export interface AutoPostingStats {
  totalConfigurations: number;
  activeConfigurations: number;
  totalPostsToday: number;
  successfulPostsToday: number;
  failedPostsToday: number;
}

class AutomationStorage {
  private readonly STORAGE_KEY = 'lobaiseo_auto_posting_configs';
  private readonly GLOBAL_STATS_KEY = 'lobaiseo_auto_posting_global_stats';

  // Get all configurations
  getAllConfigurations(): AutoPostingConfig[] {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (!stored) return [];
      return JSON.parse(stored);
    } catch (error) {
      console.error('Failed to load auto-posting configurations:', error);
      return [];
    }
  }

  // Get configuration for a specific location
  getConfiguration(locationId: string): AutoPostingConfig | null {
    const configs = this.getAllConfigurations();
    return configs.find(config => config.locationId === locationId) || null;
  }

  // Save or update configuration for a location
  saveConfiguration(config: AutoPostingConfig): void {
    try {
      const configs = this.getAllConfigurations();
      const existingIndex = configs.findIndex(c => c.locationId === config.locationId);
      
      if (existingIndex >= 0) {
        configs[existingIndex] = config;
      } else {
        configs.push(config);
      }
      
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(configs));
      
      // Emit event for real-time updates
      window.dispatchEvent(new CustomEvent('autoPostingConfigChanged', { 
        detail: { locationId: config.locationId, config } 
      }));
    } catch (error) {
      console.error('Failed to save auto-posting configuration:', error);
      throw error;
    }
  }

  // Delete configuration for a location
  deleteConfiguration(locationId: string): void {
    try {
      const configs = this.getAllConfigurations();
      const filtered = configs.filter(c => c.locationId !== locationId);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      
      // Emit event for real-time updates
      window.dispatchEvent(new CustomEvent('autoPostingConfigDeleted', { 
        detail: { locationId } 
      }));
    } catch (error) {
      console.error('Failed to delete auto-posting configuration:', error);
      throw error;
    }
  }

  // Get enabled configurations only
  getEnabledConfigurations(): AutoPostingConfig[] {
    return this.getAllConfigurations().filter(config => config.enabled);
  }

  // Update last post time and stats
  updatePostStatus(locationId: string, success: boolean, timestamp?: string): void {
    const config = this.getConfiguration(locationId);
    if (!config) return;

    const now = timestamp || new Date().toISOString();
    
    config.lastPost = now;
    config.stats.totalPosts++;
    
    if (success) {
      config.stats.successfulPosts++;
      config.stats.lastPostStatus = 'success';
    } else {
      config.stats.failedPosts++;
      config.stats.lastPostStatus = 'failed';
    }

    this.saveConfiguration(config);
  }

  // Calculate next post time based on schedule
  calculateNextPostTime(config: AutoPostingConfig): string {
    const now = new Date();
    const [hours, minutes] = config.schedule.time.split(':').map(Number);
    
    let nextPost = new Date();
    nextPost.setHours(hours, minutes, 0, 0);
    
    switch (config.schedule.frequency) {
      case 'test30s':
        // For test mode, next post is in 30 seconds
        nextPost = new Date(now.getTime() + 30 * 1000);
        break;
        
      case 'daily':
        // If time has passed today, schedule for tomorrow
        if (nextPost <= now) {
          nextPost.setDate(nextPost.getDate() + 1);
        }
        break;
        
      case 'alternative':
        // Every other day
        if (nextPost <= now) {
          nextPost.setDate(nextPost.getDate() + 2);
        } else {
          nextPost.setDate(nextPost.getDate() + 1);
        }
        break;
        
      case 'weekly':
        // Once a week
        if (nextPost <= now) {
          nextPost.setDate(nextPost.getDate() + 7);
        }
        break;
        
      case 'custom':
        // Find next custom time today or tomorrow
        if (config.schedule.customTimes && config.schedule.customTimes.length > 0) {
          const customTimes = config.schedule.customTimes
            .map(time => {
              const [h, m] = time.split(':').map(Number);
              const customTime = new Date();
              customTime.setHours(h, m, 0, 0);
              return customTime;
            })
            .sort((a, b) => a.getTime() - b.getTime());
          
          // Find next time today
          const nextTimeToday = customTimes.find(time => time > now);
          
          if (nextTimeToday) {
            nextPost = nextTimeToday;
          } else {
            // All times have passed today, use first time tomorrow
            nextPost = customTimes[0];
            nextPost.setDate(nextPost.getDate() + 1);
          }
        }
        break;
    }
    
    return nextPost.toISOString();
  }

  // Update next post time
  updateNextPostTime(locationId: string, frequency?: string): void {
    const config = this.getConfiguration(locationId);
    if (!config) return;

    // If frequency is provided, update it first
    if (frequency && ['daily', 'alternative', 'weekly', 'custom', 'test30s'].includes(frequency)) {
      config.schedule.frequency = frequency as any;
    }

    config.nextPost = this.calculateNextPostTime(config);
    this.saveConfiguration(config);
  }

  // Get global statistics
  getGlobalStats(): AutoPostingStats {
    try {
      const configs = this.getAllConfigurations();
      const today = new Date().toDateString();
      
      let totalPostsToday = 0;
      let successfulPostsToday = 0;
      let failedPostsToday = 0;
      
      // Calculate today's stats from stored data
      const storedStats = localStorage.getItem(this.GLOBAL_STATS_KEY);
      if (storedStats) {
        const parsed = JSON.parse(storedStats);
        if (parsed.date === today) {
          totalPostsToday = parsed.totalPostsToday || 0;
          successfulPostsToday = parsed.successfulPostsToday || 0;
          failedPostsToday = parsed.failedPostsToday || 0;
        }
      }
      
      return {
        totalConfigurations: configs.length,
        activeConfigurations: configs.filter(c => c.enabled).length,
        totalPostsToday,
        successfulPostsToday,
        failedPostsToday,
      };
    } catch (error) {
      console.error('Failed to load global stats:', error);
      return {
        totalConfigurations: 0,
        activeConfigurations: 0,
        totalPostsToday: 0,
        successfulPostsToday: 0,
        failedPostsToday: 0,
      };
    }
  }

  // Update global daily stats
  updateGlobalStats(postSuccess: boolean): void {
    try {
      const today = new Date().toDateString();
      const stored = localStorage.getItem(this.GLOBAL_STATS_KEY);
      
      let stats = {
        date: today,
        totalPostsToday: 0,
        successfulPostsToday: 0,
        failedPostsToday: 0,
      };
      
      if (stored) {
        const parsed = JSON.parse(stored);
        if (parsed.date === today) {
          stats = parsed;
        }
      }
      
      stats.totalPostsToday++;
      if (postSuccess) {
        stats.successfulPostsToday++;
      } else {
        stats.failedPostsToday++;
      }
      
      localStorage.setItem(this.GLOBAL_STATS_KEY, JSON.stringify(stats));
      
      // Emit event for real-time updates
      window.dispatchEvent(new CustomEvent('globalStatsUpdated', { detail: stats }));
    } catch (error) {
      console.error('Failed to update global stats:', error);
    }
  }

  // Create default configuration
  createDefaultConfiguration(locationId: string, businessName: string): AutoPostingConfig {
    const defaultConfig: AutoPostingConfig = {
      locationId,
      businessName,
      categories: [],
      keywords: [],
      enabled: true, // Auto-posting enabled by default for all users
      schedule: {
        frequency: 'daily', // Default to daily posting instead of alternative
        time: '09:00',
      },
      button: {
        enabled: true,
        type: 'auto', // Auto-select button based on business category
      },
      stats: {
        totalPosts: 0,
        successfulPosts: 0,
        failedPosts: 0,
      },
    };

    defaultConfig.nextPost = this.calculateNextPostTime(defaultConfig);
    return defaultConfig;
  }

  // Listen for real-time updates
  onConfigurationChange(callback: (locationId: string, config: AutoPostingConfig) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail.locationId, event.detail.config);
    };
    
    window.addEventListener('autoPostingConfigChanged', handler as EventListener);
    
    return () => {
      window.removeEventListener('autoPostingConfigChanged', handler as EventListener);
    };
  }

  // Listen for configuration deletions
  onConfigurationDeleted(callback: (locationId: string) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail.locationId);
    };
    
    window.addEventListener('autoPostingConfigDeleted', handler as EventListener);
    
    return () => {
      window.removeEventListener('autoPostingConfigDeleted', handler as EventListener);
    };
  }

  // Listen for global stats updates
  onGlobalStatsUpdated(callback: (stats: AutoPostingStats) => void): () => void {
    const handler = (event: CustomEvent) => {
      callback(event.detail);
    };
    
    window.addEventListener('globalStatsUpdated', handler as EventListener);
    
    return () => {
      window.removeEventListener('globalStatsUpdated', handler as EventListener);
    };
  }
}

// Export singleton instance
export const automationStorage = new AutomationStorage();