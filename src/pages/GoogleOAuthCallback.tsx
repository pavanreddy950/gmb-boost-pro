import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const GoogleOAuthCallback: React.FC = () => {
  console.log('========================================');
  console.log('🚨 OAUTH CALLBACK PAGE LOADED');
  console.log('========================================');
  console.log('📍 Current URL:', window.location.href);
  console.log('📍 Window opener exists?', !!window.opener);
  console.log('📍 Window opener closed?', window.opener ? window.opener.closed : 'N/A');
  console.log('📍 Parent origin:', window.location.origin);
  console.log('========================================');

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

        // Mark OAuth as complete
        sessionStorage.setItem('oauth_success', 'true');

        setMessage('Success! Redirecting...');

        // Get return URL or default to settings
        const returnUrl = sessionStorage.getItem('oauth_return_url') || '/settings?tab=connections';
        sessionStorage.removeItem('oauth_return_url');

        console.log('🔄 Redirecting to:', returnUrl + '?oauth=success');
        setTimeout(() => {
          navigate(returnUrl + '?oauth=success');
        }, 1000);

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

        console.log('🔄 Redirecting to:', returnUrl + '?tab=connections&oauth=failed');
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
      backgroundColor: '#f5f5f5',
      padding: '20px'
    }}>
      <div style={{
        textAlign: 'center',
        padding: '40px',
        backgroundColor: '#fff',
        borderRadius: '8px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
        maxWidth: '500px',
        width: '100%'
      }}>
        <p style={{ fontSize: '18px', color: '#333', marginBottom: '20px', fontWeight: 'bold' }}>{message}</p>

        {/* Debug Info */}
        <div style={{
          marginTop: '30px',
          padding: '15px',
          backgroundColor: '#f8f9fa',
          borderRadius: '4px',
          fontSize: '12px',
          textAlign: 'left',
          fontFamily: 'monospace'
        }}>
          <div style={{ marginBottom: '8px' }}>
            <strong>Debug Info:</strong>
          </div>
          <div>Popup Mode: {window.opener && !window.opener.closed ? '✅ Yes' : '❌ No'}</div>
          <div>Window Opener: {window.opener ? '✅ Exists' : '❌ Null'}</div>
          <div>Opener Closed: {window.opener?.closed ? '❌ Yes' : '✅ No'}</div>
          <div style={{ marginTop: '8px', wordBreak: 'break-all' }}>
            URL: {window.location.href}
          </div>
        </div>

        <div style={{ marginTop: '20px', fontSize: '12px', color: '#666' }}>
          Check browser console for detailed logs (Press F12)
        </div>
      </div>
    </div>
  );
};

export default GoogleOAuthCallback;

