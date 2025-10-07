import firebaseConfig from '../config/firebase.js';

class FirestoreSubscriptionService {
  constructor() {
    this.collectionName = 'subscriptions';
    this.userMappingCollection = 'userGbpMappings';
    this.db = null;
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) {
      return;
    }

    try {
      const { db } = await firebaseConfig.ensureInitialized();
      if (!db) {
        console.warn('[FirestoreSubscriptionService] Firestore not available - using fallback');
        return false;
      }
      this.db = db;
      this.initialized = true;
      console.log('[FirestoreSubscriptionService] ✅ Initialized with Firestore');
      return true;
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Failed to initialize:', error);
      return false;
    }
  }

  async ensureInitialized() {
    if (!this.initialized) {
      await this.initialize();
    }
    if (!this.db) {
      throw new Error('Firestore not available');
    }
  }

  // Save subscription
  async saveSubscription(subscription) {
    await this.ensureInitialized();

    if (!subscription.id || !subscription.gbpAccountId) {
      throw new Error('Subscription must have id and gbpAccountId');
    }

    try {
      const docRef = this.db.collection(this.collectionName).doc(subscription.gbpAccountId);
      await docRef.set({
        ...subscription,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Also save user-to-GBP mapping if userId is available
      if (subscription.userId) {
        await this.saveUserGbpMapping(subscription.userId, subscription.gbpAccountId);
      }

      console.log(`[FirestoreSubscriptionService] Saved subscription for GBP: ${subscription.gbpAccountId}`);
      return subscription;
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error saving subscription:', error);
      throw error;
    }
  }

  // Get subscription by GBP Account ID
  async getSubscriptionByGBPAccount(gbpAccountId) {
    await this.ensureInitialized();

    try {
      const docRef = this.db.collection(this.collectionName).doc(gbpAccountId);
      const doc = await docRef.get();

      if (!doc.exists) {
        return null;
      }

      return doc.data();
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error getting subscription:', error);
      return null;
    }
  }

  // Get subscription by ID
  async getSubscriptionById(subscriptionId) {
    await this.ensureInitialized();

    try {
      const snapshot = await this.db.collection(this.collectionName)
        .where('id', '==', subscriptionId)
        .limit(1)
        .get();

      if (snapshot.empty) {
        return null;
      }

      return snapshot.docs[0].data();
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error getting subscription by ID:', error);
      return null;
    }
  }

  // Update subscription
  async updateSubscription(gbpAccountId, updates) {
    await this.ensureInitialized();

    try {
      const docRef = this.db.collection(this.collectionName).doc(gbpAccountId);
      const doc = await docRef.get();

      if (!doc.exists) {
        throw new Error('Subscription not found');
      }

      const updatedSubscription = {
        ...doc.data(),
        ...updates,
        updatedAt: new Date().toISOString()
      };

      await docRef.update(updatedSubscription);
      console.log(`[FirestoreSubscriptionService] Updated subscription for GBP: ${gbpAccountId}`);
      return updatedSubscription;
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error updating subscription:', error);
      throw error;
    }
  }

  // Delete subscription
  async deleteSubscription(gbpAccountId) {
    await this.ensureInitialized();

    try {
      await this.db.collection(this.collectionName).doc(gbpAccountId).delete();
      console.log(`[FirestoreSubscriptionService] Deleted subscription for GBP: ${gbpAccountId}`);
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error deleting subscription:', error);
      throw error;
    }
  }

  // Get all subscriptions
  async getAllSubscriptions() {
    await this.ensureInitialized();

    try {
      const snapshot = await this.db.collection(this.collectionName).get();
      return snapshot.docs.map(doc => doc.data());
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error getting all subscriptions:', error);
      return [];
    }
  }

  // Check if subscription is valid (not expired)
  isSubscriptionValid(subscription) {
    if (!subscription) return false;

    const now = new Date();

    // Check trial status
    if (subscription.status === 'trial') {
      const trialEndDate = new Date(subscription.trialEndDate);
      return trialEndDate > now;
    }

    // Check paid subscription
    if (subscription.status === 'active' || subscription.status === 'paid') {
      if (subscription.subscriptionEndDate) {
        const endDate = new Date(subscription.subscriptionEndDate);
        return endDate > now;
      }
      return true; // No end date means lifetime subscription
    }

    return false;
  }

  // Calculate days remaining
  calculateDaysRemaining(subscription) {
    if (!subscription) return 0;

    const now = new Date();
    let endDate;

    if (subscription.status === 'trial') {
      endDate = new Date(subscription.trialEndDate);
    } else if (subscription.subscriptionEndDate) {
      endDate = new Date(subscription.subscriptionEndDate);
    } else {
      return null; // No expiry
    }

    const timeDiff = endDate - now;
    const exactDaysRemaining = timeDiff / (1000 * 60 * 60 * 24);

    // Use Math.floor for more accurate day counting (don't round up partial days)
    // But show at least 0 if there's still time left (even if less than a day)
    const daysRemaining = timeDiff > 0 ? Math.max(1, Math.floor(exactDaysRemaining)) : 0;
    return daysRemaining;
  }

  // User-GBP mapping methods
  async saveUserGbpMapping(userId, gbpAccountId) {
    await this.ensureInitialized();

    try {
      // Save user-to-GBP mapping
      await this.db.collection(this.userMappingCollection).doc(userId).set({
        userId,
        gbpAccountId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // Save GBP-to-user mapping (reverse)
      await this.db.collection(this.userMappingCollection).doc(`gbp_${gbpAccountId}`).set({
        gbpAccountId,
        userId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      console.log(`[FirestoreSubscriptionService] Saved user-GBP mapping: ${userId} <-> ${gbpAccountId}`);
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error saving user-GBP mapping:', error);
    }
  }

  async getGbpAccountByUserId(userId) {
    await this.ensureInitialized();

    try {
      const doc = await this.db.collection(this.userMappingCollection).doc(userId).get();
      if (!doc.exists) {
        return null;
      }
      return doc.data().gbpAccountId || null;
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error getting GBP account by user ID:', error);
      return null;
    }
  }

  async getUserIdByGbpAccount(gbpAccountId) {
    await this.ensureInitialized();

    try {
      const doc = await this.db.collection(this.userMappingCollection).doc(`gbp_${gbpAccountId}`).get();
      if (!doc.exists) {
        return null;
      }
      return doc.data().userId || null;
    } catch (error) {
      console.error('[FirestoreSubscriptionService] Error getting user ID by GBP account:', error);
      return null;
    }
  }

  // Get subscription by user ID (using the mapping)
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

  // Create a new subscription (alias for saveSubscription with validation)
  async createSubscription(subscriptionData) {
    if (!subscriptionData.id || !subscriptionData.gbpAccountId) {
      throw new Error('Subscription must have id and gbpAccountId');
    }

    // Check if subscription already exists
    const existingSubscription = await this.getSubscriptionByGBPAccount(subscriptionData.gbpAccountId);
    if (existingSubscription) {
      console.log(`[FirestoreSubscriptionService] Subscription already exists for GBP: ${subscriptionData.gbpAccountId}, updating...`);
      return await this.updateSubscription(subscriptionData.gbpAccountId, subscriptionData);
    }

    return await this.saveSubscription(subscriptionData);
  }
}

// Export singleton instance
const firestoreSubscriptionService = new FirestoreSubscriptionService();
export default firestoreSubscriptionService;
