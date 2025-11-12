import { useState, useEffect } from "react";
import { useParams, Link, useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ArrowLeft, MapPin, Star, Globe, Phone, Mail, ExternalLink } from "lucide-react";
import { AutoPostingTab } from "@/components/ProfileDetails/AutoPostingTab";
import PostsTab from "@/components/ProfileDetails/PostsTab";
import ReviewsTab from "@/components/ProfileDetails/ReviewsTab";
import PhotosTab from "@/components/ProfileDetails/PhotosTab";
import EditProfileTab from "@/components/ProfileDetails/EditProfileTab";
import { useGoogleBusinessProfile } from "@/hooks/useGoogleBusinessProfile";
import { useProfileLimitations } from "@/hooks/useProfileLimitations";
import { BusinessLocation } from "@/lib/googleBusinessProfile";
import { automationStorage, type AutoPostingStats } from "@/lib/automationStorage";
import { BarChart3 } from "lucide-react";

interface BusinessProfile {
  id: string;
  name: string;
  address: string;
  phone?: string;
  website?: string;
  email?: string;
  rating: number;
  reviewCount: number;
  categories: string[];
  description?: string;
  hours?: Record<string, string>;
}

const ProfileDetails = () => {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [location, setLocation] = useState<BusinessLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<AutoPostingStats | null>(null);
  const [isAccessDenied, setIsAccessDenied] = useState(false);
  const { accounts, isLoading: googleLoading } = useGoogleBusinessProfile();
  const { getAccessibleAccounts } = useProfileLimitations();

  // Helper function to get categories as array
  const getCategories = (location: BusinessLocation) => {
    // Check if categoriesFormatted exists (processed format)
    if ((location as any).categoriesFormatted && Array.isArray((location as any).categoriesFormatted)) {
      return (location as any).categoriesFormatted;
    }
    // Fallback to empty array
    return [];
  };

  useEffect(() => {
    const findLocation = () => {
      console.log('ProfileDetails: Looking for profileId:', profileId);
      console.log('ProfileDetails: Available accounts:', accounts);
      
      if (!profileId || !accounts.length) {
        setLoading(false);
        return;
      }

      // Only search in accessible accounts
      const accessibleAccounts = getAccessibleAccounts(accounts);
      let foundLocation: BusinessLocation | null = null;
      let foundInInaccessibleAccount = false;

      // First, check accessible accounts
      for (const account of accessibleAccounts) {
        const loc = account.locations.find(l => l.locationId === profileId);
        if (loc) {
          foundLocation = loc;
          break;
        }
      }

      // If not found in accessible accounts, check if it exists in inaccessible accounts
      if (!foundLocation) {
        for (const account of accounts) {
          if (!accessibleAccounts.includes(account)) {
            const loc = account.locations.find(l => l.locationId === profileId);
            if (loc) {
              foundInInaccessibleAccount = true;
              break;
            }
          }
        }
      }

      console.log('ProfileDetails: Found location:', foundLocation);
      console.log('ProfileDetails: Found in inaccessible account:', foundInInaccessibleAccount);

      setLocation(foundLocation);
      setIsAccessDenied(foundInInaccessibleAccount);
      setLoading(false);
    };

    const loadGlobalStats = () => {
      const stats = automationStorage.getGlobalStats();
      setGlobalStats(stats);
    };

    if (!googleLoading) {
      findLocation();
      loadGlobalStats();
    }
  }, [profileId, accounts, googleLoading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <div className="h-10 w-10 bg-muted rounded animate-pulse"></div>
          <div className="h-8 bg-muted rounded w-64 animate-pulse"></div>
        </div>
        <div className="h-48 bg-muted rounded animate-pulse"></div>
      </div>
    );
  }

  // Access denied for this profile
  if (isAccessDenied) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link to="/dashboard">
            <Button variant="outline" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>

        <Card className="border-orange-200 bg-orange-50">
          <CardContent className="p-6">
            <div className="flex items-start gap-4">
              <div className="h-12 w-12 bg-orange-100 rounded-lg flex items-center justify-center">
                <MapPin className="h-6 w-6 text-orange-600" />
              </div>
              <div className="flex-1">
                <h2 className="text-xl font-semibold text-orange-900 mb-2">
                  Profile Access Restricted
                </h2>
                <p className="text-orange-800 mb-4">
                  This business profile requires an Enterprise plan to access. Your current plan allows access to 1 profile only.
                </p>
                <div className="flex gap-3">
                  <Button
                    onClick={() => navigate('/dashboard/billing')}
                    className="bg-orange-600 hover:bg-orange-700"
                  >
                    <Mail className="h-4 w-4 mr-2" />
                    Upgrade to Access All Profiles
                  </Button>
                  <Link to="/dashboard">
                    <Button variant="outline">
                      View Available Profiles
                    </Button>
                  </Link>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!location) {
    return (
      <div className="flex items-center justify-center min-h-96">
        <div className="text-center">
          <h2 className="text-2xl font-semibold mb-2">Location Not Found</h2>
          <p className="text-muted-foreground mb-4">The requested business location could not be found.</p>
          <Link to="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 sm:space-y-4 md:space-y-6 animate-fade-in min-w-0 w-full overflow-x-hidden">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm" className="h-8 w-8 sm:h-10 sm:w-10 p-0 sm:p-2">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight truncate">{location.displayName}</h1>
      </div>

      {/* Profile Overview & Today's Statistics */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 md:gap-6">
        {/* Profile Overview */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-sm sm:text-base md:text-lg">Profile Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 sm:space-y-3 md:space-y-4">
            <div className="flex items-start gap-1.5 sm:gap-2">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
              <span className="text-[11px] sm:text-xs md:text-sm break-words leading-snug flex-1">
                {location.address.addressLines.length > 0 
                  ? `${location.address.addressLines.join(', ')}, ${location.address.locality}`
                  : location.address.locality || 'No address available'
                }
              </span>
            </div>
            
            {location.websiteUrl && (
              <div className="flex items-start gap-1.5 sm:gap-2">
                <Globe className="h-3 w-3 sm:h-4 sm:w-4 mt-0.5 text-muted-foreground flex-shrink-0" />
                <a 
                  href={location.websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-[11px] sm:text-xs md:text-sm text-primary hover:text-primary-hover flex items-center gap-1 break-all flex-1 min-w-0"
                >
                  <span className="truncate">{location.websiteUrl}</span>
                  <ExternalLink className="h-2.5 w-2.5 sm:h-3 sm:w-3 flex-shrink-0" />
                </a>
              </div>
            )}
            
            <div className="flex flex-wrap gap-1 max-w-full">
              {getCategories(location).map((category: any) => (
                <Badge key={category.name} variant="secondary" className="text-[10px] sm:text-xs px-1.5 sm:px-2 py-0.5 whitespace-nowrap leading-tight">
                  {category.name}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Today's Statistics */}
        {globalStats && (
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle className="flex items-center gap-1.5 sm:gap-2 text-sm sm:text-base md:text-lg">
                <BarChart3 className="h-3.5 w-3.5 sm:h-4 sm:w-4 md:h-5 md:w-5" />
                <span className="text-xs sm:text-sm md:text-base">Today's Statistics</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 sm:gap-3 md:gap-4">
                {/* Successful Posts Box */}
                <Card className="border border-green-200 bg-green-50">
                  <CardContent className="p-2 sm:p-3 md:p-4 text-center">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-green-600">{globalStats.successfulPostsToday}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight">Successful</div>
                  </CardContent>
                </Card>
                
                {/* Failed Posts Box */}
                <Card className="border border-red-200 bg-red-50">
                  <CardContent className="p-2 sm:p-3 md:p-4 text-center">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-red-600">{globalStats.failedPostsToday}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight">Failed</div>
                  </CardContent>
                </Card>
                
                {/* Active Locations Box */}
                <Card className="border border-blue-200 bg-blue-50">
                  <CardContent className="p-2 sm:p-3 md:p-4 text-center">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-blue-600">{globalStats.activeConfigurations}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight">Active</div>
                  </CardContent>
                </Card>
                
                {/* Total Posts Box */}
                <Card className="border border-gray-200 bg-gray-50">
                  <CardContent className="p-2 sm:p-3 md:p-4 text-center">
                    <div className="text-lg sm:text-xl md:text-2xl font-bold text-gray-700">{globalStats.totalPostsToday}</div>
                    <div className="text-[10px] sm:text-xs md:text-sm text-muted-foreground leading-tight">Total</div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="auto-posting" className="space-y-3 sm:space-y-4 md:space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto gap-0.5 sm:gap-1 p-0.5 sm:p-1">
          <TabsTrigger value="auto-posting" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 md:px-3 py-1.5 sm:py-2 data-[state=active]:text-[10px] sm:data-[state=active]:text-xs md:data-[state=active]:text-sm">Auto Posting</TabsTrigger>
          <TabsTrigger value="posts" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 md:px-3 py-1.5 sm:py-2">Posts</TabsTrigger>
          <TabsTrigger value="reviews" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 md:px-3 py-1.5 sm:py-2">Reviews</TabsTrigger>
          <TabsTrigger value="photos" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 md:px-3 py-1.5 sm:py-2">Photos</TabsTrigger>
          <TabsTrigger value="edit" className="text-[10px] sm:text-xs md:text-sm px-1 sm:px-2 md:px-3 py-1.5 sm:py-2">Edit Profile</TabsTrigger>
        </TabsList>
        
        <TabsContent value="auto-posting">
          <AutoPostingTab location={{
            id: location.locationId,
            name: location.displayName,
            categories: getCategories(location).map((c: any) => c.name),
            websiteUri: location.websiteUrl,
            phoneNumber: location.phoneNumber,
            address: location.address
          }} />
        </TabsContent>
        
        <TabsContent value="posts">
          <PostsTab profileId={location.locationId} />
        </TabsContent>
        
        <TabsContent value="reviews">
          <ReviewsTab profileId={location.locationId} />
        </TabsContent>
        
        <TabsContent value="photos">
          <PhotosTab profileId={location.locationId} />
        </TabsContent>
        
        <TabsContent value="edit">
          <EditProfileTab profileId={location.locationId} />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default ProfileDetails;