import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Crown, Clock, ArrowLeft } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Upgrade = () => {
  const [daysLeft, setDaysLeft] = useState(15);
  const navigate = useNavigate();

  // Calculate days left in trial (you can modify this logic based on your actual trial tracking)
  useEffect(() => {
    // Example: Calculate days left from trial start date
    // This is a placeholder - replace with your actual trial logic
    const trialStartDate = new Date('2024-01-01'); // Replace with actual trial start date
    const today = new Date();
    const timeDiff = today.getTime() - trialStartDate.getTime();
    const daysPassed = Math.floor(timeDiff / (1000 * 3600 * 24));
    const remainingDays = Math.max(0, 15 - daysPassed);
    setDaysLeft(remainingDays);
  }, []);

  const handleUpgrade = () => {
    // Handle upgrade logic here
    console.log('Upgrading to Premium...');
    // You can integrate with your payment processor here
  };

  return (
    <div className="min-h-screen bg-background p-4 sm:p-6 lg:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Back Button */}
        <div className="mb-6">
          <Button 
            onClick={() => navigate('/dashboard')}
            variant="outline" 
            size="sm"
            className="flex items-center gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
        </div>

        {/* Heading */}
        <div className="text-center mb-8">
          <h1 className="text-3xl sm:text-4xl font-bold text-foreground mb-2">
            Choose Your Plan
          </h1>
          <p className="text-muted-foreground text-lg">
            Select the plan that works best for your business
          </p>
        </div>

        {/* Cards Container */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8">
          {/* Current Plan - Free Trial */}
          <Card className="shadow-lg border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Clock className="h-6 w-6 text-primary" />
                <CardTitle className="text-2xl font-bold text-primary">
                  Free 15 Days Trial
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              {/* Countdown */}
              <div className="bg-primary/10 rounded-lg p-6 border border-primary/20">
                <div className="text-4xl font-bold text-primary mb-2">
                  {daysLeft}
                </div>
                <div className="text-sm text-primary/80 font-medium">
                  {daysLeft === 1 ? 'Day Left' : 'Days Left'}
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Basic profile management</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Limited posts per month</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-primary rounded-full"></div>
                  <span>Basic analytics</span>
                </div>
              </div>

              {/* Current Plan Button */}
              <Button 
                variant="outline" 
                size="lg" 
                className="w-full border-primary text-primary hover:bg-primary/10 font-medium"
                disabled
              >
                Current Plan
              </Button>
            </CardContent>
          </Card>

          {/* Premium Plan */}
          <Card className="shadow-lg border-2 border-yellow-500/20 bg-gradient-to-br from-yellow-500/5 to-yellow-600/10">
            <CardHeader className="text-center pb-4">
              <div className="flex items-center justify-center gap-2 mb-2">
                <Crown className="h-6 w-6 text-yellow-600" />
                <CardTitle className="text-2xl font-bold text-yellow-600">
                  Premium Plan
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent className="text-center space-y-6">
              {/* Price */}
              <div className="bg-yellow-500/10 rounded-lg p-6 border border-yellow-500/20">
                <div className="text-4xl font-bold text-yellow-600 mb-2">
                  ₹999/-
                </div>
                <div className="text-sm text-yellow-600/80 font-medium">
                  Per Month
                </div>
              </div>

              {/* Features */}
              <div className="space-y-2 text-left">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Unlimited profile management</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Unlimited posts per month</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Advanced analytics & insights</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Priority customer support</span>
                </div>
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full"></div>
                  <span>Multi-location management</span>
                </div>
              </div>

              {/* Upgrade Button */}
              <Button 
                onClick={handleUpgrade}
                size="lg" 
                className="w-full bg-gradient-to-r from-yellow-500 to-yellow-600 hover:from-yellow-600 hover:to-yellow-700 text-white font-medium shadow-lg"
              >
                Take Premium
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default Upgrade;
