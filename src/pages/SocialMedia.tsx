import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Share2,
  Instagram,
  Facebook,
  Link2,
  Unlink,
  CheckCircle2,
  XCircle,
  MapPin,
  Sparkles,
  Zap,
  ArrowRight,
  RefreshCw,
  ExternalLink,
  Shield,
  Clock,
  TrendingUp,
  ChevronRight,
  Loader2,
  AlertCircle
} from 'lucide-react';
import { useGoogleBusinessProfile } from '@/hooks/useGoogleBusinessProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface SocialConnection {
  id: string;
  gmail: string;
  phone_number: string | null;
  location_name: string;
  location_id: string;
  instagram_enabled: boolean;
  instagram_user_id: string | null;
  instagram_username: string | null;
  instagram_access_token: string | null;
  facebook_enabled: boolean;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
  facebook_access_token: string | null;
  created_at: string;
  updated_at: string;
}

interface LocationWithConnection {
  locationId: string;
  displayName: string;
  address: string;
  connection: SocialConnection | null;
}

const SocialMedia = () => {
  const { accounts, isConnected, isLoading: googleLoading } = useGoogleBusinessProfile();
  const { currentUser } = useAuth();

  const [connections, setConnections] = useState<SocialConnection[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [connectingLocation, setConnectingLocation] = useState<string | null>(null);
  const [expandedLocation, setExpandedLocation] = useState<string | null>(null);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';
  const gmailId = currentUser?.email || '';

  // Get all locations from accounts
  const allLocations: LocationWithConnection[] = accounts.flatMap(account =>
    account.locations.map(loc => ({
      locationId: loc.locationId,
      displayName: loc.displayName,
      address: loc.address?.locality || loc.address?.addressLines?.[0] || '',
      connection: connections.find(c => c.location_id === loc.locationId) || null
    }))
  );

  // Fetch social connections
  const fetchConnections = useCallback(async () => {
    if (!gmailId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/social/connections?gmailId=${encodeURIComponent(gmailId)}`
      );
      const data = await response.json();

      if (data.success) {
        setConnections(data.connections || []);
      }
    } catch (error) {
      console.error('Error fetching social connections:', error);
    } finally {
      setIsLoading(false);
    }
  }, [gmailId, backendUrl]);

  useEffect(() => {
    if (gmailId) {
      fetchConnections();
    }
  }, [gmailId, fetchConnections]);

  // Handle OAuth callback success/error
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const success = urlParams.get('success');
    const error = urlParams.get('error');
    const page = urlParams.get('page');
    const username = urlParams.get('username');

    if (success) {
      if (success === 'facebook_connected') {
        toast({
          title: 'Facebook Connected!',
          description: `Successfully connected to ${page || 'your Facebook Page'}`,
        });
      } else if (success === 'instagram_connected') {
        toast({
          title: 'Instagram Connected!',
          description: `Successfully connected to @${username || 'your Instagram account'}`,
        });
      }
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
      fetchConnections();
    }

    if (error) {
      let errorMessage = error;
      if (error === 'no_pages_found') {
        errorMessage = 'No Facebook Pages found. Make sure you have admin access to a Facebook Page.';
      } else if (error === 'no_instagram_business_account') {
        errorMessage = 'No Instagram Business account found. Make sure your Instagram is connected to a Facebook Page.';
      }
      toast({
        title: 'Connection Failed',
        description: decodeURIComponent(errorMessage),
        variant: 'destructive'
      });
      // Clean URL
      window.history.replaceState({}, '', window.location.pathname);
    }
  }, []);

  // Connect Facebook/Instagram for a location
  const handleConnect = async (locationId: string, locationName: string, platform: 'instagram' | 'facebook') => {
    setConnectingLocation(`${locationId}-${platform}`);

    try {
      // Build OAuth URL with location info
      const authEndpoint = platform === 'instagram'
        ? `${backendUrl}/auth/instagram`
        : `${backendUrl}/auth/facebook`;

      const params = new URLSearchParams({
        gmailId,
        locationId,
        locationName,
        platform
      });

      // Redirect to OAuth
      window.location.href = `${authEndpoint}?${params.toString()}`;

    } catch (error: any) {
      toast({
        title: 'Connection Failed',
        description: error.message || 'Failed to connect account',
        variant: 'destructive'
      });
      setConnectingLocation(null);
    }
  };

  // Disconnect a platform
  const handleDisconnect = async (locationId: string, platform: 'instagram' | 'facebook') => {
    try {
      const response = await fetch(`${backendUrl}/api/social/disconnect`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmailId,
          locationId,
          platform
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Disconnected',
          description: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} has been disconnected`,
        });
        fetchConnections();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to disconnect account',
        variant: 'destructive'
      });
    }
  };

  // Toggle auto-posting for a platform
  const handleToggleAutoPost = async (locationId: string, platform: 'instagram' | 'facebook', enabled: boolean) => {
    try {
      const response = await fetch(`${backendUrl}/api/social/toggle`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          gmailId,
          locationId,
          platform,
          enabled
        })
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: enabled ? 'Auto-posting Enabled' : 'Auto-posting Disabled',
          description: `${platform === 'instagram' ? 'Instagram' : 'Facebook'} auto-posting is now ${enabled ? 'enabled' : 'disabled'}`,
        });
        fetchConnections();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to update settings',
        variant: 'destructive'
      });
    }
  };

  // Stats
  const totalLocations = allLocations.length;
  const connectedInstagram = connections.filter(c => c.instagram_user_id).length;
  const connectedFacebook = connections.filter(c => c.facebook_page_id).length;

  if (googleLoading || isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-6">
          <Skeleton className="h-40 w-full rounded-2xl" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
          <Skeleton className="h-64 w-full rounded-xl" />
        </div>
      </div>
    );
  }

  if (!isConnected || allLocations.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-0 shadow-2xl bg-gradient-to-br from-purple-50 via-pink-50 to-orange-50 overflow-hidden">
          <CardContent className="p-12 text-center relative">
            {/* Animated background elements */}
            <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none">
              <div className="absolute -top-20 -right-20 w-64 h-64 bg-gradient-to-br from-purple-400/20 to-pink-400/20 rounded-full blur-3xl animate-pulse" />
              <div className="absolute -bottom-20 -left-20 w-64 h-64 bg-gradient-to-br from-orange-400/20 to-yellow-400/20 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
            </div>

            <div className="relative z-10">
              <div className="w-24 h-24 mx-auto mb-6 rounded-3xl bg-gradient-to-br from-purple-500 via-pink-500 to-orange-500 flex items-center justify-center shadow-xl transform hover:scale-110 transition-transform duration-300">
                <Share2 className="h-12 w-12 text-white" />
              </div>
              <h2 className="text-3xl font-bold mb-3 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 bg-clip-text text-transparent">
                Connect Your Business First
              </h2>
              <p className="text-muted-foreground max-w-md mx-auto text-lg">
                Connect your Google Business Profile to start cross-posting to Instagram and Facebook.
              </p>
              <Button
                className="mt-8 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500 hover:from-purple-700 hover:via-pink-700 hover:to-orange-600 text-white px-8 py-6 text-lg rounded-xl shadow-lg hover:shadow-xl transition-all duration-300"
              >
                Go to Settings
                <ArrowRight className="ml-2 h-5 w-5" />
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Hero Header */}
      <Card className="border-0 shadow-2xl overflow-hidden relative">
        <div className="absolute inset-0 bg-gradient-to-r from-purple-600 via-pink-600 to-orange-500" />
        <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iNjAiIGhlaWdodD0iNjAiIHZpZXdCb3g9IjAgMCA2MCA2MCIgeG1sbnM9Imh0dHA6Ly93d3cudzMub3JnLzIwMDAvc3ZnIj48ZyBmaWxsPSJub25lIiBmaWxsLXJ1bGU9ImV2ZW5vZGQiPjxnIGZpbGw9IiNmZmYiIGZpbGwtb3BhY2l0eT0iMC4xIj48cGF0aCBkPSJNMzYgMzRjMC0yLjIgMS44LTQgNC00czQgMS44IDQgNC0xLjggNC00IDQtNC0xLjgtNC00eiIvPjwvZz48L2c+PC9zdmc+')] opacity-30" />

        <CardContent className="p-8 relative z-10">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-6">
            <div className="flex items-center gap-5">
              <div className="w-16 h-16 rounded-2xl bg-white/20 backdrop-blur-sm flex items-center justify-center shadow-lg transform hover:rotate-6 transition-transform duration-300">
                <Share2 className="h-9 w-9 text-white" />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-3xl md:text-4xl font-bold text-white">
                    Social Media
                  </h1>
                  <Badge className="bg-white/20 text-white border-white/30 backdrop-blur-sm px-3 py-1">
                    <Sparkles className="h-3 w-3 mr-1" />
                    Beta
                  </Badge>
                </div>
                <p className="text-white/80 text-base md:text-lg">
                  Cross-post to Instagram & Facebook automatically
                </p>
              </div>
            </div>

            <Button
              variant="secondary"
              onClick={fetchConnections}
              className="bg-white/20 hover:bg-white/30 text-white border-0 backdrop-blur-sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Total Locations */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-slate-50 to-slate-100 hover:shadow-xl transition-shadow duration-300">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-slate-500">Total Locations</p>
                <p className="text-4xl font-bold text-slate-800 mt-1">{totalLocations}</p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-slate-200 flex items-center justify-center">
                <MapPin className="h-7 w-7 text-slate-600" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Instagram Connected */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-pink-50 to-purple-50 hover:shadow-xl transition-shadow duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-pink-600">Instagram Connected</p>
                <p className="text-4xl font-bold text-pink-700 mt-1">
                  {connectedInstagram}
                  <span className="text-lg font-normal text-pink-400">/{totalLocations}</span>
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Instagram className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Facebook Connected */}
        <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-xl transition-shadow duration-300 group">
          <CardContent className="p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Facebook Connected</p>
                <p className="text-4xl font-bold text-blue-700 mt-1">
                  {connectedFacebook}
                  <span className="text-lg font-normal text-blue-400">/{totalLocations}</span>
                </p>
              </div>
              <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center shadow-lg group-hover:scale-110 transition-transform duration-300">
                <Facebook className="h-7 w-7 text-white" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* How it Works */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-amber-50 via-orange-50 to-yellow-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 flex items-center justify-center flex-shrink-0">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-amber-900 text-lg">How Cross-Posting Works</h3>
              <p className="text-amber-700 mt-1">
                When you create a post on Google Business Profile, it automatically gets posted to your connected Instagram (as a photo post with caption) and Facebook Page (as a photo post). Each location can have its own Instagram and Facebook accounts.
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Locations List */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold text-slate-800">Your Locations</h2>
          <Badge variant="outline" className="text-slate-500">
            {allLocations.length} location{allLocations.length !== 1 ? 's' : ''}
          </Badge>
        </div>

        {allLocations.map((location, index) => (
          <Card
            key={location.locationId}
            className="border-0 shadow-lg hover:shadow-xl transition-all duration-300 overflow-hidden group"
            style={{
              animationDelay: `${index * 100}ms`,
              animation: 'fadeInUp 0.5s ease-out forwards'
            }}
          >
            <CardContent className="p-0">
              {/* Location Header */}
              <div
                className="p-5 cursor-pointer hover:bg-slate-50 transition-colors"
                onClick={() => setExpandedLocation(
                  expandedLocation === location.locationId ? null : location.locationId
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center">
                      <MapPin className="h-6 w-6 text-slate-600" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-lg text-slate-800">{location.displayName}</h3>
                      <p className="text-sm text-slate-500">{location.address}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-4">
                    {/* Connection Status Badges */}
                    <div className="flex items-center gap-2">
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                        location.connection?.instagram_user_id
                          ? 'bg-gradient-to-r from-pink-100 to-purple-100 text-pink-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Instagram className="h-3.5 w-3.5" />
                        {location.connection?.instagram_user_id ? 'Connected' : 'Not Connected'}
                      </div>
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${
                        location.connection?.facebook_page_id
                          ? 'bg-gradient-to-r from-blue-100 to-indigo-100 text-blue-700'
                          : 'bg-slate-100 text-slate-400'
                      }`}>
                        <Facebook className="h-3.5 w-3.5" />
                        {location.connection?.facebook_page_id ? 'Connected' : 'Not Connected'}
                      </div>
                    </div>

                    <ChevronRight className={`h-5 w-5 text-slate-400 transition-transform duration-300 ${
                      expandedLocation === location.locationId ? 'rotate-90' : ''
                    }`} />
                  </div>
                </div>
              </div>

              {/* Expanded Content */}
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${
                expandedLocation === location.locationId ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'
              }`}>
                <div className="px-5 pb-5 pt-2 border-t border-slate-100">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Instagram Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-pink-50 to-purple-50 border border-pink-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                            <Instagram className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-pink-900">Instagram</h4>
                            {location.connection?.instagram_username && (
                              <p className="text-sm text-pink-600">@{location.connection.instagram_username}</p>
                            )}
                          </div>
                        </div>
                        {location.connection?.instagram_user_id && (
                          <Switch
                            checked={location.connection.instagram_enabled}
                            onCheckedChange={(checked) => handleToggleAutoPost(location.locationId, 'instagram', checked)}
                          />
                        )}
                      </div>

                      {location.connection?.instagram_user_id ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-pink-700">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Account connected</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(location.locationId, 'instagram')}
                            className="w-full border-pink-200 text-pink-700 hover:bg-pink-100"
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleConnect(location.locationId, location.displayName, 'instagram')}
                          disabled={connectingLocation === `${location.locationId}-instagram`}
                          className="w-full bg-gradient-to-r from-pink-500 to-purple-600 hover:from-pink-600 hover:to-purple-700 text-white"
                        >
                          {connectingLocation === `${location.locationId}-instagram` ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4 mr-2" />
                          )}
                          Connect Instagram
                        </Button>
                      )}
                    </div>

                    {/* Facebook Card */}
                    <div className="p-4 rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-100">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center">
                            <Facebook className="h-5 w-5 text-white" />
                          </div>
                          <div>
                            <h4 className="font-semibold text-blue-900">Facebook</h4>
                            {location.connection?.facebook_page_name && (
                              <p className="text-sm text-blue-600">{location.connection.facebook_page_name}</p>
                            )}
                          </div>
                        </div>
                        {location.connection?.facebook_page_id && (
                          <Switch
                            checked={location.connection.facebook_enabled}
                            onCheckedChange={(checked) => handleToggleAutoPost(location.locationId, 'facebook', checked)}
                          />
                        )}
                      </div>

                      {location.connection?.facebook_page_id ? (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-blue-700">
                            <CheckCircle2 className="h-4 w-4 text-green-500" />
                            <span>Page connected</span>
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDisconnect(location.locationId, 'facebook')}
                            className="w-full border-blue-200 text-blue-700 hover:bg-blue-100"
                          >
                            <Unlink className="h-4 w-4 mr-2" />
                            Disconnect
                          </Button>
                        </div>
                      ) : (
                        <Button
                          onClick={() => handleConnect(location.locationId, location.displayName, 'facebook')}
                          disabled={connectingLocation === `${location.locationId}-facebook`}
                          className="w-full bg-gradient-to-r from-blue-500 to-indigo-600 hover:from-blue-600 hover:to-indigo-700 text-white"
                        >
                          {connectingLocation === `${location.locationId}-facebook` ? (
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          ) : (
                            <Link2 className="h-4 w-4 mr-2" />
                          )}
                          Connect Facebook
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* Auto-post Info */}
                  {(location.connection?.instagram_user_id || location.connection?.facebook_page_id) && (
                    <div className="mt-4 p-3 rounded-lg bg-slate-50 flex items-start gap-3">
                      <Clock className="h-5 w-5 text-slate-400 flex-shrink-0 mt-0.5" />
                      <p className="text-sm text-slate-600">
                        When auto-posting is enabled, your GBP posts will automatically be shared to connected accounts.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Setup Notice */}
      <Card className="border-0 shadow-lg bg-gradient-to-r from-violet-50 to-purple-50">
        <CardContent className="p-6">
          <div className="flex items-start gap-4">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center flex-shrink-0">
              <AlertCircle className="h-5 w-5 text-white" />
            </div>
            <div>
              <h3 className="font-semibold text-violet-900 text-lg">Setup Required</h3>
              <p className="text-violet-700 mt-1">
                To enable Instagram and Facebook connections, you need to provide your Facebook App credentials.
                This is a one-time setup that allows secure OAuth authentication.
              </p>
              <div className="flex items-center gap-2 mt-3">
                <Shield className="h-4 w-4 text-violet-500" />
                <span className="text-sm text-violet-600">Your credentials are securely stored and never shared</span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* CSS Animation Keyframes */}
      <style>{`
        @keyframes fadeInUp {
          from {
            opacity: 0;
            transform: translateY(20px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
      `}</style>
    </div>
  );
};

export default SocialMedia;
