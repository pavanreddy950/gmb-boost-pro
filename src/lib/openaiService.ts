interface OpenAIResponse {
  choices: Array<{
    message: {
      content: string;
    };
  }>;
}

interface PostContent {
  content: string;
  callToAction?: {
    actionType: 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP';
    url?: string;
  };
}

export class OpenAIService {
  private subscriptionKey: string;
  private endpoint: string;
  private deployment: string;
  private apiVersion: string;
  private lastRequestTime = 0;
  private minRequestInterval = 1000; // 1 second between requests

  constructor() {
    // Hardcoded Azure OpenAI configuration - no environment variables needed
    this.subscriptionKey = 'FSQ0UWJgdAmR3qECBH33SLQsRJy1RUJyy9sul3RUDIwnzP7mmdxlJQQJ99BHACYeBjFXJ3w3AAAAACOGf58T';
    this.endpoint = 'https://n8nservices.cognitiveservices.azure.com/';
    this.deployment = 'gpt-4.1';
    this.apiVersion = '2025-01-01-preview';
    
    console.log('✅ Azure OpenAI configuration hardcoded successfully');
    console.log('🔑 Endpoint:', this.endpoint);
    console.log('🚀 Deployment:', this.deployment);
    console.log('📅 API Version:', this.apiVersion);
    console.log('🔑 Subscription key preview:', this.subscriptionKey.substring(0, 8) + '...');
    
    // Test the API configuration validity
    this.testApiKey().catch(error => {
      console.warn('⚠️ Azure OpenAI API test failed:', error.message);
    });
  }

  // Test Azure OpenAI API configuration validity
  private async testApiKey(): Promise<boolean> {
    if (!this.subscriptionKey || !this.endpoint || !this.deployment || !this.apiVersion) return false;
    
    try {
      console.log('🧪 Testing Azure OpenAI API configuration...');
      
      // Test with a simple completion request
      const testUrl = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
      
      const response = await fetch(testUrl, {
        method: 'POST',
        headers: {
          'api-key': this.subscriptionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 1,
          temperature: 0
        }),
      });

      if (response.ok || response.status === 400) { // 400 is OK for this test (means API is accessible)
        console.log('✅ Azure OpenAI API configuration is valid and working!');
        return true;
      } else {
        const errorData = await response.json().catch(() => ({}));
        console.error('❌ Azure OpenAI API test failed:', response.status, errorData);
        
        if (response.status === 401) {
          console.error('🔑 CRITICAL: Your Azure OpenAI API key is invalid or expired!');
          console.error('📋 Possible issues:');
          console.error('   • Subscription key is incorrect or has typos');
          console.error('   • Key has been revoked or expired');
          console.error('   • Endpoint URL is incorrect');
          console.error('   • Deployment name is incorrect');
          console.error('   • API version is not supported');
          console.error('🔗 Check your Azure OpenAI resource in the Azure portal');
        }
        
        return false;
      }
    } catch (error) {
      console.error('🚨 Error testing Azure OpenAI API:', error);
      return false;
    }
  }

  private async rateLimitedRequest(url: string, options: any): Promise<any> {
    const now = Date.now();
    const timeSinceLastRequest = now - this.lastRequestTime;
    
    if (timeSinceLastRequest < this.minRequestInterval) {
      const waitTime = this.minRequestInterval - timeSinceLastRequest;
      console.log(`⏳ Rate limiting: waiting ${waitTime}ms before next request`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this.lastRequestTime = Date.now();
    
    try {
      const response = await fetch(url, options);
      
      if (response.status === 429) {
        console.log('⚠️ Rate limited by OpenAI, implementing exponential backoff...');
        const retryAfter = response.headers.get('retry-after');
        const backoffTime = retryAfter ? parseInt(retryAfter) * 1000 : 5000;
        
        console.log(`⏳ Waiting ${backoffTime}ms before retry...`);
        await new Promise(resolve => setTimeout(resolve, backoffTime));
        
        // Retry the request (inherit signal from original options)
        this.lastRequestTime = Date.now();
        return fetch(url, options);
      }
      
      return response;
    } catch (error) {
      if (error.name === 'AbortError') {
        console.warn('⏰ OpenAI API request timed out');
        throw new Error('OpenAI API request timed out. Please try again.');
      }
      console.error('🚨 OpenAI API request failed:', error);
      throw error;
    }
  }

  // Smart button selection based on business category
  private getSmartButtonForCategory(category: string, businessName: string, websiteUrl?: string): { actionType: 'LEARN_MORE' | 'BOOK' | 'ORDER' | 'SHOP' | 'SIGN_UP'; url: string } {
    const lowerCategory = category.toLowerCase();
    
    // Default URL if no website provided
    const defaultUrl = websiteUrl || `https://www.google.com/search?q=${encodeURIComponent(businessName)}`;
    
    // Restaurant/Food - Order button
    if (lowerCategory.includes('restaurant') || lowerCategory.includes('food') || 
        lowerCategory.includes('cafe') || lowerCategory.includes('dining') ||
        lowerCategory.includes('pizza') || lowerCategory.includes('delivery')) {
      return { actionType: 'ORDER', url: defaultUrl };
    }
    
    // Services that can be booked - Book button  
    if (lowerCategory.includes('salon') || lowerCategory.includes('spa') || 
        lowerCategory.includes('beauty') || lowerCategory.includes('health') ||
        lowerCategory.includes('dental') || lowerCategory.includes('medical') ||
        lowerCategory.includes('appointment') || lowerCategory.includes('consultation') ||
        lowerCategory.includes('fitness') || lowerCategory.includes('gym')) {
      return { actionType: 'BOOK', url: defaultUrl };
    }
    
    // Retail/Shopping - Shop button
    if (lowerCategory.includes('retail') || lowerCategory.includes('store') || 
        lowerCategory.includes('shop') || lowerCategory.includes('clothing') ||
        lowerCategory.includes('fashion') || lowerCategory.includes('jewelry') ||
        lowerCategory.includes('electronics') || lowerCategory.includes('furniture')) {
      return { actionType: 'SHOP', url: defaultUrl };
    }
    
    // Education/Training - Sign Up button
    if (lowerCategory.includes('education') || lowerCategory.includes('training') || 
        lowerCategory.includes('school') || lowerCategory.includes('academy') ||
        lowerCategory.includes('course') || lowerCategory.includes('class') ||
        lowerCategory.includes('learning') || lowerCategory.includes('tuition')) {
      return { actionType: 'SIGN_UP', url: defaultUrl };
    }
    
    // Default - Learn More
    return { actionType: 'LEARN_MORE', url: defaultUrl };
  }

  // No fallback - AI only
  private getFallbackContent(businessName: string, category: string, keywords: string | string[], locationName?: string, websiteUrl?: string): PostContent {
    // NO TEMPLATES - AI GENERATION REQUIRED
    throw new Error('AI content generation is required. Please configure Azure OpenAI in your environment settings.');
  }

  // Validate and enforce word count limit
  private enforceWordLimit(content: string, maxWords: number = 120): string {
    const words = content.trim().split(/\s+/);
    if (words.length <= maxWords) {
      return content;
    }
    
    console.warn(`⚠️ Content exceeds ${maxWords} words (${words.length} words), truncating...`);
    const truncated = words.slice(0, maxWords).join(' ');
    
    // Try to end on a complete sentence if possible
    const lastSentenceEnd = truncated.lastIndexOf('.');
    const lastExclamation = truncated.lastIndexOf('!');
    const lastQuestion = truncated.lastIndexOf('?');
    
    const lastPunctuation = Math.max(lastSentenceEnd, lastExclamation, lastQuestion);
    
    // If we have a sentence ending within the last 10 characters, use that
    if (lastPunctuation > truncated.length - 10) {
      return truncated.substring(0, lastPunctuation + 1);
    }
    
    // Otherwise, add ellipsis or appropriate ending
    return truncated + (truncated.endsWith('.') || truncated.endsWith('!') || truncated.endsWith('?') ? '' : '...');
  }


  async generatePostContent(
    businessName: string,
    category: string,
    keywords: string | string[],
    locationName?: string,
    websiteUrl?: string
  ): Promise<PostContent> {
    // Validate inputs
    if (!businessName || businessName.trim() === '') {
      throw new Error('Business information is required to generate content.');
    }

    if (!this.subscriptionKey || !this.endpoint || !this.deployment || !this.apiVersion) {
      throw new Error('Azure OpenAI not configured. Please configure Azure OpenAI in your environment settings to generate content.');
    }

    // Convert keywords to array format if string is provided
    const keywordArray = typeof keywords === 'string' 
      ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
      : keywords;

    // Format keywords for better AI understanding
    const keywordText = keywordArray.length > 0 
      ? keywordArray.join(', ')
      : 'quality service, customer satisfaction';

    // Create diverse prompts for variety
    const currentTime = new Date().getHours();
    const dayOfWeek = new Date().getDay();
    const randomSeed = Date.now() % 10;
    
    const promptVariations = [
      // Location-first approach
      `Write a post for a ${category} business. Name: ${businessName}. Location: ${locationName || 'local area'}. Focus on: ${keywordText}. Write exactly 100-120 words. Mention the name once. Talk about actual ${category} services/features. End with one clear action.`,
      
      // Service-specific approach
      `Create a post about what ${businessName} offers as a ${category}${locationName ? ` in ${locationName}` : ''}. Focus areas: ${keywordText}. Write 100-120 words. For hotels: mention rooms, amenities. For restaurants: food, atmosphere. For services: expertise, results. One name mention only.`,
      
      // Benefits approach
      `Write about why customers choose this ${category}. Business: ${businessName}${locationName ? ` in ${locationName}` : ''}. Highlight: ${keywordText}. Exactly 100-120 words. Focus on real benefits specific to ${category}. Single name mention. Natural tone.`,
      
      // Experience approach
      `Describe the ${category} experience at ${businessName}${locationName ? `, ${locationName}` : ''}. Keywords: ${keywordText}. Write 100-120 words focusing on what customers actually experience. One business name mention. Conversational style.`,
      
      // Value approach
      `Explain what makes this ${category} special. Name: ${businessName}${locationName ? `, located in ${locationName}` : ''}. Strengths: ${keywordText}. Write exactly 100-120 words about actual ${category} value. Mention name once only. End with action.`,
      
    ];
    
    // Select prompt based on time and randomness for variety
    const promptIndex = (currentTime + dayOfWeek + randomSeed) % promptVariations.length;
    const prompt = promptVariations[promptIndex];
    
    console.log(`🎯 Using prompt variation #${promptIndex + 1} for variety`);

    console.log('🤖 Generating content with Azure OpenAI...');
    console.log('📝 Prompt:', prompt.substring(0, 100) + '...');

    try {
      // Add timeout to prevent hanging requests
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000); // 30 second timeout

      const azureUrl = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
      
      const response = await this.rateLimitedRequest(azureUrl, {
        method: 'POST',
        headers: {
          'api-key': this.subscriptionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: `You write natural Google Business Profile posts. RULES: 1) Write 100-120 words exactly. 2) Mention business name ONLY ONCE. 3) Focus on what the business actually offers - for hotels: rooms, amenities, stays; for restaurants: food, dining; for services: solutions, expertise. 4) Never repeat the business name or use it as an adjective. 5) Write conversationally, not like an ad. 6) Be specific to the business type.`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 150, // Increased for 100-120 word content
          temperature: 0.9, // Higher temperature for more creative variety
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🚨 OpenAI API Error:', response.status, errorData);
        
        // Handle specific error cases
        if (response.status === 401) {
          console.error('🔑 API Key Issue - Your Azure OpenAI subscription key is invalid or expired');
          console.error('💡 Solutions:');
          console.error('   1. Check your subscription key in the Azure portal');
          console.error('   2. Verify the endpoint URL is correct');
          console.error('   3. Ensure the deployment name matches your Azure OpenAI deployment');
          console.error('   4. Check the API version is supported');
          throw new Error(`Azure OpenAI API key is invalid or expired. Please check your Azure OpenAI configuration.`);
        } else if (response.status === 429) {
          console.error('🚫 Rate limit exceeded - too many requests');
          throw new Error(`Azure OpenAI rate limit exceeded. Please try again later.`);
        } else if (response.status === 403) {
          console.error('🚫 Access denied - insufficient permissions');
          throw new Error(`Azure OpenAI access denied. Check your subscription and permissions.`);
        }
        
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data: OpenAIResponse = await response.json();
      const content = data.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('No content generated by Azure OpenAI');
      }

      console.log('✅ Content generated successfully with Azure OpenAI');
      console.log('📝 Generated content:', content.substring(0, 100) + '...');

      // Enforce word limit on AI-generated content
      const limitedContent = this.enforceWordLimit(content);
      
      // Log word count for debugging
      const wordCount = limitedContent.trim().split(/\s+/).length;
      console.log(`📊 Final content word count: ${wordCount}/120 words (min: 100)`);

      // Return with smart button selection based on category
      return {
        content: limitedContent,
        callToAction: this.getSmartButtonForCategory(category, businessName, websiteUrl)
      };

    } catch (error) {
      console.error('Failed to generate content with Azure OpenAI:', error);
      throw new Error('Failed to generate AI content. Please check your Azure OpenAI configuration and try again.');
    }
  }

  // Public method to test API key validity
  public async validateApiKey(): Promise<boolean> {
    return await this.testApiKey();
  }

  // Get Azure OpenAI configuration status
  public getApiKeyStatus(): { configured: boolean; format: string; preview: string } {
    const isConfigured = !!(this.subscriptionKey && this.endpoint && this.deployment && this.apiVersion);
    return {
      configured: isConfigured,
      format: isConfigured ? 'Azure OpenAI' : 'None',
      preview: isConfigured ? 
        `Endpoint: ${this.endpoint}, Deployment: ${this.deployment}` : 
        'Not configured'
    };
  }

  // Generic AI response generator for any purpose
  async generateAIResponse(prompt: string, model?: string): Promise<string> {
    if (!this.subscriptionKey || !this.endpoint || !this.deployment || !this.apiVersion) {
      throw new Error('Azure OpenAI not configured. Please check your configuration.');
    }

    console.log('🤖 Generating AI response with Azure OpenAI...');

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 60000); // 60 second timeout

      const azureUrl = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
      
      const response = await this.rateLimitedRequest(azureUrl, {
        method: 'POST',
        headers: {
          'api-key': this.subscriptionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
          temperature: 0.7,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('🚨 OpenAI API Error:', response.status, errorData);
        throw new Error(`Azure OpenAI API error: ${response.status}`);
      }

      const data: OpenAIResponse = await response.json();
      const content = data.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('No response generated by Azure OpenAI');
      }

      console.log('✅ AI response generated successfully');
      return content;

    } catch (error) {
      console.error('Failed to generate AI response:', error);
      throw new Error('Failed to generate AI insights. Please try again.');
    }
  }

  // No fallback review responses - AI only
  private getFallbackReviewResponse(businessName: string, reviewRating: number): string {
    throw new Error('Azure OpenAI is required to generate review responses. Please configure Azure OpenAI in your environment settings.');
  }

  async generateReviewResponse(
    businessName: string,
    reviewText: string,
    reviewRating: number
  ): Promise<string> {
    if (!this.subscriptionKey || !this.endpoint || !this.deployment || !this.apiVersion) {
      throw new Error('Azure OpenAI is required to generate review responses. Please configure Azure OpenAI in your environment settings.');
    }

    const tone = reviewRating >= 4 ? 'grateful and professional' : 'understanding and solution-focused';
    const prompt = `Generate a professional response to this Google Business review for "${businessName}":

Review (${reviewRating}/5 stars): "${reviewText}"

Requirements:
- Keep response under 120 words maximum
- Be ${tone}
- ${reviewRating >= 4 ? 'Thank them for their positive feedback' : 'Acknowledge their concerns and offer to resolve issues'}
- Include the business name naturally
- Be authentic and personalized
- ${reviewRating < 4 ? 'Offer to discuss offline if appropriate' : 'Invite them to return'}

Generate ONLY the response text, no additional formatting.`;

    try {
      const azureUrl = `${this.endpoint}/openai/deployments/${this.deployment}/chat/completions?api-version=${this.apiVersion}`;
      
      const response = await this.rateLimitedRequest(azureUrl, {
        method: 'POST',
        headers: {
          'api-key': this.subscriptionKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are a professional customer service representative responding to Google Business reviews. Be authentic, helpful, and appropriately emotional. Keep responses under 120 words.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 120,
          temperature: 0.6,
        }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(`Azure OpenAI API error: ${response.status} - ${errorData.error?.message || 'Unknown error'}`);
      }

      const data: OpenAIResponse = await response.json();
      const content = data.choices[0]?.message?.content?.trim();

      if (!content) {
        throw new Error('No response generated by Azure OpenAI');
      }

      return content;

    } catch (error) {
      console.error('Failed to generate review response with Azure OpenAI:', error);
      throw new Error('Failed to generate AI review response. Please check your Azure OpenAI configuration and try again.');
    }
  }
}

// Export singleton instance
export const openaiService = new OpenAIService();

// Export convenience function for generating AI responses
export const generateAIResponse = (prompt: string, model?: string): Promise<string> => {
  return openaiService.generateAIResponse(prompt, model);
};

// Make it available globally for debugging
if (typeof window !== 'undefined') {
  (window as any).openaiService = openaiService;
  (window as any).testAzureOpenAI = async () => {
    console.log('🧪 Manual Azure OpenAI API Test');
    const status = openaiService.getApiKeyStatus();
    console.log('📊 API Configuration Status:', status);
    
    if (status.configured) {
      console.log('🔍 Testing API configuration validity...');
      const isValid = await openaiService.validateApiKey();
      console.log(isValid ? '✅ Azure OpenAI is working!' : '❌ Azure OpenAI failed test');
      
      if (isValid) {
        console.log('🎯 Testing content generation...');
        try {
          const content = await openaiService.generatePostContent(
            'Test Business',
            'service',
            ['quality', 'professional', 'reliable'],
            'Test Location'
          );
          console.log('✅ Content generated successfully:', content.content.substring(0, 100) + '...');
        } catch (error) {
          console.error('❌ Content generation failed:', error.message);
        }
      }
    } else {
      console.warn('⚠️ Azure OpenAI not configured');
    }
  };
  
  console.log('🛠️ Azure OpenAI Debug Tools Available:');
  console.log('   window.openaiService - Access the service directly');
  console.log('   window.testAzureOpenAI() - Run comprehensive API test');
}