import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useEffect } from 'react';

interface AuthRedirectProps {
  children: React.ReactNode;
}

// Redirect authenticated users away from login/signup pages
const AuthRedirect: React.FC<AuthRedirectProps> = ({ children }) => {
  const { currentUser, loading } = useAuth();

  useEffect(() => {
    console.log('🔍 AuthRedirect - User:', currentUser?.email || 'null', 'Loading:', loading);
  }, [currentUser, loading]);

  // Wait for auth to initialize
  if (loading) {
    console.log('⏳ AuthRedirect - Still loading...');
    return null; // or return a loading spinner
  }

  if (currentUser) {
    // User is already authenticated, redirect to dashboard
    console.log('✅ AuthRedirect - User authenticated, redirecting to dashboard');
    return <Navigate to="/dashboard" replace />;
  }

  console.log('❌ AuthRedirect - No user, showing login page');
  return <>{children}</>;
};

export default AuthRedirect;

