import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Search,
  Building2,
  TrendingUp,
  Eye,
  Phone,
  MousePointer,
  MapPin,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Activity,
  Calendar,
  User
} from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const AdminUserAuditsNew = () => {
  const { users, fetchUsers } = useAdmin();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [allAudits, setAllAudits] = useState<any[]>([]);
  const [filteredAudits, setFilteredAudits] = useState<any[]>([]);
  const [selectedAudit, setSelectedAudit] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [stats, setStats] = useState<any>(null);

  // Fetch all users when component mounts
  useEffect(() => {
    fetchUsers();
    fetchAllAudits();
    fetchStats();
  }, []);

  // Filter audits when search query changes
  useEffect(() => {
    if (!searchQuery) {
      setFilteredAudits(allAudits);
    } else {
      const filtered = allAudits.filter(audit =>
        audit.userEmail.toLowerCase().includes(searchQuery.toLowerCase()) ||
        audit.locationName.toLowerCase().includes(searchQuery.toLowerCase())
      );
      setFilteredAudits(filtered);
    }
  }, [searchQuery, allAudits]);

  const fetchAllAudits = async () => {
    setLoading(true);
    try {
      if (!currentUser) {
        throw new Error('Not authenticated');
      }

      const token = await currentUser.getIdToken();
      const response = await fetch(`${BACKEND_URL}/api/admin/audit-results`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch audit results');
      }

      const result = await response.json();
      setAllAudits(result.data.results || []);
      setFilteredAudits(result.data.results || []);
    } catch (error: any) {
      console.error('Error fetching audits:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch audit results",
        variant: "destructive"
      });
      setAllAudits([]);
      setFilteredAudits([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async () => {
    try {
      if (!currentUser) return;

      const token = await currentUser.getIdToken();
      const response = await fetch(`${BACKEND_URL}/api/admin/audit-results/stats`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const result = await response.json();
        setStats(result.data);
      }
    } catch (error: any) {
      console.error('Error fetching audit stats:', error);
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getScoreBadgeColor = (score: number) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  const getMetricIcon = (metric: string) => {
    if (metric.includes('IMPRESSIONS')) return <Eye className="h-4 w-4" />;
    if (metric.includes('CALL')) return <Phone className="h-4 w-4" />;
    if (metric.includes('WEBSITE')) return <MousePointer className="h-4 w-4" />;
    if (metric.includes('DIRECTION')) return <MapPin className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const formatNumber = (num: number) => {
    if (!num) return '0';
    return new Intl.NumberFormat().format(num);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Business Audits</h1>
        <p className="text-gray-600 mt-2">
          View all users' saved business profile audits to help with customer support
        </p>
      </div>

      {/* Stats Cards */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Total Audits</CardDescription>
              <CardTitle className="text-3xl">{stats.totalAudits}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Unique Users</CardDescription>
              <CardTitle className="text-3xl">{stats.uniqueUsers}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Locations</CardDescription>
              <CardTitle className="text-3xl">{stats.uniqueLocations}</CardTitle>
            </CardHeader>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardDescription>Avg Score</CardDescription>
              <CardTitle className="text-3xl">{stats.averageScore}%</CardTitle>
            </CardHeader>
          </Card>
        </div>
      )}

      {/* Search and Filter */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Search Audits ({filteredAudits.length} results)
          </CardTitle>
          <CardDescription>
            Search by user email or location name
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by email or location name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="flex-1"
            />
            <Button onClick={fetchAllAudits} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Audits List */}
      {!loading && filteredAudits.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Audit Results ({filteredAudits.length})
            </CardTitle>
            <CardDescription>
              Click on an audit to view full details
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {filteredAudits.map((audit) => (
                <div
                  key={audit.id}
                  onClick={() => setSelectedAudit(audit)}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h4 className="font-semibold">{audit.locationName}</h4>
                        {audit.score?.overall && (
                          <Badge className={getScoreBadgeColor(audit.score.overall)}>
                            Score: {audit.score.overall}%
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-gray-600">
                        <span className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          {audit.userEmail}
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          {formatDate(audit.timestamp)}
                        </span>
                      </div>
                      {audit.recommendations?.recommendations?.length > 0 && (
                        <p className="text-sm text-amber-600 mt-2">
                          {audit.recommendations.recommendations.length} recommendations
                        </p>
                      )}
                    </div>
                    <Button size="sm" variant="outline">
                      View Details
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Detail View */}
      {selectedAudit && (
        <div className="space-y-6">
          {/* Header with close button */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>{selectedAudit.locationName}</CardTitle>
                  <CardDescription>
                    {selectedAudit.userEmail} • {formatDate(selectedAudit.timestamp)}
                  </CardDescription>
                </div>
                <Button variant="outline" onClick={() => setSelectedAudit(null)}>
                  Close
                </Button>
              </div>
            </CardHeader>
          </Card>

          {/* Performance Metrics */}
          {selectedAudit.performance?.timeSeriesData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {selectedAudit.performance.timeSeriesData.map((series: any) => {
                    const total = series.timeSeries?.datedValues?.reduce(
                      (sum: number, dv: any) => sum + (dv.value || 0), 0
                    ) || 0;
                    const metricName = series.dailyMetric.replace(/_/g, ' ').replace('BUSINESS ', '');

                    return (
                      <div key={series.dailyMetric} className="p-4 border rounded-lg">
                        <div className="flex items-center justify-between mb-2">
                          <span className="flex items-center gap-2 text-sm font-medium text-gray-600">
                            {getMetricIcon(series.dailyMetric)}
                            {metricName}
                          </span>
                        </div>
                        <p className="text-2xl font-bold">{formatNumber(total)}</p>
                        <p className="text-xs text-gray-500 mt-1">
                          {series.timeSeries?.datedValues?.length || 0} days of data
                        </p>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {selectedAudit.recommendations?.recommendations && selectedAudit.recommendations.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Recommendations ({selectedAudit.recommendations.recommendations.length})
                </CardTitle>
                <CardDescription>
                  AI-powered suggestions to improve this business profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {selectedAudit.recommendations.recommendations.map((rec: any, index: number) => (
                    <div key={index} className="p-4 border rounded-lg">
                      <div className="flex items-start justify-between mb-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold">{rec.title}</h4>
                            <Badge className={getPriorityBadge(rec.priority)}>
                              {rec.priority}
                            </Badge>
                          </div>
                          <p className="text-sm text-gray-600 mb-3">{rec.description}</p>
                          {rec.impact && (
                            <p className="text-sm text-blue-600 font-medium mb-2">
                              💡 {rec.impact}
                            </p>
                          )}
                          {rec.actions && rec.actions.length > 0 && (
                            <div className="mt-3">
                              <p className="text-sm font-medium text-gray-700 mb-2">Action Steps:</p>
                              <ul className="space-y-1">
                                {rec.actions.map((action: string, i: number) => (
                                  <li key={i} className="text-sm text-gray-600 flex items-start gap-2">
                                    <CheckCircle className="h-4 w-4 text-green-600 mt-0.5 flex-shrink-0" />
                                    {action}
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Score Breakdown */}
          {selectedAudit.score && (
            <Card>
              <CardHeader>
                <CardTitle>Score Breakdown</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {selectedAudit.score.overall && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Overall Score</p>
                      <p className="text-3xl font-bold">{selectedAudit.score.overall}%</p>
                    </div>
                  )}
                  {selectedAudit.score.performance && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Performance</p>
                      <p className="text-3xl font-bold">{selectedAudit.score.performance}%</p>
                    </div>
                  )}
                  {selectedAudit.score.engagement && (
                    <div className="p-4 border rounded-lg">
                      <p className="text-sm text-gray-600 mb-1">Engagement</p>
                      <p className="text-3xl font-bold">{selectedAudit.score.engagement}%</p>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {!loading && filteredAudits.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <AlertCircle className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No Audit Results Found
            </h3>
            <p className="text-gray-600">
              {searchQuery
                ? "No audits match your search query. Try a different search term."
                : "No users have run audits yet. Audits will appear here once users run them."}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit results...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminUserAuditsNew;
