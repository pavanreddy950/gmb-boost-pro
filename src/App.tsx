import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import NotFound from "./pages/NotFound";
import LoginPage from "./components/Auth/LoginPage";
import SignupPage from "./components/Auth/SignupPage";
import DashboardLayout from "./components/Layout/DashboardLayout";
import Dashboard from "./pages/Dashboard";
import ProfileDetails from "./pages/ProfileDetails";
import Posts from "./pages/Posts";
import Reviews from "./pages/Reviews";
import AskForReviews from "./pages/AskForReviews";
import RequestForReviews from "./pages/RequestForReviews";
import Settings from "./pages/Settings";
import AuditTool from "./pages/AuditTool";
import Upgrade from "./pages/Upgrade";
import Billing from "./pages/Billing";
import PublicReviewSuggestions from "./pages/PublicReviewSuggestions";
import { AuthProvider } from "./contexts/AuthContext";
import { NotificationProvider } from "./contexts/NotificationContext";
import { SubscriptionProvider } from "./contexts/SubscriptionContext";
import { GoogleBusinessProfileProvider } from "./contexts/GoogleBusinessProfileContext";
import { AdminProvider } from "./contexts/AdminContext";

import ProtectedRoute from "./components/ProtectedRoute";
import AuthRedirect from "./components/AuthRedirect";
import AdminRoute from "./components/AdminRoute";
import GoogleOAuthCallback from "./pages/GoogleOAuthCallback";
import { PaymentSuccess } from "./components/PaymentSuccess";
import { TrialManager } from "./components/TrialManager";
import EnvironmentIndicator from "./components/EnvironmentIndicator";

// Admin Pages
import AdminLayout from "./components/Layout/AdminLayout";
import AdminDashboard from "./pages/Admin/AdminDashboard";
import AdminUsers from "./pages/Admin/AdminUsers";
import AdminSubscriptions from "./pages/Admin/AdminSubscriptions";
import AdminPayments from "./pages/Admin/AdminPayments";
import AdminCoupons from "./pages/Admin/AdminCoupons";
// SubscriptionGuard is now handled inside DashboardLayout

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <Toaster />
      <Sonner />
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          <AdminProvider>
            <GoogleBusinessProfileProvider>
              <NotificationProvider>
                <SubscriptionProvider>
                  <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
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
            
            {/* Public Review Suggestions Routes - No authentication required */}
            <Route path="/public-reviews/:locationId" element={<PublicReviewSuggestions />} />
            <Route path="/review/:locationId" element={<PublicReviewSuggestions />} />
            
            {/* Protected Dashboard Routes - SubscriptionGuard is applied inside DashboardLayout */}
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
              <Route path="request-reviews" element={<RequestForReviews />} />
              <Route path="settings" element={<Settings />} />
              <Route path="audit" element={<AuditTool />} />
              <Route path="billing" element={<Billing />} />
            </Route>
            
            {/* Upgrade page without layout and without subscription guard (billing-related) */}
            <Route path="/dashboard/upgrade" element={
              <ProtectedRoute>
                <Upgrade />
              </ProtectedRoute>
            } />
            
            {/* Payment success page */}
            <Route path="/payment-success" element={
              <ProtectedRoute>
                <PaymentSuccess />
              </ProtectedRoute>
            } />

            {/* Admin Routes - Protected by AdminRoute */}
            <Route path="/admin" element={
              <ProtectedRoute>
                <AdminRoute>
                  <AdminLayout />
                </AdminRoute>
              </ProtectedRoute>
            }>
              <Route index element={<Navigate to="/admin/dashboard" replace />} />
              <Route path="dashboard" element={<AdminDashboard />} />
              <Route path="users" element={<AdminUsers />} />
              <Route path="subscriptions" element={<AdminSubscriptions />} />
              <Route path="payments" element={<AdminPayments />} />
              <Route path="coupons" element={<AdminCoupons />} />
            </Route>

            {/* ADD ALL CUSTOM ROUTES ABOVE THE CATCH-ALL "*" ROUTE */}
            <Route path="*" element={<NotFound />} />
                </Routes>

                {/* Global Trial Setup Modal */}
                <TrialManager />
                </SubscriptionProvider>
              </NotificationProvider>
            </GoogleBusinessProfileProvider>
          </AdminProvider>
        </AuthProvider>
        {/* Environment indicator - only shows in development */}
        <EnvironmentIndicator />
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
