import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, CreditCard, AlertTriangle, Clock, X } from 'lucide-react';

interface UpgradeModalProps {
  isOpen: boolean;
  daysRemaining?: number;
  status: 'trial' | 'expired' | 'none';
}

export const UpgradeModal: React.FC<UpgradeModalProps> = ({
  isOpen,
  daysRemaining = 0,
  status
}) => {
  const navigate = useNavigate();
  const [showModal, setShowModal] = useState(isOpen);
  const [dismissed, setDismissed] = useState(false);
  const [userDismissedPermanently, setUserDismissedPermanently] = useState(false);
  const isExpired = status === 'expired';
  
  useEffect(() => {
    setShowModal(isOpen);
  }, [isOpen]);

  // Handle dismiss - give user more control
  const handleDismiss = () => {
    setShowModal(false);
    setDismissed(true);

    // Only show modal again after 5 minutes for trial users
    // Don't re-show for expired users unless they reload the page
    if (status === 'trial' && daysRemaining > 0) {
      setTimeout(() => {
        setShowModal(true);
        setDismissed(false);
      }, 5 * 60 * 1000); // 5 minutes for trial users
    } else {
      // For expired users, don't auto-show modal again
      setUserDismissedPermanently(true);
    }
  };

  // Don't show modal if not needed or user permanently dismissed
  if (!isOpen || userDismissedPermanently) return null;

  return (
    <>
      <Dialog open={showModal} onOpenChange={() => {}}>
        <DialogContent className="sm:max-w-md" onPointerDownOutside={(e) => e.preventDefault()}>
          {/* Close button */}
          <button
            onClick={handleDismiss}
            className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">Close</span>
          </button>
          
          <DialogHeader>
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            {isExpired ? <Lock className="h-6 w-6 text-red-600" /> : <Clock className="h-6 w-6 text-orange-600" />}
          </div>
          <DialogTitle className="text-center">
            {isExpired ? 'Trial Period Expired' : 'Trial Ending Soon'}
          </DialogTitle>
          <DialogDescription className="text-center pt-2">
            {isExpired 
              ? 'Your 2-minute trial has expired. Upgrade now to continue using all features.'
              : `Your trial expires in ${daysRemaining} minute(s). Upgrade now to avoid interruption.`
            }
          </DialogDescription>
        </DialogHeader>
        
        <div className="space-y-4 pt-4">
          {/* Warning Alert */}
          <Alert className={isExpired ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}>
            <AlertTriangle className={`h-4 w-4 ${isExpired ? 'text-red-600' : 'text-orange-600'}`} />
            <AlertDescription className={isExpired ? 'text-red-800' : 'text-orange-800'}>
              {isExpired 
                ? 'Access to premium features has been restricted.'
                : 'You will lose access to premium features when your trial ends.'
              }
            </AlertDescription>
          </Alert>

          {/* Features that will be locked */}
          <div className="rounded-lg border p-3 bg-muted/30">
            <h4 className="font-medium text-sm mb-2">Features Affected:</h4>
            <ul className="space-y-1 text-xs text-muted-foreground">
              <li className="flex items-center">
                <Lock className="h-3 w-3 mr-2 text-red-500" />
                Auto-posting to Google Business Profile
              </li>
              <li className="flex items-center">
                <Lock className="h-3 w-3 mr-2 text-red-500" />
                Automated review replies
              </li>
              <li className="flex items-center">
                <Lock className="h-3 w-3 mr-2 text-red-500" />
                Performance analytics
              </li>
              <li className="flex items-center">
                <Lock className="h-3 w-3 mr-2 text-red-500" />
                Multiple location management
              </li>
            </ul>
          </div>

          {/* Pricing */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-3">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-sm text-green-900">Unlock All Features</p>
                <p className="text-xs text-green-700 mt-0.5">
                  Starting at just ₹999/month
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600">Save 17%</p>
                <p className="text-sm font-bold text-green-900">Yearly plan</p>
              </div>
            </div>
          </div>

          {/* Action Button */}
          <Button 
            onClick={() => navigate('/dashboard/billing')}
            className="w-full"
            size="lg"
          >
            <CreditCard className="mr-2 h-4 w-4" />
            Go to Billing Page
          </Button>

          {/* Support */}
          <div className="text-center text-xs text-muted-foreground pt-2 border-t">
            Need help? Contact support at{' '}
            <a href="mailto:support@lobaiseo.com" className="text-primary hover:underline">
              support@lobaiseo.com
            </a>
          </div>
        </div>
      </DialogContent>
    </Dialog>
    
    {/* Persistent reminder bar when modal is dismissed */}
    {dismissed && !showModal && (
      <div className="fixed bottom-4 right-4 max-w-sm bg-red-50 border border-red-200 rounded-lg shadow-lg p-4 z-40">
        <div className="flex items-start space-x-3">
          <AlertTriangle className="h-5 w-5 text-red-600 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm font-medium text-red-900">Trial Expired</p>
            <p className="text-xs text-red-700 mt-1">
              Upgrade to continue using all features
            </p>
          </div>
          <Button 
            size="sm" 
            variant="destructive"
            onClick={() => navigate('/dashboard/billing')}
          >
            Upgrade
          </Button>
        </div>
      </div>
    )}
    </>
  );
};