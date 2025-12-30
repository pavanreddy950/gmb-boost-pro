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
  Building2,
  RefreshCw
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface AIReview {
  id: string;
  review: string;
  rating: number;
  focus: string;
  length: string;
  keywords?: string[];
}

const PublicReviewSuggestions = () => {
  const { toast } = useToast();
  const { locationId } = useParams<{ locationId: string }>();
  const [searchParams] = useSearchParams();
  
  // QR Code data state
  const [qrCodeData, setQrCodeData] = useState<any>(null);
  const [qrCodeLoading, setQrCodeLoading] = useState(true);
  
  // Fallback to URL parameters if QR data not available
  const businessName = qrCodeData?.locationName || searchParams.get('business') || 'Business';
  const location = qrCodeData?.address || searchParams.get('location') || 'Location';
  const placeId = qrCodeData?.placeId || searchParams.get('placeId') || '';
  const googleReviewLink = qrCodeData?.googleReviewLink || searchParams.get('googleReviewLink') || '';
  
  // Debug URL parameters on page load
  console.log('🔍 PUBLIC REVIEW PAGE LOADED:');
  console.log('🔍 Full URL:', window.location.href);
  console.log('🔍 Location ID from params:', locationId);
  console.log('🔍 Search params string:', window.location.search);
  console.log('🔍 Business Name:', businessName);
  console.log('🔍 Location:', location);
  console.log('🔍 Google Review Link:', googleReviewLink);
  console.log('🔍 All URL parameters:');
  searchParams.forEach((value, key) => {
    console.log(`  ${key}: ${value}`);
  });
  
  // Add a visible debug message for testing
  const isDebugMode = window.location.hostname === 'localhost';
  
  const [aiReviews, setAiReviews] = useState<AIReview[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedReview, setCopiedReview] = useState<string | null>(null);
  const [showArrow, setShowArrow] = useState(true);
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';
  
  // Fetch QR code data from backend with timeout
  const fetchQRCodeData = async () => {
    if (!locationId) {
      console.log('🔍 No location ID provided, using URL parameters only');
      setQrCodeLoading(false);
      return null;
    }

    try {
      console.log('🔍 Fetching QR code data for location:', locationId);

      // Add timeout for QR code data fetch
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 second timeout

      const response = await fetch(`${backendUrl}/api/qr-codes/${locationId}`, {
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ QR code data received:', data);
        console.log('🔑 Keywords in QR code:', data.qrCode?.keywords || 'NONE');
        setQrCodeData(data.qrCode);
        return data.qrCode; // Return QR code data
      } else {
        console.log('⚠️ QR code not found, using URL parameters as fallback');
        return null;
      }
    } catch (error) {
      console.log('⚠️ Error fetching QR code data (using fallback):', error.message);
      return null;
    } finally {
      setQrCodeLoading(false);
    }
  };

  useEffect(() => {
    // Fetch QR code data first, then AI reviews (so keywords are available)
    const initializeData = async () => {
      const qrData = await fetchQRCodeData();
      // Pass QR data directly to avoid state timing issues
      await fetchAIReviews(qrData);
    };

    initializeData();

    // Hide arrow after user scrolls
    const handleScroll = () => {
      if (window.scrollY > 100) {
        setShowArrow(false);
      }
    };

    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, [locationId]);
  
  const fetchAIReviews = async (passedQrData: any = null) => {
    // Keep loading state while fetching AI reviews
    setLoading(true);

    try {
      console.log('🤖 Fetching AI-generated reviews from Azure OpenAI...');

      // Use passed QR data or fallback to state (for regenerate button)
      const dataToUse = passedQrData || qrCodeData;

      console.log('🔍 QR Code Data available:', dataToUse ? 'YES' : 'NO');

      // Get keywords from QR code data if available
      const keywords = dataToUse?.keywords || '';

      console.log('🔑 KEYWORDS FROM QR CODE DATA:', keywords);
      console.log('🔍 QR Code Data object:', JSON.stringify(dataToUse, null, 2));

      // Get business category from QR code data or URL parameters
      const businessCategory = dataToUse?.businessCategory || searchParams.get('category') || null;

      console.log(`🎯 Generating AI reviews with category: ${businessCategory || 'default'}`);
      console.log(`🔑 Keywords being sent to API: "${keywords}"`);

      if (!keywords || keywords.trim() === '') {
        console.warn('⚠️ WARNING: No keywords found! Keywords should come from automation settings.');
        console.warn('⚠️ Make sure you regenerated the QR code after setting up keywords in autoposting.');
      } else {
        console.log(`✅ Keywords found and will be used: "${keywords}"`);
      }

      // Longer timeout to allow Azure OpenAI to generate unique reviews (10 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 10000); // 10 second timeout

      const response = await fetch(`${backendUrl}/api/ai-reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessName: decodeURIComponent(businessName),
          location: decodeURIComponent(location),
          businessType: 'business',
          keywords: keywords, // Pass keywords for AI to use
          reviewId: `qr_${locationId}_${Date.now()}`, // Unique ID for each scan
          businessCategory: businessCategory // Pass business category for category-specific reviews
        }),
        signal: controller.signal
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        console.log('✅ AI reviews loaded successfully:', data.suggestions?.length, 'reviews');
        setAiReviews(data.suggestions || getFallbackReviews());
      } else {
        console.log('❌ AI reviews API failed, using fallback');
        setAiReviews(getFallbackReviews());
      }
    } catch (error: any) {
      console.log('❌ AI reviews error:', error.message);
      // Only use fallback if AI fails
      setAiReviews(getFallbackReviews());
    } finally {
      setLoading(false);
    }
  };
  
  // Fallback reviews for when AI service is unavailable
  // ⚠️ CRITICAL: Return EXACTLY 3 reviews to match AI service output
  const getFallbackReviews = (): AIReview[] => {
    const cleanBusinessName = decodeURIComponent(businessName);
    const cleanLocation = decodeURIComponent(location);
    const locationText = cleanLocation && cleanLocation !== 'Location' ? ` in ${cleanLocation}` : '';

    return [
      {
        id: 'fallback_1',
        review: `Great experience at ${cleanBusinessName}${locationText}! The service was excellent and the staff was very professional. I would definitely recommend this business to others. Thank you for the wonderful service!`,
        rating: 5,
        focus: 'service',
        length: 'medium',
        keywords: ['service', 'professional', 'recommend']
      },
      {
        id: 'fallback_2',
        review: `${cleanBusinessName} provided exactly what I was looking for. The quality was outstanding and the attention to detail was impressive. Will definitely be returning as a satisfied customer.`,
        rating: 4,
        focus: 'quality',
        length: 'medium',
        keywords: ['quality', 'outstanding', 'satisfied']
      },
      {
        id: 'fallback_3',
        review: `Highly recommend ${cleanBusinessName}${locationText}! The team was friendly, knowledgeable, and went above and beyond to help. Excellent customer service all around.`,
        rating: 5,
        focus: 'staff',
        length: 'medium',
        keywords: ['friendly', 'knowledgeable', 'customer service']
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
    console.log('🚀 BUTTON CLICKED: Write Review on Google button clicked!');
    console.log('🔍 QR Code Data:', qrCodeData);
    console.log('🔍 Google review link from QR data:', qrCodeData?.googleReviewLink);
    console.log('🔍 Google review link from URL params:', searchParams.get('googleReviewLink'));
    console.log('🔍 Final googleReviewLink being used:', googleReviewLink);
    
    if (googleReviewLink && googleReviewLink !== 'undefined' && googleReviewLink !== '' && googleReviewLink !== 'null') {
      try {
        let finalLink = googleReviewLink;
        
        // If the link comes from QR data, it should already be properly formatted
        if (qrCodeData && qrCodeData.googleReviewLink) {
          console.log('✅ Using Google review link from QR code data (no decoding needed)');
          finalLink = qrCodeData.googleReviewLink;
        } else {
          // If it comes from URL parameters, we need to decode it
          console.log('🔄 Using Google review link from URL params (decoding needed)');
          try {
            finalLink = decodeURIComponent(googleReviewLink);
            
            // If it's double-encoded, decode again
            if (finalLink.includes('%2F') || finalLink.includes('%3A')) {
              try {
                finalLink = decodeURIComponent(finalLink);
              } catch (decodeError) {
                console.error('❌ Second decodeURIComponent failed:', decodeError);
              }
            }
          } catch (decodeError) {
            console.error('❌ decodeURIComponent failed:', decodeError);
            console.error('❌ Raw googleReviewLink causing error:', googleReviewLink);
            toast({
              title: "Invalid Review Link", 
              description: "The review link appears to be truncated. Please try generating a new QR code.",
              variant: "destructive"
            });
            return;
          }
        }
        
        console.log('🎯 Final Google review link (before processing):', finalLink);
      
        // ========================================
        // CRITICAL FIX: Convert ANY Google Maps link to review format
        // ========================================
        
        // Check if this is a Google Maps location link (not already a review link)
        const isGoogleMapsLink = finalLink.includes('google.com/maps') || 
                                 finalLink.includes('maps.google.com') ||
                                 finalLink.includes('goo.gl/maps');
        
        const isAlreadyReviewLink = finalLink.includes('writereview') || 
                                     (finalLink.includes('g.page/r/') && finalLink.includes('/review'));
        
        if (isGoogleMapsLink && !isAlreadyReviewLink) {
          console.log('🔧 Detected Google Maps location link, converting to review link...');
          
          // CRITICAL: Check if this is a generic search link (has no Place ID/CID)
          if (finalLink.includes('maps/search/?api=1&query=')) {
            console.log('⚠️ Detected generic search link - checking for Place ID parameter...');
            
            // Try to get Place ID from URL parameters
            const placeIdParam = searchParams.get('placeId');
            if (placeIdParam && placeIdParam.startsWith('ChIJ')) {
              finalLink = `https://search.google.com/local/writereview?placeid=${placeIdParam}`;
              console.log('🔧 Converted search link to writereview using placeId parameter:', finalLink);
            } else {
              // No Place ID available - we cannot convert this
              console.error('❌ Generic search link with no Place ID - cannot convert to review link');
              console.error('❌ This will open a search page, not a review page');
              
              // Show user-friendly error with search link option
              toast({
                title: "Review Link Unavailable",
                description: "The direct review link is not available. Opening Google search instead to find this business.",
                variant: "default"
              });
              
              // Fallback: Open Google Maps search as best alternative
              console.log('🔄 Falling back to Google Maps search link:', finalLink);
              window.open(finalLink, '_blank');
              return;
            }
          } else {
            // Not a search link, try to extract Place ID or CID from actual maps link
            const placeIdMatch = finalLink.match(/place\/(ChIJ[A-Za-z0-9_-]+)/);
            if (placeIdMatch) {
              const placeId = placeIdMatch[1];
              finalLink = `https://search.google.com/local/writereview?placeid=${placeId}`;
              console.log('🔧 Converted using Place ID to writereview format:', finalLink);
            } 
            // Try to extract CID
            else {
              const cidMatch = finalLink.match(/cid=(\d+)/);
              if (cidMatch) {
                const cid = cidMatch[1];
                console.log('🔧 Found CID in maps link:', cid);
                
                // Convert CID to g.page format
                try {
                  const hexCid = BigInt(cid).toString(16).toUpperCase();
                  const paddedHex = hexCid.length % 2 === 0 ? hexCid : '0' + hexCid;
                  
                  // Use TextEncoder to convert hex to bytes
                  const bytes = [];
                  for (let i = 0; i < paddedHex.length; i += 2) {
                    bytes.push(parseInt(paddedHex.substr(i, 2), 16));
                  }
                  const uint8Array = new Uint8Array(bytes);
                  
                  // Convert to base64url
                  let base64 = btoa(String.fromCharCode.apply(null, Array.from(uint8Array)));
                  const encodedCid = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '');
                  
                  finalLink = `https://g.page/r/${encodedCid}/review`;
                  console.log('🔧 Converted using CID to g.page format:', finalLink);
                } catch (e) {
                  console.error('Failed to convert CID to g.page format:', e);
                }
              }
              // Try to extract from /place/NAME/@LAT,LNG/data=...
              else {
                // Extract the business name from the URL
                const placeNameMatch = finalLink.match(/\/place\/([^/@?]+)/);
                if (placeNameMatch) {
                  const placeName = decodeURIComponent(placeNameMatch[1].replace(/\+/g, ' '));
                  
                  // Check if there's a data attribute with ftid or CID
                  const dataMatch = finalLink.match(/data=([^&?#]+)/);
                  if (dataMatch) {
                    const dataStr = decodeURIComponent(dataMatch[1]);
                    // Try to find ftid (feature ID which is often the Place ID)
                    const ftidMatch = dataStr.match(/!1s(0x[0-9a-f]+:0x[0-9a-f]+)/);
                    if (ftidMatch) {
                      const ftid = ftidMatch[1];
                      console.log('🔧 Extracted FTID from data attribute:', ftid);
                      
                      // Call backend to convert FTID to Place ID
                      // For now, fallback to fetching Place ID via business name
                      console.log('🔄 FTID found, need to fetch Place ID from backend...');
                      
                      // Get business name and location from URL params
                      const businessName = searchParams.get('business');
                      const location = searchParams.get('location');
                      
                      if (businessName && location) {
                        console.log(`🔄 Fetching Place ID for: ${businessName}, ${location}`);
                        
                        // Show loading toast
                        toast({
                          title: "Loading...",
                          description: "Fetching review link, please wait...",
                          variant: "default"
                        });
                        
                        // Call backend to get Place ID
                        fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/places/get-place-id?business=${encodeURIComponent(businessName)}&location=${encodeURIComponent(location)}`)
                          .then(res => res.json())
                          .then(data => {
                            if (data.placeId) {
                              const reviewUrl = `https://search.google.com/local/writereview?placeid=${data.placeId}`;
                              console.log('✅ Got Place ID from backend:', data.placeId);
                              console.log('✅ Opening review URL:', reviewUrl);
                              window.open(reviewUrl, '_blank', 'noopener,noreferrer');
                            } else {
                              throw new Error('No Place ID returned');
                            }
                          })
                          .catch(err => {
                            console.error('❌ Failed to fetch Place ID:', err);
                            toast({
                              title: "Error",
                              description: "Could not fetch review link. Please try again.",
                              variant: "destructive"
                            });
                          });
                        return; // Exit the function here
                      }
                    }
                  }
                  
                  // If we still have a maps link, try using search with place name
                  if (finalLink.includes('google.com/maps')) {
                    console.log('⚠️ Could not extract Place ID or CID, using fallback search method');
                    // Try to get business name and location from URL parameters
                    const businessName = searchParams.get('business');
                    const location = searchParams.get('location');
                    const placeIdParam = searchParams.get('placeId');
                    
                    if (placeIdParam && placeIdParam.startsWith('ChIJ')) {
                      finalLink = `https://search.google.com/local/writereview?placeid=${placeIdParam}`;
                      console.log('🔧 Using placeId from URL parameters:', finalLink);
                    } else if (businessName && location) {
                      // Fetch Place ID from backend API
                      console.log(`🔄 Fetching Place ID via API for: ${businessName}, ${location}`);
                      
                      toast({
                        title: "Loading...",
                        description: "Fetching review link, please wait...",
                        variant: "default"
                      });
                      
                      fetch(`${import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000'}/api/places/get-place-id?business=${encodeURIComponent(businessName)}&location=${encodeURIComponent(location)}`)
                        .then(res => res.json())
                        .then(data => {
                          if (data.placeId) {
                            const reviewUrl = `https://search.google.com/local/writereview?placeid=${data.placeId}`;
                            console.log('✅ Got Place ID from backend:', data.placeId);
                            console.log('✅ Opening review URL:', reviewUrl);
                            window.open(reviewUrl, '_blank', 'noopener,noreferrer');
                          } else {
                            throw new Error('No Place ID returned');
                          }
                        })
                        .catch(err => {
                          console.error('❌ Failed to fetch Place ID:', err);
                          toast({
                            title: "Error",
                            description: "Could not fetch review link. Please try again.",
                            variant: "destructive"
                          });
                        });
                      return; // Exit early
                    } else {
                      // Show error - we can't convert this link
                      console.error('❌ Cannot convert Maps link to review link - no Place ID or CID found');
                      toast({
                        title: "Invalid Review Link",
                        description: "This link cannot be converted to a review page. Please regenerate the QR code with a valid review link.",
                        variant: "destructive"
                      });
                      return;
                    }
                  }
                }
              }
            }
          }
        }
        
        // FIX: Ensure g.page links have /review at the end
        if (finalLink.includes('g.page/r/')) {
          if (!finalLink.endsWith('/review')) {
            const baseMatch = finalLink.match(/(https:\/\/g\.page\/r\/[A-Za-z0-9_-]+)/);
            if (baseMatch) {
              finalLink = `${baseMatch[1]}/review`;
              console.log('🔧 Fixed g.page link to include /review:', finalLink);
            }
          }
        }

        // FIX: Ensure writereview links are properly formatted
        if (finalLink.includes('writereview') && finalLink.includes('placeid=')) {
          console.log('✅ Using writereview format (correct)');
        }
        
        console.log('🎯 FINAL processed Google review link:', finalLink);
      
        // Ensure it's a valid Google review URL
        const isValidReviewUrl = (finalLink.includes('g.page/r/') && finalLink.includes('/review')) || 
                                  (finalLink.includes('writereview') && finalLink.includes('placeid='));
        
        if (isValidReviewUrl && (finalLink.startsWith('http://') || finalLink.startsWith('https://'))) {
          console.log('✅ Opening Google REVIEW link:', finalLink);
          // Force new window to prevent any redirects back to our site
          const newWindow = window.open(finalLink, '_blank', 'noopener,noreferrer');
          if (!newWindow) {
            // Fallback if popup blocked
            window.location.href = finalLink;
          }
        } else {
          console.error('❌ Invalid review URL format:', finalLink);
          console.error('❌ Link does not contain review endpoint');
        toast({
          title: "Invalid Review Link",
          description: "This link will open Google Maps, not the review page. Please regenerate the QR code.",
          variant: "destructive"
        });
      }
      } catch (error) {
        console.error('❌ Unexpected error in redirectToGoogleReviews:', error);
        toast({
          title: "Error",
          description: "An unexpected error occurred. Please try again.",
          variant: "destructive"
        });
      }
    } else {
      // No review link provided - try to generate one using place ID
      const placeId = searchParams.get('placeId');
      if (placeId && placeId.startsWith('ChIJ')) {
        const fallbackUrl = `https://search.google.com/local/writereview?placeid=${placeId}`;
        console.log('🔄 Using fallback Google review URL:', fallbackUrl);
        window.open(fallbackUrl, '_blank', 'noopener,noreferrer');
      } else {
        console.log('❌ No valid review link or place ID found');
        toast({
          title: "Review Link Not Available",
          description: "Please contact the business for their review link.",
          variant: "destructive"
        });
      }
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
            Click on any suggestion to copy it, then click "Write Review" below and paste it in the Google review text box
          </p>
        </div>
        
        {loading ? (
          <div className="space-y-4">
            <div className="text-center py-8">
              <RefreshCw className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
              <p className="text-lg font-medium">Generating personalized review suggestions...</p>
              <p className="text-muted-foreground mt-2">This may take a few seconds</p>
            </div>
            {Array.from({ length: 5 }).map((_, i) => (
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
                  
                  {/* Keywords Display */}
                  {review.keywords && review.keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <span className="text-xs text-gray-500">Keywords:</span>
                      {review.keywords.map((keyword, idx) => (
                        <Badge key={idx} variant="outline" className="text-xs">
                          {keyword}
                        </Badge>
                      ))}
                    </div>
                  )}
                  
                  {copiedReview === review.id && (
                    <div className="mt-3 p-2 bg-green-50 rounded-md">
                      <p className="text-sm text-green-700 font-medium">
                        ✓ Copied! Now click "Write Review on Google" below and paste (Ctrl+V) in the text box
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