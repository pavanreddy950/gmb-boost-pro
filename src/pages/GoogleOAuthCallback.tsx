import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GoogleOAuthCallback: React.FC = () => {
  const navigate = useNavigate();
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
          console.error('❌ Backend error response:', errorData);
          console.error('❌ Backend error details:', JSON.stringify(errorData, null, 2));
          throw new Error(errorData.error || errorData.message || 'Failed to exchange authorization code');
        }

        const data = await response.json();
        console.log('✅ Tokens received and stored in backend:', data);
        console.log('✅ User ID:', data.userId);

        // Mark OAuth as complete
        sessionStorage.setItem('oauth_success', 'true');

        setMessage('Success! Redirecting...');

        // Get return URL or default to settings
        const returnUrl = sessionStorage.getItem('oauth_return_url') || '/settings?tab=connections';
        sessionStorage.removeItem('oauth_return_url');

        // Redirect back to original page
        setTimeout(() => {
          navigate(returnUrl + '?oauth=success');
        }, 500);

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Authentication failed';
        console.error('❌ Error message shown to user:', errorMsg);
        setMessage(errorMsg);

        // Mark as failed
        sessionStorage.setItem('oauth_success', 'false');

        // Get return URL or default to settings
        const returnUrl = sessionStorage.getItem('oauth_return_url') || '/settings';
        sessionStorage.removeItem('oauth_return_url');

        // Redirect back with error
        setTimeout(() => {
          navigate(returnUrl + '?tab=connections&oauth=failed');
        }, 1500);
      }
    };

    handleOAuthCallback();
  }, [navigate]);

  return (
    <div style={{
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: '100vh',
      fontFamily: 'system-ui, -apple-system, sans-serif',
      backgroundColor: '#fff'
    }}>
      <div style={{ textAlign: 'center', padding: '20px' }}>
        <p style={{ fontSize: '16px', color: '#333' }}>{message}</p>
      </div>
    </div>
  );
};

export default GoogleOAuthCallback;

