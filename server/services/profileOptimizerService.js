import crypto from 'crypto';
import connectionPool from '../database/connectionPool.js';
import profileAuditEngine from './profileAuditEngine.js';
import aiSuggestionService from './aiSuggestionService.js';
import riskScoringService from './riskScoringService.js';
import contentSanitizer from './contentSanitizer.js';
import contentFingerprintService from './contentFingerprintService.js';
import deploymentScheduler from './deploymentScheduler.js';

/**
 * Profile Optimizer Service - Main Orchestrator
 * Ties together all optimization services:
 * 1. Audit Engine → scores the profile
 * 2. AI Suggestion Service → generates improvement suggestions
 * 3. Risk Scoring → validates safety of each suggestion
 * 4. Content Sanitizer → cleans generated content
 * 5. Content Fingerprint → checks cross-account uniqueness
 * 6. Deployment Scheduler → manages gradual rollout
 *
 * Uses single `profile_optimizations` table with JSONB arrays for
 * suggestions, deployments, and change_history.
 */
class ProfileOptimizerService {
  constructor() {
    this.client = null;
    this.initialized = false;
    console.log('[ProfileOptimizer] Instance created');
  }

  async initialize() {
    if (this.initialized) return;
    try {
      this.client = await connectionPool.getClient();
      this.initialized = true;
      console.log('[ProfileOptimizer] Initialized');
    } catch (error) {
      console.error('[ProfileOptimizer] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Main entry point: Run full optimization pipeline
   * Step 1: Create job → Step 2: Audit → Step 3: Generate AI suggestions → Step 4: Score risks → Step 5: Return results
   */
  async runOptimization(userId, locationId, accountId, profileData, businessContext = null) {
    await this.initialize();

    console.log(`[ProfileOptimizer] Starting optimization for location ${locationId}`);
    const startTime = Date.now();

    // Step 1: Create optimization job
    const job = await this._createJob(userId, locationId, accountId);

    try {
      // Step 2: Update status to auditing
      await this._updateJobStatus(job.id, 'auditing');

      // Step 3: Run the comprehensive audit
      console.log('[ProfileOptimizer] Running comprehensive audit...');
      const auditResults = await profileAuditEngine.runFullAudit(profileData);

      // Save audit results to job
      await this.client
        .from('profile_optimizations')
        .update({
          audit_score: auditResults.overallScore,
          audit_data: auditResults,
          updated_at: new Date().toISOString()
        })
        .eq('id', job.id);

      console.log(`[ProfileOptimizer] Audit complete: Score ${auditResults.overallScore}/100`);

      // Step 4: Generate AI suggestions
      await this._updateJobStatus(job.id, 'generating');
      console.log('[ProfileOptimizer] Generating AI suggestions...');

      const aiResult = await aiSuggestionService.generateAllSuggestions(profileData, auditResults, businessContext);
      const rawSuggestions = aiResult.suggestions || [];
      console.log(`[ProfileOptimizer] Generated ${rawSuggestions.length} raw suggestions (${(aiResult.errors || []).length} errors)`);

      // Step 5: Sanitize + Risk Score + Fingerprint each suggestion
      const processedSuggestions = [];

      for (const suggestion of rawSuggestions) {
        try {
          const processed = await this._processSuggestion(suggestion, profileData, userId, locationId);
          if (processed) {
            // Save to database (appends to JSONB array)
            const saved = await this._saveSuggestion(job.id, processed);
            processedSuggestions.push(saved);
          }
        } catch (error) {
          console.error(`[ProfileOptimizer] Failed to process suggestion (${suggestion.type}):`, error.message);
        }
      }

      // Update job status to reviewing
      await this._updateJobStatus(job.id, 'reviewing');

      const elapsed = Date.now() - startTime;
      console.log(`[ProfileOptimizer] Optimization complete in ${elapsed}ms. ${processedSuggestions.length} suggestions generated.`);

      return {
        job: {
          id: job.id,
          status: 'reviewing',
          audit_score: auditResults.overallScore,
          created_at: job.created_at
        },
        audit: auditResults,
        suggestions: processedSuggestions
      };

    } catch (error) {
      console.error(`[ProfileOptimizer] Optimization failed:`, error.message);
      await this._updateJobStatus(job.id, 'failed', error.message);
      throw error;
    }
  }

  /**
   * Process a single suggestion through sanitizer, risk scorer, and fingerprinter
   */
  async _processSuggestion(suggestion, profileData, userId, locationId) {
    // Step 1: Sanitize content
    let sanitizedContent = suggestion.content;

    const raw = suggestion.content;

    switch (suggestion.type) {
      case 'description':
        // content = { description: "...", reasoning: "...", keywordsUsed: [], charCount: N }
        // sanitize only the description text, then re-wrap with full object for display
        if (raw && typeof raw === 'object') {
          const cleanDesc = contentSanitizer.sanitizeDescription(raw.description || '');
          sanitizedContent = JSON.stringify({ ...raw, description: cleanDesc });
        } else {
          sanitizedContent = contentSanitizer.sanitizeDescription(raw || '');
        }
        break;

      case 'service_description':
      case 'services':
        // content = { services: [{ name, description, isNew, keywords }] }
        if (raw && typeof raw === 'object' && Array.isArray(raw.services)) {
          const cleaned = raw.services.map(s => ({
            ...s,
            description: contentSanitizer.sanitizeServiceDescription(s.description || '')
          }));
          sanitizedContent = JSON.stringify({ ...raw, services: cleaned });
        } else {
          sanitizedContent = JSON.stringify(raw);
        }
        break;

      case 'product':
      case 'products':
        // content = { products: [{ name, description, category, suggestedPriceRange }] }
        if (raw && typeof raw === 'object' && Array.isArray(raw.products)) {
          const cleaned = raw.products.map(p => ({
            ...p,
            description: contentSanitizer.sanitizeProductDescription(p.description || '')
          }));
          sanitizedContent = JSON.stringify({ ...raw, products: cleaned });
        } else {
          sanitizedContent = JSON.stringify(raw);
        }
        break;

      case 'reply_template':
      case 'replyTemplates':
        // content = { templates: { positive, neutral, negative } }
        if (raw && typeof raw === 'object' && raw.templates) {
          sanitizedContent = JSON.stringify({
            templates: {
              positive: contentSanitizer.sanitizeReviewReply(raw.templates.positive || ''),
              neutral: contentSanitizer.sanitizeReviewReply(raw.templates.neutral || ''),
              negative: contentSanitizer.sanitizeReviewReply(raw.templates.negative || '')
            }
          });
        } else {
          sanitizedContent = JSON.stringify(raw);
        }
        break;

      default:
        // For all other types (categories, attributes, photoGuide, hours, social_links, posts)
        // just store the full AI response as JSON
        sanitizedContent = typeof raw === 'object' ? JSON.stringify(raw) : (raw || '');
    }

    // Step 2: Risk scoring
    const riskResult = riskScoringService.scoreSuggestion(
      {
        type: suggestion.type,
        content: sanitizedContent,
        originalContent: suggestion.originalContent
      },
      profileData,
      []
    );

    // Step 3: Content fingerprinting (only for text content types)
    let uniquenessResult = null;
    if (['description', 'service_description', 'product'].includes(suggestion.type)) {
      try {
        const textContent = typeof sanitizedContent === 'string'
          ? sanitizedContent
          : JSON.stringify(sanitizedContent);
        uniquenessResult = await contentFingerprintService.checkUniqueness(
          userId,
          suggestion.type,
          textContent
        );
      } catch (error) {
        console.log(`[ProfileOptimizer] Fingerprint check skipped: ${error.message}`);
      }
    }

    return {
      suggestion_type: suggestion.type,
      original_content: suggestion.originalContent || null,
      suggested_content: typeof sanitizedContent === 'string' ? sanitizedContent : JSON.stringify(sanitizedContent),
      ai_reasoning: suggestion.aiReasoning || suggestion.reasoning || null,
      risk_score: riskResult.riskScore,
      risk_details: {
        ...riskResult,
        uniqueness: uniquenessResult
      },
      metadata: suggestion.metadata || null
    };
  }

  /**
   * Save a suggestion to the JSONB suggestions array on the profile_optimizations row.
   * Returns the suggestion object with its generated id.
   */
  async _saveSuggestion(jobId, suggestion) {
    // Fetch current row
    const { data: row, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('suggestions')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;

    const suggestionWithId = {
      id: crypto.randomUUID(),
      ...suggestion,
      user_approved: null,
      user_edited_content: null
    };

    const currentSuggestions = row.suggestions || [];
    currentSuggestions.push(suggestionWithId);

    const { error: updateError } = await this.client
      .from('profile_optimizations')
      .update({
        suggestions: currentSuggestions,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) throw updateError;
    return suggestionWithId;
  }

  /**
   * Approve a suggestion within the JSONB suggestions array.
   * Requires jobId to locate the row, then finds the suggestion by id within the array.
   */
  async approveSuggestion(suggestionId, jobId, editedContent = null) {
    await this.initialize();

    const { data: row, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('suggestions')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;
    if (!row) throw new Error('Job not found');

    const suggestions = row.suggestions || [];
    const idx = suggestions.findIndex(s => s.id === suggestionId);
    if (idx === -1) throw new Error('Suggestion not found');

    suggestions[idx].user_approved = true;
    if (editedContent) {
      suggestions[idx].user_edited_content = editedContent;
    }

    const { error: updateError } = await this.client
      .from('profile_optimizations')
      .update({
        suggestions,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) throw updateError;
    return suggestions[idx];
  }

  /**
   * Reject a suggestion within the JSONB suggestions array.
   * Requires jobId to locate the row.
   */
  async rejectSuggestion(suggestionId, jobId) {
    await this.initialize();

    const { data: row, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('suggestions')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;
    if (!row) throw new Error('Job not found');

    const suggestions = row.suggestions || [];
    const idx = suggestions.findIndex(s => s.id === suggestionId);
    if (idx === -1) throw new Error('Suggestion not found');

    suggestions[idx].user_approved = false;

    const { error: updateError } = await this.client
      .from('profile_optimizations')
      .update({
        suggestions,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) throw updateError;
    return suggestions[idx];
  }

  /**
   * Regenerate a specific suggestion with optional user feedback.
   * Requires jobId to locate the row directly instead of querying across tables.
   */
  async regenerateSuggestion(suggestionId, jobId, userId, profileData, auditResults, userFeedback = null) {
    await this.initialize();

    // Fetch the job row
    const { data: row, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;
    if (!row) throw new Error('Job not found');

    const suggestions = row.suggestions || [];
    const idx = suggestions.findIndex(s => s.id === suggestionId);
    if (idx === -1) throw new Error('Suggestion not found');

    const existing = suggestions[idx];

    // Regenerate using AI with feedback
    const newSuggestion = await aiSuggestionService.regenerateSuggestion(
      existing.suggestion_type,
      profileData,
      auditResults,
      userFeedback
    );

    if (!newSuggestion) throw new Error('Failed to regenerate suggestion');

    // Process through sanitizer and risk scoring
    const processed = await this._processSuggestion(
      {
        type: existing.suggestion_type,
        content: newSuggestion.content,
        originalContent: existing.original_content,
        reasoning: newSuggestion.reasoning,
        metadata: newSuggestion.metadata
      },
      profileData,
      userId,
      row.location_id
    );

    // Update the suggestion in the array
    suggestions[idx] = {
      ...existing,
      suggested_content: processed.suggested_content,
      ai_reasoning: processed.ai_reasoning,
      risk_score: processed.risk_score,
      risk_details: processed.risk_details,
      metadata: processed.metadata,
      user_approved: null,
      user_edited_content: null
    };

    const { error: updateError } = await this.client
      .from('profile_optimizations')
      .update({
        suggestions,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) throw updateError;
    return suggestions[idx];
  }

  /**
   * Deploy approved suggestions — applies them immediately to Google Business Profile.
   * @param {string} jobId
   * @param {string} accessToken - Google OAuth access token
   * @param {string} locationId  - GBP location ID
   */
  async scheduleDeployment(jobId, accessToken = null, locationId = null) {
    await this.initialize();

    const { data: row, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('suggestions')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;
    if (!row) throw new Error('Job not found');

    const approved = (row.suggestions || []).filter(s => s.user_approved === true);

    if (approved.length === 0) {
      throw new Error('No approved suggestions to deploy');
    }

    // Apply to GBP immediately
    const schedule = await deploymentScheduler.createSchedule(jobId, approved, accessToken, locationId);
    return schedule;
  }

  /**
   * Apply all approved suggestions immediately (bypass gradual deployment).
   * Builds deployments array with all deploy_day=0 and status='scheduled',
   * saves to the row, then triggers processing.
   */
  async applyAllNow(jobId) {
    await this.initialize();

    const { data: row, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('suggestions, deployments')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;
    if (!row) throw new Error('Job not found');

    const approved = (row.suggestions || []).filter(s => s.user_approved === true);

    if (approved.length === 0) {
      throw new Error('No approved suggestions to apply');
    }

    const now = new Date().toISOString();
    const currentDeployments = row.deployments || [];
    const newDeployments = [];

    for (const suggestion of approved) {
      const deployType = this._mapSuggestionToDeployType(suggestion.suggestion_type);
      const deployment = {
        id: crypto.randomUUID(),
        suggestion_id: suggestion.id,
        deploy_type: deployType,
        deploy_day: 0,
        scheduled_at: now,
        status: 'scheduled',
        applied_at: null,
        rollback_data: {},
        error_message: null,
        retry_count: 0
      };
      newDeployments.push(deployment);
    }

    const allDeployments = [...currentDeployments, ...newDeployments];

    // Save deployments and update job status
    await this.client
      .from('profile_optimizations')
      .update({
        deployments: allDeployments,
        status: 'deploying',
        updated_at: now
      })
      .eq('id', jobId);

    // Process all immediately
    await deploymentScheduler.processScheduledDeployments();

    return newDeployments;
  }

  /**
   * Get the latest optimization job for a location.
   * Single query to profile_optimizations ordered by created_at DESC.
   */
  async getLatestJob(userId, locationId) {
    await this.initialize();

    const { data: row, error } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('gmail_id', userId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error && error.code !== 'PGRST116') throw error;
    if (!row) return null;

    return {
      job: {
        id: row.id,
        gmail_id: row.gmail_id,
        location_id: row.location_id,
        account_id: row.account_id,
        status: row.status,
        audit_score: row.audit_score,
        audit_data: row.audit_data,
        risk_score: row.risk_score,
        error_message: row.error_message,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at
      },
      suggestions: row.suggestions || [],
      deployments: row.deployments || []
    };
  }

  /**
   * Get a specific job with all related data.
   * Single query by id and gmail_id.
   */
  async getJob(jobId, userId) {
    await this.initialize();

    const { data: row, error } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', jobId)
      .eq('gmail_id', userId)
      .single();

    if (error) throw error;
    if (!row) throw new Error('Job not found');

    return {
      job: {
        id: row.id,
        gmail_id: row.gmail_id,
        location_id: row.location_id,
        account_id: row.account_id,
        status: row.status,
        audit_score: row.audit_score,
        audit_data: row.audit_data,
        risk_score: row.risk_score,
        error_message: row.error_message,
        created_at: row.created_at,
        updated_at: row.updated_at,
        completed_at: row.completed_at
      },
      suggestions: row.suggestions || [],
      deployments: row.deployments || []
    };
  }

  // ========== Private Helper Methods ==========

  /**
   * Create a new optimization job row in profile_optimizations.
   * The row id (UUID) is the job ID.
   */
  async _createJob(userId, locationId, accountId) {
    const { data, error } = await this.client
      .from('profile_optimizations')
      .insert({
        id: crypto.randomUUID(),
        gmail_id: userId,
        location_id: locationId,
        account_id: accountId,
        status: 'pending',
        suggestions: [],
        deployments: [],
        change_history: [],
        settings: {},
        fingerprints: {}
      })
      .select()
      .single();

    if (error) throw error;
    console.log(`[ProfileOptimizer] Created job ${data.id}`);
    return data;
  }

  /**
   * Update the status of an optimization job.
   */
  async _updateJobStatus(jobId, status, errorMessage = null) {
    const updates = {
      status,
      updated_at: new Date().toISOString()
    };
    if (errorMessage) updates.error_message = errorMessage;
    if (status === 'completed') updates.completed_at = new Date().toISOString();

    await this.client
      .from('profile_optimizations')
      .update(updates)
      .eq('id', jobId);
  }

  /**
   * Map suggestion type to deployment type
   */
  _mapSuggestionToDeployType(suggestionType) {
    const mapping = {
      'description': 'description',
      'secondary_categories': 'categories',
      'service_description': 'services',
      'product': 'products',
      'attribute': 'attributes',
      'hours': 'hours',
      'reply_template': 'reply_templates',
      'social_links': 'links',
      'booking_link': 'links',
      'photo_guide': 'products'
    };
    return mapping[suggestionType] || suggestionType;
  }
}

export default new ProfileOptimizerService();
