import { automationStorage, type AutoPostingConfig } from './automationStorage';
import { openaiService } from './openaiService';
import { googleBusinessProfileService } from './googleBusinessProfile';
import { toast } from '@/hooks/use-toast';

interface PostResult {
  success: boolean;
  error?: string;
  postContent?: string;
}

class AutomationService {
  private intervalId: NodeJS.Timeout | null = null;
  private isRunning = false;
  private checkInterval = 15000; // Check every 15 seconds

  constructor() {
    this.start();
  }

  start(): void {
    if (this.isRunning) return;
    
    console.log('🚀 Starting automation service...');
    this.isRunning = true;
    
    // Run initial check
    this.checkAndProcessPosts();
    
    // Set up interval for regular checks
    this.intervalId = setInterval(() => {
      this.checkAndProcessPosts();
    }, this.checkInterval);
  }

  stop(): void {
    if (!this.isRunning) return;
    
    console.log('⏹️ Stopping automation service...');
    this.isRunning = false;
    
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
  }

  private async checkAndProcessPosts(): Promise<void> {
    try {
      const enabledConfigs = automationStorage.getEnabledConfigurations();
      const now = new Date();
      
      console.log(`🔍 Checking ${enabledConfigs.length} enabled configurations at ${now.toLocaleString()}`);
      
      for (const config of enabledConfigs) {
        await this.processConfigurationIfReady(config, now);
      }
    } catch (error) {
      console.error('🚨 Error in automation service check:', error);
    }
  }

  private async processConfigurationIfReady(config: AutoPostingConfig, now: Date): Promise<void> {
    try {
      // For test30s mode, ignore stored nextPost and check if 30 seconds have passed since lastPost
      if (config.schedule.frequency === 'test30s') {
        if (config.lastPost) {
          const lastPostTime = new Date(config.lastPost).getTime();
          const timeSinceLastPost = now.getTime() - lastPostTime;
          
          if (timeSinceLastPost >= 30000) { // 30 seconds in milliseconds
            console.log(`🧪 TEST MODE: 30 seconds passed for ${config.businessName} - posting now!`);
            await this.executePost(config);
          } else {
            const remainingTime = Math.ceil((30000 - timeSinceLastPost) / 1000);
            console.log(`🧪 TEST MODE: ${remainingTime}s remaining for ${config.businessName}`);
          }
        } else {
          // No last post, post immediately
          console.log(`🧪 TEST MODE: First post for ${config.businessName} - posting now!`);
          await this.executePost(config);
        }
        return;
      }

      // For other frequencies, use the scheduled nextPost time
      if (!config.nextPost) {
        console.log(`⚠️ No nextPost time for ${config.businessName}, calculating...`);
        automationStorage.updateNextPostTime(config.locationId);
        return;
      }

      const nextPostTime = new Date(config.nextPost);
      
      if (now >= nextPostTime) {
        console.log(`⏰ Time to post for ${config.businessName}! Scheduled: ${nextPostTime.toLocaleString()}, Current: ${now.toLocaleString()}`);
        await this.executePost(config);
      } else {
        const remainingMinutes = Math.ceil((nextPostTime.getTime() - now.getTime()) / (1000 * 60));
        if (remainingMinutes <= 5) { // Only log if within 5 minutes
          console.log(`⏱️ ${config.businessName}: ${remainingMinutes} minutes until next post`);
        }
      }
    } catch (error) {
      console.error(`🚨 Error processing configuration for ${config.businessName}:`, error);
    }
  }

  private async executePost(config: AutoPostingConfig): Promise<void> {
    console.log(`📝 Executing post for ${config.businessName}...`);
    
    try {
      // Generate content using OpenAI
      const postContent = await this.generatePostContent(config);
      
      // Post to Google Business Profile
      const result = await this.postToGoogleBusinessProfile(config, postContent);
      
      if (result.success) {
        console.log(`✅ Successfully posted for ${config.businessName}`);
        
        // Update storage with success
        automationStorage.updatePostStatus(config.locationId, true);
        automationStorage.updateGlobalStats(true);
        
        // Calculate next post time (except for test30s mode)
        if (config.schedule.frequency !== 'test30s') {
          automationStorage.updateNextPostTime(config.locationId);
        }
        
        // Show success toast
        toast({
          title: "Post Published! 🎉",
          description: `Successfully posted for ${config.businessName}`,
          duration: 4000,
        });
        
        // Emit event for real-time updates
        window.dispatchEvent(new CustomEvent('autoPostSuccess', { 
          detail: { 
            locationId: config.locationId, 
            businessName: config.businessName,
            content: postContent.content 
          } 
        }));
        
      } else {
        throw new Error(result.error || 'Unknown error occurred');
      }
      
    } catch (error) {
      console.error(`❌ Failed to post for ${config.businessName}:`, error);
      
      // Update storage with failure
      automationStorage.updatePostStatus(config.locationId, false);
      automationStorage.updateGlobalStats(false);
      
      // Calculate next post time anyway (to avoid getting stuck)
      if (config.schedule.frequency !== 'test30s') {
        automationStorage.updateNextPostTime(config.locationId);
      }
      
      // Show error toast
      toast({
        title: "Post Failed ❌",
        description: `Failed to post for ${config.businessName}: ${error instanceof Error ? error.message : 'Unknown error'}`,
        variant: "destructive",
        duration: 6000,
      });
      
      // Emit event for real-time updates
      window.dispatchEvent(new CustomEvent('autoPostError', { 
        detail: { 
          locationId: config.locationId, 
          businessName: config.businessName,
          error: error instanceof Error ? error.message : 'Unknown error'
        } 
      }));
    }
  }

  private async generatePostContent(config: AutoPostingConfig): Promise<{ content: string; callToAction?: any }> {
    const category = config.categories.length > 0 ? config.categories[0] : 'business';
    
    console.log(`🤖 Generating content for ${config.businessName} (${category}) with keywords:`, config.keywords);
    
    try {
      return await openaiService.generatePostContent(
        config.businessName,
        category,
        config.keywords, // Now passing array instead of string
        config.locationName,
        config.websiteUrl
      );
    } catch (error) {
      console.error('🚨 OpenAI content generation failed:', error);
      throw error;
    }
  }

  private async postToGoogleBusinessProfile(config: AutoPostingConfig, postContent: { content: string; callToAction?: any }): Promise<PostResult> {
    try {
      console.log(`📤 Posting to Google Business Profile for ${config.businessName}...`);
      
      // Get access token from the Google Business Profile service
      const accessToken = googleBusinessProfileService.getAccessToken();
      console.log('🔍 DEBUGGING: Access token check:', { 
        hasToken: !!accessToken, 
        tokenLength: accessToken?.length,
        tokenStart: accessToken?.substring(0, 20) + '...' 
      });
      
      if (!accessToken) {
        console.error('❌ DEBUGGING: No access token available!');
        console.error('🔍 DEBUGGING: Google service connection status:', googleBusinessProfileService.isConnected());
        console.error('🔍 DEBUGGING: localStorage tokens:', localStorage.getItem('google_business_tokens'));
        throw new Error('No access token available. Please connect to Google Business Profile first.');
      }
      
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
      console.log('🔍 DEBUGGING: Backend URL being used:', backendUrl);
      console.log('🔍 DEBUGGING: VITE_BACKEND_URL env var:', import.meta.env.VITE_BACKEND_URL);
      
      // Ensure we have a valid URL if call to action is enabled
      const hasCallToAction = postContent.callToAction && (config.button?.enabled !== false);
      const callToActionUrl = postContent.callToAction?.url || 
                             config.button?.customUrl || 
                             config.websiteUrl || 
                             'https://maps.google.com'; // Fallback URL
      
      const postData = {
        languageCode: 'en-US',
        topicType: 'STANDARD',
        summary: postContent.content,
        media: [],
        callToAction: hasCallToAction ? {
          actionType: postContent.callToAction.actionType,
          url: callToActionUrl
        } : undefined
      };
      
      const response = await fetch(`${backendUrl}/api/locations/${config.locationId}/posts`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${accessToken}`,
        },
        body: JSON.stringify(postData),
      });
      
      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ DEBUGGING: Backend API error response:', errorText);
        throw new Error(`Backend API error: ${response.status} - ${errorText}`);
      }
      
      // Check if response is JSON before parsing
      const contentType = response.headers.get('Content-Type');
      console.log('🔍 DEBUGGING: Response content-type:', contentType);
      
      let result;
      try {
        const responseText = await response.text();
        console.log('🔍 DEBUGGING: Raw response text:', responseText.substring(0, 200) + '...');
        
        // Check if the response starts with HTML (common error case)
        if (responseText.trim().startsWith('<!DOCTYPE') || responseText.trim().startsWith('<html')) {
          console.error('❌ DEBUGGING: Backend returned HTML instead of JSON');
          throw new Error(`Backend API error: Server returned HTML error page instead of JSON. This usually indicates a server configuration issue or API endpoint problem.`);
        }
        
        result = JSON.parse(responseText);
      } catch (parseError) {
        console.error('❌ DEBUGGING: JSON parse error:', parseError);
        console.error('❌ DEBUGGING: Response was not valid JSON');
        throw new Error(`Backend API returned invalid JSON: ${parseError.message}`);
      }
      
      if (result && (result.post || result.success)) {
        console.log(`✅ Post created successfully via backend API`);
        console.log('🔍 DEBUGGING: Backend result:', result);
        return { 
          success: true, 
          postContent: postContent.content 
        };
      } else {
        console.error('❌ DEBUGGING: Unexpected backend response format:', result);
        throw new Error('No result returned from backend API');
      }
      
    } catch (error) {
      console.error('🚨 Backend API error:', error);
      return { 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error'
      };
    }
  }

  // Manual post execution (for "Test Now" button)
  async executeManualPost(locationId: string): Promise<PostResult> {
    const config = automationStorage.getConfiguration(locationId);
    if (!config) {
      throw new Error('Configuration not found for location');
    }

    if (!config.enabled) {
      throw new Error('Auto-posting is disabled for this location');
    }

    console.log(`🔧 Manual post execution for ${config.businessName}...`);
    
    try {
      // Generate content
      const postContent = await this.generatePostContent(config);
      
      // Post to Google Business Profile
      const result = await this.postToGoogleBusinessProfile(config, postContent);
      
      if (result.success) {
        // Update storage (but don't update nextPost time for manual posts)
        automationStorage.updatePostStatus(config.locationId, true);
        automationStorage.updateGlobalStats(true);
        
        // Show success toast
        toast({
          title: "Manual Post Published! 🚀",
          description: `Successfully posted for ${config.businessName}`,
          duration: 4000,
        });
      } else {
        // Update storage with failure
        automationStorage.updatePostStatus(config.locationId, false);
        automationStorage.updateGlobalStats(false);
        
        // Show error toast
        toast({
          title: "Manual Post Failed ❌",
          description: `Failed to post: ${result.error}`,
          variant: "destructive",
          duration: 6000,
        });
      }
      
      return result;
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      // Update storage with failure
      automationStorage.updatePostStatus(config.locationId, false);
      automationStorage.updateGlobalStats(false);
      
      // Show error toast
      toast({
        title: "Manual Post Failed ❌",
        description: `Failed to post: ${errorMessage}`,
        variant: "destructive",
        duration: 6000,
      });
      
      return { 
        success: false, 
        error: errorMessage 
      };
    }
  }

  // Check if service is running
  isServiceRunning(): boolean {
    return this.isRunning;
  }

  // Get next check time
  getNextCheckTime(): Date {
    return new Date(Date.now() + this.checkInterval);
  }

  // Event listeners for real-time updates
  onAutoPostSuccess(callback: (event: { locationId: string; businessName: string; content: string }) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    window.addEventListener('autoPostSuccess', handler as EventListener);
    return () => window.removeEventListener('autoPostSuccess', handler as EventListener);
  }

  onAutoPostError(callback: (event: { locationId: string; businessName: string; error: string }) => void): () => void {
    const handler = (event: CustomEvent) => callback(event.detail);
    window.addEventListener('autoPostError', handler as EventListener);
    return () => window.removeEventListener('autoPostError', handler as EventListener);
  }
}

// Export singleton instance
export const automationService = new AutomationService();