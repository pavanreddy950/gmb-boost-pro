import React, { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle } from 'lucide-react';

const GoogleOAuthCallback: React.FC = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Since we're using frontend-only OAuth with Google Identity Services,
    // this callback page is mainly for legacy support or potential future use.
    // For now, just redirect to dashboard.
    console.log('OAuth callback page accessed - redirecting to dashboard');
    
    setTimeout(() => {
      navigate('/dashboard');
    }, 1000);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-600" />
            Redirecting...
          </CardTitle>
          
          <CardDescription>
            Taking you back to the dashboard...
          </CardDescription>
        </CardHeader>
        
        <CardContent className="text-center">
          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <p className="text-sm text-blue-800">
              We're using a simplified frontend-only authentication flow now. 
              You'll be redirected to the dashboard shortly.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleOAuthCallback;

