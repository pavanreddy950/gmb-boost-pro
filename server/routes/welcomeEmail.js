import express from 'express';
import dailyActivityEmailService from '../services/dailyActivityEmailService.js';

const router = express.Router();

/**
 * Send welcome email to new user
 * POST /api/welcome-email
 */
router.post('/', async (req, res) => {
  try {
    const { email, name } = req.body;

    if (!email) {
      return res.status(400).json({
        success: false,
        error: 'Email is required'
      });
    }

    console.log(`[WelcomeEmail] Sending welcome email to ${email}`);

    const result = await dailyActivityEmailService.sendWelcomeEmail(email, name || email.split('@')[0]);

    if (result.success) {
      return res.json({
        success: true,
        message: 'Welcome email sent successfully',
        messageId: result.messageId
      });
    } else {
      return res.status(500).json({
        success: false,
        error: result.error || 'Failed to send welcome email'
      });
    }
  } catch (error) {
    console.error('[WelcomeEmail] Error:', error);
    return res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

export default router;
