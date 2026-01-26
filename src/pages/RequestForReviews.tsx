import React, { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileText,
  Star,
  Mail,
  MessageSquare,
  Phone,
  Send,
  Users,
  TrendingUp,
  Sparkles,
  RefreshCw,
  Trash2,
  Eye,
  MousePointer,
  BarChart3,
  Loader2,
  CheckCircle2,
  XCircle,
  Clock
} from "lucide-react";
import { useGoogleBusinessProfileContext } from "@/contexts/GoogleBusinessProfileContext";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "@/hooks/use-toast";

// API base URL
const API_BASE = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

// CSS for animations
const animationStyles = `
  @keyframes float {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-20px) rotate(5deg); }
  }
  @keyframes float-reverse {
    0%, 100% { transform: translateY(0px) rotate(0deg); }
    50% { transform: translateY(-15px) rotate(-5deg); }
  }
  @keyframes pulse-glow {
    0%, 100% { box-shadow: 0 0 20px rgba(139, 92, 246, 0.3); }
    50% { box-shadow: 0 0 40px rgba(139, 92, 246, 0.6), 0 0 60px rgba(236, 72, 153, 0.3); }
  }
  @keyframes gradient-shift {
    0% { background-position: 0% 50%; }
    50% { background-position: 100% 50%; }
    100% { background-position: 0% 50%; }
  }
  @keyframes bounce-soft {
    0%, 100% { transform: translateY(0); }
    50% { transform: translateY(-10px); }
  }
  @keyframes sparkle {
    0%, 100% { opacity: 1; transform: scale(1); }
    50% { opacity: 0.5; transform: scale(1.2); }
  }
  @keyframes slide-up {
    from { opacity: 0; transform: translateY(30px); }
    to { opacity: 1; transform: translateY(0); }
  }
  .animate-float { animation: float 6s ease-in-out infinite; }
  .animate-float-reverse { animation: float-reverse 5s ease-in-out infinite; }
  .animate-pulse-glow { animation: pulse-glow 3s ease-in-out infinite; }
  .animate-gradient { background-size: 200% 200%; animation: gradient-shift 4s ease infinite; }
  .animate-bounce-soft { animation: bounce-soft 2s ease-in-out infinite; }
  .animate-sparkle { animation: sparkle 2s ease-in-out infinite; }
  .animate-slide-up { animation: slide-up 0.8s ease-out forwards; }
`;

interface Customer {
  id: string;
  customer_name: string;
  customer_email: string;
  customer_phone?: string;
  has_reviewed: boolean;
  review_date?: string;
  review_rating?: number;
  email_status: 'pending' | 'sent' | 'failed' | 'opened';
  email_sent_at?: string;
  email_opened_at?: string;
  email_clicked_at?: string;
  created_at: string;
}

interface TrackingStats {
  totalCustomers: number;
  totalSent: number;
  opened: number;
  clicked: number;
  reviewed: number;
  openRate: number;
  clickRate: number;
  reviewRate: number;
  clickToReviewRate: number;
}

interface LocationStats {
  totalCustomers: number;
  pendingReviews: number;
  reviewed: number;
  emailsSent: number;
  emailsPending: number;
  emailsFailed: number;
  emailsOpened: number;
  emailsClicked: number;
}

interface Batch {
  id: string;
  file_name: string;
  file_type: string;
  total_customers: number;
  valid_customers: number;
  duplicate_customers: number;
  emails_sent: number;
  emails_pending: number;
  status: string;
  created_at: string;
}

const RequestForReviews = () => {
  const { accounts: businessAccounts, isConnected } = useGoogleBusinessProfileContext();
  const { currentUser } = useAuth();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);
  const [trackingStats, setTrackingStats] = useState<TrackingStats | null>(null);
  const [locationStats, setLocationStats] = useState<LocationStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isSending, setIsSending] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [isDeletingBatch, setIsDeletingBatch] = useState<string | null>(null);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [reviewLink, setReviewLink] = useState<string>('');
  const [customSenderName, setCustomSenderName] = useState<string>('');
  const [uploadProgress, setUploadProgress] = useState(0);
  const [sendProgress, setSendProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all locations from business accounts
  const allLocations = (businessAccounts || []).flatMap(account =>
    (account.locations || []).map(location => ({
      id: location.locationId,
      name: location.displayName,
      accountName: account.accountName,
      fullName: location.name,
      placeId: location.metadata?.placeId
    }))
  );

  // Auto-select first location if available
  useEffect(() => {
    if (allLocations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(allLocations[0].id);
    }
  }, [allLocations, selectedLocationId]);

  const selectedLocation = allLocations.find(loc => loc.id === selectedLocationId);

  // Generate Google review link from place ID and set default sender name
  useEffect(() => {
    if (selectedLocation?.placeId) {
      setReviewLink(`https://search.google.com/local/writereview?placeid=${selectedLocation.placeId}`);
    }
    if (selectedLocation?.name && !customSenderName) {
      setCustomSenderName(selectedLocation.name);
    }
  }, [selectedLocation, customSenderName]);

  // Load customers when location changes
  const loadCustomers = useCallback(async () => {
    if (!currentUser?.email || !selectedLocationId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/v2/review-requests/customers?userId=${encodeURIComponent(currentUser.email)}&locationId=${encodeURIComponent(selectedLocationId)}`
      );
      const data = await response.json();

      if (data.success) {
        setCustomers(data.customers || []);
      }
    } catch (error) {
      console.error('Failed to load customers:', error);
    } finally {
      setIsLoading(false);
    }
  }, [currentUser?.email, selectedLocationId]);

  // Load stats when location changes
  const loadStats = useCallback(async () => {
    if (!currentUser?.email || !selectedLocationId) return;

    try {
      const [statsRes, trackingRes] = await Promise.all([
        fetch(`${API_BASE}/api/v2/review-requests/stats?userId=${encodeURIComponent(currentUser.email)}&locationId=${encodeURIComponent(selectedLocationId)}`),
        fetch(`${API_BASE}/api/v2/review-requests/tracking-stats?userId=${encodeURIComponent(currentUser.email)}&locationId=${encodeURIComponent(selectedLocationId)}`)
      ]);

      const statsData = await statsRes.json();
      const trackingData = await trackingRes.json();

      if (statsData.success) {
        setLocationStats(statsData.stats);
      }
      if (trackingData.success) {
        setTrackingStats(trackingData.stats);
      }
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }, [currentUser?.email, selectedLocationId]);

  // Load batches (uploaded files)
  const loadBatches = useCallback(async () => {
    if (!currentUser?.email || !selectedLocationId) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/v2/review-requests/batches?userId=${encodeURIComponent(currentUser.email)}&locationId=${encodeURIComponent(selectedLocationId)}`
      );
      const data = await response.json();

      if (data.success) {
        setBatches(data.batches || []);
      }
    } catch (error) {
      console.error('Failed to load batches:', error);
    }
  }, [currentUser?.email, selectedLocationId]);

  // Delete a batch and all its customers
  const handleDeleteBatch = async (batchId: string) => {
    if (!currentUser?.email) return;

    setIsDeletingBatch(batchId);
    try {
      const response = await fetch(
        `${API_BASE}/api/v2/review-requests/batch/${batchId}?userId=${encodeURIComponent(currentUser.email)}`,
        { method: 'DELETE' }
      );
      const data = await response.json();

      if (data.success) {
        setBatches(prev => prev.filter(b => b.id !== batchId));
        toast({ title: "Batch Deleted", description: "All customers from this upload have been removed." });
        await loadCustomers();
        await loadStats();
      } else {
        throw new Error(data.error || 'Failed to delete batch');
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete batch.",
        variant: "destructive",
      });
    } finally {
      setIsDeletingBatch(null);
    }
  };

  // Load data when location changes
  useEffect(() => {
    if (selectedLocationId) {
      loadCustomers();
      loadStats();
      loadBatches();
    }
  }, [selectedLocationId, loadCustomers, loadStats, loadBatches]);

  // Handle file upload
  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const ext = file.name.split('.').pop()?.toLowerCase();
    if (!['csv', 'xlsx', 'xls'].includes(ext || '')) {
      toast({
        title: "Invalid File",
        description: "Please upload a CSV or Excel file.",
        variant: "destructive",
      });
      return;
    }

    if (!currentUser?.email || !selectedLocationId || !selectedLocation) {
      toast({
        title: "Select Location",
        description: "Please select a business location first.",
        variant: "destructive",
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('userId', currentUser.email);
      formData.append('locationId', selectedLocationId);
      formData.append('locationName', selectedLocation.name);
      formData.append('businessName', selectedLocation.name);
      formData.append('reviewLink', reviewLink);

      // Simulate progress
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => Math.min(prev + 10, 90));
      }, 200);

      const response = await fetch(`${API_BASE}/api/v2/review-requests/upload`, {
        method: 'POST',
        body: formData,
      });

      clearInterval(progressInterval);
      setUploadProgress(100);

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Upload Complete!",
          description: `Imported ${data.newCustomers} new customers (${data.duplicates} duplicates skipped).`,
        });
        await loadCustomers();
        await loadStats();
        await loadBatches();
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error) {
      toast({
        title: "Upload Failed",
        description: error instanceof Error ? error.message : "Failed to upload file.",
        variant: "destructive",
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle send review requests - ONLY sends to selected customers
  const handleSendRequests = async () => {
    if (!currentUser?.email || !selectedLocationId || !selectedLocation) return;

    // REQUIRE customer selection - no automatic fallback
    if (selectedCustomers.length === 0) {
      toast({
        title: "Select Customers",
        description: "Please select the customers you want to send review requests to.",
        variant: "destructive",
      });
      return;
    }

    const customersToSend = customers.filter(
      c => selectedCustomers.includes(c.id) && c.email_status === 'pending'
    );

    if (customersToSend.length === 0) {
      toast({
        title: "No Customers to Send",
        description: "All customers have already received review requests or are selected.",
        variant: "destructive",
      });
      return;
    }

    setIsSending(true);
    setSendProgress({ current: 0, total: customersToSend.length });

    try {
      const response = await fetch(`${API_BASE}/api/v2/review-requests/send`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: currentUser.email,
          locationId: selectedLocationId,
          customerIds: selectedCustomers, // Always send selected customers
          businessName: selectedLocation.name,
          reviewLink: reviewLink,
          customSenderName: customSenderName || selectedLocation.name,
        }),
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: "Emails Sent!",
          description: `Successfully sent ${data.sent} review request emails. ${data.failed} failed.`,
        });
        setSelectedCustomers([]);
        await loadCustomers();
        await loadStats();
      } else {
        throw new Error(data.error || 'Failed to send emails');
      }
    } catch (error) {
      toast({
        title: "Send Failed",
        description: error instanceof Error ? error.message : "Failed to send review requests.",
        variant: "destructive",
      });
    } finally {
      setIsSending(false);
      setSendProgress({ current: 0, total: 0 });
    }
  };

  // Handle sync reviews (match Google reviews with customers)
  const handleSyncReviews = async () => {
    if (!currentUser?.email || !selectedLocationId) return;

    setIsSyncing(true);

    try {
      // In a real implementation, you would fetch reviews from Google Business Profile API
      // For now, we'll just call the sync endpoint with empty reviews
      // The frontend would need to fetch reviews from the GBP context

      toast({
        title: "Syncing Reviews",
        description: "This feature requires Google Business Profile reviews data. Coming soon!",
      });
    } catch (error) {
      toast({
        title: "Sync Failed",
        description: error instanceof Error ? error.message : "Failed to sync reviews.",
        variant: "destructive",
      });
    } finally {
      setIsSyncing(false);
    }
  };

  // Handle delete customer
  const handleDeleteCustomer = async (customerId: string) => {
    if (!currentUser?.email) return;

    try {
      const response = await fetch(
        `${API_BASE}/api/v2/review-requests/customer/${customerId}?userId=${encodeURIComponent(currentUser.email)}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        setCustomers(prev => prev.filter(c => c.id !== customerId));
        toast({ title: "Customer Deleted" });
      }
    } catch (error) {
      toast({
        title: "Delete Failed",
        description: "Failed to delete customer.",
        variant: "destructive",
      });
    }
  };

  // Toggle customer selection
  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  // Select all pending customers
  const selectAllPending = () => {
    const pendingIds = customers.filter(c => c.email_status === 'pending').map(c => c.id);
    setSelectedCustomers(pendingIds);
  };

  // Get status badge for customer
  const getStatusBadge = (customer: Customer) => {
    if (customer.has_reviewed) {
      return (
        <Badge className="bg-green-100 text-green-700 border-green-200">
          <Star className="h-3 w-3 mr-1 fill-current" />
          Reviewed
        </Badge>
      );
    }
    if (customer.email_clicked_at) {
      return (
        <Badge className="bg-purple-100 text-purple-700 border-purple-200">
          <MousePointer className="h-3 w-3 mr-1" />
          Clicked
        </Badge>
      );
    }
    if (customer.email_opened_at) {
      return (
        <Badge className="bg-blue-100 text-blue-700 border-blue-200">
          <Eye className="h-3 w-3 mr-1" />
          Opened
        </Badge>
      );
    }
    if (customer.email_status === 'sent') {
      return (
        <Badge className="bg-cyan-100 text-cyan-700 border-cyan-200">
          <Mail className="h-3 w-3 mr-1" />
          Sent
        </Badge>
      );
    }
    if (customer.email_status === 'failed') {
      return (
        <Badge className="bg-red-100 text-red-700 border-red-200">
          <XCircle className="h-3 w-3 mr-1" />
          Failed
        </Badge>
      );
    }
    return (
      <Badge className="bg-gray-100 text-gray-700 border-gray-200">
        <Clock className="h-3 w-3 mr-1" />
        Pending
      </Badge>
    );
  };

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="max-w-md w-full shadow-xl border-0">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-gradient-to-br from-violet-500 to-pink-500 flex items-center justify-center shadow-lg">
              <Upload className="h-8 w-8 text-white" />
            </div>
            <CardTitle className="text-xl">Connect Google Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Connect your Google Business Profile to send review requests to customers.
            </p>
            <Button asChild className="bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600">
              <a href="/dashboard/settings">Go to Settings</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 min-h-[calc(100vh-4rem)] overflow-hidden">
      {/* Inject animation styles */}
      <style>{animationStyles}</style>

      {/* Animated Background Gradient */}
      <div className="absolute inset-0 -z-10 opacity-30">
        <div className="absolute top-0 left-1/4 w-96 h-96 bg-violet-400 rounded-full mix-blend-multiply filter blur-3xl animate-float opacity-20" />
        <div className="absolute top-1/3 right-1/4 w-96 h-96 bg-pink-400 rounded-full mix-blend-multiply filter blur-3xl animate-float-reverse opacity-20" style={{ animationDelay: '2s' }} />
        <div className="absolute bottom-0 left-1/2 w-96 h-96 bg-cyan-400 rounded-full mix-blend-multiply filter blur-3xl animate-float opacity-20" style={{ animationDelay: '4s' }} />
      </div>

      {/* Header - Animated */}
      <div className="animate-slide-up">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 rounded-xl bg-gradient-to-br from-violet-500 to-pink-500 shadow-lg shadow-violet-500/25 animate-bounce-soft">
            <Mail className="h-6 w-6 text-white" />
          </div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-violet-600 via-pink-500 to-cyan-500 bg-clip-text text-transparent">
            Request for Reviews
          </h1>
          <Sparkles className="h-5 w-5 text-amber-500 animate-sparkle" />
        </div>
        <p className="text-muted-foreground ml-1">
          Upload customer data, send review request emails, and track conversions
        </p>
      </div>

      {/* Stats Cards */}
      {trackingStats && trackingStats.totalSent > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 animate-slide-up" style={{ animationDelay: '0.1s' }}>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30">
            <CardContent className="p-4 text-center">
              <Mail className="h-6 w-6 mx-auto mb-2 text-blue-600" />
              <div className="text-2xl font-bold text-blue-700">{trackingStats.totalSent}</div>
              <div className="text-xs text-blue-600">Sent</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-cyan-50 to-cyan-100 dark:from-cyan-900/30 dark:to-cyan-800/30">
            <CardContent className="p-4 text-center">
              <Eye className="h-6 w-6 mx-auto mb-2 text-cyan-600" />
              <div className="text-2xl font-bold text-cyan-700">{trackingStats.opened}</div>
              <div className="text-xs text-cyan-600">Opened ({trackingStats.openRate}%)</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30">
            <CardContent className="p-4 text-center">
              <MousePointer className="h-6 w-6 mx-auto mb-2 text-purple-600" />
              <div className="text-2xl font-bold text-purple-700">{trackingStats.clicked}</div>
              <div className="text-xs text-purple-600">Clicked ({trackingStats.clickRate}%)</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30">
            <CardContent className="p-4 text-center">
              <Star className="h-6 w-6 mx-auto mb-2 text-green-600" />
              <div className="text-2xl font-bold text-green-700">{trackingStats.reviewed}</div>
              <div className="text-xs text-green-600">Reviewed ({trackingStats.reviewRate}%)</div>
            </CardContent>
          </Card>
          <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30">
            <CardContent className="p-4 text-center">
              <BarChart3 className="h-6 w-6 mx-auto mb-2 text-amber-600" />
              <div className="text-2xl font-bold text-amber-700">{trackingStats.clickToReviewRate}%</div>
              <div className="text-xs text-amber-600">Click → Review</div>
            </CardContent>
          </Card>
        </div>
      )}

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 bg-gradient-to-r from-violet-100/50 via-pink-100/50 to-cyan-100/50 dark:from-violet-900/20 dark:via-pink-900/20 dark:to-cyan-900/20 p-1 rounded-xl border border-violet-200/50 dark:border-violet-800/50">
          <TabsTrigger value="upload" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-300 data-[state=active]:text-violet-600">
            <Upload className="h-4 w-4 mr-2" />
            Upload
          </TabsTrigger>
          <TabsTrigger value="customers" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-300 data-[state=active]:text-pink-600">
            <Users className="h-4 w-4 mr-2" />
            Customers ({customers.length})
          </TabsTrigger>
          <TabsTrigger value="send" className="data-[state=active]:bg-white dark:data-[state=active]:bg-gray-800 data-[state=active]:shadow-md rounded-lg transition-all duration-300 data-[state=active]:text-cyan-600">
            <Send className="h-4 w-4 mr-2" />
            Send
          </TabsTrigger>
        </TabsList>

        {/* UPLOAD TAB */}
        <TabsContent value="upload" className="space-y-6">
          {/* Location & Sender Name - Compact Row */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Location Selector Dropdown */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-violet-50 via-white to-pink-50 dark:from-violet-900/20 dark:via-gray-800 dark:to-pink-900/20 border-2 border-violet-200 dark:border-violet-700 shadow-lg hover:shadow-xl transition-shadow">
              <Label htmlFor="location" className="text-sm font-semibold flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-violet-500 to-pink-500 shadow-md shadow-violet-500/30">
                  <Users className="h-4 w-4 text-white" />
                </div>
                <span className="text-violet-900 dark:text-violet-100">Business Location</span>
              </Label>
              <Select
                value={selectedLocationId}
                onValueChange={(value) => {
                  const loc = allLocations.find(l => l.id === value);
                  setSelectedLocationId(value);
                  if (loc) setCustomSenderName(loc.name);
                }}
              >
                <SelectTrigger className="w-full h-12 px-4 rounded-xl border-2 border-violet-300 dark:border-violet-600 bg-white dark:bg-gray-800 text-sm font-medium focus:ring-2 focus:ring-violet-500 focus:border-violet-500 shadow-md hover:border-violet-400 hover:bg-violet-50/50 dark:hover:bg-violet-900/30 transition-all">
                  <SelectValue placeholder="Select a location..." />
                </SelectTrigger>
                <SelectContent className="rounded-xl border-2 border-violet-200 dark:border-violet-700 shadow-2xl bg-white dark:bg-gray-800 overflow-hidden p-1">
                  {allLocations.map((location) => (
                    <SelectItem
                      key={location.id}
                      value={location.id}
                      className="py-3 pl-10 pr-4 cursor-pointer hover:bg-gradient-to-r hover:from-violet-50 hover:to-pink-50 dark:hover:from-violet-900/30 dark:hover:to-pink-900/30 focus:bg-gradient-to-r focus:from-violet-100 focus:to-pink-100 dark:focus:from-violet-900/50 dark:focus:to-pink-900/50 transition-all rounded-lg my-0.5 font-medium"
                    >
                      {location.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {selectedLocation && (
                <p className="text-xs text-violet-600 dark:text-violet-400 mt-2 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  {selectedLocation.name}
                </p>
              )}
            </div>

            {/* Custom Sender Name - Compact */}
            <div className="relative p-5 rounded-xl bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-blue-900/20 dark:via-gray-800 dark:to-cyan-900/20 border-2 border-blue-200 dark:border-blue-700 shadow-lg hover:shadow-xl transition-shadow">
              <Label htmlFor="senderName" className="text-sm font-semibold flex items-center gap-2 mb-3">
                <div className="p-2 rounded-lg bg-gradient-to-br from-blue-500 to-cyan-500 shadow-md shadow-blue-500/30">
                  <Mail className="h-4 w-4 text-white" />
                </div>
                <span className="text-blue-900 dark:text-blue-100">Email Sender Name</span>
              </Label>
              <Input
                id="senderName"
                value={customSenderName}
                onChange={(e) => setCustomSenderName(e.target.value)}
                placeholder="Your Business Name"
                className="h-11 px-4 border-2 border-blue-200 dark:border-blue-600 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium shadow-inner"
              />
            </div>
          </div>

          {/* File Upload */}
          <Card className="border-0 shadow-xl bg-gradient-to-r from-cyan-500/5 via-blue-500/5 to-violet-500/5">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500">
                  <Upload className="h-4 w-4 text-white" />
                </div>
                Upload Customer Data
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a CSV or Excel file with customer information (Name, Email, Phone)
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div
                className={`border-2 border-dashed rounded-xl p-8 text-center transition-all duration-300 ${
                  isUploading
                    ? 'border-violet-400 bg-violet-50/50 dark:bg-violet-900/20'
                    : 'border-gray-300 hover:border-violet-400 hover:bg-violet-50/30 dark:hover:bg-violet-900/10'
                }`}
              >
                {isUploading ? (
                  <>
                    <Loader2 className="h-12 w-12 mx-auto mb-4 text-violet-500 animate-spin" />
                    <div className="space-y-2">
                      <h3 className="font-medium">Uploading & Processing...</h3>
                      <Progress value={uploadProgress} className="w-full max-w-xs mx-auto" />
                      <p className="text-sm text-muted-foreground">{uploadProgress}%</p>
                    </div>
                  </>
                ) : (
                  <>
                    <Upload className="h-12 w-12 mx-auto mb-4 text-gray-400" />
                    <div className="space-y-2">
                      <h3 className="font-medium">Upload CSV or Excel File</h3>
                      <p className="text-sm text-muted-foreground">
                        File should contain columns: <span className="font-medium">Name</span>, <span className="font-medium">Email</span>, <span className="font-medium">Phone</span> (optional)
                      </p>
                    </div>
                    <Button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        fileInputRef.current?.click();
                      }}
                      disabled={!selectedLocationId}
                      className="mt-4 bg-gradient-to-r from-violet-600 to-pink-500 hover:from-violet-700 hover:to-pink-600"
                    >
                      <FileText className="h-4 w-4 mr-2" />
                      Choose File
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".csv,.xlsx,.xls"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                    />
                  </>
                )}
              </div>
            </CardContent>
          </Card>

          {/* Customer Stats Summary */}
          {customers.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
              <Card className="border-0 shadow-lg bg-gradient-to-br from-gray-50 to-gray-100 dark:from-gray-800 dark:to-gray-900">
                <CardContent className="p-4 text-center">
                  <Users className="h-5 w-5 mx-auto mb-1 text-gray-600" />
                  <div className="text-2xl font-bold">{customers.length}</div>
                  <div className="text-xs text-muted-foreground">Total</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-900/30 dark:to-amber-800/30">
                <CardContent className="p-4 text-center">
                  <Clock className="h-5 w-5 mx-auto mb-1 text-amber-600" />
                  <div className="text-2xl font-bold text-amber-700">{customers.filter(c => c.email_status === 'pending').length}</div>
                  <div className="text-xs text-amber-600">Pending</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-blue-50 to-blue-100 dark:from-blue-900/30 dark:to-blue-800/30">
                <CardContent className="p-4 text-center">
                  <Mail className="h-5 w-5 mx-auto mb-1 text-blue-600" />
                  <div className="text-2xl font-bold text-blue-700">{customers.filter(c => c.email_status === 'sent' || c.email_opened_at).length}</div>
                  <div className="text-xs text-blue-600">Sent</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-900/30 dark:to-purple-800/30">
                <CardContent className="p-4 text-center">
                  <MousePointer className="h-5 w-5 mx-auto mb-1 text-purple-600" />
                  <div className="text-2xl font-bold text-purple-700">{customers.filter(c => c.email_clicked_at).length}</div>
                  <div className="text-xs text-purple-600">Clicked</div>
                </CardContent>
              </Card>
              <Card className="border-0 shadow-lg bg-gradient-to-br from-green-50 to-green-100 dark:from-green-900/30 dark:to-green-800/30">
                <CardContent className="p-4 text-center">
                  <Star className="h-5 w-5 mx-auto mb-1 text-green-600" />
                  <div className="text-2xl font-bold text-green-700">{customers.filter(c => c.has_reviewed).length}</div>
                  <div className="text-xs text-green-600">Reviewed</div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Review Link */}
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-amber-500 to-orange-500">
                  <Star className="h-4 w-4 text-white" />
                </div>
                Google Review Link
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                <Label htmlFor="reviewLink">Review Link (auto-generated from Place ID)</Label>
                <Input
                  id="reviewLink"
                  value={reviewLink}
                  onChange={(e) => setReviewLink(e.target.value)}
                  placeholder="https://search.google.com/local/writereview?placeid=..."
                  className="font-mono text-sm"
                />
                <p className="text-xs text-muted-foreground">
                  This link will be included in review request emails. Customers click this to leave a review.
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Uploaded Batches */}
          {batches.length > 0 && (
            <Card className="border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-green-500 to-emerald-500">
                    <FileText className="h-4 w-4 text-white" />
                  </div>
                  Uploaded Files ({batches.length})
                </CardTitle>
                <p className="text-sm text-muted-foreground">
                  Manage your uploaded customer lists
                </p>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {batches.map((batch) => (
                    <div
                      key={batch.id}
                      className="flex items-center justify-between p-4 rounded-lg border border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:shadow-md transition-all"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-blue-500" />
                          <h4 className="font-medium truncate">{batch.file_name}</h4>
                          <Badge variant="outline" className="text-xs">
                            {batch.file_type.toUpperCase()}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                          <span>{batch.valid_customers} customers</span>
                          {batch.duplicate_customers > 0 && (
                            <span className="text-amber-600">{batch.duplicate_customers} duplicates</span>
                          )}
                          <span>{batch.emails_sent} sent</span>
                          <span>{batch.emails_pending} pending</span>
                        </div>
                        <p className="text-xs text-muted-foreground mt-1">
                          Uploaded {new Date(batch.created_at).toLocaleDateString()} at {new Date(batch.created_at).toLocaleTimeString()}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDeleteBatch(batch.id)}
                        disabled={isDeletingBatch === batch.id}
                        className="text-red-500 hover:text-red-700 hover:bg-red-50"
                      >
                        {isDeletingBatch === batch.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>

        {/* CUSTOMERS TAB */}
        <TabsContent value="customers" className="space-y-6">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <div className="flex items-center justify-between flex-wrap gap-4">
                <CardTitle className="text-lg flex items-center gap-2">
                  <div className="p-1.5 rounded-lg bg-gradient-to-br from-pink-500 to-rose-500">
                    <Users className="h-4 w-4 text-white" />
                  </div>
                  Customer List ({customers.length})
                </CardTitle>
                <div className="flex gap-2">
                  <Button onClick={loadCustomers} variant="outline" size="sm" disabled={isLoading}>
                    <RefreshCw className={`h-4 w-4 mr-1 ${isLoading ? 'animate-spin' : ''}`} />
                    Refresh
                  </Button>
                  {customers.filter(c => c.email_status === 'pending').length > 0 && (
                    <Button onClick={selectAllPending} variant="outline" size="sm">
                      Select All Pending ({customers.filter(c => c.email_status === 'pending').length})
                    </Button>
                  )}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <div className="text-center py-12">
                  <Loader2 className="h-8 w-8 mx-auto mb-4 animate-spin text-violet-500" />
                  <p className="text-muted-foreground">Loading customers...</p>
                </div>
              ) : customers.length > 0 ? (
                <div className="space-y-2 max-h-[500px] overflow-y-auto pr-2">
                  {/* Selection summary */}
                  {selectedCustomers.length > 0 && (
                    <div className="p-3 rounded-lg bg-violet-50 dark:bg-violet-900/30 border border-violet-200 dark:border-violet-700 mb-4">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-violet-700 dark:text-violet-300">
                          {selectedCustomers.length} customer(s) selected
                        </span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setSelectedCustomers([])}
                          className="text-violet-600 hover:text-violet-800 h-7 text-xs"
                        >
                          Clear Selection
                        </Button>
                      </div>
                    </div>
                  )}
                  {customers.map((customer) => {
                    const isSelected = selectedCustomers.includes(customer.id);
                    const isPending = customer.email_status === 'pending';
                    return (
                      <div
                        key={customer.id}
                        className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          isSelected
                            ? 'border-violet-400 bg-violet-50 dark:bg-violet-900/20'
                            : 'border-gray-200 dark:border-gray-700 hover:border-violet-300'
                        }`}
                        onClick={() => toggleCustomerSelection(customer.id)}
                      >
                        {/* Checkbox */}
                        <Checkbox
                          checked={isSelected}
                          onCheckedChange={() => toggleCustomerSelection(customer.id)}
                          className="h-5 w-5"
                          onClick={(e) => e.stopPropagation()}
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="font-medium truncate">{customer.customer_name}</h4>
                            {getStatusBadge(customer)}
                            {!isPending && (
                              <span className="text-xs text-muted-foreground">(already sent)</span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground truncate">{customer.customer_email}</p>
                          {customer.customer_phone && (
                            <p className="text-xs text-muted-foreground">{customer.customer_phone}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-2 ml-2">
                          {customer.has_reviewed && customer.review_rating && (
                            <div className="flex items-center gap-1 px-2 py-1 bg-yellow-50 rounded-full">
                              <Star className="h-3 w-3 text-yellow-500 fill-current" />
                              <span className="text-xs font-medium">{customer.review_rating}</span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteCustomer(customer.id);
                            }}
                            className="h-8 w-8 p-0 text-gray-400 hover:text-red-500"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <Users className="h-12 w-12 mx-auto mb-4 text-gray-300" />
                  <p className="text-muted-foreground">No customers uploaded yet</p>
                  <p className="text-sm text-muted-foreground mt-1">
                    Upload a CSV or Excel file to get started
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* SEND TAB */}
        <TabsContent value="send" className="space-y-6">
          <Card className="border-0 shadow-xl">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <div className="p-1.5 rounded-lg bg-gradient-to-br from-cyan-500 to-blue-500">
                  <Send className="h-4 w-4 text-white" />
                </div>
                Send Review Requests
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Send personalized review request emails to your customers
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Selection Status */}
              {selectedCustomers.length === 0 ? (
                <div className="p-4 rounded-xl bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200/50">
                  <div className="flex items-center gap-2 mb-2">
                    <Users className="h-5 w-5 text-amber-600" />
                    <span className="font-medium text-amber-800 dark:text-amber-200">No Customers Selected</span>
                  </div>
                  <p className="text-sm text-amber-700 dark:text-amber-300">
                    Go to the <strong>Customers</strong> tab and select the customers you want to send review requests to.
                  </p>
                </div>
              ) : (
                <div className="p-4 rounded-xl bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/30 dark:to-emerald-900/30 border border-green-200/50">
                  <div className="flex items-center gap-2 mb-2">
                    <CheckCircle2 className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-800 dark:text-green-200">Ready to Send</span>
                  </div>
                  <p className="text-sm text-green-700 dark:text-green-300">
                    <strong>{selectedCustomers.filter(id => customers.find(c => c.id === id)?.email_status === 'pending').length}</strong> selected customers will receive review request emails.
                    {selectedCustomers.some(id => customers.find(c => c.id === id)?.email_status !== 'pending') && (
                      <span className="block mt-1 text-amber-600">
                        ({selectedCustomers.filter(id => customers.find(c => c.id === id)?.email_status !== 'pending').length} already sent - will be skipped)
                      </span>
                    )}
                  </p>
                </div>
              )}

              {/* Send Progress */}
              {isSending && (
                <div className="space-y-2">
                  <Progress value={(sendProgress.current / sendProgress.total) * 100} className="w-full" />
                  <p className="text-sm text-center text-muted-foreground">
                    Sending {sendProgress.current} of {sendProgress.total} emails...
                  </p>
                </div>
              )}

              {/* Send Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="border-2 border-blue-200 hover:border-blue-400 transition-all hover:shadow-lg cursor-pointer">
                  <CardContent className="p-6 text-center">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-blue-500 to-blue-600 flex items-center justify-center">
                      <Mail className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-medium mb-2">Email</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Send beautiful review request emails
                    </p>
                    <Button
                      onClick={handleSendRequests}
                      disabled={isSending || customers.filter(c => c.email_status === 'pending').length === 0}
                      className="w-full bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700"
                    >
                      {isSending ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Sending...
                        </>
                      ) : (
                        'Send via Email'
                      )}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-green-200 hover:border-green-400 transition-all hover:shadow-lg cursor-pointer opacity-50">
                  <CardContent className="p-6 text-center">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center">
                      <Phone className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-medium mb-2">SMS</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Send review requests via text
                    </p>
                    <Button disabled className="w-full">
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>

                <Card className="border-2 border-emerald-200 hover:border-emerald-400 transition-all hover:shadow-lg cursor-pointer opacity-50">
                  <CardContent className="p-6 text-center">
                    <div className="h-12 w-12 mx-auto mb-3 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-600 flex items-center justify-center">
                      <MessageSquare className="h-6 w-6 text-white" />
                    </div>
                    <h3 className="font-medium mb-2">WhatsApp</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Send via WhatsApp messaging
                    </p>
                    <Button disabled className="w-full">
                      Coming Soon
                    </Button>
                  </CardContent>
                </Card>
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequestForReviews;
