import React, { useState, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import {
  Upload,
  FileText,
  CheckCircle,
  X,
  Star,
  Mail,
  MessageSquare,
  Phone,
  Search,
  Download,
  Send,
  AlertCircle,
  Users,
  TrendingUp,
  Clock,
  Sparkles
} from "lucide-react";
import { useGoogleBusinessProfileContext } from "@/contexts/GoogleBusinessProfileContext";
import { toast } from "@/hooks/use-toast";

interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  hasReviewed: boolean;
  reviewDate?: string;
  reviewRating?: number;
  source: string; // csv
}

interface CsvAnalysis {
  totalCustomers: number;
  reviewedCustomers: number;
  pendingReviews: number;
  averageRating: number;
  completionRate: number;
}

const RequestForReviews = () => {
  const { accounts: businessAccounts, isConnected } = useGoogleBusinessProfileContext();
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [uploadedFile, setUploadedFile] = useState<File | null>(null);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [analysis, setAnalysis] = useState<CsvAnalysis | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [sendingRequests, setSendingRequests] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Get all locations from business accounts
  const allLocations = (businessAccounts || []).flatMap(account =>
    (account.locations || []).map(location => ({
      id: location.locationId,
      name: location.displayName,
      accountName: account.accountName,
      fullName: location.name
    }))
  );

  // Auto-select first location if available
  React.useEffect(() => {
    if (allLocations.length > 0 && !selectedLocationId) {
      setSelectedLocationId(allLocations[0].id);
    }
  }, [allLocations, selectedLocationId]);

  const selectedLocation = allLocations.find(loc => loc.id === selectedLocationId);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'text/csv') {
      setUploadedFile(file);
      analyzeCsvFile(file);
    } else {
      toast({
        title: "Invalid File",
        description: "Please upload a valid CSV file.",
        variant: "destructive",
      });
    }
  };

  const analyzeCsvFile = async (file: File) => {
    setIsAnalyzing(true);

    try {
      const text = await file.text();
      const lines = text.split('\n');
      const headers = lines[0].split(',').map(h => h.trim().toLowerCase());

      // Expected headers: name, email, phone (optional)
      const nameIndex = headers.findIndex(h => h.includes('name'));
      const emailIndex = headers.findIndex(h => h.includes('email'));
      const phoneIndex = headers.findIndex(h => h.includes('phone'));

      if (nameIndex === -1 || emailIndex === -1) {
        throw new Error('CSV must contain at least Name and Email columns');
      }

      const parsedCustomers: Customer[] = [];

      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length >= 2 && values[nameIndex] && values[emailIndex]) {

          // Simulate review check (in real app, this would check against Google Business Profile reviews)
          const hasReviewed = Math.random() > 0.7; // 30% have reviewed
          const reviewDate = hasReviewed ? new Date(Date.now() - Math.random() * 90 * 24 * 60 * 60 * 1000).toISOString() : undefined;
          const reviewRating = hasReviewed ? Math.floor(Math.random() * 2) + 4 : undefined; // 4-5 stars

          parsedCustomers.push({
            id: `customer-${i}`,
            name: values[nameIndex],
            email: values[emailIndex],
            phone: phoneIndex !== -1 ? values[phoneIndex] : undefined,
            hasReviewed,
            reviewDate,
            reviewRating,
            source: 'csv'
          });
        }
      }

      setCustomers(parsedCustomers);

      // Calculate analysis
      const reviewedCount = parsedCustomers.filter(c => c.hasReviewed).length;
      const avgRating = parsedCustomers
        .filter(c => c.reviewRating)
        .reduce((sum, c) => sum + (c.reviewRating || 0), 0) / reviewedCount || 0;

      const analysisResult: CsvAnalysis = {
        totalCustomers: parsedCustomers.length,
        reviewedCustomers: reviewedCount,
        pendingReviews: parsedCustomers.length - reviewedCount,
        averageRating: avgRating,
        completionRate: (reviewedCount / parsedCustomers.length) * 100
      };

      setAnalysis(analysisResult);

      toast({
        title: "Analysis Complete!",
        description: `Analyzed ${parsedCustomers.length} customers. ${parsedCustomers.length - reviewedCount} need review requests.`,
      });

    } catch (error) {
      toast({
        title: "Analysis Failed",
        description: error instanceof Error ? error.message : "Failed to analyze CSV file.",
        variant: "destructive",
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleSendRequests = async (method: 'email' | 'sms' | 'whatsapp') => {
    const customersToContact = selectedCustomers.length > 0
      ? customers.filter(c => selectedCustomers.includes(c.id) && !c.hasReviewed)
      : customers.filter(c => !c.hasReviewed);

    if (customersToContact.length === 0) {
      toast({
        title: "No Customers Selected",
        description: "Please select customers who haven't reviewed yet.",
        variant: "destructive",
      });
      return;
    }

    setSendingRequests(true);

    try {
      // Simulate sending requests
      for (let i = 0; i < customersToContact.length; i++) {
        await new Promise(resolve => setTimeout(resolve, 500)); // Simulate API call
      }

      toast({
        title: `${method.toUpperCase()} Requests Sent!`,
        description: `Review requests sent to ${customersToContact.length} customers via ${method}.`,
      });

      setSelectedCustomers([]);

    } catch (error) {
      toast({
        title: "Failed to Send",
        description: "There was an error sending review requests. Please try again.",
        variant: "destructive",
      });
    } finally {
      setSendingRequests(false);
    }
  };

  const toggleCustomerSelection = (customerId: string) => {
    setSelectedCustomers(prev =>
      prev.includes(customerId)
        ? prev.filter(id => id !== customerId)
        : [...prev, customerId]
    );
  };

  const selectAllNonReviewed = () => {
    const nonReviewedIds = customers.filter(c => !c.hasReviewed).map(c => c.id);
    setSelectedCustomers(nonReviewedIds);
  };

  if (!isConnected) {
    return (
      <div className="h-full flex items-center justify-center p-6">
        <Card className="max-w-md w-full">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
              <Upload className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Connect Google Business Profile</CardTitle>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-muted-foreground mb-4">
              Connect your Google Business Profile to analyze customer reviews and send requests.
            </p>
            <Button asChild>
              <a href="/dashboard/settings">Go to Settings</a>
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="relative p-3 sm:p-4 md:p-6 space-y-4 sm:space-y-6 min-h-[calc(100vh-4rem)]">
      {/* Coming Soon Overlay - Fully Responsive */}
      <div className="absolute inset-0 z-10 flex items-start justify-center backdrop-blur-sm bg-background/90 p-4 pt-8 sm:pt-12 overflow-y-auto">
        <Card className="w-full max-w-xs sm:max-w-md md:max-w-lg mx-auto shadow-2xl border-2 animate-fade-in">
          <CardContent className="pt-8 sm:pt-10 md:pt-12 pb-6 sm:pb-8 md:pb-10 px-4 sm:px-6 md:px-8 text-center">
            {/* Icons - Responsive sizing */}
            <div className="mb-4 sm:mb-6 flex items-center justify-center gap-2 sm:gap-3">
              <div className="relative">
                <div className="absolute inset-0 animate-ping">
                  <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary/60" />
                </div>
                <Sparkles className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary relative" />
              </div>
              <Clock className="h-8 w-8 sm:h-10 sm:w-10 md:h-12 md:w-12 text-primary animate-pulse" />
            </div>

            {/* Title - Responsive text size */}
            <h2 className="text-2xl sm:text-3xl md:text-4xl font-bold mb-3 sm:mb-4 bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
              Coming Soon
            </h2>

            {/* Description - Responsive text */}
            <p className="text-sm sm:text-base md:text-lg text-muted-foreground mb-4 sm:mb-6 leading-relaxed px-2">
              We're working hard to bring you an amazing review request feature.
              This powerful tool will help you collect more reviews effortlessly!
            </p>

            {/* Expected launch - Responsive */}
            <div className="flex items-center justify-center gap-2 text-xs sm:text-sm text-muted-foreground mb-4 sm:mb-6">
              <Clock className="h-3 w-3 sm:h-4 sm:w-4" />
              <span>Expected launch: Coming very soon</span>
            </div>

            {/* Notify button - Responsive */}
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t">
              <p className="text-xs sm:text-sm text-muted-foreground mb-3">
                Get notified when this feature launches
              </p>
              <Button className="w-full h-10 sm:h-11 text-sm sm:text-base">
                <Mail className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
                <span>Notify Me</span>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold">Request for Reviews</h1>
        <p className="text-muted-foreground">
          Upload customer data, analyze review status, and send automated review requests
        </p>
      </div>

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="upload">Upload & Analyze</TabsTrigger>
          <TabsTrigger value="customers">Customer List</TabsTrigger>
          <TabsTrigger value="send">Send Requests</TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Location Selector */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Users className="h-5 w-5" />
                Select Business Location
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {allLocations.map((location) => {
                  const isSelected = selectedLocationId === location.id;
                  return (
                    <div
                      key={location.id}
                      className={`relative rounded-lg border-2 transition-all duration-200 cursor-pointer ${
                        isSelected
                          ? 'border-primary bg-primary/5 shadow-md'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => setSelectedLocationId(location.id)}
                    >
                      <div className="p-4">
                        <h3 className="font-medium text-sm leading-tight break-words">{location.name}</h3>
                        <p className="text-xs text-muted-foreground mt-1 break-words">{location.accountName}</p>
                        {isSelected && (
                          <Badge className="mt-2 text-xs">
                            Selected
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* File Upload */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Upload className="h-5 w-5" />
                Upload Customer Data
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Upload a CSV file with customer information to analyze review status
              </p>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="border-2 border-dashed border-border rounded-lg p-8 text-center">
                <Upload className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                <div className="space-y-2">
                  <h3 className="font-medium">Upload CSV File</h3>
                  <p className="text-sm text-muted-foreground">
                    CSV should contain columns: Name, Email, Phone (optional)
                  </p>
                </div>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isAnalyzing}
                  className="mt-4"
                >
                  {isAnalyzing ? (
                    <>
                      <Search className="h-4 w-4 mr-2 animate-spin" />
                      Analyzing...
                    </>
                  ) : (
                    <>
                      <FileText className="h-4 w-4 mr-2" />
                      Choose CSV File
                    </>
                  )}
                </Button>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              {uploadedFile && (
                <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                  <div className="flex items-center gap-2">
                    <FileText className="h-4 w-4 text-primary" />
                    <span className="text-sm font-medium">{uploadedFile.name}</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setUploadedFile(null);
                      setCustomers([]);
                      setAnalysis(null);
                    }}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              )}

              {isAnalyzing && (
                <div className="space-y-2">
                  <Progress value={66} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    Analyzing customer data and checking review status...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* Analysis Results */}
          {analysis && (
            <Card>
              <CardHeader>
                <CardTitle className="text-lg flex items-center gap-2">
                  <TrendingUp className="h-5 w-5" />
                  Analysis Results
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-bold text-blue-600">{analysis.totalCustomers}</div>
                    <div className="text-sm text-muted-foreground">Total Customers</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-green-600">{analysis.reviewedCustomers}</div>
                    <div className="text-sm text-muted-foreground">Have Reviewed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-orange-600">{analysis.pendingReviews}</div>
                    <div className="text-sm text-muted-foreground">Need Reviews</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-bold text-purple-600">{analysis.completionRate.toFixed(1)}%</div>
                    <div className="text-sm text-muted-foreground">Review Rate</div>
                  </div>
                </div>

                {analysis.averageRating > 0 && (
                  <div className="mt-4 p-3 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <Star className="h-4 w-4 text-yellow-500" />
                      <span className="text-sm font-medium">
                        Average Rating: {analysis.averageRating.toFixed(1)} / 5
                      </span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>

        <TabsContent value="customers" className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-lg flex items-center gap-2">
                  <Users className="h-5 w-5" />
                  Customer List ({customers.length})
                </CardTitle>
                {customers.length > 0 && (
                  <Button onClick={selectAllNonReviewed} variant="outline" size="sm">
                    Select All Non-Reviewed
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {customers.length > 0 ? (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {customers.map((customer) => (
                    <div
                      key={customer.id}
                      className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                        selectedCustomers.includes(customer.id)
                          ? 'border-primary bg-primary/5'
                          : 'border-border hover:border-primary/50'
                      }`}
                      onClick={() => toggleCustomerSelection(customer.id)}
                    >
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{customer.name}</h4>
                          {customer.hasReviewed ? (
                            <Badge variant="default">
                              <CheckCircle className="h-3 w-3 mr-1" />
                              Reviewed
                            </Badge>
                          ) : (
                            <Badge variant="secondary">
                              <AlertCircle className="h-3 w-3 mr-1" />
                              Pending
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">{customer.email}</p>
                        {customer.phone && (
                          <p className="text-xs text-muted-foreground">{customer.phone}</p>
                        )}
                      </div>

                      {customer.hasReviewed && customer.reviewRating && (
                        <div className="flex items-center gap-1">
                          <Star className="h-4 w-4 text-yellow-500 fill-current" />
                          <span className="text-sm font-medium">{customer.reviewRating}</span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Users className="h-12 w-12 mx-auto mb-4 text-muted-foreground" />
                  <p className="text-muted-foreground">No customer data uploaded yet</p>
                  <p className="text-sm text-muted-foreground">
                    Upload a CSV file to see customer analysis
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="send" className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Send className="h-5 w-5" />
                Send Review Requests
              </CardTitle>
              <p className="text-sm text-muted-foreground">
                Send review requests to customers who haven't reviewed yet
              </p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="p-4 bg-blue-50 rounded-lg">
                <div className="flex items-center gap-2 mb-2">
                  <AlertCircle className="h-4 w-4 text-blue-600" />
                  <span className="font-medium text-blue-800">Ready to Send</span>
                </div>
                <p className="text-sm text-blue-700">
                  {selectedCustomers.length > 0
                    ? `${selectedCustomers.filter(id => !customers.find(c => c.id === id)?.hasReviewed).length} selected customers`
                    : `${customers.filter(c => !c.hasReviewed).length} customers without reviews`
                  } will receive review requests.
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center">
                    <Mail className="h-8 w-8 mx-auto mb-2 text-blue-600" />
                    <h3 className="font-medium mb-2">Email</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Send professional review request emails
                    </p>
                    <Button
                      onClick={() => handleSendRequests('email')}
                      disabled={sendingRequests || customers.filter(c => !c.hasReviewed).length === 0}
                      className="w-full"
                      size="sm"
                    >
                      {sendingRequests ? 'Sending...' : 'Send via Email'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center">
                    <Phone className="h-8 w-8 mx-auto mb-2 text-green-600" />
                    <h3 className="font-medium mb-2">SMS</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Send review requests via text message
                    </p>
                    <Button
                      onClick={() => handleSendRequests('sms')}
                      disabled={sendingRequests || customers.filter(c => !c.hasReviewed && c.phone).length === 0}
                      className="w-full"
                      size="sm"
                    >
                      {sendingRequests ? 'Sending...' : 'Send via SMS'}
                    </Button>
                  </CardContent>
                </Card>

                <Card className="cursor-pointer hover:shadow-md transition-shadow">
                  <CardContent className="p-4 text-center">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 text-green-500" />
                    <h3 className="font-medium mb-2">WhatsApp</h3>
                    <p className="text-xs text-muted-foreground mb-4">
                      Send requests via WhatsApp messaging
                    </p>
                    <Button
                      onClick={() => handleSendRequests('whatsapp')}
                      disabled={sendingRequests || customers.filter(c => !c.hasReviewed && c.phone).length === 0}
                      className="w-full"
                      size="sm"
                    >
                      {sendingRequests ? 'Sending...' : 'Send via WhatsApp'}
                    </Button>
                  </CardContent>
                </Card>
              </div>

              {sendingRequests && (
                <div className="space-y-2">
                  <Progress value={75} className="w-full" />
                  <p className="text-sm text-muted-foreground text-center">
                    Sending review requests to customers...
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default RequestForReviews;