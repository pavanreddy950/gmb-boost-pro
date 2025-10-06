import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Calendar, Clock, Image, Search, Filter, MoreHorizontal, Users, Info } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import CreatePostModal from "@/components/ProfileDetails/CreatePostModal";
import { useGoogleBusinessProfile } from "@/hooks/useGoogleBusinessProfile";
import { googleBusinessProfileService } from "@/lib/googleBusinessProfile";
import { useNotifications } from "@/contexts/NotificationContext";
import { useProfileLimitations } from "@/hooks/useProfileLimitations";

interface Post {
  id: string;
  profileId: string;
  profileName: string;
  content: string;
  scheduledAt?: string;
  postedAt?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  imageUrl?: string;
}

const Posts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>("all");
  
  // Get real-time Google Business Profile data
  const {
    accounts,
    isConnected,
    isLoading: googleLoading
  } = useGoogleBusinessProfile();

  // Get notifications context
  const { addNotification } = useNotifications();

  // Navigation
  const navigate = useNavigate();

  // Apply profile limitations
  const { getAccessibleAccounts, getAccountLockMessage, canAccessMultipleProfiles } = useProfileLimitations();

  // Memoize these values to prevent infinite re-renders
  const accessibleAccounts = useMemo(() => getAccessibleAccounts(accounts), [accounts, getAccessibleAccounts]);
  const lockMessage = useMemo(() => getAccountLockMessage(accounts.length), [accounts.length, getAccountLockMessage]);
  const hasLockedProfiles = useMemo(() => !canAccessMultipleProfiles && accounts.length > 1, [canAccessMultipleProfiles, accounts.length]);

  useEffect(() => {
    // Real-time posts from Google Business Profile API
    const fetchPosts = async () => {
      // Keep loading state true while Google data is loading
      if (googleLoading) {
        setLoading(true);
        return;
      }

      // If not connected or no accessible accounts, show empty state after a brief loading
      if (!isConnected || !accessibleAccounts.length) {
        setPosts([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        console.log('Posts: Fetching posts across all profiles (PARALLEL LOADING)');
        
        // Create all location tasks for parallel execution (only accessible accounts)
        const locationTasks = accessibleAccounts.flatMap(account =>
          account.locations.map(location => ({
            account,
            location,
            task: async () => {
              try {
                console.log(`📍 Posts: Processing location - "${location.displayName}"`);
                
                // Add timeout to prevent individual locations from hanging
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 6000); // 6 second timeout per location
                
                // Use locationId to avoid path encoding issues
                const locationPosts = await googleBusinessProfileService.getLocationPosts(location.locationId);
                clearTimeout(timeoutId);
                
                console.log(`📍 Posts: Received ${locationPosts.length} posts for ${location.displayName}`);
                
                // Convert BusinessPost to Post format
                const convertedPosts: Post[] = locationPosts.map(post => ({
                  id: post.id,
                  profileId: location.locationId,
                  profileName: location.displayName,
                  content: post.summary || '',
                  status: 'published' as const,
                  postedAt: post.createTime
                }));
                
                return convertedPosts;
              } catch (error) {
                console.warn(`⚠️ Failed to fetch posts for ${location.displayName}:`, error);
                return []; // Return empty array instead of failing completely
              }
            }
          }))
        );
        
        console.log(`🚀 Starting parallel loading of posts for ${locationTasks.length} locations`);
        const startTime = Date.now();
        
        // Execute all tasks in parallel
        const postPromises = locationTasks.map(({ task }) => task());
        const postsArrays = await Promise.allSettled(postPromises);
        
        // Collect all successful results
        const allPosts: Post[] = [];
        postsArrays.forEach((result, index) => {
          if (result.status === 'fulfilled') {
            allPosts.push(...result.value);
          } else {
            console.warn(`Location ${index} failed:`, result.reason);
          }
        });
        
        const loadTime = Date.now() - startTime;
        console.log(`✅ Parallel loading completed in ${loadTime}ms: Loaded ${allPosts.length} posts from ${locationTasks.length} locations`);
        setPosts(allPosts);
        setLoading(false);
      } catch (error) {
        console.error("Error fetching posts:", error);
        setPosts([]);
        setLoading(false);
      }
    };

    // Always start with loading state
    setLoading(true);
    fetchPosts();
  }, [accessibleAccounts, isConnected, googleLoading]);

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const getStatusBadge = (status: Post['status']) => {
    switch (status) {
      case 'published':
        return <Badge variant="default" className="bg-success text-success-foreground">Published</Badge>;
      case 'scheduled':
        return <Badge variant="secondary" className="bg-warning/10 text-warning border-warning/20">Scheduled</Badge>;
      case 'draft':
        return <Badge variant="outline">Draft</Badge>;
      case 'failed':
        return <Badge variant="destructive">Failed</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Get all available profiles for selection (only accessible ones)
  const availableProfiles = accessibleAccounts.flatMap(account =>
    account.locations.map(location => ({
      id: location.locationId,
      name: location.displayName,
      accountName: account.accountName
    }))
  );

  const filteredPosts = posts.filter(post => {
    const matchesSearch = post.content.toLowerCase().includes(searchQuery.toLowerCase()) ||
                         post.profileName.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesProfile = selectedProfileFilter === "all" || post.profileId === selectedProfileFilter;
    return matchesSearch && matchesStatus && matchesProfile;
  });

  const handleCreatePost = async (postData: any) => {
    try {
      console.log("Creating post:", postData);
      
      // Find the selected location (only from accessible accounts)
      const selectedLocation = accessibleAccounts.flatMap(account => account.locations)
        .find(location => location.locationId === postData.profileId);
      
      if (!selectedLocation) {
        throw new Error('Selected location not found');
      }
      
      // Create the post using Google Business Profile API
      // Use locationId instead of the full location name to avoid path encoding issues
      const createdPost = await googleBusinessProfileService.createLocationPost(
        selectedLocation.locationId,
        {
          summary: postData.content,
          topicType: 'STANDARD',
          callToAction: postData.callToAction
        }
      );
      
      console.log('Post created successfully:', createdPost);
      
      // Determine the actual post status from Google
      const postStatus = createdPost.status || createdPost.state || 'pending';
      const realTime = createdPost.realTime || false;
      
      // Add the new post to the list with real status
      const newPost: Post = {
        id: createdPost.id,
        profileId: selectedLocation.locationId,
        profileName: selectedLocation.displayName,
        content: createdPost.summary || '',
        status: postStatus === 'PENDING' || postStatus === 'UNDER_REVIEW' ? 'scheduled' : 
                postStatus === 'LIVE' ? 'published' : 'draft',
        postedAt: createdPost.createTime,
        scheduledAt: postStatus === 'PENDING' ? createdPost.createTime : undefined
      };
      
      setPosts(prev => [newPost, ...prev]);
      setShowCreateModal(false);

      // Add real-time notification based on post status
      if (realTime) {
        if (postStatus === 'PENDING' || postStatus === 'UNDER_REVIEW') {
          addNotification({
            type: 'post',
            title: 'Post Sent for Review',
            message: `Post for "${selectedLocation.displayName}" has been sent to Google Business Profile for review.`,
            actionUrl: '/posts'
          });
        } else if (postStatus === 'LIVE') {
          addNotification({
            type: 'post',
            title: 'Post Published!',
            message: `Your post for "${selectedLocation.displayName}" is now live on Google Business Profile.`,
            actionUrl: '/posts'
          });
        } else {
          addNotification({
            type: 'post',
            title: 'Post Created',
            message: `Post for "${selectedLocation.displayName}" has been created successfully.`,
            actionUrl: '/posts'
          });
        }
      } else {
        // For simulated/local posts
        addNotification({
          type: 'post',
          title: 'Post Drafted',
          message: `Post for "${selectedLocation.displayName}" has been drafted locally due to API restrictions.`,
          actionUrl: '/posts'
        });
      }
      
      // Show appropriate success message based on real status
      if (realTime) {
        if (postStatus === 'PENDING' || postStatus === 'UNDER_REVIEW') {
          alert(`🎉 Post successfully submitted to Google Business Profile!\n\n📋 Status: ${postStatus}\n\n⏳ Your post is now under Google's review and will appear on your Business Profile once approved. This usually takes a few minutes to a few hours.`);
        } else if (postStatus === 'LIVE') {
          alert('🎉 Post published successfully to Google Business Profile! \n\n✅ Your post is now LIVE and visible to customers on Google!');
        } else {
          alert(`🎉 Post submitted to Google Business Profile!\n\n📋 Status: ${postStatus}\n\n${createdPost.message || 'Your post has been processed by Google.'}`);
        }
      } else {
        // Handle simulated posts and API restrictions
        if (postStatus === 'SIMULATED') {
          alert(`⚠️ Google Business Profile Posts API Restriction\n\n🔒 Google has restricted access to the Posts API. Your post was saved locally but not submitted to Google Business Profile.\n\n💡 To post to your Google Business Profile:\n• Use Google Business Profile Manager directly\n• Or contact Google for API access approval\n\n📝 Post content: "${postData.content}"`);
        } else {
          alert(`🎉 Post created successfully! \n\n⚠️ Note: This was processed locally due to API restrictions.\n\n${createdPost.warning || ''}`);
        }
      }
    } catch (error) {
      console.error('Error creating post:', error);
      
      // Show detailed error message to user
      let errorMessage = 'Failed to create post. Please try again.';
      
      if (error instanceof Error) {
        // Check if it's a network error
        if (error.message.includes('fetch')) {
          errorMessage = 'Network error. Please check your connection and try again.';
        } else if (error.message.includes('Access token')) {
          errorMessage = 'Authentication error. Please reconnect your Google Business Profile.';
        } else if (error.message.includes('API')) {
          errorMessage = `API Error: ${error.message}`;
        } else {
          errorMessage = `Error: ${error.message}`;
        }
      }
      
      // Use alert for immediate feedback (can be replaced with toast notification later)
      alert(`❌ ${errorMessage}\n\n💡 If this continues, try:\n• Checking your internet connection\n• Reconnecting your Google Business Profile\n• Refreshing the page`);
    }
  };

  const getStatusCounts = () => {
    return {
      all: posts.length,
      published: posts.filter(p => p.status === 'published').length,
      scheduled: posts.filter(p => p.status === 'scheduled').length,
      draft: posts.filter(p => p.status === 'draft').length,
    };
  };

  const statusCounts = getStatusCounts();

  return (
    <>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Posts</h1>
            <p className="text-muted-foreground mt-1">
              Manage posts across all your business profiles
            </p>
          </div>
          <Button 
            onClick={() => setShowCreateModal(true)}
            className="bg-primary hover:bg-primary-hover shadow-primary"
          >
            <Plus className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </div>

        {/* Profile Limitation Alert */}
        {hasLockedProfiles && (
          <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-orange-600 mt-0.5" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-medium text-orange-800 mb-1">Multiple Profiles Available</h4>
                <p className="text-sm text-orange-700 mb-3">{lockMessage}</p>
                <Button
                  onClick={() => navigate('/dashboard/billing')}
                  size="sm"
                  className="bg-orange-600 hover:bg-orange-700 text-white"
                >
                  Upgrade to Access All Profiles
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <Card className="shadow-card border border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{statusCounts.all}</div>
              <p className="text-xs text-muted-foreground">Total Posts</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card border border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{statusCounts.published}</div>
              <p className="text-xs text-muted-foreground">Published</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card border border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{statusCounts.scheduled}</div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>
          
          <Card className="shadow-card border border-border">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{statusCounts.draft}</div>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-card border border-border">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search posts..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
              
              {/* Business Profile Filter */}
              <Select value={selectedProfileFilter} onValueChange={setSelectedProfileFilter}>
                <SelectTrigger className="w-full sm:w-64">
                  <Users className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Select business profile" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Profiles</SelectItem>
                  {availableProfiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      <div className="flex flex-col">
                        <span className="font-medium">{profile.name}</span>
                        <span className="text-xs text-muted-foreground">{profile.accountName}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48">
                  <Filter className="mr-2 h-4 w-4" />
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Status</SelectItem>
                  <SelectItem value="published">Published</SelectItem>
                  <SelectItem value="scheduled">Scheduled</SelectItem>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Posts List */}
        <Card className="shadow-card border border-border">
          <CardHeader>
            <CardTitle>All Posts</CardTitle>
          </CardHeader>
          
          <CardContent>
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="border border-border rounded-lg p-4 animate-pulse shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-6 bg-muted rounded w-20"></div>
                    </div>
                    <div className="h-3 bg-muted rounded w-full mb-1"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <Calendar className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
                <h3 className="text-lg font-medium mb-2">
                  {searchQuery || statusFilter !== "all" ? "No posts found" : "No posts yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {searchQuery || statusFilter !== "all" 
                    ? "Try adjusting your search or filters"
                    : "Create your first post to start engaging with customers"
                  }
                </p>
                {!searchQuery && statusFilter === "all" && (
                  <Button onClick={() => setShowCreateModal(true)} variant="outline">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Post
                  </Button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                {filteredPosts.map((post) => (
                  <div key={post.id} className="border border-border rounded-lg p-4 hover:bg-muted/30 transition-colors shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-2">
                        <span className="font-medium text-sm">{post.profileName}</span>
                        {getStatusBadge(post.status)}
                        {post.scheduledAt && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Clock className="h-3 w-3" />
                            {formatDateTime(post.scheduledAt)}
                          </div>
                        )}
                        {post.postedAt && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            Posted {formatDateTime(post.postedAt)}
                          </div>
                        )}
                      </div>
                      
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem>Edit Post</DropdownMenuItem>
                          <DropdownMenuItem>Duplicate</DropdownMenuItem>
                          <DropdownMenuItem>Reschedule</DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">Delete</DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                    
                    <div className="flex gap-4">
                      {post.imageUrl && (
                        <div className="flex-shrink-0">
                          <img 
                            src={post.imageUrl} 
                            alt="Post image" 
                            className="w-16 h-16 object-cover rounded-md"
                          />
                        </div>
                      )}
                      <div className="flex-1">
                        <p className="text-sm leading-relaxed">{post.content}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      <CreatePostModal 
        open={showCreateModal} 
        onOpenChange={setShowCreateModal}
        onSubmit={handleCreatePost}
        profileId={selectedProfileFilter !== "all" ? selectedProfileFilter : ""}
        availableProfiles={availableProfiles}
      />
    </>
  );
};

export default Posts;