import express from 'express';
import profileOptimizerService from '../services/profileOptimizerService.js';
import deploymentScheduler from '../services/deploymentScheduler.js';
import profileAuditEngine from '../services/profileAuditEngine.js';
import fetch from 'node-fetch';

const router = express.Router();

// ============================================
// Helper: Extract access token from auth header
// ============================================
function getAccessToken(req) {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }
  return authHeader.split(' ')[1];
}

// ============================================
// Helper: Fetch full GBP profile data
// ============================================
async function fetchProfileData(locationId, accountId, accessToken) {
  const baseUrl = 'https://mybusinessbusinessinformation.googleapis.com/v1';
  const v4Url = 'https://mybusiness.googleapis.com/v4';
  const headers = { Authorization: `Bearer ${accessToken}` };

  const locationName = `locations/${locationId}`;
  const fullName = `accounts/${accountId}/locations/${locationId}`;

  console.log(`[FetchProfile] Fetching ALL data for location=${locationId}, account=${accountId}`);

  // Parallel fetch ALL profile data (5 API calls)
  const [profileRes, reviewsRes, photosRes, postsRes, attributesRes] = await Promise.allSettled([
    // 1. Profile info (attributes fetched via separate endpoint below)
    fetch(`${baseUrl}/${locationName}?readMask=name,title,phoneNumbers,categories,storefrontAddress,websiteUri,regularHours,specialHours,serviceArea,profile,openInfo,metadata,moreHours,serviceItems`, { headers }),
    // 2. Reviews (up to 50)
    fetch(`${v4Url}/${fullName}/reviews?pageSize=50`, { headers }),
    // 3. Photos/media
    fetch(`${v4Url}/${fullName}/media`, { headers }),
    // 4. Posts (localPosts)
    fetch(`${v4Url}/${fullName}/localPosts?pageSize=20`, { headers }),
    // 5. Attributes (separate endpoint as fallback)
    fetch(`${baseUrl}/${locationName}/attributes`, { headers })
  ]);

  // --- Parse Profile ---
  let profile = {};
  if (profileRes.status === 'fulfilled') {
    if (profileRes.value.ok) {
      profile = await profileRes.value.json();
      console.log(`[FetchProfile] Profile OK - keys: ${Object.keys(profile).join(', ')}`);
      console.log(`[FetchProfile]   description: ${!!(profile.profile?.description)}, categories: ${!!(profile.categories)}, attributes: ${Array.isArray(profile.attributes) ? profile.attributes.length : 0}, serviceItems: ${(profile.serviceItems || []).length}`);
    } else {
      const err = await profileRes.value.text();
      console.error(`[FetchProfile] Profile ERROR ${profileRes.value.status}: ${err.substring(0, 200)}`);
    }
  } else {
    console.error(`[FetchProfile] Profile REJECTED: ${profileRes.reason?.message}`);
  }

  // --- Parse Reviews ---
  let reviews = [];
  if (reviewsRes.status === 'fulfilled') {
    if (reviewsRes.value.ok) {
      const data = await reviewsRes.value.json();
      reviews = data.reviews || [];
      console.log(`[FetchProfile] Reviews OK - count: ${reviews.length}`);
    } else {
      const err = await reviewsRes.value.text();
      console.error(`[FetchProfile] Reviews ERROR ${reviewsRes.value.status}: ${err.substring(0, 200)}`);
    }
  }

  // --- Parse Photos ---
  let photos = [];
  if (photosRes.status === 'fulfilled') {
    if (photosRes.value.ok) {
      const data = await photosRes.value.json();
      photos = data.mediaItems || [];
      console.log(`[FetchProfile] Photos OK - count: ${photos.length}`);
    } else {
      const err = await photosRes.value.text();
      console.error(`[FetchProfile] Photos ERROR ${photosRes.value.status}: ${err.substring(0, 200)}`);
    }
  }

  // --- Parse Posts ---
  let posts = [];
  if (postsRes.status === 'fulfilled') {
    if (postsRes.value.ok) {
      const data = await postsRes.value.json();
      posts = data.localPosts || data.posts || [];
      console.log(`[FetchProfile] Posts OK - count: ${posts.length}`);
    } else {
      // Posts API may be restricted - not all accounts have access
      console.log(`[FetchProfile] Posts API returned ${postsRes.value.status} (may be restricted)`);
    }
  }

  // --- Parse Attributes (merge with profile attributes) ---
  if (attributesRes.status === 'fulfilled') {
    if (attributesRes.value.ok) {
      const data = await attributesRes.value.json();
      const attrs = data.attributes || [];
      // Merge with profile attributes if profile didn't include them
      if ((!profile.attributes || profile.attributes.length === 0) && attrs.length > 0) {
        profile.attributes = attrs;
        console.log(`[FetchProfile] Attributes (separate) OK - count: ${attrs.length}`);
      }
    } else {
      console.log(`[FetchProfile] Attributes endpoint returned ${attributesRes.value.status}`);
    }
  }

  const result = {
    profile,
    services: profile.serviceItems || [],
    products: [], // GBP API doesn't have a direct products endpoint - scored based on serviceItems
    reviews,
    posts,
    photos,
    metrics: {}
  };

  console.log(`[FetchProfile] FINAL: profile_keys=${Object.keys(profile).length}, services=${result.services.length}, reviews=${reviews.length}, photos=${photos.length}, posts=${posts.length}, attributes=${(profile.attributes || []).length}`);

  return result;
}

// ============================================
// 1. POST /optimize - Start full optimization
// ============================================
router.post('/optimize', async (req, res) => {
  try {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const { locationId, accountId, userId, businessContext } = req.body;

    if (!locationId || !accountId) {
      return res.status(400).json({ error: 'locationId and accountId are required' });
    }

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    console.log(`[ProfileOptimizer API] Starting optimization for location ${locationId}`);
    if (businessContext) {
      console.log(`[ProfileOptimizer API] Business context: currency=${businessContext.currency}, tone=${businessContext.tone}, audience=${businessContext.targetAudience}`);
    }

    // Fetch full profile data from GBP API
    const profileData = await fetchProfileData(locationId, accountId, accessToken);

    // Run optimization pipeline (service maps userId to gmail_id internally)
    const result = await profileOptimizerService.runOptimization(
      userId,
      locationId,
      accountId,
      profileData,
      businessContext || null
    );

    res.json(result);
  } catch (error) {
    console.error('[ProfileOptimizer API] Optimization error:', error.message);
    res.status(500).json({ error: 'Failed to run optimization', details: error.message });
  }
});

// ============================================
// 2. GET /jobs/latest/:locationId - Get latest job
// ============================================
router.get('/jobs/latest/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter required' });
    }

    const result = await profileOptimizerService.getLatestJob(userId, locationId);

    if (!result) {
      return res.json({ job: null, suggestions: [], deployments: [] });
    }

    res.json(result);
  } catch (error) {
    console.error('[ProfileOptimizer API] Get latest job error:', error.message);
    res.status(500).json({ error: 'Failed to get latest job' });
  }
});

// ============================================
// 3. GET /jobs/:jobId - Get specific job
// ============================================
router.get('/jobs/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter required' });
    }

    const result = await profileOptimizerService.getJob(jobId, userId);
    res.json(result);
  } catch (error) {
    console.error('[ProfileOptimizer API] Get job error:', error.message);
    res.status(500).json({ error: 'Failed to get job', details: error.message });
  }
});

// ============================================
// 4. PUT /suggestions/:id/approve - Approve suggestion
// ============================================
router.put('/suggestions/:id/approve', async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId, editedContent } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required in request body' });
    }

    const suggestion = await profileOptimizerService.approveSuggestion(id, jobId, editedContent);
    res.json(suggestion);
  } catch (error) {
    console.error('[ProfileOptimizer API] Approve error:', error.message);
    res.status(500).json({ error: 'Failed to approve suggestion' });
  }
});

// ============================================
// 5. PUT /suggestions/:id/reject - Reject suggestion
// ============================================
router.put('/suggestions/:id/reject', async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required in request body' });
    }

    const suggestion = await profileOptimizerService.rejectSuggestion(id, jobId);
    res.json(suggestion);
  } catch (error) {
    console.error('[ProfileOptimizer API] Reject error:', error.message);
    res.status(500).json({ error: 'Failed to reject suggestion' });
  }
});

// ============================================
// 6. POST /suggestions/:id/regenerate - Regenerate with AI
// ============================================
router.post('/suggestions/:id/regenerate', async (req, res) => {
  try {
    const accessToken = getAccessToken(req);
    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const { id } = req.params;
    const { feedback, userId, locationId, accountId, jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required in request body' });
    }

    // Fetch fresh profile data
    const profileData = await fetchProfileData(locationId, accountId, accessToken);

    const suggestion = await profileOptimizerService.regenerateSuggestion(
      id,
      jobId,
      userId,
      profileData,
      null,
      feedback
    );

    res.json(suggestion);
  } catch (error) {
    console.error('[ProfileOptimizer API] Regenerate error:', error.message);
    res.status(500).json({ error: 'Failed to regenerate suggestion' });
  }
});

// ============================================
// 7. POST /deploy/:jobId - Deploy approved suggestions to GBP
// ============================================
router.post('/deploy/:jobId', async (req, res) => {
  try {
    const { jobId } = req.params;
    const accessToken = getAccessToken(req);
    const { locationId, accountId } = req.body;

    if (!accessToken) {
      return res.status(401).json({ error: 'Access token required to deploy to Google Business Profile' });
    }

    const schedule = await profileOptimizerService.scheduleDeployment(jobId, accessToken, locationId);

    // Re-run audit with fresh GBP data so the score reflects applied changes
    let newScore = null;
    let newAudit = null;
    try {
      if (locationId && accountId) {
        console.log('[ProfileOptimizer API] Re-fetching profile to recalculate score after deployment...');
        const freshProfileData = await fetchProfileData(locationId, accountId, accessToken);
        newAudit = await profileAuditEngine.runFullAudit(freshProfileData);
        newScore = newAudit.overallScore;

        // Update score in DB
        const client = await (await import('../database/connectionPool.js')).default.getClient();
        await client
          .from('profile_optimizations')
          .update({ audit_score: newScore, audit_data: newAudit, updated_at: new Date().toISOString() })
          .eq('id', jobId);

        console.log(`[ProfileOptimizer API] Score recalculated after deployment: ${newScore}`);
      }
    } catch (auditErr) {
      console.warn('[ProfileOptimizer API] Score recalculation failed (non-fatal):', auditErr.message);
    }

    res.json({ success: true, schedule, newScore, newAudit });
  } catch (error) {
    console.error('[ProfileOptimizer API] Deploy error:', error.message);
    res.status(500).json({ error: 'Failed to deploy', details: error.message });
  }
});

// ============================================
// 8. POST /deploy/:id/apply-now - Apply immediately
// ============================================
router.post('/deploy/:id/apply-now', async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required in request body' });
    }

    const result = await deploymentScheduler.applyNow(id, jobId);
    res.json({ success: true, deployment: result });
  } catch (error) {
    console.error('[ProfileOptimizer API] Apply now error:', error.message);
    res.status(500).json({ error: 'Failed to apply deployment', details: error.message });
  }
});

// ============================================
// 9. POST /deploy/:id/rollback - Rollback change
// ============================================
router.post('/deploy/:id/rollback', async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required in request body' });
    }

    const result = await deploymentScheduler.rollback(id, jobId);
    res.json(result);
  } catch (error) {
    console.error('[ProfileOptimizer API] Rollback error:', error.message);
    res.status(500).json({ error: 'Failed to rollback', details: error.message });
  }
});

// ============================================
// 10. POST /deploy/:id/cancel - Cancel pending deployment
// ============================================
router.post('/deploy/:id/cancel', async (req, res) => {
  try {
    const { id } = req.params;
    const { jobId } = req.body;

    if (!jobId) {
      return res.status(400).json({ error: 'jobId is required in request body' });
    }

    const result = await deploymentScheduler.cancel(id, jobId);
    res.json({ success: true, deployment: result });
  } catch (error) {
    console.error('[ProfileOptimizer API] Cancel error:', error.message);
    res.status(500).json({ error: 'Failed to cancel deployment', details: error.message });
  }
});

// ============================================
// 11. GET /history/:locationId - Change history
// ============================================
router.get('/history/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const limit = parseInt(req.query.limit) || 20;
    const offset = parseInt(req.query.offset) || 0;

    const result = await deploymentScheduler.getChangeHistory(locationId, limit, offset);
    res.json(result);
  } catch (error) {
    console.error('[ProfileOptimizer API] History error:', error.message);
    res.status(500).json({ error: 'Failed to get change history' });
  }
});

// ============================================
// 12. GET /settings/:locationId - Get settings
// ============================================
router.get('/settings/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { userId } = req.query;

    if (!userId) {
      return res.status(400).json({ error: 'userId query parameter required' });
    }

    const settings = await deploymentScheduler.getSettings(userId, locationId);
    res.json(settings);
  } catch (error) {
    console.error('[ProfileOptimizer API] Get settings error:', error.message);
    res.status(500).json({ error: 'Failed to get settings' });
  }
});

// ============================================
// 13. PUT /settings/:locationId - Update settings
// ============================================
router.put('/settings/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const { userId, ...settings } = req.body;

    if (!userId) {
      return res.status(400).json({ error: 'userId is required' });
    }

    const result = await deploymentScheduler.updateSettings(userId, locationId, settings);
    res.json(result);
  } catch (error) {
    console.error('[ProfileOptimizer API] Update settings error:', error.message);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

export default router;
