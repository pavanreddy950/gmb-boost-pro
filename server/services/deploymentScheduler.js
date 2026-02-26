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
   * Deploy approved suggestions immediately — applies them to Google Business Profile
   * and records results in the database.
   * @param {string} jobId
   * @param {Array}  approvedSuggestions
   * @param {string} accessToken - Google OAuth access token for GBP API calls
   * @param {string} locationId  - GBP location ID (without "locations/" prefix)
   */
  async createSchedule(jobId, approvedSuggestions, accessToken = null, locationId = null) {
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
    const changeHistory = row.change_history || [];
    const now = new Date();

    for (const suggestion of approvedSuggestions) {
      const deployType = this._mapSuggestionToDeployType(suggestion.suggestion_type);

      const deployment = {
        id: crypto.randomUUID(),
        suggestion_id: suggestion.id,
        deploy_type: deployType,
        deploy_day: 0,
        scheduled_at: now.toISOString(),
        status: 'in_progress',
        applied_at: null,
        rollback_data: {
          original_content: suggestion.original_content || null,
          suggestion_type: suggestion.suggestion_type || null,
          metadata: suggestion.metadata || {}
        },
        error_message: null,
        retry_count: 0,
        gbp_applied: false,
        gbp_note: null
      };

      // Attempt live GBP API update with retry (up to 3 attempts, exponential back-off)
      if (accessToken && locationId) {
        const content = suggestion.user_edited_content || suggestion.suggested_content;
        let gbpResult = null;
        let lastGBPError = null;
        for (let attempt = 1; attempt <= 3; attempt++) {
          try {
            gbpResult = await this._applyToGBP(deployType, content, accessToken, locationId);
            break; // success — exit retry loop
          } catch (err) {
            lastGBPError = err;
            if (attempt < 3) {
              const waitMs = 1000 * attempt; // 1s, 2s back-off
              console.warn(`[DeploymentScheduler] ${deployType} attempt ${attempt}/3 failed: ${err.message} — retrying in ${waitMs}ms`);
              await new Promise(r => setTimeout(r, waitMs));
            }
          }
        }

        deployment.status = 'applied';
        deployment.applied_at = new Date().toISOString();
        if (gbpResult) {
          deployment.gbp_applied = !gbpResult.skipped;
          deployment.gbp_note = gbpResult.skipped ? gbpResult.reason : null;
          console.log(`[DeploymentScheduler] ${deployType}: ${gbpResult.skipped ? 'skipped (' + gbpResult.reason + ')' : 'applied to GBP ✓'}`);
        } else {
          deployment.gbp_applied = false;
          deployment.gbp_note = lastGBPError?.message || 'GBP API call failed after 3 retries';
          deployment.error_message = lastGBPError?.message || 'Unknown error';
          console.error(`[DeploymentScheduler] ${deployType} failed after 3 retries:`, lastGBPError?.message);
        }
      } else {
        deployment.status = 'applied';
        deployment.applied_at = now.toISOString();
        deployment.gbp_applied = false;
        deployment.gbp_note = 'No access token — please reconnect Google Business Profile';
      }

      deployments.push(deployment);

      // Append to change history
      changeHistory.push({
        id: crypto.randomUUID(),
        deployment_id: deployment.id,
        change_type: this._getChangeType(deployType),
        field_name: deployType,
        old_value: suggestion.original_content || null,
        new_value: suggestion.user_edited_content || suggestion.suggested_content,
        applied_by: 'user',
        gbp_applied: deployment.gbp_applied,
        gbp_note: deployment.gbp_note,
        rolled_back: false,
        rolled_back_at: null,
        created_at: new Date().toISOString()
      });
    }

    // Save everything and mark job as completed immediately
    const { error: updateError } = await this.client
      .from('profile_optimizations')
      .update({
        deployments: deployments,
        change_history: changeHistory,
        status: 'completed',
        completed_at: now.toISOString(),
        updated_at: now.toISOString()
      })
      .eq('id', jobId);

    if (updateError) throw updateError;

    const appliedCount = deployments.filter(d => d.gbp_applied).length;
    console.log(`[DeploymentScheduler] Job ${jobId} complete — ${appliedCount}/${deployments.length} changes pushed to GBP`);

    return deployments;
  }

  /**
   * Call the Google Business Profile API to apply a single deployment type.
   * Returns { applied: true } on success or { skipped: true, reason: string } for unsupported types.
   * Throws on API error.
   */
  async _applyToGBP(deployType, suggestedContent, accessToken, locationId) {
    const baseUrl = 'https://mybusinessbusinessinformation.googleapis.com/v1';
    const locationName = `locations/${locationId}`;
    const headers = {
      'Authorization': `Bearer ${accessToken}`,
      'Content-Type': 'application/json'
    };

    let content;
    try {
      content = typeof suggestedContent === 'string' ? JSON.parse(suggestedContent) : suggestedContent;
    } catch {
      content = suggestedContent;
    }

    // ── Description ──────────────────────────────────────────────────────────
    if (deployType === 'description') {
      const raw = content?.description || (typeof content === 'string' ? content : '');
      if (!raw) throw new Error('Empty description — nothing to deploy');
      // GBP caps description at 750 characters
      const description = raw.substring(0, 750);

      const res = await fetch(
        `${baseUrl}/${locationName}?updateMask=profile.description`,
        { method: 'PATCH', headers, body: JSON.stringify({ profile: { description } }) }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`GBP ${res.status}: ${err.substring(0, 300)}`);
      }
      return { applied: true };
    }

    // ── Business Hours ────────────────────────────────────────────────────────
    if (deployType === 'hours') {
      const periods = content?.periods || [];
      if (!periods.length) throw new Error('No hours periods to deploy');

      const cleanPeriods = periods
        .filter(p => !p.isClosed)
        .map(p => {
          const openHours = p.openTime?.hours ?? 0;
          const openMins  = p.openTime?.minutes ?? 0;
          let closeHours  = p.closeTime?.hours ?? 0;
          let closeMins   = p.closeTime?.minutes ?? 0;

          // GBP API rejects closeTime of 0:00 when openTime is non-zero on the same day
          // (it would mean "closes before it opens"). Midnight close = hours:24, minutes:0.
          if (closeHours === 0 && closeMins === 0 && (openHours > 0 || openMins > 0)) {
            closeHours = 24;
            closeMins  = 0;
          }

          // closeDay is required by GBP v1 API; default to same day as openDay
          const closeDay = p.closeDay || p.openDay;

          return {
            openDay:   p.openDay,
            openTime:  { hours: openHours,  minutes: openMins  },
            closeDay,
            closeTime: { hours: closeHours, minutes: closeMins }
          };
        });

      const res = await fetch(
        `${baseUrl}/${locationName}?updateMask=regularHours`,
        { method: 'PATCH', headers, body: JSON.stringify({ regularHours: { periods: cleanPeriods } }) }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`GBP ${res.status}: ${err.substring(0, 300)}`);
      }
      return { applied: true };
    }

    // ── Service Items ─────────────────────────────────────────────────────────
    if (deployType === 'services') {
      const services = content?.services || [];
      if (!services.length) throw new Error('No services to deploy');

      // freeFormServiceItem requires a valid category GCID.
      // Fetch the location's primary category to use as the category value.
      let categoryGcid = null;
      try {
        const catRes = await fetch(
          `${baseUrl}/${locationName}?readMask=categories`,
          { headers }
        );
        if (catRes.ok) {
          const catData = await catRes.json();
          // name is "categories/gcid:xxx" — strip the prefix
          const rawName = catData.categories?.primaryCategory?.name || '';
          categoryGcid = rawName.replace('categories/', '') || null;
        }
      } catch (e) {
        console.warn('[DeploymentScheduler] Could not fetch primary category GCID:', e.message);
      }

      const serviceItems = services.map(s => {
        const displayName = (s.name || '').substring(0, 140);
        const description = (s.description || '').substring(0, 300);

        const label = { displayName, languageCode: 'en' };
        if (description) label.description = description; // omit if empty

        const item = { freeFormServiceItem: { label } };
        if (categoryGcid) item.freeFormServiceItem.category = categoryGcid;

        return item;
      });

      const res = await fetch(
        `${baseUrl}/${locationName}?updateMask=serviceItems`,
        { method: 'PATCH', headers, body: JSON.stringify({ serviceItems }) }
      );
      if (!res.ok) {
        const err = await res.text();
        throw new Error(`GBP ${res.status}: ${err.substring(0, 300)}`);
      }
      return { applied: true };
    }

    // ── Categories — search GBP categories API to resolve GCIDs ─────────────
    if (deployType === 'categories') {
      const suggested = content?.categories || [];
      if (!suggested.length) return { skipped: true, reason: 'No categories suggested' };

      // Fetch current location to get primary category + region for search
      const locRes = await fetch(`${baseUrl}/${locationName}?readMask=categories,storefrontAddress`, { headers });
      if (!locRes.ok) throw new Error(`GBP ${locRes.status}: Could not read location`);
      const locData = await locRes.json();
      const primaryCategory = locData.categories?.primaryCategory;
      const regionCode = locData.storefrontAddress?.regionCode || locData.storefrontAddress?.administrativeArea || 'US';

      // Search for each suggested category by display name
      const resolved = [];
      const unresolved = [];
      for (const cat of suggested.slice(0, 9)) {
        const catName = (typeof cat === 'string' ? cat : (cat.name || cat.displayName || '')).trim();
        if (!catName) continue;
        try {
          const searchUrl = `${baseUrl}/categories?regionCode=${encodeURIComponent(regionCode)}&languageCode=en&view=BASIC&filter=${encodeURIComponent(`displayName="${catName}"`)}`;
          const searchRes = await fetch(searchUrl, { headers });
          if (searchRes.ok) {
            const searchData = await searchRes.json();
            const match = (searchData.categories || [])[0];
            if (match?.name) {
              resolved.push({ name: match.name });
            } else {
              unresolved.push(catName);
            }
          } else {
            unresolved.push(catName);
          }
        } catch {
          unresolved.push(catName);
        }
      }

      if (!resolved.length) {
        return { skipped: true, reason: `No GBP category IDs found for: ${unresolved.join(', ')} — set manually in GBP` };
      }

      // PATCH location with resolved categories
      const patchRes = await fetch(
        `${baseUrl}/${locationName}?updateMask=categories`,
        { method: 'PATCH', headers, body: JSON.stringify({ categories: { primaryCategory, additionalCategories: resolved } }) }
      );
      if (!patchRes.ok) {
        const err = await patchRes.text();
        throw new Error(`GBP ${patchRes.status}: ${err.substring(0, 300)}`);
      }
      const note = unresolved.length ? ` (could not find: ${unresolved.join(', ')})` : '';
      return { applied: true, note: `Set ${resolved.length} categories${note}` };
    }

    // ── Attributes — match names via GBP attribute metadata, set boolean attrs ─
    if (deployType === 'attributes') {
      const suggested = (content?.attributes || []).filter(a => a.recommended !== false);
      if (!suggested.length) return { skipped: true, reason: 'No attributes suggested' };

      // Fetch location to get primary category + region
      const locRes = await fetch(`${baseUrl}/${locationName}?readMask=categories,storefrontAddress`, { headers });
      if (!locRes.ok) return { skipped: true, reason: 'Could not read location for attribute lookup' };
      const locData = await locRes.json();
      const categoryName = locData.categories?.primaryCategory?.name || '';
      const regionCode = locData.storefrontAddress?.regionCode || 'US';

      if (!categoryName) return { skipped: true, reason: 'No primary category set — cannot look up attributes' };

      // Fetch available attribute metadata for this category
      const metaUrl = `${baseUrl}/attributes?parent=${encodeURIComponent(locationName)}&categoryName=${encodeURIComponent(categoryName)}&regionCode=${encodeURIComponent(regionCode)}&languageCode=en`;
      const metaRes = await fetch(metaUrl, { headers });
      if (!metaRes.ok) return { skipped: true, reason: 'Could not fetch attribute metadata from GBP' };
      const metaData = await metaRes.json();
      const available = metaData.attributeMetadata || metaData.attributes || [];

      // Build lookup by display name (case-insensitive)
      const byName = {};
      for (const meta of available) {
        const key = (meta.displayName || '').toLowerCase().trim();
        if (key) byName[key] = meta;
      }

      // Match suggested attributes to available IDs; only auto-set BOOL attributes
      const toSet = [];
      const manual = [];
      for (const sug of suggested) {
        const key = (sug.name || '').toLowerCase().trim();
        const meta = byName[key];
        if (meta && meta.valueType === 'BOOL') {
          toSet.push({ name: `${locationName}/attributes/${meta.attributeId}`, valueType: 'BOOL', values: [true] });
        } else if (meta) {
          manual.push(`${sug.name} (requires manual value)`);
        } else {
          manual.push(sug.name);
        }
      }

      if (!toSet.length) {
        return { skipped: true, reason: `Could not auto-match attributes: ${manual.join(', ')} — set manually in GBP` };
      }

      // PATCH attributes
      const patchRes = await fetch(
        `${baseUrl}/${locationName}/attributes`,
        { method: 'PATCH', headers, body: JSON.stringify({ attributes: toSet }) }
      );
      if (!patchRes.ok) {
        const err = await patchRes.text();
        throw new Error(`GBP ${patchRes.status}: ${err.substring(0, 300)}`);
      }
      const note = manual.length ? ` | manual: ${manual.join(', ')}` : '';
      return { applied: true, note: `Set ${toSet.length} attributes${note}` };
    }

    // ── Products — deploy as service items (GBP Products API is restricted) ───
    if (deployType === 'products') {
      const products = content?.products || [];
      if (!products.length) return { skipped: true, reason: 'No products suggested' };

      // Fetch existing service items so we append, not overwrite
      const existingRes = await fetch(`${baseUrl}/${locationName}?readMask=serviceItems,categories`, { headers });
      let existingItems = [];
      let categoryGcid = null;
      if (existingRes.ok) {
        const d = await existingRes.json();
        existingItems = d.serviceItems || [];
        const rawName = d.categories?.primaryCategory?.name || '';
        categoryGcid = rawName.replace('categories/', '') || null;
      }

      const newItems = products.slice(0, 20).map(p => {
        const displayName = (p.name || '').substring(0, 140);
        const description = (p.description || '').substring(0, 300);
        const label = { displayName, languageCode: 'en' };
        if (description) label.description = description;
        const item = { freeFormServiceItem: { label } };
        if (categoryGcid) item.freeFormServiceItem.category = categoryGcid;
        return item;
      });

      const allItems = [...existingItems, ...newItems];
      const patchRes = await fetch(
        `${baseUrl}/${locationName}?updateMask=serviceItems`,
        { method: 'PATCH', headers, body: JSON.stringify({ serviceItems: allItems }) }
      );
      if (!patchRes.ok) {
        const err = await patchRes.text();
        throw new Error(`GBP ${patchRes.status}: ${err.substring(0, 300)}`);
      }
      return { applied: true };
    }

    return { skipped: true, reason: `Unsupported deploy type: ${deployType}` };
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
   * Retry a specific deployment — re-runs the GBP API call for an applied (Manual/failed) item.
   * @param {string} deploymentId - The deployment entry ID within the JSONB array
   * @param {string} jobId        - The profile_optimizations row ID
   * @param {string} accessToken  - Fresh Google OAuth access token
   * @param {string} locationId   - GBP location ID
   */
  async retryDeployment(deploymentId, jobId, accessToken, locationId) {
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

    const deployment = deployments[depIndex];

    // Find the suggestion content for this deployment
    const suggestions = row.suggestions || [];
    const suggestion = suggestions.find(s => s.id === deployment.suggestion_id);
    if (!suggestion) throw new Error('Original suggestion not found');

    const content = suggestion.user_edited_content || suggestion.suggested_content;

    // Re-run with retry logic
    let gbpResult = null;
    let lastError = null;
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        gbpResult = await this._applyToGBP(deployment.deploy_type, content, accessToken, locationId);
        break;
      } catch (err) {
        lastError = err;
        if (attempt < 3) await new Promise(r => setTimeout(r, 1000 * attempt));
      }
    }

    // Update deployment record
    deployments[depIndex] = {
      ...deployment,
      status: 'applied',
      applied_at: new Date().toISOString(),
      gbp_applied: !!gbpResult && !gbpResult.skipped,
      gbp_note: gbpResult?.skipped ? gbpResult.reason : (lastError?.message || null),
      error_message: gbpResult ? null : (lastError?.message || null),
      retry_count: (deployment.retry_count || 0) + 1,
    };

    await this.client
      .from('profile_optimizations')
      .update({ deployments, updated_at: new Date().toISOString() })
      .eq('id', jobId);

    console.log(`[DeploymentScheduler] Retry ${deploymentId}: ${gbpResult && !gbpResult.skipped ? 'applied ✓' : gbpResult?.skipped ? 'still manual' : 'failed again'}`);
    return deployments[depIndex];
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
