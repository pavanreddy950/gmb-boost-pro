import { NavLink, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import {
  FileText,
  Star,
  Settings,
  Search,
  MessageSquarePlus,
  Users,
  X,
  CreditCard,
  Mail,
  Share2,
  Sparkles,
  Images
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const location = useLocation();

  const navItems = [
    { label: "Profiles", href: "/dashboard", icon: Users },
    { label: "Posts", href: "/dashboard/posts", icon: FileText },
    { label: "Reviews", href: "/dashboard/reviews", icon: Star },
    { label: "Audit Tool", href: "/dashboard/audit", icon: Search },
    { label: "Magic QR", href: "/dashboard/ask-for-reviews", icon: MessageSquarePlus },
    { label: "Auto Gallery", href: "/dashboard/photos-dump", icon: Images, badge: "New" },
    { label: "Request for Reviews", href: "/dashboard/request-reviews", icon: Mail, badge: "Beta" },
    { label: "Social Media", href: "/dashboard/social-media", icon: Share2, badge: "Coming Soon" },
    { label: "Profile Optimization", href: "/dashboard/profile-optimization", icon: Sparkles, badge: "Coming Soon" },
  ];

  const isActive = (href: string) => {
    // Exact match for dashboard route
    if (href === "/dashboard") {
      return location.pathname === "/dashboard" || location.pathname === "/";
    }
    // For other routes, check if current path starts with the href
    return location.pathname.startsWith(href);
  };

  return (
    <div className={cn(
      "fixed left-0 top-0 z-40 h-screen w-64 bg-card border-r border-border transition-transform duration-300 ease-in-out",
      "lg:translate-x-0", // Always visible on desktop
      isOpen ? "translate-x-0" : "-translate-x-full" // Mobile: slide in/out based on isOpen
    )}>
      {/* Header - Match topbar height */}
      <div className="h-16 flex items-center justify-between p-4 border-b border-border bg-card">
        {/* Mobile close button */}
        <div className="lg:hidden">
          <button
            onClick={onClose}
            className="h-8 w-8 p-0 flex items-center justify-center rounded-md hover:bg-muted"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-2 lg:mx-0 mx-auto">
          <img 
            src="/Frame 24.svg" 
            alt="LOBAISEO Logo" 
            className="h-8 w-auto"
          />
        </div>
        
        {/* Spacer for mobile to center the logo */}
        <div className="lg:hidden w-8"></div>
      </div>

      {/* Navigation - Scrollable */}
      <div
        className="overflow-y-auto scrollbar-themed"
        style={{
          maxHeight: 'calc(100vh - 4rem)',
          scrollbarWidth: 'thin',
          scrollbarColor: '#1B29CB transparent'
        }}
      >
        <nav className="p-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.href}
              to={item.href}
              className={() => {
                const currentlyActive = isActive(item.href);
                return cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group",
                  currentlyActive
                    ? "shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                );
              }}
              style={() => {
                const currentlyActive = isActive(item.href);
                return currentlyActive
                  ? { backgroundColor: '#DBEAFE', color: '#1B29CB' }
                  : {};
              }}
            >
              <item.icon
                className="h-5 w-5 flex-shrink-0 transition-transform group-hover:scale-105"
                style={
                  isActive(item.href)
                    ? { color: '#1B29CB' }
                    : {}
                }
              />
              <span className="font-medium truncate flex-1">{item.label}</span>
              {item.badge && (
                <span className={cn(
                  "flex-shrink-0 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wide rounded-full text-white shadow-sm",
                  item.badge === "Coming Soon" && "bg-gradient-to-r from-blue-500 to-blue-600",
                  item.badge === "Beta" && "bg-gradient-to-r from-violet-500 to-pink-500",
                  item.badge === "New" && "bg-gradient-to-r from-green-500 to-emerald-500"
                )}>
                  {item.badge}
                </span>
              )}
            </NavLink>
          ))}

          {/* Account Section */}
          <div className="pt-4 mt-4 border-t border-border">
            <div className="px-3 mb-2">
              <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Account</span>
            </div>

            {/* Settings */}
            <NavLink
              to="/dashboard/settings"
              className={() => {
                const currentlyActive = isActive("/dashboard/settings");
                return cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group",
                  currentlyActive
                    ? "shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                );
              }}
              style={() => {
                const currentlyActive = isActive("/dashboard/settings");
                return currentlyActive
                  ? { backgroundColor: '#DBEAFE', color: '#1B29CB' }
                  : {};
              }}
            >
              <Settings
                className="h-5 w-5 transition-transform group-hover:scale-105"
                style={
                  isActive("/dashboard/settings")
                    ? { color: '#1B29CB' }
                    : {}
                }
              />
              <span className="font-medium">Settings</span>
            </NavLink>

            {/* Billing */}
            <NavLink
              to="/dashboard/billing"
              className={() => {
                const currentlyActive = isActive("/dashboard/billing");
                return cn(
                  "flex items-center gap-3 px-3 py-3 rounded-lg transition-all duration-200 group",
                  currentlyActive
                    ? "shadow-sm"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                );
              }}
              style={() => {
                const currentlyActive = isActive("/dashboard/billing");
                return currentlyActive
                  ? { backgroundColor: '#DBEAFE', color: '#1B29CB' }
                  : {};
              }}
            >
              <CreditCard
                className="h-5 w-5 transition-transform group-hover:scale-105"
                style={
                  isActive("/dashboard/billing")
                    ? { color: '#1B29CB' }
                    : {}
                }
              />
              <span className="font-medium">Billing</span>
            </NavLink>
          </div>
        </nav>
      </div>
    </div>
  );
};

export default Sidebar;