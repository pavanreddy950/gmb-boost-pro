import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Star, MessageSquare, Bot, Calendar, Filter, RefreshCw, Edit2, Send, X, Heart, Frown, Meh, Copy, Check, Info } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { useGoogleBusinessProfile } from "@/hooks/useGoogleBusinessProfile";
import { googleBusinessProfileService } from "@/lib/googleBusinessProfile";
import { useProfileLimitations } from "@/hooks/useProfileLimitations";
import { useAuth } from "@/contexts/AuthContext";

interface Review {
  id: string;
  profileId: string;
  profileName: string;
  fullReviewName?: string; // Full review name from Google API
  author: string;
  rating: number;
  content: string;
  createdAt: string;
  replied: boolean;
  replyContent?: string;
  repliedAt?: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
}

interface ReviewFilters {
  search: string;
  rating: string;
  reply: string;
  location: string;
  dateRange: string;
  sentiment: string;
}

interface SortConfig {
  field: 'date' | 'rating' | 'author';
  direction: 'asc' | 'desc';
}


const Reviews = () => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [filters, setFilters] = useState<ReviewFilters>({
    search: '',
    rating: 'all',
    reply: 'all', 
    location: 'all',
    dateRange: 'all',
    sentiment: 'all'
  });
  const [sortConfig, setSortConfig] = useState<SortConfig>({ field: 'date', direction: 'desc' });
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [replyDialogOpen, setReplyDialogOpen] = useState(false);
  const [customReply, setCustomReply] = useState('');
  const [replyLoading, setReplyLoading] = useState(false);
  const [aiSuggestions, setAiSuggestions] = useState<string[]>([]);
  const [loadingSuggestions, setLoadingSuggestions] = useState(false);
  const [copiedSuggestionIndex, setCopiedSuggestionIndex] = useState<number | null>(null);
  
  // Get current user for subscription enforcement
  const { currentUser } = useAuth();

  // Get real-time Google Business Profile data
  const {
    accounts,
    isConnected,
    isLoading: googleLoading
  } = useGoogleBusinessProfile();

  // Navigation
  const navigate = useNavigate();

  // Apply profile limitations
  const { getAccessibleAccounts, getAccountLockMessage, canAccessMultipleProfiles } = useProfileLimitations();

  // Memoize these values to prevent infinite re-renders
  const accessibleAccounts = useMemo(() => getAccessibleAccounts(accounts), [accounts, getAccessibleAccounts]);
  const lockMessage = useMemo(() => getAccountLockMessage(accounts.length), [accounts.length, getAccountLockMessage]);
  const hasLockedProfiles = useMemo(() => !canAccessMultipleProfiles && accounts.length > 1, [canAccessMultipleProfiles, accounts.length]);

  // Analyze review sentiment
  const analyzeSentiment = (rating: number, content: string): 'positive' | 'neutral' | 'negative' => {
    if (rating >= 4) return 'positive';
    if (rating <= 2) return 'negative';
    
    // For 3-star reviews, analyze content for sentiment keywords
    const negativeWords = ['bad', 'terrible', 'awful', 'horrible', 'worst', 'disappointing', 'poor'];
    const positiveWords = ['good', 'great', 'excellent', 'amazing', 'wonderful', 'fantastic', 'perfect'];
    
    const lowerContent = content.toLowerCase();
    const hasNegative = negativeWords.some(word => lowerContent.includes(word));
    const hasPositive = positiveWords.some(word => lowerContent.includes(word));
    
    if (hasPositive && !hasNegative) return 'positive';
    if (hasNegative && !hasPositive) return 'negative';
    return 'neutral';
  };

  // Fetch reviews with enhanced data
  const fetchReviews = async (isRefresh = false) => {
    // Keep loading state true while Google data is loading
    if (googleLoading) {
      setLoading(true);
      return;
    }

    // If not connected or no accessible accounts, show empty state after a brief loading
    if (!isConnected || !accessibleAccounts.length) {
      setReviews([]);
      setLoading(false);
      return;
    }

    if (isRefresh) {
      setRefreshing(true);
    } else {
      setLoading(true);
    }
    
    try {
      console.log('Reviews: Fetching reviews across all profiles (PARALLEL LOADING)');
      
      // Create all location tasks for parallel execution (only accessible accounts)
      const locationTasks = accessibleAccounts.flatMap(account =>
        account.locations.map(location => ({
          account,
          location,
          task: async () => {
            try {
              console.log(`📍 Frontend: Processing location - Name: "${location.displayName}", ID: "${location.locationId}"`);
              
              // Add timeout to prevent individual locations from hanging
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout per location
              
              const locationReviews = await googleBusinessProfileService.getLocationReviews(location.name, { forceRefresh: isRefresh });
              clearTimeout(timeoutId);
              
              console.log(`📍 Frontend: Received ${locationReviews.length} reviews for ${location.displayName}`);
              
              // Convert BusinessReview to Review format with sentiment analysis
              const convertedReviews: Review[] = locationReviews.map(review => {
                const reviewData = {
                  id: review.id,
                  profileId: location.locationId,
                  profileName: location.displayName,
                  fullReviewName: review.name,
                  author: review.reviewer.displayName,
                  rating: review.starRating,
                  content: review.comment || '',
                  createdAt: review.createTime,
                  replied: !!review.reply,
                  replyContent: review.reply?.comment,
                  repliedAt: review.reply?.updateTime,
                  sentiment: analyzeSentiment(review.starRating, review.comment || '')
                };
                return reviewData;
              });
              
              return convertedReviews;
            } catch (error) {
              console.warn(`⚠️ Failed to fetch reviews for ${location.displayName}:`, error);
              return []; // Return empty array instead of failing completely
            }
          }
        }))
      );
      
      console.log(`🚀 Starting parallel loading of reviews for ${locationTasks.length} locations`);
      const startTime = Date.now();
      
      // Execute all tasks in parallel with a global timeout
      const reviewPromises = locationTasks.map(({ task }) => task());
      const reviewsArrays = await Promise.allSettled(reviewPromises);
      
      // Collect all successful results
      const allReviews: Review[] = [];
      reviewsArrays.forEach((result, index) => {
        if (result.status === 'fulfilled') {
          allReviews.push(...result.value);
        } else {
          console.warn(`Location ${index} failed:`, result.reason);
        }
      });
      
      const loadTime = Date.now() - startTime;
      console.log(`✅ Parallel loading completed in ${loadTime}ms: Loaded ${allReviews.length} reviews from ${locationTasks.length} locations`);
      setReviews(allReviews);
    } catch (error) {
      console.error("Error fetching reviews:", error);
      setReviews([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    // Always start with loading state
    setLoading(true);
    fetchReviews();
  }, [accessibleAccounts, isConnected, googleLoading]);

  // Auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      if (isConnected && accessibleAccounts.length) {
        fetchReviews(true);
      }
    }, 5 * 60 * 1000); // 5 minutes

    return () => clearInterval(interval);
  }, [isConnected, accessibleAccounts]);

  const handleAutoReply = async (reviewId: string) => {
    const review = reviews.find(r => r.id === reviewId);
    if (!review) return;

    setSelectedReview(review);
    setCustomReply('');
    setAiSuggestions([]);
    setReplyDialogOpen(true);

    // Auto-generate AI suggestions immediately
    generateAISuggestions(review);
  };

  const handleSendReply = async () => {
    if (!selectedReview || !customReply.trim()) return;
    
    setReplyLoading(true);
    try {
      console.log("Sending reply to review:", selectedReview.id);
      
      // Reply to the review using Google Business Profile API
      // Use the full review name if available, otherwise construct it  
      const fullReviewName = selectedReview.fullReviewName || `accounts/106433552101751461082/locations/${selectedReview.profileId}/reviews/${selectedReview.id}`;
      
      console.log('Reviews: Sending reply with full review name:', fullReviewName);
      await googleBusinessProfileService.replyToReview(fullReviewName, customReply);
      
      // Update the review state to show it's been replied to
      setReviews(prev => prev.map(r => 
        r.id === selectedReview.id 
          ? { 
              ...r, 
              replied: true, 
              replyContent: customReply,
              repliedAt: new Date().toISOString()
            }
          : r
      ));
      
      // Close dialog and reset state
      setReplyDialogOpen(false);
      setSelectedReview(null);
      setCustomReply('');
      setAiSuggestions([]);
      
      console.log('Reply sent successfully!');
    } catch (error) {
      console.error('Error replying to review:', error);
      alert('Failed to send reply. Please try again.');
    } finally {
      setReplyLoading(false);
    }
  };


  // Generate AI-powered reply suggestions
  const generateAISuggestions = async (review: Review) => {
    if (!review) return;

    setLoadingSuggestions(true);
    setAiSuggestions([]);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';
      const response = await fetch(`${backendUrl}/api/ai-reviews/reply-suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          businessName: review.profileName,
          reviewContent: review.content,
          reviewRating: review.rating,
          reviewId: review.id,
          userId: currentUser?.email || currentUser?.uid
        }),
      });

      if (!response.ok) throw new Error('AI service error');

      const data = await response.json();
      if (data.success && data.suggestions) {
        const suggestions = data.suggestions.map((s: any) => s.text || s.reply || s).slice(0, 3);
        setAiSuggestions(suggestions);
      }
    } catch (error) {
      console.error('Error generating AI suggestions:', error);
      setAiSuggestions([]);
    } finally {
      setLoadingSuggestions(false);
    }
  };


  // Copy suggestion to clipboard
  const copySuggestionToClipboard = async (suggestion: string, index: number) => {
    try {
      await navigator.clipboard.writeText(suggestion);
      setCopiedSuggestionIndex(index);
      setTimeout(() => setCopiedSuggestionIndex(null), 2000);
    } catch (err) {
      console.error('Failed to copy suggestion:', err);
      // Fallback for older browsers
      const textArea = document.createElement('textarea');
      textArea.value = suggestion;
      document.body.appendChild(textArea);
      textArea.select();
      document.execCommand('copy');
      document.body.removeChild(textArea);
      setCopiedSuggestionIndex(index);
      setTimeout(() => setCopiedSuggestionIndex(null), 2000);
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

  // Enhanced filtering logic
  const filteredAndSortedReviews = useMemo(() => {
    let filtered = reviews.filter(review => {
      const matchesSearch = review.content.toLowerCase().includes(filters.search.toLowerCase()) ||
                           review.author.toLowerCase().includes(filters.search.toLowerCase()) ||
                           review.profileName.toLowerCase().includes(filters.search.toLowerCase());
      
      const matchesRating = filters.rating === "all" || review.rating.toString() === filters.rating;
      
      const matchesReply = filters.reply === "all" || 
                          (filters.reply === "replied" && review.replied) ||
                          (filters.reply === "not-replied" && !review.replied);
      
      const matchesLocation = filters.location === "all" || review.profileName === filters.location;
      
      const matchesSentiment = filters.sentiment === "all" || review.sentiment === filters.sentiment;
      
      // Date range filtering
      let matchesDate = true;
      if (filters.dateRange !== "all") {
        const reviewDate = new Date(review.createdAt);
        const now = new Date();
        const daysDiff = (now.getTime() - reviewDate.getTime()) / (1000 * 3600 * 24);
        
        switch (filters.dateRange) {
          case "7d":
            matchesDate = daysDiff <= 7;
            break;
          case "30d":
            matchesDate = daysDiff <= 30;
            break;
          case "90d":
            matchesDate = daysDiff <= 90;
            break;
          case "1y":
            matchesDate = daysDiff <= 365;
            break;
        }
      }
      
      return matchesSearch && matchesRating && matchesReply && matchesLocation && matchesSentiment && matchesDate;
    });

    // Sorting
    filtered.sort((a, b) => {
      const direction = sortConfig.direction === 'asc' ? 1 : -1;
      
      switch (sortConfig.field) {
        case 'date':
          return direction * (new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
        case 'rating':
          return direction * (a.rating - b.rating);
        case 'author':
          return direction * a.author.localeCompare(b.author);
        default:
          return 0;
      }
    });

    return filtered;
  }, [reviews, filters, sortConfig]);

  // Enhanced statistics
  const stats = useMemo(() => {
    const total = reviews.length;
    const replied = reviews.filter(r => r.replied).length;
    const needReply = total - replied;
    
    const ratingCounts = {
      all: total,
      5: reviews.filter(r => r.rating === 5).length,
      4: reviews.filter(r => r.rating === 4).length,
      3: reviews.filter(r => r.rating === 3).length,
      2: reviews.filter(r => r.rating === 2).length,
      1: reviews.filter(r => r.rating === 1).length,
    };
    
    const avgRating = total > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / total : 0;
    
    const sentimentCounts = {
      positive: reviews.filter(r => r.sentiment === 'positive').length,
      neutral: reviews.filter(r => r.sentiment === 'neutral').length,
      negative: reviews.filter(r => r.sentiment === 'negative').length,
    };
    
    const locations = Array.from(new Set(reviews.map(r => r.profileName)));
    
    return {
      total,
      replied,
      needReply,
      ratingCounts,
      avgRating,
      sentimentCounts,
      locations
    };
  }, [reviews]);

  // Utility functions
  const handleRefresh = () => {
    fetchReviews(true);
  };

  const handleSort = (field: SortConfig['field']) => {
    setSortConfig(prev => ({
      field,
      direction: prev.field === field && prev.direction === 'desc' ? 'asc' : 'desc'
    }));
  };

  const updateFilter = (key: keyof ReviewFilters, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const getSentimentIcon = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return <Heart className="h-3 w-3 text-green-500" />;
      case 'negative': return <Frown className="h-3 w-3 text-red-500" />;
      default: return <Meh className="h-3 w-3 text-yellow-500" />;
    }
  };

  const getSentimentColor = (sentiment: string) => {
    switch (sentiment) {
      case 'positive': return 'text-green-600 bg-green-50 border-green-200';
      case 'negative': return 'text-red-600 bg-red-50 border-red-200';
      default: return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    }
  };

  // Export functionality
  const exportReviews = (format: 'csv' | 'json') => {
    const dataToExport = filteredAndSortedReviews.map(review => ({
      Author: review.author,
      Rating: review.rating,
      Review: review.content,
      Location: review.profileName,
      Date: formatDate(review.createdAt),
      Replied: review.replied ? 'Yes' : 'No',
      Reply: review.replyContent || '',
      Sentiment: review.sentiment || 'neutral'
    }));

    if (format === 'csv') {
      const headers = Object.keys(dataToExport[0] || {});
      const csvContent = [
        headers.join(','),
        ...dataToExport.map(row => 
          headers.map(header => `"${String(row[header as keyof typeof row]).replace(/"/g, '""')}"`).join(',')
        )
      ].join('\n');
      
      const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reviews_export_${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
    } else {
      const jsonContent = JSON.stringify(dataToExport, null, 2);
      const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = `reviews_export_${new Date().toISOString().split('T')[0]}.json`;
      link.click();
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">Reviews</h1>
          <p className="text-sm sm:text-base text-muted-foreground mt-1">
            Manage customer reviews across all your business profiles
          </p>
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
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-3 sm:gap-4">
        <Card className="shadow-card border border-blue-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold">{stats.total}</div>
            <p className="text-xs text-muted-foreground">Total Reviews</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 fill-yellow-400 text-yellow-400" />
              <div className="text-2xl font-bold">{stats.avgRating.toFixed(1)}</div>
            </div>
            <p className="text-xs text-muted-foreground">Average Rating</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border border-blue-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-green-600">{stats.replied}</div>
            <p className="text-xs text-muted-foreground">Replied</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border border-blue-200">
          <CardContent className="pt-6">
            <div className="text-2xl font-bold text-orange-600">{stats.needReply}</div>
            <p className="text-xs text-muted-foreground">Need Reply</p>
          </CardContent>
        </Card>

        <Card className="shadow-card border border-blue-200">
          <CardContent className="pt-6">
            <div className="flex items-center gap-1">
              {getSentimentIcon('positive')}
              <div className="text-2xl font-bold">{stats.sentimentCounts.positive}</div>
            </div>
            <p className="text-xs text-muted-foreground">Positive</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      <Card className="shadow-card border border-blue-200">
        <CardContent className="pt-6">
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 justify-between">
            <div className="flex flex-col sm:flex-row gap-3">
              <Select value={filters.location} onValueChange={(value) => updateFilter('location', value)}>
                <SelectTrigger className="w-full sm:w-64 border-blue-200">
                  <Filter className="mr-2 h-4 w-4 text-blue-600" />
                  <SelectValue placeholder="All Locations" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="font-semibold">All Locations</SelectItem>
                  {stats.locations.map(location => (
                    <SelectItem key={location} value={location}>{location}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filters.reply} onValueChange={(value) => updateFilter('reply', value)}>
                <SelectTrigger className="w-full sm:w-48 border-blue-200">
                  <MessageSquare className="mr-2 h-4 w-4 text-blue-600" />
                  <SelectValue placeholder="All Reviews" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Reviews</SelectItem>
                  <SelectItem value="replied">Replied</SelectItem>
                  <SelectItem value="not-replied">Need Reply</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Button
              variant="outline"
              size="sm"
              onClick={handleRefresh}
              disabled={refreshing}
              className="border-blue-200"
            >
              <RefreshCw className={cn("mr-2 h-4 w-4", refreshing && "animate-spin")} />
              Refresh
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      <Card className="shadow-card border border-blue-200">
        <CardHeader className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-2 border-b border-blue-100 bg-gradient-to-r from-blue-50 to-indigo-50">
          <CardTitle className="text-lg sm:text-xl text-blue-900">All Reviews ({filteredAndSortedReviews.length})</CardTitle>
          <div className="flex items-center gap-2">
            {refreshing && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <RefreshCw className="h-4 w-4 animate-spin" />
                Updating...
              </div>
            )}
            {filteredAndSortedReviews.length > 0 && (
              <Badge variant="outline" className="text-xs">
                Showing {filteredAndSortedReviews.length} of {stats.total} reviews
              </Badge>
            )}
          </div>
        </CardHeader>
        
        <CardContent>
          {loading ? (
            <div className="space-y-6">
              {Array.from({ length: 4 }).map((_, index) => (
                <div key={index} className="border border-border rounded-lg p-4 shadow-sm animate-pulse">
                  <div className="flex gap-4">
                    <div className="h-10 w-10 bg-muted rounded-full"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-muted rounded w-1/4"></div>
                      <div className="h-3 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-3/4"></div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAndSortedReviews.length === 0 ? (
            <div className="text-center py-12">
              <Star className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">
                {Object.values(filters).some(f => f !== 'all' && f !== '') ? "No reviews found" : "No reviews yet"}
              </h3>
              <p className="text-muted-foreground">
                {Object.values(filters).some(f => f !== 'all' && f !== '') 
                  ? "Try adjusting your search or filters"
                  : "Customer reviews will appear here once you receive them"
                }
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              {filteredAndSortedReviews.map((review, index) => (
                <div key={review.id} className="border-2 border-blue-200 rounded-lg p-3 sm:p-4 shadow-sm hover:border-blue-300 hover:shadow-md transition-all duration-200 bg-white">
                  <div className="flex gap-3 sm:gap-4">
                    <Avatar className="h-8 w-8 sm:h-10 sm:w-10 flex-shrink-0">
                      <AvatarFallback className="bg-primary/10 text-primary text-xs sm:text-sm">
                        {getInitials(review.author)}
                      </AvatarFallback>
                    </Avatar>
                    
                    <div className="flex-1 space-y-3 min-w-0">
                      {/* Review Header */}
                      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-1">
                            <h4 className="font-medium text-sm sm:text-base truncate">{review.author}</h4>
                            <div className="flex items-center gap-2 flex-wrap">
                              <div className="flex items-center gap-1">
                                {renderStars(review.rating)}
                              </div>
                              <span className="inline-flex items-center px-2.5 py-1 rounded-md bg-blue-50 text-blue-700 text-xs font-medium border border-blue-200 truncate max-w-[150px]">
                                {review.profileName}
                              </span>
                              {review.sentiment && (
                                <Badge variant="outline" className={cn("text-xs hidden sm:flex", getSentimentColor(review.sentiment))}>
                                  <div className="flex items-center gap-1">
                                    {getSentimentIcon(review.sentiment)}
                                    {review.sentiment}
                                  </div>
                                </Badge>
                              )}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <Calendar className="h-3 w-3" />
                            {formatDate(review.createdAt)}
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 flex-shrink-0">
                          {review.replied && (
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => {
                                      setSelectedReview(review);
                                      setCustomReply(review.replyContent || '');
                                      setAiSuggestions([]);
                                      setReplyDialogOpen(true);
                                      generateAISuggestions(review);
                                    }}
                                    className="h-8 w-8 p-0"
                                  >
                                    <Edit2 className="h-3 w-3" />
                                  </Button>
                                </TooltipTrigger>
                                <TooltipContent>Edit Reply</TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          )}
                          
                          {!review.replied && (
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleAutoReply(review.id)}
                              className="gap-1 px-2 sm:px-3 text-xs sm:text-sm"
                            >
                              <Bot className="h-3 w-3" />
                              <span className="hidden sm:inline">Reply</span>
                            </Button>
                          )}
                        </div>
                      </div>
                      
                      {/* Review Content */}
                      <p className="text-sm leading-relaxed break-words">{review.content}</p>
                      
                      {/* Reply */}
                      {review.replied && review.replyContent && (
                        <div className="bg-muted/50 rounded-lg p-3 ml-2 sm:ml-4 border-l-2 border-primary/20">
                          <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-2 mb-2">
                            <div className="flex items-center gap-2">
                              <MessageSquare className="h-3 w-3 text-primary" />
                              <span className="text-xs font-medium text-primary">Your Reply</span>
                            </div>
                            {review.repliedAt && (
                              <span className="text-xs text-muted-foreground">
                                {formatDate(review.repliedAt)}
                              </span>
                            )}
                          </div>
                          <p className="text-sm break-words">{review.replyContent}</p>
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

      {/* Custom Reply Dialog */}
      <Dialog open={replyDialogOpen} onOpenChange={setReplyDialogOpen}>
        <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl">Reply to Review</DialogTitle>
            <DialogDescription>
              {selectedReview && (
                <div className="space-y-2">
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <span className="font-medium text-sm sm:text-base">{selectedReview.author}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1">
                        {renderStars(selectedReview.rating)}
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {selectedReview.profileName}
                      </Badge>
                    </div>
                  </div>
                  <p className="text-sm text-muted-foreground italic break-words">"{selectedReview.content}"</p>
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            {/* AI Suggestions - always shown, auto-generated */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium flex items-center gap-2">
                  <Bot className="h-4 w-4 text-primary" />
                  AI-Generated Replies
                </label>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => selectedReview && generateAISuggestions(selectedReview)}
                  disabled={loadingSuggestions}
                  className="text-xs h-7 gap-1"
                >
                  <RefreshCw className={`h-3 w-3 ${loadingSuggestions ? 'animate-spin' : ''}`} />
                  Regenerate
                </Button>
              </div>

              {loadingSuggestions ? (
                <div className="flex items-center justify-center py-8 text-muted-foreground gap-2">
                  <RefreshCw className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Reading review and generating personalized replies...</span>
                </div>
              ) : aiSuggestions.length > 0 ? (
                <div className="space-y-2 max-h-52 overflow-y-auto">
                  {aiSuggestions.map((suggestion, index) => (
                    <div
                      key={`suggestion-${index}-${selectedReview?.id}`}
                      className="p-3 border rounded-lg hover:bg-muted/50 transition-colors group cursor-pointer"
                      onClick={() => setCustomReply(suggestion)}
                    >
                      <div className="flex gap-2">
                        <p className="text-sm flex-1 leading-relaxed">{suggestion}</p>
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); copySuggestionToClipboard(suggestion, index); }}
                            className="h-8 w-8 p-0"
                            title="Copy to clipboard"
                          >
                            {copiedSuggestionIndex === index ? (
                              <Check className="h-3 w-3 text-green-600" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => { e.stopPropagation(); setCustomReply(suggestion); }}
                            className="h-8 w-8 p-0"
                            title="Use this reply"
                          >
                            <Send className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="flex items-center justify-center py-6 text-muted-foreground text-sm border rounded-lg border-dashed">
                  AI replies could not be generated. You can type a custom reply below.
                </div>
              )}
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">
                Your Reply <span className="text-muted-foreground font-normal text-xs">(click a suggestion above to use it, or type your own)</span>
              </label>
              <Textarea
                placeholder="Click an AI suggestion above to use it, or write your own reply..."
                value={customReply}
                onChange={(e) => setCustomReply(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex justify-between items-center mt-1">
                <p className="text-xs text-muted-foreground">
                  {customReply.length}/4000 characters
                </p>
                {customReply && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setCustomReply('')}
                    className="text-xs h-6"
                  >
                    Clear
                  </Button>
                )}
              </div>
            </div>
          </div>
          
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setReplyDialogOpen(false);
                setSelectedReview(null);
                setCustomReply('');
                setAiSuggestions([]);
                setCopiedSuggestionIndex(null);
              }}
            >
              <X className="w-4 h-4 mr-2" />
              Cancel
            </Button>
            <Button
              onClick={handleSendReply}
              disabled={!customReply.trim() || replyLoading}
              className="gap-2"
            >
              {replyLoading ? (
                <RefreshCw className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              {selectedReview?.replied ? 'Update Reply' : 'Send Reply'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reviews;