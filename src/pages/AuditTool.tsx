import React, { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectLabel,
  SelectSeparator,
  SelectGroup
} from "@/components/ui/select";
import {
  Search,
  TrendingUp,
  Eye,
  Phone,
  MousePointer,
  MapPin,
  Star,
  AlertCircle,
  CheckCircle,
  RefreshCw,
  BarChart3,
  Target,
  Crown
} from "lucide-react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  AreaChart,
  Area
} from "recharts";
import { useGoogleBusinessProfileContext } from "@/contexts/GoogleBusinessProfileContext";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { toast } from "@/hooks/use-toast";
import { generateAIResponse } from "@/lib/openaiService";
import { useAuth } from "@/contexts/AuthContext";

interface PerformanceMetrics {
  views: number;
  impressions: number;
  calls: number;
  websiteClicks: number;
  directionRequests: number;
  date: string;
}

interface AuditScore {
  overall: number;
  performance: number;
  engagement: number;
}


const AuditTool = () => {
  // Coming Soon Barrier - Remove this section when ready to deploy
  const SHOW_COMING_SOON = false;

  if (SHOW_COMING_SOON) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-100">
        <Card className="max-w-md w-full mx-4 shadow-xl border-0">
          <CardContent className="text-center p-8">
            <div className="mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center">
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
            </div>
            <h1 className="text-2xl font-bold text-gray-900 mb-2">Audit Tool</h1>
            <h2 className="text-lg font-semibold text-blue-600 mb-4">Coming Soon!</h2>
            <p className="text-gray-600 mb-6">
              We're working hard to bring you powerful audit capabilities. This feature will help you analyze your Google Business Profile performance and get actionable insights.
            </p>
            <div className="space-y-2 text-sm text-gray-500">
              <p>✨ Performance Analytics</p>
              <p>📊 Detailed Reports</p>
              <p>🎯 Optimization Recommendations</p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }
  // End Coming Soon Barrier
  const { accounts: businessAccounts, isConnected, isLoading: loading } = useGoogleBusinessProfileContext();
  const { subscription, status: subscriptionStatus } = useSubscription();
  const { currentUser } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [metrics, setMetrics] = useState<PerformanceMetrics[]>([]);
  const [auditScore, setAuditScore] = useState<AuditScore | null>(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [refreshInterval, setRefreshInterval] = useState(5 * 60 * 1000); // 5 minutes
  const [chartType, setChartType] = useState<'area' | 'line'>('area');
  const [apiDiagnostics, setApiDiagnostics] = useState<any>(null);
  const [showDiagnostics, setShowDiagnostics] = useState(false);
  const [aiInsights, setAiInsights] = useState<string | null>(null);
  const [loadingAiInsights, setLoadingAiInsights] = useState(false);

  // Get all locations from business accounts with safety check
  const allLocations = (businessAccounts || []).flatMap(account =>
    (account.locations || []).map(location => ({
      id: location.locationId,
      name: location.displayName,
      accountName: account.accountName,
      fullName: location.name
    }))
  );

  // Get subscription limits
  const maxAllowedProfiles = subscription?.profileCount || 1;
  const isPaidSubscription = subscriptionStatus === 'active' || subscriptionStatus === 'trial';

  // Limit available locations based on subscription
  const availableLocations = isPaidSubscription
    ? allLocations.slice(0, maxAllowedProfiles)
    : allLocations.slice(0, 1); // Trial/free users get 1 profile

  // Locations that are locked (require upgrade)
  const lockedLocations = allLocations.slice(maxAllowedProfiles);

  // Auto-select first available location if available
  useEffect(() => {
    if (availableLocations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(availableLocations[0].id);
    }
  }, [availableLocations, selectedLocationId]);

  // Save audit result to backend
  const saveAuditResult = async (locationId: string, performanceData: any, auditScore: any, recommendations: any = null) => {
    try {
      if (!currentUser) {
        console.warn('No current user, skipping audit save');
        return;
      }

      const selectedLocation = allLocations.find(loc => loc.id === locationId);
      if (!selectedLocation) {
        console.warn('Location not found, skipping audit save');
        return;
      }

      const auditData = {
        userId: currentUser.uid,
        userEmail: currentUser.email || 'unknown',
        locationId: selectedLocation.fullName || locationId,
        locationName: selectedLocation.name,
        performance: { timeSeriesData: performanceData },
        score: auditScore,
        recommendations: recommendations || { recommendations: [] },
        dateRange: {
          startDate: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
          endDate: new Date().toISOString().split('T')[0]
        },
        metadata: {
          source: 'audit_tool',
          timestamp: new Date().toISOString()
        }
      };

      const response = await fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/audit-results`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(auditData)
      });

      if (response.ok) {
        console.log('✅ Audit result saved successfully');
      } else {
        console.error('Failed to save audit result:', await response.text());
      }
    } catch (error) {
      console.error('Error saving audit result:', error);
      // Don't show error to user, this is a background save
    }
  };

  // Real-time auto-refresh effect
  useEffect(() => {
    if (!selectedLocationId || !autoRefresh) return;

    // Initial fetch
    fetchMetrics(selectedLocationId);

    // Set up interval for auto-refresh
    const interval = setInterval(() => {
      if (!loadingMetrics) {
        console.log('Auto-refreshing audit data...');
        fetchMetrics(selectedLocationId);
      }
    }, refreshInterval);

    return () => clearInterval(interval);
  }, [selectedLocationId, autoRefresh, refreshInterval]);

  // Page visibility change handler for smart refresh
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (!document.hidden && selectedLocationId && autoRefresh) {
        // Page became visible - refresh data if it's been more than 2 minutes
        const now = new Date();
        if (!lastUpdated || (now.getTime() - lastUpdated.getTime()) > 2 * 60 * 1000) {
          console.log('Page became visible - refreshing audit data...');
          fetchMetrics(selectedLocationId);
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [selectedLocationId, autoRefresh, lastUpdated]);

  // Fetch performance metrics for selected location
  const fetchMetrics = async (locationId: string) => {
    if (!locationId) return;

    // Check if this profile is within subscription limits
    const locationIndex = allLocations.findIndex(loc => loc.id === locationId);
    if (locationIndex >= maxAllowedProfiles) {
      toast({
        title: "Profile Locked",
        description: `This profile requires an upgrade. You have access to ${maxAllowedProfiles} profile${maxAllowedProfiles === 1 ? '' : 's'}.`,
        variant: "destructive"
      });
      return;
    }

    setLoadingMetrics(true);
    try {
      // Get Google OAuth access token from localStorage (same as other pages)
      const storedTokens = localStorage.getItem('google_business_tokens');
      const isConnectedFlag = localStorage.getItem('google_business_connected');

      if (!storedTokens || isConnectedFlag !== 'true') {
        throw new Error('No Google Business Profile connection found. Please connect your Google Business Profile in Settings > Connections.');
      }

      const tokens = JSON.parse(storedTokens);

      if (!tokens.access_token) {
        throw new Error('Invalid token data. Please reconnect your Google Business Profile in Settings.');
      }

      // Check if token is expired
      const now = Date.now();
      const expires = tokens.expires_at || (tokens.stored_at + (tokens.expires_in * 1000));

      if (expires && now >= expires) {
        throw new Error('Google Business Profile token expired. Please reconnect in Settings > Connections.');
      }

      const accessToken = tokens.access_token;

      // Prepare date range for the last 30 days
      const endDate = new Date().toISOString().split('T')[0];
      const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

      // Only fetch performance data (no profile completeness)
      const [performanceResponse] = await Promise.allSettled([
        fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/locations/${locationId}/audit/performance?startDate=${startDate}&endDate=${endDate}`, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json'
          }
        })
      ]);

      let performanceData = null;

      // Process performance data
      if (performanceResponse.status === 'fulfilled' && performanceResponse.value.ok) {
        const data = await performanceResponse.value.json();
        console.log('📊 Audit Tool - Received performance data:', data);
        
        // Capture diagnostics
        setApiDiagnostics({
          status: 'success',
          statusCode: performanceResponse.value.status,
          apiUsed: data.apiUsed || 'Unknown',
          dateRange: data.dateRange,
          metricsCount: data.performance?.locationMetrics?.[0]?.dailyMetrics?.length || 0,
          sampleData: data.performance?.locationMetrics?.[0]?.dailyMetrics?.slice(0, 2),
          timestamp: new Date().toISOString()
        });
        
        if (data.performance?.locationMetrics?.[0]?.dailyMetrics) {
          // Convert backend format to frontend format
          const dailyMetrics = data.performance.locationMetrics[0].dailyMetrics;
          console.log('📈 Audit Tool - Daily metrics count:', dailyMetrics.length);
          
          const convertedMetrics = dailyMetrics.map((day: any) => ({
            views: day.views || 0,
            impressions: day.impressions || 0,
            calls: day.calls || 0,
            websiteClicks: day.websiteClicks || 0,
            directionRequests: day.directionRequests || 0,
            date: day.date
          }));
          
          console.log('✅ Audit Tool - Converted metrics:', convertedMetrics.slice(0, 3)); // Log first 3 entries
          setMetrics(convertedMetrics);
          performanceData = convertedMetrics;
        } else {
          console.warn('⚠️ Audit Tool - No daily metrics in response:', data);
          setApiDiagnostics({
            status: 'no_data',
            statusCode: performanceResponse.value.status,
            apiUsed: data.apiUsed || 'Unknown',
            message: 'Google Business Profile Performance API returned 0 metrics',
            dateRange: data.dateRange,
            responseStructure: Object.keys(data),
            fullResponse: data,
            explanation: 'This location may not have enough historical data or may not be eligible for Performance API metrics. Google requires 18+ months of activity for most performance metrics.',
            timestamp: new Date().toISOString()
          });
        }
      } else if (performanceResponse.status === 'fulfilled' && performanceResponse.value.status === 503) {
        const errorData = await performanceResponse.value.json();
        console.warn('Performance API access required:', errorData.message);
        setApiDiagnostics({
          status: 'api_unavailable',
          statusCode: 503,
          message: errorData.message,
          suggestions: errorData.suggestions,
          timestamp: new Date().toISOString()
        });
      } else if (performanceResponse.status === 'fulfilled') {
        console.error('❌ Audit Tool - API error:', performanceResponse.value.status, performanceResponse.value.statusText);
        try {
          const errorData = await performanceResponse.value.json();
          console.error('❌ Audit Tool - Error details:', errorData);
          setApiDiagnostics({
            status: 'error',
            statusCode: performanceResponse.value.status,
            statusText: performanceResponse.value.statusText,
            errorDetails: errorData,
            timestamp: new Date().toISOString()
          });
        } catch (e) {
          console.error('❌ Audit Tool - Could not parse error response');
          setApiDiagnostics({
            status: 'error',
            statusCode: performanceResponse.value.status,
            statusText: performanceResponse.value.statusText,
            message: 'Could not parse error response',
            timestamp: new Date().toISOString()
          });
        }
      } else {
        console.error('❌ Audit Tool - Promise rejected:', performanceResponse.reason);
        setApiDiagnostics({
          status: 'rejected',
          reason: performanceResponse.reason?.message || String(performanceResponse.reason),
          timestamp: new Date().toISOString()
        });
      }

      // Check if we have real performance data
      if (!performanceData) {
        throw new Error('Unable to fetch real-time performance data from Google Business Profile API. Please ensure proper API access and permissions are configured for your Google Cloud project.');
      }

      // Calculate audit score using real performance data only
      const calculatedScore = calculateAuditScore(performanceData);

      setAuditScore(calculatedScore);
      setLastUpdated(new Date());

      // Save audit result to backend for admin viewing
      await saveAuditResult(locationId, performanceData, calculatedScore);

      toast({
        title: "Audit Complete",
        description: "Real-time performance metrics updated.",
      });
    } catch (error) {
      console.error('Error fetching real-time data:', error);

      // Clear all data when error occurs
      setMetrics([]);
      setAuditScore(null);
      setLastUpdated(null);

      // Show detailed error message to user
      console.error('🚨 AUDIT TOOL ERROR:', error.message);
      console.error('🔍 Error details:', error);
      
      toast({
        title: "Performance Data Unavailable",
        description: "Unable to retrieve metrics for this profile. Please verify your profile at business.google.com",
        variant: "default",
        duration: 5000,
      });
    } finally {
      setLoadingMetrics(false);
    }
  };


  // Calculate audit score based on real-time performance metrics only
  const calculateAuditScore = (metricsData: PerformanceMetrics[]): AuditScore => {
    // Safety check: ensure we have data
    if (!metricsData || metricsData.length === 0) {
      return {
        overall: 0,
        performance: 0,
        engagement: 0
      };
    }

    // Performance score based on recent metrics
    const recentMetrics = metricsData.slice(-7); // Last 7 days
    
    // Safety check for empty recent metrics
    if (recentMetrics.length === 0) {
      return {
        overall: 0,
        performance: 0,
        engagement: 0
      };
    }

    const totalViews = recentMetrics.reduce((sum, m) => sum + (m.views || 0), 0);
    const avgViews = totalViews / recentMetrics.length;
    const performanceScore = Math.min(100, (avgViews / 100) * 100); // Scale based on views

    // Engagement score based on action ratios
    const totalImpressions = recentMetrics.reduce((sum, m) => sum + (m.impressions || 0), 0);
    const totalActions = recentMetrics.reduce((sum, m) => sum + (m.calls || 0) + (m.websiteClicks || 0) + (m.directionRequests || 0), 0);
    const engagementRate = totalImpressions > 0 ? (totalActions / totalImpressions) * 100 : 0;
    const engagementScore = Math.min(100, engagementRate * 20); // Scale engagement rate

    // Ensure no NaN values
    const overall = Math.round(isNaN(performanceScore) || isNaN(engagementScore) ? 0 : (performanceScore + engagementScore) / 2);
    const performance = Math.round(isNaN(performanceScore) ? 0 : performanceScore);
    const engagement = Math.round(isNaN(engagementScore) ? 0 : engagementScore);

    return {
      overall,
      performance,
      engagement
    };
  };


  // Get score color based on value
  const getScoreColor = (score: number) => {
    if (score >= 80) return 'text-green-600';
    if (score >= 60) return 'text-yellow-600';
    return 'text-red-600';
  };

  // Generate AI insights based on metrics data
  const generateAIInsights = async () => {
    if (!metrics || metrics.length === 0 || !auditScore) {
      toast({
        title: "No Data Available",
        description: "Please fetch performance data first before generating AI insights.",
        variant: "destructive"
      });
      return;
    }

    setLoadingAiInsights(true);
    try {
      // Prepare data summary for AI
      const recentMetrics = metrics.slice(-7);
      const totalViews = recentMetrics.reduce((sum, m) => sum + m.views, 0);
      const totalImpressions = recentMetrics.reduce((sum, m) => sum + m.impressions, 0);
      const totalCalls = recentMetrics.reduce((sum, m) => sum + m.calls, 0);
      const totalWebsiteClicks = recentMetrics.reduce((sum, m) => sum + m.websiteClicks, 0);
      const totalDirections = recentMetrics.reduce((sum, m) => sum + m.directionRequests, 0);
      
      const avgDailyViews = (totalViews / 7).toFixed(1);
      const avgDailyImpressions = (totalImpressions / 7).toFixed(1);
      const conversionRate = totalImpressions > 0 ? ((totalCalls + totalWebsiteClicks + totalDirections) / totalImpressions * 100).toFixed(2) : '0';
      
      // Calculate trends
      const previousWeek = metrics.slice(-14, -7);
      const previousViews = previousWeek.reduce((sum, m) => sum + m.views, 0);
      const viewsTrend = previousViews > 0 ? (((totalViews - previousViews) / previousViews) * 100).toFixed(1) : 'N/A';

      const prompt = `You are an expert Google Business Profile consultant. Analyze this data and provide concise, actionable insights.

Business: ${selectedLocation?.name}
Overall Score: ${auditScore.overall}% | Performance: ${auditScore.performance}% | Engagement: ${auditScore.engagement}%

Last 7 Days: ${totalViews} views, ${totalImpressions} impressions, ${totalCalls} calls, ${totalWebsiteClicks} clicks, ${totalDirections} directions
Conversion Rate: ${conversionRate}% | Trend: ${viewsTrend}%

Provide a brief, scannable analysis in this exact format (NO hashtags, NO emojis, short sentences):

PERFORMANCE SUMMARY
[2-3 sentences about current performance]

KEY STRENGTHS
• [strength 1]
• [strength 2]
• [strength 3]

AREAS TO IMPROVE
• [area 1]
• [area 2]
• [area 3]

TOP 3 ACTIONS
1. [specific action with expected impact]
2. [specific action with expected impact]
3. [specific action with expected impact]

Keep it professional, specific with numbers, and under 200 words total.`;

      const response = await generateAIResponse(prompt, 'gpt-4o');
      setAiInsights(response);
      
      toast({
        title: "AI Insights Generated",
        description: "Detailed analysis and recommendations are ready.",
      });
    } catch (error) {
      console.error('Error generating AI insights:', error);
      toast({
        title: "Error Generating Insights",
        description: "Unable to generate AI insights. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingAiInsights(false);
    }
  };


  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Connect Google Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Connect your Google Business Profile to access the audit tool and performance insights.
            </p>
            <Button asChild>
              <a href="/dashboard/settings">Go to Settings</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading || !businessAccounts || allLocations.length === 0) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <div className="text-center">
          <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">
            {!businessAccounts ? 'Initializing...' : 'Loading your business profiles...'}
          </p>
        </div>
      </div>
    );
  }

  // Get selected location details for display
  const selectedLocation = availableLocations.find(loc => loc.id === selectedLocationId);

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Business Profile Audit</h1>
          <p className="text-muted-foreground">
            Real-time performance insights and optimization recommendations
          </p>
        </div>
        <div className="flex items-center gap-4">
          {lastUpdated && (
            <div className="text-sm text-muted-foreground">
              <p>Last updated: {lastUpdated.toLocaleTimeString()}</p>
              {autoRefresh && (
                <p className="text-xs opacity-75">
                  Auto-refresh: {Math.floor(refreshInterval / 60000)} min
                </p>
              )}
            </div>
          )}
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setShowDiagnostics(!showDiagnostics)}
              variant={showDiagnostics ? "default" : "outline"}
              size="sm"
            >
              🔍 Debug Info
            </Button>
            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant={autoRefresh ? "default" : "outline"}
              size="sm"
            >
              {autoRefresh ? "🔄 Live" : "📍 Manual"}
            </Button>
            <Button
              onClick={() => fetchMetrics(selectedLocationId)}
              disabled={loadingMetrics}
              size="sm"
            >
              {loadingMetrics ? (
                <RefreshCw className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Refresh
            </Button>
          </div>
        </div>
      </div>

      {/* API Diagnostics Panel */}
      {showDiagnostics && apiDiagnostics && (
        <Card className="border-2 border-blue-500 bg-blue-50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              🔍 API Diagnostics
              <Badge variant={
                apiDiagnostics.status === 'success' ? 'default' :
                apiDiagnostics.status === 'no_data' ? 'secondary' : 'destructive'
              }>
                {apiDiagnostics.status}
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3 text-sm font-mono">
              <div className="grid grid-cols-2 gap-2">
                <div><strong>Status Code:</strong> {apiDiagnostics.statusCode}</div>
                <div><strong>Timestamp:</strong> {new Date(apiDiagnostics.timestamp).toLocaleTimeString()}</div>
              </div>
              
              {apiDiagnostics.apiUsed && (
                <div><strong>API Used:</strong> {apiDiagnostics.apiUsed}</div>
              )}
              
              {apiDiagnostics.metricsCount !== undefined && (
                <div><strong>Metrics Count:</strong> {apiDiagnostics.metricsCount} days</div>
              )}
              
              {apiDiagnostics.dateRange && (
                <div><strong>Date Range:</strong> {apiDiagnostics.dateRange.startDate} to {apiDiagnostics.dateRange.endDate}</div>
              )}
              
              {apiDiagnostics.message && (
                <div className="text-orange-700"><strong>Message:</strong> {apiDiagnostics.message}</div>
              )}
              
              {apiDiagnostics.explanation && (
                <div className="text-blue-700 bg-blue-100 p-3 rounded"><strong>⚠️ Why:</strong> {apiDiagnostics.explanation}</div>
              )}
              
              {apiDiagnostics.reason && (
                <div className="text-red-700"><strong>Reason:</strong> {apiDiagnostics.reason}</div>
              )}
              
              {apiDiagnostics.sampleData && (
                <div>
                  <strong>Sample Data:</strong>
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-40">
                    {JSON.stringify(apiDiagnostics.sampleData, null, 2)}
                  </pre>
                </div>
              )}
              
              {apiDiagnostics.suggestions && (
                <div>
                  <strong>Suggestions:</strong>
                  <ul className="list-disc list-inside mt-1 space-y-1 text-blue-800">
                    {apiDiagnostics.suggestions.map((s: string, i: number) => (
                      <li key={i}>{s}</li>
                    ))}
                  </ul>
                </div>
              )}
              
              {apiDiagnostics.fullResponse && (
                <div>
                  <strong>Full API Response:</strong>
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-60">
                    {JSON.stringify(apiDiagnostics.fullResponse, null, 2)}
                  </pre>
                </div>
              )}
              
              {apiDiagnostics.errorDetails && (
                <div>
                  <strong>Error Details:</strong>
                  <pre className="mt-2 p-2 bg-white rounded text-xs overflow-auto max-h-40 text-red-700">
                    {JSON.stringify(apiDiagnostics.errorDetails, null, 2)}
                  </pre>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Currently Viewing Banner - Enhanced */}
      {selectedLocation && (
        <Card className="border-2 border-primary/30 bg-gradient-to-r from-primary/10 via-blue-50/70 to-purple-50/50 shadow-md">
          <CardContent className="py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="relative">
                  <div className="w-12 h-12 bg-primary/20 rounded-full flex items-center justify-center">
                    <BarChart3 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 bg-green-500 rounded-full animate-pulse border-2 border-white"></div>
                </div>
                <div>
                  <p className="text-sm font-medium text-muted-foreground">📊 Audit Analysis For:</p>
                  <div className="flex items-center gap-3 mt-1">
                    <h2 className="text-2xl font-bold text-primary">{selectedLocation.name}</h2>
                    <Badge variant="outline" className="bg-white/70">
                      {selectedLocation.accountName}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    Real-time performance monitoring • {lastUpdated ? `Updated ${lastUpdated.toLocaleTimeString()}` : 'No data yet'}
                  </p>
                </div>
              </div>
              <div className="text-right space-y-2">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                  <span className="text-sm font-bold text-green-700">Live Monitoring</span>
                </div>
                {auditScore && (
                  <div className="flex items-center gap-2">
                    <Target className="h-4 w-4 text-primary" />
                    <span className="text-lg font-bold text-primary">{auditScore.overall}%</span>
                    <span className="text-xs text-muted-foreground">Score</span>
                  </div>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Business Profile Selector */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <MapPin className="h-5 w-5" />
            Select Business Profile to Audit
          </CardTitle>
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              Choose which business profile you want to analyze
            </p>
            <div className="text-xs text-muted-foreground">
              {availableLocations.length} of {allLocations.length} profiles available
              {subscription?.profileCount && (
                <span className="ml-2 text-primary font-medium">
                  (Plan: {subscription.profileCount} profiles)
                </span>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="max-w-md">
            <Select
              value={selectedLocationId}
              onValueChange={(value) => {
                const locationIndex = allLocations.findIndex(loc => loc.id === value);
                if (locationIndex >= maxAllowedProfiles) {
                  toast({
                    title: "Profile Locked",
                    description: `This profile requires an upgrade. You have access to ${maxAllowedProfiles} profile${maxAllowedProfiles === 1 ? '' : 's'}.`,
                    variant: "destructive"
                  });
                  return;
                }
                setSelectedLocationId(value);
                fetchMetrics(value);
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder="Select a business profile to audit..." />
              </SelectTrigger>
              <SelectContent>
                {availableLocations.length > 0 && (
                  <SelectGroup>
                    <SelectLabel>Available Profiles</SelectLabel>
                    {availableLocations.map((location) => (
                      <SelectItem key={location.id} value={location.id}>
                        <div className="flex items-center justify-between w-full">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium text-sm">{location.name}</div>
                            <div className="text-xs text-muted-foreground">{location.accountName}</div>
                          </div>
                          <div className="ml-2 w-2 h-2 bg-green-500 rounded-full flex-shrink-0"></div>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectGroup>
                )}

                {lockedLocations.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="flex items-center gap-2">
                        <Crown className="h-3 w-3 text-yellow-600" />
                        Locked Profiles (Upgrade Required)
                      </SelectLabel>
                      {lockedLocations.map((location) => (
                        <SelectItem
                          key={location.id}
                          value={location.id}
                          disabled
                          className="opacity-60"
                        >
                          <div className="flex items-center justify-between w-full">
                            <div className="flex-1 min-w-0">
                              <div className="font-medium text-sm text-gray-500">{location.name}</div>
                              <div className="text-xs text-muted-foreground">{location.accountName}</div>
                            </div>
                            <div className="ml-2 flex items-center gap-1">
                              <Crown className="h-3 w-3 text-yellow-500" />
                              <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                            </div>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Info Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Active Profile Info */}
            {selectedLocation && (
              <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                  <div className="flex-1">
                    <h4 className="font-medium text-green-900">Selected Profile</h4>
                    <p className="text-sm text-green-700">{selectedLocation.name}</p>
                    <p className="text-xs text-green-600">{selectedLocation.accountName}</p>
                  </div>
                  <Badge className="bg-green-100 text-green-800">Active</Badge>
                </div>
              </div>
            )}

            {/* Upgrade Prompt */}
            {lockedLocations.length > 0 && (
              <div className="p-4 bg-gradient-to-r from-yellow-50 to-orange-50 border border-yellow-200 rounded-lg">
                <div className="flex items-center gap-3">
                  <Crown className="h-5 w-5 text-yellow-600" />
                  <div className="flex-1">
                    <h4 className="font-medium text-gray-900">
                      {lockedLocations.length} profile{lockedLocations.length === 1 ? '' : 's'} locked
                    </h4>
                    <p className="text-sm text-gray-600 mt-1">
                      Upgrade to audit all {allLocations.length} profiles
                    </p>
                  </div>
                  <Button
                    size="sm"
                    className="flex items-center gap-2"
                    onClick={() => window.location.href = '/dashboard/billing'}
                  >
                    <Crown className="h-4 w-4" />
                    Upgrade
                  </Button>
                </div>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* No Profile Selected Message */}
      {!selectedLocationId && (
        <Card className="max-w-2xl mx-auto border-dashed border-2">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <MapPin className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Select a Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Please select a business profile from the dropdown above to begin the audit analysis.
            </p>
            <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
              <BarChart3 className="h-4 w-4" />
              <span>Ready to analyze your Google Business Profile performance</span>
            </div>
          </CardContent>
        </Card>
      )}

      {!auditScore && selectedLocationId && !loadingMetrics && (
        <Card className="max-w-2xl mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-blue-600" />
            </div>
            <CardTitle className="text-xl">Performance Data Unavailable</CardTitle>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-muted-foreground">
              Unable to retrieve performance metrics for this business profile.
            </p>
            
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 text-left">
              <h4 className="font-semibold text-blue-900 mb-2">Common Reasons:</h4>
              <ul className="text-sm text-blue-800 space-y-2">
                <li>• Profile needs to be verified in Google Business Profile</li>
                <li>• Insufficient historical data (requires 18+ months of activity)</li>
                <li>• Profile doesn't meet eligibility requirements for Performance API</li>
                <li>• Recent changes may take 24-48 hours to reflect</li>
              </ul>
            </div>

            <div className="flex gap-3">
              <Button
                onClick={() => window.open('https://business.google.com', '_blank')}
                className="flex-1"
              >
                <CheckCircle className="h-4 w-4 mr-2" />
                Manage Profile
              </Button>
              <Button
                onClick={() => fetchMetrics(selectedLocationId)}
                disabled={loadingMetrics}
                variant="outline"
                className="flex-1"
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${loadingMetrics ? 'animate-spin' : ''}`} />
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {auditScore && (
        <Tabs defaultValue="overview" className="space-y-6">
          <TabsList className="grid w-full grid-cols-3">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="performance">Performance</TabsTrigger>
            <TabsTrigger value="insights">Insights</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="space-y-6">
            {/* Tab Header with Location Context */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <BarChart3 className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Overview</h2>
                  <p className="text-sm text-muted-foreground">
                    Audit overview for <span className="font-medium text-foreground">{selectedLocation?.name}</span>
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="px-3 py-1">
                {selectedLocation?.accountName}
              </Badge>
            </div>

            {/* Audit Score Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Overall Score</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <div className={`text-3xl font-bold ${getScoreColor(auditScore.overall)}`}>
                      {auditScore.overall}%
                    </div>
                    <Target className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Progress value={auditScore.overall} className="mt-2" />
                </CardContent>
              </Card>


              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Performance</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <div className={`text-3xl font-bold ${getScoreColor(auditScore.performance)}`}>
                      {auditScore.performance}%
                    </div>
                    <BarChart3 className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Progress value={auditScore.performance} className="mt-2" />
                </CardContent>
              </Card>

              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-medium">Engagement</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center space-x-2">
                    <div className={`text-3xl font-bold ${getScoreColor(auditScore.engagement)}`}>
                      {auditScore.engagement}%
                    </div>
                    <TrendingUp className="h-5 w-5 text-muted-foreground" />
                  </div>
                  <Progress value={auditScore.engagement} className="mt-2" />
                </CardContent>
              </Card>
            </div>

            {/* Quick Metrics */}
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              {metrics.length > 0 && (
                <>
                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Eye className="h-4 w-4 text-blue-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {metrics.slice(-7).reduce((sum, m) => sum + m.views, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Views (7d)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Search className="h-4 w-4 text-green-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {metrics.slice(-7).reduce((sum, m) => sum + m.impressions, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Impressions (7d)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <Phone className="h-4 w-4 text-orange-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {metrics.slice(-7).reduce((sum, m) => sum + m.calls, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Calls (7d)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <MousePointer className="h-4 w-4 text-purple-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {metrics.slice(-7).reduce((sum, m) => sum + m.websiteClicks, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Website Clicks (7d)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card>
                    <CardContent className="p-4">
                      <div className="flex items-center space-x-2">
                        <MapPin className="h-4 w-4 text-red-500" />
                        <div>
                          <p className="text-2xl font-bold">
                            {metrics.slice(-7).reduce((sum, m) => sum + m.directionRequests, 0)}
                          </p>
                          <p className="text-xs text-muted-foreground">Directions (7d)</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </>
              )}
            </div>
          </TabsContent>

          <TabsContent value="performance" className="space-y-6">
            {/* Tab Header with Location Context */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <TrendingUp className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Performance</h2>
                  <p className="text-sm text-muted-foreground">
                    Performance metrics for <span className="font-medium text-foreground">{selectedLocation?.name}</span>
                  </p>
                </div>
              </div>
              <Badge variant="secondary" className="px-3 py-1">
                {selectedLocation?.accountName}
              </Badge>
            </div>

            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle>Performance Trends (Last 30 Days)</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Track your business profile performance over time
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button
                      variant={chartType === 'area' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('area')}
                    >
                      Area
                    </Button>
                    <Button
                      variant={chartType === 'line' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setChartType('line')}
                    >
                      Line
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                {metrics.length > 0 ? (
                  <div className="space-y-4">
                    <div className="h-80">
                      <ResponsiveContainer width="100%" height="100%">
                        {chartType === 'area' ? (
                          <AreaChart
                            data={metrics.map(metric => ({
                              ...metric,
                              date: new Date(metric.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })
                            }))}
                            margin={{
                              top: 5,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              interval="preserveStartEnd"
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Legend />
                            <Area
                              type="monotone"
                              dataKey="views"
                              stackId="1"
                              stroke="#3b82f6"
                              fill="#3b82f6"
                              fillOpacity={0.6}
                              name="Views"
                            />
                            <Area
                              type="monotone"
                              dataKey="impressions"
                              stackId="2"
                              stroke="#10b981"
                              fill="#10b981"
                              fillOpacity={0.6}
                              name="Impressions"
                            />
                            <Area
                              type="monotone"
                              dataKey="calls"
                              stackId="3"
                              stroke="#f59e0b"
                              fill="#f59e0b"
                              fillOpacity={0.6}
                              name="Calls"
                            />
                            <Area
                              type="monotone"
                              dataKey="websiteClicks"
                              stackId="4"
                              stroke="#8b5cf6"
                              fill="#8b5cf6"
                              fillOpacity={0.6}
                              name="Website Clicks"
                            />
                            <Area
                              type="monotone"
                              dataKey="directionRequests"
                              stackId="5"
                              stroke="#ef4444"
                              fill="#ef4444"
                              fillOpacity={0.6}
                              name="Direction Requests"
                            />
                          </AreaChart>
                        ) : (
                          <LineChart
                            data={metrics.map(metric => ({
                              ...metric,
                              date: new Date(metric.date).toLocaleDateString('en-US', {
                                month: 'short',
                                day: 'numeric'
                              })
                            }))}
                            margin={{
                              top: 5,
                              right: 30,
                              left: 20,
                              bottom: 5,
                            }}
                          >
                            <CartesianGrid strokeDasharray="3 3" className="opacity-30" />
                            <XAxis
                              dataKey="date"
                              tick={{ fontSize: 12 }}
                              interval="preserveStartEnd"
                            />
                            <YAxis tick={{ fontSize: 12 }} />
                            <Tooltip
                              contentStyle={{
                                backgroundColor: 'hsl(var(--background))',
                                border: '1px solid hsl(var(--border))',
                                borderRadius: '6px',
                                boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)'
                              }}
                              labelStyle={{ color: 'hsl(var(--foreground))' }}
                            />
                            <Legend />
                            <Line
                              type="monotone"
                              dataKey="views"
                              stroke="#3b82f6"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Views"
                            />
                            <Line
                              type="monotone"
                              dataKey="impressions"
                              stroke="#10b981"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Impressions"
                            />
                            <Line
                              type="monotone"
                              dataKey="calls"
                              stroke="#f59e0b"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Calls"
                            />
                            <Line
                              type="monotone"
                              dataKey="websiteClicks"
                              stroke="#8b5cf6"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Website Clicks"
                            />
                            <Line
                              type="monotone"
                              dataKey="directionRequests"
                              stroke="#ef4444"
                              strokeWidth={2}
                              dot={{ r: 4 }}
                              name="Direction Requests"
                            />
                          </LineChart>
                        )}
                      </ResponsiveContainer>
                    </div>

                    {/* Metrics Summary */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mt-6">
                      <div className="text-center">
                        <p className="text-2xl font-bold text-blue-600">
                          {(metrics.reduce((sum, m) => sum + m.views, 0) / metrics.length).toFixed(0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Avg Daily Views</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-green-600">
                          {(metrics.reduce((sum, m) => sum + m.impressions, 0) / metrics.length).toFixed(0)}
                        </p>
                        <p className="text-sm text-muted-foreground">Avg Daily Impressions</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-orange-600">
                          {(metrics.reduce((sum, m) => sum + m.calls, 0) / metrics.length).toFixed(1)}
                        </p>
                        <p className="text-sm text-muted-foreground">Avg Daily Calls</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-purple-600">
                          {(metrics.reduce((sum, m) => sum + m.websiteClicks, 0) / metrics.length).toFixed(1)}
                        </p>
                        <p className="text-sm text-muted-foreground">Avg Daily Clicks</p>
                      </div>
                      <div className="text-center">
                        <p className="text-2xl font-bold text-red-600">
                          {(metrics.reduce((sum, m) => sum + m.directionRequests, 0) / metrics.length).toFixed(1)}
                        </p>
                        <p className="text-sm text-muted-foreground">Avg Daily Directions</p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <BarChart3 className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                    <p className="text-muted-foreground">No performance data available</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>


          <TabsContent value="insights" className="space-y-6">
            {/* Tab Header with Location Context */}
            <div className="flex items-center justify-between border-b pb-4">
              <div className="flex items-center gap-3">
                <Target className="h-6 w-6 text-primary" />
                <div>
                  <h2 className="text-xl font-semibold">Insights</h2>
                  <p className="text-sm text-muted-foreground">
                    Business insights for <span className="font-medium text-foreground">{selectedLocation?.name}</span>
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={generateAIInsights}
                  disabled={loadingAiInsights || !metrics || metrics.length === 0}
                  size="sm"
                  className="bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700"
                >
                  {loadingAiInsights ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <Target className="h-4 w-4 mr-2" />
                      Generate AI Insights
                    </>
                  )}
                </Button>
                <Badge variant="secondary" className="px-3 py-1">
                  {selectedLocation?.accountName}
                </Badge>
              </div>
            </div>

            {/* AI-Generated Insights Card */}
            {aiInsights && (
              <Card className="border-2 border-blue-200 bg-white shadow-lg">
                <CardHeader className="bg-gradient-to-r from-blue-50 to-purple-50 border-b">
                  <CardTitle className="flex items-center gap-2 text-gray-900">
                    <Target className="h-5 w-5 text-blue-600" />
                    AI-Powered Insights
                    <Badge className="bg-blue-600 text-white">GPT-4</Badge>
                  </CardTitle>
                  <p className="text-sm text-gray-600">
                    Expert recommendations for {selectedLocation?.name}
                  </p>
                </CardHeader>
                <CardContent className="pt-6">
                  <div className="space-y-6">
                    {aiInsights.split('\n\n').map((section, index) => {
                      const lines = section.split('\n');
                      const title = lines[0]?.trim();
                      const content = lines.slice(1);

                      if (!title) return null;

                      return (
                        <div key={index} className="space-y-2">
                          <h3 className="font-semibold text-sm text-blue-900 uppercase tracking-wide">
                            {title}
                          </h3>
                          <div className="text-sm text-gray-700 space-y-1 pl-1">
                            {content.map((line, idx) => (
                              <div key={idx} className={line.trim().startsWith('•') || line.trim().match(/^\d\./) ? 'ml-2' : ''}>
                                {line}
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Placeholder when no AI insights */}
            {!aiInsights && !loadingAiInsights && (
              <Card className="border-2 border-dashed border-blue-200">
                <CardContent className="py-12 text-center">
                  <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-blue-100 flex items-center justify-center">
                    <Target className="h-8 w-8 text-blue-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-900 mb-2">Get AI-Powered Insights</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    Get a concise analysis with key strengths, areas to improve, and top 3 actions to boost your profile performance.
                  </p>
                  <Button
                    onClick={generateAIInsights}
                    disabled={!metrics || metrics.length === 0}
                    className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
                  >
                    <Target className="h-4 w-4 mr-2" />
                    Generate Insights
                  </Button>
                </CardContent>
              </Card>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Real-time Status Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    {autoRefresh ? (
                      <>
                        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
                        Real-time Monitoring
                      </>
                    ) : (
                      <>
                        <div className="w-3 h-3 bg-gray-400 rounded-full"></div>
                        Manual Updates
                      </>
                    )}
                  </CardTitle>
                  <p className="text-sm text-muted-foreground">
                    {autoRefresh ? 'Data automatically refreshes every 5 minutes' : 'Click refresh to update data manually'}
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Data Source</span>
                    <Badge variant="outline">Google Business Profile API</Badge>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Update Frequency</span>
                    <span className="text-sm font-medium">
                      {autoRefresh ? `${Math.floor(refreshInterval / 60000)} minutes` : 'Manual'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Last Refresh</span>
                    <span className="text-sm font-medium">
                      {lastUpdated ? lastUpdated.toLocaleTimeString() : 'Never'}
                    </span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-sm">Data Points</span>
                    <span className="text-sm font-medium">{metrics.length} days</span>
                  </div>
                </CardContent>
              </Card>

              {/* Performance Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Performance Summary</CardTitle>
                  <p className="text-sm text-muted-foreground">
                    Key metrics overview (last 7 days)
                  </p>
                </CardHeader>
                <CardContent className="space-y-3">
                  {metrics.length > 0 && (
                    <>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Total Views</span>
                        <span className="text-lg font-bold text-blue-600">
                          {metrics.slice(-7).reduce((sum, m) => sum + m.views, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Impressions</span>
                        <span className="text-lg font-bold text-green-600">
                          {metrics.slice(-7).reduce((sum, m) => sum + m.impressions, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">Customer Actions</span>
                        <span className="text-lg font-bold text-purple-600">
                          {metrics.slice(-7).reduce((sum, m) => sum + m.calls + m.websiteClicks + m.directionRequests, 0)}
                        </span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-sm">View Rate</span>
                        <span className="text-lg font-bold text-orange-600">
                          {((metrics.slice(-7).reduce((sum, m) => sum + m.views, 0) / metrics.slice(-7).reduce((sum, m) => sum + m.impressions, 0)) * 100).toFixed(1)}%
                        </span>
                      </div>
                    </>
                  )}
                </CardContent>
              </Card>
            </div>

            {/* Detailed Insights */}
            <Card>
              <CardHeader>
                <CardTitle>Business Insights</CardTitle>
                <p className="text-sm text-muted-foreground">
                  AI-powered insights about your Google Business Profile performance
                </p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="border-l-4 border-blue-500 pl-4">
                    <h4 className="font-medium">Visibility Trend</h4>
                    <p className="text-sm text-muted-foreground">
                      Your profile visibility has been {metrics.length > 14 ? (
                        metrics.slice(-7).reduce((sum, m) => sum + m.views, 0) >
                        metrics.slice(-14, -7).reduce((sum, m) => sum + m.views, 0) ? 'increasing 📈' : 'decreasing 📉'
                      ) : 'stable 📋'} over the past week.
                    </p>
                    {metrics.length > 14 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Change: {(
                          ((metrics.slice(-7).reduce((sum, m) => sum + m.views, 0) - metrics.slice(-14, -7).reduce((sum, m) => sum + m.views, 0)) / metrics.slice(-14, -7).reduce((sum, m) => sum + m.views, 0)) * 100
                        ).toFixed(1)}% vs. previous week
                      </p>
                    )}
                  </div>

                  <div className="border-l-4 border-green-500 pl-4">
                    <h4 className="font-medium">Customer Actions</h4>
                    <p className="text-sm text-muted-foreground">
                      Customers are most likely to {metrics.length > 0 && (
                        metrics.slice(-7).reduce((sum, m) => sum + m.calls, 0) >
                        metrics.slice(-7).reduce((sum, m) => sum + m.websiteClicks, 0) ? 'call your business 📞' : 'visit your website 🌐'
                      )} after viewing your profile.
                    </p>
                    {metrics.length > 0 && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Action rate: {(
                          (metrics.slice(-7).reduce((sum, m) => sum + m.calls + m.websiteClicks + m.directionRequests, 0) / metrics.slice(-7).reduce((sum, m) => sum + m.views, 0)) * 100
                        ).toFixed(1)}% of viewers take action
                      </p>
                    )}
                  </div>

                  <div className="border-l-4 border-orange-500 pl-4">
                    <h4 className="font-medium">Optimization Opportunity</h4>
                    <p className="text-sm text-muted-foreground">
                      {auditScore.overall < 80
                        ? 'Improve your business profile performance to increase visibility. 🎯'
                        : 'Your profile is performing well. Keep up the great work! ✅'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Overall score: {auditScore.overall}%
                    </p>
                  </div>

                  <div className="border-l-4 border-purple-500 pl-4">
                    <h4 className="font-medium">Industry Benchmark</h4>
                    <p className="text-sm text-muted-foreground">
                      Your engagement rate is {auditScore.engagement > 60 ? 'above 🚀' : 'below 📉'} industry average.
                      {auditScore.engagement > 60 ? ' Keep up the great work!' : ' Consider posting more engaging content.'}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Engagement score: {auditScore.engagement}% (target: 60%+)
                    </p>
                  </div>
                </div>

                {/* Competitive Analysis */}
                <div className="mt-6 p-4 bg-gradient-to-r from-blue-50 to-purple-50 rounded-lg border">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Target className="h-4 w-4" />
                    Quick Win Recommendations
                  </h4>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Post 2-3 times weekly</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Respond to all reviews</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <CheckCircle className="h-4 w-4 text-green-500" />
                      <span>Add 5+ photos monthly</span>
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
};

export default AuditTool;
