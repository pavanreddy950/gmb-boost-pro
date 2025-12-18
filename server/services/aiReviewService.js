import fetch from 'node-fetch';
import { getCategoryMapping, generateCategoryPrompt } from '../config/categoryReviewMapping.js';

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

  async generateReviewSuggestions(businessName, location, businessType = 'business', reviewId = null, keywords = null, businessCategory = null) {
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

      console.log(`\n========================================`);
      console.log(`[AI Review Service] 🔍 KEYWORD ANALYSIS`);
      console.log(`========================================`);
      console.log(`[AI Review Service] 📥 Raw keywords received: "${keywords}"`);
      console.log(`[AI Review Service] 📊 Keywords type: ${typeof keywords}`);
      console.log(`[AI Review Service] 🔢 Keywords array length: ${keywordList.length}`);
      console.log(`[AI Review Service] 🔑 Parsed keywords: ${keywordList.length > 0 ? keywordList.join(', ') : '⚠️ NONE - WILL USE FALLBACK!'}`);
      console.log(`[AI Review Service] 📋 Business Category: ${businessCategory || 'not specified'}`);

      if (keywordList.length === 0) {
        console.log(`\n⚠️⚠️⚠️ WARNING: NO KEYWORDS PROVIDED! ⚠️⚠️⚠️`);
        console.log(`⚠️ Reviews will use generic fallback keywords: "service, quality"`);
        console.log(`⚠️ This is why reviews are generic and not keyword-specific!`);
        console.log(`========================================\n`);
      } else {
        console.log(`========================================\n`);
      }

      // Get category-specific prompt additions
      const categoryPrompt = businessCategory ? generateCategoryPrompt(businessCategory) : '';
      const categoryMapping = getCategoryMapping(businessCategory);

      console.log(`[AI Review Service] 🎯 Using category-specific guidelines for: ${businessCategory || 'default'}`);
      console.log(`[AI Review Service] 🎯 Focus areas: ${categoryMapping.focusAreas.join(', ')}`);

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

      // Enhanced prompt with MANDATORY keyword integration
      // ⚠️ CRITICAL: If no keywords provided, reviews should be generic WITHOUT specific services
      const keywordPrompt = keywordList.length > 0
        ? `\n🔑 MANDATORY KEYWORDS - MUST USE IN EVERY REVIEW:\n${keywordList.map((kw, i) => `${i + 1}. "${kw}"`).join('\n')}\n\n⚠️ Each review MUST include at least 2-3 of these exact keywords/phrases!`
        : '\n⚠️ NO KEYWORDS PROVIDED - DO NOT mention ANY specific services or features!\nWrite generic positive reviews about the overall experience WITHOUT mentioning any specific services.';

      const prompt = `⚠️ GENERATE EXACTLY 3 REVIEWS - NO MORE, NO LESS ⚠️

Generate realistic customer reviews for "${businessName}" in ${cleanLocation}.
${keywordPrompt}
${categoryPrompt}

🔴 CRITICAL MANDATORY RULES - FAILURE TO FOLLOW = REJECTED:

1. ✅ MUST GENERATE EXACTLY 3 REVIEWS (NOT 4, NOT 5, EXACTLY 3!)
2. ✅ MUST include EXACT business name "${businessName}" in EVERY SINGLE review
3. ✅ MUST include location "${cleanLocation}" in EVERY SINGLE review
4. ${keywordList.length > 0 ? '✅ Each review MUST include 2-3 keywords from the list above - USE THEM NATURALLY' : '❌ NO KEYWORDS - DO NOT mention ANY specific services or features'}
5. ✅ Each review MUST be 40-50 WORDS (MINIMUM 40 words, MAXIMUM 50 words)
6. ${keywordList.length > 0 ? '✅ ONLY mention services/features from the keywords - DO NOT invent anything' : '✅ DO NOT mention ANY specific services - only generic positive experience'}
7. ✅ Write like REAL people - casual, natural, specific
8. ✅ Vary the ${keywordList.length > 0 ? 'keywords' : 'phrases'} used in each review for diversity

🎯 REQUIRED FORMAT FOR EACH REVIEW:
- Include business name: "${businessName}"
- Include location: "${cleanLocation}"
- ${keywordList.length > 0 ? `Include 2-3 keywords from: ${keywordList.map(k => `"${k}"`).join(', ')}` : 'DO NOT mention specific services - only overall experience'}
- 40-50 words total (MINIMUM 40, MAXIMUM 50)
- Natural, authentic tone

📝 EXAMPLES (FOLLOW THIS STRUCTURE):

${keywordList.length > 0 ? `Example 1:
"${businessName} in ${cleanLocation} offers ${keywordList[0]}! The ${keywordList[1]} was outstanding, and the ${keywordList[2]} exceeded our expectations. Highly memorable visit!"

Example 2:
"Had an amazing time at ${businessName} in ${cleanLocation}. The ${keywordList[0]} was exceptional with ${keywordList[1]}. Great value for money. Will return!"

Example 3:
"${businessName} is the best choice in ${cleanLocation}! The ${keywordList[0]} were top-notch and the ${keywordList[1]} made it special. Unforgettable experience!"` : `Example 1:
"${businessName} in ${cleanLocation} was absolutely wonderful! Had such a great time and the overall experience exceeded all expectations. Highly recommend visiting!"

Example 2:
"Amazing experience at ${businessName} in ${cleanLocation}. Everything was perfect and we had a fantastic time. Will definitely be returning soon!"

Example 3:
"${businessName} in ${cleanLocation} is the best! Had an incredible visit and everything was just perfect. Can't wait to come back!"`}

🚫 ABSOLUTELY FORBIDDEN:
- Generic phrases like "great service" or "excellent quality" (unless they're in the keywords)
- Inventing services not mentioned in keywords
- Skipping keywords - MUST use them!
- More than 40 words per review

✅ RETURN EXACTLY 3 REVIEWS IN THIS JSON FORMAT:
[
  {"review": "Your review text with ${businessName}, ${cleanLocation}, and 2-3 keywords integrated naturally", "rating": 5, "focus": "experience"},
  {"review": "Your review text with ${businessName}, ${cleanLocation}, and 2-3 keywords integrated naturally", "rating": 4, "focus": "service"},
  {"review": "Your review text with ${businessName}, ${cleanLocation}, and 2-3 keywords integrated naturally", "rating": 5, "focus": "quality"}
]`;

      console.log(`\n📤 SENDING TO AI - PROMPT PREVIEW:`);
      console.log(`Business: "${businessName}"`);
      console.log(`Location: "${cleanLocation}"`);
      console.log(`Keywords in prompt: ${keywordList.length > 0 ? keywordList.join(', ') : '⚠️ NONE - USING FALLBACK'}`);
      console.log(`Prompt length: ${prompt.length} characters\n`);

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
              content: `🤖 ULTRA-STRICT INSTRUCTIONS - MANDATORY COMPLIANCE:

You are a review generator that MUST follow these rules EXACTLY:

1. Generate EXACTLY 3 reviews - NO MORE, NO LESS
2. ALWAYS include the EXACT business name in EVERY review
3. ALWAYS include the location in EVERY review
4. ${keywordList.length > 0 ? 'MANDATORY: Each review MUST include 2-3 keywords from the provided keyword list' : 'NO KEYWORDS PROVIDED: DO NOT mention ANY specific services or features'}
5. ${keywordList.length > 0 ? 'ONLY mention services/features from the keywords - NEVER invent services' : 'Write generic positive reviews WITHOUT mentioning specific services'}
6. Maximum 40 words per review - BE CONCISE
7. Write like REAL customers - casual, natural, authentic
8. ${keywordList.length > 0 ? 'NO generic words unless they are in the keywords (no "great service", "excellent quality" unless specified)' : 'Keep reviews generic and positive WITHOUT specific service mentions'}
9. Return ONLY valid JSON array - no markdown, no code blocks, no extra text

${keywordList.length > 0 ? `\n🔑 KEYWORDS YOU MUST USE:\n${keywordList.map((kw, i) => `${i + 1}. "${kw}"`).join('\n')}\n\nEach review MUST naturally include 2-3 of these keywords!` : '\n⚠️ NO KEYWORDS PROVIDED:\n- DO NOT mention "service", "quality", "professional", or ANY specific services\n- Write only about the overall positive experience\n- Keep it generic and enthusiastic'}

❌ REJECTION CRITERIA:
- More/less than 3 reviews
- Missing business name or location
${keywordList.length > 0 ? '- Missing keywords from the provided list\n- Generic phrases not in keywords\n- Invented services not in keywords' : '- Mentioning specific services when no keywords provided'}
- Reviews over 40 words

✅ SUCCESS CRITERIA:
- Exactly 3 reviews
- Business name + location in each
${keywordList.length > 0 ? '- 2-3 keywords naturally integrated in each' : '- Generic positive experience without specific services'}
- Authentic customer voice
- Under 40 words each`
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 350, // Strict limit for exactly 3 reviews of 40 words each
          temperature: 0.7, // Balanced - creative but follows instructions strictly
          top_p: 0.92, // Focused token selection for better instruction following
          frequency_penalty: 0.8, // Prevent repetition but allow natural language
          presence_penalty: 0.7  // Ensure varied content
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
        
        // ⚠️ CRITICAL: Ensure we have EXACTLY 3 reviews
        if (reviews.length !== 3) {
          console.error(`❌ AI VIOLATED INSTRUCTION: Generated ${reviews.length} reviews instead of 3!`);

          if (reviews.length > 3) {
            // Take first 3 if we have more
            console.log(`🔧 Forcing to 3 reviews by slicing array...`);
            reviews = reviews.slice(0, 3);
          } else if (reviews.length < 3) {
            // Reject if less than 3 - this is a serious error
            console.error(`❌ CRITICAL ERROR: AI generated only ${reviews.length} reviews. This violates requirements.`);
            throw new Error(`AI generated insufficient reviews (${reviews.length}/3). Please try again.`);
          }
        }

        // ✅ Validate each review contains business name and location
        console.log(`🔍 Validating reviews contain business name and location...`);
        reviews.forEach((review, index) => {
          const reviewText = review.review || '';
          const hasBusinessName = reviewText.includes(businessName);
          const hasLocation = reviewText.includes(cleanLocation);

          if (!hasBusinessName) {
            console.error(`❌ Review ${index + 1} missing business name "${businessName}"`);
          }
          if (!hasLocation && cleanLocation) {
            console.error(`❌ Review ${index + 1} missing location "${cleanLocation}"`);
          }

          console.log(`Review ${index + 1}: Business Name=${hasBusinessName ? '✅' : '❌'}, Location=${hasLocation ? '✅' : '❌'}`);
        });
        
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
  async generateReplySuggestions(businessName, reviewContent, reviewRating, reviewId = null, keywords = null, businessCategory = null) {
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
      console.log(`[AI Review Service] 📋 Business Category: ${businessCategory || 'not specified'}`);

      // Get category-specific information for context
      const categoryMapping = getCategoryMapping(businessCategory);
      console.log(`[AI Review Service] 🎯 Using category context for replies: ${businessCategory || 'default'}`);

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

      // Enhanced prompt with keyword integration and category context
      const keywordPrompt = keywordList.length > 0
        ? `\nBUSINESS KEYWORDS (naturally incorporate if relevant): ${keywordList.join(', ')}`
        : '\n⚠️ NO KEYWORDS PROVIDED - DO NOT mention any specific services or features';

      const categoryContext = businessCategory
        ? `\nBUSINESS TYPE: ${businessCategory}
INDUSTRY CONTEXT: This is a ${businessCategory} business. Use appropriate industry language and focus on relevant aspects like: ${categoryMapping.focusAreas.slice(0, 4).join(', ')}.`
        : '';

      const prompt = `Generate 3 completely unique, professional business reply suggestions for a ${reviewRating}-star customer review.
${keywordPrompt}${categoryContext}

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
${keywordList.length > 0 ? `- Naturally include business keywords (${keywordList.join(', ')}) if appropriate` : '- DO NOT mention any specific services or features - keep reply generic'}
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
