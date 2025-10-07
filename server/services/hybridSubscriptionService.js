import persistentSubscriptionService from './persistentSubscriptionService.js';
import firestoreSubscriptionService from './firestoreSubscriptionService.js';

/**
 * Hybrid Subscription Service
 *
 * This service tries to use Firestore first (cloud persistence),
 * and falls back to file-based storage if Firestore is unavailable.
 *
 * All writes go to both systems for redundancy.
 * Reads prioritize Firestore, with file-based storage as fallback.
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

  // Get subscription by GBP Account ID (reads from Firestore first, then file)
  async getSubscriptionByGBPAccount(gbpAccountId) {
    await this.ensureInitialized();

    // Try Firestore first
    if (this.useFirestore) {
      try {
        const subscription = await firestoreSubscriptionService.getSubscriptionByGBPAccount(gbpAccountId);
        if (subscription) {
          console.log(`[HybridSubscriptionService] Retrieved subscription from Firestore`);
          return subscription;
        }
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading from Firestore, falling back to file storage:', error.message);
      }
    }

    // Fallback to file-based storage
    const subscription = persistentSubscriptionService.getSubscriptionByGBPAccount(gbpAccountId);
    if (subscription) {
      console.log(`[HybridSubscriptionService] Retrieved subscription from file storage`);

      // Sync to Firestore if available and subscription exists
      if (this.useFirestore && subscription) {
        try {
          await firestoreSubscriptionService.saveSubscription(subscription);
          console.log(`[HybridSubscriptionService] Synced subscription to Firestore`);
        } catch (error) {
          console.error('[HybridSubscriptionService] Failed to sync to Firestore:', error.message);
        }
      }
    }

    return subscription;
  }

  // Get subscription by ID
  async getSubscriptionById(subscriptionId) {
    await this.ensureInitialized();

    // Try Firestore first
    if (this.useFirestore) {
      try {
        const subscription = await firestoreSubscriptionService.getSubscriptionById(subscriptionId);
        if (subscription) return subscription;
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading from Firestore:', error.message);
      }
    }

    // Fallback to file-based storage
    return persistentSubscriptionService.getSubscriptionById(subscriptionId);
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

    // Try Firestore first
    if (this.useFirestore) {
      try {
        const subscriptions = await firestoreSubscriptionService.getAllSubscriptions();
        if (subscriptions && subscriptions.length > 0) {
          return subscriptions;
        }
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading all from Firestore:', error.message);
      }
    }

    // Fallback to file-based storage
    return persistentSubscriptionService.getAllSubscriptions();
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

    // Try Firestore first
    if (this.useFirestore) {
      try {
        const gbpAccountId = await firestoreSubscriptionService.getGbpAccountByUserId(userId);
        if (gbpAccountId) return gbpAccountId;
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading mapping from Firestore:', error.message);
      }
    }

    // Fallback to file-based storage
    return persistentSubscriptionService.getGbpAccountByUserId(userId);
  }

  async getUserIdByGbpAccount(gbpAccountId) {
    await this.ensureInitialized();

    // Try Firestore first
    if (this.useFirestore) {
      try {
        const userId = await firestoreSubscriptionService.getUserIdByGbpAccount(gbpAccountId);
        if (userId) return userId;
      } catch (error) {
        console.error('[HybridSubscriptionService] Error reading mapping from Firestore:', error.message);
      }
    }

    // Fallback to file-based storage
    return persistentSubscriptionService.getUserIdByGbpAccount(gbpAccountId);
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
