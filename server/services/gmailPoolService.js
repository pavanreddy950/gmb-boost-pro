import gmailService from './gmailService.js';

/**
 * Gmail Pool Service
 * Uses the existing working gmailService for sending review request emails
 * with personalized sender names and tracking
 *
 * Features:
 * - Custom sender names (emails appear from "Your Business Name")
 * - Email tracking (open pixel, click redirect)
 * - Beautiful HTML email templates
 */
class GmailPoolService {
  constructor() {
    this.initialized = false;
  }

  async initialize() {
    if (this.initialized) return;
    this.initialized = true;
    console.log('[GmailPool] Using existing Gmail service');
  }

  /**
   * Send email using existing Gmail service with custom sender name
   */
  async sendEmail({ to, subject, html, text, senderName }) {
    console.log('[GmailPool] 📧 sendEmail called');
    console.log('[GmailPool] To:', to);
    console.log('[GmailPool] Subject:', subject);
    console.log('[GmailPool] SenderName:', senderName);
    console.log('[GmailPool] Gmail service disabled?', gmailService.disabled);

    await this.initialize();

    // Use the existing working Gmail service with custom sender name
    console.log('[GmailPool] Calling gmailService.sendEmail with senderName:', senderName);
    const result = await gmailService.sendEmail({
      to,
      subject,
      html,
      text: text || this.stripHtml(html),
      senderName: senderName  // Pass custom sender name to Gmail service
    });

    console.log('[GmailPool] gmailService.sendEmail result:', JSON.stringify(result, null, 2));

    if (result.success) {
      console.log(`[GmailPool] ✅ Email sent as "${senderName}" to ${to}`);
    } else {
      console.log(`[GmailPool] ❌ Email FAILED to ${to}: ${result.error}`);
    }

    return {
      success: result.success,
      messageId: result.messageId,
      sentFrom: gmailService.fromEmail,
      senderName: senderName,
      error: result.error
    };
  }

  /**
   * Send review request email with tracking
   */
  async sendReviewRequest({ customer, businessName, reviewLink, customSenderName, trackingBaseUrl }) {
    const senderName = customSenderName || businessName;
    const subject = `How was your experience at ${businessName}?`;

    // Generate tracking URLs if customer ID is available
    const trackingPixelUrl = customer.id && trackingBaseUrl
      ? `${trackingBaseUrl}/api/v2/review-requests/track/open/${customer.id}`
      : null;

    const trackedReviewLink = customer.id && trackingBaseUrl
      ? `${trackingBaseUrl}/api/v2/review-requests/track/click/${customer.id}`
      : reviewLink;

    const html = this.generateReviewRequestTemplate({
      customerName: customer.name,
      businessName,
      reviewLink: trackedReviewLink,
      trackingPixelUrl
    });

    return await this.sendEmail({
      to: customer.email,
      subject,
      html,
      senderName
    });
  }

  /**
   * Send bulk review requests with rate limiting
   */
  async sendBulkReviewRequests({ customers, businessName, reviewLink, customSenderName, trackingBaseUrl, onProgress }) {
    const results = [];
    let sent = 0;
    let failed = 0;

    for (let i = 0; i < customers.length; i++) {
      const customer = customers[i];

      try {
        const result = await this.sendReviewRequest({
          customer,
          businessName,
          reviewLink,
          customSenderName,
          trackingBaseUrl
        });

        results.push({
          customerId: customer.id,
          email: customer.email,
          success: result.success,
          ...result
        });

        if (result.success) {
          sent++;
        } else {
          failed++;
        }
      } catch (error) {
        results.push({
          customerId: customer.id,
          email: customer.email,
          success: false,
          error: error.message
        });
        failed++;
      }

      // Progress callback
      if (onProgress) {
        onProgress({
          current: i + 1,
          total: customers.length,
          sent,
          failed
        });
      }

      // Rate limiting - 500ms between emails to avoid spam detection
      if (i < customers.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }

    return { total: customers.length, sent, failed, results };
  }

  /**
   * Generate beautiful review request email template
   * Includes tracking pixel at the end of body
   */
  generateReviewRequestTemplate({ customerName, businessName, reviewLink, trackingPixelUrl }) {
    // Tracking pixel - 1x1 transparent image
    const trackingPixel = trackingPixelUrl
      ? `<img src="${trackingPixelUrl}" width="1" height="1" alt="" style="display:none;width:1px;height:1px;border:0;" />`
      : '';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Share Your Experience</title>
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f5f5f5;">
  <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="background-color: #f5f5f5;">
    <tr>
      <td style="padding: 40px 20px;">
        <table role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width: 600px; margin: 0 auto; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">

          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6C21DC 0%, #7B8DEF 50%, #9D4EDD 100%); padding: 50px 40px; text-align: center;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 600; text-shadow: 0 2px 4px rgba(0,0,0,0.2);">
                We'd Love Your Feedback!
              </h1>
              <p style="margin: 15px 0 0 0; color: rgba(255,255,255,0.9); font-size: 16px;">
                Your opinion matters to us
              </p>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding: 50px 40px; text-align: center;">
              <p style="margin: 0 0 20px 0; color: #333333; font-size: 18px; line-height: 1.6;">
                Hi <strong>${customerName || 'Valued Customer'}</strong>!
              </p>

              <p style="margin: 0 0 25px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                Thank you for choosing <strong style="color: #6C21DC;">${businessName}</strong>!
              </p>

              <p style="margin: 0 0 30px 0; color: #555555; font-size: 16px; line-height: 1.6;">
                We hope you had a great experience. Would you mind taking a moment to share your thoughts with us?
              </p>

              <!-- Stars -->
              <div style="font-size: 40px; margin: 25px 0; letter-spacing: 5px;">
                ⭐⭐⭐⭐⭐
              </div>

              <!-- CTA Button -->
              <table role="presentation" cellspacing="0" cellpadding="0" border="0" style="margin: 35px auto;">
                <tr>
                  <td style="border-radius: 50px; background: linear-gradient(135deg, #6C21DC 0%, #7B8DEF 100%); box-shadow: 0 4px 15px rgba(108, 33, 220, 0.4);">
                    <a href="${reviewLink}" target="_blank" style="display: inline-block; padding: 18px 45px; color: #ffffff; text-decoration: none; font-size: 18px; font-weight: 600; letter-spacing: 0.5px;">
                      ✨ Leave a Review ✨
                    </a>
                  </td>
                </tr>
              </table>

              <p style="margin: 30px 0 0 0; color: #888888; font-size: 14px;">
                It only takes a minute and helps us serve you better!
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color: #f8f9fa; padding: 30px 40px; text-align: center; border-top: 1px solid #eeeeee;">
              <p style="margin: 0; color: #888888; font-size: 13px;">
                Thank you for being a valued customer of ${businessName}
              </p>
              <p style="margin: 10px 0 0 0; color: #aaaaaa; font-size: 11px;">
                This email was sent because you recently visited our business.
              </p>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
  ${trackingPixel}
</body>
</html>`;
  }

  /**
   * Strip HTML tags for plain text version
   */
  stripHtml(html) {
    return html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]*>/g, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Get pool status - simplified since using single service
   */
  async getPoolStatus() {
    await this.initialize();

    return {
      totalAccounts: 1,
      accounts: [{
        email: gmailService.fromEmail || 'Not configured',
        isAvailable: !gmailService.disabled,
        status: gmailService.disabled ? 'disabled' : 'active'
      }],
      totalRemaining: gmailService.disabled ? 0 : 500
    };
  }
}

const gmailPoolService = new GmailPoolService();
export default gmailPoolService;
