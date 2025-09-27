import { Navigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';

interface AuthRedirectProps {
  children: React.ReactNode;
}

// Redirect authenticated users away from login/signup pages
const AuthRedirect: React.FC<AuthRedirectProps> = ({ children }) => {
  const { currentUser } = useAuth();

  if (currentUser) {
    // User is already authenticated, redirect to dashboard
    return <Navigate to="/dashboard" replace />;
  }

  return <>{children}</>;
};

export default AuthRedirect;

