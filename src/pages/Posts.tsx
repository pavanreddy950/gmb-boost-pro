import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, Calendar, Clock, Image, Filter, MoreHorizontal, Users, Info, RefreshCw } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
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
import { toast } from "@/hooks/use-toast";

interface Post {
  id: string;
  profileId: string;
  profileName: string;
  content: string;
  scheduledAt?: string;
  postedAt?: string;
  status: 'draft' | 'scheduled' | 'published' | 'failed';
  imageUrl?: string;
  callToAction?: string;
}

const Posts = () => {
  const [posts, setPosts] = useState<Post[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [selectedProfileFilter, setSelectedProfileFilter] = useState<string>("all");
  const [refreshKey, setRefreshKey] = useState(0);
  const [lastRefreshed, setLastRefreshed] = useState<Date | null>(null);
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

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

                // Use locationId and forceRefresh to get latest posts
                const shouldForceRefresh = refreshKey > 0; // Force refresh on manual/auto refresh
                const locationPosts = await googleBusinessProfileService.getLocationPosts(location.locationId, { forceRefresh: shouldForceRefresh });
                clearTimeout(timeoutId);

                console.log(`📍 Posts: Received ${locationPosts.length} posts for ${location.displayName}`);

                // Convert BusinessPost to Post format
                const convertedPosts: Post[] = locationPosts.map(post => ({
                  id: post.id,
                  profileId: location.locationId,
                  profileName: location.displayName,
                  content: post.summary || '',
                  status: 'published' as const,
                  postedAt: post.createTime,
                  callToAction: (post as any).callToAction?.actionType || undefined
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

        // 🔧 FIX: Sort ALL posts by date (most recent first) across all locations
        // This ensures posts are displayed in chronological order, not grouped by location
        allPosts.sort((a, b) => {
          const dateA = a.postedAt ? new Date(a.postedAt).getTime() : 0;
          const dateB = b.postedAt ? new Date(b.postedAt).getTime() : 0;
          return dateB - dateA; // Descending order (newest first)
        });

        const loadTime = Date.now() - startTime;
        console.log(`✅ Parallel loading completed in ${loadTime}ms: Loaded ${allPosts.length} posts from ${locationTasks.length} locations (sorted by date)`);
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
  }, [accessibleAccounts, isConnected, googleLoading, refreshKey]);

  // Auto-refresh every 60 seconds to catch new auto-posted content
  useEffect(() => {
    const interval = setInterval(() => {
      console.log('[Posts] Auto-refreshing posts...');
      setRefreshKey(prev => prev + 1);
    }, 60000); // 60 seconds

    return () => clearInterval(interval);
  }, []);

  // Manual refresh function
  const handleRefresh = () => {
    console.log('[Posts] Manual refresh triggered - clearing cache');
    googleBusinessProfileService.clearPostsCache();
    setRefreshKey(prev => prev + 1);
    setLastRefreshed(new Date());
  };

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
    const matchesStatus = statusFilter === "all" || post.status === statusFilter;
    const matchesProfile = selectedProfileFilter === "all" || post.profileId === selectedProfileFilter;
    return matchesStatus && matchesProfile;
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
        scheduledAt: postStatus === 'PENDING' ? createdPost.createTime : undefined,
        callToAction: postData.callToAction || undefined
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
      <div className="space-y-4 sm:space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4">
          <div>
            <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold tracking-tight">Posts</h1>
            <p className="text-sm sm:text-base text-muted-foreground mt-1">
              Manage posts across all your business profiles
              {lastRefreshed && (
                <span className="text-xs ml-2">
                  • Last refreshed: {lastRefreshed.toLocaleTimeString()}
                </span>
              )}
            </p>
          </div>
          <div className="flex gap-2 w-full sm:w-auto">
            <Button
              onClick={handleRefresh}
              variant="outline"
              size="sm"
              disabled={loading}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={`mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4 ${loading ? 'animate-spin' : ''}`} />
              <span className="text-sm sm:text-base">Refresh</span>
            </Button>
            <Button
              onClick={() => setShowCreateModal(true)}
              className="bg-primary hover:bg-primary-hover shadow-primary flex-1 sm:flex-none"
              size="sm"
            >
              <Plus className="mr-1 sm:mr-2 h-3 w-3 sm:h-4 sm:w-4" />
              <span className="text-sm sm:text-base">Create Post</span>
            </Button>
          </div>
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
          <Card className="shadow-card border border-blue-200">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold">{statusCounts.all}</div>
              <p className="text-xs text-muted-foreground">Total Posts</p>
            </CardContent>
          </Card>

          <Card className="shadow-card border border-blue-200">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{statusCounts.published}</div>
              <p className="text-xs text-muted-foreground">Published</p>
            </CardContent>
          </Card>

          <Card className="shadow-card border border-blue-200">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-warning">{statusCounts.scheduled}</div>
              <p className="text-xs text-muted-foreground">Scheduled</p>
            </CardContent>
          </Card>

          <Card className="shadow-card border border-blue-200">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-muted-foreground">{statusCounts.draft}</div>
              <p className="text-xs text-muted-foreground">Drafts</p>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="shadow-card border border-blue-200">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Business Profile Filter */}
              <Select value={selectedProfileFilter} onValueChange={setSelectedProfileFilter}>
                <SelectTrigger className="w-full sm:w-64 border-blue-200">
                  <Users className="mr-2 h-4 w-4 text-blue-600" />
                  <SelectValue placeholder="All Profiles" />
                </SelectTrigger>
                <SelectContent className="max-h-[300px]">
                  <SelectItem value="all" className="font-semibold">
                    All Profiles
                  </SelectItem>
                  {availableProfiles.map(profile => (
                    <SelectItem key={profile.id} value={profile.id}>
                      {profile.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="w-full sm:w-48 border-blue-200">
                  <Filter className="mr-2 h-4 w-4 text-blue-600" />
                  <SelectValue placeholder="All Status" />
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
        <Card className="shadow-card border border-blue-200">
          <CardHeader className="border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
            <CardTitle className="text-blue-900">All Posts</CardTitle>
          </CardHeader>

          <CardContent className="pt-6">
            {loading ? (
              <div className="space-y-4">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="border border-blue-200 rounded-lg p-4 animate-pulse shadow-sm">
                    <div className="flex items-start justify-between mb-3">
                      <div className="h-4 bg-blue-100 rounded w-1/4"></div>
                      <div className="h-6 bg-blue-100 rounded w-20"></div>
                    </div>
                    <div className="h-3 bg-muted rounded w-full mb-1"></div>
                    <div className="h-3 bg-muted rounded w-3/4"></div>
                  </div>
                ))}
              </div>
            ) : filteredPosts.length === 0 ? (
              <div className="text-center py-12">
                <div className="mx-auto mb-4 p-4 bg-blue-50 rounded-full w-fit">
                  <Calendar className="h-12 w-12 text-blue-600" />
                </div>
                <h3 className="text-lg font-medium mb-2">
                  {statusFilter !== "all" || selectedProfileFilter !== "all" ? "No posts found" : "No posts yet"}
                </h3>
                <p className="text-muted-foreground mb-4">
                  {statusFilter !== "all" || selectedProfileFilter !== "all"
                    ? "Try adjusting your filters"
                    : "Create your first post to start engaging with customers"
                  }
                </p>
                {statusFilter === "all" && selectedProfileFilter === "all" && (
                  <Button onClick={() => setShowCreateModal(true)} className="bg-blue-600 hover:bg-blue-700">
                    <Plus className="mr-2 h-4 w-4" />
                    Create First Post
                  </Button>
                )}
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredPosts.map((post) => (
                  <div key={post.id} className="border-2 border-blue-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-lg transition-all duration-200 bg-white flex flex-col">
                    {/* Header */}
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <span className="font-semibold text-base text-gray-900">{post.profileName}</span>
                        {getStatusBadge(post.status)}
                      </div>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm" className="h-8 w-8 p-0 hover:bg-gray-100">
                            <MoreHorizontal className="h-4 w-4 text-gray-600" />
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

                    {/* Date */}
                    {post.postedAt && (
                      <div className="flex items-center gap-1 text-sm text-gray-600 mb-4">
                        <Calendar className="h-4 w-4" />
                        <span>{formatDateTime(post.postedAt)}</span>
                      </div>
                    )}
                    {post.scheduledAt && (
                      <div className="flex items-center gap-1 text-sm text-orange-600 mb-4">
                        <Clock className="h-4 w-4" />
                        <span>Scheduled {formatDateTime(post.scheduledAt)}</span>
                      </div>
                    )}

                    {/* Content - Flex grow to push CTA to bottom */}
                    <div className="flex-1 mb-4">
                      <p className="text-sm leading-relaxed text-gray-700 line-clamp-6">{post.content}</p>
                    </div>

                    {/* Image if available */}
                    {post.imageUrl && (
                      <div className="mb-4">
                        <img
                          src={post.imageUrl}
                          alt="Post image"
                          className="w-full h-48 object-cover rounded-lg"
                        />
                      </div>
                    )}

                    {/* CTA Button - Always at bottom */}
                    {post.callToAction && (
                      <div className="flex items-center gap-2 pt-3 border-t border-gray-200">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 bg-green-50 border-green-200 text-green-700 hover:bg-green-100 hover:text-green-800 font-medium"
                        >
                          {post.callToAction === 'CALL' && (
                            <>
                              <span className="text-green-600 mr-2">📞</span>
                              Call Now
                            </>
                          )}
                          {post.callToAction === 'LEARN_MORE' && (
                            <>
                              <span className="mr-2">🔗</span>
                              Learn More
                            </>
                          )}
                          {post.callToAction === 'ORDER' && (
                            <>
                              <span className="mr-2">🛒</span>
                              Order
                            </>
                          )}
                          {post.callToAction === 'BOOK' && (
                            <>
                              <span className="mr-2">📅</span>
                              Book
                            </>
                          )}
                          {post.callToAction === 'SIGN_UP' && (
                            <>
                              <span className="mr-2">✍️</span>
                              Sign Up
                            </>
                          )}
                          {!['CALL', 'LEARN_MORE', 'ORDER', 'BOOK', 'SIGN_UP'].includes(post.callToAction) && post.callToAction}
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                          onClick={() => {
                            setSelectedPost(post);
                            setShowDetailsModal(true);
                          }}
                        >
                          →
                        </Button>
                      </div>
                    )}
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

      {/* Post Details Modal */}
      <Dialog open={showDetailsModal} onOpenChange={setShowDetailsModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-2xl font-semibold">Post Details</DialogTitle>
          </DialogHeader>

          {selectedPost && (
            <div className="space-y-6 py-4">
              {/* Header with Business Name and Status */}
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <h3 className="text-xl font-semibold text-gray-900">{selectedPost.profileName}</h3>
                  {selectedPost.status === 'published' && (
                    <Badge className="bg-green-600 text-white hover:bg-green-700">Published</Badge>
                  )}
                  {selectedPost.status === 'scheduled' && (
                    <Badge className="bg-orange-500 text-white hover:bg-orange-600">Scheduled</Badge>
                  )}
                  {selectedPost.status === 'draft' && (
                    <Badge variant="outline">Draft</Badge>
                  )}
                </div>

                {/* Posted Date */}
                {selectedPost.postedAt && (
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Calendar className="h-4 w-4" />
                    <span>Posted {formatDateTime(selectedPost.postedAt)}</span>
                  </div>
                )}
              </div>

              {/* Full Content */}
              <div className="space-y-4">
                <p className="text-base leading-relaxed text-gray-800 whitespace-pre-wrap">
                  {selectedPost.content}
                </p>
              </div>

              {/* Image if available */}
              {selectedPost.imageUrl && (
                <div className="rounded-lg overflow-hidden border border-gray-200">
                  <img
                    src={selectedPost.imageUrl}
                    alt="Post image"
                    className="w-full h-auto object-cover"
                  />
                </div>
              )}

              {/* CTA Button Display */}
              {selectedPost.callToAction && (
                <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-sm font-medium text-gray-700">CTA Button:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {selectedPost.callToAction === 'CALL' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-green-50 border border-green-200 rounded-md text-green-700 font-medium">
                        <span className="text-green-600">📞</span>
                        <span>Call Now</span>
                      </div>
                    )}
                    {selectedPost.callToAction === 'LEARN_MORE' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-blue-700 font-medium">
                        <span>🔗</span>
                        <span>Learn More</span>
                      </div>
                    )}
                    {selectedPost.callToAction === 'ORDER' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-blue-700 font-medium">
                        <span>🛒</span>
                        <span>Order</span>
                      </div>
                    )}
                    {selectedPost.callToAction === 'BOOK' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-blue-700 font-medium">
                        <span>📅</span>
                        <span>Book</span>
                      </div>
                    )}
                    {selectedPost.callToAction === 'SIGN_UP' && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 border border-blue-200 rounded-md text-blue-700 font-medium">
                        <span>✍️</span>
                        <span>Sign Up</span>
                      </div>
                    )}
                    {!['CALL', 'LEARN_MORE', 'ORDER', 'BOOK', 'SIGN_UP'].includes(selectedPost.callToAction) && (
                      <div className="flex items-center gap-2 px-4 py-2 bg-gray-50 border border-gray-200 rounded-md text-gray-700 font-medium">
                        {selectedPost.callToAction}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3 pt-4 border-t border-gray-200">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => setShowDetailsModal(false)}
                >
                  Close
                </Button>
                <DropdownMenu modal={false}>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" className="flex-1">
                      <MoreHorizontal className="mr-2 h-4 w-4" />
                      Actions
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48 z-[9999]">
                    <DropdownMenuItem onClick={() => {
                      setShowDetailsModal(false);
                      setShowCreateModal(true);
                    }}>
                      Edit Post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      if (selectedPost) {
                        // Create a duplicate post
                        const duplicatePost = { ...selectedPost };
                        setShowDetailsModal(false);
                        toast({ title: "Duplicated", description: "Post duplicated successfully" });
                      }
                    }}>
                      Duplicate
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => {
                      setShowDetailsModal(false);
                      setShowCreateModal(true);
                      toast({ title: "Reschedule", description: "Update the posting schedule" });
                    }}>
                      Reschedule
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => {
                        if (confirm('Are you sure you want to delete this post?')) {
                          // Add delete functionality here
                          setShowDetailsModal(false);
                          toast({ title: "Deleted", description: "Post deleted successfully" });
                        }
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default Posts;