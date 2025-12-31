/**
 * Auth Error Boundary Component
 *
 * React Error Boundary that catches authentication-related errors and prevents app crashes.
 * Shows a fallback UI with reconnection option when auth errors occur.
 */

import React, { Component, ReactNode } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertCircle, RefreshCw, Home } from 'lucide-react';
import { googleBusinessProfileService } from '@/lib/googleBusinessProfile';
import { tokenInvalidationService } from '@/lib/tokenInvalidationService';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  isAuthError: boolean;
  isReconnecting: boolean;
}

export class AuthErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      isAuthError: false,
      isReconnecting: false
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    console.error('[AUTH ERROR BOUNDARY] Error caught:', error);

    // Detect if this is an authentication-related error
    const isAuthError =
      error.message.includes('REAUTH_REQUIRED') ||
      error.message.includes('Authentication') ||
      error.message.includes('Token') ||
      error.message.includes('401') ||
      error.message.includes('Unauthorized') ||
      error.message.includes('expired') ||
      error.message.includes('revoked');

    return {
      hasError: true,
      error,
      isAuthError
    };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('[AUTH ERROR BOUNDARY] Component stack:', errorInfo.componentStack);

    // If it's an auth error, trigger token invalidation
    if (this.state.isAuthError) {
      console.error('[AUTH ERROR BOUNDARY] Auth error detected, triggering token invalidation');

      const userId = googleBusinessProfileService.getUserId();
      const reason = error.message.includes('REAUTH_REQUIRED')
        ? error.message.replace('REAUTH_REQUIRED: ', '')
        : 'An authentication error occurred. Please reconnect your Google Business Profile.';

      tokenInvalidationService.invalidateAndRequestReauth(reason, userId);
    }
  }

  handleReconnect = async () => {
    this.setState({ isReconnecting: true });

    try {
      console.log('[AUTH ERROR BOUNDARY] Initiating reconnection...');
      await googleBusinessProfileService.connectGoogleBusiness();

      // Clear reauth state
      tokenInvalidationService.clearReauthState();

      // Reset error state
      this.setState({
        hasError: false,
        error: null,
        isAuthError: false,
        isReconnecting: false
      });

      // Reload the page to start fresh
      window.location.reload();

    } catch (reconnectError) {
      console.error('[AUTH ERROR BOUNDARY] Reconnection failed:', reconnectError);
      this.setState({ isReconnecting: false });
    }
  };

  handleGoHome = () => {
    // Reset error state and navigate to home
    this.setState({
      hasError: false,
      error: null,
      isAuthError: false,
      isReconnecting: false
    });

    window.location.href = '/';
  };

  render() {
    if (this.state.hasError && this.state.isAuthError) {
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
          <Alert variant="destructive" className="max-w-2xl shadow-xl">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Authentication Error</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                {this.state.error?.message.startsWith('REAUTH_REQUIRED:')
                  ? this.state.error.message.replace('REAUTH_REQUIRED: ', '')
                  : 'Your Google Business Profile connection has expired or encountered an error.'}
              </p>

              <p className="text-sm text-muted-foreground mb-4">
                Please reconnect your Google Business Profile to continue using the app.
              </p>

              <div className="flex gap-2 flex-wrap">
                <Button
                  onClick={this.handleReconnect}
                  disabled={this.state.isReconnecting}
                  className="shadow-md"
                >
                  {this.state.isReconnecting ? (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      Reconnecting...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-4 w-4 mr-2" />
                      Reconnect Now
                    </>
                  )}
                </Button>

                <Button
                  variant="outline"
                  onClick={this.handleGoHome}
                >
                  <Home className="h-4 w-4 mr-2" />
                  Go to Home
                </Button>
              </div>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    if (this.state.hasError && !this.state.isAuthError) {
      // For non-auth errors, show a simpler error message
      return (
        <div className="min-h-screen flex items-center justify-center p-4 bg-muted/30">
          <Alert variant="destructive" className="max-w-2xl shadow-xl">
            <AlertCircle className="h-5 w-5" />
            <AlertTitle className="text-lg font-semibold">Something Went Wrong</AlertTitle>
            <AlertDescription className="mt-2">
              <p className="mb-4">
                An unexpected error occurred. Please try refreshing the page.
              </p>

              <p className="text-sm text-muted-foreground mb-4">
                Error: {this.state.error?.message || 'Unknown error'}
              </p>

              <Button
                variant="outline"
                onClick={this.handleGoHome}
              >
                <Home className="h-4 w-4 mr-2" />
                Go to Home
              </Button>
            </AlertDescription>
          </Alert>
        </div>
      );
    }

    // No error, render children normally
    return this.props.children;
  }
}
