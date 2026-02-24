import fetch from 'node-fetch';

/**
 * AI Suggestion Service - Generates AI-powered optimization suggestions
 * for every aspect of a Google Business Profile.
 *
 * Takes audit results and profile data, then generates specific suggestions
 * for each gap found using Azure OpenAI.
 */
class AISuggestionService {
  constructor() {
    // Azure OpenAI API configuration from environment variables
    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini-3';
    this.azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';

    // Build full Azure OpenAI endpoint URL
    this.openaiEndpoint = this.azureEndpoint
      ? `${this.azureEndpoint}/openai/deployments/${this.azureDeployment}/chat/completions?api-version=${this.azureApiVersion}`
      : '';

    // Rate-limiting state
    this.lastCallTimestamp = 0;
    this.minCallIntervalMs = 500; // Minimum 500ms between consecutive AI calls

    console.log('[AISuggestionService] Initialized with Azure OpenAI configuration');
    console.log(`[AISuggestionService] Endpoint: ${this.azureEndpoint || 'NOT SET'}`);
    console.log(`[AISuggestionService] Deployment: ${this.azureDeployment}`);
    console.log(`[AISuggestionService] API Key: ${this.azureApiKey ? 'Configured' : 'NOT SET'}`);
  }

  // ---------------------------------------------------------------------------
  // Core Azure OpenAI call method
  // ---------------------------------------------------------------------------

  /**
   * Call Azure OpenAI with rate limiting and robust JSON parsing.
   * @param {string} systemPrompt - The system-level instruction prompt
   * @param {string} userPrompt - The user-level data/request prompt
   * @param {number} maxTokens - Maximum tokens for the response
   * @returns {object} Parsed JSON object from the AI response
   */
  async callAzureOpenAI(systemPrompt, userPrompt, maxTokens = 2000) {
    // Check configuration
    if (!this.azureApiKey || !this.openaiEndpoint) {
      throw new Error(
        '[AISuggestionService] Azure OpenAI is not configured. ' +
        'Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY environment variables.'
      );
    }

    // Rate limiting - enforce minimum interval between calls
    const now = Date.now();
    const elapsed = now - this.lastCallTimestamp;
    if (elapsed < this.minCallIntervalMs) {
      const waitTime = this.minCallIntervalMs - elapsed;
      console.log(`[AISuggestionService] Rate limiting: waiting ${waitTime}ms before next call`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }
    this.lastCallTimestamp = Date.now();

    console.log(`[AISuggestionService] Calling Azure OpenAI (maxTokens: ${maxTokens})`);

    const response = await fetch(this.openaiEndpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'api-key': this.azureApiKey,
      },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        max_tokens: maxTokens,
        temperature: 0.7,
        response_format: { type: 'json_object' }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error(`[AISuggestionService] Azure OpenAI API error (${response.status}):`, errorText);
      throw new Error(`[AISuggestionService] Azure API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();

    if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
      console.error('[AISuggestionService] Unexpected API response structure:', JSON.stringify(data).substring(0, 500));
      throw new Error('[AISuggestionService] Unexpected response structure from Azure OpenAI');
    }

    const content = data.choices[0].message.content.trim();
    console.log(`[AISuggestionService] Raw response (first 300 chars): ${content.substring(0, 300)}`);

    // Robust JSON parsing with multiple fallback strategies
    try {
      return JSON.parse(content);
    } catch (firstError) {
      console.log('[AISuggestionService] Direct JSON parse failed, attempting cleanup');

      try {
        // Remove markdown code fences if present
        let cleaned = content
          .replace(/^```[a-z]*\n?/gi, '')
          .replace(/\n?```$/gi, '')
          .trim();

        // Try to extract a JSON object { ... } or array [ ... ]
        const objStart = cleaned.indexOf('{');
        const arrStart = cleaned.indexOf('[');
        let start = -1;
        let end = -1;

        if (objStart !== -1 && (arrStart === -1 || objStart < arrStart)) {
          start = objStart;
          end = cleaned.lastIndexOf('}');
        } else if (arrStart !== -1) {
          start = arrStart;
          end = cleaned.lastIndexOf(']');
        }

        if (start !== -1 && end > start) {
          cleaned = cleaned.substring(start, end + 1);
        }

        // Clean common JSON issues
        cleaned = cleaned
          .replace(/,\s*}/g, '}')
          .replace(/,\s*]/g, ']');

        return JSON.parse(cleaned);
      } catch (secondError) {
        console.error('[AISuggestionService] JSON parsing failed after cleanup:', secondError.message);
        console.error('[AISuggestionService] Raw content:', content.substring(0, 1000));
        throw new Error('[AISuggestionService] Failed to parse AI response as valid JSON. Please try again.');
      }
    }
  }

  // ---------------------------------------------------------------------------
  // Helper utilities
  // ---------------------------------------------------------------------------

  /**
   * Build a business context string for injection into AI prompts.
   * Contains currency, tone, audience, price range, USPs, and special instructions.
   */
  _buildBusinessContextPrompt(businessContext) {
    if (!businessContext) return '';

    const currencyMap = {
      'INR': { symbol: '₹', name: 'Indian Rupees (INR)' },
      'USD': { symbol: '$', name: 'US Dollars (USD)' },
      'EUR': { symbol: '€', name: 'Euros (EUR)' },
      'GBP': { symbol: '£', name: 'British Pounds (GBP)' },
      'AED': { symbol: 'د.إ', name: 'UAE Dirhams (AED)' },
      'AUD': { symbol: 'A$', name: 'Australian Dollars (AUD)' },
      'CAD': { symbol: 'C$', name: 'Canadian Dollars (CAD)' },
      'SGD': { symbol: 'S$', name: 'Singapore Dollars (SGD)' },
    };

    const toneMap = {
      'professional': 'Professional and business-appropriate',
      'friendly': 'Warm, friendly, and approachable',
      'casual': 'Casual and conversational',
      'authoritative': 'Authoritative and expert-level',
    };

    const audienceMap = {
      'local_residents': 'local residents and community members',
      'tourists': 'tourists and out-of-town visitors',
      'businesses': 'other businesses and corporate clients (B2B)',
      'families': 'families and family-oriented customers',
      'young_professionals': 'young working professionals aged 25-40',
      'everyone': 'a broad general audience',
    };

    const priceMap = {
      'budget': 'budget-friendly and affordable',
      'mid_range': 'mid-range',
      'premium': 'premium and high-end',
      'luxury': 'luxury and top-tier',
      'varies': 'varied across different services/products',
    };

    const currency = currencyMap[businessContext.currency] || currencyMap['INR'];
    const tone = toneMap[businessContext.tone] || toneMap['professional'];
    const audience = audienceMap[businessContext.targetAudience] || audienceMap['everyone'];
    const priceRange = priceMap[businessContext.priceRange] || priceMap['mid_range'];

    let contextBlock = `
BUSINESS OWNER PREFERENCES (MUST follow these):
- CURRENCY: All prices and monetary values MUST use ${currency.name} with the "${currency.symbol}" symbol. NEVER use any other currency.
- TONE: Write in a ${tone} tone throughout.
- TARGET AUDIENCE: The primary audience is ${audience}. Tailor language and messaging accordingly.
- PRICE RANGE: The business positions itself as ${priceRange}. Reflect this in pricing and language.`;

    if (businessContext.uniqueSellingPoints && businessContext.uniqueSellingPoints.trim()) {
      contextBlock += `\n- UNIQUE SELLING POINTS: ${businessContext.uniqueSellingPoints.trim()}. Incorporate these naturally where relevant.`;
    }

    if (businessContext.specialInstructions && businessContext.specialInstructions.trim()) {
      contextBlock += `\n- SPECIAL INSTRUCTIONS: ${businessContext.specialInstructions.trim()}`;
    }

    return contextBlock;
  }

  /**
   * Safely extract a value from nested profile data.
   */
  _safeGet(obj, path, defaultValue = '') {
    try {
      return path.split('.').reduce((acc, key) => acc[key], obj) ?? defaultValue;
    } catch {
      return defaultValue;
    }
  }

  /**
   * Build a comma-separated list string, truncated to maxItems.
   */
  _listString(arr, maxItems = 10) {
    if (!Array.isArray(arr) || arr.length === 0) return 'None available';
    return arr.slice(0, maxItems).join(', ');
  }

  // ---------------------------------------------------------------------------
  // 1. Business Description Suggestion
  // ---------------------------------------------------------------------------

  /**
   * Generate an optimized business description.
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results with keyword data
   * @param {string|null} userFeedback - Optional user feedback for regeneration
   * @returns {object} { description, reasoning, keywordsUsed, charCount }
   */
  async generateDescriptionSuggestion(profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log('[AISuggestionService] Generating business description suggestion');

    const profile = profileData.profile || {};
    const reviews = profileData.reviews || [];
    const services = profileData.services || [];
    const keywords = auditResults.keywords || {};

    const businessName = profile.title || profile.name || 'the business';
    const primaryCategory = profile.primaryCategory?.displayName || profile.category || 'Business';
    const city = profile.address?.locality || profile.city || '';
    const state = profile.address?.administrativeArea || profile.state || '';
    const currentDescription = profile.description || profile.snippet || '';
    const reviewKeywordsTop10 = this._listString(keywords.topKeywords || keywords.top || [], 10);
    const keywordGapsTop5 = this._listString(keywords.gaps || keywords.missing || [], 5);
    const servicesList = this._listString(
      services.map(s => s.displayName || s.name || s).filter(Boolean),
      15
    );

    // Extract positive review themes
    const positiveReviews = reviews.filter(r => (r.starRating === 'FIVE' || r.starRating === 'FOUR' || r.rating >= 4));
    const positiveThemes = positiveReviews
      .slice(0, 10)
      .map(r => r.comment || r.text || '')
      .filter(Boolean)
      .join(' | ')
      .substring(0, 500);

    const feedbackClause = userFeedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS SUGGESTION (incorporate this):\n"${userFeedback}"\nAdjust the description based on this feedback while still following all rules.`
      : '';

    const systemPrompt = `You are an expert Google Business Profile (GBP) optimization consultant. Your task is to write an optimized business description that maximizes local search visibility while remaining compliant with Google's guidelines.

STRICT RULES YOU MUST FOLLOW:
1. The description MUST be between 250 and 750 characters (inclusive). Aim for 600-720 characters.
2. Front-load the first 250 characters with the most important information — this is what appears in the GBP snippet before "Read more".
3. No single keyword may appear more than 2 times in the entire description.
4. NEVER use superlatives like "best", "#1", "top-rated", "leading", "premier", "number one", "greatest", or similar boastful claims. Google prohibits these.
5. Do NOT include phone numbers, URLs, email addresses, or any contact information.
6. Mention the city name exactly once in the description.
7. Include exactly one clear call-to-action (CTA) near the end (e.g., "Schedule a consultation today", "Visit us to experience...", "Contact us to learn more").
8. Write in the third person (use the business name or "the team", never "we" or "our").
9. The description must be unique and specifically tailored to THIS business — avoid generic boilerplate.
10. DO NOT keyword-stuff. Integrate keywords naturally into flowing sentences. If a keyword feels forced, leave it out.
11. Use professional but approachable language.

ANTI-STUFFING RULES:
- Each sentence should read naturally to a human — no awkward keyword insertions.
- Vary sentence length and structure.
- Focus on communicating value, not cramming keywords.

You MUST respond with valid JSON in this exact format:
{
  "description": "The full optimized description text",
  "reasoning": "Explanation of the optimization strategy and why specific choices were made",
  "keywordsUsed": ["keyword1", "keyword2", ...],
  "charCount": 650
}`;

    const userPrompt = `Generate an optimized Google Business Profile description for the following business:

BUSINESS NAME: ${businessName}
PRIMARY CATEGORY: ${primaryCategory}
CITY: ${city}
STATE: ${state}
CURRENT DESCRIPTION: ${currentDescription || 'No current description set'}

TOP REVIEW KEYWORDS (from customer reviews — use the most relevant ones):
${reviewKeywordsTop10}

KEYWORD GAPS (keywords competitors rank for but this business is missing):
${keywordGapsTop5}

SERVICES OFFERED:
${servicesList}

POSITIVE REVIEW THEMES (what customers love):
${positiveThemes || 'No review data available'}
${this._buildBusinessContextPrompt(businessContext)}${feedbackClause}

Remember: 250-750 characters, front-load the first 250 chars, one city mention, one CTA, third person, no superlatives, no keyword stuffing.`;

    const result = await this.callAzureOpenAI(systemPrompt, userPrompt, 1500);

    return {
      type: 'description',
      content: result,
      aiReasoning: result.reasoning || 'Optimized description generated based on review keywords, service offerings, and local SEO principles.',
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // 2. Secondary Category Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Generate secondary category recommendations.
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results with keyword data
   * @param {string|null} userFeedback - Optional user feedback for regeneration
   * @returns {object} { categories: [{ name, reasoning, searchImpact }] }
   */
  async generateCategorySuggestions(profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log('[AISuggestionService] Generating secondary category suggestions');

    const profile = profileData.profile || {};
    const services = profileData.services || [];
    const keywords = auditResults.keywords || {};

    const businessName = profile.title || profile.name || 'the business';
    const primaryCategory = profile.primaryCategory?.displayName || profile.category || 'Business';
    const currentSecondary = (profile.additionalCategories || profile.secondaryCategories || [])
      .map(c => c.displayName || c.name || c)
      .filter(Boolean);
    const serviceNames = services.map(s => s.displayName || s.name || s).filter(Boolean);
    const reviewKeywords = this._listString(keywords.topKeywords || keywords.top || [], 20);

    const feedbackClause = userFeedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS SUGGESTION (incorporate this):\n"${userFeedback}"\nAdjust the recommendations based on this feedback.`
      : '';

    const systemPrompt = `You are an expert Google Business Profile (GBP) local SEO consultant specializing in category optimization. Your task is to recommend the best secondary categories for a business.

STRICT RULES:
1. Recommend a MAXIMUM of 9 secondary categories (Google allows up to 9).
2. Every recommended category MUST be a real Google Business Profile category name. Do not invent categories.
3. Each category must be genuinely relevant to the business based on services offered and customer feedback.
4. Prioritize categories by their potential search impact (high, medium, low).
5. Do NOT recommend categories that duplicate or are too similar to the primary category.
6. Do NOT recommend categories the business already has as secondary categories.
7. Consider what customers actually search for when looking for this type of business.

ANTI-STUFFING RULES:
- Only suggest categories where the business genuinely provides that service or product.
- Avoid overly broad or tangential categories that could confuse Google's algorithm.
- Quality over quantity — fewer highly relevant categories beat many loosely related ones.

You MUST respond with valid JSON in this exact format:
{
  "categories": [
    {
      "name": "Exact Google Category Name",
      "reasoning": "Why this category is relevant and how it will help",
      "searchImpact": "high"
    }
  ]
}

searchImpact must be one of: "high", "medium", "low"`;

    const userPrompt = `Recommend secondary categories for the following Google Business Profile:

BUSINESS NAME: ${businessName}
PRIMARY CATEGORY: ${primaryCategory}
CURRENT SECONDARY CATEGORIES: ${currentSecondary.length > 0 ? currentSecondary.join(', ') : 'None set'}

SERVICES OFFERED:
${serviceNames.length > 0 ? serviceNames.join(', ') : 'No services listed'}

REVIEW KEYWORDS (what customers mention):
${reviewKeywords}
${this._buildBusinessContextPrompt(businessContext)}${feedbackClause}

Recommend up to 9 secondary categories, ordered by search impact (highest first). Only suggest real GBP categories that are genuinely relevant.`;

    const result = await this.callAzureOpenAI(systemPrompt, userPrompt, 1500);

    return {
      type: 'categories',
      content: result,
      aiReasoning: result.categories?.length
        ? `Recommended ${result.categories.length} secondary categories based on service offerings, review keywords, and search impact analysis.`
        : 'No additional secondary categories recommended at this time.',
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // 3. Service Description Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Generate optimized service descriptions and new service suggestions.
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results with keyword data
   * @param {string|null} userFeedback - Optional user feedback for regeneration
   * @returns {object} { services: [{ name, description, isNew, keywords }] }
   */
  async generateServiceSuggestions(profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log('[AISuggestionService] Generating service description suggestions');

    const profile = profileData.profile || {};
    const services = profileData.services || [];
    const keywords = auditResults.keywords || {};

    const businessName = profile.title || profile.name || 'the business';
    const category = profile.primaryCategory?.displayName || profile.category || 'Business';
    const city = profile.address?.locality || profile.city || '';
    const reviewKeywords = this._listString(keywords.topKeywords || keywords.top || [], 15);
    const serviceGaps = this._listString(keywords.serviceGaps || keywords.gaps || [], 10);

    // Format existing services with their descriptions
    const existingServicesFormatted = services.map(s => {
      const name = s.displayName || s.name || s;
      const desc = s.description || 'No description';
      return `- ${name}: ${desc}`;
    }).join('\n');

    const feedbackClause = userFeedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS SUGGESTION (incorporate this):\n"${userFeedback}"\nAdjust the service suggestions based on this feedback.`
      : '';

    const systemPrompt = `You are an expert Google Business Profile (GBP) optimization consultant specializing in service section optimization. Your task is to write compelling, keyword-optimized service descriptions and identify missing services.

STRICT RULES:
1. Each service description MUST be between 100 and 300 characters (inclusive).
2. Include 1-2 relevant keywords per description, integrated naturally.
3. Be specific about what each service includes — avoid vague generalities.
4. For existing services with weak or missing descriptions, provide improved versions.
5. For new service suggestions, only suggest services the business likely offers based on its category and reviews.
6. Each description should communicate value to the customer (what they get, how it helps them).
7. Do NOT use superlatives ("best", "#1") or promotional language ("cheap", "discount").

ANTI-STUFFING RULES:
- Maximum 1-2 keywords per description — no more.
- Keywords must fit naturally into the sentence structure.
- Each description should read like a helpful explanation, not a keyword list.
- Vary vocabulary across descriptions — do not reuse the same phrasing.

You MUST respond with valid JSON in this exact format:
{
  "services": [
    {
      "name": "Service Name",
      "description": "Optimized description between 100-300 characters",
      "isNew": false,
      "keywords": ["keyword1", "keyword2"]
    }
  ]
}

isNew = true means this is a new service suggestion; false means it is an existing service with an improved description.`;

    const userPrompt = `Generate optimized service descriptions for the following business:

BUSINESS NAME: ${businessName}
CATEGORY: ${category}
CITY: ${city}

EXISTING SERVICES (with current descriptions):
${existingServicesFormatted || 'No services currently listed'}

REVIEW KEYWORDS (what customers search for and mention):
${reviewKeywords}

SERVICE GAPS (services competitors offer that this business may be missing):
${serviceGaps}
${this._buildBusinessContextPrompt(businessContext)}${feedbackClause}

For each existing service, provide an improved description. Also suggest any new services that are clearly relevant based on the category and keywords. Mark new suggestions with isNew: true.`;

    const result = await this.callAzureOpenAI(systemPrompt, userPrompt, 2500);

    return {
      type: 'services',
      content: result,
      aiReasoning: result.services?.length
        ? `Generated descriptions for ${result.services.filter(s => !s.isNew).length} existing services and suggested ${result.services.filter(s => s.isNew).length} new services based on keyword analysis and competitive gaps.`
        : 'No service suggestions generated.',
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // 4. Product Suggestions
  // ---------------------------------------------------------------------------

  /**
   * Generate product suggestions for the GBP product catalog.
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results with keyword data
   * @param {string|null} userFeedback - Optional user feedback for regeneration
   * @returns {object} { products: [{ name, description, category, suggestedPriceRange }] }
   */
  async generateProductSuggestions(profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log('[AISuggestionService] Generating product suggestions');

    const profile = profileData.profile || {};
    const services = profileData.services || [];
    const products = profileData.products || [];
    const reviews = profileData.reviews || [];
    const keywords = auditResults.keywords || {};

    const businessName = profile.title || profile.name || 'the business';
    const category = profile.primaryCategory?.displayName || profile.category || 'Business';
    const serviceNames = services.map(s => s.displayName || s.name || s).filter(Boolean);
    const reviewKeywords = this._listString(keywords.topKeywords || keywords.top || [], 15);

    // Extract product mentions from reviews
    const reviewTexts = reviews
      .slice(0, 20)
      .map(r => r.comment || r.text || '')
      .filter(Boolean)
      .join(' | ')
      .substring(0, 800);

    const feedbackClause = userFeedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS SUGGESTION (incorporate this):\n"${userFeedback}"\nAdjust the product suggestions based on this feedback.`
      : '';

    const systemPrompt = `You are an expert Google Business Profile (GBP) optimization consultant specializing in the Products section. Your task is to suggest products or service packages that should be listed in the GBP product catalog to increase visibility and conversions.

STRICT RULES:
1. Each product description MUST be between 100 and 500 characters (inclusive).
2. Suggest a MAXIMUM of 10 products.
3. Group products into logical categories (e.g., "Core Services", "Premium Packages", "Seasonal Specials").
4. Each product should represent a distinct offering — no overlap or near-duplicates.
5. Include a suggested price range when appropriate (use "Contact for pricing" if the service is highly variable).
6. Product names should be clear and search-friendly.
7. Descriptions should explain what the customer gets and why it matters.

ANTI-STUFFING RULES:
- Product names and descriptions should read naturally — no keyword cramming.
- Focus on customer value, not SEO tricks.
- Vary language and structure across products.

You MUST respond with valid JSON in this exact format:
{
  "products": [
    {
      "name": "Product or Service Package Name",
      "description": "Detailed description between 100-500 characters explaining what the customer gets",
      "category": "Category grouping name",
      "suggestedPriceRange": "Price range in local currency or Contact for pricing"
    }
  ]
}`;

    const userPrompt = `Suggest products for the Google Business Profile product catalog:

BUSINESS NAME: ${businessName}
BUSINESS CATEGORY: ${category}

SERVICES OFFERED:
${serviceNames.length > 0 ? serviceNames.join(', ') : 'No services listed'}

EXISTING PRODUCTS:
${products.length > 0 ? products.map(p => `- ${p.name || p.displayName}: ${p.description || 'No description'}`).join('\n') : 'No products currently listed'}

REVIEW KEYWORDS:
${reviewKeywords}

PRODUCT/SERVICE MENTIONS IN REVIEWS:
${reviewTexts || 'No review data available'}
${this._buildBusinessContextPrompt(businessContext)}${feedbackClause}

Suggest up to 10 products grouped into categories. Focus on what customers are searching for and what the business actually offers.`;

    const result = await this.callAzureOpenAI(systemPrompt, userPrompt, 2500);

    return {
      type: 'products',
      content: result,
      aiReasoning: result.products?.length
        ? `Suggested ${result.products.length} products across ${[...new Set((result.products || []).map(p => p.category))].length} categories based on services, review mentions, and search demand.`
        : 'No product suggestions generated.',
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // 5. Review Reply Templates
  // ---------------------------------------------------------------------------

  /**
   * Generate review reply templates for positive, neutral, and negative reviews.
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results with keyword data
   * @param {string|null} userFeedback - Optional user feedback for regeneration
   * @returns {object} { templates: { positive, neutral, negative } }
   */
  async generateReplyTemplates(profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log('[AISuggestionService] Generating review reply templates');

    const profile = profileData.profile || {};
    const reviews = profileData.reviews || [];
    const keywords = auditResults.keywords || {};

    const businessName = profile.title || profile.name || 'the business';
    const category = profile.primaryCategory?.displayName || profile.category || 'Business';
    const topKeywords = (keywords.topKeywords || keywords.top || []).slice(0, 5);
    const topKeywordsStr = this._listString(topKeywords, 5);

    // Compute average rating
    const ratings = reviews
      .map(r => {
        if (typeof r.rating === 'number') return r.rating;
        if (r.starRating === 'FIVE') return 5;
        if (r.starRating === 'FOUR') return 4;
        if (r.starRating === 'THREE') return 3;
        if (r.starRating === 'TWO') return 2;
        if (r.starRating === 'ONE') return 1;
        return null;
      })
      .filter(r => r !== null);
    const avgRating = ratings.length > 0
      ? (ratings.reduce((sum, r) => sum + r, 0) / ratings.length).toFixed(1)
      : 'N/A';

    // Find sample reviews
    const samplePositive = reviews.find(r =>
      (r.starRating === 'FIVE' || r.starRating === 'FOUR' || r.rating >= 4) && (r.comment || r.text)
    );
    const sampleNegative = reviews.find(r =>
      (r.starRating === 'ONE' || r.starRating === 'TWO' || (r.rating && r.rating <= 2)) && (r.comment || r.text)
    );

    const samplePositiveText = samplePositive
      ? (samplePositive.comment || samplePositive.text || '').substring(0, 300)
      : 'Great experience! The team was very professional and helpful. Will definitely come back.';
    const sampleNegativeText = sampleNegative
      ? (sampleNegative.comment || sampleNegative.text || '').substring(0, 300)
      : 'Disappointed with the service. Long wait times and staff seemed disorganized. Expected better.';

    const feedbackClause = userFeedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS SUGGESTION (incorporate this):\n"${userFeedback}"\nAdjust the reply templates based on this feedback.`
      : '';

    const systemPrompt = `You are an expert in Google Business Profile review management and local SEO. Your task is to create review reply templates that are professional, authentic, and subtly keyword-optimized for local search.

STRICT RULES FOR EACH TEMPLATE:
1. POSITIVE reply template: 100-150 words. Express genuine gratitude, reference the specific positive experience, subtly reinforce the business's strengths, and invite the customer to return.
2. NEUTRAL reply template: 100-150 words. Thank the customer, acknowledge their balanced feedback, express commitment to improvement, and offer to make their next visit better.
3. NEGATIVE reply template: 120-160 words. Apologize sincerely and specifically, take responsibility without being defensive, offer a concrete resolution path (e.g., "Please contact us at..."), and express genuine desire to make things right.

KEYWORD INTEGRATION:
- Include 2-3 of the provided business keywords naturally across each template.
- Keywords should feel organic — never forced or awkward.
- Use keywords in context that reinforces the business's services and value.

PLACEHOLDERS (MUST include in every template):
- {REVIEWER_NAME} — will be replaced with the actual reviewer's name
- {SPECIFIC_SERVICE} — will be replaced with the specific service or experience mentioned

ANTI-STUFFING RULES:
- Templates must sound like they were written by a real business owner, not a marketing bot.
- Vary vocabulary and sentence structure across the three templates.
- No superlatives ("best", "#1"), no promotional language.
- The tone should match the sentiment: warm for positive, understanding for neutral, empathetic for negative.

You MUST respond with valid JSON in this exact format:
{
  "templates": {
    "positive": "The positive review reply template text with {REVIEWER_NAME} and {SPECIFIC_SERVICE} placeholders",
    "neutral": "The neutral review reply template text with {REVIEWER_NAME} and {SPECIFIC_SERVICE} placeholders",
    "negative": "The negative review reply template text with {REVIEWER_NAME} and {SPECIFIC_SERVICE} placeholders"
  }
}`;

    const userPrompt = `Create review reply templates for the following business:

BUSINESS NAME: ${businessName}
BUSINESS CATEGORY: ${category}
TOP 5 KEYWORDS TO INTEGRATE: ${topKeywordsStr}
AVERAGE RATING: ${avgRating}/5

SAMPLE POSITIVE REVIEW (for context):
"${samplePositiveText}"

SAMPLE NEGATIVE REVIEW (for context):
"${sampleNegativeText}"
${this._buildBusinessContextPrompt(businessContext)}${feedbackClause}

Generate three templates (positive, neutral, negative) that sound authentic and include {REVIEWER_NAME} and {SPECIFIC_SERVICE} placeholders. Naturally integrate 2-3 keywords into each template.`;

    const result = await this.callAzureOpenAI(systemPrompt, userPrompt, 2000);

    return {
      type: 'replyTemplates',
      content: result,
      aiReasoning: `Generated three review reply templates (positive, neutral, negative) for ${businessName} with keyword integration for: ${topKeywordsStr}. Templates include {REVIEWER_NAME} and {SPECIFIC_SERVICE} placeholders for personalization.`,
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // 6. Attribute Recommendations
  // ---------------------------------------------------------------------------

  /**
   * Generate attribute recommendations for the GBP listing.
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results with keyword data
   * @param {string|null} userFeedback - Optional user feedback for regeneration
   * @returns {object} { attributes: [{ name, group, recommended, reasoning }] }
   */
  async generateAttributeRecommendations(profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log('[AISuggestionService] Generating attribute recommendations');

    const profile = profileData.profile || {};
    const services = profileData.services || [];
    const keywords = auditResults.keywords || {};

    const businessName = profile.title || profile.name || 'the business';
    const category = profile.primaryCategory?.displayName || profile.category || 'Business';
    const serviceNames = services.map(s => s.displayName || s.name || s).filter(Boolean);
    const reviewKeywords = this._listString(keywords.topKeywords || keywords.top || [], 15);
    const currentAttributes = (profile.attributes || [])
      .map(a => {
        const name = a.displayName || a.name || a.attributeId || a;
        const val = a.values ? a.values.join(', ') : (a.value || 'set');
        return `${name}: ${val}`;
      });

    const feedbackClause = userFeedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS SUGGESTION (incorporate this):\n"${userFeedback}"\nAdjust the attribute recommendations based on this feedback.`
      : '';

    const systemPrompt = `You are an expert Google Business Profile (GBP) optimization consultant specializing in business attributes. Your task is to recommend which attributes the business should set to maximize visibility and provide accurate information to customers.

GBP ATTRIBUTE GROUPS:
1. "accessibility" — Wheelchair accessible entrance, wheelchair accessible restroom, wheelchair accessible seating, etc.
2. "amenities" — Wi-Fi, restroom, parking, outdoor seating, live music, etc.
3. "payments" — Accepts credit cards, accepts debit cards, accepts NFC payments, accepts cash only, etc.
4. "service_options" — Online appointments, curbside pickup, delivery, dine-in, takeout, drive-through, in-store shopping, etc.
5. "dining" — Breakfast, lunch, dinner, catering, reservations, seating, menu, etc.
6. "identity" — Women-owned, veteran-owned, LGBTQ+ friendly, Black-owned, etc.

STRICT RULES:
1. Only recommend attributes that are relevant to the business category and services.
2. For each attribute, indicate whether it is "recommended" (true = should be set, false = should be reviewed/removed).
3. Provide clear reasoning for each recommendation.
4. Do NOT recommend attributes the business has already correctly set unless there is a reason to change them.
5. Prioritize attributes that customers search for and that impact search ranking.
6. Be realistic — do not recommend attributes that the business cannot honestly claim.

You MUST respond with valid JSON in this exact format:
{
  "attributes": [
    {
      "name": "Attribute name",
      "group": "accessibility|amenities|payments|service_options|dining|identity",
      "recommended": true,
      "reasoning": "Why this attribute should be set or reviewed"
    }
  ]
}`;

    const userPrompt = `Recommend attributes for the following Google Business Profile:

BUSINESS NAME: ${businessName}
BUSINESS CATEGORY: ${category}

SERVICES OFFERED:
${serviceNames.length > 0 ? serviceNames.join(', ') : 'No services listed'}

CURRENT ATTRIBUTES ALREADY SET:
${currentAttributes.length > 0 ? currentAttributes.join('\n') : 'No attributes currently set'}

REVIEW KEYWORDS (what customers mention):
${reviewKeywords}
${this._buildBusinessContextPrompt(businessContext)}${feedbackClause}

Recommend relevant attributes across all applicable groups. Focus on attributes that will improve search visibility and accurately represent the business.`;

    const result = await this.callAzureOpenAI(systemPrompt, userPrompt, 2000);

    return {
      type: 'attributes',
      content: result,
      aiReasoning: result.attributes?.length
        ? `Recommended ${result.attributes.filter(a => a.recommended).length} attributes to set and ${result.attributes.filter(a => !a.recommended).length} to review across ${[...new Set((result.attributes || []).map(a => a.group))].length} groups.`
        : 'No attribute recommendations generated.',
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // 7. Photo Shooting Guide
  // ---------------------------------------------------------------------------

  /**
   * Generate a photo shooting guide for the business.
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results with keyword data
   * @param {string|null} userFeedback - Optional user feedback for regeneration
   * @returns {object} { photoGuide: [{ type, description, tips, priority }] }
   */
  async generatePhotoGuide(profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log('[AISuggestionService] Generating photo shooting guide');

    const profile = profileData.profile || {};
    const photos = profileData.photos || {};
    const reviews = profileData.reviews || [];

    const businessName = profile.title || profile.name || 'the business';
    const category = profile.primaryCategory?.displayName || profile.category || 'Business';

    // Build photo count by type
    const photoCountsByType = {};
    if (photos.mediaCounts) {
      // If we have structured media counts
      Object.entries(photos.mediaCounts).forEach(([key, val]) => {
        photoCountsByType[key] = val;
      });
    } else if (Array.isArray(photos)) {
      // If photos is an array, categorize by mediaFormat or category
      photos.forEach(p => {
        const type = p.category || p.mediaFormat || 'UNCATEGORIZED';
        photoCountsByType[type] = (photoCountsByType[type] || 0) + 1;
      });
    } else if (photos.totalCount !== undefined) {
      photoCountsByType['total'] = photos.totalCount;
    }

    const photoCountsStr = Object.keys(photoCountsByType).length > 0
      ? Object.entries(photoCountsByType).map(([type, count]) => `${type}: ${count}`).join(', ')
      : 'No photo data available';

    // Determine missing photo types from audit
    const modules = auditResults.modules || {};
    const photoModule = modules.photos || modules.media || {};
    const missingTypes = photoModule.missingTypes || photoModule.gaps || [];
    const missingTypesStr = missingTypes.length > 0
      ? missingTypes.join(', ')
      : 'Unknown — please review current photos';

    // Extract customer descriptions of the business from reviews
    const customerDescriptions = reviews
      .filter(r => (r.comment || r.text || '').length > 50)
      .slice(0, 10)
      .map(r => (r.comment || r.text || '').substring(0, 150))
      .join(' | ');

    const feedbackClause = userFeedback
      ? `\n\nUSER FEEDBACK ON PREVIOUS SUGGESTION (incorporate this):\n"${userFeedback}"\nAdjust the photo guide based on this feedback.`
      : '';

    const systemPrompt = `You are an expert Google Business Profile (GBP) visual content strategist. Your task is to create a detailed photo shooting guide that helps the business capture images optimized for their GBP listing.

GBP PHOTO TYPES AND THEIR IMPORTANCE:
1. "cover" — The main photo shown in search results. First impression. CRITICAL.
2. "logo" — Business logo/branding image. CRITICAL.
3. "exterior" — Storefront, building exterior, signage. Helps customers find the location. HIGH priority.
4. "interior" — Inside the business. Shows atmosphere and professionalism. HIGH priority.
5. "product" — Products the business sells or makes. HIGH for product businesses.
6. "at_work" — Team members performing services or interacting with customers. Builds trust. HIGH priority.
7. "team" — Team/staff photos. Humanizes the business. MEDIUM priority.
8. "food_and_drink" — For restaurants/cafes. CRITICAL for food businesses.
9. "common_area" — Waiting areas, lobbies, shared spaces. MEDIUM priority.
10. "rooms" — For hotels/accommodations. CRITICAL for hospitality.
11. "event" — Events, workshops, community involvement. MEDIUM priority.
12. "additional" — Any other relevant photos that showcase the business.

STRICT RULES:
1. Prioritize missing photo types and types with low counts.
2. Each guide entry must include specific, actionable photography tips.
3. Tips should mention lighting, angles, composition, and what to include/exclude.
4. Consider the specific business category when making recommendations.
5. Priority must be "high", "medium", or "low" based on impact on the listing.
6. Be practical — assume the business owner is taking photos with a smartphone.

You MUST respond with valid JSON in this exact format:
{
  "photoGuide": [
    {
      "type": "cover",
      "description": "What this photo should show and why it matters",
      "tips": ["Tip 1 about lighting/angles", "Tip 2 about composition", "Tip 3 about what to include"],
      "priority": "high"
    }
  ]
}`;

    const userPrompt = `Create a photo shooting guide for the following business:

BUSINESS NAME: ${businessName}
BUSINESS CATEGORY: ${category}

CURRENT PHOTO COUNTS BY TYPE:
${photoCountsStr}

MISSING OR UNDERREPRESENTED PHOTO TYPES:
${missingTypesStr}

CUSTOMER DESCRIPTIONS (how customers describe the business in reviews — use this to inform what to photograph):
${customerDescriptions || 'No review descriptions available'}
${this._buildBusinessContextPrompt(businessContext)}${feedbackClause}

Create a comprehensive photo guide prioritizing missing types and types that will have the most impact on this specific business category.`;

    const result = await this.callAzureOpenAI(systemPrompt, userPrompt, 2500);

    return {
      type: 'photoGuide',
      content: result,
      aiReasoning: result.photoGuide?.length
        ? `Created a ${result.photoGuide.length}-item photo guide with ${result.photoGuide.filter(p => p.priority === 'high').length} high-priority items based on current photo gaps and business category.`
        : 'No photo guide generated.',
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // Main orchestrator — generate all suggestions in parallel
  // ---------------------------------------------------------------------------

  /**
   * Generate all applicable suggestions for a profile in parallel.
   * @param {object} profileData - { profile, services, products, reviews, posts, photos }
   * @param {object} auditResults - { overallScore, modules, keywords }
   * @returns {object} { suggestions: [...], errors: [...], generatedAt }
   */
  async generateAllSuggestions(profileData, auditResults, businessContext = null) {
    console.log('[AISuggestionService] Starting full suggestion generation for all modules');
    if (businessContext) {
      console.log(`[AISuggestionService] Business context provided: currency=${businessContext.currency}, tone=${businessContext.tone}, audience=${businessContext.targetAudience}`);
    }

    if (!this.azureApiKey || !this.openaiEndpoint) {
      return {
        suggestions: [],
        errors: [{
          type: 'configuration',
          message: 'Azure OpenAI is not configured. Please set AZURE_OPENAI_ENDPOINT and AZURE_OPENAI_API_KEY environment variables to enable AI suggestions.'
        }],
        generatedAt: new Date().toISOString()
      };
    }

    const generators = [
      { name: 'description', fn: () => this.generateDescriptionSuggestion(profileData, auditResults, null, businessContext) },
      { name: 'categories', fn: () => this.generateCategorySuggestions(profileData, auditResults, null, businessContext) },
      { name: 'services', fn: () => this.generateServiceSuggestions(profileData, auditResults, null, businessContext) },
      { name: 'products', fn: () => this.generateProductSuggestions(profileData, auditResults, null, businessContext) },
      { name: 'replyTemplates', fn: () => this.generateReplyTemplates(profileData, auditResults, null, businessContext) },
      { name: 'attributes', fn: () => this.generateAttributeRecommendations(profileData, auditResults, null, businessContext) },
      { name: 'photoGuide', fn: () => this.generatePhotoGuide(profileData, auditResults, null, businessContext) },
    ];

    const suggestions = [];
    const errors = [];

    // Run all generators in parallel
    const results = await Promise.allSettled(generators.map(g => g.fn()));

    results.forEach((result, index) => {
      const generatorName = generators[index].name;
      if (result.status === 'fulfilled') {
        console.log(`[AISuggestionService] Successfully generated: ${generatorName}`);
        suggestions.push(result.value);
      } else {
        console.error(`[AISuggestionService] Failed to generate ${generatorName}:`, result.reason?.message || result.reason);
        errors.push({
          type: generatorName,
          message: result.reason?.message || `Failed to generate ${generatorName} suggestions`
        });
      }
    });

    console.log(`[AISuggestionService] Generation complete: ${suggestions.length} succeeded, ${errors.length} failed`);

    return {
      suggestions,
      errors,
      generatedAt: new Date().toISOString()
    };
  }

  // ---------------------------------------------------------------------------
  // Regenerate a single suggestion with user feedback
  // ---------------------------------------------------------------------------

  /**
   * Regenerate a single suggestion type, optionally incorporating user feedback.
   * @param {string} type - One of: description, categories, services, products, replyTemplates, attributes, photoGuide
   * @param {object} profileData - Full profile data bundle
   * @param {object} auditResults - Audit results
   * @param {string|null} userFeedback - Optional feedback to improve the suggestion
   * @returns {object} The regenerated suggestion
   */
  async regenerateSuggestion(type, profileData, auditResults, userFeedback = null, businessContext = null) {
    console.log(`[AISuggestionService] Regenerating suggestion: ${type}${userFeedback ? ' (with user feedback)' : ''}`);

    const generatorMap = {
      description: () => this.generateDescriptionSuggestion(profileData, auditResults, userFeedback, businessContext),
      categories: () => this.generateCategorySuggestions(profileData, auditResults, userFeedback, businessContext),
      services: () => this.generateServiceSuggestions(profileData, auditResults, userFeedback, businessContext),
      products: () => this.generateProductSuggestions(profileData, auditResults, userFeedback, businessContext),
      replyTemplates: () => this.generateReplyTemplates(profileData, auditResults, userFeedback, businessContext),
      attributes: () => this.generateAttributeRecommendations(profileData, auditResults, userFeedback, businessContext),
      photoGuide: () => this.generatePhotoGuide(profileData, auditResults, userFeedback, businessContext),
    };

    const generator = generatorMap[type];
    if (!generator) {
      throw new Error(
        `[AISuggestionService] Unknown suggestion type: "${type}". ` +
        `Valid types are: ${Object.keys(generatorMap).join(', ')}`
      );
    }

    try {
      const result = await generator();
      console.log(`[AISuggestionService] Successfully regenerated: ${type}`);
      return result;
    } catch (error) {
      console.error(`[AISuggestionService] Failed to regenerate ${type}:`, error.message);
      throw error;
    }
  }
}

export default new AISuggestionService();
