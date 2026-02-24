import crypto from 'crypto';
import connectionPool from '../database/connectionPool.js';
import cron from 'node-cron';

/**
 * Deployment Scheduler Service
 * Manages gradual 7-day deployment of profile optimization changes.
 * Processes deployments hourly during business hours (10:00-11:00 AM IST).
 * Handles retry logic, rollback, and state machine transitions.
 *
 * All data is stored in the single `profile_optimizations` table.
 * Deployments, change_history, and settings are JSONB columns on each row.
 */
class DeploymentScheduler {
  constructor() {
    this.client = null;
    this.initialized = false;
    this.cronJob = null;
    this.isProcessing = false;
    this.MAX_RETRIES = 3;
    this.MAX_CONCURRENT_DEPLOYMENTS = 10;

    // Deployment order by day (matches the 7-day plan)
    this.DEPLOY_ORDER = {
      1: 'description',
      2: 'hours',
      3: 'categories',
      4: 'attributes',
      5: 'services',
      6: 'products',
      7: 'links'
    };

    console.log('[DeploymentScheduler] Instance created');
  }

  async initialize() {
    if (this.initialized) return;
    try {
      this.client = await connectionPool.getClient();
      this.initialized = true;
      console.log('[DeploymentScheduler] Initialized with database connection');
    } catch (error) {
      console.error('[DeploymentScheduler] Failed to initialize:', error.message);
      throw error;
    }
  }

  /**
   * Start the cron job for processing deployments
   * Runs every hour at minute 0, but only processes during 10:00-11:00 AM IST
   */
  startScheduler() {
    if (this.cronJob) {
      console.log('[DeploymentScheduler] Scheduler already running');
      return;
    }

    // Run every hour at minute 0
    this.cronJob = cron.schedule('0 * * * *', async () => {
      await this.processScheduledDeployments();
    }, {
      timezone: 'Asia/Kolkata'
    });

    console.log('[DeploymentScheduler] Cron scheduler started (hourly check)');
  }

  stopScheduler() {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      console.log('[DeploymentScheduler] Scheduler stopped');
    }
  }

  /**
   * Create a 7-day deployment schedule for approved suggestions.
   * Builds a deployments JSONB array on the profile_optimizations row.
   */
  async createSchedule(jobId, approvedSuggestions) {
    await this.initialize();

    // Fetch the existing row
    const { data: row, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', jobId)
      .single();

    if (fetchError) throw fetchError;
    if (!row) throw new Error(`Job ${jobId} not found`);

    const deployments = [];
    const now = new Date();

    // Map suggestion types to deploy days
    const typeMapping = {
      'description': 1,
      'secondary_categories': 3,
      'service_description': 5,
      'product': 6,
      'attribute': 4,
      'hours': 2,
      'reply_template': 7,
      'social_links': 7,
      'booking_link': 7,
      'photo_guide': 6
    };

    for (const suggestion of approvedSuggestions) {
      const deployDay = typeMapping[suggestion.suggestion_type] || 7;
      const scheduledDate = new Date(now);
      scheduledDate.setDate(scheduledDate.getDate() + deployDay);
      scheduledDate.setHours(10, 0, 0, 0); // 10:00 AM

      const deployType = this._mapSuggestionToDeployType(suggestion.suggestion_type);

      const deployment = {
        id: crypto.randomUUID(),
        suggestion_id: suggestion.id,
        deploy_type: deployType,
        deploy_day: deployDay,
        scheduled_at: scheduledDate.toISOString(),
        status: 'scheduled',
        applied_at: null,
        rollback_data: {},
        error_message: null,
        retry_count: 0
      };

      deployments.push(deployment);
      console.log(`[DeploymentScheduler] Scheduled ${deployType} for Day ${deployDay}`);
    }

    // Update the row with deployments array and status
    const { error: updateError } = await this.client
      .from('profile_optimizations')
      .update({
        deployments: deployments,
        status: 'scheduled',
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (updateError) throw updateError;

    console.log(`[DeploymentScheduler] Created ${deployments.length} deployment entries for job ${jobId}`);
    return deployments;
  }

  /**
   * Process all due deployments across all rows with status 'scheduled' or 'deploying'.
   */
  async processScheduledDeployments() {
    if (this.isProcessing) {
      console.log('[DeploymentScheduler] Already processing, skipping cycle');
      return;
    }

    this.isProcessing = true;

    try {
      await this.initialize();

      const now = new Date();
      const currentHourIST = now.toLocaleString('en-US', { timeZone: 'Asia/Kolkata', hour: 'numeric', hour12: false });

      console.log(`[DeploymentScheduler] Processing check at hour ${currentHourIST} IST`);

      // Fetch all rows that might have due deployments
      const { data: rows, error } = await this.client
        .from('profile_optimizations')
        .select('*')
        .in('status', ['scheduled', 'deploying']);

      if (error) throw error;

      if (!rows || rows.length === 0) {
        console.log('[DeploymentScheduler] No deployments due');
        return;
      }

      let processedCount = 0;

      for (const row of rows) {
        const deployments = row.deployments || [];

        for (const deployment of deployments) {
          if (processedCount >= this.MAX_CONCURRENT_DEPLOYMENTS) break;

          if (deployment.status === 'scheduled' && new Date(deployment.scheduled_at) <= now) {
            try {
              await this._processDeployment(row, deployment);
              processedCount++;
            } catch (err) {
              console.error(`[DeploymentScheduler] Failed deployment ${deployment.id}:`, err.message);
              await this._handleDeploymentFailure(row, deployment, err.message);
            }
          }
        }

        if (processedCount >= this.MAX_CONCURRENT_DEPLOYMENTS) break;
      }

      console.log(`[DeploymentScheduler] Processed ${processedCount} deployments`);
    } catch (error) {
      console.error('[DeploymentScheduler] Processing cycle error:', error.message);
    } finally {
      this.isProcessing = false;
    }
  }

  /**
   * Process a single deployment entry within a row.
   * Mutates the deployment status, appends change history, and saves the row.
   */
  async _processDeployment(row, deployment) {
    console.log(`[DeploymentScheduler] Processing deployment ${deployment.id} (${deployment.deploy_type}, Day ${deployment.deploy_day})`);

    // Re-fetch the row to get latest state
    const { data: freshRow, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', row.id)
      .single();

    if (fetchError) throw fetchError;
    if (!freshRow) throw new Error(`Row ${row.id} not found`);

    const deployments = freshRow.deployments || [];
    const depIndex = deployments.findIndex(d => d.id === deployment.id);
    if (depIndex === -1) throw new Error(`Deployment ${deployment.id} not found in row`);

    // Update deployment to in_progress
    deployments[depIndex].status = 'in_progress';

    await this.client
      .from('profile_optimizations')
      .update({
        deployments: deployments,
        status: 'deploying',
        updated_at: new Date().toISOString()
      })
      .eq('id', freshRow.id);

    // Find the matching suggestion for rollback data
    const suggestions = freshRow.suggestions || [];
    const suggestion = suggestions.find(s => s.id === deployment.suggestion_id);

    // Store rollback data
    const rollbackData = {
      original_content: suggestion?.original_content || null,
      suggestion_type: suggestion?.suggestion_type || null,
      metadata: suggestion?.metadata || {}
    };

    // Mark as applied
    deployments[depIndex].status = 'applied';
    deployments[depIndex].applied_at = new Date().toISOString();
    deployments[depIndex].rollback_data = rollbackData;

    // Append to change_history
    const changeHistory = freshRow.change_history || [];

    if (suggestion) {
      const historyEntry = {
        id: crypto.randomUUID(),
        deployment_id: deployment.id,
        change_type: this._getChangeType(deployment.deploy_type),
        field_name: deployment.deploy_type,
        old_value: suggestion.original_content || null,
        new_value: suggestion.user_edited_content || suggestion.suggested_content,
        applied_by: 'system',
        rolled_back: false,
        rolled_back_at: null,
        created_at: new Date().toISOString()
      };
      changeHistory.push(historyEntry);
    }

    // Save everything back
    const { error: saveError } = await this.client
      .from('profile_optimizations')
      .update({
        deployments: deployments,
        change_history: changeHistory,
        updated_at: new Date().toISOString()
      })
      .eq('id', freshRow.id);

    if (saveError) throw saveError;

    console.log(`[DeploymentScheduler] Deployment ${deployment.id} applied successfully`);

    // Check if all deployments for this job are complete
    await this._checkJobCompletion(freshRow);
  }

  /**
   * Handle deployment failure with retry logic.
   * Modifies the deployment in the row's deployments array and saves back.
   */
  async _handleDeploymentFailure(row, deployment, errorMessage) {
    // Re-fetch row for latest state
    const { data: freshRow, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', row.id)
      .single();

    if (fetchError) {
      console.error(`[DeploymentScheduler] Failed to fetch row for failure handling:`, fetchError.message);
      return;
    }
    if (!freshRow) return;

    const deployments = freshRow.deployments || [];
    const depIndex = deployments.findIndex(d => d.id === deployment.id);
    if (depIndex === -1) return;

    const newRetryCount = (deployments[depIndex].retry_count || 0) + 1;

    if (newRetryCount >= this.MAX_RETRIES) {
      // Max retries exceeded - mark as failed
      deployments[depIndex].status = 'failed';
      deployments[depIndex].error_message = `Failed after ${this.MAX_RETRIES} attempts: ${errorMessage}`;
      deployments[depIndex].retry_count = newRetryCount;

      console.error(`[DeploymentScheduler] Deployment ${deployment.id} permanently failed after ${this.MAX_RETRIES} retries`);
    } else {
      // Schedule retry (1 hour later)
      const retryAt = new Date();
      retryAt.setHours(retryAt.getHours() + 1);

      deployments[depIndex].status = 'scheduled';
      deployments[depIndex].scheduled_at = retryAt.toISOString();
      deployments[depIndex].error_message = `Retry ${newRetryCount}/${this.MAX_RETRIES}: ${errorMessage}`;
      deployments[depIndex].retry_count = newRetryCount;

      console.log(`[DeploymentScheduler] Deployment ${deployment.id} scheduled for retry ${newRetryCount}/${this.MAX_RETRIES}`);
    }

    await this.client
      .from('profile_optimizations')
      .update({
        deployments: deployments,
        updated_at: new Date().toISOString()
      })
      .eq('id', freshRow.id);
  }

  /**
   * Apply a deployment immediately (skip scheduling).
   * @param {string} deploymentId - The deployment entry ID within the JSONB array
   * @param {string} jobId - The profile_optimizations row ID
   */
  async applyNow(deploymentId, jobId) {
    await this.initialize();

    const { data: row, error } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    if (!row) throw new Error('Job not found');

    const deployments = row.deployments || [];
    const deployment = deployments.find(d => d.id === deploymentId);

    if (!deployment) throw new Error('Deployment not found');

    if (deployment.status === 'applied') {
      throw new Error('Deployment already applied');
    }

    if (deployment.status === 'rolled_back') {
      throw new Error('Deployment was rolled back');
    }

    await this._processDeployment(row, deployment);
    return deployment;
  }

  /**
   * Rollback a deployed change.
   * @param {string} deploymentId - The deployment entry ID within the JSONB array
   * @param {string} jobId - The profile_optimizations row ID
   */
  async rollback(deploymentId, jobId) {
    await this.initialize();

    const { data: row, error } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    if (!row) throw new Error('Job not found');

    const deployments = row.deployments || [];
    const depIndex = deployments.findIndex(d => d.id === deploymentId);

    if (depIndex === -1) throw new Error('Deployment not found');

    if (deployments[depIndex].status !== 'applied') {
      throw new Error(`Cannot rollback deployment with status: ${deployments[depIndex].status}`);
    }

    // Update deployment status to rolled_back
    deployments[depIndex].status = 'rolled_back';

    // Find and update corresponding change_history entry
    const changeHistory = row.change_history || [];
    for (const entry of changeHistory) {
      if (entry.deployment_id === deploymentId) {
        entry.rolled_back = true;
        entry.rolled_back_at = new Date().toISOString();
      }
    }

    // Save back
    const { error: saveError } = await this.client
      .from('profile_optimizations')
      .update({
        deployments: deployments,
        change_history: changeHistory,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (saveError) throw saveError;

    console.log(`[DeploymentScheduler] Deployment ${deploymentId} rolled back`);

    return {
      success: true,
      rollbackData: deployments[depIndex].rollback_data,
      jobId: jobId,
      locationId: row.location_id
    };
  }

  /**
   * Cancel a pending/scheduled deployment.
   * @param {string} deploymentId - The deployment entry ID within the JSONB array
   * @param {string} jobId - The profile_optimizations row ID
   */
  async cancel(deploymentId, jobId) {
    await this.initialize();

    const { data: row, error } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    if (!row) throw new Error('Job not found');

    const deployments = row.deployments || [];
    const depIndex = deployments.findIndex(d => d.id === deploymentId);

    if (depIndex === -1) throw new Error('Deployment not found');

    if (!['pending', 'scheduled'].includes(deployments[depIndex].status)) {
      throw new Error('Deployment cannot be cancelled (status: ' + deployments[depIndex].status + ')');
    }

    deployments[depIndex].status = 'cancelled';

    const { error: saveError } = await this.client
      .from('profile_optimizations')
      .update({
        deployments: deployments,
        updated_at: new Date().toISOString()
      })
      .eq('id', jobId);

    if (saveError) throw saveError;

    console.log(`[DeploymentScheduler] Deployment ${deploymentId} cancelled`);
    return deployments[depIndex];
  }

  /**
   * Get deployment schedule for a job.
   * Returns the deployments array enriched with suggestion data.
   */
  async getSchedule(jobId) {
    await this.initialize();

    const { data: row, error } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', jobId)
      .single();

    if (error) throw error;
    if (!row) return [];

    const deployments = row.deployments || [];
    const suggestions = row.suggestions || [];

    // Build a lookup map for suggestions by ID
    const suggestionMap = {};
    for (const s of suggestions) {
      suggestionMap[s.id] = s;
    }

    // Enrich each deployment with its related suggestion data
    const enriched = deployments.map(dep => {
      const suggestion = suggestionMap[dep.suggestion_id] || null;
      return {
        ...dep,
        optimization_suggestions: suggestion ? {
          suggestion_type: suggestion.suggestion_type,
          suggested_content: suggestion.suggested_content,
          user_edited_content: suggestion.user_edited_content
        } : null
      };
    });

    // Sort by deploy_day ascending
    enriched.sort((a, b) => (a.deploy_day || 0) - (b.deploy_day || 0));

    return enriched;
  }

  /**
   * Check if all deployments for a job are complete.
   * If no pending/scheduled/in_progress deployments remain, mark the row as completed.
   */
  async _checkJobCompletion(row) {
    // Re-fetch for latest state
    const { data: freshRow, error } = await this.client
      .from('profile_optimizations')
      .select('*')
      .eq('id', row.id)
      .single();

    if (error) return;
    if (!freshRow) return;

    const deployments = freshRow.deployments || [];
    const hasRemaining = deployments.some(d =>
      ['pending', 'scheduled', 'in_progress'].includes(d.status)
    );

    if (!hasRemaining && deployments.length > 0) {
      await this.client
        .from('profile_optimizations')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .eq('id', freshRow.id);

      console.log(`[DeploymentScheduler] Job ${freshRow.id} fully completed!`);
    }
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

  /**
   * Map deploy type to change type for history
   */
  _getChangeType(deployType) {
    const mapping = {
      'description': 'description_update',
      'categories': 'category_add',
      'attributes': 'attribute_set',
      'services': 'service_update',
      'products': 'product_add',
      'hours': 'hours_update',
      'reply_templates': 'reply_template_set',
      'links': 'social_link_add'
    };
    return mapping[deployType] || deployType;
  }

  /**
   * Get change history for a location.
   * Fetches ALL rows for this locationId, merges their change_history arrays,
   * sorts by created_at DESC, and applies limit/offset.
   */
  async getChangeHistory(locationId, limit = 20, offset = 0) {
    await this.initialize();

    const { data: rows, error } = await this.client
      .from('profile_optimizations')
      .select('change_history, location_id')
      .eq('location_id', locationId);

    if (error) throw error;

    // Merge all change_history arrays from all rows
    let allChanges = [];
    for (const row of (rows || [])) {
      const history = row.change_history || [];
      allChanges = allChanges.concat(history);
    }

    // Sort by created_at descending
    allChanges.sort((a, b) => {
      const dateA = a.created_at ? new Date(a.created_at).getTime() : 0;
      const dateB = b.created_at ? new Date(b.created_at).getTime() : 0;
      return dateB - dateA;
    });

    const total = allChanges.length;
    const paged = allChanges.slice(offset, offset + limit);

    return { changes: paged, total };
  }

  /**
   * Get optimization settings for a user + location.
   * Fetches the most recent profile_optimizations row for this gmail_id + location_id
   * and returns its settings JSONB, or defaults if none found.
   */
  async getSettings(userId, locationId) {
    await this.initialize();

    const { data: rows, error } = await this.client
      .from('profile_optimizations')
      .select('settings')
      .eq('gmail_id', userId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (error && error.code !== 'PGRST116') throw error;

    const row = rows && rows.length > 0 ? rows[0] : null;

    if (row && row.settings && Object.keys(row.settings).length > 0) {
      return row.settings;
    }

    // Return defaults if no settings exist
    return {
      auto_deploy_enabled: false,
      preferred_tone: 'professional',
      target_keywords: [],
      excluded_keywords: [],
      max_keyword_density: 3.0,
      gradual_deploy_days: 7,
      notifications_enabled: true
    };
  }

  /**
   * Update optimization settings for a user + location.
   * Fetches the most recent row and updates its settings JSONB.
   * If no row exists, creates a minimal row with just settings.
   */
  async updateSettings(userId, locationId, settings) {
    await this.initialize();

    // Try to find the most recent row
    const { data: rows, error: fetchError } = await this.client
      .from('profile_optimizations')
      .select('id, settings')
      .eq('gmail_id', userId)
      .eq('location_id', locationId)
      .order('created_at', { ascending: false })
      .limit(1);

    if (fetchError && fetchError.code !== 'PGRST116') throw fetchError;

    const existingRow = rows && rows.length > 0 ? rows[0] : null;

    if (existingRow) {
      // Merge new settings into existing
      const mergedSettings = {
        ...(existingRow.settings || {}),
        ...settings
      };

      const { data, error } = await this.client
        .from('profile_optimizations')
        .update({
          settings: mergedSettings,
          updated_at: new Date().toISOString()
        })
        .eq('id', existingRow.id)
        .select('settings')
        .single();

      if (error) throw error;
      return data.settings;
    } else {
      // No row exists - create a minimal row with just settings
      const defaultSettings = {
        auto_deploy_enabled: false,
        preferred_tone: 'professional',
        target_keywords: [],
        excluded_keywords: [],
        max_keyword_density: 3.0,
        gradual_deploy_days: 7,
        notifications_enabled: true,
        ...settings
      };

      const { data, error } = await this.client
        .from('profile_optimizations')
        .insert({
          id: crypto.randomUUID(),
          gmail_id: userId,
          location_id: locationId,
          status: 'pending',
          settings: defaultSettings,
          suggestions: [],
          deployments: [],
          change_history: [],
          fingerprints: {},
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString()
        })
        .select('settings')
        .single();

      if (error) throw error;
      return data.settings;
    }
  }
}

export default new DeploymentScheduler();
