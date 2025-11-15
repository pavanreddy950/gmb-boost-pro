import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Star, MessageSquare, Bot, Calendar, Settings2, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { googleBusinessProfileService } from "@/lib/googleBusinessProfile";
import { reviewAutomationService } from "@/lib/reviewAutomationService";
import { serverAutomationService } from "@/lib/serverAutomationService";
import { automationStorage } from "@/lib/automationStorage";
import { toast } from "@/hooks/use-toast";
import { LoadingSpinner } from "@/components/ui/loading-spinner";
import { useNotifications } from "@/contexts/NotificationContext";
import { useAuth } from "@/contexts/AuthContext";

interface Review {
  id: string;
  fullReviewName?: string; // Full review name from Google API
  author: string;
  rating: number;
  content: string;
  createdAt: string;
  replied: boolean;
  replyContent?: string;
  repliedAt?: string;
}

interface ReviewsTabProps {
  profileId: string;
}

const ReviewsTab = ({ profileId }: ReviewsTabProps) => {
  const { currentUser } = useAuth();
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [autoPolling, setAutoPolling] = useState(false);
  const [lastReviewCount, setLastReviewCount] = useState(0);
  const [isSavingToServer, setIsSavingToServer] = useState(false);
  const { addNotification } = useNotifications();
  
  // Review automation state
  const [reviewConfig, setReviewConfig] = useState({
    enabled: true, // Auto-reply enabled by default for all users
    autoReplyEnabled: true, // Auto-generate replies enabled by default
    replyTemplate: '',
    minRating: undefined as number | undefined,
    maxRating: undefined as number | undefined,
  });


  // Real-time reviews from Google Business Profile API
  const fetchReviews = async (isRefresh = false) => {
    if (!profileId) {
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }

    try {
      console.log('ReviewsTab: Fetching reviews for profileId:', profileId);
      
      // Fetch reviews using the Google Business Profile API with force refresh parameter
      const locationReviews = await googleBusinessProfileService.getLocationReviews(
        `locations/${profileId}`, 
        isRefresh ? { forceRefresh: true } : {}
      );
      
      console.log('ReviewsTab: Raw review data from API:', locationReviews);
      
      // Convert BusinessReview to Review format
      const convertedReviews: Review[] = locationReviews.map(review => {
        // Extract review ID from the name field (format: accounts/.../locations/.../reviews/reviewId)
        const reviewId = review.name ? review.name.split('/').pop() : review.id;
        
        console.log('ReviewsTab: Processing review:', {
          name: review.name,
          extractedId: reviewId,
          id: review.id,
          author: review.reviewer.displayName,
          rating: review.starRating,
          hasReply: !!review.reply,
          replyContent: review.reply?.comment
        });
        
        return {
          id: reviewId,
          fullReviewName: review.name, // Store the full review name for API calls
          author: review.reviewer.displayName,
          rating: review.starRating,
          content: review.comment || '',
          createdAt: review.createTime,
          replied: !!review.reply,
          replyContent: review.reply?.comment,
          repliedAt: review.reply?.updateTime
        };
      });
      
      console.log('ReviewsTab: Loaded', convertedReviews.length, 'reviews with replies:', convertedReviews.filter(r => r.replied).length);
      
      // Check for new reviews
      if (convertedReviews.length > lastReviewCount && lastReviewCount > 0) {
        const newReviewsCount = convertedReviews.length - lastReviewCount;
        console.log(`🆕 Detected ${newReviewsCount} new reviews!`);
        
        // Show notification for new reviews
        addNotification({
          type: 'review',
          title: `${newReviewsCount} New Review${newReviewsCount > 1 ? 's' : ''}!`,
          message: `You have received ${newReviewsCount} new customer review${newReviewsCount > 1 ? 's' : ''}`,
          actionUrl: `/dashboard/profiles/${profileId}?tab=reviews`,
          metadata: {
            profileId,
            newReviewsCount
          }
        });
        
        toast({
          title: "New Review Received! 🌟",
          description: `You have ${newReviewsCount} new customer review${newReviewsCount > 1 ? 's' : ''}`,
        });
      }
      
      setReviews(convertedReviews);
      setLastReviewCount(convertedReviews.length);
      
      if (isRefresh && !autoPolling) {
        toast({
          title: "Reviews Refreshed",
          description: `Loaded ${convertedReviews.length} reviews from Google Business Profile`,
        });
      }
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setReviews([]);
      
      toast({
        title: "Error Loading Reviews",
        description: "Failed to fetch reviews from Google Business Profile",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadReviewConfiguration();
    fetchReviews();
    
    // Set up auto-polling for new reviews every 30 seconds
    const pollInterval = setInterval(() => {
      if (autoPolling) {
        console.log('🔄 Auto-polling for new reviews...');
        fetchReviews(true);
      }
    }, 30000); // Check every 30 seconds
    
    // Enable auto-polling by default
    setAutoPolling(true);
    
    return () => {
      clearInterval(pollInterval);
    };
  }, [profileId, autoPolling]);

  const loadReviewConfiguration = async () => {
    const existingReviewConfig = reviewAutomationService.getConfiguration(profileId);
    if (existingReviewConfig) {
      setReviewConfig({
        enabled: existingReviewConfig.enabled,
        autoReplyEnabled: existingReviewConfig.autoReplyEnabled,
        replyTemplate: existingReviewConfig.replyTemplate || '',
        minRating: existingReviewConfig.minRating,
        maxRating: existingReviewConfig.maxRating,
      });
    } else {
      // New user - no existing config
      // reviewConfig state already has defaults (enabled: true, autoReplyEnabled: true)
      // Auto-sync to server for new users
      if (currentUser?.uid) {
        console.log('New user detected - syncing default review automation settings to server');

        const accountId = localStorage.getItem('google_business_account_id');
        const businessName = localStorage.getItem('google_business_name') || 'Current Location';

        // Get keywords from AutoPosting configuration
        const automationConfig = automationStorage.getConfiguration(profileId);
        const keywords = automationConfig?.keywords
          ? (Array.isArray(automationConfig.keywords)
              ? automationConfig.keywords.join(', ')
              : automationConfig.keywords)
          : '';
        const category = automationConfig?.categories?.[0] || '';

        // Save default config locally first
        reviewAutomationService.saveConfiguration({
          locationId: profileId,
          businessName: businessName,
          enabled: true,
          autoReplyEnabled: true,
          replyTemplate: '',
          minRating: undefined,
          maxRating: undefined,
        });

        // Sync to server in background
        serverAutomationService.enableAutoReply(
          profileId,
          businessName,
          true, // replyToAll
          currentUser.uid,
          accountId || undefined,
          keywords,
          category
        ).then(() => {
          console.log('✅ Default review automation settings synced to server');
        }).catch(err => {
          console.error('Failed to sync default review automation to server:', err);
        });
      }
    }
  };

  const saveReviewConfiguration = async (updates: Partial<typeof reviewConfig>) => {
    const updatedReviewConfig = { ...reviewConfig, ...updates };
    setReviewConfig(updatedReviewConfig);
    
    // Save locally first
    reviewAutomationService.saveConfiguration({
      locationId: profileId,
      businessName: 'Current Location', // We don't have business name in this component
      enabled: updatedReviewConfig.enabled,
      autoReplyEnabled: updatedReviewConfig.autoReplyEnabled,
      replyTemplate: updatedReviewConfig.replyTemplate,
      minRating: updatedReviewConfig.minRating,
      maxRating: updatedReviewConfig.maxRating,
    });

    // Save to server for persistent automation
    // Only sync to server if BOTH enabled AND autoReplyEnabled are true
    if (updatedReviewConfig.enabled && updatedReviewConfig.autoReplyEnabled) {
      setIsSavingToServer(true);
      try {
        const accountId = localStorage.getItem('google_business_account_id');
        const businessName = localStorage.getItem('google_business_name') || 'Current Location';

        // Get keywords from AutoPosting configuration
        const automationConfig = automationStorage.getConfiguration(profileId);
        const keywords = automationConfig?.keywords
          ? (Array.isArray(automationConfig.keywords)
              ? automationConfig.keywords.join(', ')
              : automationConfig.keywords)
          : '';
        const category = automationConfig?.categories?.[0] || '';

        await serverAutomationService.enableAutoReply(
          profileId,
          businessName,
          true, // replyToAll
          currentUser?.uid,
          accountId || undefined,
          keywords,
          category
        );

        toast({
          title: "Review Settings Saved",
          description: "Auto-reply will continue running even when you're offline.",
          duration: 4000,
        });
      } catch (error) {
        console.error('Failed to save to server:', error);
        toast({
          title: "Server sync failed",
          description: "Settings saved locally but server sync failed. Auto-reply may not work when offline.",
          variant: "destructive",
          duration: 5000,
        });
      } finally {
        setIsSavingToServer(false);
      }
    } else if (!updatedReviewConfig.enabled || !updatedReviewConfig.autoReplyEnabled) {
      // Disable on server only when explicitly disabled
      try {
        await serverAutomationService.disableAutoReply(profileId);
        toast({
          title: "Review Settings Saved",
          description: updatedReviewConfig.enabled
            ? "Auto-reply has been disabled."
            : "Review automation has been disabled.",
        });
      } catch (error) {
        console.error('Failed to disable on server:', error);
        toast({
          title: "Review Settings Saved",
          description: "Your review automation settings have been updated.",
        });
      }
    }
  };

  const handleAutoReply = async (reviewId: string, reviewContent: string, reviewerName: string, rating: number) => {
    try {
      console.log("Auto-replying to review:", { reviewId, reviewContent, reviewerName, rating });
      
      // Get the review configuration for this location
      const config = reviewAutomationService.getConfiguration(profileId);
      let replyText: string;
      
      if (config?.replyTemplate && config.replyTemplate.trim()) {
        // Use custom template with placeholder replacement
        replyText = config.replyTemplate
          .replace(/\{businessName\}/g, 'Our Business')
          .replace(/\{reviewerName\}/g, reviewerName)
          .replace(/\{rating\}/g, rating.toString())
          .replace(/\{comment\}/g, reviewContent);
      } else {
        // Use AI to generate a personalized reply
        replyText = await reviewAutomationService.generateAIReply({
          reviewText: reviewContent,
          reviewerName: reviewerName,
          rating: rating,
          businessName: 'Our Business', // We don't have business name in this component
          locationId: profileId
        });
      }
      
      console.log("Generated reply text:", replyText);
      
      // Reply to the review using Google Business Profile API
      // Use the full review name if available, otherwise construct it
      const reviewForReply = reviews.find(r => r.id === reviewId);
      const fullReviewName = reviewForReply?.fullReviewName || `accounts/106433552101751461082/locations/${profileId}/reviews/${reviewId}`;
      
      console.log('ReviewsTab: Sending reply with full review name:', fullReviewName);
      await googleBusinessProfileService.replyToReview(fullReviewName, replyText);
      
      // Refresh the reviews to get the latest data including the new reply
      await fetchReviews(true);
      
      // Add notification
      addNotification({
        type: 'reply',
        title: 'AI Reply Posted',
        message: `Successfully replied to ${reviewerName}'s ${rating}-star review with AI-generated response`,
        actionUrl: `/dashboard/profiles/${profileId}?tab=reviews`,
        metadata: {
          profileId,
          reviewId,
          reviewerName,
          rating,
          replyText: replyText.substring(0, 100)
        }
      });
      
      toast({
        title: "AI Reply Sent Successfully", 
        description: "Your personalized AI-generated reply has been posted",
      });
      
      console.log('AI reply sent successfully!');
    } catch (error) {
      console.error('Error replying to review:', error);
      toast({
        title: "Failed to Send Reply",
        description: error instanceof Error ? error.message : "Please try again",
        variant: "destructive"
      });
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric'
    });
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <Star 
        key={index} 
        className={cn(
          "h-4 w-4",
          index < rating ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
        )} 
      />
    ));
  };

  const getInitials = (name: string) => {
    return name.split(' ').map(n => n[0]).join('').toUpperCase();
  };


  return (
    <Tabs defaultValue="reviews" className="w-full">
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="reviews" className="text-xs sm:text-sm">Customer Reviews</TabsTrigger>
        <TabsTrigger value="automation" className="text-xs sm:text-sm">Auto-Reply Settings</TabsTrigger>
      </TabsList>
      
      <TabsContent value="reviews" className="space-y-4">
        <Card className="shadow-card border-0">
          <CardHeader>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <CardTitle className="text-lg sm:text-xl">Customer Reviews</CardTitle>
              <div className="flex flex-wrap items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => fetchReviews(true)}
                  disabled={refreshing}
                  className="gap-1 sm:gap-2"
                >
                  <RefreshCw className={cn("h-3 w-3", refreshing && "animate-spin")} />
                  <span className="text-xs sm:text-sm">Refresh</span>
                </Button>
                <div className="flex items-center gap-1">
                  <div className={cn(
                    "h-2 w-2 rounded-full",
                    autoPolling ? "bg-green-500 animate-pulse" : "bg-gray-400"
                  )} />
                  <span className="text-xs text-muted-foreground">
                    {autoPolling ? "Live" : "Offline"}
                  </span>
                </div>
                <Badge variant="secondary" className="bg-primary/10 text-primary text-xs">
                  {reviews.length} Total Reviews
                </Badge>
              </div>
            </div>
          </CardHeader>
          
          <CardContent>
        {loading ? (
          <div className="flex flex-col items-center justify-center py-16 space-y-4">
            <LoadingSpinner size="lg" variant="primary" />
            <div className="text-center space-y-2">
              <h3 className="font-medium text-lg">Loading Reviews...</h3>
              <p className="text-sm text-muted-foreground">Fetching your latest customer reviews from Google Business Profile</p>
            </div>
            
            {/* Enhanced loading skeleton */}
            <div className="w-full max-w-2xl mt-8 space-y-4">
              {Array.from({ length: 3 }).map((_, index) => (
                <div key={index} className="border-b border-border pb-6">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 bg-muted rounded-full animate-pulse"></div>
                    <div className="flex-1 space-y-3">
                      <div className="flex items-center gap-2">
                        <div className="h-4 bg-muted rounded w-24 animate-pulse"></div>
                        <div className="flex gap-1">
                          {Array.from({ length: 5 }).map((_, starIndex) => (
                            <div key={starIndex} className="h-4 w-4 bg-muted rounded animate-pulse"></div>
                          ))}
                        </div>
                      </div>
                      <div className="h-3 bg-muted rounded w-full animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-3/4 animate-pulse"></div>
                      <div className="h-3 bg-muted rounded w-1/2 animate-pulse"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-12">
            <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No reviews yet</h3>
            <p className="text-muted-foreground">Customer reviews will appear here once you receive them</p>
          </div>
        ) : (
          <div className="space-y-4 sm:space-y-6">
            {reviews.map((review, index) => (
              <div key={review.id} className={cn(
                "pb-4 sm:pb-6",
                index < reviews.length - 1 && "border-b border-border"
              )}>
                <div className="flex gap-3 sm:gap-4">
                  <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                    <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                      {getInitials(review.author)}
                    </AvatarFallback>
                  </Avatar>
                  
                  <div className="flex-1 space-y-2 sm:space-y-3 min-w-0">
                    {/* Review Header */}
                    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-1">
                          <h4 className="font-medium text-sm sm:text-base truncate">{review.author}</h4>
                          <div className="flex items-center gap-0.5 sm:gap-1">
                            {renderStars(review.rating)}
                          </div>
                        </div>
                        <div className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          {formatDate(review.createdAt)}
                        </div>
                      </div>
                      
                      {!review.replied && (
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleAutoReply(review.id, review.content, review.author, review.rating)}
                          className="gap-1 sm:gap-2 w-full sm:w-auto text-xs sm:text-sm whitespace-nowrap"
                        >
                          <Bot className="h-3 w-3" />
                          <span className="hidden sm:inline">Reply with AI</span>
                          <span className="sm:hidden">AI Reply</span>
                        </Button>
                      )}
                    </div>
                    
                    {/* Review Content */}
                    <p className="text-xs sm:text-sm leading-relaxed break-words">{review.content}</p>
                    
                    {/* Reply */}
                    {review.replied && review.replyContent && (
                      <div className="bg-muted/50 rounded-lg p-2 sm:p-3 ml-0 sm:ml-4 border-l-2 border-primary/20">
                        <div className="flex flex-wrap items-center gap-1 sm:gap-2 mb-2">
                          <MessageSquare className="h-3 w-3 text-primary" />
                          <span className="text-xs font-medium text-primary">Your Reply</span>
                          {review.repliedAt && (
                            <span className="text-xs text-muted-foreground">
                              • {formatDate(review.repliedAt)}
                            </span>
                          )}
                        </div>
                        <p className="text-xs sm:text-sm break-words">{review.replyContent}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
          </CardContent>
        </Card>
      </TabsContent>
      
      <TabsContent value="automation" className="space-y-4">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg sm:text-xl">
              <Settings2 className="h-4 w-4 sm:h-5 sm:w-5" />
              <span className="text-base sm:text-lg">Review Auto-Reply Settings</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4 sm:space-y-6">
            {/* Enable Review Automation */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5 flex-1">
                <Label className="text-sm sm:text-base">Enable Review Automation</Label>
                <p className="text-xs sm:text-sm text-muted-foreground">
                  Monitor and automatically reply to customer reviews
                </p>
              </div>
              <Switch
                checked={reviewConfig.enabled}
                onCheckedChange={(checked) => 
                  saveReviewConfiguration({ enabled: checked })
                }
              />
            </div>

            {reviewConfig.enabled && (
              <>
                <Separator />
                
                {/* Auto-Reply Toggle */}
                <div className="flex items-center justify-between">
                  <div className="space-y-0.5">
                    <Label>Auto-Reply to Reviews</Label>
                    <p className="text-sm text-muted-foreground">
                      Automatically generate and post replies using AI
                    </p>
                  </div>
                  <Switch
                    checked={reviewConfig.autoReplyEnabled}
                    onCheckedChange={(checked) => 
                      saveReviewConfiguration({ autoReplyEnabled: checked })
                    }
                  />
                </div>

                {reviewConfig.autoReplyEnabled && (
                  <>
                    {/* Rating Filter */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Reply to reviews with rating from:</Label>
                        <Select
                          value={reviewConfig.minRating?.toString() || 'any'}
                          onValueChange={(value) => 
                            saveReviewConfiguration({ 
                              minRating: value === 'any' ? undefined : parseInt(value) 
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Any rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any rating</SelectItem>
                            <SelectItem value="1">1 star and above</SelectItem>
                            <SelectItem value="2">2 stars and above</SelectItem>
                            <SelectItem value="3">3 stars and above</SelectItem>
                            <SelectItem value="4">4 stars and above</SelectItem>
                            <SelectItem value="5">5 stars only</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      
                      <div className="space-y-2">
                        <Label>To:</Label>
                        <Select
                          value={reviewConfig.maxRating?.toString() || 'any'}
                          onValueChange={(value) => 
                            saveReviewConfiguration({ 
                              maxRating: value === 'any' ? undefined : parseInt(value) 
                            })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Any rating" />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="any">Any rating</SelectItem>
                            <SelectItem value="1">1 star only</SelectItem>
                            <SelectItem value="2">2 stars and below</SelectItem>
                            <SelectItem value="3">3 stars and below</SelectItem>
                            <SelectItem value="4">4 stars and below</SelectItem>
                            <SelectItem value="5">5 stars and below</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Custom Reply Template */}
                    <div className="space-y-2">
                      <Label>Custom Reply Template (Optional)</Label>
                      <Textarea
                        placeholder="Leave blank to use AI-generated replies. Use {businessName}, {reviewerName}, {rating}, {comment} as placeholders."
                        value={reviewConfig.replyTemplate}
                        onChange={(e) => 
                          setReviewConfig(prev => ({ ...prev, replyTemplate: e.target.value }))
                        }
                        onBlur={() => saveReviewConfiguration({ replyTemplate: reviewConfig.replyTemplate })}
                        rows={3}
                      />
                      <p className="text-xs text-muted-foreground">
                        If empty, AI will generate personalized replies. Use placeholders like {"{businessName}"}, {"{reviewerName}"}, {"{rating}"}, {"{comment}"}.
                      </p>
                    </div>

                    {/* Preview Section */}
                    <div className="bg-muted/50 p-4 rounded-lg">
                      <h4 className="font-medium mb-2 flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        How it works:
                      </h4>
                      <ul className="text-sm text-muted-foreground space-y-1">
                        <li>• Reviews are checked every minute for new reviews</li>
                        <li>• Only reviews matching your criteria will get replies</li>
                        <li>• AI generates personalized, professional responses</li>
                        <li>• Reviews that already have replies are skipped</li>
                      </ul>
                    </div>
                  </>
                )}
              </>
            )}
          </CardContent>
        </Card>
      </TabsContent>
    </Tabs>
  );
};

export default ReviewsTab;