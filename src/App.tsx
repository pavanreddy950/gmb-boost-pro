import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import NotFound from "./pages/NotFound";
import LoginPage from "./components/Auth/LoginPage";
import SignupPage from "./components/Auth/SignupPage";
import DashboardLayout from "./components/Layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ProfileDetails from "./pages/ProfileDetails";
import Posts from "./pages/Posts";
import Reviews from "./pages/Reviews";
import AskForReviews from "./pages/AskForReviews";
import Settings from "./pages/Settings";
import AuditTool from "./pages/AuditTool";
import Upgrade from "./pages/Upgrade";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AuthRedirect from "./components/AuthRedirect";
import GoogleOAuthCallback from "./pages/GoogleOAuthCallback";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <Routes>
            <Route path="/" element={<Index />} />
            <Route path="/login" element={
              <AuthRedirect>
                <LoginPage />
              </AuthRedirect>
            } />
            <Route path="/signup" element={
              <AuthRedirect>
                <SignupPage />
              </AuthRedirect>
            } />
            
            {/* OAuth Callback Route */}
            <Route path="/auth/google/callback" element={<GoogleOAuthCallback />} />
            
            {/* Protected Dashboard Routes */}
            <Route path="/dashboard" element={
              <ProtectedRoute>
                <DashboardLayout />
              </ProtectedRoute>
            }>
              <Route index element={<Dashboard />} />
              <Route path="profiles/:profileId" element={<ProfileDetails />} />
              <Route path="posts" element={<Posts />} />
              <Route path="reviews" element={<Reviews />} />
              <Route path="ask-for-reviews" element={<AskForReviews />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit" element={<AuditTool />} />
            </Route>
            
            {/* Upgrade page without layout */}
            <Route path="/dashboard/upgrade" element={
              <ProtectedRoute>
                <Upgrade />
              </ProtectedRoute>
            } />
            
            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
            </Routes>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
