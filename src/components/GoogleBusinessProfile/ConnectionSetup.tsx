import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Building2,
  MapPin,
  Phone,
  Globe,
  CheckCircle,
  AlertCircle,
  RefreshCw,
  Unlink,
  Lock,
  Crown,
  Mail,
  Store,
  Briefcase
} from 'lucide-react';
import { FaGoogle } from 'react-icons/fa';
import { useGoogleBusinessProfile } from '@/hooks/useGoogleBusinessProfile';
import { useProfileLimitations } from '@/hooks/useProfileLimitations';
import { BusinessAccount, BusinessLocation } from '@/lib/googleBusinessProfile';

const ConnectionSetup: React.FC = () => {
  const {
    isConnected,
    isLoading,
    accounts,
    selectedAccount,
    selectedLocation,
    error,
    connectGoogleBusiness,
    disconnectGoogleBusiness,
    selectAccount,
    selectLocation,
    refreshAccounts,
  } = useGoogleBusinessProfile();

  const {
    canAccessMultipleProfiles,
    isAccountAccessible,
    isLocationAccessible,
    getAccountLockMessage,
    getLocationLockMessage,
    handleContactSupport
  } = useProfileLimitations();

  if (isLoading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <RefreshCw className="h-6 w-6 animate-spin mr-2" />
          <span>Loading Google Business Profile...</span>
        </CardContent>
      </Card>
    );
  }

  if (!isConnected) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FaGoogle className="h-5 w-5 text-[#4285F4]" />
            Connect Google Business Profile
          </CardTitle>
          <CardDescription>
            Connect your Google Business Profile to manage your business listings, posts, and reviews automatically.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h4 className="font-medium text-blue-900 mb-2">What you'll get:</h4>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Automatic profile synchronization</li>
              <li>• Real-time post management</li>
              <li>• Review monitoring and responses</li>
              <li>• Multi-location support</li>
              <li>• Analytics and insights</li>
            </ul>
          </div>
          
          {error && (
            <div className="bg-red-50 p-4 rounded-lg border border-red-200">
              <div className="flex items-center gap-2 text-red-800">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            </div>
          )}
          
          <Button 
            onClick={() => {
              console.log('🔴 DEBUGGING: Connect button clicked!');
              connectGoogleBusiness();
            }}
            className="w-full"
            size="lg"
          >
            <FaGoogle className="mr-2 h-4 w-4" />
            Connect Google Business Profile
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      {/* Connection Status */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <FaGoogle className="h-5 w-5 text-[#4285F4]" />
              <CardTitle>Google Business Profile</CardTitle>
              <Badge variant="secondary" className="bg-green-100 text-green-800">
                <CheckCircle className="h-3 w-3 mr-1" />
                Connected
              </Badge>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={refreshAccounts}
                disabled={isLoading}
              >
                <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
                Refresh
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={disconnectGoogleBusiness}
                disabled={isLoading}
              >
                <Unlink className="h-4 w-4 mr-2" />
                Disconnect
              </Button>
            </div>
          </div>
          <CardDescription>
            Your Google Business Profile is connected and syncing automatically.
          </CardDescription>
        </CardHeader>
      </Card>

      {/* No Accounts Found */}
      {isConnected && accounts.length === 0 && !isLoading && (
        <Card>
          <CardContent className="text-center py-8">
            <AlertCircle className="h-12 w-12 text-yellow-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">No Business Profiles Found</h3>
            <p className="text-muted-foreground mb-4">
              We couldn't find any Google Business Profiles associated with your account.
            </p>
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200 text-left">
              <h4 className="font-medium text-blue-900 mb-2">To get started:</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Create a Google Business Profile at <a href="https://business.google.com" target="_blank" rel="noopener noreferrer" className="underline">business.google.com</a></li>
                <li>• Verify your business location</li>
                <li>• Make sure you're signed in with the correct Google account</li>
                <li>• Ensure you have owner or manager permissions</li>
              </ul>
            </div>
            <Button 
              onClick={refreshAccounts}
              className="mt-4"
              disabled={isLoading}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${isLoading ? 'animate-spin' : ''}`} />
              Check Again
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Account Selection */}
      {accounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Account</CardTitle>
            <CardDescription>
              {canAccessMultipleProfiles
                ? "Select the Google Business account you want to manage."
                : "Select 1 Google Business account (upgrade to Enterprise for multiple accounts)."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {accounts.map((account, index) => {
              const isDisabled = !isAccountAccessible(index);

              return (
                <div
                  key={account.name}
                  className={`p-4 border rounded-lg transition-colors relative ${
                    isDisabled
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                      : selectedAccount?.name === account.name
                      ? 'border-primary bg-primary/5 cursor-pointer'
                      : 'border-border hover:border-primary/50 cursor-pointer'
                  }`}
                  onClick={() => !isDisabled && selectAccount(account)}
                >
                  {isDisabled && (
                    <div className="absolute top-2 right-2">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                  )}

                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        isDisabled ? 'bg-gray-100' : 'bg-primary/10'
                      }`}>
                        <Store className={`h-5 w-5 ${isDisabled ? 'text-gray-400' : 'text-primary'}`} />
                      </div>
                      <div>
                        <h4 className={`font-medium ${isDisabled ? 'text-gray-500' : ''}`}>
                          {account.accountName}
                          {isDisabled && <span className="ml-2 text-xs text-orange-600">(Requires Enterprise)</span>}
                        </h4>
                        <p className={`text-sm ${isDisabled ? 'text-gray-400' : 'text-muted-foreground'}`}>
                          {account.locations.length} location{account.locations.length !== 1 ? 's' : ''}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant={account.state === 'VERIFIED' ? 'default' : 'secondary'}>
                        {account.role}
                      </Badge>
                      {isDisabled && (
                        <Badge variant="outline" className="text-orange-600 border-orange-200">
                          <Crown className="h-3 w-3 mr-1" />
                          Pro
                        </Badge>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Enterprise upgrade prompt */}
            {!canAccessMultipleProfiles && accounts.length > 1 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-orange-900 mb-1">
                        Multiple Profiles Detected
                      </h4>
                      <p className="text-sm text-orange-800 mb-3">
                        {getAccountLockMessage(accounts.length)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleContactSupport('Multiple Business Accounts')}
                        className="border-orange-300 text-orange-700 hover:bg-orange-100"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Contact for Enterprise Plan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Location Selection */}
      {selectedAccount && selectedAccount.locations.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Choose Location</CardTitle>
            <CardDescription>
              {canAccessMultipleProfiles
                ? `Select the business location you want to manage from ${selectedAccount.accountName}.`
                : `Select 1 business location from ${selectedAccount.accountName} (upgrade to Enterprise for multiple locations).`}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {selectedAccount.locations.map((location, index) => {
              const isDisabled = !isLocationAccessible(index);

              return (
                <div
                  key={location.name}
                  className={`p-4 border rounded-lg transition-colors relative ${
                    isDisabled
                      ? 'border-gray-200 bg-gray-50 cursor-not-allowed opacity-60'
                      : selectedLocation?.name === location.name
                      ? 'border-primary bg-primary/5 cursor-pointer'
                      : 'border-border hover:border-primary/50 cursor-pointer'
                  }`}
                  onClick={() => !isDisabled && selectLocation(location)}
                >
                  {isDisabled && (
                    <div className="absolute top-2 right-2">
                      <Lock className="h-4 w-4 text-gray-400" />
                    </div>
                  )}

                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={`h-10 w-10 rounded-lg flex items-center justify-center ${
                        isDisabled ? 'bg-gray-100' : 'bg-blue-100'
                      }`}>
                        <MapPin className={`h-5 w-5 ${isDisabled ? 'text-gray-400' : 'text-blue-600'}`} />
                      </div>
                      <div className="flex-1">
                        <h4 className={`font-medium ${isDisabled ? 'text-gray-500' : ''}`}>
                          {location.displayName}
                          {isDisabled && <span className="ml-2 text-xs text-orange-600">(Requires Enterprise)</span>}
                        </h4>
                      
                      {/* Address */}
                      <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                        <MapPin className="h-3 w-3" />
                        <span>
                          {location.address.addressLines.join(', ')}, {location.address.locality}
                        </span>
                      </div>
                      
                      {/* Phone */}
                      {location.phoneNumber && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Phone className="h-3 w-3" />
                          <span>{location.phoneNumber}</span>
                        </div>
                      )}
                      
                      {/* Website */}
                      {location.websiteUrl && (
                        <div className="flex items-center gap-1 text-sm text-muted-foreground mt-1">
                          <Globe className="h-3 w-3" />
                          <span className="truncate max-w-xs">{location.websiteUrl}</span>
                        </div>
                      )}
                      
                      {/* Categories */}
                      {location.categories.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2">
                          {location.categories.slice(0, 2).map((category, index) => (
                            <Badge key={index} variant="outline" className="text-xs">
                              {category.name}
                            </Badge>
                          ))}
                          {location.categories.length > 2 && (
                            <Badge variant="outline" className="text-xs">
                              +{location.categories.length - 2} more
                            </Badge>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex flex-col items-end gap-1">
                    {location.metadata?.suspended && (
                      <Badge variant="destructive" className="text-xs">
                        Suspended
                      </Badge>
                    )}
                    {location.metadata?.duplicate && (
                      <Badge variant="secondary" className="text-xs">
                        Duplicate
                      </Badge>
                    )}
                    </div>
                  </div>
                </div>
              );
            })}

            {/* Enterprise upgrade prompt for locations */}
            {!canAccessMultipleProfiles && selectedAccount && selectedAccount.locations.length > 1 && (
              <Card className="border-orange-200 bg-orange-50">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <Crown className="h-5 w-5 text-orange-600 mt-0.5" />
                    <div className="flex-1">
                      <h4 className="font-medium text-orange-900 mb-1">
                        Multiple Locations Detected
                      </h4>
                      <p className="text-sm text-orange-800 mb-3">
                        {getLocationLockMessage(selectedAccount.locations.length)}
                      </p>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleContactSupport('Multiple Business Locations')}
                        className="border-orange-300 text-orange-700 hover:bg-orange-100"
                      >
                        <Mail className="h-4 w-4 mr-2" />
                        Contact for Enterprise Plan
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}
          </CardContent>
        </Card>
      )}

      {/* Selected Location Summary */}
      {selectedLocation && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="h-5 w-5 text-green-600" />
              Location Selected
            </CardTitle>
            <CardDescription>
              You're now managing {selectedLocation.displayName}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="bg-green-50 p-4 rounded-lg border border-green-200">
              <div className="flex items-center gap-2 text-green-800 mb-2">
                <CheckCircle className="h-4 w-4" />
                <span className="font-medium">Ready to manage your business!</span>
              </div>
              <p className="text-sm text-green-700">
                Your Google Business Profile is now connected and ready for automated management. 
                You can now create posts, monitor reviews, and track analytics.
              </p>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ConnectionSetup;
