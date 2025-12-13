import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  MessageSquarePlus,
  QrCode,
  Download,
  Copy,
  RefreshCw,
  Sparkles,
  MapPin,
  Building2,
  X,
  Check,
  Link,
  Info,
  Eye,
  Star
} from "lucide-react";
import { useGoogleBusinessProfile } from "@/hooks/useGoogleBusinessProfile";
import { useToast } from "@/hooks/use-toast";
import { useProfileLimitations } from "@/hooks/useProfileLimitations";
import { googleBusinessProfileService } from "@/lib/googleBusinessProfile";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";

interface AIReview {
  id: string;
  review: string;
  rating: number;
  focus: string;
  length: string;
  businessName: string;
  location: string;
  generatedAt: string;
}

interface QRModalData {
  isOpen: boolean;
  locationName: string;
  locationId: string;
  address: string;
  placeId?: string;
  qrCodeUrl?: string;
  reviewLink?: string;
  aiReviews?: AIReview[];
  businessCategory?: string;
  keywords?: string;
}

interface ReviewLinkModalData {
  isOpen: boolean;
  location: any;
  googleReviewLink: string;
  keywords: string;
  forceRefresh?: boolean;
}

const AskForReviews = () => {
  const navigate = useNavigate();
  const { accounts, isConnected, isLoading } = useGoogleBusinessProfile();
  const { toast } = useToast();
  const { getAccessibleAccounts, getAccountLockMessage, canAccessMultipleProfiles } = useProfileLimitations();
  const [qrModalData, setQrModalData] = useState<QRModalData>({
    isOpen: false,
    locationName: "",
    locationId: "",
    address: ""
  });
  const [reviewLinkModalData, setReviewLinkModalData] = useState<ReviewLinkModalData>({
    isOpen: false,
    location: null,
    googleReviewLink: "",
    keywords: ""
  });
  const [loadingQR, setLoadingQR] = useState<string | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [fetchingReviewLink, setFetchingReviewLink] = useState(false);
  const [copiedReview, setCopiedReview] = useState<string | null>(null);
  const [existingQRCodes, setExistingQRCodes] = useState<Map<string, any>>(new Map());

  // Auto-detect backend URL based on environment
  const backendUrl = window.location.hostname === 'localhost'
    ? 'http://localhost:5000'
    : (import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net');

  // Filter accounts based on subscription limitations - memoize to prevent infinite re-renders
  const accessibleAccounts = useMemo(() => getAccessibleAccounts(accounts), [accounts, getAccessibleAccounts]);
  const lockMessage = useMemo(() => getAccountLockMessage(accounts.length), [accounts.length, getAccountLockMessage]);
  const hasLockedProfiles = useMemo(() => !canAccessMultipleProfiles && accounts.length > 1, [canAccessMultipleProfiles, accounts.length]);

  // Load existing QR codes when component mounts
  useEffect(() => {
    loadExistingQRCodes();
  }, [accessibleAccounts]);

  const loadExistingQRCodes = async () => {
    try {
      const response = await fetch(`${backendUrl}/api/qr-codes`);
      if (response.ok) {
        const { qrCodes } = await response.json();
        const qrMap = new Map();
        qrCodes.forEach((qr: any) => {
          qrMap.set(qr.locationId, qr);
        });
        setExistingQRCodes(qrMap);
        console.log(`[AskForReviews] Loaded ${qrCodes.length} existing QR codes`);
      }
    } catch (error) {
      console.error('Error loading existing QR codes:', error);
    }
  };

  const fetchGoogleReviewLink = async (location: any) => {
    setFetchingReviewLink(true);
    try {
      console.log('[AskForReviews] Fetching Google review link for location:', location);
      console.log('[AskForReviews] Location object keys:', Object.keys(location));
      console.log('[AskForReviews] Location.name:', location.name);
      console.log('[AskForReviews] Location.locationId:', location.locationId);

      // Get access token from googleBusinessProfileService
      const accessToken = googleBusinessProfileService.getAccessToken();

      if (!accessToken) {
        toast({
          title: "Authentication Required",
          description: "Please reconnect your Google Business Profile from Settings.",
          variant: "destructive"
        });
        return null;
      }

      // Extract accountId and locationId
      let accountId: string;
      let locationId: string;

      // First, try to use the accountId that was passed in with the location object
      if (location.accountId) {
        accountId = location.accountId;
        console.log('[AskForReviews] Using passed accountId:', accountId);
      } else if (location.name && location.name.includes('/')) {
        // Extract from name (format: accounts/{accountId}/locations/{locationId})
        const locationNameParts = location.name.split('/');
        accountId = locationNameParts[1];
        console.log('[AskForReviews] Extracted accountId from location.name:', accountId);
      } else {
        console.error('[AskForReviews] Could not extract accountId from location object');
        toast({
          title: "Configuration Error",
          description: "Could not extract account information. Please try reconnecting your profile.",
          variant: "destructive"
        });
        return null;
      }

      // Extract locationId
      if (location.locationId) {
        locationId = location.locationId;
        console.log('[AskForReviews] Using location.locationId:', locationId);
      } else if (location.name && location.name.includes('/')) {
        // Extract from name (format: accounts/{accountId}/locations/{locationId})
        const locationNameParts = location.name.split('/');
        locationId = locationNameParts[3];
        console.log('[AskForReviews] Extracted locationId from location.name:', locationId);
      } else {
        console.error('[AskForReviews] Could not extract locationId from location object');
        toast({
          title: "Configuration Error",
          description: "Could not extract location information. Please try reconnecting your profile.",
          variant: "destructive"
        });
        return null;
      }

      console.log('[AskForReviews] Final values for API call:', {
        accountId,
        locationId,
        hasAccessToken: !!accessToken
      });

      // Call backend API to fetch review link
      const response = await fetch(`${backendUrl}/api/google-review/fetch-google-review-link`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId,
          locationId,
          accessToken
        })
      });

      if (response.ok) {
        const data = await response.json();
        console.log('[AskForReviews] Fetched review link:', data);

        if (data.success && data.reviewLink) {
          toast({
            title: "Review Link Fetched",
            description: "Successfully retrieved your Google review link from your business profile.",
          });
          return data.reviewLink;
        } else {
          toast({
            title: "Review Link Not Available",
            description: "Could not automatically fetch review link. Please ensure your business profile is properly set up.",
            variant: "destructive"
          });
          return null;
        }
      } else {
        console.error('[AskForReviews] Failed to fetch review link:', await response.text());
        toast({
          title: "Error Fetching Review Link",
          description: "Failed to retrieve review link from Google. Please try again.",
          variant: "destructive"
        });
        return null;
      }
    } catch (error) {
      console.error('[AskForReviews] Error fetching Google review link:', error);
      toast({
        title: "Error",
        description: "An error occurred while fetching the review link. Please try again.",
        variant: "destructive"
      });
      return null;
    } finally {
      setFetchingReviewLink(false);
    }
  };

  const openReviewLinkModal = async (location: any, accountId?: string, forceRefresh: boolean = false) => {
    console.log('Opening review link modal for location:', location);
    console.log('Account ID:', accountId);
    console.log('Force Refresh:', forceRefresh);

    // Load existing keywords if QR code exists
    const existingQR = existingQRCodes.get(location.locationId);

    // Add accountId to location object for later use
    const locationWithAccount = { ...location, accountId };

    // Open modal first
    setReviewLinkModalData({
      isOpen: true,
      location: locationWithAccount,
      googleReviewLink: existingQR?.googleReviewLink || "",
      keywords: existingQR?.keywords || "",
      forceRefresh: forceRefresh
    });

    // If no existing review link, fetch it automatically from Google
    if (!existingQR?.googleReviewLink) {
      const fetchedLink = await fetchGoogleReviewLink(locationWithAccount);
      if (fetchedLink) {
        setReviewLinkModalData(prev => ({
          ...prev,
          googleReviewLink: fetchedLink
        }));
      }
    }
  };

  // New simplified function that auto-fetches review link and generates QR code
  const generateQRCodeDirectly = async (location: any, accountId: string, forceRefresh: boolean = false) => {
    console.log('[AskForReviews] 🚀 Generating QR code directly for:', location.displayName, forceRefresh ? '(FORCE REFRESH)' : '');

    // If not force refresh, check if QR code already exists
    if (!forceRefresh) {
      const existingQR = existingQRCodes.get(location.locationId);
      if (existingQR) {
        console.log('[AskForReviews] ♻️ QR code already exists, showing it');
        showExistingQRCode(location);
        return;
      }
    }

    setLoadingQR(location.locationId);

    try {
      // Get access token
      const accessToken = googleBusinessProfileService.getAccessToken();
      if (!accessToken) {
        toast({
          title: "Authentication Required",
          description: "Please reconnect your Google Business Profile from Settings.",
          variant: "destructive"
        });
        setLoadingQR(null);
        return;
      }

      // Get user ID from Firebase auth
      const userId = googleBusinessProfileService.getUserId();

      console.log('[AskForReviews] 📡 Calling backend at:', `${backendUrl}/api/qr-codes/generate-with-auto-fetch`);

      // Add timeout to fetch request (30 seconds)
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 30000);

      // Extract business category from location object
      const businessCategory = location.categories?.primaryCategory?.displayName ||
                               location.categories?.primaryCategory?.name ||
                               location.primaryCategory ||
                               null;

      console.log(`[AskForReviews] 📋 Sending business category to QR endpoint: ${businessCategory}`);

      // Call the new backend endpoint that does everything
      const response = await fetch(`${backendUrl}/api/qr-codes/generate-with-auto-fetch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          accountId: accountId,
          locationId: location.locationId,
          locationName: location.displayName,
          address: location.address?.locality || location.address?.administrativeArea || '',
          placeId: location.placeId || '',
          accessToken: accessToken,
          keywords: '', // Can be added later via update
          userId: userId,
          gbpAccountId: accountId,
          forceRefresh: forceRefresh, // Pass force refresh flag
          businessCategory: businessCategory // Pass business category for category-specific reviews
        }),
        signal: controller.signal,
        mode: 'cors'
      });

      clearTimeout(timeoutId);
      console.log('[AskForReviews] 📥 Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json();
        if (response.status === 403) {
          // Subscription issue
          toast({
            title: "Subscription Required",
            description: errorData.message || "Please upgrade to create QR codes.",
            variant: "destructive"
          });
        } else {
          throw new Error(errorData.message || 'Failed to generate QR code');
        }
        setLoadingQR(null);
        return;
      }

      const data = await response.json();
      
      if (data.success && data.qrCode) {
        console.log('[AskForReviews] ✅ QR code generated successfully');

        // Reload existing QR codes
        await loadExistingQRCodes();

        // Extract business category from location object
        const businessCategory = location.categories?.primaryCategory?.displayName ||
                                 location.categories?.primaryCategory?.name ||
                                 location.primaryCategory ||
                                 null;

        console.log(`[AskForReviews] 📋 Extracted business category: ${businessCategory}`);

        // Show the QR code modal
        setQrModalData({
          isOpen: true,
          locationName: data.qrCode.locationName,
          locationId: data.qrCode.locationId,
          address: data.qrCode.address,
          placeId: data.qrCode.placeId,
          qrCodeUrl: data.qrCode.qrCodeUrl,
          reviewLink: data.qrCode.publicReviewUrl,
          aiReviews: [],
          businessCategory: businessCategory,
          keywords: data.qrCode.keywords || '' // Include keywords from QR code (from autoposting settings)
        });

        toast({
          title: "QR Code Generated",
          description: data.cached 
            ? "Your existing QR code is ready to use."
            : "QR code generated successfully with review link from Google.",
        });
      }

    } catch (error) {
      console.error('[AskForReviews] ❌ Error generating QR code:', error);

      // Check if error is due to timeout or network issue
      let errorMessage = "Failed to generate QR code. Please try again.";

      if (error instanceof Error) {
        if (error.name === 'AbortError') {
          errorMessage = "Request timed out. The QR code may still be generated - please refresh the page.";
          console.log('[AskForReviews] ⏱️ Request timed out, but QR code may be created on backend');
        } else if (error.message === 'Failed to fetch') {
          errorMessage = "Network error. Please check if the backend is running and refresh the page.";
          console.log('[AskForReviews] 🌐 Network error - backend might be down or CORS issue');
        } else {
          errorMessage = error.message;
        }
      }

      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      });

      // Try to reload QR codes in case it was actually created
      setTimeout(() => {
        console.log('[AskForReviews] 🔄 Reloading QR codes in case it was created...');
        loadExistingQRCodes();
      }, 2000);

    } finally {
      setLoadingQR(null);
    }
  };

  const showExistingQRCode = (location: any) => {
    const existingQR = existingQRCodes.get(location.locationId);
    if (existingQR) {
      // Extract business category from location object
      const businessCategory = location.categories?.primaryCategory?.displayName ||
                               location.categories?.primaryCategory?.name ||
                               location.primaryCategory ||
                               null;

      console.log(`[AskForReviews] 📋 Showing existing QR with category: ${businessCategory}`);

      setQrModalData({
        isOpen: true,
        locationName: existingQR.locationName,
        locationId: location.locationId,
        address: existingQR.address,
        placeId: existingQR.placeId,
        qrCodeUrl: existingQR.qrCodeUrl,
        reviewLink: existingQR.publicReviewUrl,
        aiReviews: [],
        businessCategory: businessCategory,
        keywords: existingQR.keywords || '' // Include keywords from existing QR code
      });
    }
  };

  const generateQRCodeWithLink = async () => {
    const { location, googleReviewLink, keywords, forceRefresh } = reviewLinkModalData;
    
    if (!googleReviewLink) {
      toast({
        title: "Review Link Required",
        description: "Please enter your Google review link to continue.",
        variant: "destructive"
      });
      return;
    }
    
    setLoadingQR(location.locationId);
    setReviewLinkModalData({ ...reviewLinkModalData, isOpen: false });
    
    try {
      console.log('🔍 Generating QR code for custom review suggestions page');
      
      // Create custom public review page URL with business info and Google review link
      const frontendUrl = import.meta.env.PROD ? 'https://www.app.lobaiseo.com' : window.location.origin;
      const publicReviewUrl = `${frontendUrl}/review/${location.locationId}?` +
        `business=${encodeURIComponent(location.displayName)}&` +
        `location=${encodeURIComponent(location.address?.locality || location.address?.administrativeArea || 'Location')}&` +
        `googleReviewLink=${encodeURIComponent(googleReviewLink)}`;
      
      console.log('🔍 Public review URL:', publicReviewUrl);
      
      // Generate QR code for our custom page (not directly to Google)
      const qrCodeUrl = await QRCode.toDataURL(publicReviewUrl, {
        errorCorrectionLevel: 'M',
        type: 'image/png',
        quality: 0.92,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF',
        },
        width: 512
      });
      
      // Save QR code data to backend for future reference (with keywords for AI)
      try {
        // Get user ID and account ID from Firebase and location data
        const userId = googleBusinessProfileService.getUserId();
        const gbpAccountId = location.accountId;

        const qrData = {
          locationId: location.locationId,
          locationName: location.displayName,
          address: location.address?.locality || location.address?.administrativeArea || 'Location',
          placeId: location.placeId || '',
          googleReviewLink: googleReviewLink,
          keywords: keywords, // Pass keywords for AI review generation
          userId: userId,
          gbpAccountId: gbpAccountId,
          publicReviewUrl: publicReviewUrl,
          qrCodeUrl: qrCodeUrl,
          forceRefresh: forceRefresh || false, // Force update if regenerating
          createdAt: new Date().toISOString()
        };

        console.log('📦 Saving QR code for location:', location.locationId);
        console.log('📦 Keywords:', keywords || 'NONE');
        console.log('📦 Force Refresh:', forceRefresh ? 'YES' : 'NO');

        await fetch(`${backendUrl}/api/qr-codes`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(qrData)
        });
        
        // Reload existing QR codes to show the new one
        await loadExistingQRCodes();
        
      } catch (saveError) {
        console.warn('Failed to save QR code data:', saveError);
      }
      
      console.log('✅ QR code generated successfully');
      
      setQrModalData({
        isOpen: true,
        locationName: location.displayName,
        locationId: location.locationId,
        address: location.address?.locality || location.address?.administrativeArea || 'Location',
        placeId: location.placeId || '',
        qrCodeUrl: qrCodeUrl,
        reviewLink: publicReviewUrl, // Points to our custom page, not directly to Google
        aiReviews: []
      });
      
      toast({
        title: "QR Code Generated",
        description: "Your QR code will show customers AI-generated review suggestions with SEO keywords, then redirect them to your Google review page.",
      });
      
    } catch (error) {
      console.error('Error generating QR code:', error);
      toast({
        title: "Error",
        description: "Failed to generate QR code. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingQR(null);
    }
  };

  const downloadQRCode = () => {
    if (!qrModalData.qrCodeUrl) return;
    
    const link = document.createElement('a');
    link.download = `${qrModalData.locationName.replace(/\s+/g, '_')}_QR_Code.png`;
    link.href = qrModalData.qrCodeUrl;
    link.click();
    
    toast({
      title: "QR Code Downloaded",
      description: "The QR code has been saved to your device.",
    });
  };

  const copyPreviewLink = async () => {
    if (!qrModalData.reviewLink) {
      toast({
        title: "Copy Error",
        description: "No preview link available. Please generate a QR code first.",
        variant: "destructive"
      });
      return;
    }
    
    try {
      await navigator.clipboard.writeText(qrModalData.reviewLink);
      toast({
        title: "Link Copied!",
        description: "Preview link has been copied to your clipboard.",
      });
    } catch (error) {
      toast({
        title: "Copy Error",
        description: "Failed to copy link. Please try again.",
        variant: "destructive"
      });
    }
  };

  const previewPublicPage = () => {
    console.log('🔍 Preview button clicked!');
    console.log('🔍 qrModalData:', qrModalData);
    console.log('🔍 reviewLink:', qrModalData.reviewLink);
    
    if (!qrModalData.reviewLink) {
      console.error('❌ No review link available for preview');
      toast({
        title: "Preview Error",
        description: "No review link available. Please generate a QR code first.",
        variant: "destructive"
      });
      return;
    }
    
    console.log('🚀 Opening preview URL:', qrModalData.reviewLink);
    
    // Open the public review suggestions page in a new tab
    window.open(qrModalData.reviewLink, '_blank', 'noopener,noreferrer');
    
    toast({
      title: "Preview Opened",
      description: "The customer review page has been opened in a new tab.",
    });
  };

  const copyReviewToClipboard = async (review: string, reviewId: string) => {
    try {
      await navigator.clipboard.writeText(review);
      setCopiedReview(reviewId);
      toast({
        title: "Review Copied",
        description: "The review has been copied to your clipboard.",
      });
      
      // Reset copied state after 2 seconds
      setTimeout(() => setCopiedReview(null), 2000);
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to copy review. Please try again.",
        variant: "destructive"
      });
    }
  };

  const regenerateReviews = async () => {
    if (!qrModalData.locationName || !qrModalData.address) return;
    
    setLoadingReviews(true);
    
    try {
      // Extract business category and keywords from qrModalData if available
      const businessCategory = qrModalData.businessCategory || null;
      const keywords = qrModalData.keywords || '';

      console.log(`[AskForReviews] 🎯 Generating AI reviews with category: ${businessCategory || 'default'}`);
      console.log(`[AskForReviews] 🔑 Using keywords: ${keywords || 'none'}`);

      const response = await fetch(`${backendUrl}/api/ai-reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessName: qrModalData.locationName,
          location: qrModalData.address,
          businessType: 'business',
          businessCategory: businessCategory,
          keywords: keywords // Pass keywords from QR code data (from autoposting settings)
        })
      });
      
      if (response.ok) {
        const data = await response.json();
        setQrModalData(prev => ({
          ...prev,
          aiReviews: data.suggestions
        }));
        toast({
          title: "Reviews Regenerated",
          description: "New review suggestions have been generated.",
        });
      }
    } catch (error) {
      console.error('Error regenerating reviews:', error);
      toast({
        title: "Error",
        description: "Failed to regenerate reviews. Please try again.",
        variant: "destructive"
      });
    } finally {
      setLoadingReviews(false);
    }
  };

  const renderStars = (rating: number) => {
    return Array.from({ length: 5 }).map((_, index) => (
      <Star 
        key={index} 
        className={`h-4 w-4 ${
          index < rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"
        }`} 
      />
    ));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold tracking-tight">Ask for Reviews</h1>
        <p className="text-muted-foreground mt-1">
          Generate QR codes and AI-powered review suggestions for your business locations
        </p>
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

      {/* Connected Profiles */}
      {isConnected && !isLoading && accessibleAccounts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Your Business Locations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accessibleAccounts.flatMap(account =>
              account.locations.map(location => (
                <Card key={location.locationId} className="shadow-card border hover:shadow-lg transition-all duration-300">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <CardTitle className="text-lg">{location.displayName}</CardTitle>
                        <div className="flex items-center gap-2 mt-2">
                          <MapPin className="h-4 w-4 text-muted-foreground" />
                          <p className="text-sm text-muted-foreground">
                            {location.storefrontAddress?.locality || 
                             location.storefrontAddress?.administrativeArea ||
                             location.storefrontAddress?.addressLines?.[0] ||
                             account.accountName}
                          </p>
                        </div>
                      </div>
                      <Building2 className="h-5 w-5 text-primary" />
                    </div>
                  </CardHeader>
                  <CardContent>
                    {existingQRCodes.has(location.locationId) ? (
                      // Show existing QR code options
                      <div className="space-y-2">
                        <Button
                          onClick={() => showExistingQRCode(location)}
                          className="w-full bg-green-600 hover:bg-green-700 text-white"
                        >
                          <QrCode className="mr-2 h-4 w-4" />
                          View QR Code
                        </Button>
                        <Button
                          onClick={() => {
                            openReviewLinkModal(location, account.accountId, true); // true = forceRefresh
                          }}
                          variant="outline"
                          className="w-full"
                          disabled={loadingQR === location.locationId}
                        >
                          {loadingQR === location.locationId ? (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                              Updating...
                            </>
                          ) : (
                            <>
                              <RefreshCw className="mr-2 h-4 w-4" />
                              Regenerate
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      // Show generate new QR code option
                      <Button
                        onClick={() => {
                          openReviewLinkModal(location, account.accountId);
                        }}
                        disabled={loadingQR === location.locationId}
                        className="w-full bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
                      >
                        {loadingQR === location.locationId ? (
                          <>
                            <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                            Generating...
                          </>
                        ) : (
                          <>
                            <QrCode className="mr-2 h-4 w-4" />
                            Generate QR Code
                          </>
                        )}
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty state if no profiles */}
      {isConnected && !isLoading && accessibleAccounts.length === 0 && (
        <Card className="shadow-card">
          <CardContent className="py-12 text-center">
            <MessageSquarePlus className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
            <h3 className="text-lg font-medium mb-2">No Business Profiles Connected</h3>
            <p className="text-muted-foreground mb-4">
              Connect your Google Business Profile to generate QR codes and AI reviews.
            </p>
            <Button variant="outline">
              Connect Business Profile
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {isLoading && (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <Card key={index} className="shadow-card">
                <CardContent className="p-6">
                  <div className="animate-pulse">
                    <div className="h-4 bg-muted rounded w-3/4 mb-3" />
                    <div className="h-3 bg-muted rounded w-1/2 mb-4" />
                    <div className="h-10 bg-muted rounded w-full" />
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Review Link Modal */}
      <Dialog open={reviewLinkModalData.isOpen} onOpenChange={(open) => !open && setReviewLinkModalData({...reviewLinkModalData, isOpen: false})}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              {reviewLinkModalData.forceRefresh ? (
                <RefreshCw className="h-6 w-6 text-primary" />
              ) : (
                <Sparkles className="h-6 w-6 text-primary" />
              )}
              {reviewLinkModalData.forceRefresh ? 'Regenerate QR Code' : 'Generate QR Code with Review Link'}
            </DialogTitle>
            <DialogDescription>
              {fetchingReviewLink
                ? "Fetching your Google review link automatically..."
                : reviewLinkModalData.forceRefresh
                  ? "Update your keywords and regenerate the QR code with new settings"
                  : "Your Google review link has been retrieved from your business profile"
              }
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {fetchingReviewLink && (
              <Alert className="bg-blue-50 border-blue-200">
                <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold text-blue-900">Fetching Review Link...</p>
                    <p className="text-sm text-blue-700">
                      We're automatically retrieving your Google review link from your Business Profile.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {!fetchingReviewLink && reviewLinkModalData.googleReviewLink && (
              <Alert className="bg-green-50 border-green-200">
                <Check className="h-4 w-4 text-green-600" />
                <AlertDescription>
                  <div className="space-y-1">
                    <p className="font-semibold text-green-900">Review Link Retrieved Successfully!</p>
                    <p className="text-sm text-green-700">
                      Your Google review link has been automatically fetched from your Business Profile.
                    </p>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="review-link">
                Google Review Link {fetchingReviewLink && <span className="text-muted-foreground">(Auto-fetching...)</span>}
              </Label>
              <Input
                id="review-link"
                type="url"
                placeholder={fetchingReviewLink ? "Fetching from Google Business Profile..." : "Review link will be fetched automatically"}
                value={reviewLinkModalData.googleReviewLink}
                disabled={fetchingReviewLink}
                readOnly
                className="font-mono text-sm bg-gray-50"
              />
              <p className="text-xs text-muted-foreground">
                {fetchingReviewLink
                  ? "Please wait while we retrieve your review link..."
                  : "This link was automatically retrieved from your Google Business Profile"
                }
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="keywords" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Review Keywords <span className="text-primary font-semibold">(Recommended)</span>
              </Label>
              <Input
                id="keywords"
                type="text"
                placeholder="e.g., best pizza, fast delivery, friendly staff, authentic Italian"
                value={reviewLinkModalData.keywords}
                onChange={(e) => setReviewLinkModalData({
                  ...reviewLinkModalData,
                  keywords: e.target.value
                })}
                className="border-primary/50 focus:border-primary"
              />
              <p className="text-xs text-muted-foreground">
                <strong>Tip:</strong> Add 4-6 keywords that describe your business best. These will appear in AI-generated review suggestions to help customers write better reviews.
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setReviewLinkModalData({...reviewLinkModalData, isOpen: false})}
                className="flex-1"
                disabled={fetchingReviewLink}
              >
                Cancel
              </Button>
              <Button
                onClick={generateQRCodeWithLink}
                disabled={!reviewLinkModalData.googleReviewLink || fetchingReviewLink}
                className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              >
                {fetchingReviewLink ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Fetching Link...
                  </>
                ) : reviewLinkModalData.forceRefresh ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Regenerate QR Code
                  </>
                ) : (
                  <>
                    <QrCode className="mr-2 h-4 w-4" />
                    Generate QR Code
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* QR Code Modal */}
      <Dialog open={qrModalData.isOpen} onOpenChange={(open) => !open && setQrModalData({...qrModalData, isOpen: false})}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-2xl flex items-center gap-2">
              <QrCode className="h-6 w-6 text-primary" />
              {qrModalData.locationName}
            </DialogTitle>
            <DialogDescription>
              QR code for customer reviews - Scan to see AI-powered review suggestions
            </DialogDescription>
          </DialogHeader>
          
          <Card>
            <CardContent className="space-y-4 pt-6">
              {qrModalData.qrCodeUrl && (
                <>
                  <div className="bg-white p-3 rounded-lg border-2 border-gray-200 flex justify-center max-w-xs mx-auto">
                    <img src={qrModalData.qrCodeUrl} alt="QR Code" className="w-48 h-48" />
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">How it works:</h4>
                    <ol className="text-sm space-y-1 text-muted-foreground">
                      <li>1. Customer scans QR code</li>
                      <li>2. Sees AI-generated review suggestions with SEO keywords</li>
                      <li>3. Clicks "Write Review on Google" button</li>
                      <li>4. Gets redirected to your Google review page</li>
                    </ol>
                  </div>
                  
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Preview Link</label>
                      <div className="flex gap-2">
                        <input 
                          type="text" 
                          value={qrModalData.reviewLink || ''}
                          readOnly
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-md bg-gray-50 text-sm font-mono text-gray-600"
                          placeholder="No preview link available"
                        />
                        <Button 
                          onClick={copyPreviewLink}
                          size="sm"
                          variant="outline"
                          disabled={!qrModalData.reviewLink}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <Button 
                      onClick={downloadQRCode}
                      className="w-full"
                      variant="default"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download QR Code
                    </Button>
                  </div>
                  
                  <div className="text-xs text-muted-foreground text-center">
                    Print this QR code and display it in your business location
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AskForReviews;