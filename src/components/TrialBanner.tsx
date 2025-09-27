import React from 'react';
import { AlertCircle, Clock, CreditCard, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { useSubscription } from '@/contexts/SubscriptionContext';
import { useState } from 'react';

export const TrialBanner: React.FC = () => {
  const { status, daysRemaining, isLoading } = useSubscription();
  const [isDismissed, setIsDismissed] = useState(false);

  // Don't show banner if loading, dismissed, or not in trial/expired state
  if (isLoading || isDismissed || (status !== 'trial' && status !== 'expired')) {
    return null;
  }

  // Calculate progress percentage (15 days total trial)
  const progressPercentage = daysRemaining 
    ? ((15 - daysRemaining) / 15) * 100 
    : 100;

  // Determine banner style based on urgency
  const getBannerStyle = () => {
    if (status === 'expired') {
      return {
        bgColor: 'bg-red-50 border-red-200',
        textColor: 'text-red-800',
        iconColor: 'text-red-600',
        progressColor: 'bg-red-500',
        buttonVariant: 'destructive' as const
      };
    }
    
    if (daysRemaining && daysRemaining <= 3) {
      return {
        bgColor: 'bg-orange-50 border-orange-200',
        textColor: 'text-orange-800',
        iconColor: 'text-orange-600',
        progressColor: 'bg-orange-500',
        buttonVariant: 'default' as const
      };
    }
    
    return {
      bgColor: 'bg-blue-50 border-blue-200',
      textColor: 'text-blue-800',
      iconColor: 'text-blue-600',
      progressColor: 'bg-blue-500',
      buttonVariant: 'default' as const
    };
  };

  const style = getBannerStyle();

  return (
    <div className={`relative border-b ${style.bgColor} p-4 z-10`}>
      <div className="max-w-7xl mx-auto">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4 flex-1">
            {status === 'expired' ? (
              <AlertCircle className={`h-5 w-5 ${style.iconColor}`} />
            ) : (
              <Clock className={`h-5 w-5 ${style.iconColor}`} />
            )}
            
            <div className="flex-1">
              <div className="flex items-center space-x-2">
                <span className={`font-semibold ${style.textColor}`}>
                  {status === 'expired' 
                    ? 'Trial Expired' 
                    : `Free Trial: ${daysRemaining} days remaining`}
                </span>
                {status === 'trial' && daysRemaining && (
                  <span className={`text-sm ${style.textColor} opacity-75`}>
                    ({Math.round(progressPercentage)}% complete)
                  </span>
                )}
              </div>
              
              {status === 'trial' && (
                <div className="mt-2 max-w-md">
                  <Progress 
                    value={progressPercentage} 
                    className="h-1.5"
                    style={{
                      backgroundColor: 'rgba(0,0,0,0.1)'
                    }}
                  />
                </div>
              )}
              
              <p className={`text-sm mt-1 ${style.textColor} opacity-90`}>
                {status === 'expired' 
                  ? 'Upgrade now to continue using all features without interruption.'
                  : daysRemaining && daysRemaining <= 3
                  ? 'Your trial is ending soon. Upgrade now to avoid service interruption.'
                  : 'Enjoy unlimited access to all features during your trial period.'}
              </p>
            </div>
          </div>
          
          <div className="flex items-center space-x-2">
            <Button
              variant={style.buttonVariant}
              size="sm"
              onClick={() => {
                // Open payment modal or redirect to billing page
                window.location.href = '/dashboard/billing';
              }}
              className="flex items-center space-x-1"
            >
              <CreditCard className="h-4 w-4" />
              <span>Upgrade Now</span>
            </Button>
            
            {status === 'trial' && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsDismissed(true)}
                className="p-1"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

// Compact version for sidebar
export const TrialBannerCompact: React.FC = () => {
  const { status, daysRemaining, isLoading } = useSubscription();

  if (isLoading || (status !== 'trial' && status !== 'expired')) {
    return null;
  }

  const getBadgeStyle = () => {
    if (status === 'expired') {
      return 'bg-red-100 text-red-800 border-red-200';
    }
    if (daysRemaining && daysRemaining <= 3) {
      return 'bg-orange-100 text-orange-800 border-orange-200';
    }
    return 'bg-blue-100 text-blue-800 border-blue-200';
  };

  return (
    <div className={`px-3 py-2 mx-3 rounded-lg border ${getBadgeStyle()}`}>
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          {status === 'expired' ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <Clock className="h-4 w-4" />
          )}
          <span className="text-xs font-medium">
            {status === 'expired' 
              ? 'Trial Expired' 
              : `${daysRemaining} days left`}
          </span>
        </div>
        <Button
          variant="ghost"
          size="sm"
          className="h-6 px-2 text-xs"
          onClick={() => window.location.href = '/dashboard/billing'}
        >
          Upgrade
        </Button>
      </div>
    </div>
  );
};