// import admin from 'firebase-admin'; // DISABLED for Node.js v25 compatibility
import firebaseConfig from '../config/firebase.js';
import supabaseSubscriptionService from './supabaseSubscriptionService.js';
import supabaseUserMappingService from './supabaseUserMappingService.js';

/**
 * Admin User Service - Modified for Node.js v25 compatibility
 * Firebase Admin SDK disabled - admin functions limited
 */
class AdminUserService {
  constructor() {
    console.log('[AdminUserService] ⚠️ Firebase Admin SDK disabled - admin user functions limited');
  }

  async ensureFirebaseInitialized() {
    // Firebase disabled
    return false;
  }

  async loadData() {
    try {
      const subscriptionsArray = await supabaseSubscriptionService.getAllSubscriptions();
      const mapping = await supabaseUserMappingService.getAllMappings();

      const subscriptionsObj = {};
      subscriptionsArray.forEach(sub => {
        subscriptionsObj[sub.gbpAccountId] = sub;
      });

      return {
        subscriptions: subscriptionsObj,
        mapping: mapping
      };
    } catch (error) {
      console.error('[AdminUserService] Error loading data from Supabase:', error);
      return { subscriptions: {}, mapping: { userToGbpMapping: {}, gbpToUserMapping: {} } };
    }
  }

  /**
   * Get all users with subscription and GBP data
   * NOTE: Firebase Admin SDK disabled - returns Supabase data only
   */
  async getAllUsers({ page = 1, limit = 50, search = '', status = 'all' }) {
    try {
      // Firebase disabled - return data from Supabase only
      const { subscriptions, mapping } = await this.loadData();

      // Convert subscriptions to user-like objects
      let users = Object.entries(subscriptions).map(([gbpAccountId, subscription]) => {
        const userId = mapping.gbpToUserMapping?.[gbpAccountId];
        return {
          uid: userId || `gbp-${gbpAccountId}`,
          email: subscription.email || 'N/A',
          displayName: subscription.businessName || 'N/A',
          emailVerified: true,
          disabled: false,
          createdAt: subscription.createdAt || new Date().toISOString(),
          lastLoginAt: subscription.updatedAt || new Date().toISOString(),
          customClaims: {},
          gbpAccountId: gbpAccountId,
          subscription: {
            status: subscription.status,
            planId: subscription.planId,
            trialEndDate: subscription.trialEndDate,
            subscriptionEndDate: subscription.subscriptionEndDate,
            profileCount: subscription.profileCount || 0
          }
        };
      });

      // Filter by search
      if (search) {
        const searchLower = search.toLowerCase();
        users = users.filter(user =>
          user.email?.toLowerCase().includes(searchLower) ||
          user.displayName?.toLowerCase().includes(searchLower) ||
          user.uid.toLowerCase().includes(searchLower)
        );
      }

      // Filter by status
      if (status !== 'all') {
        users = users.filter(user => user.subscription?.status === status);
      }

      // Pagination
      const total = users.length;
      const startIndex = (page - 1) * limit;
      const endIndex = startIndex + limit;
      const paginatedUsers = users.slice(startIndex, endIndex);

      return {
        users: paginatedUsers,
        pagination: {
          total,
          page,
          limit,
          totalPages: Math.ceil(total / limit)
        }
      };
    } catch (error) {
      console.error('Error getting users:', error);
      throw error;
    }
  }

  /**
   * Get user by UID - Limited without Firebase
   */
  async getUserById(uid) {
    try {
      const { subscriptions, mapping } = await this.loadData();
      const gbpAccountId = mapping.userToGbpMapping?.[uid];
      const subscription = gbpAccountId ? subscriptions[gbpAccountId] : null;

      return {
        uid: uid,
        email: subscription?.email || 'N/A',
        displayName: subscription?.businessName || 'N/A',
        emailVerified: true,
        disabled: false,
        createdAt: subscription?.createdAt || new Date().toISOString(),
        lastLoginAt: subscription?.updatedAt || new Date().toISOString(),
        customClaims: {},
        gbpAccountId,
        subscription: subscription || null
      };
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Update user custom claims - NOT AVAILABLE without Firebase
   */
  async setUserRole(uid, role, adminLevel = 'viewer') {
    console.warn('[AdminUserService] setUserRole not available - Firebase Admin SDK disabled');
    return {
      success: false,
      message: 'Firebase Admin SDK disabled - cannot set user roles'
    };
  }

  /**
   * Disable/Enable user account - NOT AVAILABLE without Firebase
   */
  async toggleUserStatus(uid, disabled) {
    console.warn('[AdminUserService] toggleUserStatus not available - Firebase Admin SDK disabled');
    return {
      success: false,
      message: 'Firebase Admin SDK disabled - cannot toggle user status'
    };
  }

  /**
   * Get user statistics from Supabase
   */
  async getUserStats() {
    try {
      const { subscriptions } = await this.loadData();

      const stats = {
        totalUsers: Object.keys(subscriptions).length,
        activeSubscriptions: 0,
        trialSubscriptions: 0,
        expiredSubscriptions: 0,
        noSubscription: 0,
        emailVerified: 0,
        disabledUsers: 0
      };

      Object.values(subscriptions).forEach(sub => {
        if (sub.status === 'active') stats.activeSubscriptions++;
        else if (sub.status === 'trial') stats.trialSubscriptions++;
        else stats.expiredSubscriptions++;
      });

      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Delete user account - NOT AVAILABLE without Firebase
   */
  async deleteUser(uid) {
    console.warn('[AdminUserService] deleteUser not available - Firebase Admin SDK disabled');
    return {
      success: false,
      message: 'Firebase Admin SDK disabled - cannot delete users'
    };
  }
}

export default new AdminUserService();
