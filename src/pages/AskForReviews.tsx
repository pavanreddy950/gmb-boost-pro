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
}

interface ReviewLinkModalData {
  isOpen: boolean;
  location: any;
  googleReviewLink: string;
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
    googleReviewLink: ""
  });
  const [loadingQR, setLoadingQR] = useState<string | null>(null);
  const [loadingReviews, setLoadingReviews] = useState(false);
  const [copiedReview, setCopiedReview] = useState<string | null>(null);
  const [existingQRCodes, setExistingQRCodes] = useState<Map<string, any>>(new Map());
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';

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

  const openReviewLinkModal = (location: any) => {
    console.log('Opening review link modal for location:', location);
    setReviewLinkModalData({
      isOpen: true,
      location: location,
      googleReviewLink: ""
    });
  };

  const showExistingQRCode = (location: any) => {
    const existingQR = existingQRCodes.get(location.locationId);
    if (existingQR) {
      setQrModalData({
        isOpen: true,
        locationName: existingQR.locationName,
        locationId: location.locationId,
        address: existingQR.address,
        placeId: existingQR.placeId,
        qrCodeUrl: existingQR.qrCodeUrl,
        reviewLink: existingQR.publicReviewUrl,
        aiReviews: []
      });
    }
  };

  const generateQRCodeWithLink = async () => {
    const { location, googleReviewLink } = reviewLinkModalData;
    
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
      
      // Save QR code data to backend for future reference
      try {
        const qrData = {
          locationId: location.locationId,
          locationName: location.displayName,
          address: location.address?.locality || location.address?.administrativeArea || 'Location',
          googleReviewLink: googleReviewLink,
          publicReviewUrl: publicReviewUrl,
          qrCodeUrl: qrCodeUrl,
          createdAt: new Date().toISOString()
        };
        
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
      const response = await fetch(`${backendUrl}/api/ai-reviews/generate`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          businessName: qrModalData.locationName,
          location: qrModalData.address,
          businessType: 'business'
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
                          onClick={() => openReviewLinkModal(location)}
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
                              <Info className="mr-2 h-4 w-4" />
                              Update Link
                            </>
                          )}
                        </Button>
                      </div>
                    ) : (
                      // Show generate new QR code option
                      <Button
                        onClick={() => openReviewLinkModal(location)}
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
                            Generate QR & Reviews
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
              <Link className="h-6 w-6 text-primary" />
              Enter Google Review Link
            </DialogTitle>
            <DialogDescription>
              Please provide your Google review link to generate the QR code
            </DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                <div className="space-y-2">
                  <p className="font-semibold">How to get your Google review link:</p>
                  <ol className="list-decimal list-inside space-y-1 text-sm">
                    <li>Open Google Business Profile Manager</li>
                    <li>Select your business location</li>
                    <li>Click on "Home" or "Get more reviews"</li>
                    <li>Copy the review link (looks like: g.page/r/...)</li>
                  </ol>
                </div>
              </AlertDescription>
            </Alert>
            
            <div className="space-y-2">
              <Label htmlFor="review-link">Google Review Link</Label>
              <Input
                id="review-link"
                type="url"
                placeholder="Enter your Google review link"
                value={reviewLinkModalData.googleReviewLink}
                onChange={(e) => setReviewLinkModalData({
                  ...reviewLinkModalData,
                  googleReviewLink: e.target.value
                })}
                className="font-mono text-sm"
              />
              <p className="text-xs text-muted-foreground">
                Format: https://g.page/r/YOUR_PLACE_ID/review
              </p>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => setReviewLinkModalData({...reviewLinkModalData, isOpen: false})}
                className="flex-1"
              >
                Cancel
              </Button>
              <Button
                onClick={generateQRCodeWithLink}
                disabled={!reviewLinkModalData.googleReviewLink}
                className="flex-1 bg-gradient-to-r from-primary to-blue-600 hover:from-primary/90 hover:to-blue-600/90"
              >
                <QrCode className="mr-2 h-4 w-4" />
                Generate QR Code
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