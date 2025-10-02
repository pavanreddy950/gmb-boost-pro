import { NavLink, useLocation, useNavigate, Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  Building2,
  BarChart3,
  FileText,
  Star,
  Settings,
  Search,
  MessageSquarePlus,
  Users,
  X,
  Crown,
  CreditCard,
  Mail
} from "lucide-react";

interface SidebarProps {
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar = ({ isOpen = false, onClose }: SidebarProps) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { label: "Profiles", href: "/dashboard", icon: Users },
    { label: "Posts", href: "/dashboard/posts", icon: FileText },
    { label: "Reviews", href: "/dashboard/reviews", icon: Star },
    { label: "Audit Tool", href: "/dashboard/audit", icon: Search },
    { label: "Request for Reviews", href: "/dashboard/request-reviews", icon: Mail },
    { label: "Billing", href: "/dashboard/billing", icon: CreditCard },
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
          <Button
            variant="ghost"
            size="sm"
            onClick={onClose}
            className="h-8 w-8 p-0"
          >
            <X className="h-4 w-4" />
          </Button>
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

      {/* Navigation */}
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
              className="h-5 w-5 transition-transform group-hover:scale-105"
              style={
                isActive(item.href)
                  ? { color: '#1B29CB' }
                  : {}
              }
            />
            <span className="font-medium">{item.label}</span>
          </NavLink>
        ))}


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
      </nav>

      {/* Bottom CTA Section */}
      <div className="absolute bottom-4 left-4 right-4">
        {/* Ask for Reviews */}
        <div className="bg-gradient-primary p-3 sm:p-4 rounded-lg text-primary-foreground shadow-lg">
          <div className="flex items-center gap-3 mb-3">
            <MessageSquarePlus className="h-5 w-5 sm:h-6 sm:w-6" />
            <h3 className="font-semibold text-sm sm:text-base">Ask for Reviews</h3>
          </div>
          <p className="text-xs sm:text-sm opacity-90 mb-3">
            Generate QR codes for easy reviews
          </p>
          <Link 
            to="/dashboard/ask-for-reviews"
            className="block w-full"
          >
            <Button 
              variant="secondary" 
              size="sm" 
              className="w-full text-primary hover:bg-white/90 text-xs sm:text-sm"
            >
              Generate QR
            </Button>
          </Link>
        </div>
      </div>
    </div>
  );
};

export default Sidebar;