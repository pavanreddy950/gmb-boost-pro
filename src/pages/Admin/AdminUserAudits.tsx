import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Search,
  Building2,
  TrendingUp,
  TrendingDown,
  Eye,
  Phone,
  MousePointer,
  MapPin,
  AlertCircle,
  CheckCircle,
  BarChart3,
  Activity
} from 'lucide-react';
import { useAdmin } from '@/contexts/AdminContext';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

const AdminUserAudits = () => {
  const { users, fetchUsers } = useAdmin();
  const { currentUser } = useAuth();
  const { toast } = useToast();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [locations, setLocations] = useState<any[]>([]);
  const [selectedLocation, setSelectedLocation] = useState<any>(null);
  const [auditData, setAuditData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  // Fetch all users when component mounts
  useEffect(() => {
    fetchUsers();
  }, []);

  const searchUser = async () => {
    if (!searchQuery) {
      toast({
        title: "Error",
        description: "Please enter a user email to search",
        variant: "destructive"
      });
      return;
    }

    const user = users.find(u => 
      u.email.toLowerCase().includes(searchQuery.toLowerCase())
    );

    if (!user) {
      toast({
        title: "User Not Found",
        description: "No user found with that email",
        variant: "destructive"
      });
      return;
    }

    setSelectedUser(user);
    await fetchUserLocations(user.uid);
  };

  const fetchUserLocations = async (uid: string) => {
    setLoading(true);
    try {
      if (!currentUser) {
        throw new Error('Not authenticated');
      }
      
      const token = await currentUser.getIdToken();
      const response = await fetch(`${BACKEND_URL}/api/admin/users/${uid}/business-audits`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to fetch user locations');
      }

      const result = await response.json();
      setLocations(result.data.locations || []);
      
      if (result.data.locations.length === 0) {
        toast({
          title: "No Locations",
          description: "This user hasn't connected any business profiles yet",
          variant: "default"
        });
      }
    } catch (error: any) {
      console.error('Error fetching user locations:', error);
      toast({
        title: "Error",
        description: error.message || "Failed to fetch user's business profiles",
        variant: "destructive"
      });
      setLocations([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchLocationAudit = async (locationId: string) => {
    if (!selectedUser || !currentUser) return;

    setLoading(true);
    try {
      const token = await currentUser.getIdToken();
      const response = await fetch(
        `${BACKEND_URL}/api/admin/users/${selectedUser.uid}/locations/${encodeURIComponent(locationId)}/audit`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Failed to fetch audit data');
      }

      const result = await response.json();
      setAuditData(result.data);
      
      const location = locations.find(loc => loc.name === locationId);
      setSelectedLocation(location);
    } catch (error: any) {
      console.error('Error fetching audit:', error);
      toast({
        title: "Error",
        description: "Failed to fetch audit data for this location",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  const formatNumber = (num: number) => {
    if (!num) return '0';
    return new Intl.NumberFormat().format(num);
  };

  const getMetricIcon = (metric: string) => {
    if (metric.includes('IMPRESSIONS')) return <Eye className="h-4 w-4" />;
    if (metric.includes('CALL')) return <Phone className="h-4 w-4" />;
    if (metric.includes('WEBSITE')) return <MousePointer className="h-4 w-4" />;
    if (metric.includes('DIRECTION')) return <MapPin className="h-4 w-4" />;
    return <Activity className="h-4 w-4" />;
  };

  const getPriorityBadge = (priority: string) => {
    const colors = {
      high: 'bg-red-100 text-red-800',
      medium: 'bg-yellow-100 text-yellow-800',
      low: 'bg-blue-100 text-blue-800'
    };
    return colors[priority as keyof typeof colors] || colors.medium;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">User Business Audits</h1>
        <p className="text-gray-600 mt-2">
          View any user's business profile audit to help with customer support
        </p>
      </div>

      {/* Search User */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Search className="h-5 w-5" />
            Select User ({users.length} total)
          </CardTitle>
          <CardDescription>
            Search or select a user to view their business profile audits
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex gap-2 mb-4">
            <Input
              placeholder="Search by email or name..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && searchUser()}
              className="flex-1"
            />
            <Button onClick={searchUser} disabled={loading}>
              <Search className="h-4 w-4 mr-2" />
              Search
            </Button>
          </div>

          {selectedUser && (
            <div className="mt-4 p-4 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-sm text-blue-900">Selected User:</h3>
              <p className="text-blue-800">{selectedUser.email}</p>
              <p className="text-sm text-blue-600">{selectedUser.displayName}</p>
            </div>
          )}

          {/* User List */}
          {!selectedUser && users.length > 0 && (
            <div className="mt-4">
              <h3 className="text-sm font-semibold mb-2 text-gray-700">Recent Users:</h3>
              <div className="max-h-64 overflow-y-auto space-y-2">
                {users
                  .filter(u => 
                    !searchQuery || 
                    u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
                    u.displayName?.toLowerCase().includes(searchQuery.toLowerCase())
                  )
                  .slice(0, 10)
                  .map(user => (
                    <div
                      key={user.uid}
                      onClick={() => {
                        setSelectedUser(user);
                        fetchUserLocations(user.uid);
                      }}
                      className="p-3 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                    >
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="font-medium text-sm">{user.email}</p>
                          {user.displayName && (
                            <p className="text-xs text-gray-600">{user.displayName}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2">
                          {user.subscription?.status && (
                            <Badge className="text-xs">
                              {user.subscription.status}
                            </Badge>
                          )}
                          <Button size="sm" variant="ghost">
                            Select →
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            </div>
          )}

          {!selectedUser && users.length === 0 && !loading && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg text-center">
              <p className="text-sm text-gray-600">Loading users...</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Locations List */}
      {locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Building2 className="h-5 w-5" />
              Business Profiles ({locations.length})
            </CardTitle>
            <CardDescription>
              Click on a location to view its audit report
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid gap-3">
              {locations.map((location) => (
                <div
                  key={location.name}
                  onClick={() => fetchLocationAudit(location.name)}
                  className="p-4 border rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <h4 className="font-semibold">{location.title}</h4>
                      <p className="text-sm text-gray-600">{location.storefrontAddress?.addressLines?.join(', ')}</p>
                    </div>
                    <Button size="sm" variant="outline">
                      View Audit
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Audit Data */}
      {auditData && selectedLocation && (
        <div className="space-y-6">
          {/* Location Info */}
          <Card>
            <CardHeader>
              <CardTitle>Audit Report: {selectedLocation.title}</CardTitle>
              <CardDescription>
                Last 30 days • {auditData.dateRange?.startDate} to {auditData.dateRange?.endDate}
              </CardDescription>
            </CardHeader>
          </Card>

          {/* Performance Metrics */}
          {auditData.performance && auditData.performance.timeSeriesData && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <BarChart3 className="h-5 w-5" />
                  Performance Metrics (Last 30 Days)
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {auditData.performance.timeSeriesData.map((series: any) => {
                    const total = series.timeSeries?.datedValues?.reduce((sum: number, dv: any) => sum + (dv.value || 0), 0) || 0;
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

          {auditData.performance && !auditData.performance.timeSeriesData && (
            <Card>
              <CardContent className="py-8 text-center">
                <AlertCircle className="h-12 w-12 text-yellow-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  No Performance Data Available
                </h3>
                <p className="text-gray-600">
                  This profile doesn't have performance data yet, or the Performance API needs to be enabled.
                </p>
              </CardContent>
            </Card>
          )}

          {/* Recommendations */}
          {auditData.recommendations?.recommendations && auditData.recommendations.recommendations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-5 w-5" />
                  Recommendations ({auditData.recommendations.recommendations.length})
                </CardTitle>
                <CardDescription>
                  AI-powered suggestions to improve this business profile
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {auditData.recommendations.recommendations.map((rec: any, index: number) => (
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

          {auditData.recommendations?.recommendations?.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center">
                <CheckCircle className="h-12 w-12 text-green-600 mx-auto mb-3" />
                <h3 className="text-lg font-semibold text-gray-900 mb-2">
                  Profile Looking Good!
                </h3>
                <p className="text-gray-600">
                  No critical recommendations at this time. The business profile is performing well.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Empty State */}
      {!selectedUser && !loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <Search className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              No User Selected
            </h3>
            <p className="text-gray-600">
              Search for a user by email to view their business profile audits
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading State */}
      {loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-gray-600">Loading audit data...</p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AdminUserAudits;

