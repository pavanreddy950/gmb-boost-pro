import express from 'express';
import productionAuditService from '../services/productionAuditService.js';

const router = express.Router();

/**
 * Batch Audit Endpoint - Process multiple locations in parallel
 * POST /api/audit/batch
 * Body: { locationIds: ['loc1', 'loc2', ...], startDate?, endDate? }
 */
router.post('/batch', async (req, res) => {
  try {
    const { locationIds, startDate, endDate } = req.body;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    if (!locationIds || !Array.isArray(locationIds) || locationIds.length === 0) {
      return res.status(400).json({ error: 'locationIds array is required' });
    }

    if (locationIds.length > 20) {
      return res.status(400).json({ error: 'Maximum 20 locations per batch request' });
    }

    const accessToken = authHeader.split(' ')[1];
    console.log(`🚀 [BATCH AUDIT] Processing ${locationIds.length} locations in parallel...`);

    // Default date range (last 30 days)
    const defaultEndDate = new Date().toISOString().split('T')[0];
    const defaultStartDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const finalStartDate = startDate || defaultStartDate;
    const finalEndDate = endDate || defaultEndDate;

    // Process in parallel batches with enhanced fallbacks
    const startTime = Date.now();
    const results = new Map();
    
    // Process each location individually for better error handling
    const batchPromises = locationIds.map(async (locationId) => {
      try {
        const result = await productionAuditService.getPerformanceData(
          locationId,
          finalStartDate,
          finalEndDate,
          accessToken
        );
        return { locationId, result, success: true };
      } catch (error) {
        return { locationId, error: error.message, success: false };
      }
    });
    
    const batchResults = await Promise.allSettled(batchPromises);
    
    batchResults.forEach((promiseResult) => {
      if (promiseResult.status === 'fulfilled') {
        const { locationId, result, success, error } = promiseResult.value;
        results.set(locationId, { result, success, error });
      }
    });

    const endTime = Date.now();
    const processingTime = endTime - startTime;

    // Format results
    const formattedResults = {};
    let successCount = 0;
    let cacheHits = 0;

    for (const [locationId, locationResult] of results.entries()) {
      if (locationResult.success && locationResult.result) {
        formattedResults[locationId] = {
          success: true,
          performance: locationResult.result.performance,
          cached: locationResult.result.cached,
          source: locationResult.result.source
        };
        successCount++;
        if (locationResult.result.cached) cacheHits++;
      } else {
        formattedResults[locationId] = {
          success: false,
          error: locationResult.error || 'Unknown error'
        };
      }
    }

    console.log(`✅ [BATCH AUDIT] Complete: ${successCount}/${locationIds.length} success, ${cacheHits} cache hits, ${processingTime}ms`);

    res.json({
      success: true,
      results: formattedResults,
      summary: {
        totalLocations: locationIds.length,
        successCount,
        failureCount: locationIds.length - successCount,
        cacheHits,
        processingTimeMs: processingTime,
        averageTimePerLocation: Math.round(processingTime / locationIds.length),
        dateRange: {
          startDate: finalStartDate,
          endDate: finalEndDate
        }
      }
    });

  } catch (error) {
    console.error('Error in batch audit:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to process batch audit',
      message: error.message
    });
  }
});

/**
 * Cache Stats Endpoint - View cache performance
 * GET /api/audit/cache-stats
 */
router.get('/cache-stats', (req, res) => {
  try {
    const stats = productionAuditService.getCacheStats();
    res.json({
      success: true,
      cacheStats: stats,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to get cache stats',
      message: error.message
    });
  }
});

/**
 * Clear Cache Endpoint - Clear cache for specific location
 * DELETE /api/audit/cache/:locationId
 */
router.delete('/cache/:locationId', (req, res) => {
  try {
    const { locationId } = req.params;
    const cleared = optimizedAuditService.clearLocationCache(locationId);
    
    res.json({
      success: true,
      message: `Cleared cache for location ${locationId}`,
      entriesCleared: cleared
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: 'Failed to clear cache',
      message: error.message
    });
  }
});

/**
 * Optimized Recommendations Endpoint
 * GET /api/audit/recommendations/:locationId
 */
router.get('/recommendations/:locationId', async (req, res) => {
  try {
    const { locationId } = req.params;
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Access token required' });
    }

    const accessToken = authHeader.split(' ')[1];
    console.log(`🚀 [OPTIMIZED RECO] Generating recommendations for: ${locationId}`);

    // Get performance data first (from cache if available)
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    const performanceResult = await optimizedAuditService.getPerformanceData(
      locationId,
      startDate,
      endDate,
      accessToken
    );

    let recommendations = [];
    
    if (performanceResult && performanceResult.performance) {
      recommendations = await optimizedAuditService.getAuditRecommendations(
        locationId,
        performanceResult.performance
      );
    }

    res.json({
      success: true,
      recommendations,
      hasPerformanceData: !!performanceResult?.performance,
      cached: performanceResult?.cached || false,
      dateRange: { startDate, endDate }
    });

  } catch (error) {
    console.error('Error generating optimized recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      message: error.message
    });
  }
});

export default router;
