import { Outlet, NavLink } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useAdmin } from '@/contexts/AdminContext';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  LayoutDashboard,
  Users,
  CreditCard,
  Ticket,
  TrendingUp,
  FileText,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  BarChart3
} from 'lucide-react';
import { useState } from 'react';

const AdminLayout = () => {
  // Coming Soon Barrier - Set to false when ready to enable admin panel
  const SHOW_COMING_SOON = false;

  const { currentUser, logout } = useAuth();
  const { adminLevel } = useAdmin();
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
  };

  // Coming Soon Barrier Screen
  if (SHOW_COMING_SOON) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50">
        <Card className="max-w-2xl w-full mx-4 shadow-xl border-0">
          <CardContent className="text-center p-12">
            <div className="mb-6">
              <div className="w-24 h-24 mx-auto bg-gradient-to-br from-blue-500 to-purple-600 rounded-full flex items-center justify-center shadow-lg">
                <Shield className="w-12 h-12 text-white" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Admin Panel</h1>
            <h2 className="text-xl font-semibold text-blue-600 mb-4">Coming Soon!</h2>
            <p className="text-gray-600 mb-8 text-lg">
              The admin panel is currently under development and will be available after payment confirmation.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 mb-8">
              <h3 className="font-semibold text-blue-900 mb-4">Admin Features:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-blue-800">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  <span>User Management</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4" />
                  <span>Payment Tracking</span>
                </div>
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4" />
                  <span>Analytics Dashboard</span>
                </div>
                <div className="flex items-center gap-2">
                  <Ticket className="h-4 w-4" />
                  <span>Coupon Management</span>
                </div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4" />
                  <span>Subscription Control</span>
                </div>
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <span>Audit Logs</span>
                </div>
              </div>
            </div>

            <div className="flex gap-4 justify-center">
              <Button
                onClick={handleLogout}
                variant="outline"
                className="flex items-center gap-2"
              >
                <LogOut className="h-4 w-4" />
                Logout
              </Button>
              <Button
                onClick={() => window.location.href = '/dashboard'}
                className="bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700"
              >
                Go to Dashboard
              </Button>
            </div>

            <p className="text-xs text-gray-500 mt-6">
              Logged in as: {currentUser?.email}
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }
  // End Coming Soon Barrier

  const navigation = [
    { name: 'Dashboard', href: '/admin/dashboard', icon: LayoutDashboard },
    { name: 'Users', href: '/admin/users', icon: Users },
    { name: 'User Audits', href: '/admin/user-audits', icon: BarChart3 },
    { name: 'Subscriptions', href: '/admin/subscriptions', icon: CreditCard },
    { name: 'Payments', href: '/admin/payments', icon: CreditCard },
    { name: 'Coupons', href: '/admin/coupons', icon: Ticket },
    { name: 'Analytics', href: '/admin/analytics', icon: TrendingUp },
    { name: 'Audit Logs', href: '/admin/audits', icon: FileText },
  ];

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Mobile Overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-40 lg:hidden"
          onClick={() => setMobileMenuOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`${
          sidebarOpen ? 'w-64' : 'w-20'
        } ${
          mobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } fixed lg:relative h-full bg-white border-r border-gray-200 text-gray-800 transition-all duration-300 flex flex-col shadow-lg z-50`}
      >
        {/* Logo/Header */}
        <div className="p-4 sm:p-6 flex items-center justify-between">
          {sidebarOpen ? (
            <div className="flex items-center gap-2">
              <Shield className="h-6 w-6 sm:h-8 sm:w-8 text-primary" />
              <div>
                <h1 className="text-lg sm:text-xl font-bold text-gray-900">Admin Panel</h1>
                <p className="text-xs text-gray-500">LOBAISEO</p>
              </div>
            </div>
          ) : (
            <Shield className="h-6 w-6 sm:h-8 sm:w-8 mx-auto text-primary" />
          )}
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              setSidebarOpen(!sidebarOpen);
              if (window.innerWidth < 1024) {
                setMobileMenuOpen(false);
              }
            }}
            className="text-gray-700 hover:bg-primary/10 hover:text-primary"
          >
            {sidebarOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-2 overflow-y-auto">
          {navigation.map((item) => (
            <NavLink
              key={item.name}
              to={item.href}
              onClick={() => {
                if (window.innerWidth < 1024) {
                  setMobileMenuOpen(false);
                }
              }}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 sm:px-4 py-2 sm:py-3 rounded-lg transition-colors ${
                  isActive
                    ? 'bg-primary text-white font-medium shadow-md'
                    : 'text-gray-700 hover:bg-primary/10 hover:text-primary'
                }`
              }
            >
              <item.icon className="h-4 w-4 sm:h-5 sm:w-5 flex-shrink-0" />
              {sidebarOpen && <span className="text-sm sm:text-base">{item.name}</span>}
            </NavLink>
          ))}
        </nav>

        {/* User Info */}
        <div className="p-4 border-t border-gray-200">
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 bg-primary/10">
              <AvatarFallback className="bg-primary/10 text-primary font-semibold">
                {currentUser?.email?.[0].toUpperCase() || 'A'}
              </AvatarFallback>
            </Avatar>
            {sidebarOpen && (
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate text-gray-900">{currentUser?.email}</p>
                <Badge variant="secondary" className="mt-1 text-xs bg-primary/10 text-primary">
                  {adminLevel || 'Admin'}
                </Badge>
              </div>
            )}
          </div>
          {sidebarOpen && (
            <Button
              variant="ghost"
              className="w-full mt-4 text-gray-700 hover:bg-primary/10 hover:text-primary justify-start"
              onClick={handleLogout}
            >
              <LogOut className="h-4 w-4 mr-2" />
              Logout
            </Button>
          )}
        </div>
      </aside>

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 sm:py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {/* Mobile Menu Button */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                className="lg:hidden"
              >
                <Menu className="h-5 w-5" />
              </Button>
              <div>
                <h2 className="text-lg sm:text-xl md:text-2xl font-bold text-gray-900">Admin Portal</h2>
                <p className="text-xs sm:text-sm text-gray-500 hidden sm:block">Manage your LOBAISEO application</p>
              </div>
            </div>
            <div className="flex items-center gap-2 sm:gap-4">
              <Badge variant="outline" className="flex items-center gap-1 sm:gap-2 text-xs">
                <Shield className="h-3 w-3" />
                <span className="hidden sm:inline">Administrator Access</span>
                <span className="sm:hidden">Admin</span>
              </Badge>
            </div>
          </div>
        </header>

        {/* Page Content */}
        <main className="flex-1 overflow-y-auto bg-gray-50 p-3 sm:p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
