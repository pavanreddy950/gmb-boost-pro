import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertCircle, RefreshCw, Building2 } from 'lucide-react';
import { useSimpleGoogleAuth } from '@/hooks/useSimpleGoogleAuth';

export const SimpleGoogleConnection: React.FC = () => {
  const { isConnected, isLoading, profiles, connect, disconnect } = useSimpleGoogleAuth();

  const handleRefresh = async () => {
    console.log('Refreshing profiles...');
    // Force a refresh by disconnecting and reconnecting
    if (isConnected) {
      try {
        await connect(); // This will reload the profiles
      } catch (error) {
        console.error('Error refreshing profiles:', error);
      }
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Building2 className="h-5 w-5" />
          Google Business Profile Connection
        </CardTitle>
        <CardDescription>
          Connect your Google Business Profile to manage posts and reviews
        </CardDescription>
      </CardHeader>
      
      <CardContent className="space-y-4">
        {!isConnected ? (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-4 w-4" />
              <span className="text-sm">Not connected to Google Business Profile</span>
            </div>
            
            <Button 
              onClick={connect} 
              disabled={isLoading}
              className="w-full"
            >
              {isLoading ? (
                <>
                  <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                  Connecting...
                </>
              ) : (
                'Connect Google Business Profile'
              )}
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle className="h-4 w-4" />
              <span className="text-sm font-medium">Connected to Google Business Profile</span>
            </div>

            {profiles.length > 0 && (
              <div className="space-y-3">
                <h4 className="font-medium text-sm">Your Business Profiles:</h4>
                {profiles.map((profile, index) => (
                  <div key={index} className="border rounded-lg p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">{profile.accountName}</h5>
                      <Badge variant={profile.state === 'VERIFIED' ? 'default' : 'secondary'}>
                        {profile.state}
                      </Badge>
                    </div>
                    
                    {profile.locations?.map((location: any, locIndex: number) => (
                      <div key={locIndex} className="ml-4 text-sm text-muted-foreground">
                        📍 {location.displayName}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-2">
              <Button 
                variant="outline" 
                onClick={handleRefresh}
                disabled={isLoading}
                className="flex-1"
              >
                {isLoading ? (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4 animate-spin" />
                    Refreshing...
                  </>
                ) : (
                  <>
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Refresh Profiles
                  </>
                )}
              </Button>
              
              <Button 
                variant="outline" 
                onClick={disconnect}
                className="flex-1"
              >
                Disconnect
              </Button>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
};
