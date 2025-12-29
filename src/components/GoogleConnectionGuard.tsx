import { Navigate, useLocation } from 'react-router-dom';
import { useGoogleBusinessProfileContext } from '@/contexts/GoogleBusinessProfileContext';
import { Loader2 } from 'lucide-react';

interface GoogleConnectionGuardProps {
  children: React.ReactNode;
}

const GoogleConnectionGuard: React.FC<GoogleConnectionGuardProps> = ({ children }) => {
  const { isConnected, isLoading } = useGoogleBusinessProfileContext();
  const location = useLocation();

  // Allow access to settings page so users can connect
  const isSettingsPage = location.pathname.includes('/dashboard/settings');
  const isBillingPage = location.pathname.includes('/dashboard/billing');
  const isUpgradePage = location.pathname.includes('/dashboard/upgrade');

  // Show loading state while checking connection
  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
          <p className="text-muted-foreground">Checking Google Business Profile connection...</p>
        </div>
      </div>
    );
  }

  // If not connected and not on allowed pages, redirect to settings
  if (!isConnected && !isSettingsPage && !isBillingPage && !isUpgradePage) {
    console.log('[GoogleConnectionGuard] User not connected, redirecting to settings');
    return <Navigate to="/dashboard/settings?tab=connections&connect=required" replace />;
  }

  return <>{children}</>;
};

export default GoogleConnectionGuard;
