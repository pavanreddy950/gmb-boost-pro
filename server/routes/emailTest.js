import express from 'express';
import dynamicDailyActivityScheduler from '../services/dynamicDailyActivityScheduler.js';
import newDailyActivityEmailService from '../services/newDailyActivityEmailService.js';

const router = express.Router();

/**
 * Test endpoint: Trigger daily email batch manually
 * GET /api/email-test/send-batch
 */
router.get('/send-batch', async (req, res) => {
  try {
    console.log('[EmailTest] 🧪 Manually triggering daily email batch...');

    const results = await dynamicDailyActivityScheduler.sendAllDailyReports();

    return res.json({
      success: true,
      message: 'Email batch triggered',
      results: results
    });
  } catch (error) {
    console.error('[EmailTest] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Test endpoint: Send a test email to a specific address
 * POST /api/email-test/send-test
 * Body: { email: "test@example.com", name: "Test User" }
 */
router.post('/send-test', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log(`[EmailTest] 🧪 Sending test daily report to ${email}...`);

    // Prepare test data
    const userData = {
      userName: name || 'Test User',
      userEmail: email,
      isTrialUser: true,
      trialDaysRemaining: 10,
      isTrialExpired: false
    };

    const activityData = {
      postsCreated: [
        { locationName: 'Test Location 1', title: 'Test Post 1', summary: 'This is a test post', createdAt: new Date().toISOString() },
        { locationName: 'Test Location 2', title: 'Test Post 2', summary: 'Another test post', createdAt: new Date().toISOString() }
      ],
      reviewsReplied: [
        { locationName: 'Test Location 1', reviewer: 'John Doe', starRating: 5, comment: 'Great service!', reply: 'Thank you!', createdAt: new Date().toISOString() }
      ],
      locations: [
        { id: '1', name: 'Test Location 1' },
        { id: '2', name: 'Test Location 2' }
      ]
    };

    const auditData = {
      googleSearchRank: 3,
      profileCompletion: 85,
      seoScore: 92,
      reviewReplyScore: 100,
      totalLocations: 2
    };

    const result = await newDailyActivityEmailService.sendDailyReport(
      email,
      userData,
      activityData,
      auditData
    );

    if (result.success) {
      return res.json({
        success: true,
        message: 'Test email sent successfully',
        messageId: result.messageId
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error,
        details: result.details
      });
    }
  } catch (error) {
    console.error('[EmailTest] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
      stack: error.stack
    });
  }
});

/**
 * Test endpoint: Check email service status
 * GET /api/email-test/status
 */
router.get('/status', async (req, res) => {
  try {
    const sendgridApiKey = process.env.SENDGRID_API_KEY;
    const isDisabled = newDailyActivityEmailService.disabled;

    return res.json({
      success: true,
      status: {
        sendgridConfigured: !!sendgridApiKey,
        sendgridKeyPreview: sendgridApiKey ? sendgridApiKey.substring(0, 10) + '...' : 'NOT SET',
        serviceDisabled: isDisabled,
        fromEmail: newDailyActivityEmailService.fromEmail,
        fromName: newDailyActivityEmailService.fromName
      }
    });
  } catch (error) {
    console.error('[EmailTest] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
