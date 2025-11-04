import { useState, useEffect } from "react";
import { Outlet, useLocation } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ConditionalSubscriptionGuard } from "../ConditionalSubscriptionGuard";
import { MandateSetup } from "../MandateSetup";
import { useSubscription } from "@/contexts/SubscriptionContext";

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [showMandateSetup, setShowMandateSetup] = useState(false);
  const [mandateCheckDone, setMandateCheckDone] = useState(false);

  const { subscription, status } = useSubscription();
  const location = useLocation();

  // MANDATORY: Check if mandate setup is needed - only for NEW users (not existing users with payment history)
  useEffect(() => {
    const checkMandateStatus = async () => {
      // Only check once and when user has a subscription
      if (mandateCheckDone || !subscription?.gbpAccountId || status === 'none') {
        return;
      }

      // IMPORTANT: Skip mandate check for paid/active users with existing subscription
      // Only show mandate to trial users who haven't paid yet
      if (status === 'active' || status === 'trial_expired') {
        console.log('[Mandate Check] User has active/expired subscription - skipping mandate check');
        setMandateCheckDone(true);
        return;
      }

      try {
        const backendUrl = import.meta.env.VITE_BACKEND_URL || 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
        const response = await fetch(`${backendUrl}/api/payment/mandate/status/${subscription.gbpAccountId}`);

        if (response.ok) {
          const data = await response.json();

          console.log('[Mandate Check] Status for', subscription.gbpAccountId, ':', data);

          // IMPORTANT: Only show mandate setup for NEW users
          // Existing users with payment history are automatically considered authorized
          // This prevents the mandate popup from showing to existing customers
          if (!data.mandateAuthorized) {
            console.log('[Mandate Check] NOT authorized - showing mandate setup');
            setShowMandateSetup(true);
          } else {
            console.log('[Mandate Check] ALREADY authorized - skipping mandate setup');
          }

          setMandateCheckDone(true);
        }
      } catch (error) {
        console.error('[Mandate Check] Error checking mandate status:', error);
        setMandateCheckDone(true);
      }
    };

    checkMandateStatus();
  }, [subscription?.gbpAccountId, status, mandateCheckDone]);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

        {/* Mobile overlay */}
        {sidebarOpen && (
          <div
            className="fixed inset-0 bg-black/50 z-30 lg:hidden"
            onClick={() => setSidebarOpen(false)}
          />
        )}

        <div className="flex-1 flex flex-col ml-0 lg:ml-64">
          <Topbar onMenuClick={() => setSidebarOpen(true)} />

          <main className="flex-1 p-4 sm:p-6 bg-muted/30">
            <div className="animate-fade-in">
              <ConditionalSubscriptionGuard>
                <Outlet />
              </ConditionalSubscriptionGuard>
            </div>
          </main>
        </div>
      </div>

      {/* Mandate Setup Modal */}
      <MandateSetup
        isOpen={showMandateSetup}
        onClose={() => setShowMandateSetup(false)}
        onSuccess={() => {
          setShowMandateSetup(false);
        }}
      />
    </div>
  );
};

export default DashboardLayout;