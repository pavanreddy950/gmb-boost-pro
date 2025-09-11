import fetch from 'node-fetch';

class AIReviewService {
  constructor() {
    // Hardcoded Azure OpenAI configuration - no environment variables needed
    this.azureEndpoint = 'https://agentplus.openai.azure.com/';
    this.apiKey = '1TPW16ifwPJccSiQPSHq63nU7IcT6R9DrduIHBYwCm5jbUWiSbkLJQQJ99BDACYeBjFXJ3w3AAABACOG3Yia';
    this.deploymentName = 'gpt-4o';
    this.apiVersion = '2024-02-15-preview';
    
    // Simple in-memory cache for faster responses
    this.reviewCache = new Map();
    this.cacheTimeout = 5 * 60 * 1000; // 5 minutes cache
    
    console.log('[AIReviewService] Initialized with hardcoded Azure OpenAI configuration');
  }

  async generateReviewSuggestions(businessName, location, businessType = 'business') {
    // Check cache first for instant response
    const cacheKey = `${businessName.toLowerCase()}_${location.toLowerCase()}_${businessType}`;
    const cached = this.reviewCache.get(cacheKey);
    
    if (cached && (Date.now() - cached.timestamp) < this.cacheTimeout) {
      console.log('[AI Review Service] ⚡ Returning cached reviews for faster response');
      return cached.reviews.map(review => ({
        ...review,
        id: `review_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        generatedAt: new Date().toISOString()
      }));
    }
    
    // Enhanced debugging for Azure OpenAI configuration
    console.log('[AI Review Service] Generating new reviews (no cache hit)');
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
      
      // Create highly unique seed for completely different content each time
      const timestamp = Date.now();
      const randomPart1 = Math.random().toString(36).substr(2, 12);
      const randomPart2 = Math.random().toString(36).substr(2, 12);
      const userAgent = Math.random().toString(16).substr(2, 8);
      const uniqueSeed = `${timestamp}_${randomPart1}_${randomPart2}_${userAgent}`;
      
      // Add additional randomization factors
      const toneVariations = ['casual', 'professional', 'enthusiastic', 'detailed', 'concise'];
      const customerTypes = ['first-time visitor', 'regular customer', 'business client', 'family customer', 'local resident'];
      const randomTone = toneVariations[Math.floor(Math.random() * toneVariations.length)];
      const randomCustomerType = customerTypes[Math.floor(Math.random() * customerTypes.length)];
      const randomTimeOfDay = ['morning', 'afternoon', 'evening', 'weekend'][Math.floor(Math.random() * 4)];
      
      // Simplified, faster prompt for quick generation
      const prompt = `Generate 5 different customer reviews for "${businessName}"${locationPhrase ? ` in ${cleanLocation}` : ''}.
      
Style: ${randomTone} tone, ${randomCustomerType}, ${randomTimeOfDay} visit
Seed: ${uniqueSeed}
      
Make each review unique in style and focus. Include business name naturally. Mix 4-5 star ratings. Focus areas: service, quality, staff, atmosphere, value.
      
Return only JSON array:
[
  {"review": "authentic review text", "rating": 5, "focus": "service", "keywords": ["${businessName}", "${cleanLocation}", "service"]},
  {"review": "different review text", "rating": 4, "focus": "quality", "keywords": ["${businessName}", "${cleanLocation}", "quality"]},
  {"review": "unique review text", "rating": 5, "focus": "staff", "keywords": ["${businessName}", "${cleanLocation}", "staff"]},
  {"review": "varied review text", "rating": 5, "focus": "atmosphere", "keywords": ["${businessName}", "${cleanLocation}", "atmosphere"]},
  {"review": "distinct review text", "rating": 4, "focus": "value", "keywords": ["${businessName}", "${cleanLocation}", "value"]}
]`;

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
              content: 'You are a JSON generator. Return ONLY valid JSON arrays. No explanations, no markdown, just JSON.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 800, // Reduced for faster generation
          temperature: 0.8, // Balanced creativity and speed
          top_p: 0.9, // More focused sampling
          frequency_penalty: 0.7, // Moderate to prevent repetition
          presence_penalty: 0.6  // Moderate to ensure varied content
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Azure OpenAI API error:', errorText);
        throw new Error(`Azure API error: ${response.status}`);
      }

      const data = await response.json();
      const content = data.choices[0].message.content;
      
      // Parse the JSON response - robust parsing with multiple fallbacks
      try {
        let cleanContent = content.trim();
        console.log('Raw AI response:', cleanContent.substring(0, 1000));
        
        // Remove markdown code blocks if present
        cleanContent = cleanContent.replace(/^```[a-z]*\n?/gi, '').replace(/\n?```$/gi, '');
        
        // Extract JSON array - find first [ and last ]
        const start = cleanContent.indexOf('[');
        const end = cleanContent.lastIndexOf(']');
        
        if (start === -1 || end === -1 || end <= start) {
          console.error('Could not find JSON array brackets in response');
          throw new Error('Invalid JSON structure - no array found');
        }
        
        // Extract just the JSON array part
        let jsonString = cleanContent.substring(start, end + 1);
        
        // Clean up common JSON issues
        jsonString = jsonString
          .replace(/,\s*}/g, '}')  // Remove trailing commas before }
          .replace(/,\s*]/g, ']')  // Remove trailing commas before ]
          .replace(/\n/g, ' ')     // Replace newlines with spaces
          .replace(/\s+/g, ' ')    // Normalize whitespace
          .trim();
        
        console.log('Cleaned JSON string:', jsonString.substring(0, 500));
        
        // Try to parse the cleaned JSON
        let reviews;
        try {
          reviews = JSON.parse(jsonString);
        } catch (parseError) {
          console.error('JSON parsing failed, trying manual repair:', parseError.message);
          
          // Try to repair common JSON issues
          let repairedJson = jsonString
            .replace(/"([^"]*)"/g, (match, p1) => {
              // Fix quotes inside quoted strings
              return '"' + p1.replace(/"/g, "'") + '"';
            })
            .replace(/([^,\s})\]])\s*"([^"]+)":/g, '$1,"$2":') // Add missing commas
            .replace(/:\s*([^"\[{][^,}\]]*[^,}\]\s])([,}\]])/g, ': "$1"$2'); // Quote unquoted values
          
          try {
            reviews = JSON.parse(repairedJson);
            console.log('Successfully repaired and parsed JSON');
          } catch (repairError) {
            console.error('JSON repair also failed:', repairError.message);
            throw new Error('Could not parse AI response as valid JSON');
          }
        }
        
        // Validate the response
        if (!Array.isArray(reviews)) {
          console.error('Parsed result is not an array:', typeof reviews);
          throw new Error('AI response is not a valid array');
        }
        
        if (reviews.length === 0) {
          console.error('AI returned empty array');
          throw new Error('AI response contains no reviews');
        }
        
        // Ensure we have exactly 5 reviews
        if (reviews.length !== 5) {
          console.log(`AI returned ${reviews.length} reviews instead of 5, adjusting...`);
          
          if (reviews.length > 5) {
            // Take first 5 if we have more
            reviews = reviews.slice(0, 5);
          } else {
            // Duplicate and modify if we have less
            while (reviews.length < 5) {
              const baseReview = reviews[reviews.length % reviews.length];
              const newReview = {
                ...baseReview,
                review: baseReview.review.replace(/\b(great|excellent|amazing|wonderful)\b/gi, (match) => {
                  const alternatives = ['outstanding', 'fantastic', 'superb', 'exceptional', 'remarkable'];
                  return alternatives[Math.floor(Math.random() * alternatives.length)];
                }),
                focus: ['service', 'quality', 'staff', 'atmosphere', 'value'][reviews.length],
                rating: Math.random() > 0.3 ? 5 : 4
              };
              reviews.push(newReview);
            }
          }
        }
        
        // Add timestamps and ensure uniqueness
        const timestamp = Date.now();
        const finalReviews = reviews.map((review, index) => ({
          ...review,
          id: `review_${timestamp}_${index}`,
          businessName,
          location,
          generatedAt: new Date().toISOString()
        }));
        
        // Cache successful results for faster future responses
        this.reviewCache.set(cacheKey, {
          reviews: finalReviews,
          timestamp: Date.now()
        });
        
        console.log(`[AI Review Service] ✅ Cached ${finalReviews.length} reviews for faster future access`);
        return finalReviews;
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
