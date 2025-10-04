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
          throw new Error(errorData.error || 'Failed to exchange authorization code');
        }

        const data = await response.json();
        console.log('✅ Tokens received and stored in backend:', data);
        console.log('✅ User ID:', data.userId);

        // Tokens are already stored in Firebase by the backend
        // Mark OAuth as complete
        sessionStorage.setItem('oauth_success', 'true');
        
        // Also notify parent window if this is a popup
        if (window.opener) {
          try {
            // Try to send message to parent window
            window.opener.postMessage({ type: 'OAUTH_SUCCESS', data }, window.location.origin);
          } catch (e) {
            console.log('Could not post message to parent (COOP restriction), using sessionStorage fallback');
          }
        }

        setMessage('Success! Closing...');

        // Close the popup window immediately
        if (window.opener) {
          window.close();
        } else {
          // Fallback if not in popup
          navigate('/settings?tab=connections');
        }

      } catch (error) {
        console.error('❌ OAuth callback error:', error);
        setMessage(error instanceof Error ? error.message : 'Authentication failed');

        // Mark as failed
        sessionStorage.setItem('oauth_success', 'false');

        // Also notify parent window if this is a popup
        if (window.opener) {
          try {
            window.opener.postMessage({
              type: 'OAUTH_ERROR',
              error: error instanceof Error ? error.message : 'Authentication failed'
            }, window.location.origin);
          } catch (e) {
            console.log('Could not post message to parent (COOP restriction), using sessionStorage fallback');
          }
        }

        // Close popup after error
        if (window.opener) {
          window.close();
        } else {
          navigate('/settings?tab=connections&error=oauth_failed');
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

