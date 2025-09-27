import { 
  collection, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  Timestamp 
} from 'firebase/firestore';
import { db } from './firebase';

export interface Subscription {
  id?: string;
  userId: string;
  gbpAccountId: string;
  email: string;
  status: 'trial' | 'active' | 'expired' | 'cancelled';
  trialStartDate: Timestamp;
  trialEndDate: Timestamp;
  subscriptionStartDate?: Timestamp;
  subscriptionEndDate?: Timestamp;
  planId?: string;
  planName?: string;
  amount?: number;
  currency?: string;
  profileCount?: number; // Number of profiles included in subscription
  pricePerProfile?: number; // Price per profile (for scaling)
  razorpaySubscriptionId?: string;
  razorpayCustomerId?: string;
  paymentHistory?: PaymentRecord[];
  createdAt: Timestamp;
  updatedAt: Timestamp;
}

export interface PaymentRecord {
  id: string;
  amount: number;
  currency: string;
  status: 'success' | 'failed' | 'pending';
  razorpayPaymentId?: string;
  razorpayOrderId?: string;
  razorpaySignature?: string;
  createdAt: Timestamp;
  description?: string;
}

export interface SubscriptionPlan {
  id: string;
  name: string;
  amount: number;
  currency: string;
  interval: 'monthly' | 'yearly';
  features: string[];
  trialDays: number;
  popular?: boolean;
}

export const SUBSCRIPTION_PLANS: SubscriptionPlan[] = [
  {
    id: 'per_profile_yearly',
    name: 'Pro Plan',
    amount: 9900, // Base amount per profile in cents ($99.00)
    currency: 'USD',
    interval: 'yearly',
    features: [
      '$99 per Google Business Profile/year',
      'Auto-Post Scheduling',
      'Review Management & Auto-Reply',
      'Performance Analytics',
      'Advanced Analytics',
      'API Access',
      'Priority Support',
      'Scale as you grow - unlimited profiles'
    ],
    trialDays: 15,
    popular: true
  }
];

export class SubscriptionService {
  private static COLLECTION_NAME = 'subscriptions';
  private static TRIAL_DAYS = 15;
  private static BASE_PRICE_PER_PROFILE = 9900; // $99 in cents

  static calculateTotalPrice(profileCount: number): number {
    return profileCount * this.BASE_PRICE_PER_PROFILE;
  }

  static formatPriceDisplay(profileCount: number): string {
    const total = this.calculateTotalPrice(profileCount);
    return `$${(total / 100).toFixed(0)}`;
  }

  static getPricingBreakdown(profileCount: number): {
    profileCount: number;
    pricePerProfile: number;
    totalPrice: number;
    displayPrice: string;
  } {
    const totalPrice = this.calculateTotalPrice(profileCount);
    return {
      profileCount,
      pricePerProfile: this.BASE_PRICE_PER_PROFILE,
      totalPrice,
      displayPrice: this.formatPriceDisplay(profileCount)
    };
  }

  static async createTrialSubscription(
    userId: string, 
    gbpAccountId: string, 
    email: string
  ): Promise<Subscription> {
    const existingSubscription = await this.getSubscriptionByGBPAccount(gbpAccountId);
    
    if (existingSubscription) {
      console.log('Subscription already exists for GBP account:', gbpAccountId);
      return existingSubscription;
    }

    const now = Timestamp.now();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + this.TRIAL_DAYS);

    const subscription: Subscription = {
      userId,
      gbpAccountId,
      email,
      status: 'trial',
      trialStartDate: now,
      trialEndDate: Timestamp.fromDate(trialEndDate),
      createdAt: now,
      updatedAt: now,
      paymentHistory: []
    };

    const docRef = doc(collection(db, this.COLLECTION_NAME));
    await setDoc(docRef, subscription);
    
    return { ...subscription, id: docRef.id };
  }

  static async getSubscriptionByGBPAccount(gbpAccountId: string): Promise<Subscription | null> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      where('gbpAccountId', '==', gbpAccountId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
  }

  static async getSubscriptionByUserId(userId: string): Promise<Subscription | null> {
    const q = query(
      collection(db, this.COLLECTION_NAME),
      where('userId', '==', userId)
    );
    
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      return null;
    }

    const doc = querySnapshot.docs[0];
    return { id: doc.id, ...doc.data() } as Subscription;
  }

  static async updateSubscription(
    subscriptionId: string, 
    updates: Partial<Subscription>
  ): Promise<void> {
    const docRef = doc(db, this.COLLECTION_NAME, subscriptionId);
    await updateDoc(docRef, {
      ...updates,
      updatedAt: serverTimestamp()
    });
  }

  static async checkSubscriptionStatus(gbpAccountId: string): Promise<{
    isValid: boolean;
    status: 'trial' | 'active' | 'expired' | 'none';
    daysRemaining?: number;
    subscription?: Subscription;
  }> {
    const subscription = await this.getSubscriptionByGBPAccount(gbpAccountId);
    
    if (!subscription) {
      return { isValid: false, status: 'none' };
    }

    const now = new Date();
    
    if (subscription.status === 'trial') {
      const trialEndDate = subscription.trialEndDate.toDate();
      const daysRemaining = Math.ceil((trialEndDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
      
      if (daysRemaining > 0) {
        return { 
          isValid: true, 
          status: 'trial', 
          daysRemaining,
          subscription 
        };
      } else {
        await this.updateSubscription(subscription.id!, { status: 'expired' });
        return { 
          isValid: false, 
          status: 'expired', 
          daysRemaining: 0,
          subscription: { ...subscription, status: 'expired' }
        };
      }
    }
    
    if (subscription.status === 'active') {
      if (subscription.subscriptionEndDate) {
        const endDate = subscription.subscriptionEndDate.toDate();
        const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
        
        if (daysRemaining > 0) {
          return { 
            isValid: true, 
            status: 'active', 
            daysRemaining,
            subscription 
          };
        } else {
          await this.updateSubscription(subscription.id!, { status: 'expired' });
          return { 
            isValid: false, 
            status: 'expired', 
            daysRemaining: 0,
            subscription: { ...subscription, status: 'expired' }
          };
        }
      }
      
      return { 
        isValid: true, 
        status: 'active',
        subscription 
      };
    }
    
    return { 
      isValid: false, 
      status: subscription.status as any,
      subscription 
    };
  }

  static async addPaymentRecord(
    subscriptionId: string, 
    payment: PaymentRecord
  ): Promise<void> {
    const docRef = doc(db, this.COLLECTION_NAME, subscriptionId);
    const docSnapshot = await getDoc(docRef);
    
    if (!docSnapshot.exists()) {
      throw new Error('Subscription not found');
    }
    
    const subscription = docSnapshot.data() as Subscription;
    const paymentHistory = subscription.paymentHistory || [];
    paymentHistory.push(payment);
    
    await updateDoc(docRef, {
      paymentHistory,
      updatedAt: serverTimestamp()
    });
  }

  static async createTrialWithPaymentMethod(
    userId: string,
    gbpAccountId: string,
    email: string,
    profileCount: number,
    razorpayCustomerId: string,
    razorpayPaymentMethodId?: string
  ): Promise<Subscription> {
    const now = Timestamp.now();
    const trialEndDate = new Date();
    trialEndDate.setDate(trialEndDate.getDate() + this.TRIAL_DAYS);

    const subscription: Subscription = {
      userId,
      gbpAccountId,
      email,
      status: 'trial',
      trialStartDate: now,
      trialEndDate: Timestamp.fromDate(trialEndDate),
      profileCount,
      pricePerProfile: this.BASE_PRICE_PER_PROFILE,
      amount: this.calculateTotalPrice(profileCount),
      currency: 'USD',
      razorpayCustomerId,
      createdAt: now,
      updatedAt: now,
      paymentHistory: []
    };

    const docRef = doc(collection(db, this.COLLECTION_NAME));
    await setDoc(docRef, subscription);

    return { ...subscription, id: docRef.id };
  }

  static async activateSubscription(
    subscriptionId: string,
    planId: string,
    profileCount: number,
    razorpaySubscriptionId: string,
    razorpayCustomerId: string
  ): Promise<void> {
    const plan = SUBSCRIPTION_PLANS.find(p => p.id === planId);
    if (!plan) {
      throw new Error('Invalid plan ID');
    }

    const now = new Date();
    const endDate = new Date();

    if (plan.interval === 'monthly') {
      endDate.setMonth(endDate.getMonth() + 1);
    } else {
      endDate.setFullYear(endDate.getFullYear() + 1);
    }

    const totalAmount = planId === 'per_profile_yearly' ? this.calculateTotalPrice(profileCount) : plan.amount;

    await this.updateSubscription(subscriptionId, {
      status: 'active',
      planId,
      planName: plan.name,
      amount: totalAmount,
      currency: plan.currency,
      profileCount: planId === 'per_profile_yearly' ? profileCount : undefined,
      pricePerProfile: planId === 'per_profile_yearly' ? this.BASE_PRICE_PER_PROFILE : undefined,
      razorpaySubscriptionId,
      razorpayCustomerId,
      subscriptionStartDate: Timestamp.fromDate(now),
      subscriptionEndDate: Timestamp.fromDate(endDate)
    });
  }

  static calculateTrialDaysRemaining(trialEndDate: Timestamp): number {
    const now = new Date();
    const endDate = trialEndDate.toDate();
    const daysRemaining = Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return Math.max(0, daysRemaining);
  }
}