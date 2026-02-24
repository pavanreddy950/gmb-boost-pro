import crypto from 'crypto';
import connectionPool from '../database/connectionPool.js';

/**
 * Content Fingerprint Service
 * Cross-account content duplicate detection to prevent Google from flagging
 * multiple business listings with suspiciously similar descriptions.
 *
 * Uses a three-layer approach:
 *   1. SHA-256 hash for exact duplicate detection
 *   2. SimHash (64-bit) for approximate similarity (Hamming distance)
 *   3. 3-gram shingles with Jaccard similarity for precise percentage
 *
 * All data is stored in the `profile_optimizations` table in the `fingerprints`
 * JSONB column. Each row's fingerprints object is keyed by content_type:
 *   { "description": { content_hash, simhash, shingles, content_preview, updated_at }, ... }
 */
class ContentFingerprintService {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.initPromise = null;

    // Stop words removed during normalization
    this.stopWords = new Set([
      'a', 'an', 'the', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
      'of', 'with', 'by', 'from', 'is', 'it', 'as', 'be', 'are', 'was',
      'were', 'been', 'has', 'have', 'had', 'do', 'does', 'did', 'will',
      'would', 'could', 'should', 'may', 'might', 'shall', 'can', 'not',
      'no', 'nor', 'so', 'if', 'than', 'that', 'this', 'these', 'those',
      'then', 'there', 'here', 'when', 'where', 'how', 'what', 'which',
      'who', 'whom', 'its', 'our', 'your', 'their', 'his', 'her', 'my',
      'we', 'you', 'they', 'he', 'she', 'me', 'him', 'us', 'them',
      'am', 'about', 'above', 'after', 'again', 'all', 'also', 'any',
      'because', 'before', 'between', 'both', 'each', 'few', 'into',
      'just', 'more', 'most', 'other', 'over', 'own', 'same', 'some',
      'such', 'very', 'too', 'only', 'up', 'out', 'down'
    ]);

    // Similarity thresholds
    this.thresholds = {
      safe:        { min: 0,  max: 30,  label: 'safe',        description: 'Content is unique' },
      low_concern: { min: 31, max: 50,  label: 'low_concern', description: 'Minor similarities detected' },
      warning:     { min: 51, max: 70,  label: 'warning',     description: 'Significant overlap, should review' },
      blocked:     { min: 71, max: 100, label: 'blocked',     description: 'Too similar, must rewrite' }
    };

    // SimHash: Hamming distance threshold for "similar" detection
    this.simhashSimilarityThreshold = 5;

    console.log('[ContentFingerprintService] Initialized');
  }

  // ---------------------------------------------------------------------------
  // INITIALIZATION
  // ---------------------------------------------------------------------------

  /**
   * Initialize database connection from the centralized connection pool.
   */
  async initialize() {
    if (this.initialized && this.client) {
      return;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  /** @private */
  async _doInitialize() {
    try {
      console.log('[ContentFingerprintService] Initializing connection from pool...');
      this.client = await connectionPool.getClient();
      this.initialized = true;
      console.log('[ContentFingerprintService] Database connection established');
    } catch (error) {
      console.error('[ContentFingerprintService] Failed to initialize:', error.message);
      this.initialized = false;
      this.initPromise = null;
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // TEXT NORMALIZATION
  // ---------------------------------------------------------------------------

  /**
   * Normalize content for fingerprinting:
   *   lowercase -> remove punctuation -> remove stop words -> collapse whitespace
   *
   * @param {string} text - Raw content
   * @returns {string} Normalized text
   */
  normalizeContent(text) {
    try {
      if (!text || typeof text !== 'string') return '';

      let normalized = text.toLowerCase();

      // Remove all punctuation and special characters (keep alphanumeric and spaces)
      normalized = normalized.replace(/[^a-z0-9\s]/g, '');

      // Split into words, remove stop words, rejoin
      const words = normalized.split(/\s+/).filter(word => {
        return word.length > 0 && !this.stopWords.has(word);
      });

      return words.join(' ');
    } catch (error) {
      console.error('[ContentFingerprintService] Error in normalizeContent:', error.message);
      return '';
    }
  }

  // ---------------------------------------------------------------------------
  // HASHING: SHA-256
  // ---------------------------------------------------------------------------

  /**
   * Generate a SHA-256 hash of normalized text for exact duplicate detection.
   *
   * @param {string} text - Text to hash (will be normalized first)
   * @returns {string} Hex-encoded SHA-256 hash
   */
  generateSHA256(text) {
    try {
      const normalized = this.normalizeContent(text);
      if (!normalized) return '';

      return crypto.createHash('sha256').update(normalized, 'utf8').digest('hex');
    } catch (error) {
      console.error('[ContentFingerprintService] Error in generateSHA256:', error.message);
      return '';
    }
  }

  // ---------------------------------------------------------------------------
  // SIMHASH (64-BIT)
  // ---------------------------------------------------------------------------

  /**
   * Generate a SimHash fingerprint for approximate similarity detection.
   *
   * Algorithm:
   *   1. Tokenize the normalized text into words
   *   2. Hash each word to a 64-bit value
   *   3. For each bit position, sum +1 (if bit is 1) or -1 (if bit is 0)
   *   4. Final hash: bit position i is 1 if sum[i] > 0, else 0
   *
   * We use BigInt for 64-bit precision.
   *
   * @param {string} text - Text to fingerprint
   * @returns {string} 64-bit SimHash as a hex string (16 characters)
   */
  generateSimHash(text) {
    try {
      const normalized = this.normalizeContent(text);
      if (!normalized) return '0000000000000000';

      const words = normalized.split(/\s+/).filter(w => w.length > 0);
      if (words.length === 0) return '0000000000000000';

      const BITS = 64;
      const vector = new Array(BITS).fill(0);

      for (const word of words) {
        const wordHash = this._hashWordTo64Bits(word);

        for (let i = 0; i < BITS; i++) {
          // Check if bit i is set (using BigInt operations)
          const bit = (wordHash >> BigInt(i)) & 1n;
          vector[i] += bit === 1n ? 1 : -1;
        }
      }

      // Build final hash
      let simhash = 0n;
      for (let i = 0; i < BITS; i++) {
        if (vector[i] > 0) {
          simhash |= (1n << BigInt(i));
        }
      }

      // Return as 16-character hex string (zero-padded)
      return simhash.toString(16).padStart(16, '0');
    } catch (error) {
      console.error('[ContentFingerprintService] Error in generateSimHash:', error.message);
      return '0000000000000000';
    }
  }

  // ---------------------------------------------------------------------------
  // SHINGLES (N-GRAM)
  // ---------------------------------------------------------------------------

  /**
   * Generate a set of hashed n-gram shingles from the text.
   * Each shingle is a sequence of n consecutive words, hashed to a 32-bit integer
   * for compact storage and fast comparison.
   *
   * @param {string} text - Text to shingle
   * @param {number} [n=3] - Size of each shingle (number of words)
   * @returns {number[]} Array of hashed shingle values (deduplicated)
   */
  generateShingles(text, n = 3) {
    try {
      const normalized = this.normalizeContent(text);
      if (!normalized) return [];

      const words = normalized.split(/\s+/).filter(w => w.length > 0);
      if (words.length < n) {
        // If text is shorter than shingle size, treat entire text as one shingle
        if (words.length === 0) return [];
        const singleShingle = this._hashShingle(words.join(' '));
        return [singleShingle];
      }

      const shingleSet = new Set();

      for (let i = 0; i <= words.length - n; i++) {
        const shingle = words.slice(i, i + n).join(' ');
        const hashed = this._hashShingle(shingle);
        shingleSet.add(hashed);
      }

      return Array.from(shingleSet);
    } catch (error) {
      console.error('[ContentFingerprintService] Error in generateShingles:', error.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // SIMILARITY CALCULATIONS
  // ---------------------------------------------------------------------------

  /**
   * Calculate Jaccard similarity between two sets of shingles.
   *   J(A, B) = |A intersect B| / |A union B|
   *
   * @param {number[]} shinglesA
   * @param {number[]} shinglesB
   * @returns {number} Similarity as a decimal between 0 and 1
   */
  calculateJaccardSimilarity(shinglesA, shinglesB) {
    try {
      if (!shinglesA || !shinglesB || shinglesA.length === 0 || shinglesB.length === 0) {
        return 0;
      }

      const setA = new Set(shinglesA);
      const setB = new Set(shinglesB);

      let intersectionSize = 0;
      for (const shingle of setA) {
        if (setB.has(shingle)) {
          intersectionSize++;
        }
      }

      // Union size = |A| + |B| - |intersection|
      const unionSize = setA.size + setB.size - intersectionSize;

      if (unionSize === 0) return 0;

      return intersectionSize / unionSize;
    } catch (error) {
      console.error('[ContentFingerprintService] Error in calculateJaccardSimilarity:', error.message);
      return 0;
    }
  }

  /**
   * Calculate Hamming distance between two SimHash values.
   * The Hamming distance is the number of bit positions where the hashes differ.
   *
   * @param {string} simhashA - Hex-encoded SimHash
   * @param {string} simhashB - Hex-encoded SimHash
   * @returns {number} Number of differing bits (0 = identical, 64 = maximally different)
   */
  calculateHammingDistance(simhashA, simhashB) {
    try {
      if (!simhashA || !simhashB) return 64;

      const a = BigInt('0x' + simhashA);
      const b = BigInt('0x' + simhashB);

      // XOR gives bits that differ, then count them
      let xor = a ^ b;
      let distance = 0;

      while (xor > 0n) {
        distance += Number(xor & 1n);
        xor >>= 1n;
      }

      return distance;
    } catch (error) {
      console.error('[ContentFingerprintService] Error in calculateHammingDistance:', error.message);
      return 64;
    }
  }

  // ---------------------------------------------------------------------------
  // DATABASE OPERATIONS
  // ---------------------------------------------------------------------------

  /**
   * Store a content fingerprint in the profile_optimizations row's fingerprints JSONB.
   * Fetches the latest row for this gmail_id + location_id, then updates
   * fingerprints[contentType] with the computed fingerprint data.
   *
   * @param {string} userId - The user/gmail ID
   * @param {string} locationId - The GBP location ID
   * @param {string} contentType - Type of content ('description', 'service_description', 'product', 'post')
   * @param {string} content - The raw content text
   * @returns {object|null} The stored fingerprint data for this content type, or null on failure
   */
  async storeFingerprint(userId, locationId, contentType, content) {
    try {
      await this.initialize();

      if (!userId || !locationId || !contentType || !content) {
        console.error('[ContentFingerprintService] storeFingerprint: missing required parameters');
        return null;
      }

      const contentHash = this.generateSHA256(content);
      const simhash = this.generateSimHash(content);
      const shingles = this.generateShingles(content, 3);

      // Content preview: first 200 chars for human readability
      const contentPreview = content.substring(0, 200) + (content.length > 200 ? '...' : '');

      const fingerprintData = {
        content_hash: contentHash,
        simhash: simhash,
        shingles: shingles,
        content_preview: contentPreview,
        updated_at: new Date().toISOString()
      };

      // Fetch the latest row for this user + location
      const { data: rows, error: fetchError } = await this.client
        .from('profile_optimizations')
        .select('id, fingerprints')
        .eq('gmail_id', userId)
        .eq('location_id', locationId)
        .order('created_at', { ascending: false })
        .limit(1);

      if (fetchError) {
        console.error('[ContentFingerprintService] Error fetching row for fingerprint storage:', fetchError.message);
        return null;
      }

      if (rows && rows.length > 0) {
        // Update existing row's fingerprints JSONB
        const row = rows[0];
        const fingerprints = row.fingerprints || {};
        fingerprints[contentType] = fingerprintData;

        const { error: updateError } = await this.client
          .from('profile_optimizations')
          .update({
            fingerprints: fingerprints,
            updated_at: new Date().toISOString()
          })
          .eq('id', row.id);

        if (updateError) {
          console.error('[ContentFingerprintService] Error updating fingerprints:', updateError.message);
          return null;
        }

        console.log(`[ContentFingerprintService] Stored fingerprint for user=${userId}, location=${locationId}, type=${contentType}, hash=${contentHash.substring(0, 12)}...`);
        return fingerprintData;
      } else {
        // No row exists - create a minimal row with just fingerprints
        const fingerprints = {};
        fingerprints[contentType] = fingerprintData;

        const { error: insertError } = await this.client
          .from('profile_optimizations')
          .insert({
            id: crypto.randomUUID(),
            gmail_id: userId,
            location_id: locationId,
            status: 'pending',
            fingerprints: fingerprints,
            suggestions: [],
            deployments: [],
            change_history: [],
            settings: {},
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          });

        if (insertError) {
          console.error('[ContentFingerprintService] Error inserting row for fingerprints:', insertError.message);
          return null;
        }

        console.log(`[ContentFingerprintService] Created new row and stored fingerprint for user=${userId}, location=${locationId}, type=${contentType}, hash=${contentHash.substring(0, 12)}...`);
        return fingerprintData;
      }

    } catch (error) {
      console.error('[ContentFingerprintService] Error in storeFingerprint:', error.message);
      return null;
    }
  }

  /**
   * Check how unique a piece of content is compared to all other content
   * of the same type belonging to the same user (cross-location check).
   *
   * Reads fingerprints from the JSONB column of all profile_optimizations rows
   * for this gmail_id, then applies the 3-layer comparison approach.
   *
   * @param {string} userId - The user/gmail ID
   * @param {string} contentType - Type of content to compare against
   * @param {string} content - The content to check
   * @returns {{ isUnique: boolean, similarityScore: number, mostSimilarLocation: string|null, level: string }}
   */
  async checkUniqueness(userId, contentType, content) {
    try {
      await this.initialize();

      if (!userId || !contentType || !content) {
        return {
          isUnique: true,
          similarityScore: 0,
          mostSimilarLocation: null,
          level: 'safe'
        };
      }

      // Generate fingerprints for the new content
      const newHash = this.generateSHA256(content);
      const newSimHash = this.generateSimHash(content);
      const newShingles = this.generateShingles(content, 3);

      // Fetch existing fingerprints for this user and content type
      const existingFingerprints = await this.getFingerprints(userId, contentType);

      if (!existingFingerprints || existingFingerprints.length === 0) {
        console.log('[ContentFingerprintService] No existing fingerprints found - content is unique');
        return {
          isUnique: true,
          similarityScore: 0,
          mostSimilarLocation: null,
          level: 'safe'
        };
      }

      let highestSimilarity = 0;
      let mostSimilarLocation = null;

      for (const fp of existingFingerprints) {
        // Layer 1: Exact hash match
        if (fp.content_hash === newHash) {
          console.log(`[ContentFingerprintService] Exact duplicate detected for location ${fp.location_id}`);
          return {
            isUnique: false,
            similarityScore: 100,
            mostSimilarLocation: fp.location_id,
            level: 'blocked'
          };
        }

        // Layer 2: SimHash approximate check (fast pre-filter)
        const hammingDist = this.calculateHammingDistance(fp.simhash, newSimHash);
        const simhashSimilar = hammingDist < this.simhashSimilarityThreshold;

        // Layer 3: Jaccard similarity for precise measurement
        let existingShingles;
        try {
          existingShingles = typeof fp.shingles === 'string' ? JSON.parse(fp.shingles) : fp.shingles;
        } catch (parseErr) {
          console.error(`[ContentFingerprintService] Error parsing shingles for location ${fp.location_id}:`, parseErr.message);
          existingShingles = [];
        }

        const jaccardSim = this.calculateJaccardSimilarity(newShingles, existingShingles);
        const similarityPercent = Math.round(jaccardSim * 100);

        // Use the higher signal: if SimHash says similar but Jaccard is low, use Jaccard as ground truth
        // If SimHash says different but Jaccard is high, trust Jaccard
        let effectiveSimilarity = similarityPercent;

        // Boost similarity score if both signals agree
        if (simhashSimilar && similarityPercent > 30) {
          effectiveSimilarity = Math.min(100, similarityPercent + 5);
        }

        if (effectiveSimilarity > highestSimilarity) {
          highestSimilarity = effectiveSimilarity;
          mostSimilarLocation = fp.location_id;
        }
      }

      // Determine level based on thresholds
      let level;
      if (highestSimilarity <= 30) {
        level = 'safe';
      } else if (highestSimilarity <= 50) {
        level = 'low_concern';
      } else if (highestSimilarity <= 70) {
        level = 'warning';
      } else {
        level = 'blocked';
      }

      const isUnique = level === 'safe';

      console.log(`[ContentFingerprintService] Uniqueness check: similarity=${highestSimilarity}%, level=${level}, mostSimilar=${mostSimilarLocation}`);

      return {
        isUnique,
        similarityScore: highestSimilarity,
        mostSimilarLocation,
        level
      };

    } catch (error) {
      console.error('[ContentFingerprintService] Error in checkUniqueness:', error.message);
      // Default to safe on error to avoid blocking legitimate content
      return {
        isUnique: true,
        similarityScore: 0,
        mostSimilarLocation: null,
        level: 'safe'
      };
    }
  }

  /**
   * Retrieve all stored fingerprints for a user and content type.
   * Fetches all profile_optimizations rows for this gmail_id, extracts
   * fingerprints[contentType] from each row that has it, and returns
   * them as an array with location_id added for reference.
   *
   * @param {string} userId - The user/gmail ID
   * @param {string} contentType - Type of content ('description', 'service_description', 'product', 'post')
   * @returns {Array} Array of fingerprint objects, each with location_id
   */
  async getFingerprints(userId, contentType) {
    try {
      await this.initialize();

      if (!userId || !contentType) {
        console.error('[ContentFingerprintService] getFingerprints: missing userId or contentType');
        return [];
      }

      const { data: rows, error } = await this.client
        .from('profile_optimizations')
        .select('location_id, fingerprints')
        .eq('gmail_id', userId)
        .order('updated_at', { ascending: false });

      if (error) {
        console.error('[ContentFingerprintService] Error fetching fingerprints:', error.message);
        return [];
      }

      const results = [];
      for (const row of (rows || [])) {
        const fingerprints = row.fingerprints || {};
        if (fingerprints[contentType]) {
          results.push({
            ...fingerprints[contentType],
            location_id: row.location_id
          });
        }
      }

      console.log(`[ContentFingerprintService] Retrieved ${results.length} fingerprints for user=${userId}, type=${contentType}`);
      return results;

    } catch (error) {
      console.error('[ContentFingerprintService] Error in getFingerprints:', error.message);
      return [];
    }
  }

  // ---------------------------------------------------------------------------
  // PRIVATE HELPERS
  // ---------------------------------------------------------------------------

  /**
   * Hash a single word to a 64-bit BigInt using MD5 (taking first 8 bytes).
   * MD5 is used here for speed; this is not a security context.
   * @private
   */
  _hashWordTo64Bits(word) {
    try {
      const hash = crypto.createHash('md5').update(word, 'utf8').digest();
      // Read first 8 bytes as a BigInt (little-endian)
      let result = 0n;
      for (let i = 0; i < 8; i++) {
        result |= BigInt(hash[i]) << BigInt(i * 8);
      }
      return result;
    } catch (error) {
      console.error('[ContentFingerprintService] Error in _hashWordTo64Bits:', error.message);
      return 0n;
    }
  }

  /**
   * Hash a shingle string to a 32-bit integer for compact storage.
   * Uses the first 4 bytes of an MD5 hash.
   * @private
   */
  _hashShingle(shingle) {
    try {
      const hash = crypto.createHash('md5').update(shingle, 'utf8').digest();
      // Read first 4 bytes as unsigned 32-bit integer (little-endian)
      return hash.readUInt32LE(0);
    } catch (error) {
      console.error('[ContentFingerprintService] Error in _hashShingle:', error.message);
      return 0;
    }
  }
}

export default new ContentFingerprintService();
