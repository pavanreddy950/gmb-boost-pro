import persistentSubscriptionService from './persistentSubscriptionService.js';
import firestoreSubscriptionService from './firestoreSubscriptionService.js';

/**
 * Hybrid Subscription Service
 *
 * This service uses FILE-BASED STORAGE as the source of truth for subscription data,
 * with Firestore as a cloud backup/sync system.
 *
 * ARCHITECTURE:
 * - All writes go to file storage FIRST, then sync to Firestore
 * - All reads come from file storage FIRST (preserves profileCount for multi-profile subscriptions)
 * - Firestore is used as backup only if file storage is unavailable
 * - This ensures multi-profile subscription data (profileCount, paidLocationIds) persists correctly
 *
 * REASON FOR FILE-FIRST APPROACH:
 * - Prevents data loss when users pay for 2+ profiles
 * - File storage immediately reflects payment updates with accurate profileCount
 * - Firestore sync may lag or fail, causing stale data on reads
 * - On server restart, file storage guarantees correct subscription state
 */
class HybridSubscriptionService {
  constructor() {
    this.useFirestore = true;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      // Try to initialize Firestore
      this.useFirestore = await firestoreSubscriptionService.initialize();
      if (!this.useFirestore) {
        console.warn('[HybridSubscriptionService] Firestore unavailable, using file-based storage only');
      } else {
        console.log('[HybridSubscriptionService] ✅ Using Firestore + file-based storage (hybrid mode)');
      }
      this.initialized = true;
    } catch (error) {
      console.error('[HybridSubscriptionService] Error initializing:', error);
      this.useFirestore = false;
      this.initialized = true;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
  }

  // Save subscription (writes to both)
  async saveSubscription(subscription) {
    await this.ensureInitialized();

    if (!subscription.id || !subscription.gbpAccountId) {
      throw new Error('Subscription must have id and gbpAccountId');
    }

    // Save to file-based storage (always available)
    const fileSaved = persistentSubscriptionService.saveSubscription(subscription);

    // Try to save to Firestore if available
    if (this.useFirestore) {
      try {
        await firestoreSubscriptionService.saveSubscription(subscription);
        console.log(`[HybridSubscriptionService] Saved subscription to both Firestore and file storage`);
      } catch (error) {
        console.error('[HybridSubscriptionService] Failed to save to Firestore, file storage succeeded:', error.message);
      }
    }

    return fileSaved;
  }

  // Get subscription by GBP Account ID (reads from FILE FIRST as source of truth, then syncs to Firestore)
  async getSubscriptionByGBPAccount(gbpAccountId) {
    await this.ensureInitialized();

    // Read from file-based storage FIRST (source of truth for multi-profile subscriptions)
    const subscription = persistentSubscriptionService.getSubscriptionByGBPAccount(gbpAccountId);

    if (subscription) {
      console.log(`[HybridSubscriptionService] ✅ Retrieved subscription from file storage (source of truth)`);
      console.log(`[HybridSubscriptionService] Profile count: ${subscription.profileCount || 1}, Paid locations: ${subscription.paidLocationIds?.length || 0}`);

      // Sync to Firestore if available to keep cloud backup updated
      if (this.useFirestore) {
        try {
          await firestoreSubscriptionService.saveSubscription(subscription);
          console.log(`[HybridSubscriptionService] Synced subscription to Firestore backup`);
        } catch (error) {
          console.error('[HybridSubscriptionService] Failed to sync to Firestore:', error.message);
        }
      }

      return subscription;
    }

    // If not in file storage, try Firestore as backup
    if (this.useFirestore) {
      try {
        const firestoreSubscription = await firestoreSubscriptionService.getSubscriptionByGBPAccount(gbpAccountId);
        if (firestoreSubscription) {
          console.log(`[HybridSubscriptionService] Retrieved subscription from Firestore backup`);
          // Save to file storage to restore it as source of truth
          persistentSubscriptionService.saveSubscription(firestoreSubscription);
          return firestoreSubscription;
        }
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading from Firestore:', error.message);
      }
    }

    console.log(`[HybridSubscriptionService] No subscription found for GBP: ${gbpAccountId}`);
    return null;
  }

  // Get subscription by ID
  async getSubscriptionById(subscriptionId) {
    await this.ensureInitialized();

    // Read from file-based storage FIRST (source of truth)
    const subscription = persistentSubscriptionService.getSubscriptionById(subscriptionId);

    if (subscription) {
      // Sync to Firestore if available
      if (this.useFirestore) {
        try {
          await firestoreSubscriptionService.saveSubscription(subscription);
        } catch (error) {
          console.error('[HybridSubscriptionService] Failed to sync to Firestore:', error.message);
        }
      }
      return subscription;
    }

    // If not in file storage, try Firestore as backup
    if (this.useFirestore) {
      try {
        const firestoreSubscription = await firestoreSubscriptionService.getSubscriptionById(subscriptionId);
        if (firestoreSubscription) {
          // Save to file storage to restore it as source of truth
          persistentSubscriptionService.saveSubscription(firestoreSubscription);
          return firestoreSubscription;
        }
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading from Firestore:', error.message);
      }
    }

    return null;
  }

  // Update subscription (updates both)
  async updateSubscription(gbpAccountId, updates) {
    await this.ensureInitialized();

    // Update file-based storage
    const updated = persistentSubscriptionService.updateSubscription(gbpAccountId, updates);

    // Update Firestore if available
    if (this.useFirestore) {
      try {
        await firestoreSubscriptionService.updateSubscription(gbpAccountId, updates);
      } catch (error) {
        console.error('[HybridSubscriptionService] Failed to update Firestore:', error.message);
      }
    }

    return updated;
  }

  // Delete subscription (deletes from both)
  async deleteSubscription(gbpAccountId) {
    await this.ensureInitialized();

    // Delete from file-based storage
    persistentSubscriptionService.deleteSubscription(gbpAccountId);

    // Delete from Firestore if available
    if (this.useFirestore) {
      try {
        await firestoreSubscriptionService.deleteSubscription(gbpAccountId);
      } catch (error) {
        console.error('[HybridSubscriptionService] Failed to delete from Firestore:', error.message);
      }
    }
  }

  // Get all subscriptions
  async getAllSubscriptions() {
    await this.ensureInitialized();

    // Read from file-based storage FIRST (source of truth)
    const subscriptions = persistentSubscriptionService.getAllSubscriptions();

    if (subscriptions && subscriptions.length > 0) {
      // Sync all to Firestore if available
      if (this.useFirestore) {
        try {
          for (const subscription of subscriptions) {
            await firestoreSubscriptionService.saveSubscription(subscription);
          }
          console.log(`[HybridSubscriptionService] Synced ${subscriptions.length} subscriptions to Firestore`);
        } catch (error) {
          console.error('[HybridSubscriptionService] Failed to sync all subscriptions to Firestore:', error.message);
        }
      }
      return subscriptions;
    }

    // If no subscriptions in file storage, try Firestore as backup
    if (this.useFirestore) {
      try {
        const firestoreSubscriptions = await firestoreSubscriptionService.getAllSubscriptions();
        if (firestoreSubscriptions && firestoreSubscriptions.length > 0) {
          // Restore all to file storage
          for (const subscription of firestoreSubscriptions) {
            persistentSubscriptionService.saveSubscription(subscription);
          }
          return firestoreSubscriptions;
        }
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading all from Firestore:', error.message);
      }
    }

    return [];
  }

  // Check if subscription is valid
  isSubscriptionValid(subscription) {
    return persistentSubscriptionService.isSubscriptionValid(subscription);
  }

  // Calculate days remaining
  calculateDaysRemaining(subscription) {
    return persistentSubscriptionService.calculateDaysRemaining(subscription);
  }

  // User-GBP mapping methods
  async saveUserGbpMapping(userId, gbpAccountId) {
    await this.ensureInitialized();

    // Save to file-based storage
    persistentSubscriptionService.saveUserGbpMapping(userId, gbpAccountId);

    // Save to Firestore if available
    if (this.useFirestore) {
      try {
        await firestoreSubscriptionService.saveUserGbpMapping(userId, gbpAccountId);
      } catch (error) {
        console.error('[HybridSubscriptionService] Failed to save mapping to Firestore:', error.message);
      }
    }
  }

  async getGbpAccountByUserId(userId) {
    await this.ensureInitialized();

    // Read from file-based storage FIRST (source of truth)
    const gbpAccountId = persistentSubscriptionService.getGbpAccountByUserId(userId);

    if (gbpAccountId) {
      // Sync to Firestore if available
      if (this.useFirestore) {
        try {
          await firestoreSubscriptionService.saveUserGbpMapping(userId, gbpAccountId);
        } catch (error) {
          console.error('[HybridSubscriptionService] Failed to sync mapping to Firestore:', error.message);
        }
      }
      return gbpAccountId;
    }

    // If not in file storage, try Firestore as backup
    if (this.useFirestore) {
      try {
        const firestoreGbpAccountId = await firestoreSubscriptionService.getGbpAccountByUserId(userId);
        if (firestoreGbpAccountId) {
          // Restore to file storage
          persistentSubscriptionService.saveUserGbpMapping(userId, firestoreGbpAccountId);
          return firestoreGbpAccountId;
        }
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading mapping from Firestore:', error.message);
      }
    }

    return null;
  }

  async getUserIdByGbpAccount(gbpAccountId) {
    await this.ensureInitialized();

    // Read from file-based storage FIRST (source of truth)
    const userId = persistentSubscriptionService.getUserIdByGbpAccount(gbpAccountId);

    if (userId) {
      // Sync to Firestore if available
      if (this.useFirestore) {
        try {
          await firestoreSubscriptionService.saveUserGbpMapping(userId, gbpAccountId);
        } catch (error) {
          console.error('[HybridSubscriptionService] Failed to sync mapping to Firestore:', error.message);
        }
      }
      return userId;
    }

    // If not in file storage, try Firestore as backup
    if (this.useFirestore) {
      try {
        const firestoreUserId = await firestoreSubscriptionService.getUserIdByGbpAccount(gbpAccountId);
        if (firestoreUserId) {
          // Restore to file storage
          persistentSubscriptionService.saveUserGbpMapping(firestoreUserId, gbpAccountId);
          return firestoreUserId;
        }
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading mapping from Firestore:', error.message);
      }
    }

    return null;
  }

  // Get subscription by user ID
  async getSubscriptionByUserId(userId) {
    const gbpAccountId = await this.getGbpAccountByUserId(userId);
    if (gbpAccountId) {
      return await this.getSubscriptionByGBPAccount(gbpAccountId);
    }
    return null;
  }

  // Alias for backwards compatibility
  async getSubscriptionByGBP(gbpAccountId) {
    return await this.getSubscriptionByGBPAccount(gbpAccountId);
  }

  // Create subscription
  async createSubscription(subscriptionData) {
    await this.ensureInitialized();

    if (!subscriptionData.id || !subscriptionData.gbpAccountId) {
      throw new Error('Subscription must have id and gbpAccountId');
    }

    // Check if subscription already exists
    const existingSubscription = await this.getSubscriptionByGBPAccount(subscriptionData.gbpAccountId);
    if (existingSubscription) {
      console.log(`[HybridSubscriptionService] Subscription already exists for GBP: ${subscriptionData.gbpAccountId}, updating...`);
      return await this.updateSubscription(subscriptionData.gbpAccountId, subscriptionData);
    }

    return await this.saveSubscription(subscriptionData);
  }
}

// Export singleton instance
const hybridSubscriptionService = new HybridSubscriptionService();
export default hybridSubscriptionService;
