import React, { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Building2, MapPin, Star, Calendar, ArrowRight, Settings, AlertCircle, CreditCard, Users, Zap, Clock, Instagram, Facebook } from "lucide-react";
import { Link, useNavigate } from "react-router-dom";
import { useGoogleBusinessProfile } from "@/hooks/useGoogleBusinessProfile";
import { useProfileLimitations } from "@/hooks/useProfileLimitations";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { TrialBanner } from "@/components/TrialBanner";
import { PaymentModal } from "@/components/PaymentModal";
import { useSubscription } from "@/contexts/SubscriptionContext";
import { ProfileAutomationStatus } from "@/components/ProfileAutomationStatus";
import { GlobalPostingTimeModal } from "@/components/GlobalPostingTimeModal";

interface SocialConnection {
  location_id: string;
  instagram_user_id: string | null;
  instagram_username: string | null;
  facebook_page_id: string | null;
  facebook_page_name: string | null;
}

const Dashboard = () => {
  const navigate = useNavigate();
  const { currentUser } = useAuth();
  const { isConnected, accounts: profiles, isLoading } = useGoogleBusinessProfile();
  const subscription = useSubscription();
  const { getAccessibleAccounts } = useProfileLimitations();
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [isGlobalTimeModalOpen, setIsGlobalTimeModalOpen] = useState(false);
  const [socialConnections, setSocialConnections] = useState<SocialConnection[]>([]);

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';

  // Fetch social connections
  useEffect(() => {
    const fetchSocialConnections = async () => {
      if (!currentUser?.email) return;
      try {
        const response = await fetch(
          `${backendUrl}/api/social/connections?gmailId=${encodeURIComponent(currentUser.email)}`
        );
        const data = await response.json();
        if (data.success) {
          setSocialConnections(data.connections || []);
        }
      } catch (error) {
        console.error('Error fetching social connections:', error);
      }
    };
    fetchSocialConnections();
  }, [currentUser?.email, backendUrl]);

  // Helper to get social connection for a location
  const getSocialConnection = (locationId: string) => {
    return socialConnections.find(c => c.location_id === locationId);
  };
  
  // Safely destructure subscription context
  const subscriptionStatus = subscription?.status || 'none';
  const daysRemaining = subscription?.daysRemaining || null;
  const isFeatureBlocked = subscription?.isFeatureBlocked || false;

  console.log('Dashboard: isConnected =', isConnected);
  console.log('Dashboard: profiles =', profiles);
  console.log('Dashboard: isLoading =', isLoading);
  console.log('Dashboard: subscriptionStatus =', subscriptionStatus);
  console.log('Dashboard: daysRemaining =', daysRemaining);

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center px-4">
          <img 
            src="/Upgrade plan banner - Copy.svg" 
            alt="Upgrade Plan Banner" 
            className="w-full max-w-4xl h-auto"
          />
        </div>
        
        <div className="flex flex-col items-center justify-center py-16 space-y-4">
          <LoadingSpinner size="xl" variant="primary" />
          <div className="text-center space-y-2">
            <h3 className="font-medium text-xl">Loading Business Profiles...</h3>
            <p className="text-sm text-muted-foreground">Connecting to Google Business Profile and fetching your locations</p>
          </div>
        </div>
        
        <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Card key={i}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <div className="h-4 bg-muted rounded animate-pulse w-20"></div>
                <div className="h-4 w-4 bg-muted rounded animate-pulse"></div>
              </CardHeader>
              <CardContent>
                <div className="h-8 bg-muted rounded animate-pulse w-16 mb-2"></div>
                <div className="h-3 bg-muted rounded animate-pulse w-24"></div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (!isConnected) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-center px-4">
          <img 
            src="/Upgrade plan banner - Copy.svg" 
            alt="Upgrade Plan Banner" 
            className="w-full max-w-4xl h-auto"
          />
        </div>
        
        <div className="flex flex-col items-center justify-center min-h-[400px] text-center">
          <Building2 className="h-16 w-16 text-muted-foreground mb-4" />
          <h3 className="text-xl font-semibold mb-2">No Business Profiles Connected</h3>
          <p className="text-muted-foreground mb-6 max-w-md">
            Connect your Google Business Profile to start managing your business listings, posts, and reviews.
          </p>
          <Link to="/dashboard/settings">
            <Button>
              <Settings className="mr-2 h-4 w-4" />
              Connect Google Business Profile
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  // Show stats when connected
  const totalProfiles = profiles?.length || 0;
  // Since each profile now represents one location, totalLocations = totalProfiles
  const totalLocations = totalProfiles;

  // Get last sync time (current time since profiles are real-time)
  const lastSyncTime = new Date().toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    hour12: true
  });

  return (
    <>
      {/* Trial Banner */}
      {(subscriptionStatus === 'trial' || subscriptionStatus === 'expired') && (
        <div className="-mx-6 mb-6">
          <TrialBanner />
        </div>
      )}

      <div className="space-y-6">

      {/* Header with Manage Profiles text and Create Post button */}
      <div className="flex justify-between items-center gap-2">
        <div className="flex justify-start">
          <h2 className="text-base sm:text-lg font-semibold truncate" style={{ fontFamily: 'Onest' }}>
            Manage Profiles
          </h2>
        </div>
        <div className="flex justify-end flex-shrink-0">
          <Link to="/dashboard/posts">
            <Button size="sm" className="text-xs sm:text-sm px-2 sm:px-4">
              <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Create Post</span>
              <span className="sm:hidden">Post</span>
            </Button>
          </Link>
        </div>
      </div>

      {/* Feature Blocked Alert */}
      {isFeatureBlocked && (
        <Card className="border-red-200 bg-red-50 mb-4">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <div>
                  <p className="font-medium text-red-900">Trial Expired - Upgrade Required</p>
                  <p className="text-sm text-red-700 mt-1">
                    Your trial has expired. Upgrade now to continue managing your Google Business Profiles.
                  </p>
                </div>
              </div>
              <Button 
                onClick={() => setIsPaymentModalOpen(true)}
                className="bg-red-600 hover:bg-red-700"
              >
                <CreditCard className="mr-2 h-4 w-4" />
                Upgrade Now
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Stats Cards */}
      <div className="grid gap-3 sm:gap-4 grid-cols-2 lg:grid-cols-4">
        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Profiles</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalProfiles}</div>
            <p className="text-xs text-muted-foreground">Connected business accounts</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Locations</CardTitle>
            <MapPin className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalLocations}</div>
            <p className="text-xs text-muted-foreground">Business locations</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Avg Rating</CardTitle>
            <Star className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">N/A</div>
            <p className="text-xs text-muted-foreground">Coming soon</p>
          </CardContent>
        </Card>

        <Card className="border-blue-200">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Last Sync</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{lastSyncTime}</div>
            <p className="text-xs text-muted-foreground">Real-time updates</p>
          </CardContent>
        </Card>
      </div>

      {/* Global Posting Time Card */}
      <Card className="border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="h-10 w-10 bg-blue-100 rounded-lg flex items-center justify-center">
                <Clock className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-medium text-blue-900">Set Global Posting Time</h4>
                <p className="text-sm text-blue-700">
                  Apply the same posting time to all your enabled profiles
                </p>
              </div>
            </div>
            <Button 
              onClick={() => setIsGlobalTimeModalOpen(true)}
              className="bg-blue-600 hover:bg-blue-700"
            >
              <Clock className="mr-2 h-4 w-4" />
              Set Time for All
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Business Profiles */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-lg sm:text-xl font-semibold truncate">Your Business Profiles</h2>
          <Link to="/dashboard/settings" className="flex-shrink-0">
            <Button variant="outline" size="sm" className="text-xs sm:text-sm px-2 sm:px-3">
              <Settings className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="hidden sm:inline">Manage Connections</span>
              <span className="sm:hidden">Manage</span>
            </Button>
          </Link>
        </div>

        {profiles && profiles.length > 0 ? (
          <div className="space-y-4">
            <div className="grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {getAccessibleAccounts(profiles).map((profile: any, index: number) => {
                // Get the first location since each profile now has exactly one location
                const location = profile.locations[0];
                const locationId = location.locationId || location.name?.split('/').pop() || index;
                
                return (
                  <div key={index} className="bg-white rounded-lg shadow-sm border border-blue-200 p-3 sm:p-4 cursor-pointer hover:shadow-md transition-shadow flex flex-col h-full">
                    {/* Content area that grows */}
                    <div className="flex-1">
                      {/* Header with name and verification badge */}
                      <div className="flex items-center justify-between mb-3">
                        <h3 
                          className="text-sm sm:text-base font-semibold text-black truncate flex-1 mr-2" 
                          style={{ fontSize: 'clamp(14px, 2.5vw, 16px)', fontFamily: 'Onest' }}
                          title={profile.accountName}
                        >
                          {profile.accountName}
                        </h3>
                        {profile.state === 'VERIFIED' && (
                          <div className="w-4 h-4 flex items-center justify-center flex-shrink-0">
                            <img
                              src="/Vector.svg"
                              alt="Verified"
                              className="w-4 h-4"
                            />
                          </div>
                        )}
                      </div>
                      
                      {/* Location */}
                      <div className="flex items-center mb-3">
                        <MapPin className="h-4 w-4 text-black mr-2" />
                        <span className="text-xs sm:text-sm text-black truncate" style={{ fontSize: 'clamp(12px, 2vw, 14px)', fontFamily: 'Onest' }}>
                          {location.address?.locality || 'Location'} {location.address?.administrativeArea && `, ${location.address.administrativeArea}`}
                        </span>
                      </div>
                      
                      {/* Categories */}
                      {location.categories && location.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mb-3">
                          {location.categories.slice(0, 2).map((category: any, catIndex: number) => (
                            <span 
                              key={catIndex} 
                              className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-100"
                              style={{ fontFamily: 'Onest' }}
                            >
                              {category.name}
                            </span>
                          ))}
                          {location.categories.length > 2 && (
                            <span 
                              className="px-2 py-1 bg-blue-50 text-blue-700 rounded-full text-xs border border-blue-100"
                              style={{ fontFamily: 'Onest' }}
                            >
                              +{location.categories.length - 2} more
                            </span>
                          )}
                        </div>
                      )}
                      
                      {/* Auto-posting countdown for each profile */}
                      <div className="mb-3 border-t pt-3">
                        <ProfileAutomationStatus
                          locationId={locationId}
                          businessName={profile.accountName}
                          compact={true}
                        />

                        {/* Social Connection Status */}
                        {(getSocialConnection(locationId)?.instagram_user_id || getSocialConnection(locationId)?.facebook_page_id) && (
                          <div className="flex items-center gap-3 mt-2 pt-2 border-t border-dashed">
                            {getSocialConnection(locationId)?.instagram_user_id && (
                              <div className="flex items-center gap-1.5" title={`Instagram: ${getSocialConnection(locationId)?.instagram_username || 'Connected'}`}>
                                <div className="w-5 h-5 rounded-full bg-gradient-to-br from-pink-500 to-purple-600 flex items-center justify-center">
                                  <Instagram className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-xs text-pink-600 font-medium">Connected</span>
                              </div>
                            )}
                            {getSocialConnection(locationId)?.facebook_page_id && (
                              <div className="flex items-center gap-1.5" title={`Facebook: ${getSocialConnection(locationId)?.facebook_page_name || 'Connected'}`}>
                                <div className="w-5 h-5 rounded-full bg-blue-600 flex items-center justify-center">
                                  <Facebook className="w-3 h-3 text-white" />
                                </div>
                                <span className="text-xs text-blue-600 font-medium">Connected</span>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                    
                    {/* Manage Profile Button - Fixed at bottom */}
                    <div className="mt-4">
                      <Link to={`/dashboard/profiles/${locationId}`} className="block">
                        <button 
                          className="w-full py-2 px-3 sm:px-4 rounded-lg text-white font-medium transition-colors"
                          style={{ 
                            backgroundColor: '#1E2DCD',
                            fontSize: 'clamp(12px, 2vw, 14px)',
                            fontFamily: 'Onest'
                          }}
                        >
                          Manage Profile
                        </button>
                      </Link>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Enterprise upgrade prompt for locked profiles */}
            {profiles && profiles.length > 1 && getAccessibleAccounts(profiles).length < profiles.length && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="h-10 w-10 bg-orange-100 rounded-lg flex items-center justify-center">
                      <Building2 className="h-5 w-5 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <h4 className="font-medium text-orange-900 mb-1">
                        Additional Profiles Available
                      </h4>
                      <p className="text-sm text-orange-800 mb-3">
                        You have {profiles.length} Google Business accounts, but can only access {getAccessibleAccounts(profiles).length} with your current plan.
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => navigate('/dashboard/billing')}
                        className="border-orange-300 text-orange-700 hover:bg-orange-100"
                      >
                        <CreditCard className="h-4 w-4 mr-2" />
                        Upgrade to Access All Profiles
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Info note for demo data */}
            {profiles[0]?.name?.includes('demo') && (
              <Card className="border-blue-200 bg-blue-50">
                <CardContent className="p-4">
                  <div className="flex items-center space-x-2 text-blue-800">
                    <AlertCircle className="h-4 w-4" />
                    <p className="text-sm">
                      <strong>Demo Mode:</strong> Showing sample data because Google API calls are CORS-blocked in frontend-only mode. 
                      A backend would be needed for real Google Business Profile data.
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center py-12">
              <Building2 className="h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No profiles loaded</h3>
              <p className="text-muted-foreground text-center mb-4">
                Your Google Business Profiles will appear here once loaded.
              </p>
              <Link to="/dashboard/settings">
                <Button>
                  <Settings className="mr-2 h-4 w-4" />
                  Check Connection
                </Button>
              </Link>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
      
      {/* Payment Modal */}
      <PaymentModal 
        isOpen={isPaymentModalOpen}
        onClose={() => setIsPaymentModalOpen(false)}
      />
      
      {/* Global Posting Time Modal */}
      <GlobalPostingTimeModal
        isOpen={isGlobalTimeModalOpen}
        onClose={() => setIsGlobalTimeModalOpen(false)}
        profiles={profiles || []}
      />
    </>
  );
};

export default Dashboard;