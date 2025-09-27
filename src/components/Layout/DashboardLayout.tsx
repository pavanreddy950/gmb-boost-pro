import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Topbar from "./Topbar";
import { ConditionalSubscriptionGuard } from "../ConditionalSubscriptionGuard";

const DashboardLayout = () => {
  const [sidebarOpen, setSidebarOpen] = useState(false);

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
    </div>
  );
};

export default DashboardLayout;