import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GoogleOAuthCallback: React.FC = () => {
  console.log('🚨🚨🚨 GoogleOAuthCallback component is rendering! 🚨🚨🚨');
  console.log('🚨 Current URL:', window.location.href);

  const navigate = useNavigate();
  const [message, setMessage] = useState('Processing authentication...');

  useEffect(() => {
    console.log('🚨 useEffect running in GoogleOAuthCallback');

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

        setMessage('Success! Closing window...');

        // Check if this is a popup (has opener)
        if (window.opener && !window.opener.closed) {
          console.log('✅ Sending success message to parent window');
          // Send success message to parent window
          window.opener.postMessage(
            { type: 'OAUTH_SUCCESS', userId: data.userId },
            window.location.origin
          );

          // Close popup after a short delay
          setTimeout(() => {
            window.close();
          }, 1000);
        } else {
          // Fallback: full page redirect if not in popup
          console.log('✅ Not in popup, using redirect fallback');
          sessionStorage.setItem('oauth_success', 'true');
          const returnUrl = sessionStorage.getItem('oauth_return_url') || '/settings?tab=connections';
          sessionStorage.removeItem('oauth_return_url');
          setTimeout(() => {
            navigate(returnUrl + '?oauth=success');
          }, 500);
        }

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        const errorMsg = error instanceof Error ? error.message : 'Authentication failed';
        console.error('❌ Error message shown to user:', errorMsg);
        setMessage(errorMsg);

        // Check if this is a popup (has opener)
        if (window.opener && !window.opener.closed) {
          console.log('❌ Sending error message to parent window');
          // Send error message to parent window
          window.opener.postMessage(
            { type: 'OAUTH_ERROR', error: errorMsg },
            window.location.origin
          );

          // Close popup after showing error
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          // Fallback: full page redirect if not in popup
          sessionStorage.setItem('oauth_success', 'false');
          const returnUrl = sessionStorage.getItem('oauth_return_url') || '/settings';
          sessionStorage.removeItem('oauth_return_url');
          setTimeout(() => {
            navigate(returnUrl + '?tab=connections&oauth=failed');
          }, 1500);
        }
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

