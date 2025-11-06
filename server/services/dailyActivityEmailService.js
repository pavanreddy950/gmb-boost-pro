import sgMail from '@sendgrid/mail';
import { format } from 'date-fns';

class DailyActivityEmailService {
  constructor() {
    // Initialize SendGrid with API key from environment variable
    const apiKey = process.env.SENDGRID_API_KEY;
    if (!apiKey) {
      console.warn('[DailyActivityEmailService] ⚠️ SENDGRID_API_KEY not set - email notifications disabled');
      this.disabled = true;
      return;
    }
    sgMail.setApiKey(apiKey);
    this.disabled = false;

    this.fromEmail = 'support@lobaiseo.com';
    this.fromName = 'LOBAISEO Daily Report';
    this.websiteUrl = 'https://www.lobaiseo.com';
    this.appUrl = 'https://www.app.lobaiseo.com';

    console.log('[DailyActivityEmailService] ✅ Initialized with SendGrid');
  }

  /**
   * Generate HTML email template for daily activity report
   */
  generateDailyReportEmail(userData, activityData, auditData) {
    const { userName, userEmail, isTrialUser, trialDaysRemaining } = userData;
    const { postsCreated, reviewsReplied, locations } = activityData;
    const today = format(new Date(), 'MMMM dd, yyyy');

    const hasActivity = postsCreated.length > 0 || reviewsReplied.length > 0;

    let subject = `📊 Your Daily Report - ${today}`;
    if (hasActivity) {
      subject = `✅ Daily Activity Report - ${postsCreated.length} Posts & ${reviewsReplied.length} Reviews`;
    }

    const trialBanner = isTrialUser ? `
      <div style="background: linear-gradient(135deg, #FCD34D 0%, #FBBF24 100%); padding: 15px 20px; margin-bottom: 20px; border-radius: 8px; text-align: center;">
        <p style="margin: 0; color: #78350F; font-weight: 600;">
          ⏰ Trial Mode: ${trialDaysRemaining} day${trialDaysRemaining > 1 ? 's' : ''} remaining
          <a href="${this.appUrl}/billing" style="color: #78350F; text-decoration: underline; margin-left: 10px;">Upgrade Now</a>
        </p>
      </div>
    ` : '';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1E2DCD 0%, #4F46E5 100%); padding: 40px 30px; text-align: center; color: white; }
    .logo { color: #ffffff; font-size: 32px; font-weight: bold; margin: 0; }
    .date { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 14px; }
    .content { padding: 30px; }
    .greeting { color: #111827; font-size: 20px; margin-bottom: 20px; }
    .summary-cards { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 20px 0; }
    .summary-card { background: #F9FAFB; border-radius: 8px; padding: 20px; text-align: center; }
    .summary-number { font-size: 36px; font-weight: bold; color: #4F46E5; margin: 0; }
    .summary-label { color: #6B7280; font-size: 14px; margin: 5px 0 0 0; }
    .section { margin: 30px 0; }
    .section-title { color: #111827; font-size: 18px; font-weight: 600; margin-bottom: 15px; padding-bottom: 10px; border-bottom: 2px solid #E5E7EB; }
    .activity-item { background: #F9FAFB; padding: 15px; border-radius: 6px; margin-bottom: 10px; }
    .activity-title { color: #111827; font-weight: 600; margin: 0 0 5px 0; font-size: 14px; }
    .activity-detail { color: #6B7280; font-size: 13px; margin: 3px 0; }
    .location-badge { background: #DBEAFE; color: #1E40AF; padding: 4px 10px; border-radius: 12px; font-size: 12px; display: inline-block; margin-top: 5px; }
    .no-activity { text-align: center; padding: 40px 20px; color: #6B7280; }
    .no-activity-icon { font-size: 48px; margin-bottom: 15px; }
    .cta-button { display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 12px 30px; border-radius: 8px; font-size: 14px; font-weight: 600; margin: 20px 0; }
    .audit-section { background: linear-gradient(135deg, #F0F9FF 0%, #E0F2FE 100%); padding: 20px; border-radius: 8px; margin: 20px 0; }
    .audit-stat { display: flex; justify-content: space-between; padding: 10px 0; border-bottom: 1px solid #BAE6FD; }
    .audit-label { color: #075985; font-weight: 500; }
    .audit-value { color: #0369A1; font-weight: 600; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; }
    .footer-links { margin: 15px 0; }
    .footer-link { color: #4F46E5; text-decoration: none; margin: 0 15px; }
    .emoji { font-size: 20px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1 class="logo">LOBAISEO</h1>
      <p class="date">Daily Activity Report • ${today}</p>
    </div>

    <!-- Content -->
    <div class="content">
      ${trialBanner}

      <p class="greeting">Hi ${userName || userEmail}! 👋</p>

      <!-- Summary Cards -->
      <div class="summary-cards">
        <div class="summary-card">
          <h2 class="summary-number">${postsCreated.length}</h2>
          <p class="summary-label">Posts Created</p>
        </div>
        <div class="summary-card">
          <h2 class="summary-number">${reviewsReplied.length}</h2>
          <p class="summary-label">Reviews Replied</p>
        </div>
      </div>

      ${hasActivity ? `
        <!-- Posts Created Section -->
        ${postsCreated.length > 0 ? `
        <div class="section">
          <h3 class="section-title"><span class="emoji">📝</span> Posts Created Today</h3>
          ${postsCreated.map(post => `
            <div class="activity-item">
              <p class="activity-title">${post.title || 'New Post'}</p>
              <p class="activity-detail">${post.summary}</p>
              <span class="location-badge">${post.locationName}</span>
              <p class="activity-detail" style="margin-top: 8px;">🕒 ${format(new Date(post.createdAt), 'h:mm a')}</p>
            </div>
          `).join('')}
        </div>
        ` : ''}

        <!-- Reviews Replied Section -->
        ${reviewsReplied.length > 0 ? `
        <div class="section">
          <h3 class="section-title"><span class="emoji">💬</span> Reviews Replied Today</h3>
          ${reviewsReplied.map(review => `
            <div class="activity-item">
              <p class="activity-title">${review.reviewer} • ${'⭐'.repeat(review.starRating || 5)}</p>
              <p class="activity-detail">"${review.comment.substring(0, 100)}${review.comment.length > 100 ? '...' : ''}"</p>
              <p class="activity-detail" style="margin-top: 8px; font-style: italic;">↳ ${review.reply.substring(0, 100)}${review.reply.length > 100 ? '...' : ''}</p>
              <span class="location-badge">${review.locationName}</span>
            </div>
          `).join('')}
        </div>
        ` : ''}
      ` : `
        <div class="no-activity">
          <div class="no-activity-icon">📊</div>
          <p style="font-size: 16px; margin: 0;">No activity recorded today</p>
          <p style="font-size: 14px; margin: 10px 0 0 0;">Your automation is running smoothly in the background!</p>
        </div>
      `}

      <!-- Audit Report Section -->
      ${auditData ? `
      <div class="section">
        <h3 class="section-title"><span class="emoji">📈</span> Quick Insights</h3>
        <div class="audit-section">
          <div class="audit-stat">
            <span class="audit-label">Total Locations</span>
            <span class="audit-value">${auditData.totalLocations || locations.length}</span>
          </div>
          <div class="audit-stat">
            <span class="audit-label">Profile Completeness</span>
            <span class="audit-value">${auditData.avgCompletion || '85'}%</span>
          </div>
          <div class="audit-stat">
            <span class="audit-label">Total Reviews</span>
            <span class="audit-value">${auditData.totalReviews || 0}</span>
          </div>
          <div class="audit-stat" style="border-bottom: none;">
            <span class="audit-label">Avg Rating</span>
            <span class="audit-value">${auditData.avgRating || '4.5'} ⭐</span>
          </div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <a href="${this.appUrl}/audit-tool" class="cta-button">View Full Audit Report</a>
        </div>
      </div>
      ` : ''}

      <!-- Call to Action -->
      <div style="text-align: center; margin: 30px 0; padding: 20px; background: #F9FAFB; border-radius: 8px;">
        <p style="margin: 0 0 15px 0; color: #374151; font-size: 14px;">
          Ready to do more with your Google Business Profiles?
        </p>
        <a href="${this.appUrl}/dashboard" class="cta-button">Go to Dashboard</a>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="${this.appUrl}/dashboard" class="footer-link">Dashboard</a>
        <a href="${this.appUrl}/posts" class="footer-link">Manage Posts</a>
        <a href="${this.appUrl}/reviews" class="footer-link">Manage Reviews</a>
        <a href="${this.appUrl}/settings" class="footer-link">Settings</a>
      </div>

      <p style="margin: 20px 0; font-size: 13px;">
        © ${new Date().getFullYear()} LOBAISEO. All rights reserved.
      </p>

      <p style="margin: 10px 0; font-size: 12px; color: #9CA3AF;">
        You're receiving this daily report because you have an active LOBAISEO account.<br>
        <a href="${this.appUrl}/settings" style="color: #9CA3AF; text-decoration: underline;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
LOBAISEO Daily Activity Report - ${today}

Hi ${userName || userEmail}!

Today's Summary:
- Posts Created: ${postsCreated.length}
- Reviews Replied: ${reviewsReplied.length}

${postsCreated.length > 0 ? `
Posts Created:
${postsCreated.map(post => `- ${post.title || 'New Post'} at ${post.locationName}`).join('\n')}
` : ''}

${reviewsReplied.length > 0 ? `
Reviews Replied:
${reviewsReplied.map(review => `- ${review.reviewer} (${review.starRating}⭐) at ${review.locationName}`).join('\n')}
` : ''}

View your dashboard: ${this.appUrl}/dashboard

© ${new Date().getFullYear()} LOBAISEO. All rights reserved.
    `;

    return { subject, html, text };
  }

  /**
   * Generate welcome email template
   */
  generateWelcomeEmail(userName, userEmail) {
    const subject = '🎉 Welcome to LOBAISEO - Let\'s Get Started!';

    const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 0 auto; background-color: #ffffff; }
    .header { background: linear-gradient(135deg, #1E2DCD 0%, #4F46E5 100%); padding: 50px 30px; text-align: center; color: white; }
    .logo { color: #ffffff; font-size: 36px; font-weight: bold; margin: 0; }
    .welcome-text { color: rgba(255,255,255,0.95); margin: 15px 0 0 0; font-size: 18px; }
    .content { padding: 40px 30px; }
    .greeting { color: #111827; font-size: 24px; font-weight: 600; margin-bottom: 20px; text-align: center; }
    .intro-text { color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px; text-align: center; }
    .steps { margin: 30px 0; }
    .step { display: flex; align-items: start; margin-bottom: 25px; padding: 20px; background: #F9FAFB; border-radius: 8px; }
    .step-number { background: #4F46E5; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; margin-right: 20px; flex-shrink: 0; }
    .step-content { flex: 1; }
    .step-title { color: #111827; font-weight: 600; margin: 0 0 8px 0; font-size: 16px; }
    .step-desc { color: #6B7280; font-size: 14px; margin: 0; line-height: 1.5; }
    .cta-button { display: inline-block; background-color: #4F46E5; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 10px 0; }
    .features-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 15px; margin: 30px 0; }
    .feature-card { background: #F0F9FF; padding: 20px; border-radius: 8px; text-align: center; }
    .feature-icon { font-size: 32px; margin-bottom: 10px; }
    .feature-title { color: #075985; font-weight: 600; font-size: 14px; margin: 0; }
    .trial-banner { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; padding: 20px; border-radius: 8px; text-align: center; margin: 30px 0; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; }
    .footer-links { margin: 15px 0; }
    .footer-link { color: #4F46E5; text-decoration: none; margin: 0 15px; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1 class="logo">LOBAISEO</h1>
      <p class="welcome-text">Welcome Aboard! 🚀</p>
    </div>

    <!-- Content -->
    <div class="content">
      <h2 class="greeting">Hi ${userName || 'there'}! 👋</h2>

      <p class="intro-text">
        Welcome to LOBAISEO! We're excited to help you automate and optimize your Google Business Profile management.
        Let's get you started on the right foot!
      </p>

      <!-- Trial Banner -->
      <div class="trial-banner">
        <h3 style="margin: 0 0 10px 0; font-size: 20px;">🎁 Your Free Trial Has Started!</h3>
        <p style="margin: 0; font-size: 14px; opacity: 0.95;">
          Enjoy full access to all premium features for the next 15 days.
        </p>
      </div>

      <!-- Getting Started Steps -->
      <div class="steps">
        <h3 style="color: #111827; font-size: 20px; margin-bottom: 20px; text-align: center;">
          Get Started in 3 Easy Steps
        </h3>

        <div class="step">
          <div class="step-number">1</div>
          <div class="step-content">
            <h4 class="step-title">Connect Your Google Business Profile</h4>
            <p class="step-desc">Link your Google account to start managing your business profiles in one place.</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">2</div>
          <div class="step-content">
            <h4 class="step-title">Enable Automation Features</h4>
            <p class="step-desc">Set up automated review replies and scheduled posts to save time and engage customers.</p>
          </div>
        </div>

        <div class="step">
          <div class="step-number">3</div>
          <div class="step-content">
            <h4 class="step-title">Monitor Your Performance</h4>
            <p class="step-desc">Track insights, analytics, and get daily reports on your profile performance.</p>
          </div>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="${this.appUrl}/dashboard" class="cta-button">Go to Dashboard</a>
      </div>

      <!-- Features Grid -->
      <h3 style="color: #111827; font-size: 18px; margin: 30px 0 20px 0; text-align: center;">
        What You Can Do With LOBAISEO
      </h3>

      <div class="features-grid">
        <div class="feature-card">
          <div class="feature-icon">🤖</div>
          <p class="feature-title">AI-Powered Review Replies</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📅</div>
          <p class="feature-title">Automated Post Scheduling</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">📊</div>
          <p class="feature-title">Performance Analytics</p>
        </div>
        <div class="feature-card">
          <div class="feature-icon">🎯</div>
          <p class="feature-title">Multi-Location Management</p>
        </div>
      </div>

      <!-- Help Section -->
      <div style="background: #FEF3C7; padding: 20px; border-radius: 8px; margin: 30px 0;">
        <p style="margin: 0; color: #78350F; font-size: 14px; text-align: center;">
          <strong>Need Help?</strong> Our support team is here for you!<br>
          Reply to this email or visit our <a href="${this.websiteUrl}" style="color: #78350F;">help center</a>.
        </p>
      </div>
    </div>

    <!-- Footer -->
    <div class="footer">
      <div class="footer-links">
        <a href="${this.appUrl}/dashboard" class="footer-link">Dashboard</a>
        <a href="${this.websiteUrl}" class="footer-link">Help Center</a>
        <a href="${this.appUrl}/settings" class="footer-link">Settings</a>
      </div>

      <p style="margin: 20px 0; font-size: 13px;">
        © ${new Date().getFullYear()} LOBAISEO. All rights reserved.
      </p>

      <p style="margin: 10px 0; font-size: 12px; color: #9CA3AF;">
        You're receiving this email because you just signed up for LOBAISEO.
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
Welcome to LOBAISEO! 🎉

Hi ${userName || 'there'}!

Welcome to LOBAISEO! We're excited to help you automate and optimize your Google Business Profile management.

Your Free Trial Has Started!
Enjoy full access to all premium features for the next 15 days.

Get Started in 3 Easy Steps:

1. Connect Your Google Business Profile
   Link your Google account to start managing your business profiles in one place.

2. Enable Automation Features
   Set up automated review replies and scheduled posts to save time and engage customers.

3. Monitor Your Performance
   Track insights, analytics, and get daily reports on your profile performance.

Get started now: ${this.appUrl}/dashboard

Need Help? Reply to this email or visit ${this.websiteUrl}

© ${new Date().getFullYear()} LOBAISEO. All rights reserved.
    `;

    return { subject, html, text };
  }

  /**
   * Send daily activity report email
   */
  async sendDailyReport(userEmail, userData, activityData, auditData = null) {
    if (this.disabled) {
      console.log('[DailyActivityEmailService] Email service disabled - skipping');
      return { success: false, error: 'Email service disabled' };
    }

    try {
      console.log(`[DailyActivityEmailService] 📧 Sending daily report to ${userEmail}`);

      const { subject, html, text } = this.generateDailyReportEmail(userData, activityData, auditData);

      const msg = {
        to: userEmail,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text,
        html
      };

      const response = await sgMail.send(msg);

      console.log(`[DailyActivityEmailService] ✅ Daily report sent to ${userEmail}`);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode
      };
    } catch (error) {
      console.error('[DailyActivityEmailService] ❌ Error sending daily report:', error);

      if (error.response) {
        console.error('[DailyActivityEmailService] SendGrid error response:', error.response.body);
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.body
      };
    }
  }

  /**
   * Send welcome email
   */
  async sendWelcomeEmail(userEmail, userName) {
    if (this.disabled) {
      console.log('[DailyActivityEmailService] Email service disabled - skipping');
      return { success: false, error: 'Email service disabled' };
    }

    try {
      console.log(`[DailyActivityEmailService] 📧 Sending welcome email to ${userEmail}`);

      const { subject, html, text } = this.generateWelcomeEmail(userName, userEmail);

      const msg = {
        to: userEmail,
        from: {
          email: this.fromEmail,
          name: this.fromName
        },
        subject,
        text,
        html
      };

      const response = await sgMail.send(msg);

      console.log(`[DailyActivityEmailService] ✅ Welcome email sent to ${userEmail}`);

      return {
        success: true,
        messageId: response[0].headers['x-message-id'],
        statusCode: response[0].statusCode
      };
    } catch (error) {
      console.error('[DailyActivityEmailService] ❌ Error sending welcome email:', error);

      if (error.response) {
        console.error('[DailyActivityEmailService] SendGrid error response:', error.response.body);
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.body
      };
    }
  }
}

export default new DailyActivityEmailService();
