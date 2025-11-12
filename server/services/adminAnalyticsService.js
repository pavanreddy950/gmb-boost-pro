import supabaseSubscriptionService from './supabaseSubscriptionService.js';

class AdminAnalyticsService {
  constructor() {
    // No longer using JSON files - all data comes from Supabase
  }

  async loadSubscriptions() {
    try {
      // Fetch subscriptions from Supabase database
      const subscriptionsArray = await supabaseSubscriptionService.getAllSubscriptions();

      // Convert array to object keyed by gbpAccountId for backward compatibility
      const subscriptionsObj = {};
      subscriptionsArray.forEach(sub => {
        subscriptionsObj[sub.gbpAccountId] = sub;
      });

      return subscriptionsObj;
    } catch (error) {
      console.error('[AdminAnalyticsService] Error loading subscriptions from Supabase:', error);
      return {};
    }
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(timeRange = '30days') {
    try {
      const subscriptions = await this.loadSubscriptions();
      const now = new Date();
      let startDate;

      // Calculate start date based on time range
      switch (timeRange) {
        case '7days':
          startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          break;
        case '30days':
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          break;
        case '90days':
          startDate = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
          break;
        case '1year':
          startDate = new Date(now.getTime() - 365 * 24 * 60 * 60 * 1000);
          break;
        default:
          startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      }

      let totalRevenue = 0;
      let totalRevenueINR = 0;
      let totalRevenueUSD = 0;
      let paymentCount = 0;
      const dailyRevenue = new Map();
      const revenueByPlan = new Map();

      // Process all subscriptions
      Object.values(subscriptions).forEach(subscription => {
        if (!subscription.paymentHistory) return;

        subscription.paymentHistory.forEach(payment => {
          const paymentDate = new Date(payment.paidAt || payment.createdAt);

          // Only include payments within time range
          if (paymentDate >= startDate && payment.status === 'success') {
            const amount = payment.amount || 0;
            const currency = payment.currency || 'INR';

            // Convert to USD for total (rough conversion)
            const usdAmount = currency === 'USD' ? amount : amount / 83; // Rough INR to USD

            totalRevenue += usdAmount;
            paymentCount++;

            if (currency === 'INR') {
              totalRevenueINR += amount;
            } else {
              totalRevenueUSD += amount;
            }

            // Daily revenue
            const dateKey = paymentDate.toISOString().split('T')[0];
            dailyRevenue.set(dateKey, (dailyRevenue.get(dateKey) || 0) + usdAmount);

            // Revenue by plan
            const planId = subscription.planId || 'unknown';
            revenueByPlan.set(planId, (revenueByPlan.get(planId) || 0) + usdAmount);
          }
        });
      });

      // Convert daily revenue to array and sort
      const dailyRevenueArray = Array.from(dailyRevenue.entries())
        .map(([date, revenue]) => ({ date, revenue: parseFloat(revenue.toFixed(2)) }))
        .sort((a, b) => new Date(a.date) - new Date(b.date));

      // Convert revenue by plan to array
      const revenueByPlanArray = Array.from(revenueByPlan.entries())
        .map(([plan, revenue]) => ({ plan, revenue: parseFloat(revenue.toFixed(2)) }));

      return {
        totalRevenue: parseFloat(totalRevenue.toFixed(2)),
        totalRevenueINR: parseFloat(totalRevenueINR.toFixed(2)),
        totalRevenueUSD: parseFloat(totalRevenueUSD.toFixed(2)),
        paymentCount,
        averageTransactionValue: paymentCount > 0 ? parseFloat((totalRevenue / paymentCount).toFixed(2)) : 0,
        dailyRevenue: dailyRevenueArray,
        revenueByPlan: revenueByPlanArray,
        timeRange
      };
    } catch (error) {
      console.error('Error getting revenue analytics:', error);
      throw error;
    }
  }

  /**
   * Get subscription analytics
   */
  async getSubscriptionAnalytics() {
    try {
      const subscriptions = await this.loadSubscriptions();

      const stats = {
        total: 0,
        active: 0,
        trial: 0,
        expired: 0,
        cancelled: 0,
        byPlan: new Map(),
        avgSubscriptionDuration: 0,
        trialConversionRate: 0
      };

      let totalDuration = 0;
      let durationCount = 0;
      let totalTrials = 0;
      let convertedTrials = 0;

      Object.values(subscriptions).forEach(subscription => {
        stats.total++;

        // Count by status
        const status = subscription.status || 'unknown';
        stats[status] = (stats[status] || 0) + 1;

        // Count by plan
        const planId = subscription.planId || 'unknown';
        stats.byPlan.set(planId, (stats.byPlan.get(planId) || 0) + 1);

        // Calculate subscription duration for active subscriptions
        if (subscription.subscriptionStartDate && subscription.status === 'active') {
          const start = new Date(subscription.subscriptionStartDate);
          const end = subscription.subscriptionEndDate ? new Date(subscription.subscriptionEndDate) : new Date();
          const duration = (end - start) / (1000 * 60 * 60 * 24); // days
          totalDuration += duration;
          durationCount++;
        }

        // Trial conversion rate
        if (subscription.trialStartDate) {
          totalTrials++;
          if (subscription.status === 'active' && subscription.paymentHistory && subscription.paymentHistory.length > 0) {
            convertedTrials++;
          }
        }
      });

      stats.avgSubscriptionDuration = durationCount > 0 ? Math.round(totalDuration / durationCount) : 0;
      stats.trialConversionRate = totalTrials > 0 ? parseFloat(((convertedTrials / totalTrials) * 100).toFixed(2)) : 0;

      // Convert byPlan Map to array
      stats.byPlan = Array.from(stats.byPlan.entries()).map(([plan, count]) => ({ plan, count }));

      return stats;
    } catch (error) {
      console.error('Error getting subscription analytics:', error);
      throw error;
    }
  }

  /**
   * Get payment analytics
   */
  async getPaymentAnalytics() {
    try {
      const subscriptions = await this.loadSubscriptions();

      const stats = {
        totalPayments: 0,
        successfulPayments: 0,
        failedPayments: 0,
        pendingPayments: 0,
        totalProcessed: 0,
        successRate: 0,
        paymentMethods: new Map()
      };

      Object.values(subscriptions).forEach(subscription => {
        if (!subscription.paymentHistory) return;

        subscription.paymentHistory.forEach(payment => {
          stats.totalPayments++;

          const status = payment.status || 'unknown';
          if (status === 'success') {
            stats.successfulPayments++;
            stats.totalProcessed += payment.amount || 0;
          } else if (status === 'failed') {
            stats.failedPayments++;
          } else if (status === 'pending') {
            stats.pendingPayments++;
          }

          // Payment method (from Razorpay or similar)
          const method = payment.method || 'razorpay';
          stats.paymentMethods.set(method, (stats.paymentMethods.get(method) || 0) + 1);
        });
      });

      stats.successRate = stats.totalPayments > 0
        ? parseFloat(((stats.successfulPayments / stats.totalPayments) * 100).toFixed(2))
        : 0;

      stats.paymentMethods = Array.from(stats.paymentMethods.entries())
        .map(([method, count]) => ({ method, count }));

      return stats;
    } catch (error) {
      console.error('Error getting payment analytics:', error);
      throw error;
    }
  }

  /**
   * Get dashboard overview statistics
   */
  async getDashboardStats() {
    try {
      const [revenue, subscriptionStats, paymentStats] = await Promise.all([
        this.getRevenueAnalytics('30days'),
        this.getSubscriptionAnalytics(),
        this.getPaymentAnalytics()
      ]);

      const subscriptions = await this.loadSubscriptions();
      const now = new Date();
      const today = now.toISOString().split('T')[0];

      // Today's revenue
      const todayRevenue = revenue.dailyRevenue.find(r => r.date === today)?.revenue || 0;

      // Active MRR calculation (simplified)
      let mrr = 0;
      Object.values(subscriptions).forEach(sub => {
        if (sub.status === 'active' && sub.planId) {
          // This is a simplified calculation - you'd want actual plan pricing
          if (sub.planId.includes('monthly')) {
            mrr += sub.amount || 0;
          } else if (sub.planId.includes('yearly')) {
            mrr += (sub.amount || 0) / 12;
          }
        }
      });

      return {
        totalRevenue: revenue.totalRevenue,
        todayRevenue,
        mrr: parseFloat(mrr.toFixed(2)),
        totalSubscriptions: subscriptionStats.total,
        activeSubscriptions: subscriptionStats.active,
        trialSubscriptions: subscriptionStats.trial,
        successfulPayments: paymentStats.successfulPayments,
        paymentSuccessRate: paymentStats.successRate,
        trialConversionRate: subscriptionStats.trialConversionRate,
        revenueGrowth: this.calculateGrowth(revenue.dailyRevenue)
      };
    } catch (error) {
      console.error('Error getting dashboard stats:', error);
      throw error;
    }
  }

  /**
   * Calculate growth percentage from daily revenue
   */
  calculateGrowth(dailyRevenue) {
    if (dailyRevenue.length < 2) return 0;

    const midpoint = Math.floor(dailyRevenue.length / 2);
    const firstHalf = dailyRevenue.slice(0, midpoint);
    const secondHalf = dailyRevenue.slice(midpoint);

    const firstHalfTotal = firstHalf.reduce((sum, r) => sum + r.revenue, 0);
    const secondHalfTotal = secondHalf.reduce((sum, r) => sum + r.revenue, 0);

    if (firstHalfTotal === 0) return 0;

    return parseFloat((((secondHalfTotal - firstHalfTotal) / firstHalfTotal) * 100).toFixed(2));
  }
}

export default new AdminAnalyticsService();
