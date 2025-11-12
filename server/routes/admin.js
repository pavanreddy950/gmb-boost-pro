import express from 'express';
import { verifyAdmin, checkAdminLevel } from '../middleware/adminAuth.js';
import adminUserService from '../services/adminUserService.js';
import adminAnalyticsService from '../services/adminAnalyticsService.js';
import CouponService from '../services/couponService.js';
import auditLogService from '../services/auditLogService.js';

const router = express.Router();
const couponService = new CouponService();

// All admin routes require admin authentication
router.use(verifyAdmin);

// ============= DASHBOARD =============
router.get('/dashboard/stats', async (req, res) => {
  try {
    const stats = await adminAnalyticsService.getDashboardStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting dashboard stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= USERS =============
router.get('/users', async (req, res) => {
  try {
    const { page = 1, limit = 50, search = '', status = 'all' } = req.query;
    const result = await adminUserService.getAllUsers({
      page: parseInt(page),
      limit: parseInt(limit),
      search,
      status
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting users:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/:uid', async (req, res) => {
  try {
    const user = await adminUserService.getUserById(req.params.uid);
    res.json({ success: true, data: user });
  } catch (error) {
    console.error('Error getting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/stats/overview', async (req, res) => {
  try {
    const stats = await adminUserService.getUserStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Update user role (super admin only)
router.put('/users/:uid/role', checkAdminLevel(['super']), async (req, res) => {
  try {
    const { role, adminLevel } = req.body;
    const result = await adminUserService.setUserRole(req.params.uid, role, adminLevel);
    
    // Log the action
    await auditLogService.log({
      action: 'user.role.update',
      adminId: req.admin.uid,
      adminEmail: req.admin.email,
      description: `Updated user ${req.params.uid} role to ${role}${adminLevel ? ` with admin level ${adminLevel}` : ''}`,
      targetType: 'user',
      targetId: req.params.uid,
      metadata: { role, adminLevel },
      ipAddress: req.ip
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error setting user role:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Toggle user status (suspend/activate)
router.put('/users/:uid/status', checkAdminLevel(['super', 'moderator']), async (req, res) => {
  try {
    const { disabled } = req.body;
    const result = await adminUserService.toggleUserStatus(req.params.uid, disabled);
    
    // Log the action
    await auditLogService.log({
      action: disabled ? 'user.suspend' : 'user.activate',
      adminId: req.admin.uid,
      adminEmail: req.admin.email,
      description: `${disabled ? 'Suspended' : 'Activated'} user ${req.params.uid}`,
      targetType: 'user',
      targetId: req.params.uid,
      metadata: { disabled },
      ipAddress: req.ip
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error toggling user status:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Delete user (super admin only)
router.delete('/users/:uid', checkAdminLevel(['super']), async (req, res) => {
  try {
    const result = await adminUserService.deleteUser(req.params.uid);
    
    // Log the action
    await auditLogService.log({
      action: 'user.delete',
      adminId: req.admin.uid,
      adminEmail: req.admin.email,
      description: `Deleted user ${req.params.uid}`,
      targetType: 'user',
      targetId: req.params.uid,
      ipAddress: req.ip
    });
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error deleting user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= ANALYTICS =============
router.get('/analytics/revenue', async (req, res) => {
  try {
    const { timeRange = '30days' } = req.query;
    const analytics = await adminAnalyticsService.getRevenueAnalytics(timeRange);
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error getting revenue analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analytics/subscriptions', async (req, res) => {
  try {
    const analytics = await adminAnalyticsService.getSubscriptionAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error getting subscription analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/analytics/payments', async (req, res) => {
  try {
    const analytics = await adminAnalyticsService.getPaymentAnalytics();
    res.json({ success: true, data: analytics });
  } catch (error) {
    console.error('Error getting payment analytics:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= COUPONS =============
router.get('/coupons', async (req, res) => {
  try {
    const coupons = couponService.getAllCoupons();
    res.json({ success: true, data: coupons });
  } catch (error) {
    console.error('Error getting coupons:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/coupons', checkAdminLevel(['super', 'moderator']), async (req, res) => {
  try {
    // Transform frontend data to backend format
    const couponData = {
      code: req.body.code,
      type: req.body.discountType || req.body.type,
      discount: req.body.discountValue || req.body.discount,
      maxUses: req.body.maxUses,
      validUntil: req.body.expiresAt ? new Date(req.body.expiresAt) : (req.body.validUntil || new Date('2025-12-31')),
      description: req.body.description || '',
      oneTimePerUser: req.body.oneTimePerUser || false,
      singleUse: req.body.singleUse || false, // Auto-disable after first use
      usedBy: []
    };

    const result = couponService.createCoupon(couponData);
    
    if (result.success) {
      // Log the action (with defensive checks)
      try {
        await auditLogService.log({
          action: 'coupon.create',
          adminId: req.admin?.uid || 'unknown',
          adminEmail: req.admin?.email || 'unknown',
          description: `Created coupon ${couponData.code} with ${couponData.discount}${couponData.type === 'percentage' ? '%' : ' fixed'} discount`,
          targetType: 'coupon',
          targetId: couponData.code,
          metadata: { couponData },
          ipAddress: req.ip || 'unknown'
        });
      } catch (auditError) {
        console.error('Error logging audit:', auditError);
        // Don't fail the whole operation if audit logging fails
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error creating coupon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.put('/coupons/:code/deactivate', checkAdminLevel(['super', 'moderator']), async (req, res) => {
  try {
    const result = couponService.deactivateCoupon(req.params.code);
    
    if (result.success) {
      // Log the action (with defensive checks)
      try {
        await auditLogService.log({
          action: 'coupon.deactivate',
          adminId: req.admin?.uid || 'unknown',
          adminEmail: req.admin?.email || 'unknown',
          description: `Deactivated coupon ${req.params.code}`,
          targetType: 'coupon',
          targetId: req.params.code,
          ipAddress: req.ip || 'unknown'
        });
      } catch (auditError) {
        console.error('Error logging audit:', auditError);
        // Don't fail the whole operation if audit logging fails
      }
    }
    
    res.json(result);
  } catch (error) {
    console.error('Error deactivating coupon:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= SUBSCRIPTIONS =============
router.get('/subscriptions', async (req, res) => {
  try {
    // Import supabaseSubscriptionService to fetch from database
    const supabaseSubscriptionService = (await import('../services/supabaseSubscriptionService.js')).default;

    // Fetch all subscriptions from Supabase
    const subscriptions = await supabaseSubscriptionService.getAllSubscriptions();

    res.json({ success: true, data: subscriptions });
  } catch (error) {
    console.error('Error getting subscriptions:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Cancel subscription (super admin or moderator)
router.post('/subscriptions/:gbpAccountId/cancel', checkAdminLevel(['super', 'moderator']), async (req, res) => {
  try {
    const { gbpAccountId } = req.params;
    const supabaseSubscriptionService = (await import('../services/supabaseSubscriptionService.js')).default;

    // Get the subscription
    const subscription = await supabaseSubscriptionService.getSubscriptionByGbpId(gbpAccountId);

    if (!subscription) {
      return res.status(404).json({ success: false, error: 'Subscription not found' });
    }

    // Update subscription status to cancelled
    const updatedSubscription = await supabaseSubscriptionService.updateSubscription(gbpAccountId, {
      status: 'cancelled',
      cancelledAt: new Date().toISOString(),
      cancelledBy: req.admin.email
    });

    // Log the action
    await auditLogService.log({
      action: 'subscription.cancel',
      adminId: req.admin.uid,
      adminEmail: req.admin.email,
      description: `Cancelled subscription for GBP account ${gbpAccountId} (User: ${subscription.email})`,
      targetType: 'subscription',
      targetId: subscription.id,
      metadata: { gbpAccountId, email: subscription.email },
      ipAddress: req.ip
    });

    res.json({ success: true, data: updatedSubscription });
  } catch (error) {
    console.error('Error cancelling subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Create subscription (super admin only)
router.post('/subscriptions/create', checkAdminLevel(['super']), async (req, res) => {
  try {
    const { userId, email, profileCount, durationMonths, planId } = req.body;
    const supabaseSubscriptionService = (await import('../services/supabaseSubscriptionService.js')).default;

    if (!userId || !email || !profileCount || !durationMonths) {
      return res.status(400).json({ success: false, error: 'Missing required fields' });
    }

    // Calculate dates
    const startDate = new Date();
    const endDate = new Date();
    endDate.setMonth(endDate.getMonth() + parseInt(durationMonths));

    // Create subscription ID
    const subscriptionId = `sub_${Date.now()}_admin_${userId.substring(0, 8)}`;
    const gbpAccountId = userId; // Use userId as gbpAccountId

    // Create subscription object
    const subscriptionData = {
      id: subscriptionId,
      userId: userId,
      gbpAccountId: gbpAccountId,
      email: email,
      status: 'active',
      planId: planId || `custom_${profileCount}_profiles`,
      profileCount: parseInt(profileCount),
      subscriptionStartDate: startDate.toISOString(),
      subscriptionEndDate: endDate.toISOString(),
      amount: 0, // Admin created, no payment
      currency: 'INR',
      createdAt: startDate.toISOString(),
      updatedAt: startDate.toISOString(),
      paymentHistory: [],
      createdBy: req.admin.email,
      createdByAdmin: true
    };

    // Save subscription to Supabase
    const result = await supabaseSubscriptionService.saveSubscription(subscriptionData);

    // Log the action
    await auditLogService.log({
      action: 'subscription.create',
      adminId: req.admin.uid,
      adminEmail: req.admin.email,
      description: `Created subscription for ${email} with ${profileCount} profiles for ${durationMonths} months`,
      targetType: 'subscription',
      targetId: subscriptionId,
      metadata: { userId, email, profileCount, durationMonths, planId },
      ipAddress: req.ip
    });

    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating subscription:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= PAYMENTS =============
router.get('/payments', async (req, res) => {
  try {
    const subscriptionsData = await adminAnalyticsService.loadSubscriptions();
    const allPayments = [];

    Object.values(subscriptionsData).forEach(sub => {
      if (sub.paymentHistory && Array.isArray(sub.paymentHistory)) {
        sub.paymentHistory.forEach(payment => {
          allPayments.push({
            ...payment,
            userEmail: sub.email,
            userId: sub.userId,
            gbpAccountId: sub.gbpAccountId,
            planId: sub.planId
          });
        });
      }
    });

    // Sort by date (most recent first)
    allPayments.sort((a, b) => {
      const dateA = new Date(a.paidAt || a.createdAt);
      const dateB = new Date(b.paidAt || b.createdAt);
      return dateB - dateA;
    });

    res.json({ success: true, data: allPayments });
  } catch (error) {
    console.error('Error getting payments:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= USER BUSINESS AUDITS =============
router.get('/users/:uid/business-audits', checkAdminLevel(['super', 'moderator', 'viewer']), async (req, res) => {
  try {
    const { uid } = req.params;
    const supabaseTokenStorage = (await import('../services/supabaseTokenStorage.js')).default;

    // Get user's token to make API calls on their behalf
    const validToken = await supabaseTokenStorage.getValidToken(uid);
    
    if (!validToken) {
      return res.status(404).json({ 
        success: false, 
        error: 'User has not connected their Google Business Profile' 
      });
    }

    // Fetch accounts and locations from Google API
    const accountsResponse = await fetch(
      'https://mybusinessaccountmanagement.googleapis.com/v1/accounts',
      {
        headers: {
          'Authorization': `Bearer ${validToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (!accountsResponse.ok) {
      throw new Error('Failed to fetch Google Business accounts');
    }

    const accountsData = await accountsResponse.json();
    const accounts = accountsData.accounts || [];
    
    const locations = [];
    
    // Fetch locations for each account
    for (const account of accounts) {
      try {
        const locationsResponse = await fetch(
          `https://mybusinessbusinessinformation.googleapis.com/v1/${account.name}/locations`,
          {
            headers: {
              'Authorization': `Bearer ${validToken}`,
              'Content-Type': 'application/json'
            }
          }
        );

        if (locationsResponse.ok) {
          const locationsData = await locationsResponse.json();
          if (locationsData.locations) {
            locations.push(...locationsData.locations);
          }
        }
      } catch (locError) {
        console.error(`Error fetching locations for account ${account.name}:`, locError);
      }
    }

    res.json({ 
      success: true, 
      data: { 
        locations,
        hasToken: true
      } 
    });
  } catch (error) {
    console.error('Error fetching user business audits:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/users/:uid/locations/:locationId/audit', checkAdminLevel(['super', 'moderator', 'viewer']), async (req, res) => {
  try {
    const { uid, locationId } = req.params;
    const supabaseTokenStorage = (await import('../services/supabaseTokenStorage.js')).default;

    // Get user's token
    const validToken = await supabaseTokenStorage.getValidToken(uid);
    
    if (!validToken) {
      return res.status(404).json({ 
        success: false, 
        error: 'User has not connected their Google Business Profile' 
      });
    }

    // Prepare date range for the last 30 days
    const endDate = new Date().toISOString().split('T')[0];
    const startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

    // Fetch performance data from Google API
    const metrics = [
      'BUSINESS_IMPRESSIONS_DESKTOP_MAPS',
      'BUSINESS_IMPRESSIONS_DESKTOP_SEARCH',
      'BUSINESS_IMPRESSIONS_MOBILE_MAPS',
      'BUSINESS_IMPRESSIONS_MOBILE_SEARCH',
      'BUSINESS_CONVERSATIONS',
      'BUSINESS_DIRECTION_REQUESTS',
      'CALL_CLICKS',
      'WEBSITE_CLICKS'
    ];

    let performanceData = null;
    try {
      const performanceResponse = await fetch(
        `https://businessprofileperformance.googleapis.com/v1/${locationId}:getDailyMetricsTimeSeries?dailyMetric=${metrics.join('&dailyMetric=')}&dailyRange.start_date.year=${startDate.split('-')[0]}&dailyRange.start_date.month=${parseInt(startDate.split('-')[1])}&dailyRange.start_date.day=${parseInt(startDate.split('-')[2])}&dailyRange.end_date.year=${endDate.split('-')[0]}&dailyRange.end_date.month=${parseInt(endDate.split('-')[1])}&dailyRange.end_date.day=${parseInt(endDate.split('-')[2])}`,
        {
          headers: {
            'Authorization': `Bearer ${validToken}`,
            'Content-Type': 'application/json'
          }
        }
      );

      if (performanceResponse.ok) {
        performanceData = await performanceResponse.json();
      }
    } catch (perfError) {
      console.error('Error fetching performance data:', perfError);
    }

    // Generate basic recommendations based on performance
    const recommendations = [];
    
    if (performanceData && performanceData.timeSeriesData) {
      const totals = {};
      performanceData.timeSeriesData.forEach(series => {
        const metricName = series.dailyMetric;
        let total = 0;
        if (series.timeSeries && series.timeSeries.datedValues) {
          total = series.timeSeries.datedValues.reduce((sum, dv) => sum + (dv.value || 0), 0);
        }
        totals[metricName] = total;
      });

      // Check for low engagement
      if (totals.CALL_CLICKS < 10) {
        recommendations.push({
          id: 'increase-calls',
          title: 'Low Call Engagement',
          description: 'Your profile is receiving few phone calls. Make sure your phone number is prominently displayed.',
          priority: 'high',
          category: 'engagement',
          impact: 'Adding a clear call-to-action could increase calls by 30-50%',
          actions: [
            'Verify your phone number is correct',
            'Add call extensions to your profile',
            'Respond quickly to missed calls'
          ]
        });
      }

      if (totals.WEBSITE_CLICKS < 20) {
        recommendations.push({
          id: 'increase-website-traffic',
          title: 'Low Website Clicks',
          description: 'Few people are clicking through to your website from your business profile.',
          priority: 'medium',
          category: 'traffic',
          impact: 'Optimizing your website link could increase clicks by 25%',
          actions: [
            'Ensure website URL is correct and working',
            'Add compelling business description',
            'Keep your profile information up to date'
          ]
        });
      }

      const totalImpressions = (totals.BUSINESS_IMPRESSIONS_DESKTOP_MAPS || 0) + 
                                (totals.BUSINESS_IMPRESSIONS_DESKTOP_SEARCH || 0) +
                                (totals.BUSINESS_IMPRESSIONS_MOBILE_MAPS || 0) +
                                (totals.BUSINESS_IMPRESSIONS_MOBILE_SEARCH || 0);

      if (totalImpressions < 500) {
        recommendations.push({
          id: 'increase-visibility',
          title: 'Low Profile Visibility',
          description: 'Your business profile has low impressions. This affects how many potential customers see you.',
          priority: 'high',
          category: 'visibility',
          impact: 'Improving your profile could increase impressions by 50-100%',
          actions: [
            'Complete all profile sections',
            'Add high-quality photos',
            'Encourage customer reviews',
            'Post regular updates'
          ]
        });
      }
    }

    res.json({ 
      success: true, 
      data: {
        performance: performanceData,
        recommendations: { recommendations },
        dateRange: { startDate, endDate }
      }
    });
  } catch (error) {
    console.error('Error fetching location audit:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= AUDIT LOGS =============
router.get('/audit-logs', async (req, res) => {
  try {
    const { limit, offset, action, targetType, startDate, endDate } = req.query;
    const result = await auditLogService.getLogs({
      limit,
      offset,
      action,
      targetType,
      startDate,
      endDate
    });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting audit logs:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-logs/stats', async (req, res) => {
  try {
    const stats = await auditLogService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting audit log stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.post('/audit-logs', async (req, res) => {
  try {
    const logEntry = {
      ...req.body,
      adminId: req.admin.uid,
      adminEmail: req.admin.email,
      ipAddress: req.ip
    };
    const result = await auditLogService.log(logEntry);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error creating audit log:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// ============= USER AUDIT RESULTS =============
router.get('/audit-results', async (req, res) => {
  try {
    const auditResultsService = (await import('../services/auditResultsService.js')).default;
    const result = await auditResultsService.getAuditResults(req.query);
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting audit results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-results/stats', async (req, res) => {
  try {
    const auditResultsService = (await import('../services/auditResultsService.js')).default;
    const stats = await auditResultsService.getStats();
    res.json({ success: true, data: stats });
  } catch (error) {
    console.error('Error getting audit stats:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-results/by-user', async (req, res) => {
  try {
    const auditResultsService = (await import('../services/auditResultsService.js')).default;
    const grouped = await auditResultsService.getAllAuditsByUser();
    res.json({ success: true, data: grouped });
  } catch (error) {
    console.error('Error getting audits by user:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/audit-results/user/:userId', async (req, res) => {
  try {
    const auditResultsService = (await import('../services/auditResultsService.js')).default;
    const result = await auditResultsService.getAuditResults({ userId: req.params.userId });
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('Error getting user audit results:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

export default router;
