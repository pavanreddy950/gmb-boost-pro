import auditCacheService from './auditCacheService.js';

/**
 * Optimized Audit Service - High-performance audit data processing
 * Features: Caching, parallel processing, batch operations, faster API calls
 */
class OptimizedAuditService {
  constructor() {
    this.cache = auditCacheService;
    this.googleApiTimeout = 8000; // 8 second timeout for faster failures
    this.batchSize = 5; // Process max 5 locations simultaneously
    
    console.log('[OptimizedAudit] Service initialized with performance optimizations');
  }
  
  /**
   * Fast performance data fetch with caching
   */
  async getPerformanceData(locationId, startDate, endDate, accessToken) {
    const cacheKey = this.cache.generateKey(locationId, startDate, endDate);
    
    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return {
        performance: cached,
        source: 'cache',
        cached: true
      };
    }
    
    console.log(`[OptimizedAudit] 🚀 Fetching fresh data for location: ${locationId}`);
    
    // Fetch fresh data with optimized API calls
    const performanceData = await this.fetchGooglePerformanceData(locationId, startDate, endDate, accessToken);
    
    if (performanceData) {
      // Cache the result
      this.cache.set(cacheKey, performanceData);
      
      return {
        performance: performanceData,
        source: 'google_api',
        cached: false
      };
    }
    
    return null;
  }
  
  /**
   * Optimized Google API calls with faster timeouts and parallel fallbacks
   */
  async fetchGooglePerformanceData(locationId, startDate, endDate, accessToken) {
    const locationName = locationId.startsWith('locations/') ? locationId : `locations/${locationId}`;
    
    // Parse dates for query parameters
    const startDateParts = startDate.split('-');
    const endDateParts = endDate.split('-');
    
    const metrics = [
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH', 
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_CONVERSATIONS',
      'BUSINESS_DIRECTION_REQUESTS',
      'CALL_CLICKS',
      'WEBSITE_CLICKS'
    ];
    
    // Build optimized API URL
    const params = new URLSearchParams({
      'dailyRange.start_date.year': startDateParts[0],
      'dailyRange.start_date.month': startDateParts[1],
      'dailyRange.start_date.day': startDateParts[2],
      'dailyRange.end_date.year': endDateParts[0],
      'dailyRange.end_date.month': endDateParts[1],
      'dailyRange.end_date.day': endDateParts[2]
    });
    
    metrics.forEach(metric => params.append('dailyMetrics', metric));
    
    const apiUrl = `https://businessprofileperformance.googleapis.com/v1/${locationName}:fetchMultiDailyMetricsTimeSeries?${params.toString()}`;
    
    try {
      // Fast timeout controller
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), this.googleApiTimeout);
      
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (response.ok) {
        const data = await response.json();
        return this.processGoogleApiResponse(data, locationId);
      } else {
        console.log(`❌ Google API failed for ${locationId}: ${response.status}`);
        return null;
      }
      
    } catch (error) {
      if (error.name === 'AbortError') {
        console.log(`⏱️ Google API timeout for ${locationId} (${this.googleApiTimeout}ms)`);
      } else {
        console.log(`❌ Google API error for ${locationId}:`, error.message);
      }
      return null;
    }
  }
  
  /**
   * Process Google API response into standardized format
   */
  processGoogleApiResponse(data, locationId) {
    const dailyMetricsMap = new Map();
    
    if (data.multiDailyMetricTimeSeries && Array.isArray(data.multiDailyMetricTimeSeries)) {
      // Flatten nested structure
      const allMetrics = [];
      data.multiDailyMetricTimeSeries.forEach((group) => {
        if (group.dailyMetricTimeSeries && Array.isArray(group.dailyMetricTimeSeries)) {
          allMetrics.push(...group.dailyMetricTimeSeries);
        }
      });
      
      // Process each metric series
      allMetrics.forEach((metricData) => {
        const metricType = metricData.dailyMetric;
        
        if (metricData.timeSeries?.datedValues) {
          metricData.timeSeries.datedValues.forEach((dateValue) => {
            const date = `${dateValue.date.year}-${String(dateValue.date.month).padStart(2, '0')}-${String(dateValue.date.day).padStart(2, '0')}`;
            
            if (!dailyMetricsMap.has(date)) {
              dailyMetricsMap.set(date, {
                date,
                views: 0,
                impressions: 0,
                calls: 0,
                websiteClicks: 0,
                directionRequests: 0
              });
            }
            
            const dayMetrics = dailyMetricsMap.get(date);
            const value = parseInt(dateValue.value || 0);
            
            // Map metrics to our format
            switch (metricType) {
              case 'BUSINESS_IMPRESSIONS_DESKTOP_MAPS':
              case 'BUSINESS_IMPRESSIONS_MOBILE_MAPS':
                dayMetrics.views += value;
                dayMetrics.impressions += value;
                break;
              case 'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH':
              case 'BUSINESS_IMPRESSIONS_MOBILE_SEARCH':
                dayMetrics.impressions += value;
                break;
              case 'CALL_CLICKS':
                dayMetrics.calls += value;
                break;
              case 'WEBSITE_CLICKS':
                dayMetrics.websiteClicks += value;
                break;
              case 'BUSINESS_DIRECTION_REQUESTS':
                dayMetrics.directionRequests += value;
                break;
            }
          });
        }
      });
    }
    
    const dailyMetrics = Array.from(dailyMetricsMap.values()).sort((a, b) => 
      a.date.localeCompare(b.date)
    );
    
    if (dailyMetrics.length > 0) {
      return {
        locationMetrics: [{
          locationName,
          timeZone: 'UTC',
          dailyMetrics
        }]
      };
    }
    
    return null;
  }
  
  /**
   * Batch process multiple locations in parallel
   */
  async batchProcessLocations(locations, startDate, endDate, accessToken) {
    console.log(`[OptimizedAudit] 🚀 Batch processing ${locations.length} locations...`);
    
    const results = new Map();
    const batches = [];
    
    // Split into batches
    for (let i = 0; i < locations.length; i += this.batchSize) {
      batches.push(locations.slice(i, i + this.batchSize));
    }
    
    // Process each batch in parallel
    for (let i = 0; i < batches.length; i++) {
      const batch = batches[i];
      console.log(`[OptimizedAudit] Processing batch ${i + 1}/${batches.length} (${batch.length} locations)`);
      
      const batchPromises = batch.map(async (locationId) => {
        try {
          const result = await this.getPerformanceData(locationId, startDate, endDate, accessToken);
          return { locationId, result, success: true };
        } catch (error) {
          console.error(`[OptimizedAudit] ❌ Failed to process ${locationId}:`, error.message);
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
      
      // Small delay between batches to be respectful to Google APIs
      if (i < batches.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log(`[OptimizedAudit] ✅ Batch processing complete: ${results.size}/${locations.length} processed`);
    
    return results;
  }
  
  /**
   * Generate audit recommendations with caching
   */
  async getAuditRecommendations(locationId, performanceData) {
    const cacheKey = this.cache.generateKey(locationId, 'today', 'today', 'recommendations');
    
    // Try cache first
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }
    
    const recommendations = this.generateRecommendations(performanceData);
    
    // Cache recommendations for 1 hour
    this.cache.set(cacheKey, recommendations);
    
    return recommendations;
  }
  
  /**
   * Generate recommendations based on performance data
   */
  generateRecommendations(performanceData) {
    const recommendations = [];
    
    if (!performanceData?.locationMetrics?.[0]?.dailyMetrics) {
      return recommendations;
    }
    
    const dailyMetrics = performanceData.locationMetrics[0].dailyMetrics;
    const totals = {
      calls: dailyMetrics.reduce((sum, day) => sum + (day.calls || 0), 0),
      websiteClicks: dailyMetrics.reduce((sum, day) => sum + (day.websiteClicks || 0), 0),
      directionRequests: dailyMetrics.reduce((sum, day) => sum + (day.directionRequests || 0), 0),
      views: dailyMetrics.reduce((sum, day) => sum + (day.views || 0), 0),
      impressions: dailyMetrics.reduce((sum, day) => sum + (day.impressions || 0), 0)
    };
    
    // Generate actionable recommendations
    if (totals.calls < 10) {
      recommendations.push({
        id: 'increase-calls',
        title: 'Low Call Engagement',
        description: 'Your profile is receiving few phone calls. Optimize your contact information.',
        priority: 'high',
        category: 'engagement',
        impact: 'Adding clear call-to-actions could increase calls by 30-50%',
        actions: [
          'Verify your phone number is correct and prominent',
          'Add business hours to show when you\'re available',
          'Respond quickly to missed calls and inquiries'
        ]
      });
    }
    
    if (totals.websiteClicks < 20) {
      recommendations.push({
        id: 'increase-website-traffic',
        title: 'Low Website Clicks', 
        description: 'Few people are visiting your website from your business profile.',
        priority: 'medium',
        category: 'traffic',
        impact: 'Optimizing your website link could increase clicks by 25%',
        actions: [
          'Ensure your website URL is correct and working',
          'Add compelling business description with keywords',
          'Keep your profile information fresh and updated'
        ]
      });
    }
    
    if (totals.impressions < 500) {
      recommendations.push({
        id: 'increase-visibility',
        title: 'Low Profile Visibility',
        description: 'Your business profile has low visibility in search results.',
        priority: 'high',
        category: 'visibility',
        impact: 'Improving your profile could increase visibility by 50-100%',
        actions: [
          'Complete all profile sections (hours, photos, description)',
          'Add high-quality photos of your business',
          'Encourage satisfied customers to leave reviews',
          'Post regular updates and offers'
        ]
      });
    }
    
    return recommendations;
  }
  
  /**
   * Get cache performance stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }
  
  /**
   * Clear location cache
   */
  clearLocationCache(locationId) {
    return this.cache.clearLocation(locationId);
  }
}

// Singleton instance
const optimizedAuditService = new OptimizedAuditService();

export default optimizedAuditService;


