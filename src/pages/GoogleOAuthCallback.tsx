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
        // Extract authorization code from URL
        const urlParams = new URLSearchParams(window.location.search);
        const code = urlParams.get('code');
        const error = urlParams.get('error');

        if (error) {
          throw new Error(`OAuth error: ${error}`);
        }

        if (!code) {
          throw new Error('No authorization code received');
        }

        console.log('✅ Received OAuth code, exchanging for tokens...');
        setMessage('Exchanging authorization code for permanent access...');

        // Exchange code for tokens via backend
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
        const response = await fetch(`${backendUrl}/auth/google/callback`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ code }),
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to exchange authorization code');
        }

        const data = await response.json();
        console.log('✅ Tokens received from backend:', data);

        // Store tokens in localStorage
        const tokens = {
          access_token: data.tokens.access_token,
          refresh_token: data.tokens.refresh_token,
          token_type: data.tokens.token_type || 'Bearer',
          expiry_date: data.tokens.expiry_date,
          expires_in: Math.floor((data.tokens.expiry_date - Date.now()) / 1000),
          scope: data.tokens.scope || '',
          stored_at: Date.now(),
          expires_at: data.tokens.expiry_date
        };

        localStorage.setItem('google_business_tokens', JSON.stringify(tokens));
        localStorage.setItem('google_business_connected', 'true');
        localStorage.setItem('google_business_connection_time', Date.now().toString());

        console.log('✅ Tokens stored permanently with refresh token');
        console.log('📦 localStorage check:', {
          hasTokens: !!localStorage.getItem('google_business_tokens'),
          isConnected: localStorage.getItem('google_business_connected'),
          hasOpener: !!window.opener
        });

        // Notify parent window if opened as popup
        if (window.opener) {
          console.log('📤 Sending postMessage to parent window...');
          const message = {
            type: 'GOOGLE_OAUTH_SUCCESS',
            tokens: tokens,
            user: data.user
          };
          console.log('📤 Message:', message);
          console.log('📤 Target origin:', window.location.origin);

          window.opener.postMessage(message, window.location.origin);
          console.log('✅ postMessage sent successfully');

          setStatus('success');
          setMessage('Connection successful! Closing...');

          // Close popup after short delay
          setTimeout(() => {
            window.close();
          }, 1500);
        } else {
          // Not a popup, redirect to dashboard
          setStatus('success');
          setMessage('Connection successful! Redirecting...');

          setTimeout(() => {
            navigate('/dashboard');
          }, 1500);
        }

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        setStatus('error');
        setMessage(error instanceof Error ? error.message : 'Authentication failed');

        // Close popup or redirect after error
        setTimeout(() => {
          if (window.opener) {
            window.close();
          } else {
            navigate('/settings?tab=connections&error=oauth_failed');
          }
        }, 3000);
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

