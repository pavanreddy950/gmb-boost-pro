import connectionPool from '../database/connectionPool.js';

/**
 * Profile Audit Engine
 *
 * Scores a Google Business Profile across 13 audit modules, each weighted
 * by Google's Local SEO ranking algorithm. Receives full GBP data and returns
 * a comprehensive audit score (0-100) with detailed breakdown.
 *
 * Modules:
 *  1. Profile Completeness (15%)
 *  2. Category Optimization (10%)
 *  3. Attribute Coverage (8%)
 *  4. Service Optimization (10%)
 *  5. Product Listing (5%)
 *  6. Photo Coverage (8%)
 *  7. Hours Completeness (4%)
 *  8. Links & Social (5%)
 *  9. Review Volume & Velocity (8%)
 * 10. Review Response Rate (10%)
 * 11. Description Quality (8%)
 * 12. Keyword Coverage (7%)
 * 13. Posting Activity (2%)
 */
class ProfileAuditEngine {
  constructor() {
    // Azure OpenAI API configuration from environment variables
    this.azureEndpoint = process.env.AZURE_OPENAI_ENDPOINT || '';
    this.azureApiKey = process.env.AZURE_OPENAI_API_KEY || '';
    this.azureDeployment = process.env.AZURE_OPENAI_DEPLOYMENT || 'gpt-4o-mini-3';
    this.azureApiVersion = process.env.AZURE_OPENAI_API_VERSION || '2025-01-01-preview';
    this.openaiEndpoint = this.azureEndpoint
      ? `${this.azureEndpoint}/openai/deployments/${this.azureDeployment}/chat/completions?api-version=${this.azureApiVersion}`
      : '';

    // Module weights (must sum to 1.0)
    this.moduleWeights = {
      profileCompleteness: 0.15,
      categoryOptimization: 0.10,
      attributeCoverage: 0.08,
      serviceOptimization: 0.10,
      productListing: 0.05,
      photoCoverage: 0.08,
      hoursCompleteness: 0.04,
      linksAndSocial: 0.05,
      reviewVolume: 0.08,
      reviewResponseRate: 0.10,
      descriptionQuality: 0.08,
      keywordCoverage: 0.07,
      postingActivity: 0.02
    };

    // Comprehensive stop words list for keyword extraction
    this.stopWords = new Set([
      // Standard English stop words
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'as', 'is', 'was', 'are', 'were', 'been',
      'be', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
      'could', 'should', 'may', 'might', 'shall', 'can', 'need', 'dare',
      'ought', 'used', 'it', 'its', 'he', 'she', 'they', 'them', 'their',
      'his', 'her', 'my', 'your', 'our', 'we', 'you', 'i', 'me', 'us',
      'this', 'that', 'these', 'those', 'what', 'which', 'who', 'whom',
      'where', 'when', 'why', 'how', 'all', 'each', 'every', 'both',
      'few', 'more', 'most', 'other', 'some', 'such', 'no', 'nor', 'not',
      'only', 'own', 'same', 'so', 'than', 'too', 'very', 'just', 'if',
      'about', 'above', 'after', 'again', 'against', 'also', 'am', 'any',
      'because', 'before', 'below', 'between', 'during', 'into', 'out',
      'over', 'then', 'there', 'here', 'up', 'down', 'off', 'once',
      'further', 'through', 'under', 'until', 'while', 'being', 'having',
      'doing', 'did', 'does', 'doing', 'would', 'should', 'could',
      'get', 'got', 'getting', 'gets', 'go', 'going', 'goes', 'went',
      'gone', 'come', 'came', 'coming', 'make', 'made', 'making',
      'take', 'took', 'taking', 'give', 'gave', 'giving', 'see', 'saw',
      'seeing', 'know', 'knew', 'knowing', 'think', 'thought', 'thinking',
      'say', 'said', 'saying', 'tell', 'told', 'telling', 'ask', 'asked',
      'want', 'wanted', 'look', 'looked', 'looking', 'use', 'using',
      'find', 'found', 'finding', 'put', 'keep', 'kept', 'let', 'begin',
      'seem', 'seemed', 'help', 'show', 'showed', 'hear', 'heard',
      'play', 'run', 'ran', 'move', 'live', 'believe', 'bring', 'brought',
      'happen', 'write', 'wrote', 'provide', 'sit', 'stand', 'lose',
      'pay', 'meet', 'met', 'include', 'continue', 'set', 'learn',
      'change', 'lead', 'understand', 'watch', 'follow', 'stop', 'create',
      'speak', 'read', 'allow', 'add', 'spend', 'grow', 'open', 'walk',
      'win', 'offer', 'remember', 'love', 'consider', 'appear', 'buy',
      'wait', 'serve', 'die', 'send', 'expect', 'build', 'stay', 'fall',
      'cut', 'reach', 'kill', 'remain', 'like', 'really', 'even', 'back',
      'still', 'well', 'also', 'now', 'much', 'way', 'new', 'one', 'two',
      'first', 'last', 'long', 'little', 'own', 'old', 'right', 'big',
      'high', 'different', 'small', 'large', 'next', 'early', 'young',
      'important', 'few', 'public', 'bad', 'same', 'able', 'dont', 'didnt',
      'doesnt', 'wont', 'cant', 'wouldnt', 'couldnt', 'shouldnt', 'isnt',
      'arent', 'wasnt', 'werent', 'hasnt', 'havent', 'hadnt', 'im', 'ive',
      'youre', 'youve', 'hes', 'shes', 'its', 'weve', 'theyre', 'theyve',
      'ill', 'youll', 'hell', 'shell', 'well', 'theyll', 'thats', 'whats',
      'whos', 'lets',

      // Generic review words to exclude
      'good', 'great', 'nice', 'amazing', 'awesome', 'excellent', 'wonderful',
      'fantastic', 'terrible', 'horrible', 'awful', 'bad', 'worst', 'best',
      'better', 'worse', 'perfect', 'okay', 'ok', 'fine', 'decent', 'average',
      'outstanding', 'exceptional', 'superb', 'brilliant', 'magnificent',
      'incredible', 'phenomenal', 'remarkable', 'impressive', 'satisfactory',
      'mediocre', 'poor', 'disappointing', 'dreadful', 'atrocious',
      'love', 'loved', 'hate', 'hated', 'like', 'liked', 'enjoy', 'enjoyed',
      'recommend', 'recommended', 'recommends', 'definitely', 'absolutely',
      'totally', 'completely', 'highly', 'extremely', 'incredibly', 'really',
      'super', 'quite', 'pretty', 'rather', 'somewhat', 'always', 'never',
      'sometimes', 'often', 'usually', 'generally', 'ever', 'everything',
      'everyone', 'nothing', 'anything', 'someone', 'something',
      'place', 'time', 'thing', 'things', 'day', 'year', 'people', 'person',
      'lot', 'lots', 'bit', 'experience', 'experiences', 'visit', 'visited',
      'visiting', 'going', 'went', 'came', 'come', 'coming', 'back',
      'thanks', 'thank', 'please', 'sorry', 'sure', 'yes', 'yeah', 'nah',
      'star', 'stars', 'review', 'reviews', 'rating', 'ratings',
      'google', 'yelp', 'business', 'company', 'customer', 'customers',
      'client', 'clients', 'service', 'services', 'staff', 'team',
      'work', 'job', 'done', 'ever', 'since', 'ago', 'today', 'yesterday',
      'week', 'month', 'ago', 'recently', 'always', 'every', 'many',
      'much', 'very', 'been', 'being', 'away', 'area', 'around'
    ]);

    // CTA (Call to Action) patterns for detection
    this.ctaPatterns = [
      /call\s+(us|now|today)/i,
      /contact\s+(us|now|today)/i,
      /visit\s+(us|our|now|today)/i,
      /book\s+(now|today|an?\s+appointment|online)/i,
      /schedule\s+(now|today|an?\s+appointment|a\s+consultation)/i,
      /get\s+(in\s+touch|a\s+quote|started|your)/i,
      /reach\s+out/i,
      /stop\s+by/i,
      /come\s+(visit|see|in|by)/i,
      /free\s+(consultation|estimate|quote)/i,
      /learn\s+more/i,
      /find\s+out/i,
      /request\s+a/i,
      /order\s+(now|today|online)/i,
      /sign\s+up/i,
      /join\s+us/i,
      /give\s+us\s+a\s+call/i,
      /drop\s+by/i,
      /check\s+(us\s+)?out/i,
      /let\s+us\s+(know|help)/i
    ];

    // Spam patterns for description quality
    this.spamPatterns = [
      /#{3,}/,                           // Excessive hashtags
      /(.)\1{4,}/,                       // Repeated characters (5+)
      /\b(best|top|#1|number\s*one)\b.*\b(best|top|#1|number\s*one)\b/i, // Repeated superlatives
      /\b(call|click|visit)\b.*\b(call|click|visit)\b.*\b(call|click|visit)\b/i, // Excessive CTAs
      /[A-Z\s]{20,}/,                    // Excessive caps (20+ chars)
      /(.{10,})\1{2,}/,                  // Repeated long phrases
      /\$\$\$|\bfree\b.*\bfree\b.*\bfree\b/i, // Spammy money/free patterns
      /\b(guaranteed|100%|act\s+now|limited\s+time|don't\s+miss)\b/i // Clickbait
    ];

    console.log('[ProfileAuditEngine] Initialized with 13 audit modules');
    console.log(`[ProfileAuditEngine] Azure OpenAI endpoint: ${this.azureEndpoint ? 'configured' : 'not set'}`);
  }

  // =========================================================================
  // MAIN ENTRY POINT
  // =========================================================================

  /**
   * Run the full 13-module audit on a Google Business Profile.
   *
   * @param {Object} profileData
   * @param {Object} profileData.profile   - GBP profile info (name, address, phone, hours, etc.)
   * @param {Array}  profileData.services  - Services list
   * @param {Array}  profileData.products  - Products list
   * @param {Array}  profileData.reviews   - Reviews array
   * @param {Array}  profileData.posts     - Posts array
   * @param {Array}  profileData.photos    - Photos array
   * @param {Object} profileData.metrics   - Performance metrics
   * @returns {Object} Full audit result with overallScore, modules, keywords, recommendations
   */
  async runFullAudit(profileData) {
    console.log('[ProfileAuditEngine] Starting full 13-module audit...');
    const startTime = Date.now();

    const profile = profileData?.profile || {};
    const services = profileData?.services || [];
    const products = profileData?.products || [];
    const reviews = profileData?.reviews || [];
    const posts = profileData?.posts || [];
    const photos = profileData?.photos || [];
    const metrics = profileData?.metrics || {};

    // Step 1: Extract keywords from reviews (needed by modules 11 and 12)
    const extractedKeywords = this.extractKeywords(reviews);
    console.log(`[ProfileAuditEngine] Extracted ${extractedKeywords.length} keywords from ${reviews.length} reviews`);

    // Step 2: Run all 13 modules
    const modules = [
      {
        id: 'profileCompleteness',
        name: 'Profile Completeness',
        weight: this.moduleWeights.profileCompleteness,
        ...this.scoreProfileCompleteness(profile)
      },
      {
        id: 'categoryOptimization',
        name: 'Category Optimization',
        weight: this.moduleWeights.categoryOptimization,
        ...this.scoreCategoryOptimization(profile)
      },
      {
        id: 'attributeCoverage',
        name: 'Attribute Coverage',
        weight: this.moduleWeights.attributeCoverage,
        ...this.scoreAttributeCoverage(profile)
      },
      {
        id: 'serviceOptimization',
        name: 'Service Optimization',
        weight: this.moduleWeights.serviceOptimization,
        ...this.scoreServiceOptimization(services)
      },
      {
        id: 'productListing',
        name: 'Product Listing',
        weight: this.moduleWeights.productListing,
        ...this.scoreProductListing(products)
      },
      {
        id: 'photoCoverage',
        name: 'Photo Coverage',
        weight: this.moduleWeights.photoCoverage,
        ...this.scorePhotoCoverage(photos)
      },
      {
        id: 'hoursCompleteness',
        name: 'Hours Completeness',
        weight: this.moduleWeights.hoursCompleteness,
        ...this.scoreHoursCompleteness(profile)
      },
      {
        id: 'linksAndSocial',
        name: 'Links & Social',
        weight: this.moduleWeights.linksAndSocial,
        ...this.scoreLinksAndSocial(profile)
      },
      {
        id: 'reviewVolume',
        name: 'Review Volume & Velocity',
        weight: this.moduleWeights.reviewVolume,
        ...this.scoreReviewVolume(reviews)
      },
      {
        id: 'reviewResponseRate',
        name: 'Review Response Rate',
        weight: this.moduleWeights.reviewResponseRate,
        ...this.scoreReviewResponseRate(reviews)
      },
      {
        id: 'descriptionQuality',
        name: 'Description Quality',
        weight: this.moduleWeights.descriptionQuality,
        ...this.scoreDescriptionQuality(profile, extractedKeywords)
      },
      {
        id: 'keywordCoverage',
        name: 'Keyword Coverage',
        weight: this.moduleWeights.keywordCoverage,
        ...this.scoreKeywordCoverage(profile, services, products, extractedKeywords)
      },
      {
        id: 'postingActivity',
        name: 'Posting Activity',
        weight: this.moduleWeights.postingActivity,
        ...this.scorePostingActivity(posts)
      }
    ];

    // Step 3: Calculate overall score
    let overallScore = 0;
    for (const mod of modules) {
      overallScore += mod.score * mod.weight;
    }
    overallScore = Math.round(overallScore * 100) / 100;

    // Step 4: Determine grade
    const grade = this._getGrade(overallScore);

    // Step 5: Detect keyword gaps
    const keywordGaps = this.detectKeywordGaps(extractedKeywords, profile, services, products);

    // Step 6: Collect all recommendations across modules
    const allRecommendations = [];
    for (const mod of modules) {
      if (mod.recommendations && mod.recommendations.length > 0) {
        for (const rec of mod.recommendations) {
          allRecommendations.push({
            module: mod.name,
            moduleId: mod.id,
            priority: mod.score < 40 ? 'high' : mod.score < 70 ? 'medium' : 'low',
            recommendation: rec
          });
        }
      }
    }

    // Sort recommendations: high priority first
    const priorityOrder = { high: 0, medium: 1, low: 2 };
    allRecommendations.sort((a, b) => priorityOrder[a.priority] - priorityOrder[b.priority]);

    const elapsed = Date.now() - startTime;
    console.log(`[ProfileAuditEngine] Audit complete: score=${overallScore}, grade=${grade.label} (${elapsed}ms)`);

    return {
      overallScore,
      grade,
      modules,
      keywords: {
        extracted: extractedKeywords,
        gaps: keywordGaps
      },
      recommendations: allRecommendations,
      meta: {
        auditedAt: new Date().toISOString(),
        elapsedMs: elapsed,
        reviewsAnalyzed: reviews.length,
        modulesRun: modules.length
      }
    };
  }

  // =========================================================================
  // MODULE 1: Profile Completeness (Weight: 15%)
  // =========================================================================

  scoreProfileCompleteness(profile) {
    const maxPoints = 70; // Sum of all point allocations below
    let points = 0;
    const details = {};
    const recommendations = [];

    // Description: 15pts if present AND 250+ chars
    const description = profile?.description || profile?.profile?.description || '';
    if (description && description.length >= 250) {
      points += 15;
      details.description = { earned: 15, max: 15, status: 'complete' };
    } else if (description && description.length > 0) {
      points += 5; // Partial credit for having one, but too short
      details.description = { earned: 5, max: 15, status: 'too_short', length: description.length };
      recommendations.push(`Expand your business description to at least 250 characters (currently ${description.length}). A detailed description helps Google understand your business and improves local SEO.`);
    } else {
      details.description = { earned: 0, max: 15, status: 'missing' };
      recommendations.push('Add a business description of at least 250 characters. This is one of the most important fields for local search ranking.');
    }

    // Phone: 5pts
    const phone = profile?.phoneNumbers?.primaryPhone || profile?.phone || profile?.phoneNumber || '';
    if (phone) {
      points += 5;
      details.phone = { earned: 5, max: 5, status: 'present' };
    } else {
      details.phone = { earned: 0, max: 5, status: 'missing' };
      recommendations.push('Add a primary phone number to your profile. Customers need a way to contact you directly.');
    }

    // Website: 5pts
    const website = profile?.websiteUri || profile?.website || profile?.websiteUrl || '';
    if (website) {
      points += 5;
      details.website = { earned: 5, max: 5, status: 'present' };
    } else {
      details.website = { earned: 0, max: 5, status: 'missing' };
      recommendations.push('Add your website URL. A website link drives traffic and improves trust signals for Google.');
    }

    // Address: 10pts
    const address = profile?.storefrontAddress || profile?.address || profile?.addressLines || null;
    const hasAddress = address && (
      (typeof address === 'string' && address.trim().length > 0) ||
      (typeof address === 'object' && (address.addressLines?.length > 0 || address.locality || address.formattedAddress))
    );
    if (hasAddress) {
      points += 10;
      details.address = { earned: 10, max: 10, status: 'present' };
    } else {
      details.address = { earned: 0, max: 10, status: 'missing' };
      recommendations.push('Add a complete business address. Physical location is a critical local SEO ranking factor.');
    }

    // Regular hours: 10pts
    const regularHours = profile?.regularHours?.periods || profile?.hours || profile?.openingHours || [];
    const hasRegularHours = Array.isArray(regularHours) && regularHours.length > 0;
    if (hasRegularHours) {
      points += 10;
      details.regularHours = { earned: 10, max: 10, status: 'present', daysSet: regularHours.length };
    } else {
      details.regularHours = { earned: 0, max: 10, status: 'missing' };
      recommendations.push('Set your regular business hours. Customers check hours before visiting, and Google favors profiles with complete hours.');
    }

    // Special hours: 5pts (at least 3 holidays)
    const specialHours = profile?.specialHours?.specialHourPeriods || profile?.specialHours || [];
    const specialHoursCount = Array.isArray(specialHours) ? specialHours.length : 0;
    if (specialHoursCount >= 3) {
      points += 5;
      details.specialHours = { earned: 5, max: 5, status: 'complete', count: specialHoursCount };
    } else if (specialHoursCount > 0) {
      points += 2;
      details.specialHours = { earned: 2, max: 5, status: 'partial', count: specialHoursCount };
      recommendations.push(`Add special hours for more holidays (currently ${specialHoursCount}, need at least 3). This prevents customer frustration and shows Google your profile is actively managed.`);
    } else {
      details.specialHours = { earned: 0, max: 5, status: 'missing' };
      recommendations.push('Add special hours for at least 3 major holidays (e.g., Christmas, Thanksgiving, New Year). This signals an actively maintained profile.');
    }

    // Opening date: 5pts
    const openDate = profile?.openInfo?.openingDate || profile?.openingDate || profile?.openDate || null;
    if (openDate) {
      points += 5;
      details.openingDate = { earned: 5, max: 5, status: 'present' };
    } else {
      details.openingDate = { earned: 0, max: 5, status: 'missing' };
      recommendations.push('Add your business opening date. This helps Google understand your business history and longevity.');
    }

    // Booking link: 5pts
    const bookingLink = profile?.bookingLink || profile?.appointmentLink || profile?.reservationUrl || '';
    if (bookingLink) {
      points += 5;
      details.bookingLink = { earned: 5, max: 5, status: 'present' };
    } else {
      details.bookingLink = { earned: 0, max: 5, status: 'missing' };
      recommendations.push('Add a booking/appointment link. This enables direct conversions from your Google profile.');
    }

    // Social media: 5pts (at least 2 profiles linked)
    const socialMedia = this._extractSocialLinks(profile);
    if (socialMedia.length >= 2) {
      points += 5;
      details.socialMedia = { earned: 5, max: 5, status: 'complete', count: socialMedia.length, platforms: socialMedia };
    } else if (socialMedia.length === 1) {
      points += 2;
      details.socialMedia = { earned: 2, max: 5, status: 'partial', count: 1, platforms: socialMedia };
      recommendations.push('Link at least 2 social media profiles to your GBP. Cross-platform presence strengthens your online authority.');
    } else {
      details.socialMedia = { earned: 0, max: 5, status: 'missing' };
      recommendations.push('Add social media links (at least 2). Linked social profiles boost credibility and provide additional engagement channels.');
    }

    // Menu link: 5pts (restaurant only - check primary category)
    const primaryCategory = (profile?.categories?.primaryCategory?.displayName || profile?.primaryCategory || '').toLowerCase();
    const isRestaurant = primaryCategory.includes('restaurant') || primaryCategory.includes('cafe') ||
      primaryCategory.includes('bakery') || primaryCategory.includes('bar') ||
      primaryCategory.includes('food') || primaryCategory.includes('pizza') ||
      primaryCategory.includes('diner') || primaryCategory.includes('bistro') ||
      primaryCategory.includes('grill') || primaryCategory.includes('eatery');

    if (isRestaurant) {
      const menuLink = profile?.menuLink || profile?.menuUrl || profile?.foodMenuUrl || '';
      if (menuLink) {
        points += 5;
        details.menuLink = { earned: 5, max: 5, status: 'present', applicable: true };
      } else {
        details.menuLink = { earned: 0, max: 5, status: 'missing', applicable: true };
        recommendations.push('Add a menu link to your restaurant profile. Customers frequently look for menus before deciding where to eat.');
      }
    } else {
      // Not a restaurant - menu link is N/A, don't penalize
      details.menuLink = { earned: 0, max: 0, status: 'not_applicable', applicable: false };
    }

    // Adjust maxPoints if menu link is not applicable
    const adjustedMax = isRestaurant ? maxPoints : maxPoints - 5;
    const score = adjustedMax > 0 ? Math.round((points / adjustedMax) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.profileCompleteness,
      points,
      maxPoints: adjustedMax,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 2: Category Optimization (Weight: 10%)
  // =========================================================================

  scoreCategoryOptimization(profile) {
    const maxPoints = 90;
    let points = 0;
    const details = {};
    const recommendations = [];

    // Primary category set: 30pts
    const primaryCategory = profile?.categories?.primaryCategory?.displayName ||
      profile?.primaryCategory || profile?.category || '';
    if (primaryCategory) {
      points += 30;
      details.primaryCategory = { earned: 30, max: 30, status: 'set', value: primaryCategory };
    } else {
      details.primaryCategory = { earned: 0, max: 30, status: 'missing' };
      recommendations.push('Set a primary business category. This is the single most important factor for Google to understand what your business does.');
    }

    // Secondary categories count: 1-2 (10pts), 3-5 (30pts), 6-9 (40pts)
    const additionalCategories = profile?.categories?.additionalCategories ||
      profile?.additionalCategories || profile?.secondaryCategories || [];
    const secondaryCount = Array.isArray(additionalCategories) ? additionalCategories.length : 0;

    if (secondaryCount >= 6) {
      points += 40;
      details.secondaryCategories = { earned: 40, max: 40, status: 'excellent', count: secondaryCount };
    } else if (secondaryCount >= 3) {
      points += 30;
      details.secondaryCategories = { earned: 30, max: 40, status: 'good', count: secondaryCount };
      recommendations.push(`Add more secondary categories (currently ${secondaryCount}). Aim for 6-9 relevant categories to maximize visibility across different search queries.`);
    } else if (secondaryCount >= 1) {
      points += 10;
      details.secondaryCategories = { earned: 10, max: 40, status: 'partial', count: secondaryCount };
      recommendations.push(`You only have ${secondaryCount} secondary categor${secondaryCount === 1 ? 'y' : 'ies'}. Add at least 3-5 more relevant secondary categories to appear in more local search results.`);
    } else {
      details.secondaryCategories = { earned: 0, max: 40, status: 'missing', count: 0 };
      recommendations.push('Add secondary categories to your profile. Businesses with 6+ relevant categories appear in significantly more search results.');
    }

    // Category relevance to services: 20pts
    // We check if the primary category broadly aligns with the business name or description
    const businessName = (profile?.title || profile?.name || profile?.businessName || '').toLowerCase();
    const descriptionText = (profile?.description || profile?.profile?.description || '').toLowerCase();
    const primaryLower = primaryCategory.toLowerCase();

    let relevanceScore = 0;
    if (primaryCategory) {
      // Check if category words appear in business name or description
      const categoryWords = primaryLower.split(/\s+/).filter(w => w.length > 3);
      const combinedText = `${businessName} ${descriptionText}`;
      let matchCount = 0;
      for (const word of categoryWords) {
        if (combinedText.includes(word)) {
          matchCount++;
        }
      }
      if (categoryWords.length > 0) {
        relevanceScore = Math.min((matchCount / categoryWords.length) * 20, 20);
      } else {
        relevanceScore = 10; // Give partial credit if category is set but we can't parse words
      }
    }
    points += Math.round(relevanceScore);
    details.categoryRelevance = { earned: Math.round(relevanceScore), max: 20, status: relevanceScore >= 15 ? 'good' : 'needs_improvement' };
    if (relevanceScore < 15 && primaryCategory) {
      recommendations.push('Ensure your primary category closely matches the services described in your business description. Category-description alignment improves relevance signals.');
    }

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.categoryOptimization,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 3: Attribute Coverage (Weight: 8%)
  // =========================================================================

  scoreAttributeCoverage(profile) {
    const details = {};
    const recommendations = [];

    const attributes = profile?.attributes || profile?.profileAttributes || [];
    const totalAvailable = profile?.totalAvailableAttributes || profile?.availableAttributeCount || 0;

    const setAttributes = Array.isArray(attributes) ? attributes.length : 0;

    let score = 0;
    if (totalAvailable > 0) {
      score = Math.round((setAttributes / totalAvailable) * 100);
    } else if (setAttributes > 0) {
      // If we don't know the total, estimate based on common attribute counts (typically 15-30)
      const estimatedTotal = 20;
      score = Math.min(Math.round((setAttributes / estimatedTotal) * 100), 100);
    } else {
      score = 0;
    }

    details.setAttributes = setAttributes;
    details.totalAvailable = totalAvailable || 'unknown';
    details.coveragePercent = score;

    if (score < 50) {
      recommendations.push('Fill in more business attributes (amenities, accessibility, payment methods, etc.). Attributes help Google match your business to specific customer queries.');
    } else if (score < 80) {
      recommendations.push('You have good attribute coverage but completing the remaining attributes can give you an edge over competitors in local search.');
    }

    if (setAttributes === 0) {
      recommendations.push('No business attributes are set. Add attributes like Wi-Fi availability, parking, payment methods, accessibility options, and other relevant amenities.');
    }

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.attributeCoverage,
      points: setAttributes,
      maxPoints: totalAvailable || 'unknown',
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 4: Service Optimization (Weight: 10%)
  // =========================================================================

  scoreServiceOptimization(services) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    const serviceList = Array.isArray(services) ? services : [];
    const serviceCount = serviceList.length;

    // At least 5 services: 30pts
    if (serviceCount >= 5) {
      points += 30;
      details.serviceCount = { earned: 30, max: 30, status: 'good', count: serviceCount };
    } else if (serviceCount > 0) {
      const partial = Math.round((serviceCount / 5) * 30);
      points += partial;
      details.serviceCount = { earned: partial, max: 30, status: 'partial', count: serviceCount };
      recommendations.push(`Add more services (currently ${serviceCount}, need at least 5). Each service is a potential keyword match for local searches.`);
    } else {
      details.serviceCount = { earned: 0, max: 30, status: 'missing', count: 0 };
      recommendations.push('Add at least 5 services to your profile. Services are indexed by Google and help match your business to relevant search queries.');
    }

    // All have descriptions: 30pts
    if (serviceCount > 0) {
      const withDescriptions = serviceList.filter(s =>
        (s.description || s.serviceDescription || '').trim().length > 0
      ).length;
      const descriptionRate = withDescriptions / serviceCount;

      if (descriptionRate >= 1) {
        points += 30;
        details.descriptions = { earned: 30, max: 30, status: 'complete', rate: '100%' };
      } else {
        const partial = Math.round(descriptionRate * 30);
        points += partial;
        details.descriptions = { earned: partial, max: 30, status: 'incomplete', rate: `${Math.round(descriptionRate * 100)}%`, withDescriptions, total: serviceCount };
        recommendations.push(`Add descriptions to all services (${withDescriptions}/${serviceCount} have descriptions). Descriptions provide keyword-rich content for Google indexing.`);
      }

      // Descriptions 100+ chars: 20pts
      const longDescriptions = serviceList.filter(s => {
        const desc = (s.description || s.serviceDescription || '').trim();
        return desc.length >= 100;
      }).length;
      const longRate = longDescriptions / serviceCount;

      if (longRate >= 1) {
        points += 20;
        details.descriptionLength = { earned: 20, max: 20, status: 'complete' };
      } else {
        const partial = Math.round(longRate * 20);
        points += partial;
        details.descriptionLength = { earned: partial, max: 20, status: 'partial', longDescriptions, total: serviceCount };
        if (longDescriptions < serviceCount) {
          recommendations.push(`Expand service descriptions to at least 100 characters each (${longDescriptions}/${serviceCount} meet this). Longer descriptions with relevant keywords improve search visibility.`);
        }
      }

      // Descriptions contain keywords: 20pts
      // We check if descriptions mention the service name or related terms
      const withKeywordContent = serviceList.filter(s => {
        const desc = (s.description || s.serviceDescription || '').toLowerCase();
        const name = (s.displayName || s.serviceName || s.name || '').toLowerCase();
        if (!desc || !name) return false;
        const nameWords = name.split(/\s+/).filter(w => w.length > 3);
        return nameWords.some(word => desc.includes(word));
      }).length;
      const keywordRate = serviceCount > 0 ? withKeywordContent / serviceCount : 0;

      if (keywordRate >= 0.8) {
        points += 20;
        details.keywordUsage = { earned: 20, max: 20, status: 'good' };
      } else {
        const partial = Math.round(keywordRate * 20);
        points += partial;
        details.keywordUsage = { earned: partial, max: 20, status: 'needs_improvement', rate: `${Math.round(keywordRate * 100)}%` };
        recommendations.push('Include relevant keywords naturally in your service descriptions. Use terms your customers actually search for.');
      }
    } else {
      details.descriptions = { earned: 0, max: 30, status: 'no_services' };
      details.descriptionLength = { earned: 0, max: 20, status: 'no_services' };
      details.keywordUsage = { earned: 0, max: 20, status: 'no_services' };
    }

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.serviceOptimization,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 5: Product Listing (Weight: 5%)
  // =========================================================================

  scoreProductListing(products) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    const productList = Array.isArray(products) ? products : [];
    const productCount = productList.length;

    // Products listed: 30pts (at least 1 required, more is better)
    if (productCount >= 3) {
      points += 30;
      details.productCount = { earned: 30, max: 30, status: 'good', count: productCount };
    } else if (productCount > 0) {
      points += 20; // Having at least 1 product gets most of the credit
      details.productCount = { earned: 20, max: 30, status: 'partial', count: productCount };
      recommendations.push(`Consider adding more products (currently ${productCount}). More products increase your visibility in search results.`);
    } else {
      details.productCount = { earned: 0, max: 30, status: 'missing', count: 0 };
      recommendations.push('Add at least 1 product to your Google Business Profile. Products display prominently in search results and attract customers.');
    }

    if (productCount > 0) {
      // All have descriptions: 25pts
      const withDescriptions = productList.filter(p =>
        (p.description || p.productDescription || '').trim().length > 0
      ).length;
      const descRate = withDescriptions / productCount;
      if (descRate >= 1) {
        points += 25;
        details.descriptions = { earned: 25, max: 25, status: 'complete' };
      } else {
        const partial = Math.round(descRate * 25);
        points += partial;
        details.descriptions = { earned: partial, max: 25, status: 'incomplete', rate: `${Math.round(descRate * 100)}%` };
        recommendations.push(`Add descriptions to all products (${withDescriptions}/${productCount} have descriptions). Product descriptions improve click-through rates.`);
      }

      // All have images: 25pts
      const withImages = productList.filter(p =>
        p.media?.length > 0 || p.image || p.imageUrl || p.photoUri
      ).length;
      const imageRate = withImages / productCount;
      if (imageRate >= 1) {
        points += 25;
        details.images = { earned: 25, max: 25, status: 'complete' };
      } else {
        const partial = Math.round(imageRate * 25);
        points += partial;
        details.images = { earned: partial, max: 25, status: 'incomplete', rate: `${Math.round(imageRate * 100)}%` };
        recommendations.push(`Add images to all products (${withImages}/${productCount} have images). Products with images receive significantly more engagement.`);
      }

      // Have prices: 10pts
      const withPrices = productList.filter(p =>
        p.price || p.priceRange || p.productPrice || (p.price && p.price.currencyCode)
      ).length;
      const priceRate = withPrices / productCount;
      if (priceRate >= 0.8) {
        points += 10;
        details.prices = { earned: 10, max: 10, status: 'good' };
      } else {
        const partial = Math.round(priceRate * 10);
        points += partial;
        details.prices = { earned: partial, max: 10, status: 'partial', rate: `${Math.round(priceRate * 100)}%` };
        recommendations.push('Add prices to your products. Pricing transparency helps customers make faster purchasing decisions.');
      }

      // Have categories: 10pts
      const withCategories = productList.filter(p =>
        p.category || p.productCategory || p.categoryName
      ).length;
      const catRate = withCategories / productCount;
      if (catRate >= 0.8) {
        points += 10;
        details.categories = { earned: 10, max: 10, status: 'good' };
      } else {
        const partial = Math.round(catRate * 10);
        points += partial;
        details.categories = { earned: partial, max: 10, status: 'partial', rate: `${Math.round(catRate * 100)}%` };
        recommendations.push('Categorize your products. Organized products are easier for customers to browse and improve your profile structure.');
      }
    } else {
      details.descriptions = { earned: 0, max: 25, status: 'no_products' };
      details.images = { earned: 0, max: 25, status: 'no_products' };
      details.prices = { earned: 0, max: 10, status: 'no_products' };
      details.categories = { earned: 0, max: 10, status: 'no_products' };
    }

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.productListing,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 6: Photo Coverage (Weight: 8%)
  // =========================================================================

  scorePhotoCoverage(photos) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    const photoList = Array.isArray(photos) ? photos : [];

    // Categorize photos by type
    const photosByType = {
      logo: [],
      cover: [],
      exterior: [],
      interior: [],
      team: [],
      atWork: [],
      product: [],
      other: []
    };

    // Debug: log first photo to see actual GBP API format
    if (photoList.length > 0) {
      console.log(`[PhotoCoverage] Sample photo keys: ${JSON.stringify(Object.keys(photoList[0]))}`);
      console.log(`[PhotoCoverage] Sample photo category: ${photoList[0].locationAssociation?.category || 'none'}, mediaFormat: ${photoList[0].mediaFormat || 'none'}`);
    }

    for (const photo of photoList) {
      // GBP API v4: category is in locationAssociation.category - check this FIRST before mediaFormat
      const category = (photo.locationAssociation?.category || photo.category || photo.type || '').toUpperCase();
      const label = (photo.label || photo.description || photo.name || '').toLowerCase();

      if (category === 'LOGO' || category === 'PROFILE' || label.includes('logo')) {
        photosByType.logo.push(photo);
      } else if (category === 'COVER' || category === 'HERO' || label.includes('cover')) {
        photosByType.cover.push(photo);
      } else if (category === 'EXTERIOR' || label.includes('exterior') || label.includes('outside') || label.includes('storefront')) {
        photosByType.exterior.push(photo);
      } else if (category === 'INTERIOR' || label.includes('interior') || label.includes('inside')) {
        photosByType.interior.push(photo);
      } else if (category === 'TEAM' || category === 'TEAMS' || label.includes('team') || label.includes('staff') || label.includes('employee')) {
        photosByType.team.push(photo);
      } else if (category === 'AT_WORK' || category === 'ATWORK' || category === 'AT WORK' || label.includes('at work') || label.includes('action')) {
        photosByType.atWork.push(photo);
      } else if (category === 'PRODUCT' || category === 'FOOD_AND_DRINK' || category === 'MENU' || label.includes('product') || label.includes('food')) {
        photosByType.product.push(photo);
      } else {
        photosByType.other.push(photo);
      }
    }

    console.log(`[PhotoCoverage] Breakdown: logo=${photosByType.logo.length}, cover=${photosByType.cover.length}, exterior=${photosByType.exterior.length}, interior=${photosByType.interior.length}, team=${photosByType.team.length}, atWork=${photosByType.atWork.length}, product=${photosByType.product.length}, other=${photosByType.other.length}`);

    // Logo: 15pts (need 1)
    if (photosByType.logo.length >= 1) {
      points += 15;
      details.logo = { earned: 15, max: 15, count: photosByType.logo.length, status: 'present' };
    } else {
      details.logo = { earned: 0, max: 15, count: 0, status: 'missing' };
      recommendations.push('Upload a logo image. Your logo appears across Google Search and Maps, building brand recognition.');
    }

    // Cover: 10pts (need 1)
    if (photosByType.cover.length >= 1) {
      points += 10;
      details.cover = { earned: 10, max: 10, count: photosByType.cover.length, status: 'present' };
    } else {
      details.cover = { earned: 0, max: 10, count: 0, status: 'missing' };
      recommendations.push('Upload a cover photo. The cover photo is the first thing customers see when they find your business on Google.');
    }

    // Exterior: 15pts (need 3+)
    if (photosByType.exterior.length >= 3) {
      points += 15;
      details.exterior = { earned: 15, max: 15, count: photosByType.exterior.length, status: 'complete' };
    } else if (photosByType.exterior.length > 0) {
      const partial = Math.round((photosByType.exterior.length / 3) * 15);
      points += partial;
      details.exterior = { earned: partial, max: 15, count: photosByType.exterior.length, status: 'partial' };
      recommendations.push(`Add more exterior photos (currently ${photosByType.exterior.length}, need 3+). Exterior photos help customers recognize your location when arriving.`);
    } else {
      details.exterior = { earned: 0, max: 15, count: 0, status: 'missing' };
      recommendations.push('Add at least 3 exterior photos showing your storefront from different angles. Helps customers find your location.');
    }

    // Interior: 15pts (need 3+)
    if (photosByType.interior.length >= 3) {
      points += 15;
      details.interior = { earned: 15, max: 15, count: photosByType.interior.length, status: 'complete' };
    } else if (photosByType.interior.length > 0) {
      const partial = Math.round((photosByType.interior.length / 3) * 15);
      points += partial;
      details.interior = { earned: partial, max: 15, count: photosByType.interior.length, status: 'partial' };
      recommendations.push(`Add more interior photos (currently ${photosByType.interior.length}, need 3+). Interior photos set customer expectations about ambiance.`);
    } else {
      details.interior = { earned: 0, max: 15, count: 0, status: 'missing' };
      recommendations.push('Add at least 3 interior photos showing your business space. Customers are more likely to visit when they can preview the environment.');
    }

    // Team: 15pts (need 3+)
    if (photosByType.team.length >= 3) {
      points += 15;
      details.team = { earned: 15, max: 15, count: photosByType.team.length, status: 'complete' };
    } else if (photosByType.team.length > 0) {
      const partial = Math.round((photosByType.team.length / 3) * 15);
      points += partial;
      details.team = { earned: partial, max: 15, count: photosByType.team.length, status: 'partial' };
      recommendations.push(`Add more team photos (currently ${photosByType.team.length}, need 3+). Team photos build trust and humanize your business.`);
    } else {
      details.team = { earned: 0, max: 15, count: 0, status: 'missing' };
      recommendations.push('Add at least 3 team photos. Businesses with team photos receive more engagement and build stronger customer trust.');
    }

    // At-work: 15pts (need 3+)
    if (photosByType.atWork.length >= 3) {
      points += 15;
      details.atWork = { earned: 15, max: 15, count: photosByType.atWork.length, status: 'complete' };
    } else if (photosByType.atWork.length > 0) {
      const partial = Math.round((photosByType.atWork.length / 3) * 15);
      points += partial;
      details.atWork = { earned: partial, max: 15, count: photosByType.atWork.length, status: 'partial' };
      recommendations.push(`Add more "at work" photos (currently ${photosByType.atWork.length}, need 3+). Action shots showcase your expertise and services in practice.`);
    } else {
      details.atWork = { earned: 0, max: 15, count: 0, status: 'missing' };
      recommendations.push('Add at least 3 "at work" photos showing your team performing services. These photos demonstrate your expertise in action.');
    }

    // Product photos: 15pts (need 3+)
    if (photosByType.product.length >= 3) {
      points += 15;
      details.product = { earned: 15, max: 15, count: photosByType.product.length, status: 'complete' };
    } else if (photosByType.product.length > 0) {
      const partial = Math.round((photosByType.product.length / 3) * 15);
      points += partial;
      details.product = { earned: partial, max: 15, count: photosByType.product.length, status: 'partial' };
      recommendations.push(`Add more product photos (currently ${photosByType.product.length}, need 3+). Product photos drive purchasing decisions.`);
    } else {
      details.product = { earned: 0, max: 15, count: 0, status: 'missing' };
      recommendations.push('Add at least 3 product or service photos. Visual representation of your offerings significantly improves conversion rates.');
    }

    // Give base credit for total photo volume (even if categories aren't detected)
    // Photos without specific categories still contribute to profile quality
    const totalPhotos = photoList.length;
    const categorizedCount = totalPhotos - photosByType.other.length;
    if (categorizedCount === 0 && totalPhotos > 0) {
      // GBP API returned photos but none had categories - distribute "other" photos as general credit
      // Give up to 50 points for having 10+ uncategorized photos
      const volumeCredit = Math.min(Math.round((totalPhotos / 10) * 50), 50);
      points += volumeCredit;
      if (totalPhotos < 10) {
        recommendations.push(`You have ${totalPhotos} photos but they aren't categorized. Upload photos with specific types (exterior, interior, team, at-work) for better SEO impact.`);
      }
    }

    details.totalPhotos = totalPhotos;
    details.breakdown = {
      logo: photosByType.logo.length,
      cover: photosByType.cover.length,
      exterior: photosByType.exterior.length,
      interior: photosByType.interior.length,
      team: photosByType.team.length,
      atWork: photosByType.atWork.length,
      product: photosByType.product.length,
      other: photosByType.other.length
    };

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.photoCoverage,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 7: Hours Completeness (Weight: 4%)
  // =========================================================================

  scoreHoursCompleteness(profile) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    // Regular hours all 7 days: 40pts
    const regularHours = profile?.regularHours?.periods || profile?.hours || profile?.openingHours || [];
    const daysSet = new Set();
    if (Array.isArray(regularHours)) {
      for (const period of regularHours) {
        const day = period.openDay || period.day || period.dayOfWeek || '';
        if (day) {
          daysSet.add(day.toUpperCase());
        }
      }
    }

    const daysWithHours = daysSet.size;
    if (daysWithHours >= 7) {
      points += 40;
      details.regularHours = { earned: 40, max: 40, status: 'complete', daysSet: daysWithHours };
    } else if (daysWithHours > 0) {
      const partial = Math.round((daysWithHours / 7) * 40);
      points += partial;
      details.regularHours = { earned: partial, max: 40, status: 'partial', daysSet: daysWithHours };
      recommendations.push(`Set hours for all 7 days of the week (currently ${daysWithHours}/7). Even if closed on a day, specify "Closed" so customers know.`);
    } else {
      details.regularHours = { earned: 0, max: 40, status: 'missing', daysSet: 0 };
      recommendations.push('Set regular business hours for all 7 days. Hours are one of the most critical pieces of information for local customers.');
    }

    // Special hours for 3 holidays: 30pts
    const specialHours = profile?.specialHours?.specialHourPeriods || profile?.specialHours || [];
    const specialCount = Array.isArray(specialHours) ? specialHours.length : 0;

    if (specialCount >= 3) {
      points += 30;
      details.specialHours = { earned: 30, max: 30, status: 'complete', count: specialCount };
    } else if (specialCount > 0) {
      const partial = Math.round((specialCount / 3) * 30);
      points += partial;
      details.specialHours = { earned: partial, max: 30, status: 'partial', count: specialCount };
      recommendations.push(`Add special hours for more holidays (currently ${specialCount}, need 3+). Prevents frustrated customers showing up when you are closed.`);
    } else {
      details.specialHours = { earned: 0, max: 30, status: 'missing', count: 0 };
      recommendations.push('Add special hours for major holidays (Christmas, New Year, Thanksgiving, etc.). This prevents negative experiences and shows active profile management.');
    }

    // More hours (if applicable): 30pts
    // "More hours" include things like delivery hours, drive-through hours, senior hours, etc.
    const moreHours = profile?.moreHours || profile?.additionalHours || profile?.moreHoursTypes || [];
    const hasMoreHours = Array.isArray(moreHours) ? moreHours.length > 0 : !!moreHours;

    if (hasMoreHours) {
      points += 30;
      details.moreHours = { earned: 30, max: 30, status: 'present' };
    } else {
      // Only recommend if the business type typically has more hours
      const primaryCategory = (profile?.categories?.primaryCategory?.displayName || profile?.primaryCategory || '').toLowerCase();
      const typicallyHasMoreHours = primaryCategory.includes('restaurant') || primaryCategory.includes('store') ||
        primaryCategory.includes('pharmacy') || primaryCategory.includes('bank') ||
        primaryCategory.includes('hospital') || primaryCategory.includes('clinic') ||
        primaryCategory.includes('gym') || primaryCategory.includes('fitness');

      if (typicallyHasMoreHours) {
        details.moreHours = { earned: 0, max: 30, status: 'missing', applicable: true };
        recommendations.push('Add "More hours" for specific services (delivery hours, drive-through hours, happy hours, etc.) if applicable to your business type.');
      } else {
        // Give partial credit if not typically applicable
        points += 15;
        details.moreHours = { earned: 15, max: 30, status: 'not_typically_applicable', applicable: false };
      }
    }

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.hoursCompleteness,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 8: Links & Social (Weight: 5%)
  // =========================================================================

  scoreLinksAndSocial(profile) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    // Website: 25pts
    const website = profile?.websiteUri || profile?.website || profile?.websiteUrl || '';
    if (website) {
      points += 25;
      details.website = { earned: 25, max: 25, status: 'present', url: website };
    } else {
      details.website = { earned: 0, max: 25, status: 'missing' };
      recommendations.push('Add your website URL. This is the primary traffic driver from your Google Business Profile to your website.');
    }

    // Booking link: 25pts
    const bookingLink = profile?.bookingLink || profile?.appointmentLink || profile?.reservationUrl || '';
    if (bookingLink) {
      points += 25;
      details.bookingLink = { earned: 25, max: 25, status: 'present', url: bookingLink };
    } else {
      details.bookingLink = { earned: 0, max: 25, status: 'missing' };
      recommendations.push('Add a booking or appointment link. Direct booking links can increase conversion rates by 25% or more.');
    }

    // Social media: 2+ (25pts), 4+ (additional 25pts)
    const socialLinks = this._extractSocialLinks(profile);
    const socialCount = socialLinks.length;

    if (socialCount >= 4) {
      points += 50; // Both tiers
      details.socialMedia = { earned: 50, max: 50, status: 'excellent', count: socialCount, platforms: socialLinks };
    } else if (socialCount >= 2) {
      points += 25;
      details.socialMedia = { earned: 25, max: 50, status: 'good', count: socialCount, platforms: socialLinks };
      recommendations.push(`Add more social media links (currently ${socialCount}, aim for 4+). More platforms mean more signals of business legitimacy to Google.`);
    } else if (socialCount === 1) {
      points += 10;
      details.socialMedia = { earned: 10, max: 50, status: 'minimal', count: 1, platforms: socialLinks };
      recommendations.push('Add at least 2 social media profile links (Facebook, Instagram, LinkedIn, Twitter/X, YouTube). Social signals boost local SEO credibility.');
    } else {
      details.socialMedia = { earned: 0, max: 50, status: 'missing', count: 0 };
      recommendations.push('Add social media links to your profile. Linking 4+ social platforms (Facebook, Instagram, LinkedIn, Twitter/X) significantly strengthens online authority.');
    }

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.linksAndSocial,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 9: Review Volume & Velocity (Weight: 8%)
  // =========================================================================

  scoreReviewVolume(reviews) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    const reviewList = Array.isArray(reviews) ? reviews : [];
    const totalReviews = reviewList.length;

    // 10+ reviews: 20pts
    if (totalReviews >= 10) {
      points += 20;
      details.volume10 = { earned: 20, max: 20, status: 'achieved' };
    } else {
      const partial = Math.round((totalReviews / 10) * 20);
      points += partial;
      details.volume10 = { earned: partial, max: 20, status: 'below_threshold', count: totalReviews };
      recommendations.push(`Get more reviews (currently ${totalReviews}, need 10+). Ask satisfied customers to leave a Google review after each interaction.`);
    }

    // 25+ reviews: 20pts
    if (totalReviews >= 25) {
      points += 20;
      details.volume25 = { earned: 20, max: 20, status: 'achieved' };
    } else if (totalReviews >= 10) {
      details.volume25 = { earned: 0, max: 20, status: 'below_threshold', count: totalReviews };
      recommendations.push(`Work toward 25+ reviews (currently ${totalReviews}). Higher review volume strongly correlates with better local search rankings.`);
    } else {
      details.volume25 = { earned: 0, max: 20, status: 'below_threshold', count: totalReviews };
    }

    // Average rating 4.0+: 20pts
    let avgRating = 0;
    if (totalReviews > 0) {
      const totalRating = reviewList.reduce((sum, r) => {
        const rating = Number(r.starRating || r.rating || r.stars || 0);
        // Handle Google's text rating format
        const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
        return sum + (ratingMap[rating] || rating || 0);
      }, 0);
      avgRating = Math.round((totalRating / totalReviews) * 100) / 100;
    }

    if (avgRating >= 4.0) {
      points += 20;
      details.avgRating4 = { earned: 20, max: 20, status: 'achieved', avgRating };
    } else if (totalReviews > 0) {
      details.avgRating4 = { earned: 0, max: 20, status: 'below_threshold', avgRating };
      recommendations.push(`Improve your average rating (currently ${avgRating}). Focus on delivering excellent experiences and addressing negative feedback promptly.`);
    } else {
      details.avgRating4 = { earned: 0, max: 20, status: 'no_reviews' };
    }

    // Average rating 4.5+: 10pts
    if (avgRating >= 4.5) {
      points += 10;
      details.avgRating45 = { earned: 10, max: 10, status: 'achieved', avgRating };
    } else {
      details.avgRating45 = { earned: 0, max: 10, status: avgRating >= 4.0 ? 'close' : 'below_threshold', avgRating };
    }

    // Recent velocity: 3+ reviews in last 30 days (15pts)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentReviews = reviewList.filter(r => {
      const reviewDate = new Date(r.createTime || r.createdAt || r.date || r.updateTime || 0);
      return reviewDate >= thirtyDaysAgo;
    });
    const recentCount = recentReviews.length;

    if (recentCount >= 3) {
      points += 15;
      details.velocity3 = { earned: 15, max: 15, status: 'achieved', recentCount };
    } else if (recentCount > 0) {
      const partial = Math.round((recentCount / 3) * 15);
      points += partial;
      details.velocity3 = { earned: partial, max: 15, status: 'partial', recentCount };
      recommendations.push(`Increase review frequency (${recentCount} in the last 30 days, need 3+). Consistent new reviews signal an active, trusted business to Google.`);
    } else {
      details.velocity3 = { earned: 0, max: 15, status: 'none_recent', recentCount: 0 };
      recommendations.push('No reviews in the last 30 days. Implement a review request strategy to maintain steady review flow.');
    }

    // 5+ reviews in last 30 days: 15pts
    if (recentCount >= 5) {
      points += 15;
      details.velocity5 = { earned: 15, max: 15, status: 'achieved', recentCount };
    } else {
      details.velocity5 = { earned: 0, max: 15, status: 'below_threshold', recentCount };
      if (recentCount >= 3) {
        recommendations.push(`Push for 5+ reviews per month (currently ${recentCount}). High-velocity review acquisition is a key ranking differentiator.`);
      }
    }

    details.totalReviews = totalReviews;
    details.avgRating = avgRating;
    details.recentReviewCount = recentCount;

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.reviewVolume,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 10: Review Response Rate (Weight: 10%)
  // =========================================================================

  scoreReviewResponseRate(reviews) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    const reviewList = Array.isArray(reviews) ? reviews : [];
    const totalReviews = reviewList.length;

    if (totalReviews === 0) {
      return {
        score: 0,
        weight: this.moduleWeights.reviewResponseRate,
        points: 0,
        maxPoints,
        details: { totalReviews: 0, responseRate: 0, status: 'no_reviews' },
        recommendations: ['Start collecting reviews so you can demonstrate responsiveness by replying to each one.']
      };
    }

    // Calculate response rate
    const reviewsWithResponse = reviewList.filter(r =>
      r.reviewReply?.comment || r.reply || r.ownerResponse || r.response
    );
    const responseRate = reviewsWithResponse.length / totalReviews;

    // 50%+ response rate: 20pts
    if (responseRate >= 0.50) {
      points += 20;
      details.responseRate50 = { earned: 20, max: 20, status: 'achieved' };
    } else {
      details.responseRate50 = { earned: 0, max: 20, status: 'below_threshold', rate: `${Math.round(responseRate * 100)}%` };
      recommendations.push(`Increase your review response rate (currently ${Math.round(responseRate * 100)}%). Aim to respond to at least 50% of reviews. Responding shows Google and customers that you care.`);
    }

    // 80%+ response rate: 30pts
    if (responseRate >= 0.80) {
      points += 30;
      details.responseRate80 = { earned: 30, max: 30, status: 'achieved' };
    } else if (responseRate >= 0.50) {
      details.responseRate80 = { earned: 0, max: 30, status: 'below_threshold', rate: `${Math.round(responseRate * 100)}%` };
      recommendations.push(`Push your response rate to 80%+ (currently ${Math.round(responseRate * 100)}%). High response rates significantly impact local search rankings.`);
    } else {
      details.responseRate80 = { earned: 0, max: 30, status: 'below_threshold' };
    }

    // 95%+ response rate: 10pts
    if (responseRate >= 0.95) {
      points += 10;
      details.responseRate95 = { earned: 10, max: 10, status: 'achieved' };
    } else {
      details.responseRate95 = { earned: 0, max: 10, status: responseRate >= 0.80 ? 'close' : 'below_threshold' };
      if (responseRate >= 0.80) {
        recommendations.push('Respond to nearly every review (95%+) for maximum ranking benefit. Even a simple "Thank you" counts.');
      }
    }

    // Average response length 50+ words: 15pts
    const responseLengths = reviewsWithResponse.map(r => {
      const reply = r.reviewReply?.comment || r.reply || r.ownerResponse || r.response || '';
      return reply.split(/\s+/).filter(w => w.length > 0).length;
    });
    const avgResponseLength = responseLengths.length > 0
      ? Math.round(responseLengths.reduce((sum, len) => sum + len, 0) / responseLengths.length)
      : 0;

    if (avgResponseLength >= 50) {
      points += 15;
      details.responseLength50 = { earned: 15, max: 15, status: 'achieved', avgWords: avgResponseLength };
    } else if (avgResponseLength > 0) {
      const partial = Math.round((avgResponseLength / 50) * 15);
      points += Math.min(partial, 14);
      details.responseLength50 = { earned: Math.min(partial, 14), max: 15, status: 'short', avgWords: avgResponseLength };
      recommendations.push(`Write longer review responses (average ${avgResponseLength} words, aim for 50+). Detailed responses provide keyword-rich content and show genuine engagement.`);
    } else {
      details.responseLength50 = { earned: 0, max: 15, status: 'no_responses' };
    }

    // Average response length 100+ words: 15pts
    if (avgResponseLength >= 100) {
      points += 15;
      details.responseLength100 = { earned: 15, max: 15, status: 'achieved', avgWords: avgResponseLength };
    } else if (avgResponseLength >= 50) {
      details.responseLength100 = { earned: 0, max: 15, status: 'close', avgWords: avgResponseLength };
      recommendations.push(`Aim for 100+ word responses on average (currently ${avgResponseLength}). Longer, thoughtful responses provide more SEO value and demonstrate exceptional customer care.`);
    } else {
      details.responseLength100 = { earned: 0, max: 15, status: 'below_threshold', avgWords: avgResponseLength };
    }

    // Responses contain keywords: 10pts
    const businessName = '';
    let keywordResponses = 0;
    for (const r of reviewsWithResponse) {
      const reply = (r.reviewReply?.comment || r.reply || r.ownerResponse || r.response || '').toLowerCase();
      // Check if response contains service-related words or the reviewer's specific mention
      const reviewText = (r.comment || r.text || r.reviewText || '').toLowerCase();
      const reviewWords = reviewText.split(/\s+/).filter(w => w.length > 4 && !this.stopWords.has(w));
      const hasKeywordOverlap = reviewWords.some(word => reply.includes(word));
      if (hasKeywordOverlap) {
        keywordResponses++;
      }
    }
    const keywordRate = reviewsWithResponse.length > 0 ? keywordResponses / reviewsWithResponse.length : 0;

    if (keywordRate >= 0.5) {
      points += 10;
      details.keywordInResponses = { earned: 10, max: 10, status: 'good', rate: `${Math.round(keywordRate * 100)}%` };
    } else {
      const partial = Math.round(keywordRate * 10);
      points += partial;
      details.keywordInResponses = { earned: partial, max: 10, status: 'needs_improvement', rate: `${Math.round(keywordRate * 100)}%` };
      recommendations.push('Include relevant keywords in your review responses. Mention specific services, products, or location details to boost local SEO.');
    }

    details.totalReviews = totalReviews;
    details.respondedCount = reviewsWithResponse.length;
    details.responseRate = `${Math.round(responseRate * 100)}%`;
    details.avgResponseWords = avgResponseLength;

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.reviewResponseRate,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 11: Description Quality (Weight: 8%)
  // =========================================================================

  scoreDescriptionQuality(profile, keywords) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    const description = profile?.description || profile?.profile?.description || '';

    // Description exists: 10pts
    if (description && description.trim().length > 0) {
      points += 10;
      details.exists = { earned: 10, max: 10, status: 'present' };
    } else {
      details.exists = { earned: 0, max: 10, status: 'missing' };
      recommendations.push('Add a business description. The description is one of the most important fields for Google to understand your business.');
      // No further checks possible
      return {
        score: 0,
        weight: this.moduleWeights.descriptionQuality,
        points: 0,
        maxPoints,
        details,
        recommendations
      };
    }

    const descLength = description.trim().length;
    const descLower = description.toLowerCase();
    const descWords = description.split(/\s+/).filter(w => w.length > 0);

    // 250+ chars: 15pts
    if (descLength >= 250) {
      points += 15;
      details.length250 = { earned: 15, max: 15, status: 'achieved', length: descLength };
    } else {
      details.length250 = { earned: 0, max: 15, status: 'too_short', length: descLength };
      recommendations.push(`Expand your description to at least 250 characters (currently ${descLength}). Longer descriptions rank better in local search.`);
    }

    // 500+ chars: 10pts
    if (descLength >= 500) {
      points += 10;
      details.length500 = { earned: 10, max: 10, status: 'achieved', length: descLength };
    } else if (descLength >= 250) {
      details.length500 = { earned: 0, max: 10, status: 'below_threshold', length: descLength };
      recommendations.push(`Consider expanding to 500+ characters (currently ${descLength}). The ideal description is 500-750 characters with natural keyword integration.`);
    } else {
      details.length500 = { earned: 0, max: 10, status: 'too_short', length: descLength };
    }

    // 3+ review keywords present: 20pts
    const keywordList = Array.isArray(keywords) ? keywords : [];
    let matchedKeywords = 0;
    const matchedKeywordList = [];
    for (const kw of keywordList) {
      const kwText = (kw.keyword || kw.term || kw || '').toLowerCase();
      if (kwText && descLower.includes(kwText)) {
        matchedKeywords++;
        matchedKeywordList.push(kwText);
      }
    }

    if (matchedKeywords >= 3) {
      points += 20;
      details.reviewKeywords = { earned: 20, max: 20, status: 'good', matched: matchedKeywords, keywords: matchedKeywordList };
    } else if (matchedKeywords > 0) {
      const partial = Math.round((matchedKeywords / 3) * 20);
      points += partial;
      details.reviewKeywords = { earned: partial, max: 20, status: 'partial', matched: matchedKeywords, keywords: matchedKeywordList };
      recommendations.push(`Include more keywords from your customer reviews in your description (${matchedKeywords}/3+ found). Review keywords represent what customers actually search for.`);
    } else {
      details.reviewKeywords = { earned: 0, max: 20, status: 'none_found', matched: 0 };
      if (keywordList.length > 0) {
        const topKws = keywordList.slice(0, 5).map(kw => kw.keyword || kw.term || kw).join(', ');
        recommendations.push(`Your description does not contain any keywords from your reviews. Consider incorporating terms like: ${topKws}`);
      }
    }

    // Has CTA (Call to Action): 15pts
    const hasCta = this.ctaPatterns.some(pattern => pattern.test(description));
    if (hasCta) {
      points += 15;
      details.cta = { earned: 15, max: 15, status: 'present' };
    } else {
      details.cta = { earned: 0, max: 15, status: 'missing' };
      recommendations.push('Add a call-to-action to your description (e.g., "Call us today", "Visit our website", "Book an appointment"). CTAs drive customer engagement.');
    }

    // City mention: 10pts
    const city = this._extractCity(profile);
    const hasCityMention = city ? descLower.includes(city.toLowerCase()) : false;
    if (hasCityMention) {
      points += 10;
      details.cityMention = { earned: 10, max: 10, status: 'present', city };
    } else if (city) {
      details.cityMention = { earned: 0, max: 10, status: 'missing', city };
      recommendations.push(`Mention your city "${city}" in your description. Local geographic mentions are a direct ranking signal for "near me" and city-specific searches.`);
    } else {
      // Can't determine city - give partial credit
      points += 5;
      details.cityMention = { earned: 5, max: 10, status: 'unknown_city' };
    }

    // Multiple sentences: 10pts
    const sentences = description.split(/[.!?]+/).filter(s => s.trim().length > 10);
    if (sentences.length >= 3) {
      points += 10;
      details.multipleSentences = { earned: 10, max: 10, status: 'good', sentenceCount: sentences.length };
    } else if (sentences.length >= 2) {
      points += 5;
      details.multipleSentences = { earned: 5, max: 10, status: 'minimal', sentenceCount: sentences.length };
      recommendations.push('Expand your description to include more sentences. Well-structured, multi-sentence descriptions perform better in search.');
    } else {
      details.multipleSentences = { earned: 0, max: 10, status: 'single_sentence', sentenceCount: sentences.length };
      recommendations.push('Write a multi-sentence description that covers your services, location, and unique value proposition.');
    }

    // No spam patterns: 10pts
    const hasSpam = this.spamPatterns.some(pattern => pattern.test(description));
    if (!hasSpam) {
      points += 10;
      details.noSpam = { earned: 10, max: 10, status: 'clean' };
    } else {
      details.noSpam = { earned: 0, max: 10, status: 'spam_detected' };
      recommendations.push('Remove spammy patterns from your description (excessive capitalization, repeated superlatives, clickbait phrases). Google may penalize profiles with spam signals.');
    }

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.descriptionQuality,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 12: Keyword Coverage (Weight: 7%)
  // =========================================================================

  scoreKeywordCoverage(profile, services, products, keywords) {
    const details = {};
    const recommendations = [];

    const keywordList = Array.isArray(keywords) ? keywords : [];

    if (keywordList.length === 0) {
      return {
        score: 0,
        weight: this.moduleWeights.keywordCoverage,
        points: 0,
        maxPoints: 100,
        details: { status: 'no_keywords_extracted', message: 'Not enough reviews to extract meaningful keywords' },
        recommendations: ['Collect more customer reviews to enable keyword analysis. Reviews reveal the language customers use to describe your business.']
      };
    }

    // Build a comprehensive text corpus from profile fields
    const profileText = this._buildProfileTextCorpus(profile, services, products);
    const profileLower = profileText.toLowerCase();

    // Check each keyword against the profile corpus
    let found = 0;
    const keywordGapTable = [];

    for (const kw of keywordList) {
      const kwText = (kw.keyword || kw.term || kw || '').toLowerCase();
      if (!kwText) continue;

      const isPresent = profileLower.includes(kwText);
      if (isPresent) {
        found++;
      }
      keywordGapTable.push({
        keyword: kwText,
        frequency: kw.frequency || kw.count || 0,
        weight: kw.weight || kw.score || 0,
        present: isPresent,
        locations: isPresent ? this._findKeywordLocations(kwText, profile, services, products) : []
      });
    }

    const totalKeywords = keywordList.length;
    const score = totalKeywords > 0 ? Math.round((found / totalKeywords) * 100) : 0;

    details.totalKeywords = totalKeywords;
    details.keywordsFound = found;
    details.keywordsMissing = totalKeywords - found;
    details.coveragePercent = score;
    details.gapTable = keywordGapTable;

    // Generate recommendations for missing high-value keywords
    const missingKeywords = keywordGapTable
      .filter(k => !k.present)
      .sort((a, b) => (b.frequency || 0) - (a.frequency || 0));

    if (missingKeywords.length > 0) {
      const topMissing = missingKeywords.slice(0, 5).map(k => `"${k.keyword}"`).join(', ');
      recommendations.push(`Add these high-value keywords from your customer reviews to your profile: ${topMissing}. Customers search using these terms.`);
    }

    if (score < 50) {
      recommendations.push('Your profile contains less than half of the keywords your customers use in reviews. Update your description, services, and products to include these natural search terms.');
    } else if (score < 75) {
      recommendations.push('Good keyword coverage, but there is room for improvement. Incorporate the missing keywords into your service descriptions and business description.');
    }

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.keywordCoverage,
      points: found,
      maxPoints: totalKeywords,
      details,
      recommendations
    };
  }

  // =========================================================================
  // MODULE 13: Posting Activity (Weight: 2%)
  // =========================================================================

  scorePostingActivity(posts) {
    const maxPoints = 100;
    let points = 0;
    const details = {};
    const recommendations = [];

    const postList = Array.isArray(posts) ? posts : [];

    // Filter posts from last 30 days
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const recentPosts = postList.filter(p => {
      const postDate = new Date(p.createTime || p.createdAt || p.date || p.updateTime || 0);
      return postDate >= thirtyDaysAgo;
    });
    const recentCount = recentPosts.length;

    // 1+ posts in 30 days: 25pts
    if (recentCount >= 1) {
      points += 25;
      details.hasRecentPost = { earned: 25, max: 25, status: 'achieved', count: recentCount };
    } else {
      details.hasRecentPost = { earned: 0, max: 25, status: 'no_recent_posts' };
      recommendations.push('Publish at least 1 Google post per month. Regular posting signals an active business and can appear in search results.');
    }

    // 4+ posts in 30 days: 25pts
    if (recentCount >= 4) {
      points += 25;
      details.frequency = { earned: 25, max: 25, status: 'achieved', count: recentCount };
    } else if (recentCount >= 1) {
      const partial = Math.round((recentCount / 4) * 25);
      points += partial;
      details.frequency = { earned: partial, max: 25, status: 'partial', count: recentCount };
      recommendations.push(`Increase posting frequency to weekly (${recentCount}/4 posts in last 30 days). Weekly posts keep your profile fresh and engaging.`);
    } else {
      details.frequency = { earned: 0, max: 25, status: 'no_posts' };
    }

    // Posts have images: 25pts
    if (recentPosts.length > 0) {
      const postsWithImages = recentPosts.filter(p =>
        p.media?.length > 0 || p.image || p.imageUrl || p.photoUrl ||
        (p.callToAction?.url && p.media) || p.summary?.includes('http')
      ).length;
      const imageRate = postsWithImages / recentPosts.length;

      if (imageRate >= 0.8) {
        points += 25;
        details.images = { earned: 25, max: 25, status: 'good', rate: `${Math.round(imageRate * 100)}%` };
      } else if (imageRate > 0) {
        const partial = Math.round(imageRate * 25);
        points += partial;
        details.images = { earned: partial, max: 25, status: 'partial', rate: `${Math.round(imageRate * 100)}%` };
        recommendations.push('Add images to all your Google posts. Posts with images receive 10x more engagement than text-only posts.');
      } else {
        details.images = { earned: 0, max: 25, status: 'no_images' };
        recommendations.push('Include images in your Google posts. Visual content dramatically increases engagement and click-through rates.');
      }

      // Posts have CTAs: 25pts
      const postsWithCta = recentPosts.filter(p => {
        const text = (p.summary || p.content || p.text || '').toLowerCase();
        const hasCtaButton = p.callToAction?.actionType || p.topicType === 'OFFER';
        const hasCtaText = this.ctaPatterns.some(pattern => pattern.test(text));
        return hasCtaButton || hasCtaText;
      }).length;
      const ctaRate = postsWithCta / recentPosts.length;

      if (ctaRate >= 0.8) {
        points += 25;
        details.ctas = { earned: 25, max: 25, status: 'good', rate: `${Math.round(ctaRate * 100)}%` };
      } else if (ctaRate > 0) {
        const partial = Math.round(ctaRate * 25);
        points += partial;
        details.ctas = { earned: partial, max: 25, status: 'partial', rate: `${Math.round(ctaRate * 100)}%` };
        recommendations.push('Add call-to-action buttons to your posts (Book, Learn More, Call Now, etc.). CTAs convert viewers into customers.');
      } else {
        details.ctas = { earned: 0, max: 25, status: 'no_ctas' };
        recommendations.push('Every post should include a call-to-action. Use Google post CTA buttons (Book, Order, Learn More) to drive conversions.');
      }
    } else {
      details.images = { earned: 0, max: 25, status: 'no_posts' };
      details.ctas = { earned: 0, max: 25, status: 'no_posts' };
    }

    details.totalPosts = postList.length;
    details.recentPostCount = recentCount;

    const score = maxPoints > 0 ? Math.round((points / maxPoints) * 100) : 0;

    return {
      score: Math.min(score, 100),
      weight: this.moduleWeights.postingActivity,
      points,
      maxPoints,
      details,
      recommendations
    };
  }

  // =========================================================================
  // KEYWORD EXTRACTION
  // =========================================================================

  /**
   * Extract top 20 keywords from reviews using frequency analysis, bigram
   * extraction, and recency/rating weighting.
   *
   * @param {Array} reviews - Array of review objects
   * @returns {Array} Top 20 keywords with frequency and weight
   */
  extractKeywords(reviews) {
    const reviewList = Array.isArray(reviews) ? reviews : [];
    if (reviewList.length === 0) {
      return [];
    }

    // Take up to 50 most recent reviews
    const sortedReviews = [...reviewList]
      .sort((a, b) => {
        const dateA = new Date(a.createTime || a.createdAt || a.date || a.updateTime || 0);
        const dateB = new Date(b.createTime || b.createdAt || b.date || b.updateTime || 0);
        return dateB - dateA; // Most recent first
      })
      .slice(0, 50);

    const wordFrequency = new Map();
    const bigramFrequency = new Map();

    const now = new Date();
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    // Debug: log first review to see actual GBP API format
    if (sortedReviews.length > 0) {
      const sample = sortedReviews[0];
      console.log(`[KeywordExtraction] Review keys: ${JSON.stringify(Object.keys(sample))}`);
      console.log(`[KeywordExtraction] Review comment field: "${(sample.comment || '').substring(0, 100)}", starRating: ${sample.starRating}`);
      // Check all text fields
      const allTextFields = ['comment', 'text', 'reviewText', 'body', 'content', 'reviewBody'];
      for (const field of allTextFields) {
        if (sample[field]) console.log(`[KeywordExtraction] Found text in field "${field}": "${sample[field].substring(0, 100)}"`);
      }
    }

    for (const review of sortedReviews) {
      const text = (review.comment || review.text || review.reviewText || review.body || review.content || review.reviewBody || '').trim();
      if (!text) continue;

      // Determine weighting factors
      const reviewDate = new Date(review.createTime || review.createdAt || review.date || review.updateTime || 0);
      const isRecent = reviewDate >= thirtyDaysAgo;
      const recencyMultiplier = isRecent ? 2.0 : 1.0;

      const rating = this._normalizeRating(review);
      const ratingMultiplier = rating === 5 ? 1.5 : 1.0;

      const weight = recencyMultiplier * ratingMultiplier;

      // Tokenize and clean - support Unicode/non-English characters (Hindi, etc.)
      const cleaned = text
        .toLowerCase()
        .replace(/[^\p{L}\p{N}\s'-]/gu, ' ')  // Keep all Unicode letters and numbers
        .replace(/\s+/g, ' ')
        .trim();

      const tokens = cleaned.split(/\s+/).filter(t => t.length > 2);

      // Count single words
      for (const token of tokens) {
        const normalized = token.replace(/^['-]+|['-]+$/g, ''); // Strip leading/trailing punctuation
        if (normalized.length < 3) continue;
        if (this.stopWords.has(normalized)) continue;

        const current = wordFrequency.get(normalized) || { count: 0, weight: 0 };
        current.count += 1;
        current.weight += weight;
        wordFrequency.set(normalized, current);
      }

      // Extract bigrams
      for (let i = 0; i < tokens.length - 1; i++) {
        const word1 = tokens[i].replace(/^['-]+|['-]+$/g, '');
        const word2 = tokens[i + 1].replace(/^['-]+|['-]+$/g, '');

        if (word1.length < 2 || word2.length < 2) continue;
        if (this.stopWords.has(word1) && this.stopWords.has(word2)) continue;

        // At least one word must not be a stop word for a meaningful bigram
        if (this.stopWords.has(word1) || this.stopWords.has(word2)) {
          // Allow bigrams where one word is a stop word only if both together are meaningful
          // (e.g., "on time", "at work") - but skip pure stop word pairs
          if (this.stopWords.has(word1) && this.stopWords.has(word2)) continue;
        }

        const bigram = `${word1} ${word2}`;
        const current = bigramFrequency.get(bigram) || { count: 0, weight: 0 };
        current.count += 1;
        current.weight += weight;
        bigramFrequency.set(bigram, current);
      }
    }

    // Combine and score: bigrams get a bonus for being more specific
    const allKeywords = new Map();

    // Dynamic threshold: lower for few reviews so we still extract meaningful keywords
    const minFrequency = sortedReviews.length < 10 ? 1 : 2;

    // Add bigrams first (they are more valuable)
    for (const [bigram, data] of bigramFrequency.entries()) {
      if (data.count >= minFrequency) {
        allKeywords.set(bigram, {
          keyword: bigram,
          frequency: data.count,
          weight: data.weight * 1.5, // Bigram bonus
          type: 'bigram'
        });
      }
    }

    // Add single words (skip if already covered by a bigram)
    for (const [word, data] of wordFrequency.entries()) {
      if (data.count < minFrequency) continue;

      // Check if this word is already part of a high-frequency bigram
      let coveredByBigram = false;
      for (const [bigram, bigramData] of allKeywords.entries()) {
        if (bigram.includes(word) && bigramData.frequency >= data.count * 0.5) {
          coveredByBigram = true;
          break;
        }
      }

      if (!coveredByBigram) {
        allKeywords.set(word, {
          keyword: word,
          frequency: data.count,
          weight: data.weight,
          type: 'unigram'
        });
      }
    }

    // Sort by weighted score and return top 20
    const sorted = Array.from(allKeywords.values())
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 20);

    console.log(`[ProfileAuditEngine] Keyword extraction: ${wordFrequency.size} unique words, ${bigramFrequency.size} bigrams, ${sorted.length} final keywords`);

    return sorted;
  }

  // =========================================================================
  // KEYWORD GAP DETECTION
  // =========================================================================

  /**
   * Detect which extracted keywords are missing from profile fields.
   * Returns a gap table showing presence/absence across profile sections.
   */
  detectKeywordGaps(keywords, profile, services, products) {
    const keywordList = Array.isArray(keywords) ? keywords : [];
    if (keywordList.length === 0) {
      return { gaps: [], summary: { total: 0, found: 0, missing: 0 } };
    }

    const descriptionText = (profile?.description || profile?.profile?.description || '').toLowerCase();
    const serviceText = this._buildServiceText(services).toLowerCase();
    const productText = this._buildProductText(products).toLowerCase();
    const categoryText = this._buildCategoryText(profile).toLowerCase();

    const gaps = [];
    let found = 0;
    let missing = 0;

    for (const kw of keywordList) {
      const kwText = (kw.keyword || kw.term || kw || '').toLowerCase();
      if (!kwText) continue;

      const inDescription = descriptionText.includes(kwText);
      const inServices = serviceText.includes(kwText);
      const inProducts = productText.includes(kwText);
      const inCategories = categoryText.includes(kwText);
      const isPresent = inDescription || inServices || inProducts || inCategories;

      if (isPresent) {
        found++;
      } else {
        missing++;
      }

      gaps.push({
        keyword: kwText,
        frequency: kw.frequency || 0,
        weight: kw.weight || 0,
        type: kw.type || 'unigram',
        present: isPresent,
        foundIn: {
          description: inDescription,
          services: inServices,
          products: inProducts,
          categories: inCategories
        },
        recommendation: isPresent ? null : `Add "${kwText}" to your ${this._suggestPlacement(kwText, services)}`
      });
    }

    return {
      gaps,
      summary: {
        total: keywordList.length,
        found,
        missing,
        coveragePercent: keywordList.length > 0 ? Math.round((found / keywordList.length) * 100) : 0
      }
    };
  }

  // =========================================================================
  // HELPER METHODS
  // =========================================================================

  /**
   * Extract social media links from various profile field formats.
   */
  _extractSocialLinks(profile) {
    const socialLinks = [];
    const socialPlatforms = ['facebook', 'instagram', 'twitter', 'linkedin', 'youtube', 'tiktok', 'pinterest', 'yelp', 'x.com'];

    // Check explicit social media fields
    const socialProfiles = profile?.socialMedia || profile?.socialProfiles || profile?.socialLinks || [];
    if (Array.isArray(socialProfiles)) {
      for (const social of socialProfiles) {
        const url = social.url || social.link || social.uri || '';
        const platform = social.platform || social.type || social.name || '';
        if (url || platform) {
          socialLinks.push(platform || this._detectPlatform(url));
        }
      }
    }

    // Check individual social fields
    if (profile?.facebookUrl || profile?.facebook) socialLinks.push('facebook');
    if (profile?.instagramUrl || profile?.instagram) socialLinks.push('instagram');
    if (profile?.twitterUrl || profile?.twitter) socialLinks.push('twitter');
    if (profile?.linkedinUrl || profile?.linkedin) socialLinks.push('linkedin');
    if (profile?.youtubeUrl || profile?.youtube) socialLinks.push('youtube');
    if (profile?.tiktokUrl || profile?.tiktok) socialLinks.push('tiktok');
    if (profile?.pinterestUrl || profile?.pinterest) socialLinks.push('pinterest');

    // Deduplicate
    return [...new Set(socialLinks)];
  }

  /**
   * Detect social media platform from URL.
   */
  _detectPlatform(url) {
    if (!url) return 'unknown';
    const urlLower = url.toLowerCase();
    if (urlLower.includes('facebook.com') || urlLower.includes('fb.com')) return 'facebook';
    if (urlLower.includes('instagram.com')) return 'instagram';
    if (urlLower.includes('twitter.com') || urlLower.includes('x.com')) return 'twitter';
    if (urlLower.includes('linkedin.com')) return 'linkedin';
    if (urlLower.includes('youtube.com') || urlLower.includes('youtu.be')) return 'youtube';
    if (urlLower.includes('tiktok.com')) return 'tiktok';
    if (urlLower.includes('pinterest.com')) return 'pinterest';
    if (urlLower.includes('yelp.com')) return 'yelp';
    return 'other';
  }

  /**
   * Extract city from profile address fields.
   */
  _extractCity(profile) {
    // Try various address field formats
    const address = profile?.storefrontAddress || profile?.address || {};
    if (typeof address === 'object') {
      return address.locality || address.city || address.addressLocality || '';
    }
    // Try to extract city from formatted address string
    if (typeof address === 'string') {
      const parts = address.split(',').map(p => p.trim());
      if (parts.length >= 2) {
        return parts[parts.length - 2]; // City is typically second to last
      }
    }
    // Check profile-level city field
    return profile?.city || profile?.locality || '';
  }

  /**
   * Normalize review rating to a number 1-5.
   */
  _normalizeRating(review) {
    const rating = review.starRating || review.rating || review.stars || 0;
    const ratingMap = { 'ONE': 1, 'TWO': 2, 'THREE': 3, 'FOUR': 4, 'FIVE': 5 };
    return ratingMap[rating] || Number(rating) || 0;
  }

  /**
   * Build a text corpus from all profile fields for keyword matching.
   */
  _buildProfileTextCorpus(profile, services, products) {
    const parts = [];

    // Profile fields
    parts.push(profile?.title || profile?.name || profile?.businessName || '');
    parts.push(profile?.description || profile?.profile?.description || '');
    parts.push(this._buildCategoryText(profile));

    // Services
    parts.push(this._buildServiceText(services));

    // Products
    parts.push(this._buildProductText(products));

    return parts.join(' ');
  }

  /**
   * Build text from services.
   */
  _buildServiceText(services) {
    const serviceList = Array.isArray(services) ? services : [];
    return serviceList.map(s =>
      `${s.displayName || s.serviceName || s.name || ''} ${s.description || s.serviceDescription || ''}`
    ).join(' ');
  }

  /**
   * Build text from products.
   */
  _buildProductText(products) {
    const productList = Array.isArray(products) ? products : [];
    return productList.map(p =>
      `${p.displayName || p.productName || p.name || ''} ${p.description || p.productDescription || ''} ${p.category || p.productCategory || ''}`
    ).join(' ');
  }

  /**
   * Build text from categories.
   */
  _buildCategoryText(profile) {
    const parts = [];
    const primary = profile?.categories?.primaryCategory?.displayName || profile?.primaryCategory || '';
    if (primary) parts.push(primary);

    const additional = profile?.categories?.additionalCategories || profile?.additionalCategories || [];
    if (Array.isArray(additional)) {
      for (const cat of additional) {
        parts.push(cat.displayName || cat.name || cat || '');
      }
    }
    return parts.join(' ');
  }

  /**
   * Find which profile sections contain a given keyword.
   */
  _findKeywordLocations(keyword, profile, services, products) {
    const locations = [];
    const kwLower = keyword.toLowerCase();

    const description = (profile?.description || profile?.profile?.description || '').toLowerCase();
    if (description.includes(kwLower)) locations.push('description');

    const serviceText = this._buildServiceText(services).toLowerCase();
    if (serviceText.includes(kwLower)) locations.push('services');

    const productText = this._buildProductText(products).toLowerCase();
    if (productText.includes(kwLower)) locations.push('products');

    const categoryText = this._buildCategoryText(profile).toLowerCase();
    if (categoryText.includes(kwLower)) locations.push('categories');

    const businessName = (profile?.title || profile?.name || profile?.businessName || '').toLowerCase();
    if (businessName.includes(kwLower)) locations.push('businessName');

    return locations;
  }

  /**
   * Suggest where a missing keyword should be placed.
   */
  _suggestPlacement(keyword, services) {
    const serviceList = Array.isArray(services) ? services : [];
    // If services exist, suggest adding to service descriptions; otherwise to the business description
    if (serviceList.length > 0) {
      return 'service descriptions or business description';
    }
    return 'business description';
  }

  /**
   * Determine the grade label and color for a given score.
   */
  _getGrade(score) {
    if (score >= 90) return { label: 'Excellent', color: 'blue', range: '90-100' };
    if (score >= 75) return { label: 'Good', color: 'green', range: '75-89' };
    if (score >= 60) return { label: 'Average', color: 'yellow', range: '60-74' };
    if (score >= 40) return { label: 'Below Average', color: 'orange', range: '40-59' };
    return { label: 'Poor', color: 'red', range: '0-39' };
  }
}

export default new ProfileAuditEngine();
