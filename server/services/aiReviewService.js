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
    this.cacheTimeout = 30 * 1000; // 30 seconds cache (reduced from 5 minutes)
    
    console.log('[AIReviewService] Initialized with hardcoded Azure OpenAI configuration');
  }

  async generateReviewSuggestions(businessName, location, businessType = 'business', reviewId = null, keywords = null) {
    // NO CACHING - Generate completely fresh reviews every time for maximum uniqueness
    console.log('[AI Review Service] 🎲 Generating completely fresh reviews (NO CACHE) for maximum uniqueness');
    
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
      
      // Parse keywords
      const keywordList = keywords
        ? (typeof keywords === 'string'
            ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
            : keywords)
        : [];

      console.log(`[AI Review Service] 🔑 Keywords to include: ${keywordList.length > 0 ? keywordList.join(', ') : 'none provided'}`);

      // Create highly unique seed with reviewId for completely different content each time
      const timestamp = Date.now();
      const randomPart1 = Math.random().toString(36).substr(2, 12);
      const randomPart2 = Math.random().toString(36).substr(2, 12);
      const randomPart3 = Math.random().toString(36).substr(2, 12); // Extra randomness
      const userAgent = Math.random().toString(16).substr(2, 8);
      const reviewSeed = reviewId ? reviewId.slice(-8) : Math.random().toString(36).substr(2, 8);
      const uniqueSeed = `${timestamp}_${reviewSeed}_${randomPart1}_${randomPart2}_${randomPart3}_${userAgent}`;

      // Add additional randomization factors with reviewId influence
      const toneVariations = ['casual', 'professional', 'enthusiastic', 'detailed', 'concise', 'warm', 'friendly', 'excited', 'grateful', 'impressed'];
      const customerTypes = ['first-time visitor', 'regular customer', 'business client', 'family customer', 'local resident', 'returning client', 'tourist', 'group visitor', 'solo traveler'];
      const timeVariations = ['morning', 'afternoon', 'evening', 'weekend', 'weekday', 'lunch hour', 'late night', 'holiday', 'busy day'];
      const experienceTypes = ['exceptional', 'outstanding', 'memorable', 'pleasant', 'wonderful', 'fantastic', 'amazing', 'great', 'solid', 'good'];

      // Use completely random selection (NOT based on reviewId) for maximum variation
      const randomIndex = Math.floor(Math.random() * 1000000);
      const randomTone = toneVariations[randomIndex % toneVariations.length];
      const randomCustomerType = customerTypes[(randomIndex + timestamp) % customerTypes.length];
      const randomTimeOfDay = timeVariations[(randomIndex + timestamp + 100) % timeVariations.length];
      const randomExperience = experienceTypes[(randomIndex + timestamp + 200) % experienceTypes.length];

      // Enhanced prompt with more variation triggers and keyword integration
      const keywordPrompt = keywordList.length > 0
        ? `\nBUSINESS KEYWORDS (MUST use naturally in reviews): ${keywordList.join(', ')}\n- Each review should naturally include 2-3 of these keywords`
        : '';

      const prompt = `Generate 5 completely different, unique customer reviews for "${businessName}"${locationPhrase ? ` in ${cleanLocation}` : ''}.
${keywordPrompt}

CRITICAL: Every generation MUST produce COMPLETELY DIFFERENT reviews - never repeat the same phrasing or structure.

Style Guidelines:
- Tone: ${randomTone}
- Customer Type: ${randomCustomerType}
- Visit Time: ${randomTimeOfDay}
- Experience Quality: ${randomExperience}
- Uniqueness Seed: ${uniqueSeed}
- Variation Level: MAXIMUM (make each review distinctly different)

Requirements:
1. Each review must be unique in style, length, vocabulary, and focus
2. Naturally include business keywords (${keywordList.length > 0 ? keywordList.join(', ') : 'service, quality'}) throughout reviews
3. Mention business name "${businessName}" in varied ways
4. Mix 4-5 star ratings (mostly positive: three 5-star, two 4-star)
5. Use DIFFERENT vocabulary and sentence structures for each review
6. Focus areas: service, quality, staff, atmosphere, value, experience, cleanliness, professionalism
7. Vary review length significantly (some 20 words, some 50+ words)
8. Include specific details customers would mention
9. Make reviews sound authentic and personal
10. Use keywords naturally, not forced

Return ONLY this JSON array (no markdown, no explanation):
[
  {"review": "[unique review 1 with keywords]", "rating": 5, "focus": "service"},
  {"review": "[completely different review 2 with keywords]", "rating": 4, "focus": "quality"},
  {"review": "[distinct review 3 with keywords]", "rating": 5, "focus": "staff"},
  {"review": "[varied review 4 with keywords]", "rating": 5, "focus": "atmosphere"},
  {"review": "[unique review 5 with keywords]", "rating": 4, "focus": "value"}
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
              content: 'You are a creative review generator. Every single generation must be completely unique and different. Never repeat the same vocabulary, phrasing, or structure. Return ONLY valid JSON arrays with no markdown formatting.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1200, // Increased for more detailed, varied responses
          temperature: 1.0, // MAXIMUM creativity for maximum variation
          top_p: 0.98, // Allow most diverse token selection
          frequency_penalty: 1.0, // MAXIMUM to prevent any repetition
          presence_penalty: 0.9  // MAXIMUM to ensure completely varied content
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
        
        // Add timestamps and ensure uniqueness - NO CACHING
        const timestamp = Date.now();
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        const finalReviews = reviews.map((review, index) => ({
          ...review,
          id: `review_${timestamp}_${randomSuffix}_${index}`,
          businessName,
          location,
          reviewId: reviewId || null,
          generatedAt: new Date().toISOString(),
          keywords: keywordList.length > 0 ? keywordList : [] // Include keywords in response
        }));

        // NO CACHING - Every request generates completely fresh reviews
        console.log(`[AI Review Service] ✅ Generated ${finalReviews.length} completely unique reviews (NO CACHE)`);
        console.log(`[AI Review Service] 🔑 Keywords included: ${keywordList.join(', ')}`);
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

  // Generate AI-powered reply suggestions for existing reviews
  async generateReplySuggestions(businessName, reviewContent, reviewRating, reviewId = null, keywords = null) {
    // NO CACHING - Generate completely fresh replies every time
    console.log('[AI Review Service] 🎲 Generating completely fresh reply suggestions (NO CACHE)');

    // Check if Azure OpenAI is configured
    if (!this.apiKey || !this.azureEndpoint || !this.deploymentName) {
      throw new Error('[AI Review Service] Azure OpenAI is required for reply generation. Please configure Azure OpenAI.');
    }

    try {
      // Parse keywords
      const keywordList = keywords
        ? (typeof keywords === 'string'
            ? keywords.split(',').map(k => k.trim()).filter(k => k.length > 0)
            : keywords)
        : [];

      console.log(`[AI Review Service] 🔑 Keywords to include: ${keywordList.length > 0 ? keywordList.join(', ') : 'none provided'}`);

      // Create unique seed for maximum variation
      const timestamp = Date.now();
      const randomPart1 = Math.random().toString(36).substr(2, 12);
      const randomPart2 = Math.random().toString(36).substr(2, 12);
      const reviewSeed = reviewId ? reviewId.slice(-8) : Math.random().toString(36).substr(2, 8);
      const uniqueSeed = `${timestamp}_${reviewSeed}_${randomPart1}_${randomPart2}_${reviewRating}`;

      // Determine sentiment and tone with more variation
      const sentiment = reviewRating >= 4 ? 'positive' : reviewRating >= 3 ? 'neutral' : 'negative';
      const toneVariations = ['professional', 'warm', 'grateful', 'understanding', 'empathetic', 'friendly', 'sincere', 'genuine'];

      // Use completely random selection for maximum variation
      const randomIndex = Math.floor(Math.random() * 1000000);
      const tone = toneVariations[randomIndex % toneVariations.length];

      console.log(`[AI Review Service] Generating ${sentiment} reply with ${tone} tone`);

      // Enhanced prompt with keyword integration
      const keywordPrompt = keywordList.length > 0
        ? `\nBUSINESS KEYWORDS (naturally incorporate if relevant): ${keywordList.join(', ')}`
        : '';

      const prompt = `Generate 3 completely unique, professional business reply suggestions for a ${reviewRating}-star customer review.
${keywordPrompt}

Business: ${businessName}
Customer Review: "${reviewContent}"
Rating: ${reviewRating}/5 stars
Reply Tone: ${tone}
Sentiment: ${sentiment}
Uniqueness Seed: ${uniqueSeed}

CRITICAL: Every generation MUST produce COMPLETELY DIFFERENT replies - never repeat the same phrasing.

Guidelines:
- Each reply must be unique in style, vocabulary, and approach
- Keep replies professional but ${tone}
- Acknowledge the customer's feedback specifically
- Naturally include business keywords (${keywordList.length > 0 ? keywordList.join(', ') : 'service, quality'}) if appropriate
- Include business name "${businessName}" naturally
- Vary length and structure significantly
- For positive reviews: express gratitude, highlight strengths, invite return
- For neutral reviews: show appreciation, willingness to improve
- For negative reviews: apologize sincerely, offer specific resolution
- Make each reply sound authentic and personalized

Return ONLY this JSON array (no markdown):
[
  {"reply": "[First unique reply with keywords]", "tone": "${tone}", "focus": "gratitude"},
  {"reply": "[Second completely different reply with keywords]", "tone": "${tone}", "focus": "engagement"},
  {"reply": "[Third distinct reply with keywords]", "tone": "${tone}", "focus": "resolution"}
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
              content: 'You are a professional business communication expert. Every reply must be completely unique and different. Never repeat the same vocabulary, phrasing, or structure. Naturally incorporate business keywords when relevant. Return ONLY valid JSON arrays with no markdown.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 1000, // Increased for more varied responses
          temperature: 1.0, // MAXIMUM creativity for maximum variation
          top_p: 0.98, // Allow most diverse token selection
          frequency_penalty: 1.0, // MAXIMUM to prevent any repetition
          presence_penalty: 0.9  // MAXIMUM to ensure completely varied content
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
        let cleanContent = content.trim();
        console.log('Raw AI reply response:', cleanContent.substring(0, 500));

        // Remove markdown code blocks if present
        cleanContent = cleanContent.replace(/^```[a-z]*\n?/gi, '').replace(/\n?```$/gi, '');

        // Extract JSON array
        const start = cleanContent.indexOf('[');
        const end = cleanContent.lastIndexOf(']');

        if (start === -1 || end === -1 || end <= start) {
          throw new Error('Invalid JSON structure - no array found');
        }

        let jsonString = cleanContent.substring(start, end + 1);
        jsonString = jsonString
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']')
          .replace(/\n/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();

        const replies = JSON.parse(jsonString);

        if (!Array.isArray(replies)) {
          throw new Error('AI response is not a valid array');
        }

        // Extract reply text with keywords - NO CACHING
        const randomSuffix = Math.random().toString(36).substr(2, 9);
        const replySuggestions = replies.map((item, index) => ({
          text: item.reply || item.text || item,
          id: `reply_${timestamp}_${randomSuffix}_${index}`,
          tone: item.tone || tone,
          focus: item.focus || 'general',
          keywords: keywordList.length > 0 ? keywordList : [], // Include keywords in response
          generatedAt: new Date().toISOString()
        }));

        // NO CACHING - Every request generates completely fresh replies
        console.log(`[AI Review Service] ✅ Generated ${replySuggestions.length} completely unique reply suggestions (NO CACHE)`);
        console.log(`[AI Review Service] 🔑 Keywords included: ${keywordList.join(', ')}`);
        return replySuggestions;
      } catch (parseError) {
        console.error('Error parsing AI reply response:', parseError);
        console.error('Raw AI content (first 500 chars):', content.substring(0, 500));
        throw new Error('[AI Review Service] Failed to parse AI reply response. Please try again.');
      }
    } catch (error) {
      console.error('Error generating AI reply suggestions:', error);
      throw new Error('[AI Review Service] Failed to generate AI reply suggestions. Please check Azure OpenAI configuration.');
    }
  }
}

export default AIReviewService;
