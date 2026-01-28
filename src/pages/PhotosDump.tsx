import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Images,
  Upload,
  Trash2,
  Calendar,
  CheckCircle2,
  XCircle,
  Clock,
  ImagePlus,
  Loader2,
  RefreshCw,
  GripVertical,
  Zap,
  TrendingDown,
  HardDrive,
  MapPin
} from 'lucide-react';
import { useGoogleBusinessProfile } from '@/hooks/useGoogleBusinessProfile';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from '@/hooks/use-toast';

interface Photo {
  id: number;
  photo_id: string;
  original_filename: string;
  public_url: string;
  queue_position: number;
  status: 'pending' | 'used' | 'failed';
  original_size_bytes: number;
  compressed_size_bytes: number;
  compression_ratio: number;
  uploaded_at: string;
  error_message?: string;
}

interface LocationStats {
  locationId: string;
  businessName: string;
  total: number;
  pending: number;
  used: number;
  failed: number;
}

const PhotosDump = () => {
  const { accounts, isConnected, isLoading: googleLoading } = useGoogleBusinessProfile();
  const { currentUser } = useAuth();

  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [selectedLocationName, setSelectedLocationName] = useState<string>('');
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [locationStats, setLocationStats] = useState<LocationStats[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isDragging, setIsDragging] = useState(false);
  const [storageUsage, setStorageUsage] = useState({ totalMB: '0', savedMB: '0', photoCount: 0 });

  const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';
  const gmailId = currentUser?.email || '';

  // Get all locations from accounts
  const allLocations = accounts.flatMap(account =>
    account.locations.map(loc => ({
      locationId: loc.locationId,
      displayName: loc.displayName,
      address: loc.address?.locality || ''
    }))
  );

  // Fetch photos for selected location
  const fetchPhotos = useCallback(async () => {
    if (!selectedLocationId || !gmailId) return;

    setIsLoading(true);
    try {
      const response = await fetch(
        `${backendUrl}/api/photos/${selectedLocationId}?gmailId=${encodeURIComponent(gmailId)}`
      );
      const data = await response.json();

      if (data.success) {
        setPhotos(data.photos || []);
      }
    } catch (error) {
      console.error('Error fetching photos:', error);
      toast({
        title: 'Error',
        description: 'Failed to fetch photos',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  }, [selectedLocationId, gmailId, backendUrl]);

  // Fetch stats for all locations
  const fetchStats = useCallback(async () => {
    if (!gmailId) return;

    try {
      const response = await fetch(`${backendUrl}/api/photos/stats/${encodeURIComponent(gmailId)}`);
      const data = await response.json();

      if (data.success) {
        setLocationStats(data.locations || []);
        setStorageUsage(data.storage || { totalMB: '0', savedMB: '0', photoCount: 0 });
      }
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  }, [gmailId, backendUrl]);

  useEffect(() => {
    if (gmailId) {
      fetchStats();
    }
  }, [gmailId, fetchStats]);

  useEffect(() => {
    if (selectedLocationId) {
      fetchPhotos();
    }
  }, [selectedLocationId, fetchPhotos]);

  // Handle file drop
  const handleDrop = useCallback(async (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('image/')
    );

    if (files.length > 0) {
      await uploadFiles(files);
    }
  }, []);

  // Handle file input change
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length > 0) {
      await uploadFiles(files);
    }
  };

  // Upload files
  const uploadFiles = async (files: File[]) => {
    if (!selectedLocationId || !gmailId) {
      toast({
        title: 'Select a location',
        description: 'Please select a business location first',
        variant: 'destructive'
      });
      return;
    }

    const pendingCount = photos.filter(p => p.status === 'pending').length;
    if (pendingCount + files.length > 60) {
      toast({
        title: 'Too many photos',
        description: `Maximum 60 photos per location. You have ${pendingCount} pending, can add ${60 - pendingCount} more.`,
        variant: 'destructive'
      });
      return;
    }

    setIsUploading(true);
    setUploadProgress(0);

    try {
      const formData = new FormData();
      formData.append('gmailId', gmailId);
      formData.append('locationId', selectedLocationId);
      formData.append('businessName', selectedLocationName);

      files.forEach(file => {
        formData.append('photos', file);
      });

      const response = await fetch(`${backendUrl}/api/photos/upload`, {
        method: 'POST',
        body: formData
      });

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Upload Complete',
          description: `${data.uploaded} photo(s) uploaded successfully`,
        });
        fetchPhotos();
        fetchStats();
      } else {
        throw new Error(data.error || 'Upload failed');
      }
    } catch (error: any) {
      toast({
        title: 'Upload Failed',
        description: error.message || 'Failed to upload photos',
        variant: 'destructive'
      });
    } finally {
      setIsUploading(false);
      setUploadProgress(0);
    }
  };

  // Delete photo
  const deletePhoto = async (photoId: string) => {
    try {
      const response = await fetch(
        `${backendUrl}/api/photos/${photoId}?gmailId=${encodeURIComponent(gmailId)}`,
        { method: 'DELETE' }
      );

      const data = await response.json();

      if (data.success) {
        toast({
          title: 'Photo Deleted',
          description: 'Photo removed from queue',
        });
        fetchPhotos();
        fetchStats();
      }
    } catch (error) {
      toast({
        title: 'Error',
        description: 'Failed to delete photo',
        variant: 'destructive'
      });
    }
  };

  // Calculate stats
  const pendingPhotos = photos.filter(p => p.status === 'pending');
  const usedPhotos = photos.filter(p => p.status === 'used');
  const failedPhotos = photos.filter(p => p.status === 'failed');
  const daysRemaining = pendingPhotos.length;

  // Get stats for selected location
  const selectedLocationStats = locationStats.find(s => s.locationId === selectedLocationId);

  if (googleLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="space-y-4">
          <Skeleton className="h-12 w-64" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  if (!isConnected || allLocations.length === 0) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <Card className="border-2 border-yellow-200">
          <CardContent className="p-8 text-center">
            <Images className="h-16 w-16 mx-auto mb-4 text-yellow-500" />
            <h2 className="text-2xl font-bold mb-2">Connect Your Business</h2>
            <p className="text-muted-foreground">
              Connect your Google Business Profile to start uploading photos for auto-posting.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 max-w-6xl space-y-6">
      {/* Header Card */}
      <Card className="bg-gradient-to-r from-green-600 to-emerald-600 text-white border-0 shadow-lg">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 rounded-xl bg-white/20 backdrop-blur-sm flex items-center justify-center">
                <Images className="h-8 w-8 text-white" />
              </div>
              <div>
                <h1 className="text-2xl md:text-3xl font-bold text-white">
                  Auto Gallery
                </h1>
                <p className="text-green-100 text-sm md:text-base">
                  Upload photos once, auto-post daily for up to 60 days
                </p>
              </div>
            </div>

            {/* Location Selector */}
            <div className="flex items-center gap-3">
              <Select
                value={selectedLocationId}
                onValueChange={(value) => {
                  setSelectedLocationId(value);
                  const loc = allLocations.find(l => l.locationId === value);
                  setSelectedLocationName(loc?.displayName || '');
                }}
              >
                <SelectTrigger className="w-[280px] bg-white/95 border-0 text-gray-900 shadow-md">
                  <SelectValue placeholder="Select a location" />
                </SelectTrigger>
                <SelectContent>
                  {allLocations.map(location => {
                    const stats = locationStats.find(s => s.locationId === location.locationId);
                    return (
                      <SelectItem key={location.locationId} value={location.locationId}>
                        <div className="flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-green-600" />
                          <span>{location.displayName}</span>
                          {stats && stats.pending > 0 && (
                            <Badge variant="secondary" className="ml-2 bg-green-100 text-green-700">
                              {stats.pending} photos
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>

              <Button
                variant="secondary"
                size="icon"
                onClick={() => { fetchPhotos(); fetchStats(); }}
                className="bg-white/20 hover:bg-white/30 text-white border-0"
              >
                <RefreshCw className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Cards */}
      {selectedLocationId && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Days Remaining</p>
                  <p className="text-3xl font-bold text-green-600">{daysRemaining}</p>
                </div>
                <Calendar className="h-10 w-10 text-green-500 opacity-50" />
              </div>
              <Progress value={(daysRemaining / 60) * 100} className="mt-2 h-2" />
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-blue-50 to-indigo-50 border-blue-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Photos Used</p>
                  <p className="text-3xl font-bold text-blue-600">{usedPhotos.length}</p>
                </div>
                <CheckCircle2 className="h-10 w-10 text-blue-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-amber-50 to-orange-50 border-amber-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Space Saved</p>
                  <p className="text-3xl font-bold text-amber-600">{storageUsage.savedMB}MB</p>
                </div>
                <TrendingDown className="h-10 w-10 text-amber-500 opacity-50" />
              </div>
            </CardContent>
          </Card>

          <Card className="bg-gradient-to-br from-purple-50 to-pink-50 border-purple-200">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-muted-foreground">Storage Used</p>
                  <p className="text-3xl font-bold text-purple-600">{storageUsage.totalMB}MB</p>
                </div>
                <HardDrive className="h-10 w-10 text-purple-500 opacity-50" />
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Upload Zone */}
      {selectedLocationId && (
        <Card className="border-2 border-dashed border-green-300 hover:border-green-500 transition-colors">
          <CardContent className="p-8">
            <div
              className={`
                flex flex-col items-center justify-center gap-4 py-8 rounded-lg transition-all
                ${isDragging ? 'bg-green-100 scale-[1.02]' : 'bg-gradient-to-br from-green-50/50 to-emerald-50/50'}
                ${isUploading ? 'opacity-50 pointer-events-none' : ''}
              `}
              onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handleDrop}
            >
              {isUploading ? (
                <>
                  <Loader2 className="h-16 w-16 text-green-500 animate-spin" />
                  <p className="text-lg font-medium">Uploading & Compressing...</p>
                  <Progress value={uploadProgress} className="w-64 h-2" />
                </>
              ) : (
                <>
                  <div className="p-4 bg-green-100 rounded-full">
                    <ImagePlus className="h-12 w-12 text-green-600" />
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-medium">
                      {isDragging ? 'Drop photos here!' : 'Drag & drop photos here'}
                    </p>
                    <p className="text-sm text-muted-foreground mt-1">
                      or click to browse • Max 60 photos • JPG, PNG, WEBP
                    </p>
                  </div>
                  <label>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      className="hidden"
                      onChange={handleFileSelect}
                    />
                    <Button variant="default" className="bg-green-600 hover:bg-green-700" asChild>
                      <span>
                        <Upload className="h-4 w-4 mr-2" />
                        Select Photos
                      </span>
                    </Button>
                  </label>
                </>
              )}
            </div>

            <div className="flex items-center justify-center gap-6 mt-4 text-sm text-muted-foreground">
              <div className="flex items-center gap-1">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>Auto-compressed to ~50-100KB</span>
              </div>
              <div className="flex items-center gap-1">
                <Clock className="h-4 w-4 text-blue-500" />
                <span>1 photo = 1 day of posts</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Photo Queue Grid */}
      {selectedLocationId && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Images className="h-5 w-5" />
              Photo Queue
              {pendingPhotos.length > 0 && (
                <Badge variant="secondary">{pendingPhotos.length} pending</Badge>
              )}
            </CardTitle>
            <CardDescription>
              Photos are used in order. Drag to reorder.
            </CardDescription>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="aspect-square rounded-lg" />
                ))}
              </div>
            ) : photos.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <Images className="h-12 w-12 mx-auto mb-4 opacity-30" />
                <p>No photos uploaded yet</p>
                <p className="text-sm">Upload photos above to start auto-posting</p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
                {photos.map((photo, index) => (
                  <div
                    key={photo.photo_id}
                    className={`
                      relative group aspect-square rounded-lg overflow-hidden border-2 transition-all
                      ${photo.status === 'pending' ? 'border-green-300 hover:border-green-500' : ''}
                      ${photo.status === 'used' ? 'border-blue-300 opacity-60' : ''}
                      ${photo.status === 'failed' ? 'border-red-300' : ''}
                    `}
                  >
                    <img
                      src={photo.public_url}
                      alt={photo.original_filename}
                      className="w-full h-full object-cover"
                    />

                    {/* Queue Position Badge */}
                    {photo.status === 'pending' && (
                      <div className="absolute top-2 left-2 bg-green-600 text-white text-xs font-bold px-2 py-1 rounded-full">
                        #{photo.queue_position}
                      </div>
                    )}

                    {/* Status Badge */}
                    {photo.status === 'used' && (
                      <div className="absolute top-2 left-2 bg-blue-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <CheckCircle2 className="h-3 w-3" />
                        Used
                      </div>
                    )}
                    {photo.status === 'failed' && (
                      <div className="absolute top-2 left-2 bg-red-600 text-white text-xs font-bold px-2 py-1 rounded-full flex items-center gap-1">
                        <XCircle className="h-3 w-3" />
                        Failed
                      </div>
                    )}

                    {/* Compression Info */}
                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/70 to-transparent p-2">
                      <p className="text-white text-xs">
                        {(photo.compressed_size_bytes / 1024).toFixed(0)}KB
                        <span className="text-green-300 ml-1">
                          (-{((1 - photo.compression_ratio) * 100).toFixed(0)}%)
                        </span>
                      </p>
                    </div>

                    {/* Delete Button */}
                    {photo.status === 'pending' && (
                      <button
                        onClick={() => deletePhoto(photo.photo_id)}
                        className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-600"
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    )}

                    {/* Drag Handle */}
                    {photo.status === 'pending' && (
                      <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab">
                        <GripVertical className="h-8 w-8 text-white drop-shadow-lg" />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* No Location Selected */}
      {!selectedLocationId && (
        <Card className="border-2 border-dashed border-green-200 bg-gradient-to-br from-green-50/50 to-emerald-50/30">
          <CardContent className="p-16 text-center">
            <div className="w-24 h-24 mx-auto mb-6 rounded-full bg-gradient-to-br from-green-100 to-emerald-100 flex items-center justify-center">
              <Images className="h-12 w-12 text-green-600" />
            </div>
            <h3 className="text-2xl font-bold mb-3 bg-gradient-to-r from-green-600 to-emerald-600 bg-clip-text text-transparent">
              Select a Location
            </h3>
            <p className="text-muted-foreground max-w-md mx-auto mb-6">
              Choose a business location from the dropdown above to start managing its photo queue for automated daily posts
            </p>
            <div className="flex flex-wrap items-center justify-center gap-6 text-sm text-muted-foreground">
              <div className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-sm">
                <Upload className="h-4 w-4 text-green-500" />
                <span>Upload up to 60 photos</span>
              </div>
              <div className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-sm">
                <Zap className="h-4 w-4 text-yellow-500" />
                <span>Auto-compressed for fast loading</span>
              </div>
              <div className="flex items-center gap-2 bg-white/80 px-4 py-2 rounded-full shadow-sm">
                <Calendar className="h-4 w-4 text-blue-500" />
                <span>1 photo per day, automatically</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default PhotosDump;
