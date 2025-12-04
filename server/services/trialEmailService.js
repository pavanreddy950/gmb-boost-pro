import gmailService from './gmailService.js';

class TrialEmailService {
  constructor() {
    // Use Gmail SMTP instead of SendGrid
    this.gmailService = gmailService;
    this.disabled = gmailService.disabled;

    this.fromEmail = process.env.GMAIL_USER || 'hello.lobaiseo@gmail.com';
    this.fromName = 'LOBAISEO Support';
    this.websiteUrl = 'https://www.lobaiseo.com';
    this.appUrl = 'https://www.app.lobaiseo.com';

    if (!this.disabled) {
      console.log('[TrialEmailService] ✅ Initialized with Gmail SMTP');
    } else {
      console.warn('[TrialEmailService] ⚠️ Email service disabled - Gmail credentials not set');
    }
  }

  /**
   * Generate HTML email template
   */
  generateEmailTemplate(userName, daysRemaining, trialEndDate, emailType) {
    let subject, heading, message, ctaText, urgencyColor;

    if (emailType === 'expired') {
      subject = '⏰ Your LOBAISEO Trial Has Expired - Upgrade Now!';
      heading = 'Your Trial Has Ended';
      message = `Your free trial expired on ${trialEndDate}. Don't lose access to your Google Business Profile automation! Upgrade now to continue managing your reviews, posts, and insights seamlessly.`;
      ctaText = 'Upgrade Now';
      urgencyColor = '#DC2626'; // Red
    } else if (daysRemaining === 1) {
      subject = '⚠️ Last Day of Your LOBAISEO Trial!';
      heading = 'Your Trial Ends Today!';
      message = `This is your last day to enjoy all premium features! Your trial expires in less than 24 hours. Upgrade now to keep your Google Business Profile automation running smoothly.`;
      ctaText = 'Upgrade Before It\'s Too Late';
      urgencyColor = '#DC2626'; // Red
    } else if (daysRemaining <= 3) {
      subject = `⏰ Only ${daysRemaining} Days Left on Your LOBAISEO Trial`;
      heading = `${daysRemaining} Days Remaining`;
      message = `Your trial ends on ${trialEndDate}. Time is running out! Upgrade now to continue automating your Google Business Profile reviews, posts, and more without interruption.`;
      ctaText = 'Upgrade Now';
      urgencyColor = '#EA580C'; // Orange
    } else {
      subject = `🚀 ${daysRemaining} Days Left in Your LOBAISEO Trial`;
      heading = `${daysRemaining} Days to Go`;
      message = `Your trial ends on ${trialEndDate}. Make the most of your remaining time and upgrade to unlock unlimited automation for your Google Business Profile!`;
      ctaText = 'View Upgrade Options';
      urgencyColor = '#2563EB'; // Blue
    }

    return {
      subject,
      html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1E2DCD 0%, #4F46E5 100%); padding: 40px 30px; text-align: center; }
    .logo { color: #ffffff; font-size: 32px; font-weight: bold; margin: 0; }
    .content { padding: 40px 30px; }
    .urgency-badge { background-color: ${urgencyColor}; color: white; display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
    .heading { color: #111827; font-size: 28px; font-weight: bold; margin: 0 0 20px 0; line-height: 1.3; }
    .message { color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px; }
    .cta-button { display: inline-block; background-color: ${urgencyColor}; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 10px 0; transition: all 0.3s; }
    .cta-button:hover { transform: translateY(-2px); box-shadow: 0 10px 20px rgba(0,0,0,0.2); }
    .features { background-color: #F9FAFB; padding: 30px; border-radius: 8px; margin: 30px 0; }
    .feature-item { display: flex; align-items: start; margin-bottom: 15px; }
    .feature-icon { color: #10B981; font-size: 20px; margin-right: 12px; font-weight: bold; }
    .feature-text { color: #374151; font-size: 14px; line-height: 1.5; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; }
    .footer-links { margin: 20px 0; }
    .footer-link { color: #4F46E5; text-decoration: none; margin: 0 15px; }
    .social-links { margin: 20px 0; }
    .social-link { display: inline-block; margin: 0 10px; color: #6B7280; text-decoration: none; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1 class="logo">LOBAISEO</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Google Business Profile Automation</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="urgency-badge">${emailType === 'expired' ? 'TRIAL EXPIRED' : `${daysRemaining} DAY${daysRemaining > 1 ? 'S' : ''} LEFT`}</div>

      <h2 class="heading">${heading}</h2>

      <p class="message">Hi ${userName || 'there'},</p>

      <p class="message">${message}</p>

      <div style="text-align: center; margin: 40px 0;">
        <a href="${this.appUrl}/billing" class="cta-button">${ctaText}</a>
      </div>

      <!-- Features Reminder -->
      <div class="features">
        <h3 style="color: #111827; font-size: 18px; margin: 0 0 20px 0;">What You'll Keep With Premium:</h3>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Automated Review Replies</strong> - AI-powered responses to all customer reviews</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Scheduled Posts</strong> - Auto-publish engaging content to your profiles</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Multi-Location Management</strong> - Manage all your business profiles in one place</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Analytics & Insights</strong> - Track performance and engagement metrics</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Priority Support</strong> - Get help when you need it most</span>
        </div>
      </div>

      <p class="message" style="font-size: 14px; color: #6B7280;">
        Questions about upgrading? Our team is here to help! Reply to this email or visit our
        <a href="${this.websiteUrl}" style="color: #4F46E5; text-decoration: none;">website</a> for more information.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="${this.appUrl}/billing" class="footer-link">View Pricing</a>
        <a href="${this.websiteUrl}" class="footer-link">Visit Website</a>
        <a href="${this.appUrl}/settings" class="footer-link">Account Settings</a>
      </div>

      <p style="margin: 20px 0; font-size: 13px;">
        © ${new Date().getFullYear()} LOBAISEO. All rights reserved.
      </p>

      <p style="margin: 10px 0; font-size: 12px; color: #9CA3AF;">
        You're receiving this email because you have an active trial with LOBAISEO.<br>
        <a href="${this.appUrl}/settings" style="color: #9CA3AF; text-decoration: underline;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
      `,
      text: `${heading}\n\nHi ${userName || 'there'},\n\n${message}\n\nUpgrade now: ${this.appUrl}/billing\n\nQuestions? Reply to this email or visit ${this.websiteUrl}\n\n© ${new Date().getFullYear()} LOBAISEO. All rights reserved.`
    };
  }

  /**
   * Send trial reminder email
   */
  async sendTrialReminderEmail(userEmail, userName, daysRemaining, trialEndDate, emailType = 'reminder') {
    try {
      console.log(`[TrialEmailService] 📧 Sending ${emailType} email to ${userEmail} (${daysRemaining} days remaining)`);

      const { subject, html, text } = this.generateEmailTemplate(userName, daysRemaining, trialEndDate, emailType);

      // Use Gmail SMTP to send email
      const response = await this.gmailService.sendEmail({
        to: userEmail,
        subject,
        html,
        text
      });

      console.log(`[TrialEmailService] ✅ Email sent successfully to ${userEmail}`);

      return response;
    } catch (error) {
      console.error('[TrialEmailService] ❌ Error sending email:', error);

      if (error.response) {
        console.error('[TrialEmailService] SendGrid error response:', error.response.body);
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.body
      };
    }
  }

  /**
   * Send test email
   */
  async sendTestEmail(userEmail) {
    try {
      console.log(`[TrialEmailService] 📧 Sending test email to ${userEmail}`);

      // Use Gmail SMTP to send test email
      const response = await this.gmailService.sendEmail({
        to: userEmail,
        subject: '✅ LOBAISEO Email System Test',
        text: 'This is a test email from LOBAISEO trial reminder system. If you received this, the email system is working correctly!',
        html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: linear-gradient(135deg, #1E2DCD 0%, #4F46E5 100%); color: white; padding: 30px; text-align: center; border-radius: 8px 8px 0 0; }
    .content { background: #f9f9f9; padding: 30px; border-radius: 0 0 8px 8px; }
    .success-badge { background: #10B981; color: white; padding: 8px 16px; border-radius: 20px; display: inline-block; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="header">
    <h1 style="margin: 0;">LOBAISEO</h1>
    <p style="margin: 10px 0 0 0;">Email System Test</p>
  </div>
  <div class="content">
    <div class="success-badge">✅ Test Successful</div>
    <h2>Email System is Working!</h2>
    <p>This is a test email from LOBAISEO trial reminder system.</p>
    <p>If you received this email, it means:</p>
    <ul>
      <li>✅ Gmail SMTP is configured correctly</li>
      <li>✅ Sender email (${this.fromEmail}) is working</li>
      <li>✅ Email delivery is working properly</li>
    </ul>
    <p><strong>Your trial reminder emails will be sent automatically 24/7!</strong></p>
  </div>
</body>
</html>
        `
      });

      console.log(`[TrialEmailService] ✅ Test email sent successfully to ${userEmail}`);

      return response;
    } catch (error) {
      console.error('[TrialEmailService] ❌ Error sending test email:', error);

      if (error.response) {
        console.error('[TrialEmailService] SendGrid error response:', error.response.body);
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.body
      };
    }
  }
}

export default TrialEmailService;
