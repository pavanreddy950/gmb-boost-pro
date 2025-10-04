import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { CheckCircle, Loader2, XCircle } from 'lucide-react';

const GoogleOAuthCallback: React.FC = () => {
  const navigate = useNavigate();
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing');
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Extract authorization code and state from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const state = urlParams.get('state');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        console.log('✅ Received OAuth code, exchanging for tokens...');
        console.log('📍 State parameter from URL:', state);
        console.log('📍 Full URL:', window.location.href);
        console.log('📍 URL search params:', window.location.search);
        setMessage('Exchanging authorization code for permanent access...');

        // Exchange code for tokens via backend (include state with Firebase user ID)
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
        const response = await fetch(`${backendUrl}/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code, state }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to exchange authorization code');
        }

        const data = await response.json();
        console.log('✅ Tokens received and stored in backend:', data);
        console.log('✅ User ID:', data.userId);

        // Tokens are already stored in Firebase by the backend
        // Mark OAuth as complete
        sessionStorage.setItem('oauth_success', 'true');

        setStatus('success');
        setMessage('Connection successful! Closing...');

        // Close the popup window after success
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            // Fallback if not in popup
            navigate('/settings?tab=connections');
          }
        }, 1000);

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');

        // Mark as failed
        sessionStorage.setItem('oauth_success', 'false');

        // Close popup after error (parent will check oauth_success flag)
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            navigate('/settings?tab=connections&error=oauth_failed');
          }
        }, 2000);
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="flex items-center justify-center gap-2">
            {status === 'processing' && <Loader2 className="h-5 w-5 animate-spin text-blue-600" />}
            {status === 'success' && <CheckCircle className="h-5 w-5 text-green-600" />}
            {status === 'error' && <XCircle className="h-5 w-5 text-red-600" />}
            {status === 'processing' && 'Connecting...'}
            {status === 'success' && 'Connected!'}
            {status === 'error' && 'Connection Failed'}
          </CardTitle>

          <CardDescription>
            {message}
          </CardDescription>
        </CardHeader>

        <CardContent className="text-center">
          <div className={`p-4 rounded-lg border ${
            status === 'processing' ? 'bg-blue-50 border-blue-200' :
            status === 'success' ? 'bg-green-50 border-green-200' :
            'bg-red-50 border-red-200'
          }`}>
            <p className={`text-sm ${
              status === 'processing' ? 'text-blue-800' :
              status === 'success' ? 'text-green-800' :
              'text-red-800'
            }`}>
              {status === 'processing' && 'Securing your permanent connection...'}
              {status === 'success' && 'Your Google Business Profile is now permanently connected. You won\'t need to reconnect again!'}
              {status === 'error' && 'Please try connecting again from Settings.'}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default GoogleOAuthCallback;

