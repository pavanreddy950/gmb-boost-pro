import gmailService from './gmailService.js';

class TrialEmailService {
  constructor() {
    // Use Gmail SMTP instead of SendGrid
    this.gmailService = gmailService;
    this.disabled = gmailService.disabled;

    this.fromEmail = process.env.GMAIL_USER || 'hello.lobaiseo@gmail.com';
    this.fromName = 'LOBAISEO Support';
    this.websiteUrl = 'https://www.lobaiseo.com';
    this.appUrl = 'https://app.lobaiseo.com';

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
    const isExpired = emailType === 'expired';
    const isLastDay = daysRemaining === 1;
    const isUrgent = daysRemaining <= 3;

    let subject, heading, subheading, ctaText, accentColor, badgeText, messageLine1, messageLine2;

    if (isExpired) {
      subject = 'Your LOBAISEO Free Trial Has Ended — Upgrade to Continue';
      heading = 'Your Free Trial Has Expired';
      subheading = `Your 7-day trial ended on ${trialEndDate}`;
      messageLine1 = `Hi ${userName || 'there'}, your LOBAISEO free trial has come to an end.`;
      messageLine2 = `All your Google Business Profile automation — AI review replies, scheduled posts, and insights — has been paused. Upgrade now to instantly restore access and keep your business profile growing.`;
      ctaText = 'Upgrade Now to Restore Access';
      accentColor = '#DC2626';
      badgeText = 'TRIAL EXPIRED';
    } else if (isLastDay) {
      subject = '⚠️ Last Day of Your LOBAISEO Trial — Act Now!';
      heading = 'Your Trial Ends Today!';
      subheading = 'Less than 24 hours remaining';
      messageLine1 = `Hi ${userName || 'there'}, this is your final reminder — your LOBAISEO trial expires today.`;
      messageLine2 = `Upgrade before midnight to keep your Google Business Profile automation running without interruption.`;
      ctaText = 'Upgrade Before It Expires';
      accentColor = '#DC2626';
      badgeText = 'LAST DAY';
    } else if (isUrgent) {
      subject = `Only ${daysRemaining} Days Left on Your LOBAISEO Trial`;
      heading = `${daysRemaining} Days Left in Your Trial`;
      subheading = `Trial ends on ${trialEndDate}`;
      messageLine1 = `Hi ${userName || 'there'}, your LOBAISEO trial is almost over.`;
      messageLine2 = `Upgrade now to keep AI-powered review replies, auto-posting, and multi-location management running for your business.`;
      ctaText = 'Upgrade Now';
      accentColor = '#EA580C';
      badgeText = `${daysRemaining} DAYS LEFT`;
    } else {
      subject = `${daysRemaining} Days Remaining on Your LOBAISEO Trial`;
      heading = `${daysRemaining} Days Left to Explore`;
      subheading = `Trial ends on ${trialEndDate}`;
      messageLine1 = `Hi ${userName || 'there'}, you have ${daysRemaining} days left in your LOBAISEO free trial.`;
      messageLine2 = `Make the most of it — and when you're ready, upgrade to unlock unlimited Google Business Profile automation.`;
      ctaText = 'View Upgrade Options';
      accentColor = '#4F46E5';
      badgeText = `${daysRemaining} DAYS LEFT`;
    }

    const expiredBanner = isExpired ? `
    <!-- Expired Alert Banner -->
    <div style="background: linear-gradient(135deg, #FEF2F2 0%, #FEE2E2 100%); border: 2px solid #FECACA; border-radius: 12px; padding: 24px; margin: 0 0 32px 0; text-align: center;">
      <div style="font-size: 48px; margin-bottom: 12px;">🔒</div>
      <p style="margin: 0; color: #991B1B; font-size: 18px; font-weight: 700;">Your account is paused</p>
      <p style="margin: 8px 0 0 0; color: #B91C1C; font-size: 14px;">Upgrade to instantly restore all features</p>
    </div>` : '';

    return {
      subject,
      html: `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
</head>
<body style="margin:0;padding:0;background-color:#F3F4F6;font-family:'Segoe UI',Tahoma,Geneva,Verdana,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color:#F3F4F6;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background-color:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,0.08);">

          <!-- Header -->
          <tr>
            <td style="background:linear-gradient(135deg,#1E2DCD 0%,#4F46E5 50%,#7C3AED 100%);padding:40px 40px 32px;text-align:center;">
              <p style="margin:0;color:#ffffff;font-size:28px;font-weight:800;letter-spacing:-0.5px;">LOBAISEO</p>
              <p style="margin:8px 0 20px;color:rgba(255,255,255,0.85);font-size:13px;letter-spacing:1px;text-transform:uppercase;">Google Business Profile Automation</p>
              <!-- Status Badge -->
              <div style="display:inline-block;background-color:${accentColor};color:#ffffff;padding:8px 22px;border-radius:24px;font-size:12px;font-weight:700;letter-spacing:1.5px;">${badgeText}</div>
            </td>
          </tr>

          <!-- Content -->
          <tr>
            <td style="padding:40px 40px 32px;">

              ${expiredBanner}

              <h1 style="margin:0 0 8px;color:#111827;font-size:26px;font-weight:700;line-height:1.3;">${heading}</h1>
              <p style="margin:0 0 28px;color:#6B7280;font-size:15px;">${subheading}</p>

              <p style="margin:0 0 12px;color:#374151;font-size:16px;line-height:1.7;">${messageLine1}</p>
              <p style="margin:0 0 36px;color:#374151;font-size:16px;line-height:1.7;">${messageLine2}</p>

              <!-- CTA Button -->
              <div style="text-align:center;margin:0 0 40px;">
                <a href="${this.appUrl}/billing"
                   style="display:inline-block;background-color:${accentColor};color:#ffffff;text-decoration:none;padding:18px 48px;border-radius:10px;font-size:16px;font-weight:700;letter-spacing:0.3px;box-shadow:0 4px 14px rgba(0,0,0,0.2);">
                  ${ctaText} →
                </a>
              </div>

              <!-- Divider -->
              <div style="border-top:1px solid #E5E7EB;margin:0 0 32px;"></div>

              <!-- Features Grid -->
              <p style="margin:0 0 20px;color:#111827;font-size:17px;font-weight:700;">What you get with a paid plan:</p>

              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="50%" style="padding:0 8px 16px 0;vertical-align:top;">
                    <div style="background:#F0FDF4;border-radius:10px;padding:16px;">
                      <p style="margin:0 0 6px;font-size:20px;">🤖</p>
                      <p style="margin:0 0 4px;color:#166534;font-size:14px;font-weight:700;">AI Review Replies</p>
                      <p style="margin:0;color:#4B7A58;font-size:13px;line-height:1.5;">Auto-respond to every customer review with personalised AI replies</p>
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 16px 8px;vertical-align:top;">
                    <div style="background:#EFF6FF;border-radius:10px;padding:16px;">
                      <p style="margin:0 0 6px;font-size:20px;">📅</p>
                      <p style="margin:0 0 4px;color:#1E40AF;font-size:14px;font-weight:700;">Scheduled Posts</p>
                      <p style="margin:0;color:#3B63B8;font-size:13px;line-height:1.5;">Auto-publish fresh content to your Google Business Profile daily</p>
                    </div>
                  </td>
                </tr>
                <tr>
                  <td width="50%" style="padding:0 8px 0 0;vertical-align:top;">
                    <div style="background:#FFF7ED;border-radius:10px;padding:16px;">
                      <p style="margin:0 0 6px;font-size:20px;">📍</p>
                      <p style="margin:0 0 4px;color:#9A3412;font-size:14px;font-weight:700;">Multi-Location</p>
                      <p style="margin:0;color:#B45309;font-size:13px;line-height:1.5;">Manage all your business locations from one dashboard</p>
                    </div>
                  </td>
                  <td width="50%" style="padding:0 0 0 8px;vertical-align:top;">
                    <div style="background:#FAF5FF;border-radius:10px;padding:16px;">
                      <p style="margin:0 0 6px;font-size:20px;">📊</p>
                      <p style="margin:0 0 4px;color:#6B21A8;font-size:14px;font-weight:700;">Analytics & Insights</p>
                      <p style="margin:0;color:#7C3AED;font-size:13px;line-height:1.5;">Track your profile performance, ratings, and growth metrics</p>
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Divider -->
              <div style="border-top:1px solid #E5E7EB;margin:32px 0 24px;"></div>

              <p style="margin:0;color:#6B7280;font-size:14px;line-height:1.6;text-align:center;">
                Questions? Just reply to this email — we're happy to help.<br>
                <a href="${this.websiteUrl}" style="color:#4F46E5;text-decoration:none;font-weight:600;">Visit LOBAISEO.com</a>
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#F9FAFB;padding:24px 40px;border-top:1px solid #E5E7EB;">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td align="center">
                    <p style="margin:0 0 12px;font-size:13px;color:#6B7280;">
                      <a href="${this.appUrl}/billing" style="color:#4F46E5;text-decoration:none;margin:0 12px;">Upgrade Now</a>
                      <span style="color:#D1D5DB;">|</span>
                      <a href="${this.websiteUrl}" style="color:#4F46E5;text-decoration:none;margin:0 12px;">Website</a>
                      <span style="color:#D1D5DB;">|</span>
                      <a href="${this.appUrl}/settings" style="color:#4F46E5;text-decoration:none;margin:0 12px;">Account Settings</a>
                    </p>
                    <p style="margin:0 0 8px;font-size:12px;color:#9CA3AF;">© ${new Date().getFullYear()} LOBAISEO. All rights reserved.</p>
                    <p style="margin:0;font-size:12px;color:#9CA3AF;">
                      You received this because you signed up for a LOBAISEO trial.<br>
                      <a href="${this.appUrl}/settings" style="color:#9CA3AF;text-decoration:underline;">Manage preferences</a>
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`,
      text: `${heading}\n\n${subheading}\n\n${messageLine1}\n\n${messageLine2}\n\nUpgrade now: ${this.appUrl}/billing\n\nQuestions? Reply to this email or visit ${this.websiteUrl}\n\n© ${new Date().getFullYear()} LOBAISEO. All rights reserved.`
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
