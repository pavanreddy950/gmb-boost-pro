import fetch from 'node-fetch';

class AIReviewService {
  constructor() {
    // Hardcoded Azure OpenAI configuration - no environment variables needed
    this.azureEndpoint = 'https://agentplus.openai.azure.com/';
    this.apiKey = '1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia';
    this.deploymentName = 'gpt-4o';
    this.apiVersion = '2024-02-15-preview';
    
    console.log('[AIReviewService] Initialized with hardcoded Azure OpenAI configuration');
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
      
      const prompt = `Generate 5 detailed, authentic customer reviews for "${businessName}"${locationPhrase ? ` in "${cleanLocation}"` : ''}. 
      
      Each review should be 60-100 words, detailed and personal like real customer experiences.
      Include specific details about:
      - Service quality and staff interactions
      - Specific experiences or moments
      - Recommendations and personal touches
      - Why you'd recommend to others
      
      Use these focuses: service, quality, atmosphere, value, staff
      Ratings: 4 or 5 stars
      
      Return valid JSON only:
      [{"review": "detailed review text here", "rating": 5, "focus": "service"}]`;

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
              content: 'Generate authentic customer reviews. Return only valid JSON array format. Keep reviews short and unique.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1500, // Increased for detailed reviews
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
      
      // Parse the JSON response - handle markdown code blocks and other formats
      try {
        // Clean up the content - remove markdown code blocks and other formatting
        let cleanContent = content.trim();
        
        // Remove markdown code blocks
        if (cleanContent.startsWith('```json')) {
          cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (cleanContent.startsWith('```')) {
          cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }
        
        // Remove any text before the JSON array starts
        const jsonStart = cleanContent.indexOf('[');
        let jsonEnd = cleanContent.lastIndexOf(']') + 1;
        
        // Handle truncated JSON responses comprehensively
        if (jsonStart >= 0) {
          if (jsonEnd <= jsonStart || jsonEnd === 0) {
            // No closing bracket found - response was truncated
            cleanContent = cleanContent.substring(jsonStart);
          } else {
            cleanContent = cleanContent.substring(jsonStart, jsonEnd);
          }
          
          // Comprehensive truncation recovery
          if (!cleanContent.endsWith(']')) {
            // Find the last complete object
            const lastCompleteObject = cleanContent.lastIndexOf('}');
            
            if (lastCompleteObject > 0) {
              // Truncate to last complete object and close array
              cleanContent = cleanContent.substring(0, lastCompleteObject + 1);
              
              // Remove any trailing incomplete content after the last }
              const afterLastBrace = cleanContent.substring(lastCompleteObject + 1);
              if (afterLastBrace.trim().startsWith(',')) {
                // Remove trailing comma if present
                cleanContent = cleanContent.substring(0, lastCompleteObject + 1);
              }
              
              // Ensure array is properly closed
              if (!cleanContent.endsWith(']')) {
                cleanContent += ']';
              }
            } else {
              // No complete objects found, return empty array
              cleanContent = '[]';
            }
          }
        }
        
        // Clean up common JSON issues
        cleanContent = cleanContent
          .replace(/,\s*]/g, ']')  // Remove trailing commas in arrays
          .replace(/,\s*}/g, '}')  // Remove trailing commas in objects
          .replace(/'/g, '"')      // Replace single quotes with double quotes
          .trim();
        
        const reviews = JSON.parse(cleanContent);
        
        // Validate the response
        if (!Array.isArray(reviews) || reviews.length === 0) {
          throw new Error('AI response is not a valid array of reviews');
        }
        
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
        console.error('Raw AI content (first 500 chars):', content.substring(0, 500));
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