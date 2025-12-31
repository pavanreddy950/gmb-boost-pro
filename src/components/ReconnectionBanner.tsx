/**
 * Reconnection Banner Component
 *
 * Displays a persistent banner when Google Business Profile authentication expires.
 * Provides one-click reconnection and temporary dismissal options.
 */

import React, { useState, useEffect } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { googleBusinessProfileService } from '@/lib/googleBusinessProfile';
import { tokenInvalidationService } from '@/lib/tokenInvalidationService';
import { useToast } from '@/hooks/use-toast';

export const ReconnectionBanner: React.FC = () => {
  const [needsReauth, setNeedsReauth] = useState(false);
  const [reauthReason, setReauthReason] = useState<string>('');
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    // Check if reauth is already required on mount
    if (tokenInvalidationService.isReauthRequired()) {
      setNeedsReauth(true);
      const reason = tokenInvalidationService.getReauthReason() ||
        'Your Google Business Profile connection has expired. Please reconnect.';
      setReauthReason(reason);
    }

    // Listen for reauth events
    const unsubscribe = tokenInvalidationService.onReauthRequired((reason) => {
      console.log('[ReconnectionBanner] Reauth required:', reason);
      setNeedsReauth(true);
      setReauthReason(reason);
      setIsDismissed(false);

      // Show toast notification
      toast({
        title: "Reconnection Required",
        description: reason,
        variant: "destructive",
        duration: 10000,
      });
    });

    return unsubscribe;
  }, [toast]);

  const handleReconnect = async () => {
    setIsReconnecting(true);
    try {
      console.log('[ReconnectionBanner] Initiating reconnection...');
      await googleBusinessProfileService.connectGoogleBusiness();

      // Clear reauth state
      tokenInvalidationService.clearReauthState();
      setNeedsReauth(false);
      setReauthReason('');

      toast({
        title: "Reconnected Successfully",
        description: "Your Google Business Profile is now connected.",
      });

      // Reload the page to refresh all data
      setTimeout(() => {
        window.location.reload();
      }, 1000);

    } catch (error) {
      console.error('[ReconnectionBanner] Reconnection failed:', error);
      toast({
        title: "Reconnection Failed",
        description: "Please try again or check your Google account permissions.",
        variant: "destructive",
      });
    } finally {
      setIsReconnecting(false);
    }
  };

  const handleDismiss = () => {
    console.log('[ReconnectionBanner] Dismissing for 5 minutes...');
    setIsDismissed(true);

    toast({
      title: "Reminder Set",
      description: "We'll remind you again in 5 minutes.",
    });

    // Re-show banner after 5 minutes
    setTimeout(() => {
      setIsDismissed(false);
    }, 5 * 60 * 1000);
  };

  // Don't show banner if not needed or if dismissed
  if (!needsReauth || isDismissed) {
    return null;
  }

  return (
    <div className="fixed top-0 left-0 right-0 z-50 p-4 bg-gradient-to-b from-white to-transparent pointer-events-none">
      <div className="pointer-events-auto max-w-4xl mx-auto">
        <Alert variant="destructive" className="border-red-500 bg-red-50 dark:bg-red-950 shadow-xl animate-in slide-in-from-top-2 duration-500">
          <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
          <AlertTitle className="font-semibold text-red-900 dark:text-red-100">
            Google Business Profile Reconnection Required
          </AlertTitle>
          <AlertDescription className="mt-2">
            <p className="text-sm text-red-800 dark:text-red-200 mb-3">
              {reauthReason}
            </p>
            <div className="flex gap-2 flex-wrap">
              <Button
                size="sm"
                onClick={handleReconnect}
                disabled={isReconnecting}
                className="bg-red-600 hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-800 text-white shadow-md"
              >
                {isReconnecting ? (
                  <>
                    <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                    Reconnecting...
                  </>
                ) : (
                  <>
                    <img src="/ggg.png" alt="Google" className="h-4 w-4 mr-2" onError={(e) => {
                      // Fallback if image doesn't exist
                      e.currentTarget.style.display = 'none';
                    }} />
                    Reconnect Now
                  </>
                )}
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={handleDismiss}
                className="border-red-300 dark:border-red-700 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-900"
              >
                <X className="h-4 w-4 mr-2" />
                Remind in 5 Minutes
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </div>
    </div>
  );
};
