import { useState, useEffect } from "react";
import { useParams, Link } from "react-router-dom";
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
  const [location, setLocation] = useState<BusinessLocation | null>(null);
  const [loading, setLoading] = useState(true);
  const [globalStats, setGlobalStats] = useState<AutoPostingStats | null>(null);
  const { accounts, isLoading: googleLoading } = useGoogleBusinessProfile();

  useEffect(() => {
    const findLocation = () => {
      console.log('ProfileDetails: Looking for profileId:', profileId);
      console.log('ProfileDetails: Available accounts:', accounts);
      
      if (!profileId || !accounts.length) {
        setLoading(false);
        return;
      }

      // Find the location across all accounts
      let foundLocation: BusinessLocation | null = null;
      
      for (const account of accounts) {
        const loc = account.locations.find(l => l.locationId === profileId);
        if (loc) {
          foundLocation = loc;
          break;
        }
      }

      console.log('ProfileDetails: Found location:', foundLocation);
      setLocation(foundLocation);
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
    <div className="space-y-6 animate-fade-in">
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Profile Overview */}
        <Card className="shadow-sm">
          <CardHeader>
            <CardTitle className="text-xl">Profile Overview</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-start gap-2">
              <MapPin className="h-4 w-4 mt-1 text-muted-foreground" />
              <span className="text-sm">
                {location.address.addressLines.length > 0 
                  ? `${location.address.addressLines.join(', ')}, ${location.address.locality}`
                  : location.address.locality || 'No address available'
                }
              </span>
            </div>
            
            {location.websiteUrl && (
              <div className="flex items-center gap-2">
                <Globe className="h-4 w-4 text-muted-foreground" />
                <a 
                  href={location.websiteUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-sm text-primary hover:text-primary-hover flex items-center gap-1"
                >
                  {location.websiteUrl}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            )}
            
            <div className="flex flex-wrap gap-1">
              {location.categories.map((category) => (
                <Badge key={category.name} variant="secondary">
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
              <CardTitle className="flex items-center gap-2">
                <BarChart3 className="h-5 w-5" />
                Today's Statistics
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-4">
                {/* Successful Posts Box */}
                <Card className="border border-green-200 bg-green-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-green-600">{globalStats.successfulPostsToday}</div>
                    <div className="text-sm text-muted-foreground">Successful Posts</div>
                  </CardContent>
                </Card>
                
                {/* Failed Posts Box */}
                <Card className="border border-red-200 bg-red-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-red-600">{globalStats.failedPostsToday}</div>
                    <div className="text-sm text-muted-foreground">Failed Posts</div>
                  </CardContent>
                </Card>
                
                {/* Active Locations Box */}
                <Card className="border border-blue-200 bg-blue-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-blue-600">{globalStats.activeConfigurations}</div>
                    <div className="text-sm text-muted-foreground">Active Locations</div>
                  </CardContent>
                </Card>
                
                {/* Total Posts Box */}
                <Card className="border border-gray-200 bg-gray-50">
                  <CardContent className="p-4 text-center">
                    <div className="text-2xl font-bold text-gray-700">{globalStats.totalPostsToday}</div>
                    <div className="text-sm text-muted-foreground">Total Posts</div>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Tabs */}
      <Tabs defaultValue="auto-posting" className="space-y-6">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 h-auto">
          <TabsTrigger value="auto-posting" className="text-xs sm:text-sm px-2 sm:px-3">Auto Posting</TabsTrigger>
          <TabsTrigger value="posts" className="text-xs sm:text-sm px-2 sm:px-3">Posts</TabsTrigger>
          <TabsTrigger value="reviews" className="text-xs sm:text-sm px-2 sm:px-3">Reviews</TabsTrigger>
          <TabsTrigger value="photos" className="text-xs sm:text-sm px-2 sm:px-3">Photos</TabsTrigger>
          <TabsTrigger value="edit" className="text-xs sm:text-sm px-2 sm:px-3">Edit Profile</TabsTrigger>
        </TabsList>
        
        <TabsContent value="auto-posting">
          <AutoPostingTab location={{
            id: location.locationId,
            name: location.displayName,
            categories: location.categories.map(c => c.name),
            websiteUri: location.websiteUrl,
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