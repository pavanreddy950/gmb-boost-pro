import auditCacheService from './auditCacheService.js';

/**
 * Production Audit Service - Real data only, no mock/fallback data
 * Tries multiple Google API endpoints and provides clear error messages
 */
class ProductionAuditService {
  constructor() {
    this.cache = auditCacheService;
    this.googleApiTimeout = 12000; // 12 seconds for production
    
    console.log('[ProductionAudit] Service initialized - REAL DATA ONLY');
  }
  
  /**
   * Get performance data from Google APIs - real data only
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
    
    console.log(`[ProductionAudit] 🚀 Fetching REAL data for location: ${locationId}`);
    
    // Try multiple Google API endpoints in order of preference
    const apiEndpoints = [
      {
        name: 'Business Profile Performance API v1',
        method: () => this.tryBusinessProfilePerformanceAPI(locationId, startDate, endDate, accessToken)
      },
      {
        name: 'My Business API v4 Insights',
        method: () => this.tryMyBusinessInsightsAPI(locationId, startDate, endDate, accessToken)
      },
      {
        name: 'My Business API v4 Reports',
        method: () => this.tryMyBusinessReportsAPI(locationId, startDate, endDate, accessToken)
      }
    ];
    
    let lastError = null;
    let apiAttempts = [];
    
    for (const endpoint of apiEndpoints) {
      try {
        console.log(`[ProductionAudit] 🌐 Trying ${endpoint.name}...`);
        const result = await endpoint.method();
        
        if (result && result.locationMetrics && result.locationMetrics[0]?.dailyMetrics?.length > 0) {
          console.log(`[ProductionAudit] ✅ SUCCESS with ${endpoint.name}: ${result.locationMetrics[0].dailyMetrics.length} days`);
          
          // Cache real data for 15 minutes
          this.cache.set(cacheKey, result);
          
          return {
            performance: result,
            source: 'google_api',
            apiUsed: endpoint.name,
            cached: false
          };
        } else {
          console.log(`[ProductionAudit] ⚠️ ${endpoint.name}: No data returned`);
          apiAttempts.push({ api: endpoint.name, status: 'no_data' });
        }
        
      } catch (error) {
        console.log(`[ProductionAudit] ❌ ${endpoint.name} failed:`, error.message);
        lastError = error;
        apiAttempts.push({ api: endpoint.name, status: 'error', error: error.message });
      }
    }
    
    // All APIs failed - return detailed error information
    console.log(`[ProductionAudit] ❌ All Google APIs failed for location: ${locationId}`);
    
    return {
      performance: null,
      source: 'api_failure',
      cached: false,
      error: 'Unable to fetch performance data from Google Business Profile',
      apiAttempts,
      lastError: lastError?.message,
      troubleshooting: this.generateTroubleshootingInfo(locationId, apiAttempts)
    };
  }
  
  /**
   * Try Business Profile Performance API v1
   */
  async tryBusinessProfilePerformanceAPI(locationId, startDate, endDate, accessToken) {
    const locationName = locationId.startsWith('locations/') ? locationId : `locations/${locationId}`;
    
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
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.googleApiTimeout);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${accessToken}`
        },
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      return this.processBusinessProfileResponse(data, locationId);
      
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Try My Business Insights API v4
   */
  async tryMyBusinessInsightsAPI(locationId, startDate, endDate, accessToken) {
    // Get account ID first
    const accountId = await this.getAccountIdForLocation(locationId, accessToken);
    if (!accountId) {
      throw new Error('Could not determine account ID for location');
    }
    
    const apiUrl = `https://mybusiness.googleapis.com/v4/accounts/${accountId}/locations/${locationId}:reportInsights`;
    
    const requestBody = {
      locationNames: [`accounts/${accountId}/locations/${locationId}`],
      basicRequest: {
        timeRange: {
          startTime: `${startDate}T00:00:00Z`,
          endTime: `${endDate}T23:59:59Z`
        },
        metricRequests: [
          { metric: 'QUERIES_DIRECT' },
          { metric: 'QUERIES_INDIRECT' },
          { metric: 'VIEWS_MAPS' },
          { metric: 'VIEWS_SEARCH' },
          { metric: 'ACTIONS_WEBSITE' },
          { metric: 'ACTIONS_PHONE' },
          { metric: 'ACTIONS_DRIVING_DIRECTIONS' }
        ]
      }
    };
    
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this.googleApiTimeout);
    
    try {
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      
      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(`HTTP ${response.status}: ${errorText}`);
      }
      
      const data = await response.json();
      return this.processInsightsResponse(data, locationId);
      
    } finally {
      clearTimeout(timeoutId);
    }
  }
  
  /**
   * Try My Business Reports API v4
   */
  async tryMyBusinessReportsAPI(locationId, startDate, endDate, accessToken) {
    // This would use the older reports API as another fallback
    throw new Error('Reports API v4 not implemented - deprecated endpoint');
  }
  
  /**
   * Get account ID for a location
   */
  async getAccountIdForLocation(locationId, accessToken) {
    try {
      const response = await fetch('https://mybusinessaccountmanagement.googleapis.com/v1/accounts', {
        headers: { 'Authorization': `Bearer ${accessToken}` }
      });
      
      if (response.ok) {
        const data = await response.json();
        return data.accounts?.[0]?.name?.split('/')?.pop();
      }
    } catch (error) {
      console.log(`[ProductionAudit] Could not get account ID:`, error.message);
    }
    return null;
  }
  
  /**
   * Process Business Profile Performance API response
   */
  processBusinessProfileResponse(data, locationId) {
    const dailyMetricsMap = new Map();
    
    if (data.multiDailyMetricTimeSeries && Array.isArray(data.multiDailyMetricTimeSeries)) {
      const allMetrics = [];
      data.multiDailyMetricTimeSeries.forEach((group) => {
        if (group.dailyMetricTimeSeries && Array.isArray(group.dailyMetricTimeSeries)) {
          allMetrics.push(...group.dailyMetricTimeSeries);
        }
      });
      
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
          locationName: `locations/${locationId}`,
          timeZone: 'UTC',
          dailyMetrics
        }]
      };
    }
    
    return null;
  }
  
  /**
   * Process My Business Insights API response
   */
  processInsightsResponse(data, locationId) {
    // Implementation would convert insights format to our standard format
    // This is a simplified version
    if (data.locationMetrics && data.locationMetrics.length > 0) {
      return {
        locationMetrics: [{
          locationName: `locations/${locationId}`,
          timeZone: 'UTC',
          dailyMetrics: [] // Would process insights data here
        }]
      };
    }
    return null;
  }
  
  /**
   * Generate troubleshooting information for failed API calls
   */
  generateTroubleshootingInfo(locationId, apiAttempts) {
    const hasPermissionErrors = apiAttempts.some(attempt => 
      attempt.error && (
        attempt.error.includes('403') || 
        attempt.error.includes('Permission') || 
        attempt.error.includes('Forbidden')
      )
    );
    
    const hasNotFoundErrors = apiAttempts.some(attempt =>
      attempt.error && (
        attempt.error.includes('404') || 
        attempt.error.includes('Not Found')
      )
    );
    
    const hasUnauthorizedErrors = apiAttempts.some(attempt =>
      attempt.error && (
        attempt.error.includes('401') || 
        attempt.error.includes('Unauthorized')
      )
    );
    
    if (hasPermissionErrors) {
      return {
        likely_cause: 'Permission Issue',
        explanation: 'Your Google account does not have permission to access this location\'s data.',
        solutions: [
          'Ensure you are the owner or manager of this Google Business Profile',
          'Ask the profile owner to add you as a manager',
          'Verify you are signed in with the correct Google account'
        ]
      };
    }
    
    if (hasNotFoundErrors) {
      return {
        likely_cause: 'Location Not Found',
        explanation: 'The location ID may be invalid or the location may not exist.',
        solutions: [
          'Verify the location ID is correct',
          'Check if the location still exists in Google Business Profile',
          'Ensure the location is published and not suspended'
        ]
      };
    }
    
    if (hasUnauthorizedErrors) {
      return {
        likely_cause: 'Authentication Issue',
        explanation: 'Your access token may be expired or invalid.',
        solutions: [
          'Reconnect your Google Business Profile in Settings',
          'Ensure proper OAuth scopes are granted',
          'Check if your Google account has the necessary permissions'
        ]
      };
    }
    
    return {
      likely_cause: 'API or Data Availability Issue',
      explanation: 'The Google Business Profile APIs are not returning data for this location.',
      solutions: [
        'Ensure the location is verified in Google Business Profile',
        'Check if the location has been active for at least 48 hours',
        'Verify that "Business Profile Performance API" is enabled in Google Cloud Console',
        'Try again later as data may take time to become available'
      ]
    };
  }
  
  /**
   * Get cache stats
   */
  getCacheStats() {
    return this.cache.getStats();
  }
}

// Singleton instance
const productionAuditService = new ProductionAuditService();

export default productionAuditService;


