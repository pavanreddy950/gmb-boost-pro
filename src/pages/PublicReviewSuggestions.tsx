import { useState, useEffect } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  Star, 
  MessageSquare, 
  Copy, 
  Check,
  ExternalLink,
  MapPin,
  Sparkles,
  ArrowDown,
  Building2
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIReview {
  id: string;
  review: string;
  rating: number;
  focus: string;
  length: string;
}

const PublicReviewSuggestions = () => {
  const { toast } = useToast();
  const [searchParams] = useSearchParams();
  const businessName = searchParams.get('business') || 'Business';
  const location = searchParams.get('location') || 'Location';
  const placeId = searchParams.get('placeId') || '';
  
  const [aiReviews, setAiReviews] = useState<AIReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedReview, setCopiedReview] = useState<string | null>(null);
  const [showArrow, setShowArrow] = useState(true);
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net';
  
  useEffect(() => {
    fetchAIReviews();
    
    // Hide arrow after user scrolls
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowArrow(false);
      }
    };
    
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);
  
  const fetchAIReviews = async () => {
    try {
      console.log('Fetching AI reviews with:', {
        businessName: decodeURIComponent(businessName),
        location: decodeURIComponent(location),
        rawLocation: location,
        backendUrl: backendUrl
      });
      
      const response = await fetch(`${backendUrl}/api/ai-reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessName: decodeURIComponent(businessName),
          location: decodeURIComponent(location),
          businessType: 'business'
        })
      });
      
      console.log('AI reviews response status:', response.status);
      
      if (response.ok) {
        const data = await response.json();
        console.log('AI reviews data received:', data);
        setAiReviews(data.suggestions || []);
      } else {
        const errorText = await response.text();
        console.error('AI reviews error response:', errorText);
        // Use fallback reviews if API fails
        setAiReviews(getFallbackReviews());
      }
    } catch (error) {
      console.error('Error fetching AI reviews:', error);
      // Use fallback reviews on network error
      setAiReviews(getFallbackReviews());
    } finally {
      setLoading(false);
    }
  };
  
  const getFallbackReviews = () => {
    const businessNameDecoded = decodeURIComponent(businessName);
    const locationDecoded = decodeURIComponent(location);
    const locationPhrase = locationDecoded && locationDecoded !== 'Location' ? ` in ${locationDecoded}` : '';
    
    return [
      {
        id: 'fallback_1',
        review: `Had an amazing experience at ${businessNameDecoded}${locationPhrase}! The service was exceptional and the staff went above and beyond to ensure customer satisfaction. Highly recommend!`,
        rating: 5,
        focus: 'service',
        length: 'medium'
      },
      {
        id: 'fallback_2',
        review: `${businessNameDecoded} provides excellent quality and value. Professional team, quick service, and attention to detail. Will definitely be returning!`,
        rating: 5,
        focus: 'quality',
        length: 'short'
      },
      {
        id: 'fallback_3',
        review: `Very impressed with ${businessNameDecoded}${locationPhrase}. From start to finish, everything was handled professionally. The team is knowledgeable, friendly, and delivers great results. Couldn't be happier with the experience!`,
        rating: 5,
        focus: 'experience',
        length: 'long'
      }
    ];
  };
  
  const copyReviewToClipboard = async (review: string, reviewId: string) => {
    try {
      await navigator.clipboard.writeText(review);
      setCopiedReview(reviewId);
      toast({
        title: "Review Copied!",
        description: "You can now paste this review on Google.",
      });
      
      setTimeout(() => setCopiedReview(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy. Please try selecting and copying manually.",
        variant: "destructive"
      });
    }
  };
  
  const redirectToGoogleReviews = () => {
    // Check if we have the actual Google review link from the URL params
    const googleReviewLink = searchParams.get('googleReviewLink');
    
    if (googleReviewLink && googleReviewLink !== 'undefined' && googleReviewLink !== '') {
      // We have the actual review link, use it directly
      const decodedLink = decodeURIComponent(googleReviewLink);
      console.log('Redirecting to actual Google review link:', decodedLink);
      window.open(decodedLink, '_blank');
    } else {
      // No review link provided
      toast({
        title: "Review Link Not Available",
        description: "Please contact the business for their review link.",
        variant: "destructive"
      });
    }
  };
  
  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <Star 
        key={index} 
        className={`h-5 w-5 ${
          index < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`} 
      />
    ));
  };
  
  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white">
      {/* Header */}
      <div className="bg-white shadow-sm border-b sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Building2 className="h-8 w-8 text-primary" />
              <div>
                <h1 className="text-xl font-bold">{decodeURIComponent(businessName)}</h1>
                <div className="flex items-center gap-1 text-sm text-muted-foreground">
                  <MapPin className="h-3 w-3" />
                  <span>{decodeURIComponent(location)}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      {/* Hero Section */}
      <div className="container mx-auto px-4 py-8">
        <Card className="bg-gradient-to-r from-primary to-blue-600 text-white border-0">
          <CardContent className="p-8 text-center">
            <Sparkles className="h-12 w-12 mx-auto mb-4" />
            <h2 className="text-3xl font-bold mb-4">
              Share Your Experience!
            </h2>
            <p className="text-lg mb-6 opacity-90">
              Your feedback helps us improve and helps others discover our business.
              Choose a review suggestion below or write your own!
            </p>
            {showArrow && (
              <div className="animate-bounce mt-4">
                <ArrowDown className="h-8 w-8 mx-auto" />
              </div>
            )}
          </CardContent>
        </Card>
      </div>
      
      {/* AI Review Suggestions */}
      <div className="container mx-auto px-4 pb-8">
        <div className="mb-6">
          <h3 className="text-2xl font-bold mb-2">Review Suggestions</h3>
          <p className="text-muted-foreground">
            Click on any suggestion to copy it, then paste it in your Google review
          </p>
        </div>
        
        {loading ? (
          <div className="space-y-4">
            {Array.from({ length: 3 }).map((_, i) => (
              <Card key={i} className="animate-pulse">
                <CardContent className="p-6">
                  <div className="h-4 bg-muted rounded w-1/4 mb-3" />
                  <div className="h-3 bg-muted rounded w-full mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {aiReviews.map((review) => (
              <Card 
                key={review.id} 
                className="hover:shadow-lg transition-all cursor-pointer border-2 hover:border-primary/50"
                onClick={() => copyReviewToClipboard(review.review, review.id)}
              >
                <CardContent className="p-6">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex items-center gap-3">
                      {renderStars(review.rating)}
                      <Badge variant="secondary">
                        {review.focus}
                      </Badge>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      className="hover:bg-transparent"
                      onClick={(e) => {
                        e.stopPropagation();
                        copyReviewToClipboard(review.review, review.id);
                      }}
                    >
                      {copiedReview === review.id ? (
                        <Check className="h-5 w-5 text-green-500" />
                      ) : (
                        <Copy className="h-5 w-5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-gray-700 leading-relaxed">{review.review}</p>
                  {copiedReview === review.id && (
                    <div className="mt-3 p-2 bg-green-50 rounded-md">
                      <p className="text-sm text-green-700 font-medium">
                        ✓ Copied! Now click "Write Review on Google" below
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
      
      {/* Sticky Bottom CTA */}
      <div className="sticky bottom-0 bg-white border-t shadow-lg">
        <div className="container mx-auto px-4 py-4">
          <Button
            onClick={redirectToGoogleReviews}
            size="lg"
            className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90 text-lg py-6"
          >
            <MessageSquare className="mr-2 h-5 w-5" />
            Write Review on Google
            <ExternalLink className="ml-2 h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

export default PublicReviewSuggestions;