import React, { useState, useEffect, useRef } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Upload, Image, Camera, Trash2, RefreshCw, AlertCircle, ExternalLink, CheckCircle, X } from 'lucide-react';
import { googleBusinessProfileService } from '@/lib/googleBusinessProfile';

interface PhotosTabProps {
  profileId: string;
}

interface PhotoData {
  id: string;
  name: string;
  url: string;
  thumbnailUrl: string;
  mediaFormat: string;
  category: string;
  createTime: string;
  dimensions: {
    width: number;
    height: number;
  };
}

const PhotosTab: React.FC<PhotosTabProps> = ({ profileId }) => {
  const [photos, setPhotos] = useState<PhotoData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string>('');
  const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  // Load photos on component mount
  useEffect(() => {
    loadPhotos();
  }, [profileId]);

  const loadPhotos = async () => {
    try {
      setLoading(true);
      setError(null);
      
      console.log('📸 Loading photos for location:', profileId);
      const photosData = await googleBusinessProfileService.getLocationPhotos(profileId);
      
      console.log('📸 Received photos data:', photosData);
      setPhotos(photosData);
      
      if (photosData.length === 0) {
        setError('No photos found for this location. Photos can be added via Google Business Profile manager.');
      }
    } catch (err) {
      console.error('Failed to load photos:', err);
      setError('Failed to load photos. Please check your connection and try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = () => {
    loadPhotos();
  };

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files;
    if (files) {
      const fileArray = Array.from(files);
      // Validate file types and sizes
      const validFiles = fileArray.filter(file => {
        const isValidType = file.type.startsWith('image/');
        const isValidSize = file.size <= 10 * 1024 * 1024; // 10MB limit
        return isValidType && isValidSize;
      });

      if (validFiles.length !== fileArray.length) {
        setError('Some files were rejected. Please select only image files under 10MB.');
      }

      setSelectedFiles(validFiles);
    }
  };

  const removeSelectedFile = (index: number) => {
    setSelectedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const uploadPhotos = async () => {
    if (selectedFiles.length === 0) return;

    setUploading(true);
    setUploadProgress('');
    setError(null);

    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000';

      // Get access token from googleBusinessProfileService
      const accessToken = googleBusinessProfileService.getAccessToken();
      if (!accessToken) {
        throw new Error('No access token available. Please reconnect your Google Business Profile.');
      }

      for (let i = 0; i < selectedFiles.length; i++) {
        const file = selectedFiles[i];
        setUploadProgress(`Uploading ${i + 1} of ${selectedFiles.length}: ${file.name}`);

        // Step 1: Start upload
        const startResponse = await fetch(`${backendUrl}/api/locations/${profileId}/photos/start-upload`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            fileName: file.name,
            mimeType: file.type
          })
        });

        if (!startResponse.ok) {
          throw new Error(`Failed to start upload for ${file.name}`);
        }

        const { uploadUrl, resourceName } = await startResponse.json();

        // Step 2: Upload bytes
        const uploadResponse = await fetch(`${backendUrl}/api/locations/${profileId}/photos/upload-bytes`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            uploadUrl,
            fileData: await fileToBase64(file)
          })
        });

        if (!uploadResponse.ok) {
          throw new Error(`Failed to upload bytes for ${file.name}`);
        }

        // Step 3: Create media
        const createResponse = await fetch(`${backendUrl}/api/locations/${profileId}/photos/create-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${accessToken}`,
          },
          body: JSON.stringify({
            resourceName
          })
        });

        if (!createResponse.ok) {
          throw new Error(`Failed to create media for ${file.name}`);
        }

        setUploadProgress(`Successfully uploaded ${i + 1} of ${selectedFiles.length}`);
      }

      // Clear selected files and close dialog
      setSelectedFiles([]);
      setUploadDialogOpen(false);

      // Refresh photos list
      loadPhotos();

      setUploadProgress('');
    } catch (err) {
      console.error('Upload failed:', err);
      setError(`Upload failed: ${err instanceof Error ? err.message : 'Unknown error'}`);
    } finally {
      setUploading(false);
      setUploadProgress('');
    }
  };

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          // Remove data:image/jpeg;base64, prefix
          const base64 = reader.result.split(',')[1];
          resolve(base64);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = error => reject(error);
    });
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Camera className="h-5 w-5" />
              Business Photos
              {photos.length > 0 && (
                <span className="text-sm font-normal text-muted-foreground">
                  ({photos.length} real-time)
                </span>
              )}
            </CardTitle>
            <div className="flex items-center gap-2">
              <Button 
                variant="outline" 
                size="sm" 
                onClick={handleRefresh}
                disabled={loading}
                className="flex items-center gap-2"
              >
                <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {/* Loading State */}
          {loading && (
            <div className="flex items-center justify-center py-12">
              <div className="flex items-center gap-2 text-muted-foreground">
                <RefreshCw className="h-5 w-5 animate-spin" />
                Loading photos from Google Business Profile...
              </div>
            </div>
          )}

          {/* Error State */}
          {error && !loading && (
            <div className="flex items-center gap-2 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <AlertCircle className="h-5 w-5 text-yellow-600" />
              <div>
                <p className="text-yellow-800 font-medium">Photos not available</p>
                <p className="text-yellow-700 text-sm">{error}</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleRefresh}
                  className="mt-2"
                >
                  Try Again
                </Button>
              </div>
            </div>
          )}

          {/* Photos Content */}
          {!loading && !error && photos.length > 0 && (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {photos.map((photo) => (
                  <Card key={photo.id} className="overflow-hidden group">
                    <div className="relative aspect-square">
                      <img
                        src={photo.thumbnailUrl || photo.url}
                        alt={`Business photo - ${photo.category}`}
                        className="w-full h-full object-cover transition-transform group-hover:scale-105"
                        onError={(e) => {
                          const img = e.target as HTMLImageElement;
                          img.src = 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMzAwIiBoZWlnaHQ9IjMwMCIgdmlld0JveD0iMCAwIDMwMCAzMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PHJlY3Qgd2lkdGg9IjMwMCIgaGVpZ2h0PSIzMDAiIGZpbGw9IiNGM0Y0RjYiLz48cGF0aCBkPSJNMTUwIDEyMEMyNi4xNSAxMjAgMTA1IDEzOC44NSAxMDUgMTYyQzEwNSAxODUuMTUgMTI2LjE1IDIwNCAxNTAgMjA0QzE3My44NSAyMDQgMTk1IDE4NS4xNSAxOTUgMTYyQzE5NSAxMzguODUgMTczLjg1IDEyMCAxNTAgMTIwWiIgZmlsbD0iIzlDQTNBRiIvPjwvc3ZnPg==';
                        }}
                      />
                      <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <Button 
                          size="sm" 
                          variant="secondary" 
                          className="mr-2"
                          onClick={() => window.open(photo.url, '_blank')}
                        >
                          <Image className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <CardContent className="p-3">
                      <p className="text-sm font-medium truncate">
                        {photo.category.replace('_', ' ').toLowerCase().replace(/^\w/, c => c.toUpperCase())}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {photo.mediaFormat} • {new Date(photo.createTime).toLocaleDateString()}
                      </p>
                      {photo.dimensions.width > 0 && (
                        <p className="text-xs text-muted-foreground">
                          {photo.dimensions.width} × {photo.dimensions.height}
                        </p>
                      )}
                    </CardContent>
                  </Card>
                ))}
            </div>
          )}

          {/* No Photos State */}
          {!loading && !error && photos.length === 0 && (
            <div className="mt-6 p-6 border-2 border-dashed border-muted rounded-lg text-center">
              <Camera className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-medium mb-2">No Photos Found</h3>
              <p className="text-muted-foreground mb-4">
                This location doesn't have any photos yet. Add photos via Google Business Profile manager to see them here.
              </p>
              <Button onClick={handleRefresh}>
                <RefreshCw className="h-4 w-4 mr-2" />
                Check Again
              </Button>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default PhotosTab;