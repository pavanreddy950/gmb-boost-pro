import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Lock, CreditCard, Clock, AlertTriangle } from 'lucide-react';
import { PaymentModal } from '@/components/PaymentModal';

interface PaymentWallProps {
  message?: string;
  daysRemaining?: number;
  isExpired?: boolean;
}

export const PaymentWall: React.FC<PaymentWallProps> = ({ 
  message = "Your 2-minute trial has expired", // TEST MODE
  daysRemaining = 0,
  isExpired = true
}) => {
  const navigate = useNavigate();
  const [showPaymentModal, setShowPaymentModal] = useState(false);

  return (
    <div className="fixed inset-0 bg-background/95 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <Card className="max-w-2xl w-full">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-4 h-12 w-12 rounded-full bg-red-100 flex items-center justify-center">
            {isExpired ? <Lock className="h-6 w-6 text-red-600" /> : <Clock className="h-6 w-6 text-orange-600" />}
          </div>
          <CardTitle className="text-2xl">
            {isExpired ? 'Trial Period Expired' : `Trial Ending Soon`}
          </CardTitle>
          <CardDescription className="mt-2 text-base">
            {message}
          </CardDescription>
        </CardHeader>
        
        <CardContent className="space-y-6">
          {/* Trial Status Alert */}
          <Alert className={isExpired ? 'border-red-200 bg-red-50' : 'border-orange-200 bg-orange-50'}>
            <AlertTriangle className={`h-4 w-4 ${isExpired ? 'text-red-600' : 'text-orange-600'}`} />
            <AlertDescription className={isExpired ? 'text-red-800' : 'text-orange-800'}>
              {isExpired 
                ? 'Your access to all features has been restricted. Only the billing page is accessible until you upgrade.'
                : `You have ${daysRemaining} days remaining in your trial. Upgrade now to ensure uninterrupted access.`
              }
            </AlertDescription>
          </Alert>

          {/* Features You're Missing */}
          <div className="rounded-lg border p-4 bg-muted/30">
            <h3 className="font-semibold mb-3">Features Currently Locked:</h3>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center">
                <Lock className="h-4 w-4 mr-2 text-red-500" />
                Auto-posting to Google Business Profile
              </li>
              <li className="flex items-center">
                <Lock className="h-4 w-4 mr-2 text-red-500" />
                Automated review replies
              </li>
              <li className="flex items-center">
                <Lock className="h-4 w-4 mr-2 text-red-500" />
                Performance analytics and insights
              </li>
              <li className="flex items-center">
                <Lock className="h-4 w-4 mr-2 text-red-500" />
                Multiple location management
              </li>
              <li className="flex items-center">
                <Lock className="h-4 w-4 mr-2 text-red-500" />
                Smart content generation
              </li>
            </ul>
          </div>

          {/* Pricing Info */}
          <div className="rounded-lg border border-green-200 bg-green-50 p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-green-900">Unlock All Features</p>
                <p className="text-sm text-green-700 mt-1">
                  Just $99 per profile/year
                </p>
              </div>
              <div className="text-right">
                <p className="text-xs text-green-600">Limited Time Offer</p>
                <p className="text-lg font-bold text-green-900">Save 80%</p>
                <p className="text-xs text-green-600">Regular price $499</p>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row gap-3 pt-2">
            <Button 
              onClick={() => setShowPaymentModal(true)}
              className="flex-1"
              size="lg"
            >
              <CreditCard className="mr-2 h-4 w-4" />
              Upgrade Now
            </Button>
            
            {!isExpired && (
              <Button 
                onClick={() => navigate('/dashboard/billing')}
                variant="outline"
                className="flex-1"
                size="lg"
              >
                View Billing Details
              </Button>
            )}
          </div>

          {/* Contact Support */}
          <div className="text-center text-sm text-muted-foreground pt-2 border-t">
            Need help? Contact support at{' '}
            <a href="mailto:support@lobaiseo.com" className="text-primary hover:underline">
              support@lobaiseo.com
            </a>
          </div>
        </CardContent>
      </Card>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={showPaymentModal}
        onClose={() => setShowPaymentModal(false)}
        defaultPlanId="monthly_basic"
      />
    </div>
  );
};