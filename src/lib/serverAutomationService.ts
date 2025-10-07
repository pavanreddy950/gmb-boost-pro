// Server-side automation service
// This service syncs automation settings with the backend server
// The actual automation runs on the server, not in the browser

import { toast } from '@/hooks/use-toast';

interface AutomationSettings {
  autoPosting?: {
    enabled: boolean;
    schedule?: string;
    frequency?: string;
    businessName?: string;
    category?: string;
    categories?: string[];
    keywords?: string;
    websiteUrl?: string;
    timezone?: string;
    dayOfWeek?: number;
    topicType?: string;
    fullAddress?: string;
    city?: string;
    region?: string;
    country?: string;
    postalCode?: string;
    phoneNumber?: string;
    button?: {
      enabled: boolean;
      type: string;
      phoneNumber?: string;
      customUrl?: string;
    };
  };
  autoReply?: {
    enabled: boolean;
    replyToAll?: boolean;
    replyToPositive?: boolean;
    replyToNegative?: boolean;
    replyToNeutral?: boolean;
    businessName?: string;
  };
  userId?: string;
  accountId?: string;
}

interface AutomationStatus {
  autoPosting: {
    enabled: boolean;
    schedule: string | null;
    frequency: string | null;
    lastRun: string | null;
    isRunning: boolean;
  };
  autoReply: {
    enabled: boolean;
    lastCheck: string | null;
    isRunning: boolean;
  };
}

class ServerAutomationService {
  private backendUrl: string;

  constructor() {
    this.backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
  }

  // Save automation settings to server
  async saveAutomationSettings(locationId: string, settings: AutomationSettings): Promise<boolean> {
    try {
      console.log(`📤 Saving automation settings to server for location ${locationId}:`, settings);
      
      const response = await fetch(`${this.backendUrl}/api/automation/settings/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(settings),
      });

      if (!response.ok) {
        throw new Error(`Failed to save automation settings: ${response.statusText}`);
      }

      const result = await response.json();
      console.log('✅ Automation settings saved to server:', result);
      
      toast({
        title: 'Automation Settings Saved',
        description: 'Your automation settings have been saved and will run on the server even when you\'re offline.',
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error saving automation settings to server:', error);
      toast({
        title: 'Error Saving Settings',
        description: 'Failed to save automation settings to server. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }

  // Get automation status from server
  async getAutomationStatus(locationId: string): Promise<AutomationStatus | null> {
    try {
      const response = await fetch(`${this.backendUrl}/api/automation/status/${locationId}`);
      
      if (!response.ok) {
        throw new Error(`Failed to get automation status: ${response.statusText}`);
      }

      const status = await response.json();
      console.log(`📊 Automation status for location ${locationId}:`, status);
      return status;
    } catch (error) {
      console.error('❌ Error getting automation status:', error);
      return null;
    }
  }

  // Stop all automations for a location
  async stopAutomations(locationId: string): Promise<boolean> {
    try {
      console.log(`🛑 Stopping all automations for location ${locationId}`);
      
      const response = await fetch(`${this.backendUrl}/api/automation/stop/${locationId}`, {
        method: 'POST',
      });

      if (!response.ok) {
        throw new Error(`Failed to stop automations: ${response.statusText}`);
      }

      toast({
        title: 'Automations Stopped',
        description: 'All automations have been stopped for this location.',
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error stopping automations:', error);
      toast({
        title: 'Error',
        description: 'Failed to stop automations. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }

  // Manually trigger a post
  async triggerPost(locationId: string, config: any): Promise<boolean> {
    try {
      console.log(`🚀 Manually triggering post for location ${locationId}`);
      
      const response = await fetch(`${this.backendUrl}/api/automation/trigger-post/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to trigger post: ${response.statusText}`);
      }

      toast({
        title: 'Post Triggered',
        description: 'Post has been triggered successfully.',
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error triggering post:', error);
      toast({
        title: 'Error',
        description: 'Failed to trigger post. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }

  // Manually check reviews
  async checkReviews(locationId: string, config: any): Promise<boolean> {
    try {
      console.log(`🔍 Manually checking reviews for location ${locationId}`);
      
      const response = await fetch(`${this.backendUrl}/api/automation/check-reviews/${locationId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(config),
      });

      if (!response.ok) {
        throw new Error(`Failed to check reviews: ${response.statusText}`);
      }

      toast({
        title: 'Reviews Checked',
        description: 'Review check completed successfully.',
      });
      
      return true;
    } catch (error) {
      console.error('❌ Error checking reviews:', error);
      toast({
        title: 'Error',
        description: 'Failed to check reviews. Please try again.',
        variant: 'destructive',
      });
      return false;
    }
  }

  // Get automation logs
  async getAutomationLogs(): Promise<any[]> {
    try {
      const response = await fetch(`${this.backendUrl}/api/automation/logs`);
      
      if (!response.ok) {
        throw new Error(`Failed to get automation logs: ${response.statusText}`);
      }

      const logs = await response.json();
      return logs.activities || [];
    } catch (error) {
      console.error('❌ Error getting automation logs:', error);
      return [];
    }
  }

  // Enable auto-posting for a location
  async enableAutoPosting(
    locationId: string,
    businessName: string,
    schedule: string,
    frequency: string,
    category?: string,
    keywords?: string,
    websiteUrl?: string,
    userId?: string,
    accountId?: string,
    addressInfo?: {
      fullAddress?: string;
      city?: string;
      region?: string;
      country?: string;
      postalCode?: string;
    },
    phoneNumber?: string,
    button?: {
      enabled: boolean;
      type: string;
      phoneNumber?: string;
      customUrl?: string;
    }
  ): Promise<boolean> {
    const settings: AutomationSettings = {
      autoPosting: {
        enabled: true,
        schedule,
        frequency,
        businessName,
        category,
        keywords,
        websiteUrl,
        timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
        ...addressInfo,
        phoneNumber,
        button,
      },
      userId,
      accountId,
    };

    return this.saveAutomationSettings(locationId, settings);
  }

  // Disable auto-posting for a location
  async disableAutoPosting(locationId: string): Promise<boolean> {
    const settings: AutomationSettings = {
      autoPosting: {
        enabled: false,
      },
    };

    return this.saveAutomationSettings(locationId, settings);
  }

  // Enable auto-reply for a location
  async enableAutoReply(
    locationId: string,
    businessName: string,
    replyToAll: boolean = true,
    userId?: string,
    accountId?: string,
    keywords?: string,
    category?: string
  ): Promise<boolean> {
    const settings: AutomationSettings = {
      autoReply: {
        enabled: true,
        replyToAll,
        replyToPositive: true,
        replyToNegative: true,
        replyToNeutral: true,
        businessName,
      },
      userId,
      accountId,
    };
    
    // Add keywords and category if provided
    if (keywords) {
      (settings.autoReply as any).keywords = keywords;
    }
    if (category) {
      (settings.autoReply as any).category = category;
    }

    return this.saveAutomationSettings(locationId, settings);
  }

  // Disable auto-reply for a location
  async disableAutoReply(locationId: string): Promise<boolean> {
    const settings: AutomationSettings = {
      autoReply: {
        enabled: false,
      },
    };

    return this.saveAutomationSettings(locationId, settings);
  }
}

// Export singleton instance
export const serverAutomationService = new ServerAutomationService();

// Export for debugging
if (typeof window !== 'undefined') {
  (window as any).serverAutomationService = serverAutomationService;
  console.log('🤖 Server Automation Service initialized');
  console.log('   Use window.serverAutomationService to access the service');
}