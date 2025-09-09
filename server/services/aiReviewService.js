import fetch from 'node-fetch';

class AIReviewService {
  constructor() {
    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || 'https://gmbboostpro.openai.azure.com/';
    this.apiKey = process.env.AZURE_OPENAI_API_KEY || '60b5e15c026747639e487fb4bc17f0fe';
    this.deploymentName = 'gpt-4o-mini';
    this.apiVersion = '2024-08-01-preview';
  }

  async generateReviewSuggestions(businessName, location, businessType = 'business') {
    try {
      // Clean up location - remove generic terms and use properly
      let cleanLocation = location;
      if (location && location.toLowerCase() === 'location' || location.toLowerCase() === 'your location') {
        cleanLocation = ''; // Don't use generic location in reviews
      }
      
      // Create location phrase for the prompt
      const locationPhrase = cleanLocation ? `in ${cleanLocation}` : '';
      
      console.log(`[AI Review Service] Generating suggestions for ${businessName} ${locationPhrase}`);
      
      const prompt = `Generate 5 unique, authentic customer review suggestions for "${businessName}"${locationPhrase ? ` located in "${cleanLocation}"` : ''}. 
      
      Requirements:
      - Each review MUST be completely different and unique
      - Include specific SEO keywords: "${businessName}"${cleanLocation ? ` and "${cleanLocation}"` : ''} naturally
      - Vary the tone: some enthusiastic, some moderate, some professional
      - Vary the length: some short (2-3 sentences), some medium (4-5 sentences), some detailed (6-7 sentences)
      - Include different aspects: service quality, staff, atmosphere, value, experience
      - Make them sound genuine and human-written
      - Use different writing styles and vocabulary for each
      - Include specific details that could be real (but general enough to apply)
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
              content: 'You are an expert at generating diverse, authentic-sounding customer reviews with strong SEO optimization. Each review must be completely unique with no repeated phrases or patterns.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          max_tokens: 2000,
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
        // Fallback to basic reviews if AI fails
        return this.getFallbackReviews(businessName, location);
      }
    } catch (error) {
      console.error('Error generating AI reviews:', error);
      return this.getFallbackReviews(businessName, location);
    }
  }

  getFallbackReviews(businessName, location) {
    console.log('[AI Review Service] Using enhanced fallback reviews for:', businessName, 'at', location);
    
    // Clean up location for fallback reviews too
    let cleanLocation = location;
    if (!location || location === '' || location.toLowerCase() === 'location' || location.toLowerCase() === 'your location' || location.toLowerCase() === 'your area') {
      cleanLocation = '';
    }
    
    const locationPhrase = cleanLocation ? ` in ${cleanLocation}` : '';
    const atLocation = cleanLocation ? ` at ${cleanLocation}` : '';
    
    // Create more varied templates with randomization
    const templateSets = [
      // Set 1 - Professional/Business focused
      [
        {
          review: `Recently visited ${businessName}${locationPhrase} and was thoroughly impressed with their professionalism. The team demonstrated exceptional expertise and dedication to customer satisfaction. Their attention to detail and commitment to quality service truly sets them apart from competitors.`,
          rating: 5,
          focus: 'service',
          length: 'medium'
        },
        {
          review: `${businessName}${atLocation} delivers exceptional results every time. Quick turnaround, competitive pricing, and outstanding customer support. Couldn't ask for better service!`,
          rating: 5,
          focus: 'quality',
          length: 'short'
        },
        {
          review: `As a regular customer of ${businessName}${locationPhrase}, I can confidently say they consistently exceed expectations. From the moment you walk in, you're treated with respect and professionalism. The staff takes time to understand your needs and provides tailored solutions. This is how business should be done!`,
          rating: 5,
          focus: 'experience',
          length: 'long'
        },
        {
          review: `Found ${businessName}${cleanLocation ? ` while visiting ${cleanLocation}` : ''} and was pleasantly surprised by their excellent service and fair pricing. Great value for money and genuinely helpful staff.`,
          rating: 4,
          focus: 'value',
          length: 'medium'
        },
        {
          review: `The team at ${businessName}${locationPhrase} is simply outstanding. Knowledgeable, courteous, and always willing to go the extra mile. Highly recommend their services!`,
          rating: 5,
          focus: 'staff',
          length: 'short'
        }
      ],
      // Set 2 - Casual/Friendly tone
      [
        {
          review: `Wow! Just had an incredible experience at ${businessName}${locationPhrase}. The staff made me feel so welcome and took care of everything perfectly. This is my new go-to place for sure!`,
          rating: 5,
          focus: 'service',
          length: 'medium'
        },
        {
          review: `${businessName}${atLocation} is absolutely fantastic! Top-notch quality and super friendly service. Can't recommend them enough!`,
          rating: 5,
          focus: 'quality',
          length: 'short'
        },
        {
          review: `Been going to ${businessName}${locationPhrase} for a while now and they never disappoint. What I love most is how they remember their customers and always make you feel valued. The quality is consistently excellent and the atmosphere is always welcoming. Definitely worth checking out if you haven't already!`,
          rating: 5,
          focus: 'experience',
          length: 'long'
        },
        {
          review: `Great find in ${cleanLocation || 'the area'}! ${businessName} offers amazing service without breaking the bank. Friendly folks and quality work - what more could you want?`,
          rating: 4,
          focus: 'value',
          length: 'medium'
        },
        {
          review: `Love the vibe at ${businessName}${locationPhrase}! Everyone is so helpful and friendly. Makes the whole experience enjoyable!`,
          rating: 5,
          focus: 'staff',
          length: 'short'
        }
      ],
      // Set 3 - Detailed/Specific
      [
        {
          review: `My experience with ${businessName}${locationPhrase} exceeded all expectations. From the initial consultation to the final delivery, every step was handled with utmost professionalism. The team's expertise is evident in their work quality and customer care approach.`,
          rating: 5,
          focus: 'service',
          length: 'medium'
        },
        {
          review: `Outstanding quality from ${businessName}${atLocation}. Fast, reliable, and worth every penny. They've earned a loyal customer!`,
          rating: 5,
          focus: 'quality',
          length: 'short'
        },
        {
          review: `I want to share my exceptional experience with ${businessName}${locationPhrase}. What impressed me most was their genuine commitment to customer satisfaction. They took time to understand my specific needs, offered valuable suggestions, and delivered beyond what was promised. The facility is well-maintained, the staff is professional yet approachable, and the overall experience was seamless from start to finish.`,
          rating: 5,
          focus: 'experience',
          length: 'long'
        },
        {
          review: `Discovered ${businessName}${cleanLocation ? ` in ${cleanLocation}` : ''} recently and I'm impressed! Excellent service quality at reasonable prices. The staff is knowledgeable and efficient. Definitely coming back!`,
          rating: 4,
          focus: 'value',
          length: 'medium'
        },
        {
          review: `${businessName}${locationPhrase} has an amazing team! Professional, efficient, and genuinely caring. They make every visit worthwhile!`,
          rating: 5,
          focus: 'staff',
          length: 'short'
        }
      ]
    ];
    
    // Randomly select one template set for variety
    const selectedSet = templateSets[Math.floor(Math.random() * templateSets.length)];

    const timestamp = Date.now();
    return selectedSet.map((template, index) => ({
      ...template,
      id: `fallback_${timestamp}_${index}`,
      businessName,
      location,
      generatedAt: new Date().toISOString()
    }));
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