/**
 * Content Sanitizer Service
 * Sanitizes AI-generated content before it is presented to users or applied
 * to Google Business Profile listings. Enforces character limits, removes
 * prohibited patterns, and ensures compliance with GBP guidelines.
 */
class ContentSanitizer {
  constructor() {
    // Superlatives that violate GBP guidelines
    this.superlativePatterns = [
      /\bbest\b/gi,
      /\b#1\b/gi,
      /\btop-rated\b/gi,
      /\btop rated\b/gi,
      /\bguaranteed\b/gi,
      /\bcheapest\b/gi,
      /\bleading\b/gi,
      /\bpremier\b/gi,
      /\bfinest\b/gi,
      /\bnumber one\b/gi,
      /\bnumber 1\b/gi
    ];

    // Emoji regex pattern (covers most Unicode emoji ranges)
    this.emojiRegex = /[\u{1F600}-\u{1F64F}\u{1F300}-\u{1F5FF}\u{1F680}-\u{1F6FF}\u{1F1E0}-\u{1F1FF}\u{2600}-\u{26FF}\u{2700}-\u{27BF}\u{FE00}-\u{FE0F}\u{1F900}-\u{1F9FF}\u{1FA00}-\u{1FA6F}\u{1FA70}-\u{1FAFF}\u{200D}\u{20E3}\u{E0020}-\u{E007F}]/gu;

    // Phone number patterns (US, international, various separators)
    this.phonePatterns = [
      /(\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}/g,            // (555) 123-4567, 555-123-4567, +1 555 123 4567
      /(\+?\d{1,3}[-.\s]?)?\d{2,4}[-.\s]\d{3,4}[-.\s]\d{3,4}/g,              // 55-1234-5678
      /\b\d{10,11}\b/g,                                                         // 5551234567 (10-11 consecutive digits)
      /\b1[-.\s]?800[-.\s]?\d{3}[-.\s]?\d{4}\b/g,                             // 1-800-XXX-XXXX
      /\b(?:tel|phone|call|fax)[:\s]*[\d\s.()+\-]{7,}/gi                       // tel: 555-1234, phone: ...
    ];

    // URL patterns
    this.urlPatterns = [
      /https?:\/\/[^\s,)]+/gi,
      /www\.[^\s,)]+/gi,
      /[a-zA-Z0-9][-a-zA-Z0-9]*\.(com|org|net|io|co|us|biz|info|me)\b[^\s,)]*/gi
    ];

    // Spam patterns (excessive punctuation, promotional language)
    this.spamPatterns = [
      /!{3,}/g,                    // Three or more exclamation marks
      /\?{3,}/g,                   // Three or more question marks
      /[!?]{2,}[!?]+/g,           // Mixed excessive punctuation (?!?!?)
      /\${2,}/g,                   // Multiple dollar signs
      /\bfree\s+money\b/gi,
      /\bcall\s+now\b/gi,
      /\bact\s+now\b/gi,
      /\blimited\s+time\s+offer\b/gi,
      /\bdon'?t\s+miss\s+out\b/gi,
      /\bhurry\b/gi,
      /\bbuy\s+one\s+get\s+one\b/gi,
      /\bdiscount\s+code\b/gi
    ];

    // Common acronyms allowed in ALL CAPS (up to 5 chars)
    this.allowedAcronyms = new Set([
      'LLC', 'INC', 'HVAC', 'AC', 'IT', 'HR', 'CEO', 'CFO', 'CTO', 'COO',
      'USA', 'UK', 'EU', 'ATM', 'SEO', 'SEM', 'PPC', 'CPA', 'CRM', 'ERP',
      'DBA', 'PA', 'MD', 'PhD', 'RN', 'DDS', 'DMD', 'OD', 'DO', 'DC',
      'PC', 'PLLC', 'LLP', 'LP', 'NP', 'PE', 'RA', 'AIA', 'LEED',
      'BBQ', 'DIY', 'FAQ', 'VIP', 'ASAP', 'GPS', 'LED', 'TV', 'CCTV',
      'DOT', 'OSHA', 'EPA', 'FHA', 'VA', 'HOA', 'CDL'
    ]);

    // Stop words for keyword density calculation
    this.stopWords = new Set([
      'the', 'and', 'for', 'are', 'but', 'not', 'you', 'all', 'can', 'has',
      'her', 'was', 'one', 'our', 'out', 'his', 'had', 'how', 'its',
      'may', 'who', 'did', 'get', 'got', 'let', 'say', 'she', 'too', 'use',
      'this', 'that', 'with', 'have', 'from', 'they', 'been', 'said', 'each',
      'will', 'than', 'them', 'then', 'what', 'when', 'make', 'like', 'just',
      'over', 'such', 'also', 'into', 'year', 'some', 'more', 'very', 'most',
      'about', 'after', 'which', 'their', 'would', 'there', 'could', 'other',
      'these', 'where', 'being', 'those', 'still', 'while', 'should', 'through',
      'your', 'does', 'were'
    ]);

    console.log('[ContentSanitizer] Initialized');
  }

  // ---------------------------------------------------------------------------
  // PRIMARY SANITIZATION METHODS
  // ---------------------------------------------------------------------------

  /**
   * Sanitize a GBP business description.
   * Applies all hard-rule-aligned cleaning:
   *   - Enforce 750 char max
   *   - Remove phone numbers
   *   - Remove URLs
   *   - Remove emojis
   *   - Remove ALL CAPS words (preserve acronyms <= 5 chars)
   *   - Remove superlatives
   *   - Ensure single city mention (if city provided in options)
   *   - Enforce keyword density <= 5%
   *
   * @param {string} text - Raw description text
   * @param {object} [options] - Optional settings
   * @param {string} [options.city] - City name to enforce single-mention rule
   * @returns {string} Cleaned description text
   */
  sanitizeDescription(text, options = {}) {
    try {
      if (!text || typeof text !== 'string') {
        console.log('[ContentSanitizer] sanitizeDescription: empty or invalid input');
        return '';
      }

      let cleaned = text;

      // Remove phone numbers
      cleaned = this.removePhoneNumbers(cleaned);

      // Remove URLs
      cleaned = this.removeUrls(cleaned);

      // Remove emojis
      cleaned = this.removeEmojis(cleaned);

      // Remove ALL CAPS words (preserve acronyms)
      cleaned = this._fixAllCapsWords(cleaned);

      // Remove superlatives
      cleaned = this.removeSuperlatives(cleaned);

      // Ensure single city mention
      if (options.city) {
        cleaned = this._enforceSingleCityMention(cleaned, options.city);
      }

      // Enforce keyword density (max 5% for descriptions)
      const densityResult = this.enforceKeywordDensity(cleaned, 5);
      cleaned = densityResult.text;

      // Clean up whitespace artifacts from removals
      cleaned = this._cleanWhitespace(cleaned);

      // Enforce 750 char max
      const charResult = this.validateCharacterLimit(cleaned, 750);
      if (!charResult.valid) {
        cleaned = charResult.truncated;
        console.log(`[ContentSanitizer] Description truncated from ${charResult.currentLength} to 750 chars`);
      }

      console.log(`[ContentSanitizer] sanitizeDescription: ${text.length} -> ${cleaned.length} chars`);
      return cleaned;

    } catch (error) {
      console.error('[ContentSanitizer] Error in sanitizeDescription:', error.message);
      // Return truncated original as fallback
      return (text || '').substring(0, 750);
    }
  }

  /**
   * Sanitize a GBP service description.
   * Enforces 1000 char max, removes spam patterns, checks keyword density (max 4%).
   *
   * @param {string} text - Raw service description
   * @returns {string} Cleaned service description
   */
  sanitizeServiceDescription(text) {
    try {
      if (!text || typeof text !== 'string') {
        return '';
      }

      let cleaned = text;

      // Remove spam patterns
      cleaned = this._removeSpamPatterns(cleaned);

      // Remove phone numbers
      cleaned = this.removePhoneNumbers(cleaned);

      // Remove URLs
      cleaned = this.removeUrls(cleaned);

      // Remove emojis
      cleaned = this.removeEmojis(cleaned);

      // Remove superlatives
      cleaned = this.removeSuperlatives(cleaned);

      // Enforce keyword density (max 4% for service descriptions)
      const densityResult = this.enforceKeywordDensity(cleaned, 4);
      cleaned = densityResult.text;

      // Clean up whitespace
      cleaned = this._cleanWhitespace(cleaned);

      // Enforce 1000 char max
      const charResult = this.validateCharacterLimit(cleaned, 1000);
      if (!charResult.valid) {
        cleaned = charResult.truncated;
        console.log(`[ContentSanitizer] Service description truncated from ${charResult.currentLength} to 1000 chars`);
      }

      console.log(`[ContentSanitizer] sanitizeServiceDescription: ${text.length} -> ${cleaned.length} chars`);
      return cleaned;

    } catch (error) {
      console.error('[ContentSanitizer] Error in sanitizeServiceDescription:', error.message);
      return (text || '').substring(0, 1000);
    }
  }

  /**
   * Sanitize a GBP product description.
   * Enforces 1000 char max, removes spam patterns.
   *
   * @param {string} text - Raw product description
   * @returns {string} Cleaned product description
   */
  sanitizeProductDescription(text) {
    try {
      if (!text || typeof text !== 'string') {
        return '';
      }

      let cleaned = text;

      // Remove spam patterns
      cleaned = this._removeSpamPatterns(cleaned);

      // Remove phone numbers
      cleaned = this.removePhoneNumbers(cleaned);

      // Remove URLs
      cleaned = this.removeUrls(cleaned);

      // Remove emojis
      cleaned = this.removeEmojis(cleaned);

      // Clean up whitespace
      cleaned = this._cleanWhitespace(cleaned);

      // Enforce 1000 char max
      const charResult = this.validateCharacterLimit(cleaned, 1000);
      if (!charResult.valid) {
        cleaned = charResult.truncated;
        console.log(`[ContentSanitizer] Product description truncated from ${charResult.currentLength} to 1000 chars`);
      }

      console.log(`[ContentSanitizer] sanitizeProductDescription: ${text.length} -> ${cleaned.length} chars`);
      return cleaned;

    } catch (error) {
      console.error('[ContentSanitizer] Error in sanitizeProductDescription:', error.message);
      return (text || '').substring(0, 1000);
    }
  }

  /**
   * Sanitize a review reply.
   * Max 500 chars, professional tone (no ALL CAPS, no excessive punctuation).
   *
   * @param {string} text - Raw review reply text
   * @returns {string} Cleaned review reply
   */
  sanitizeReviewReply(text) {
    try {
      if (!text || typeof text !== 'string') {
        return '';
      }

      let cleaned = text;

      // Remove emojis
      cleaned = this.removeEmojis(cleaned);

      // Fix ALL CAPS words for professional tone
      cleaned = this._fixAllCapsWords(cleaned);

      // Reduce excessive punctuation (more than 2 of the same in a row)
      cleaned = cleaned.replace(/!{2,}/g, '!');
      cleaned = cleaned.replace(/\?{2,}/g, '?');
      cleaned = cleaned.replace(/\.{4,}/g, '...');

      // Remove aggressive language patterns
      cleaned = cleaned.replace(/\bNEVER\b/g, 'never');
      cleaned = cleaned.replace(/\bALWAYS\b/g, 'always');

      // Clean up whitespace
      cleaned = this._cleanWhitespace(cleaned);

      // Enforce 500 char max
      const charResult = this.validateCharacterLimit(cleaned, 500);
      if (!charResult.valid) {
        cleaned = charResult.truncated;
        console.log(`[ContentSanitizer] Review reply truncated from ${charResult.currentLength} to 500 chars`);
      }

      console.log(`[ContentSanitizer] sanitizeReviewReply: ${text.length} -> ${cleaned.length} chars`);
      return cleaned;

    } catch (error) {
      console.error('[ContentSanitizer] Error in sanitizeReviewReply:', error.message);
      return (text || '').substring(0, 500);
    }
  }

  // ---------------------------------------------------------------------------
  // KEYWORD DENSITY ENFORCEMENT
  // ---------------------------------------------------------------------------

  /**
   * If any keyword exceeds the maximum density percentage, remove excess
   * occurrences from the text (keeping the first N that are within bounds).
   *
   * @param {string} text - The text to check
   * @param {number} maxDensityPercent - Maximum allowed density (e.g. 5 for 5%)
   * @returns {{ text: string, modified: boolean, removedKeywords: string[] }}
   */
  enforceKeywordDensity(text, maxDensityPercent) {
    try {
      if (!text || typeof text !== 'string' || text.trim().length === 0) {
        return { text: text || '', modified: false, removedKeywords: [] };
      }

      const words = text.toLowerCase().replace(/[^a-z0-9\s'-]/g, '').split(/\s+/).filter(w => w.length > 2);
      const totalWords = words.length;

      if (totalWords === 0) {
        return { text, modified: false, removedKeywords: [] };
      }

      // Count non-stopword frequencies
      const freq = {};
      for (const word of words) {
        if (this.stopWords.has(word)) continue;
        freq[word] = (freq[word] || 0) + 1;
      }

      // Find keywords that exceed the density limit
      const maxAllowedCount = Math.floor((maxDensityPercent / 100) * totalWords);
      const overLimitKeywords = [];

      for (const [word, count] of Object.entries(freq)) {
        if (count > maxAllowedCount && maxAllowedCount > 0) {
          overLimitKeywords.push({ word, count, excess: count - maxAllowedCount });
        }
      }

      if (overLimitKeywords.length === 0) {
        return { text, modified: false, removedKeywords: [] };
      }

      // Remove excess occurrences (keep the first maxAllowedCount, remove the rest)
      let modifiedText = text;
      const removedKeywords = [];

      for (const { word, excess } of overLimitKeywords) {
        const escapedWord = word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(`\\b${escapedWord}\\b`, 'gi');

        let occurrenceIndex = 0;
        let removalsLeft = excess;

        modifiedText = modifiedText.replace(regex, (match) => {
          occurrenceIndex++;
          if (occurrenceIndex > maxAllowedCount && removalsLeft > 0) {
            removalsLeft--;
            return ''; // Remove this occurrence
          }
          return match; // Keep this occurrence
        });

        removedKeywords.push(word);
        console.log(`[ContentSanitizer] Removed ${excess} excess occurrence(s) of "${word}" (was ${excess + maxAllowedCount}, max allowed ${maxAllowedCount})`);
      }

      // Clean up double spaces from removals
      modifiedText = this._cleanWhitespace(modifiedText);

      return { text: modifiedText, modified: true, removedKeywords };

    } catch (error) {
      console.error('[ContentSanitizer] Error in enforceKeywordDensity:', error.message);
      return { text, modified: false, removedKeywords: [] };
    }
  }

  // ---------------------------------------------------------------------------
  // INDIVIDUAL REMOVAL METHODS
  // ---------------------------------------------------------------------------

  /**
   * Remove superlative words and phrases from text.
   *
   * @param {string} text
   * @returns {string}
   */
  removeSuperlatives(text) {
    try {
      if (!text || typeof text !== 'string') return '';

      let cleaned = text;
      for (const pattern of this.superlativePatterns) {
        // Reset lastIndex for global regexes
        pattern.lastIndex = 0;
        cleaned = cleaned.replace(pattern, '');
      }

      return this._cleanWhitespace(cleaned);
    } catch (error) {
      console.error('[ContentSanitizer] Error in removeSuperlatives:', error.message);
      return text;
    }
  }

  /**
   * Remove phone numbers from text.
   *
   * @param {string} text
   * @returns {string}
   */
  removePhoneNumbers(text) {
    try {
      if (!text || typeof text !== 'string') return '';

      let cleaned = text;
      for (const pattern of this.phonePatterns) {
        pattern.lastIndex = 0;
        cleaned = cleaned.replace(pattern, '');
      }

      return this._cleanWhitespace(cleaned);
    } catch (error) {
      console.error('[ContentSanitizer] Error in removePhoneNumbers:', error.message);
      return text;
    }
  }

  /**
   * Remove URLs from text.
   *
   * @param {string} text
   * @returns {string}
   */
  removeUrls(text) {
    try {
      if (!text || typeof text !== 'string') return '';

      let cleaned = text;
      for (const pattern of this.urlPatterns) {
        pattern.lastIndex = 0;
        cleaned = cleaned.replace(pattern, '');
      }

      return this._cleanWhitespace(cleaned);
    } catch (error) {
      console.error('[ContentSanitizer] Error in removeUrls:', error.message);
      return text;
    }
  }

  /**
   * Remove all emoji characters from text.
   *
   * @param {string} text
   * @returns {string}
   */
  removeEmojis(text) {
    try {
      if (!text || typeof text !== 'string') return '';

      return text.replace(this.emojiRegex, '').trim();
    } catch (error) {
      console.error('[ContentSanitizer] Error in removeEmojis:', error.message);
      return text;
    }
  }

  // ---------------------------------------------------------------------------
  // CHARACTER LIMIT VALIDATION
  // ---------------------------------------------------------------------------

  /**
   * Validate text against a character limit. If exceeded, truncate at the last
   * complete sentence or word boundary.
   *
   * @param {string} text
   * @param {number} maxChars
   * @returns {{ valid: boolean, currentLength: number, maxLength: number, truncated: string }}
   */
  validateCharacterLimit(text, maxChars) {
    try {
      if (!text || typeof text !== 'string') {
        return { valid: true, currentLength: 0, maxLength: maxChars, truncated: '' };
      }

      const currentLength = text.length;

      if (currentLength <= maxChars) {
        return { valid: true, currentLength, maxLength: maxChars, truncated: text };
      }

      // Truncate at last complete sentence within limit
      let truncated = text.substring(0, maxChars);

      // Try to find the last sentence boundary (. ! ?)
      const lastSentenceEnd = Math.max(
        truncated.lastIndexOf('. '),
        truncated.lastIndexOf('! '),
        truncated.lastIndexOf('? '),
        truncated.lastIndexOf('.\n'),
        truncated.lastIndexOf('!\n'),
        truncated.lastIndexOf('?\n')
      );

      if (lastSentenceEnd > maxChars * 0.5) {
        // Only use sentence boundary if it preserves at least 50% of the content
        truncated = truncated.substring(0, lastSentenceEnd + 1).trim();
      } else {
        // Fall back to last word boundary
        const lastSpace = truncated.lastIndexOf(' ');
        if (lastSpace > maxChars * 0.5) {
          truncated = truncated.substring(0, lastSpace).trim();
        }
        // If no good boundary, just hard truncate (already done above)
      }

      // Ensure truncated text does not end with dangling punctuation
      truncated = truncated.replace(/[,;:\s]+$/, '').trim();

      // Add ellipsis if we cut mid-thought and there is room
      if (truncated.length < maxChars - 3 && !truncated.match(/[.!?]$/)) {
        truncated += '...';
      }

      return {
        valid: false,
        currentLength,
        maxLength: maxChars,
        truncated
      };

    } catch (error) {
      console.error('[ContentSanitizer] Error in validateCharacterLimit:', error.message);
      return {
        valid: text.length <= maxChars,
        currentLength: text.length,
        maxLength: maxChars,
        truncated: text.substring(0, maxChars)
      };
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Convert ALL CAPS words to title case, preserving recognized acronyms.
   * @private
   */
  _fixAllCapsWords(text) {
    try {
      if (!text) return '';

      return text.replace(/\b([A-Z]{2,})\b/g, (match) => {
        // Preserve recognized acronyms (up to 5 chars)
        if (match.length <= 5 && this.allowedAcronyms.has(match)) {
          return match;
        }

        // Convert to title case
        return match.charAt(0).toUpperCase() + match.slice(1).toLowerCase();
      });
    } catch (error) {
      console.error('[ContentSanitizer] Error in _fixAllCapsWords:', error.message);
      return text;
    }
  }

  /**
   * Ensure a city name appears at most once in the text.
   * Removes all but the first occurrence.
   * @private
   */
  _enforceSingleCityMention(text, city) {
    try {
      if (!text || !city) return text || '';

      const escapedCity = city.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const cityRegex = new RegExp(`\\b${escapedCity}\\b`, 'gi');

      let occurrenceIndex = 0;
      const cleaned = text.replace(cityRegex, (match) => {
        occurrenceIndex++;
        if (occurrenceIndex === 1) {
          return match; // Keep first occurrence
        }
        return ''; // Remove subsequent occurrences
      });

      if (occurrenceIndex > 1) {
        console.log(`[ContentSanitizer] Removed ${occurrenceIndex - 1} extra mention(s) of city "${city}"`);
      }

      return this._cleanWhitespace(cleaned);
    } catch (error) {
      console.error('[ContentSanitizer] Error in _enforceSingleCityMention:', error.message);
      return text;
    }
  }

  /**
   * Remove spam patterns from text.
   * @private
   */
  _removeSpamPatterns(text) {
    try {
      if (!text) return '';

      let cleaned = text;
      for (const pattern of this.spamPatterns) {
        pattern.lastIndex = 0;
        cleaned = cleaned.replace(pattern, '');
      }

      return cleaned;
    } catch (error) {
      console.error('[ContentSanitizer] Error in _removeSpamPatterns:', error.message);
      return text;
    }
  }

  /**
   * Normalize whitespace: collapse multiple spaces, remove leading/trailing
   * whitespace from lines, remove blank lines created by removals.
   * @private
   */
  _cleanWhitespace(text) {
    if (!text) return '';

    return text
      .replace(/[ \t]{2,}/g, ' ')       // Collapse multiple spaces/tabs to single space
      .replace(/ +\n/g, '\n')            // Remove trailing spaces before newlines
      .replace(/\n{3,}/g, '\n\n')        // Collapse 3+ newlines to 2
      .replace(/^\s+|\s+$/g, '')         // Trim leading/trailing whitespace
      .replace(/ ([.,;:!?])/g, '$1');    // Remove space before punctuation (artifact of removals)
  }
}

export default new ContentSanitizer();
