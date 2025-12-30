import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth } from './AuthContext';
import { toast } from '@/hooks/use-toast';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'https://lobaiseo-backend-yjnl.onrender.com';

interface AdminContextType {
  isAdmin: boolean;
  adminLevel: string | null;
  isLoading: boolean;
  dashboardStats: any | null;
  users: any[];
  subscriptions: any[];
  payments: any[];
  coupons: any[];
  analytics: any | null;
  auditLogs: any[];
  auditStats: any | null;
  fetchDashboardStats: () => Promise<void>;
  fetchUsers: (params?: any) => Promise<void>;
  fetchSubscriptions: () => Promise<void>;
  fetchPayments: () => Promise<void>;
  fetchCoupons: () => Promise<void>;
  fetchAnalytics: (timeRange?: string) => Promise<void>;
  fetchAuditLogs: (params?: any) => Promise<void>;
  fetchAuditStats: () => Promise<void>;
  createCoupon: (data: any) => Promise<any>;
  deactivateCoupon: (code: string) => Promise<any>;
  updateUserRole: (uid: string, role: string, adminLevel?: string) => Promise<any>;
  toggleUserStatus: (uid: string, disabled: boolean) => Promise<any>;
  cancelUserSubscription: (gbpAccountId: string) => Promise<any>;
  createUserSubscription: (data: { userId: string; email: string; profileCount: number; durationMonths: number; planId?: string }) => Promise<any>;
}

const AdminContext = createContext<AdminContextType | undefined>(undefined);

export const useAdmin = () => {
  const context = useContext(AdminContext);
  if (context === undefined) {
    throw new Error('useAdmin must be used within an AdminProvider');
  }
  return context;
};

interface AdminProviderProps {
  children: React.ReactNode;
}

export const AdminProvider: React.FC<AdminProviderProps> = ({ children }) => {
  const { currentUser } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminLevel, setAdminLevel] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [dashboardStats, setDashboardStats] = useState<any>(null);
  const [users, setUsers] = useState<any[]>([]);
  const [subscriptions, setSubscriptions] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [coupons, setCoupons] = useState<any[]>([]);
  const [analytics, setAnalytics] = useState<any>(null);
  const [auditLogs, setAuditLogs] = useState<any[]>([]);
  const [auditStats, setAuditStats] = useState<any>(null);

  // Check if user is admin
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!currentUser) {
        setIsAdmin(false);
        setAdminLevel(null);
        setIsLoading(false);
        return;
      }

      try {
        const tokenResult = await currentUser.getIdTokenResult();
        const role = tokenResult.claims.role;
        const level = tokenResult.claims.adminLevel;

        setIsAdmin(role === 'admin');
        setAdminLevel(level || 'viewer');
      } catch (error) {
        console.error('Error checking admin status:', error);
        setIsAdmin(false);
        setAdminLevel(null);
      } finally {
        setIsLoading(false);
      }
    };

    checkAdminStatus();
  }, [currentUser]);

  const getAuthHeaders = async () => {
    if (!currentUser) throw new Error('Not authenticated');
    const token = await currentUser.getIdToken();
    return {
      'Authorization': `Bearer ${token}`,
      'Content-Type': 'application/json'
    };
  };

  const fetchDashboardStats = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/dashboard/stats`, { headers });

      if (!response.ok) throw new Error('Failed to fetch dashboard stats');

      const result = await response.json();
      setDashboardStats(result.data);
    } catch (error: any) {
      console.error('Error fetching dashboard stats:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch dashboard statistics',
        variant: 'destructive'
      });
    }
  };

  const fetchUsers = async (params: any = {}) => {
    try {
      const headers = await getAuthHeaders();
      const queryParams = new URLSearchParams(params).toString();
      const response = await fetch(`${BACKEND_URL}/api/admin/users?${queryParams}`, { headers });

      if (!response.ok) throw new Error('Failed to fetch users');

      const result = await response.json();
      setUsers(result.data.users || []);
    } catch (error: any) {
      console.error('Error fetching users:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch users',
        variant: 'destructive'
      });
    }
  };

  const fetchSubscriptions = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/subscriptions`, { headers });

      if (!response.ok) throw new Error('Failed to fetch subscriptions');

      const result = await response.json();
      setSubscriptions(result.data || []);
    } catch (error: any) {
      console.error('Error fetching subscriptions:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch subscriptions',
        variant: 'destructive'
      });
    }
  };

  const fetchPayments = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/payments`, { headers });

      if (!response.ok) throw new Error('Failed to fetch payments');

      const result = await response.json();
      setPayments(result.data || []);
    } catch (error: any) {
      console.error('Error fetching payments:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch payments',
        variant: 'destructive'
      });
    }
  };

  const fetchCoupons = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/coupons`, { headers });

      if (!response.ok) throw new Error('Failed to fetch coupons');

      const result = await response.json();
      setCoupons(result.data || []);
    } catch (error: any) {
      console.error('Error fetching coupons:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch coupons',
        variant: 'destructive'
      });
    }
  };

  const fetchAnalytics = async (timeRange: string = '30days') => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/analytics/revenue?timeRange=${timeRange}`, { headers });

      if (!response.ok) throw new Error('Failed to fetch analytics');

      const result = await response.json();
      setAnalytics(result.data);
    } catch (error: any) {
      console.error('Error fetching analytics:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch analytics',
        variant: 'destructive'
      });
    }
  };

  const createCoupon = async (data: any) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/coupons`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to create coupon');

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Coupon created successfully'
        });
        await fetchCoupons(); // Refresh coupons list
      }

      return result;
    } catch (error: any) {
      console.error('Error creating coupon:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create coupon',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const deactivateCoupon = async (code: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/coupons/${code}/deactivate`, {
        method: 'PUT',
        headers
      });

      if (!response.ok) throw new Error('Failed to deactivate coupon');

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Coupon deactivated successfully'
        });
        await fetchCoupons(); // Refresh coupons list
      }

      return result;
    } catch (error: any) {
      console.error('Error deactivating coupon:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to deactivate coupon',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const updateUserRole = async (uid: string, role: string, adminLevel: string = 'viewer') => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/users/${uid}/role`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ role, adminLevel })
      });

      if (!response.ok) throw new Error('Failed to update user role');

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.data.message
        });
        await fetchUsers(); // Refresh users list
      }

      return result;
    } catch (error: any) {
      console.error('Error updating user role:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to update user role',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const toggleUserStatus = async (uid: string, disabled: boolean) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/users/${uid}/status`, {
        method: 'PUT',
        headers,
        body: JSON.stringify({ disabled })
      });

      if (!response.ok) throw new Error('Failed to toggle user status');

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: result.data.message
        });
        await fetchUsers(); // Refresh users list
      }

      return result;
    } catch (error: any) {
      console.error('Error toggling user status:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to toggle user status',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const fetchAuditLogs = async (params: any = {}) => {
    try {
      const headers = await getAuthHeaders();
      const queryParams = new URLSearchParams(params).toString();
      const response = await fetch(`${BACKEND_URL}/api/admin/audit-logs?${queryParams}`, { headers });

      if (!response.ok) throw new Error('Failed to fetch audit logs');

      const result = await response.json();
      setAuditLogs(result.data.logs || []);
    } catch (error: any) {
      console.error('Error fetching audit logs:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch audit logs',
        variant: 'destructive'
      });
    }
  };

  const fetchAuditStats = async () => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/audit-logs/stats`, { headers });

      if (!response.ok) throw new Error('Failed to fetch audit stats');

      const result = await response.json();
      setAuditStats(result.data);
    } catch (error: any) {
      console.error('Error fetching audit stats:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to fetch audit statistics',
        variant: 'destructive'
      });
    }
  };

  const cancelUserSubscription = async (gbpAccountId: string) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/subscriptions/${gbpAccountId}/cancel`, {
        method: 'POST',
        headers
      });

      if (!response.ok) throw new Error('Failed to cancel subscription');

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Subscription cancelled successfully'
        });
        await fetchSubscriptions(); // Refresh subscriptions list
        await fetchUsers(); // Refresh users list
      }

      return result;
    } catch (error: any) {
      console.error('Error cancelling subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to cancel subscription',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const createUserSubscription = async (data: { userId: string; email: string; profileCount: number; durationMonths: number; planId?: string }) => {
    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${BACKEND_URL}/api/admin/subscriptions/create`, {
        method: 'POST',
        headers,
        body: JSON.stringify(data)
      });

      if (!response.ok) throw new Error('Failed to create subscription');

      const result = await response.json();

      if (result.success) {
        toast({
          title: 'Success',
          description: 'Subscription created successfully'
        });
        await fetchSubscriptions(); // Refresh subscriptions list
        await fetchUsers(); // Refresh users list
      }

      return result;
    } catch (error: any) {
      console.error('Error creating subscription:', error);
      toast({
        title: 'Error',
        description: error.message || 'Failed to create subscription',
        variant: 'destructive'
      });
      throw error;
    }
  };

  const value = {
    isAdmin,
    adminLevel,
    isLoading,
    dashboardStats,
    users,
    subscriptions,
    payments,
    coupons,
    analytics,
    auditLogs,
    auditStats,
    fetchDashboardStats,
    fetchUsers,
    fetchSubscriptions,
    fetchPayments,
    fetchCoupons,
    fetchAnalytics,
    fetchAuditLogs,
    fetchAuditStats,
    createCoupon,
    deactivateCoupon,
    updateUserRole,
    toggleUserStatus,
    cancelUserSubscription,
    createUserSubscription
  };

  return <AdminContext.Provider value={value}>{children}</AdminContext.Provider>;
};
