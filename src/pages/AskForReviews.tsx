import { useState, useEffect } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { 
  MessageSquarePlus, 
  Star, 
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
  Info
} from "lucide-react";
import { useGoogleBusinessProfile } from "@/hooks/useGoogleBusinessProfile";
import { useToast } from "@/hooks/use-toast";
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
  const { accounts, isConnected, isLoading } = useGoogleBusinessProfile();
  const { toast } = useToast();
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
  
  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net';

  const openReviewLinkModal = (location: any) => {
    console.log('Opening review link modal for location:', location);
    setReviewLinkModalData({
      isOpen: true,
      location: location,
      googleReviewLink: ""
    });
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
      // Extract location details
      const businessName = location.displayName;
      
      console.log('Full location data:', JSON.stringify(location, null, 2));
      
      // Try to get the city/locality - check all possible fields
      let locationForDisplay = '';
      
      // Check various possible field names for city
      const possibleCityFields = [
        location.storefrontAddress?.locality,
        location.storefrontAddress?.city,
        location.storefrontAddress?.administrativeArea,
        location.address?.locality,
        location.address?.city,
        location.locality,
        location.city
      ];
      
      console.log('Checking possible city fields:', possibleCityFields);
      
      // Find the first non-empty city field
      for (const field of possibleCityFields) {
        if (field && field.trim() && field !== 'Location') {
          locationForDisplay = field;
          console.log('Found city:', locationForDisplay);
          break;
        }
      }
      
      // If still no city, try to parse from address lines
      if (!locationForDisplay && location.storefrontAddress?.addressLines?.length > 0) {
        const addressText = location.storefrontAddress.addressLines.join(', ');
        console.log('Parsing address lines:', addressText);
        
        // Look for common patterns
        // Pattern: "..., Kakinada, ..." or "..., Kakinada 533003"
        const cityMatch = addressText.match(/,\s*([A-Za-z\s]+?)(?:\s+\d{6}|,)/);
        if (cityMatch) {
          locationForDisplay = cityMatch[1].trim();
          console.log('Extracted city from address pattern:', locationForDisplay);
        }
      }
      
      // Last resort: use any address component
      if (!locationForDisplay) {
        locationForDisplay = location.storefrontAddress?.addressLines?.[location.storefrontAddress.addressLines.length - 1] ||
                           location.storefrontAddress?.postalCode ||
                           location.storefrontAddress?.regionCode ||
                           '';
        console.log('Using last resort location:', locationForDisplay);
      }
      
      // Final cleanup
      locationForDisplay = locationForDisplay.trim();
      if (!locationForDisplay || locationForDisplay === 'Location') {
        locationForDisplay = 'your area'; // Better than "Location"
      }
      
      console.log('Final location for display:', locationForDisplay);
      
      // Extract place ID and location name
      const locationName = location.name || '';
      const placeId = location.metadata?.placeId || location.placeId || '';
      
      // Generate URL to our review suggestions page with the Google review link
      const baseUrl = window.location.origin;
      const reviewSuggestionsUrl = `${baseUrl}/review/${location.locationId}?business=${encodeURIComponent(businessName)}&location=${encodeURIComponent(locationForDisplay)}&placeId=${placeId}&locationName=${encodeURIComponent(locationName)}&googleReviewLink=${encodeURIComponent(googleReviewLink)}`;
      
      // Generate QR code that links to our review suggestions page
      const qrCodeDataUrl = await QRCode.toDataURL(reviewSuggestionsUrl, {
        width: 300,
        margin: 2,
        color: {
          dark: '#000000',
          light: '#FFFFFF'
        }
      });
      
      // Open modal with QR code
      setQrModalData({
        isOpen: true,
        locationName: businessName,
        locationId: location.locationId,
        address: locationForDisplay,
        placeId: location.placeId,
        qrCodeUrl: qrCodeDataUrl,
        reviewLink: reviewSuggestionsUrl,
        aiReviews: []
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

      {/* Connected Profiles */}
      {isConnected && !isLoading && accounts.length > 0 && (
        <div className="space-y-4">
          <h3 className="text-xl font-semibold">Your Business Locations</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {accounts.flatMap(account => 
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
                  </CardContent>
                </Card>
              ))
            )}
          </div>
        </div>
      )}

      {/* Empty state if no profiles */}
      {isConnected && !isLoading && accounts.length === 0 && (
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
                  <div className="bg-white p-6 rounded-lg border-2 border-gray-200 flex justify-center">
                    <img src={qrModalData.qrCodeUrl} alt="QR Code" className="max-w-full" />
                  </div>
                  
                  <div className="bg-blue-50 rounded-lg p-4">
                    <h4 className="font-semibold text-sm mb-2">How it works:</h4>
                    <ol className="text-sm space-y-1 text-muted-foreground">
                      <li>1. Customer scans QR code</li>
                      <li>2. Sees AI-generated review suggestions</li>
                      <li>3. Copies a suggestion or writes their own</li>
                      <li>4. Clicks "Write Review on Google"</li>
                    </ol>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={downloadQRCode}
                      className="flex-1"
                      variant="outline"
                    >
                      <Download className="mr-2 h-4 w-4" />
                      Download QR
                    </Button>
                    <Button
                      onClick={() => window.open(qrModalData.reviewLink, '_blank')}
                      className="flex-1"
                    >
                      <Star className="mr-2 h-4 w-4" />
                      Preview Page
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