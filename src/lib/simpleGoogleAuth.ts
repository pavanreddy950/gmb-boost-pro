// Simple Google Authentication with direct OAuth flow
export class SimpleGoogleAuth {
  private clientId = '52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com';
  
  async signIn(): Promise<any> {
    return new Promise((resolve, reject) => {
      console.log('Starting Google OAuth flow...');
      
      // Create OAuth URL
      const params = new URLSearchParams({
        client_id: this.clientId,
        redirect_uri: `${window.location.origin}/auth/google/callback`,
        response_type: 'code',
        scope: 'https://www.googleapis.com/auth/business.manage',
        access_type: 'offline',
        prompt: 'consent',
      });
      
      const authUrl = `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;
      
      // Use direct redirect instead of popup to avoid CORS issues
      console.log('Redirecting to Google OAuth...');
      window.location.href = authUrl;
      
      // Since we're redirecting, resolve immediately
      resolve({ success: true });
    });
  }

  isConnected(): boolean {
    return localStorage.getItem('google_business_connected') === 'true';
  }

  disconnect(): void {
    localStorage.removeItem('google_business_connected');
    localStorage.removeItem('google_business_tokens');
    
    if (window.google?.accounts?.id) {
      window.google.accounts.id.disableAutoSelect();
    }
  }

  // Fetch REAL Google Business Profile data via backend API
  async getBusinessProfiles(): Promise<any[]> {
    if (!this.isConnected()) {
      throw new Error('Not connected to Google Business Profile');
    }

    try {
      // Get stored tokens
      const tokens = localStorage.getItem('google_business_tokens');
      if (!tokens) {
        throw new Error('No authentication tokens found');
      }

      const tokenData = JSON.parse(tokens);
      
      // Call backend API to get real Google Business Profile data
      const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';
      const response = await fetch(`${backendUrl}/api/accounts`, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${tokenData.access_token}`,
          'Content-Type': 'application/json'
        }
      });

      if (!response.ok) {
        throw new Error(`Failed to fetch business profiles: ${response.status}`);
      }

      const data = await response.json();
      console.log('Real Google Business Profile data received:', data);

      if (!data.accounts || data.accounts.length === 0) {
        throw new Error('No Google Business Profile accounts found. Please ensure you have verified Google Business Profiles.');
      }

      return data.accounts;
    } catch (error) {
      console.error('Error fetching real business profiles:', error);
      
      // If backend is not available, show clear message instead of blank page
      if (error.message.includes('Failed to fetch') || error.message.includes('ERR_CONNECTION_REFUSED')) {
        throw new Error('Backend server is not running. Please start the backend server to load your real Google Business Profile data.');
      }
      
      throw new Error('Failed to load your Google Business Profile accounts. Please check your connection and try again.');
    }
  }
}

export const simpleGoogleAuth = new SimpleGoogleAuth();
