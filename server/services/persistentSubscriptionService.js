import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PersistentSubscriptionService {
  constructor() {
    this.dataFile = path.join(__dirname, '..', 'data', 'subscriptions.json');
    this.userMappingFile = path.join(__dirname, '..', 'data', 'userGbpMapping.json');
    this.ensureDataFile();
    this.loadSubscriptions();
    this.loadUserMappings();
  }

  ensureDataFile() {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      this.saveData({ subscriptions: {} });
    }
    if (!fs.existsSync(this.userMappingFile)) {
      this.saveUserMappingData({ userToGbpMapping: {}, gbpToUserMapping: {} });
    }
  }

  loadSubscriptions() {
    try {
      const data = fs.readFileSync(this.dataFile, 'utf8');
      this.data = JSON.parse(data);
      console.log('[PersistentSubscriptionService] Loaded subscriptions from file');
    } catch (error) {
      console.error('[PersistentSubscriptionService] Error loading subscriptions:', error);
      this.data = { subscriptions: {} };
    }
  }

  loadUserMappings() {
    try {
      const data = fs.readFileSync(this.userMappingFile, 'utf8');
      this.userMappings = JSON.parse(data);
      console.log('[PersistentSubscriptionService] Loaded user mappings from file');
    } catch (error) {
      console.error('[PersistentSubscriptionService] Error loading user mappings:', error);
      this.userMappings = { userToGbpMapping: {}, gbpToUserMapping: {} };
    }
  }

  saveData(data = this.data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      console.log('[PersistentSubscriptionService] Saved subscriptions to file');
    } catch (error) {
      console.error('[PersistentSubscriptionService] Error saving subscriptions:', error);
    }
  }

  saveUserMappingData(data = this.userMappings) {
    try {
      fs.writeFileSync(this.userMappingFile, JSON.stringify(data, null, 2));
      console.log('[PersistentSubscriptionService] Saved user mappings to file');
    } catch (error) {
      console.error('[PersistentSubscriptionService] Error saving user mappings:', error);
    }
  }

  // Save subscription
  saveSubscription(subscription) {
    if (!subscription.id || !subscription.gbpAccountId) {
      throw new Error('Subscription must have id and gbpAccountId');
    }

    this.data.subscriptions[subscription.gbpAccountId] = subscription;
    this.saveData();

    // Also save user-to-GBP mapping if userId is available
    if (subscription.userId) {
      this.saveUserGbpMapping(subscription.userId, subscription.gbpAccountId);
    }

    console.log(`[PersistentSubscriptionService] Saved subscription for GBP: ${subscription.gbpAccountId}`);
    return subscription;
  }

  // Get subscription by GBP Account ID
  getSubscriptionByGBPAccount(gbpAccountId) {
    return this.data.subscriptions[gbpAccountId] || null;
  }

  // Get subscription by ID
  getSubscriptionById(subscriptionId) {
    for (const sub of Object.values(this.data.subscriptions)) {
      if (sub.id === subscriptionId) {
        return sub;
      }
    }
    return null;
  }

  // Update subscription
  updateSubscription(gbpAccountId, updates) {
    const subscription = this.data.subscriptions[gbpAccountId];
    if (!subscription) {
      throw new Error('Subscription not found');
    }
    
    const updatedSubscription = {
      ...subscription,
      ...updates,
      updatedAt: new Date().toISOString()
    };
    
    this.data.subscriptions[gbpAccountId] = updatedSubscription;
    this.saveData();
    console.log(`[PersistentSubscriptionService] Updated subscription for GBP: ${gbpAccountId}`);
    return updatedSubscription;
  }

  // Delete subscription
  deleteSubscription(gbpAccountId) {
    delete this.data.subscriptions[gbpAccountId];
    this.saveData();
    console.log(`[PersistentSubscriptionService] Deleted subscription for GBP: ${gbpAccountId}`);
  }

  // Get all subscriptions
  getAllSubscriptions() {
    return Object.values(this.data.subscriptions);
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
  saveUserGbpMapping(userId, gbpAccountId) {
    if (!this.userMappings) {
      this.userMappings = { userToGbpMapping: {}, gbpToUserMapping: {} };
    }

    // Save bidirectional mapping
    this.userMappings.userToGbpMapping[userId] = gbpAccountId;
    this.userMappings.gbpToUserMapping[gbpAccountId] = userId;

    this.saveUserMappingData();
    console.log(`[PersistentSubscriptionService] Saved user-GBP mapping: ${userId} <-> ${gbpAccountId}`);
  }

  getGbpAccountByUserId(userId) {
    return this.userMappings?.userToGbpMapping?.[userId] || null;
  }

  getUserIdByGbpAccount(gbpAccountId) {
    return this.userMappings?.gbpToUserMapping?.[gbpAccountId] || null;
  }

  // Get subscription by user ID (using the mapping)
  getSubscriptionByUserId(userId) {
    const gbpAccountId = this.getGbpAccountByUserId(userId);
    if (gbpAccountId) {
      return this.getSubscriptionByGBPAccount(gbpAccountId);
    }
    return null;
  }

  // Alias for backwards compatibility
  getSubscriptionByGBP(gbpAccountId) {
    return this.getSubscriptionByGBPAccount(gbpAccountId);
  }

  // Create a new subscription (alias for saveSubscription with validation)
  createSubscription(subscriptionData) {
    if (!subscriptionData.id || !subscriptionData.gbpAccountId) {
      throw new Error('Subscription must have id and gbpAccountId');
    }

    // Check if subscription already exists
    const existingSubscription = this.getSubscriptionByGBPAccount(subscriptionData.gbpAccountId);
    if (existingSubscription) {
      console.log(`[PersistentSubscriptionService] Subscription already exists for GBP: ${subscriptionData.gbpAccountId}, updating...`);
      return this.updateSubscription(subscriptionData.gbpAccountId, subscriptionData);
    }

    return this.saveSubscription(subscriptionData);
  }
}

// Export singleton instance
const persistentSubscriptionService = new PersistentSubscriptionService();
export default persistentSubscriptionService;