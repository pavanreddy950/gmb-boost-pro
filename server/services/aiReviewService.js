import fetch from 'node-fetch';

class AIReviewService {
  constructor() {
    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.apiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.deploymentName = process.env.AZURE_OPENAI_DEPLOYMENT || '';
    this.apiVersion = process.env.AZURE_OPENAI_API_VERSION || '';
  }

  async generateReviewSuggestions(businessName, location, businessType = 'business') {
    // Enhanced debugging for Azure OpenAI configuration
    console.log('[AI Review Service] Checking Azure OpenAI configuration...');
    console.log(`[AI Review Service] Endpoint: ${this.azureEndpoint ? 'SET (' + this.azureEndpoint.substring(0, 30) + '...)' : 'NOT SET'}`);
    console.log(`[AI Review Service] API Key: ${this.apiKey ? 'SET (' + this.apiKey.substring(0, 10) + '...)' : 'NOT SET'}`);
    console.log(`[AI Review Service] Deployment: ${this.deploymentName || 'NOT SET'}`);
    console.log(`[AI Review Service] Version: ${this.apiVersion || 'NOT SET'}`);
    
    // Check if Azure OpenAI is configured
    if (!this.apiKey || !this.azureEndpoint || !this.deploymentName) {
      const missingVars = [];
      if (!this.azureEndpoint) missingVars.push('AZURE_OPENAI_ENDPOINT');
      if (!this.apiKey) missingVars.push('AZURE_OPENAI_API_KEY');
      if (!this.deploymentName) missingVars.push('AZURE_OPENAI_DEPLOYMENT');
      if (!this.apiVersion) missingVars.push('AZURE_OPENAI_API_VERSION');
      
      throw new Error(`[AI Review Service] Missing Azure OpenAI environment variables: ${missingVars.join(', ')}. Please configure these in your Azure App Service settings.`);
    }
    
    try {
      // Clean up location - remove generic terms and use properly
      let cleanLocation = location;
      if (location && location.toLowerCase() === 'location' || location.toLowerCase() === 'your location') {
        cleanLocation = ''; // Don't use generic location in reviews
      }
      
      // Create location phrase for the prompt
      const locationPhrase = cleanLocation ? `in ${cleanLocation}` : '';
      
      console.log(`[AI Review Service] Generating AI suggestions for ${businessName} ${locationPhrase}`);
      
      const prompt = `Generate 5 unique, authentic customer review suggestions for "${businessName}"${locationPhrase ? ` located in "${cleanLocation}"` : ''}. 
      
      Requirements:
      - Each review MUST be completely different and unique
      - Include specific SEO keywords: "${businessName}"${cleanLocation ? ` and "${cleanLocation}"` : ''} naturally
      - Vary the tone: some enthusiastic, some moderate, some professional
      - Vary the length: medium (5-6 sentences minimum), long (7-9 sentences), very detailed (10-12 sentences)
      - MINIMUM 5 sentences per review, aim for 80-120 words per review
      - Include different aspects: service quality, staff interactions, atmosphere, value for money, specific experiences
      - Make them sound genuine and human-written with personal touches
      - Use different writing styles and vocabulary for each
      - Include specific details, anecdotes, or scenarios that feel authentic
      - Mention specific positive experiences or interactions
      - Ratings should vary between 4-5 stars
      - DO NOT use template phrases or repeat patterns
      
      Format as JSON array with objects containing:
      - review: the review text
      - rating: 4 or 5
      - focus: main aspect (service/quality/experience/value/staff)
      - length: short/medium/long
      
      Example variety needed:
      1. Enthusiastic first-timer mentioning specific service
      2. Regular customer praising consistency
      3. Professional noting business efficiency
      4. Family perspective on atmosphere
      5. Value-focused practical review`;

      const url = `${this.azureEndpoint}openai/deployments/${this.deploymentName}/chat/completions?api-version=${this.apiVersion}`;
      
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'api-key': this.apiKey
        },
        body: JSON.stringify({
          messages: [
            {
              role: 'system',
              content: 'You are an expert at generating diverse, authentic-sounding customer reviews with strong SEO optimization. Each review must be completely unique with no repeated phrases or patterns. Create detailed, engaging reviews with minimum 80 words each, including specific experiences and personal touches that make them feel genuine.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 3000, // Increased for longer, detailed reviews
          temperature: 0.9, // High temperature for more variety
          top_p: 0.95,
          frequency_penalty: 1.2, // Penalize repetition
          presence_penalty: 1.0  // Encourage new topics
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure OpenAI API error:', errorText);
        throw new Error(`Azure API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the JSON response
      try {
        const reviews = JSON.parse(content);
        
        // Add timestamps and ensure uniqueness
        const timestamp = Date.now();
        return reviews.map((review, index) => ({
          ...review,
          id: `review_${timestamp}_${index}`,
          businessName,
          location,
          generatedAt: new Date().toISOString()
        }));
      } catch (parseError) {
        console.error('Error parsing AI response:', parseError);
        // AI generation failed
        throw new Error('[AI Review Service] Failed to parse AI response. Please try again.');
      }
    } catch (error) {
      console.error('Error generating AI reviews:', error);
      throw new Error('[AI Review Service] Failed to generate AI reviews. Please check Azure OpenAI configuration.');
    }
  }

  // No fallback reviews - AI generation required
  getDynamicFallbackReviews(businessName, location) {
    throw new Error('[AI Review Service] Azure OpenAI is required for review generation. Please configure Azure OpenAI.');
  }
  
  
  

  // No fallback reviews
  getFallbackReviews(businessName, location) {
    throw new Error('[AI Review Service] Azure OpenAI is required for review generation. Please configure Azure OpenAI.');
  }

  // Generate a review link for Google Business Profile
  generateReviewLink(placeId) {
    // Google review link format
    return `https://search.google.com/local/writereview?placeid=${placeId}`;
  }

  // Get Google Maps search link for the business
  generateMapsSearchLink(businessName, location) {
    const query = encodeURIComponent(`${businessName} ${location}`);
    return `https://www.google.com/maps/search/?api=1&query=${query}`;
  }
}

export default AIReviewService;