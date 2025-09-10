import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class PersistentSubscriptionService {
  constructor() {
    this.dataFile = path.join(__dirname, '..', 'data', 'subscriptions.json');
    this.ensureDataFile();
    this.loadSubscriptions();
  }

  ensureDataFile() {
    const dir = path.dirname(this.dataFile);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    if (!fs.existsSync(this.dataFile)) {
      this.saveData({ subscriptions: {} });
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

  saveData(data = this.data) {
    try {
      fs.writeFileSync(this.dataFile, JSON.stringify(data, null, 2));
      console.log('[PersistentSubscriptionService] Saved subscriptions to file');
    } catch (error) {
      console.error('[PersistentSubscriptionService] Error saving subscriptions:', error);
    }
  }

  // Save subscription
  saveSubscription(subscription) {
    if (!subscription.id || !subscription.gbpAccountId) {
      throw new Error('Subscription must have id and gbpAccountId');
    }
    
    this.data.subscriptions[subscription.gbpAccountId] = subscription;
    this.saveData();
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
    
    const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  }
}

export default PersistentSubscriptionService;