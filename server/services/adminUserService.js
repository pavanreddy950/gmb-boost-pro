import admin from 'firebase-admin';
import firebaseConfig from '../config/firebase.js';
import supabaseSubscriptionService from './supabaseSubscriptionService.js';
import supabaseUserMappingService from './supabaseUserMappingService.js';

class AdminUserService {
  constructor() {
    // No longer using JSON files - all data comes from Supabase
  }

  async ensureFirebaseInitialized() {
    try {
      const result = await firebaseConfig.ensureInitialized();
      if (!result.app) {
        console.error('[AdminUserService] Firebase app is null after initialization');
        return false;
      }
      return true;
    } catch (error) {
      console.error('[AdminUserService] Firebase not initialized:', error);
      console.error('[AdminUserService] Stack:', error.stack);
      return false;
    }
  }

  async loadData() {
    try {
      // Fetch data from Supabase database
      const subscriptionsArray = await supabaseSubscriptionService.getAllSubscriptions();
      const mapping = await supabaseUserMappingService.getAllMappings();

      // Convert subscriptions array to object for backward compatibility
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
   */
  async getAllUsers({ page = 1, limit = 50, search = '', status = 'all' }) {
    try {
      // Ensure Firebase is initialized
      const initialized = await this.ensureFirebaseInitialized();
      if (!initialized) {
        throw new Error('Firebase Admin SDK is not initialized. Please check server logs.');
      }

      // Get Firebase users
      const listUsersResult = await admin.auth().listUsers(1000);
      const { subscriptions, mapping } = await this.loadData();

      // Combine Firebase user data with subscription data
      let users = listUsersResult.users.map(user => {
        const gbpAccountId = mapping.userToGbpMapping[user.uid];
        const subscription = gbpAccountId ? subscriptions[gbpAccountId] : null;

        return {
          uid: user.uid,
          email: user.email,
          displayName: user.displayName || 'N/A',
          emailVerified: user.emailVerified,
          disabled: user.disabled,
          createdAt: user.metadata.creationTime,
          lastLoginAt: user.metadata.lastSignInTime,
          customClaims: user.customClaims || {},
          gbpAccountId: gbpAccountId || null,
          subscription: subscription ? {
            status: subscription.status,
            planId: subscription.planId,
            trialEndDate: subscription.trialEndDate,
            subscriptionEndDate: subscription.subscriptionEndDate,
            profileCount: subscription.profileCount || 0
          } : null
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
   * Get user by UID with detailed information
   */
  async getUserById(uid) {
    try {
      // Ensure Firebase is initialized
      const initialized = await this.ensureFirebaseInitialized();
      if (!initialized) {
        throw new Error('Firebase Admin SDK is not initialized. Please check server logs.');
      }

      const user = await admin.auth().getUser(uid);
      const { subscriptions, mapping } = await this.loadData();

      const gbpAccountId = mapping.userToGbpMapping[uid];
      const subscription = gbpAccountId ? subscriptions[gbpAccountId] : null;

      return {
        uid: user.uid,
        email: user.email,
        displayName: user.displayName || 'N/A',
        emailVerified: user.emailVerified,
        disabled: user.disabled,
        phoneNumber: user.phoneNumber,
        photoURL: user.photoURL,
        createdAt: user.metadata.creationTime,
        lastLoginAt: user.metadata.lastSignInTime,
        customClaims: user.customClaims || {},
        providerData: user.providerData,
        gbpAccountId,
        subscription: subscription || null
      };
    } catch (error) {
      console.error('Error getting user:', error);
      throw error;
    }
  }

  /**
   * Update user custom claims (e.g., make admin)
   */
  async setUserRole(uid, role, adminLevel = 'viewer') {
    try {
      // Ensure Firebase is initialized
      const initialized = await this.ensureFirebaseInitialized();
      if (!initialized) {
        throw new Error('Firebase Admin SDK is not initialized. Please check server logs.');
      }

      await admin.auth().setCustomUserClaims(uid, {
        role,
        adminLevel
      });

      return {
        success: true,
        message: `User role updated to ${role}${role === 'admin' ? ` (${adminLevel})` : ''}`
      };
    } catch (error) {
      console.error('Error setting user role:', error);
      throw error;
    }
  }

  /**
   * Disable/Enable user account
   */
  async toggleUserStatus(uid, disabled) {
    try {
      // Ensure Firebase is initialized
      const initialized = await this.ensureFirebaseInitialized();
      if (!initialized) {
        throw new Error('Firebase Admin SDK is not initialized. Please check server logs.');
      }

      await admin.auth().updateUser(uid, { disabled });

      return {
        success: true,
        message: disabled ? 'User account suspended' : 'User account activated'
      };
    } catch (error) {
      console.error('Error toggling user status:', error);
      throw error;
    }
  }

  /**
   * Get user statistics
   */
  async getUserStats() {
    try {
      // Ensure Firebase is initialized
      const initialized = await this.ensureFirebaseInitialized();
      if (!initialized) {
        throw new Error('Firebase Admin SDK is not initialized. Please check server logs.');
      }

      const { subscriptions } = await this.loadData();
      const allUsers = await admin.auth().listUsers(1000);

      const stats = {
        totalUsers: allUsers.users.length,
        activeSubscriptions: 0,
        trialSubscriptions: 0,
        expiredSubscriptions: 0,
        noSubscription: 0,
        emailVerified: 0,
        disabledUsers: 0
      };

      // Count subscriptions
      Object.values(subscriptions).forEach(sub => {
        if (sub.status === 'active') stats.activeSubscriptions++;
        else if (sub.status === 'trial') stats.trialSubscriptions++;
        else stats.expiredSubscriptions++;
      });

      stats.noSubscription = stats.totalUsers - (stats.activeSubscriptions + stats.trialSubscriptions + stats.expiredSubscriptions);

      // Count user statuses
      allUsers.users.forEach(user => {
        if (user.emailVerified) stats.emailVerified++;
        if (user.disabled) stats.disabledUsers++;
      });

      return stats;
    } catch (error) {
      console.error('Error getting user stats:', error);
      throw error;
    }
  }

  /**
   * Delete user account
   */
  async deleteUser(uid) {
    try {
      // Ensure Firebase is initialized
      const initialized = await this.ensureFirebaseInitialized();
      if (!initialized) {
        throw new Error('Firebase Admin SDK is not initialized. Please check server logs.');
      }

      await admin.auth().deleteUser(uid);

      return {
        success: true,
        message: 'User account deleted successfully'
      };
    } catch (error) {
      console.error('Error deleting user:', error);
      throw error;
    }
  }
}

export default new AdminUserService();
