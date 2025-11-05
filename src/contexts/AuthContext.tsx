import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  signInWithRedirect,
  getRedirectResult,
  GoogleAuthProvider,
  updateProfile,
  setPersistence,
  browserLocalPersistence
} from 'firebase/auth';
import { auth } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

interface AuthContextType {
  currentUser: User | null;
  loading: boolean;
  signup: (email: string, password: string, displayName?: string) => Promise<void>;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  refreshToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: React.ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();

  const signup = async (email: string, password: string, displayName?: string) => {
    try {
      // Ensure persistence is set before signup
      await setPersistence(auth, browserLocalPersistence);

      const result = await createUserWithEmailAndPassword(auth, email, password);

      if (displayName && result.user) {
        await updateProfile(result.user, {
          displayName: displayName
        });
      }

      toast({
        title: "Account created successfully!",
        description: "Welcome to LOBAISEO!",
      });
    } catch (error: any) {
      console.error('Signup error:', error);
      toast({
        title: "Signup failed",
        description: error.message || "An error occurred during signup",
        variant: "destructive",
      });
      throw error;
    }
  };

  const login = async (email: string, password: string) => {
    try {
      // Ensure persistence is set before login
      await setPersistence(auth, browserLocalPersistence);

      await signInWithEmailAndPassword(auth, email, password);
      toast({
        title: "Welcome back!",
        description: "You have successfully signed in.",
      });
    } catch (error: any) {
      console.error('Login error:', error);
      let errorMessage = "An error occurred during login";

      switch (error.code) {
        case 'auth/user-not-found':
          errorMessage = "No account found with this email address";
          break;
        case 'auth/wrong-password':
          errorMessage = "Incorrect password";
          break;
        case 'auth/invalid-email':
          errorMessage = "Invalid email address";
          break;
        case 'auth/too-many-requests':
          errorMessage = "Too many failed attempts. Please try again later";
          break;
        default:
          errorMessage = error.message;
      }

      toast({
        title: "Login failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const loginWithGoogle = async () => {
    try {
      // Ensure persistence is set before Google login
      await setPersistence(auth, browserLocalPersistence);

      const provider = new GoogleAuthProvider();
      // Use redirect instead of popup to avoid CORS issues
      await signInWithRedirect(auth, provider);
      // Note: Success toast will be shown after redirect completes (in useEffect)
    } catch (error: any) {
      console.error('Google login error:', error);

      // Show error toast for actual errors
      let errorMessage = "An error occurred during Google login";

      switch (error.code) {
        case 'auth/popup-blocked':
          errorMessage = "Browser blocked the authentication. Please allow redirects for this site.";
          break;
        case 'auth/unauthorized-domain':
          errorMessage = "This domain is not authorized for Google sign-in.";
          break;
        case 'auth/account-exists-with-different-credential':
          errorMessage = "An account already exists with this email using a different sign-in method.";
          break;
        default:
          errorMessage = error.message;
      }

      toast({
        title: "Google login failed",
        description: errorMessage,
        variant: "destructive",
      });
      throw error;
    }
  };

  const logout = async () => {
    try {
      await signOut(auth);
      toast({
        title: "Signed out",
        description: "You have been successfully signed out.",
      });
    } catch (error: any) {
      console.error('Logout error:', error);
      toast({
        title: "Logout failed",
        description: error.message || "An error occurred during logout",
        variant: "destructive",
      });
      throw error;
    }
  };

  const refreshToken = async (): Promise<string | null> => {
    try {
      if (currentUser) {
        const token = await currentUser.getIdToken(true);
        console.log('Firebase token refreshed successfully');
        return token;
      }
      return null;
    } catch (error) {
      console.error('Failed to refresh Firebase token:', error);
      return null;
    }
  };

  useEffect(() => {
    // Check for redirect result from Google sign-in
    const checkRedirectResult = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          // User successfully signed in via redirect
          console.log('Google sign-in redirect successful:', result.user.email);
          toast({
            title: "Welcome!",
            description: "You have successfully signed in with Google.",
          });
        }
      } catch (error: any) {
        console.error('Redirect result error:', error);
        if (error.code !== 'auth/popup-closed-by-user') {
          toast({
            title: "Google login failed",
            description: error.message || "An error occurred during Google login",
            variant: "destructive",
          });
        }
      }
    };

    checkRedirectResult();

    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      if (user) {
        try {
          // Force token refresh to ensure it's valid
          await user.getIdToken(true);
          console.log('User authenticated and token refreshed:', user.email);
        } catch (error) {
          console.error('Token refresh failed during auth state change:', error);
        }
      }
      setCurrentUser(user);
      setLoading(false);
    });

    // Set up automatic token refresh every 30 minutes
    const tokenRefreshInterval = setInterval(async () => {
      if (currentUser) {
        try {
          await currentUser.getIdToken(true);
          console.log('Auth token automatically refreshed');
        } catch (error) {
          console.error('Automatic token refresh failed:', error);
        }
      }
    }, 30 * 60 * 1000); // 30 minutes

    return () => {
      unsubscribe();
      clearInterval(tokenRefreshInterval);
    };
  }, [currentUser, toast]);

  const value: AuthContextType = {
    currentUser,
    loading,
    signup,
    login,
    logout,
    loginWithGoogle,
    refreshToken
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

