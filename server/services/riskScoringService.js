import connectionPool from '../database/connectionPool.js';

/**
 * Risk Scoring Service
 * Evaluates AI-generated GBP optimization suggestions against Google's guidelines.
 * Combines hard rules (auto-reject) with soft scoring (0-100) to protect accounts
 * from suspensions due to guideline violations.
 */
class RiskScoringService {
  constructor() {
    this.client = null;
    this.initialized = false;

    // Hard-rule superlatives list (case-insensitive matching)
    this.superlatives = [
      'best', '#1', 'top-rated', 'top rated', 'guaranteed', 'cheapest',
      'leading', 'premier', 'finest', 'number one', 'number 1'
    ];

    // Common acronyms that are allowed in ALL CAPS
    this.allowedAcronyms = new Set([
      'LLC', 'INC', 'HVAC', 'AC', 'IT', 'HR', 'CEO', 'CFO', 'CTO', 'COO',
      'USA', 'UK', 'EU', 'ATM', 'SEO', 'SEM', 'PPC', 'CPA', 'CRM', 'ERP',
      'DBA', 'PA', 'MD', 'PhD', 'RN', 'DDS', 'DMD', 'OD', 'DO', 'DC',
      'PC', 'PLLC', 'LLP', 'LP', 'NP', 'PE', 'RA', 'AIA', 'LEED',
      'BBQ', 'DIY', 'FAQ', 'VIP', 'ASAP', 'GPS', 'LED', 'TV', 'CCTV',
      'HVAC/R', 'CDL', 'DOT', 'OSHA', 'EPA', 'FHA', 'VA', 'HOA'
    ]);

    // Emoji regex pattern (covers most Unicode emoji ranges)
    this.emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

    // Phone number patterns
    this.phoneRegex = /(\+?\d{1,3}[-.\s]?)?\(?\d{2,4}\)?[-.\s]?\d{3,4}[-.\s]?\d{3,4}/g;

    // URL patterns
    this.urlRegex = /(?:https?:\/\/|www\.)[^\s,]+/gi;

    // Risk thresholds
    this.thresholds = {
      low: { min: 0, max: 30, label: 'low', color: 'green', action: 'safe to auto-deploy' },
      medium: { min: 31, max: 60, label: 'medium', color: 'yellow', action: 'requires user review' },
      high: { min: 61, max: 100, label: 'high', color: 'red', action: 'blocked, needs explicit confirmation' }
    };

    console.log('[RiskScoringService] Initialized with hard rules and soft scoring');
  }

  /**
   * Initialize database connection from pool
   */
  async initialize() {
    if (this.initialized && this.client) {
      return;
    }

    try {
      this.client = await connectionPool.getClient();
      this.initialized = true;
      console.log('[RiskScoringService] Database connection established from pool');
    } catch (error) {
      console.error('[RiskScoringService] Failed to initialize database connection:', error.message);
      // Service can still function for rule-checking without DB
    }
  }

  // ---------------------------------------------------------------------------
  // HARD RULES
  // ---------------------------------------------------------------------------

  /**
   * Check all hard rules against a suggestion.
   * Any single violation means the suggestion is auto-rejected.
   *
   * @param {object} suggestion - The AI-generated suggestion
   *   suggestion.businessName  - Proposed business name (or null if unchanged)
   *   suggestion.description   - Proposed description text
   *   suggestion.categories    - Array of proposed categories (primary + additional)
   * @param {object} profileData - The current GBP profile data
   *   profileData.businessName - Current business name on the listing
   *   profileData.description  - Current description
   *   profileData.categories   - Current categories array
   *   profileData.city         - City from the business address
   * @returns {{ passed: boolean, violations: Array<{ rule: string, code: string, detail: string }> }}
   */
  checkHardRules(suggestion, profileData) {
    const violations = [];

    try {
      if (!suggestion || !profileData) {
        return { passed: false, violations: [{ rule: 'INVALID_INPUT', code: 'HR-00', detail: 'Suggestion or profile data is missing' }] };
      }

      // HR-01: Business name NEVER modified
      if (suggestion.businessName !== undefined && suggestion.businessName !== null) {
        const proposedName = (suggestion.businessName || '').trim().toLowerCase();
        const currentName = (profileData.businessName || '').trim().toLowerCase();
        if (proposedName !== currentName) {
          violations.push({
            rule: 'BUSINESS_NAME_MODIFIED',
            code: 'HR-01',
            detail: `Business name must not be changed. Current: "${profileData.businessName}", Proposed: "${suggestion.businessName}"`
          });
        }
      }

      const description = suggestion.description || '';

      // HR-02: Keyword density >5% in description
      if (description.length > 0) {
        const { maxDensity, topKeyword } = this._getMaxKeywordDensity(description);
        if (maxDensity > 5) {
          violations.push({
            rule: 'KEYWORD_DENSITY_EXCEEDED',
            code: 'HR-02',
            detail: `Keyword "${topKeyword}" has ${maxDensity.toFixed(1)}% density (max 5%)`
          });
        }
      }

      // HR-03: City/area name used more than once in description
      if (description.length > 0 && profileData.city) {
        const cityName = profileData.city.trim().toLowerCase();
        if (cityName.length > 0) {
          const cityRegex = new RegExp(this._escapeRegex(cityName), 'gi');
          const matches = description.match(cityRegex);
          if (matches && matches.length > 1) {
            violations.push({
              rule: 'CITY_NAME_REPEATED',
              code: 'HR-03',
              detail: `City "${profileData.city}" appears ${matches.length} times in description (max 1)`
            });
          }
        }
      }

      // HR-04: Description >750 characters
      if (description.length > 750) {
        violations.push({
          rule: 'DESCRIPTION_TOO_LONG',
          code: 'HR-04',
          detail: `Description is ${description.length} characters (max 750)`
        });
      }

      // HR-05: Superlatives
      if (description.length > 0) {
        const foundSuperlatives = this._findSuperlatives(description);
        if (foundSuperlatives.length > 0) {
          violations.push({
            rule: 'SUPERLATIVES_FOUND',
            code: 'HR-05',
            detail: `Superlatives detected: ${foundSuperlatives.join(', ')}`
          });
        }
      }

      // HR-06: Phone numbers in description
      if (description.length > 0) {
        const phoneMatches = description.match(this.phoneRegex);
        if (phoneMatches && phoneMatches.length > 0) {
          violations.push({
            rule: 'PHONE_IN_DESCRIPTION',
            code: 'HR-06',
            detail: `Phone number(s) found in description: ${phoneMatches.join(', ')}`
          });
        }
      }

      // HR-07: URLs in description
      if (description.length > 0) {
        const urlMatches = description.match(this.urlRegex);
        if (urlMatches && urlMatches.length > 0) {
          violations.push({
            rule: 'URL_IN_DESCRIPTION',
            code: 'HR-07',
            detail: `URL(s) found in description: ${urlMatches.join(', ')}`
          });
        }
      }

      // HR-08: ALL CAPS words (except acronyms)
      if (description.length > 0) {
        const capsWords = this._findAllCapsWords(description);
        if (capsWords.length > 0) {
          violations.push({
            rule: 'ALL_CAPS_WORDS',
            code: 'HR-08',
            detail: `ALL CAPS words found (not recognized acronyms): ${capsWords.join(', ')}`
          });
        }
      }

      // HR-09: Emojis in business description
      if (description.length > 0) {
        const emojiMatches = description.match(this.emojiRegex);
        if (emojiMatches && emojiMatches.length > 0) {
          violations.push({
            rule: 'EMOJIS_IN_DESCRIPTION',
            code: 'HR-09',
            detail: `Emojis found in description: ${emojiMatches.join(' ')}`
          });
        }
      }

      // HR-10: More than 10 total categories
      const categories = suggestion.categories || [];
      if (categories.length > 10) {
        violations.push({
          rule: 'TOO_MANY_CATEGORIES',
          code: 'HR-10',
          detail: `${categories.length} categories specified (max 10)`
        });
      }

    } catch (error) {
      console.error('[RiskScoringService] Error in checkHardRules:', error.message);
      violations.push({
        rule: 'EVALUATION_ERROR',
        code: 'HR-ERR',
        detail: `Error evaluating hard rules: ${error.message}`
      });
    }

    const passed = violations.length === 0;

    if (!passed) {
      console.log(`[RiskScoringService] Hard rule check FAILED with ${violations.length} violation(s): ${violations.map(v => v.code).join(', ')}`);
    } else {
      console.log('[RiskScoringService] Hard rule check PASSED');
    }

    return { passed, violations };
  }

  // ---------------------------------------------------------------------------
  // SOFT RISK SCORING
  // ---------------------------------------------------------------------------

  /**
   * Calculate the soft risk score (0-100) for a suggestion.
   *
   * @param {object} suggestion - The AI-generated suggestion
   * @param {object} profileData - Current GBP profile data
   * @param {object} changeHistory - Recent change history
   *   changeHistory.changesInLast7Days - Number of profile changes in the last 7 days
   *   changeHistory.contentUniqueness  - 0-100 percentage of content uniqueness
   *   changeHistory.categoryRelevance  - 'high'|'moderate'|'low'|'unrelated'
   * @returns {{ score: number, breakdown: object }}
   */
  calculateSoftRisk(suggestion, profileData, changeHistory) {
    const breakdown = {
      keywordDensity: { score: 0, maxPoints: 30, detail: '' },
      contentUniqueness: { score: 0, maxPoints: 30, detail: '' },
      changeVelocity: { score: 0, maxPoints: 20, detail: '' },
      categoryRelevance: { score: 0, maxPoints: 20, detail: '' }
    };

    try {
      // --- Keyword Density (0-30 pts) ---
      const description = suggestion.description || '';
      if (description.length > 0) {
        const { maxDensity } = this._getMaxKeywordDensity(description);

        if (maxDensity <= 2) {
          breakdown.keywordDensity.score = 0;
          breakdown.keywordDensity.detail = `${maxDensity.toFixed(1)}% density - safe`;
        } else if (maxDensity <= 3) {
          breakdown.keywordDensity.score = 10;
          breakdown.keywordDensity.detail = `${maxDensity.toFixed(1)}% density - slightly elevated`;
        } else if (maxDensity <= 4) {
          breakdown.keywordDensity.score = 20;
          breakdown.keywordDensity.detail = `${maxDensity.toFixed(1)}% density - moderate concern`;
        } else {
          breakdown.keywordDensity.score = 30;
          breakdown.keywordDensity.detail = `${maxDensity.toFixed(1)}% density - high concern`;
        }
      } else {
        breakdown.keywordDensity.detail = 'No description provided';
      }

      // --- Content Uniqueness (0-30 pts) ---
      const uniqueness = changeHistory?.contentUniqueness ?? 100;

      if (uniqueness >= 100) {
        breakdown.contentUniqueness.score = 0;
        breakdown.contentUniqueness.detail = `${uniqueness}% unique - fully original`;
      } else if (uniqueness >= 80) {
        breakdown.contentUniqueness.score = 5;
        breakdown.contentUniqueness.detail = `${uniqueness}% unique - mostly original`;
      } else if (uniqueness >= 60) {
        breakdown.contentUniqueness.score = 15;
        breakdown.contentUniqueness.detail = `${uniqueness}% unique - moderate overlap`;
      } else {
        breakdown.contentUniqueness.score = 30;
        breakdown.contentUniqueness.detail = `${uniqueness}% unique - significant duplication`;
      }

      // --- Change Velocity (0-20 pts) ---
      const changesIn7Days = changeHistory?.changesInLast7Days ?? 0;

      if (changesIn7Days <= 2) {
        breakdown.changeVelocity.score = 0;
        breakdown.changeVelocity.detail = `${changesIn7Days} changes in 7 days - safe pace`;
      } else if (changesIn7Days <= 4) {
        breakdown.changeVelocity.score = 10;
        breakdown.changeVelocity.detail = `${changesIn7Days} changes in 7 days - moderate pace`;
      } else {
        breakdown.changeVelocity.score = 20;
        breakdown.changeVelocity.detail = `${changesIn7Days} changes in 7 days - aggressive pace`;
      }

      // --- Category Relevance (0-20 pts) ---
      const relevance = changeHistory?.categoryRelevance ?? 'high';

      switch (relevance) {
        case 'high':
          breakdown.categoryRelevance.score = 0;
          breakdown.categoryRelevance.detail = 'Category highly relevant to review keywords';
          break;
        case 'moderate':
          breakdown.categoryRelevance.score = 5;
          breakdown.categoryRelevance.detail = 'Category somewhat related to review keywords';
          break;
        case 'low':
          breakdown.categoryRelevance.score = 15;
          breakdown.categoryRelevance.detail = 'Category loosely related to review keywords';
          break;
        case 'unrelated':
        default:
          breakdown.categoryRelevance.score = 20;
          breakdown.categoryRelevance.detail = 'Category unrelated to review keywords';
          break;
      }

    } catch (error) {
      console.error('[RiskScoringService] Error in calculateSoftRisk:', error.message);
    }

    const score = breakdown.keywordDensity.score
      + breakdown.contentUniqueness.score
      + breakdown.changeVelocity.score
      + breakdown.categoryRelevance.score;

    console.log(`[RiskScoringService] Soft risk score: ${score}/100 (KD:${breakdown.keywordDensity.score} CU:${breakdown.contentUniqueness.score} CV:${breakdown.changeVelocity.score} CR:${breakdown.categoryRelevance.score})`);

    return { score, breakdown };
  }

  // ---------------------------------------------------------------------------
  // COMBINED SCORING
  // ---------------------------------------------------------------------------

  /**
   * Full scoring pipeline: hard rules first, then soft scoring.
   *
   * @param {object} suggestion
   * @param {object} profileData
   * @param {object} changeHistory
   * @returns {{ riskScore: number, riskLevel: string, violations: Array, details: object }}
   */
  scoreSuggestion(suggestion, profileData, changeHistory) {
    try {
      console.log('[RiskScoringService] Scoring suggestion...');

      // Step 1: Hard rules
      const hardResult = this.checkHardRules(suggestion, profileData);

      // Step 2: Soft scoring
      const softResult = this.calculateSoftRisk(suggestion, profileData, changeHistory || {});

      // Determine risk level
      let riskLevel;
      if (!hardResult.passed) {
        // Hard rule failures always result in high risk
        riskLevel = 'high';
      } else if (softResult.score <= 30) {
        riskLevel = 'low';
      } else if (softResult.score <= 60) {
        riskLevel = 'medium';
      } else {
        riskLevel = 'high';
      }

      const thresholdInfo = this.thresholds[riskLevel];

      const result = {
        riskScore: hardResult.passed ? softResult.score : 100,
        riskLevel,
        riskColor: thresholdInfo.color,
        action: thresholdInfo.action,
        hardRulesPassed: hardResult.passed,
        violations: hardResult.violations,
        details: {
          softScore: softResult.score,
          breakdown: softResult.breakdown,
          hardRuleViolations: hardResult.violations.length,
          evaluatedAt: new Date().toISOString()
        }
      };

      console.log(`[RiskScoringService] Final result: score=${result.riskScore}, level=${riskLevel} (${thresholdInfo.color}), hardRulesPassed=${hardResult.passed}`);

      return result;

    } catch (error) {
      console.error('[RiskScoringService] Error in scoreSuggestion:', error.message);
      return {
        riskScore: 100,
        riskLevel: 'high',
        riskColor: 'red',
        action: 'blocked due to evaluation error',
        hardRulesPassed: false,
        violations: [{ rule: 'SCORING_ERROR', code: 'SC-ERR', detail: error.message }],
        details: { softScore: 0, breakdown: {}, hardRuleViolations: 1, evaluatedAt: new Date().toISOString() }
      };
    }
  }

  // ---------------------------------------------------------------------------
  // KEYWORD DENSITY
  // ---------------------------------------------------------------------------

  /**
   * Calculate keyword densities for all significant words in the text.
   *
   * @param {string} text
   * @returns {{ maxDensity: number, keywordDensities: object }}
   */
  calculateKeywordDensity(text) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { maxDensity: 0, keywordDensities: {} };
      }

      const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').split(/\s+/).filter(w => w.length > 2);
      const totalWords = words.length;

      if (totalWords === 0) {
        return { maxDensity: 0, keywordDensities: {} };
      }

      // Count word frequencies
      const freq = {};
      for (const word of words) {
        if (this._isStopWord(word)) continue;
        freq[word] = (freq[word] || 0) + 1;
      }

      // Calculate densities
      const keywordDensities = {};
      let maxDensity = 0;

      for (const [word, count] of Object.entries(freq)) {
        const density = (count / totalWords) * 100;
        keywordDensities[word] = {
          count,
          density: parseFloat(density.toFixed(2)),
          totalWords
        };
        if (density > maxDensity) {
          maxDensity = density;
        }
      }

      return {
        maxDensity: parseFloat(maxDensity.toFixed(2)),
        keywordDensities
      };

    } catch (error) {
      console.error('[RiskScoringService] Error calculating keyword density:', error.message);
      return { maxDensity: 0, keywordDensities: {} };
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Get the maximum keyword density and the keyword that causes it.
   * @private
   */
  _getMaxKeywordDensity(text) {
    const { maxDensity, keywordDensities } = this.calculateKeywordDensity(text);

    let topKeyword = '';
    let topDensity = 0;

    for (const [word, info] of Object.entries(keywordDensities)) {
      if (info.density > topDensity) {
        topDensity = info.density;
        topKeyword = word;
      }
    }

    return { maxDensity, topKeyword };
  }

  /**
   * Find superlative words/phrases in text.
   * @private
   */
  _findSuperlatives(text) {
    const found = [];
    const lowerText = text.toLowerCase();

    for (const term of this.superlatives) {
      // Word boundary matching: the term must appear as a standalone word/phrase
      const escaped = this._escapeRegex(term);
      const regex = new RegExp(`\\b${escaped}\\b`, 'gi');
      if (regex.test(lowerText)) {
        found.push(term);
      }
    }

    return found;
  }

  /**
   * Find ALL CAPS words that are NOT recognized acronyms.
   * Only flags words with 2+ characters that are all uppercase.
   * @private
   */
  _findAllCapsWords(text) {
    const words = text.split(/\s+/);
    const capsWords = [];

    for (const word of words) {
      // Strip trailing punctuation for matching
      const cleaned = word.replace(/[^A-Za-z/]/g, '');

      if (cleaned.length < 2) continue;

      // Check if the word is entirely uppercase letters (and possibly slash for HVAC/R)
      if (/^[A-Z/]+$/.test(cleaned) && !this.allowedAcronyms.has(cleaned)) {
        capsWords.push(cleaned);
      }
    }

    return [...new Set(capsWords)]; // Deduplicate
  }

  /**
   * Escape special regex characters in a string.
   * @private
   */
  _escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  /**
   * Common English stop words that should not count toward keyword density.
   * @private
   */
  _isStopWord(word) {
    const stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has',
      'her', 'was', 'one', 'our', 'out', 'his', 'had', 'has', 'how', 'its',
      'may', 'who', 'did', 'get', 'got', 'let', 'say', 'she', 'too', 'use',
      'this', 'that', 'with', 'have', 'from', 'they', 'been', 'said', 'each',
      'will', 'than', 'them', 'then', 'what', 'when', 'make', 'like', 'just',
      'over', 'such', 'also', 'into', 'year', 'some', 'more', 'very', 'most',
      'about', 'after', 'which', 'their', 'would', 'there', 'could', 'other',
      'these', 'where', 'being', 'those', 'still', 'while', 'should', 'through',
      'your', 'does', 'were'
    ]);
    return stopWords.has(word);
  }
}

export default new RiskScoringService();
