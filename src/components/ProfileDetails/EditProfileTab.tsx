import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Edit, MapPin, Phone, Globe, Clock, Save, Loader2 } from 'lucide-react';
import { useGoogleBusinessProfile } from '@/hooks/useGoogleBusinessProfile';
import { BusinessLocation } from '@/lib/googleBusinessProfile';
import { useToast } from '@/hooks/use-toast';

interface EditProfileTabProps {
  profileId: string;
}

const EditProfileTab: React.FC<EditProfileTabProps> = ({ profileId }) => {
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [currentLocation, setCurrentLocation] = useState<BusinessLocation | null>(null);
  const { accounts } = useGoogleBusinessProfile();
  const { toast } = useToast();

  const [formData, setFormData] = useState({
    businessName: '',
    description: '',
    phone: '',
    website: '',
    address: '',
    hours: {
      monday: '',
      tuesday: '',
      wednesday: '',
      thursday: '',
      friday: '',
      saturday: '',
      sunday: '',
    }
  });

  // Load real data from Google Business Profile
  useEffect(() => {
    const loadLocationData = () => {
      if (!profileId || !accounts.length) {
        setIsLoading(false);
        return;
      }

      // Find the location in the accounts
      let foundLocation: BusinessLocation | null = null;
      for (const account of accounts) {
        foundLocation = account.locations.find(loc => loc.locationId === profileId) || null;
        if (foundLocation) break;
      }

      if (foundLocation) {
        setCurrentLocation(foundLocation);

        // Format address from the location object
        const addressParts = [];
        if (foundLocation.address.addressLines?.length) {
          addressParts.push(...foundLocation.address.addressLines);
        }
        if (foundLocation.address.locality) {
          addressParts.push(foundLocation.address.locality);
        }
        if (foundLocation.address.administrativeArea) {
          addressParts.push(foundLocation.address.administrativeArea);
        }
        if (foundLocation.address.postalCode) {
          addressParts.push(foundLocation.address.postalCode);
        }

        setFormData({
          businessName: foundLocation.displayName || '',
          description: '', // Google Business Profile doesn't always provide description in basic data
          phone: foundLocation.phoneNumber || '',
          website: foundLocation.websiteUrl || '',
          address: addressParts.join(', '),
          hours: {
            monday: '',
            tuesday: '',
            wednesday: '',
            thursday: '',
            friday: '',
            saturday: '',
            sunday: '',
          }
        });
      }

      setIsLoading(false);
    };

    loadLocationData();
  }, [profileId, accounts]);

  const handleInputChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleHoursChange = (day: string, value: string) => {
    setFormData(prev => ({
      ...prev,
      hours: { ...prev.hours, [day]: value }
    }));
  };

  const handleSave = async () => {
    if (!currentLocation) {
      toast({
        title: "Error",
        description: "No location data available",
        variant: "destructive"
      });
      return;
    }

    setIsSaving(true);
    try {
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';

      const updateData = {
        displayName: formData.businessName,
        phoneNumber: formData.phone,
        websiteUrl: formData.website,
        // Note: Address and hours updates require more complex API calls in Google Business Profile
        // For now, we'll focus on the basic fields that are more commonly editable
      };

      const response = await fetch(`${backendUrl}/api/locations/${profileId}/update`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(updateData)
      });

      if (response.ok) {
        const result = await response.json();

        // Update the current location data
        setCurrentLocation(prev => prev ? {
          ...prev,
          displayName: formData.businessName,
          phoneNumber: formData.phone,
          websiteUrl: formData.website,
        } : null);

        setIsEditing(false);

        toast({
          title: "Profile Updated",
          description: "Your business profile has been successfully updated.",
        });
      } else {
        const error = await response.json();
        throw new Error(error.message || 'Failed to update profile');
      }
    } catch (error) {
      console.error('Error updating profile:', error);
      toast({
        title: "Update Failed",
        description: error instanceof Error ? error.message : "Failed to update profile. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsSaving(false);
    }
  };

  const daysOfWeek = [
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="flex items-center justify-center py-8">
            <div className="flex items-center space-x-2">
              <Loader2 className="h-6 w-6 animate-spin" />
              <span>Loading profile data...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!currentLocation) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-8 text-center">
            <p className="text-muted-foreground">Profile not found or access denied.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5" />
              Edit Profile Information
            </CardTitle>
            <Button
              onClick={() => isEditing ? handleSave() : setIsEditing(true)}
              disabled={isSaving}
              className="flex items-center gap-2"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Saving...
                </>
              ) : isEditing ? (
                <>
                  <Save className="h-4 w-4" />
                  Save Changes
                </>
              ) : (
                <>
                  <Edit className="h-4 w-4" />
                  Edit Profile
                </>
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="businessName">Business Name</Label>
                <Input
                  id="businessName"
                  value={formData.businessName}
                  onChange={(e) => handleInputChange('businessName', e.target.value)}
                  disabled={!isEditing}
                />
              </div>
              
              <div>
                <Label htmlFor="phone">Phone Number</Label>
                <div className="flex items-center gap-2">
                  <Phone className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="phone"
                    value={formData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="website">Website</Label>
                <div className="flex items-center gap-2">
                  <Globe className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="website"
                    value={formData.website}
                    onChange={(e) => handleInputChange('website', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
              
              <div>
                <Label htmlFor="address">Address</Label>
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-muted-foreground" />
                  <Input
                    id="address"
                    value={formData.address}
                    onChange={(e) => handleInputChange('address', e.target.value)}
                    disabled={!isEditing}
                  />
                </div>
              </div>
            </div>
            
            <div>
              <Label htmlFor="description">Business Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => handleInputChange('description', e.target.value)}
                disabled={!isEditing}
                rows={8}
                placeholder="Describe your business, services, and what makes you unique..."
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Clock className="h-5 w-5" />
            Business Hours
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {daysOfWeek.map((day) => (
              <div key={day} className="flex items-center gap-4">
                <Label className="w-24 capitalize">{day}</Label>
                <Input
                  value={formData.hours[day as keyof typeof formData.hours]}
                  onChange={(e) => handleHoursChange(day, e.target.value)}
                  disabled={!isEditing}
                  placeholder="e.g., 9:00 AM - 6:00 PM or Closed"
                  className="flex-1"
                />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default EditProfileTab;