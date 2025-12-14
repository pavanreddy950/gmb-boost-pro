import gmailService from './gmailService.js';
import { format } from 'date-fns';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

class NewDailyActivityEmailService {
  constructor() {
    // Use Gmail SMTP instead of SendGrid
    this.gmailService = gmailService;
    this.disabled = gmailService.disabled;

    this.fromEmail = process.env.GMAIL_USER || 'hello.lobaiseo@gmail.com';
    this.fromName = 'LOBAISEO';
    this.websiteUrl = 'https://www.lobaiseo.com';
    this.appUrl = 'https://www.app.lobaiseo.com';

    if (!this.disabled) {
      console.log('[NewDailyActivityEmailService] ✅ Initialized with Gmail SMTP');
    } else {
      console.warn('[NewDailyActivityEmailService] ⚠️ Email service disabled - Gmail credentials not set');
    }
  }

  /**
   * Generate HTML email template for daily activity report
   */
  generateDailyReportEmail(userData, activityData, auditData) {
    const { userName, userEmail, isTrialUser, trialDaysRemaining, isTrialExpired } = userData;
    const { postsCreated, reviewsReplied, locations } = activityData;
    const today = format(new Date(), 'MMMM dd, yyyy');

    let subject = `📊 Daily Activity Report - ${today}`;

    // IMPORTANT: Trial banner ONLY shows for ACTIVE trial users (NOT subscribed or admin users)
    // isTrialUser is TRUE only if: status === 'trial' AND trial has NOT expired
    // isTrialExpired is TRUE only if: status === 'trial' AND trial HAS expired
    const trialBanner = isTrialUser && !isTrialExpired ? `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 20px;">
        <tr>
          <td style="background: #FFF8E1; padding: 16px 24px; border-radius: 8px;">
            <table width="100%" cellpadding="0" cellspacing="0">
              <tr>
                <td style="text-align: left; vertical-align: middle;">
                  <p style="margin: 0; color: #000000; font-weight: 600; font-size: 16px; line-height: 1.4;">
                    ⚠️ Free Trial: Only ${trialDaysRemaining} Day${trialDaysRemaining !== 1 ? 's' : ''} Left
                  </p>
                </td>
                <td style="text-align: right; vertical-align: middle; white-space: nowrap;">
                  <a href="${this.appUrl}/dashboard/billing" style="background-color: #1E40AF; color: white; padding: 12px 28px; text-decoration: none; border-radius: 6px; font-weight: 700; font-size: 14px; display: inline-block;">Upgrade Now</a>
                </td>
              </tr>
            </table>
          </td>
        </tr>
      </table>
    ` : '';

    const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
  <meta http-equiv="X-UA-Compatible" content="IE=edge">
  <meta name="format-detection" content="telephone=no">
  <title>${subject}</title>
  <style>
    body { margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Helvetica Neue', Arial, sans-serif; background-color: #f3f4f6; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; }
    .container { max-width: 800px; margin: 0 auto; background-color: #ffffff; }
    .banner-container { width: 100%; margin: 0; padding: 0; display: block; }
    .banner-desktop { display: block; width: 100%; height: auto; max-width: 100%; border: 0; outline: 0; }
    .banner-mobile { display: none; width: 100%; height: auto; max-width: 100%; border: 0; outline: 0; }
    .content { padding: 30px; }
    .greeting { color: #111827; font-size: 18px; margin-bottom: 15px; font-weight: 600; }
    .intro-text { color: #4B5563; font-size: 15px; line-height: 1.6; margin-bottom: 25px; }
    .daily-activity-section { margin: 30px 0; }
    .section-header { font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px; }
    .activity-grid { display: flex; gap: 20px; margin: 20px 0; justify-content: flex-start; }
    .activity-card { background: #F0F7FF; border-radius: 5px; padding: 16px; text-align: center; border: 1px solid #E5E5E5; width: 188px; height: 99px; display: flex; flex-direction: column; align-items: center; justify-content: space-between; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05); box-sizing: border-box; }
    .activity-number { font-size: 48px; font-weight: 800; color: #EF4444; margin: 0; line-height: 1; padding-top: 4px; }
    .activity-number.blue { color: #3B82F6; }
    .activity-label { color: #111827; font-size: 14px; margin: 0; font-weight: 600; padding-bottom: 4px; }
    .audit-section { margin: 30px 0; }
    .audit-section-title { font-size: 24px; font-weight: 700; color: #111827; margin: 0 0 20px 0; }
    .audit-header { background: #F9FAFB; padding: 24px; border-radius: 12px; border: 1px solid #E5E7EB; margin-bottom: 0; }
    .audit-title { font-size: 20px; font-weight: 700; color: #111827; margin: 0 0 5px 0; }
    .audit-subtitle { color: #6B7280; font-size: 13px; margin: 0; line-height: 1.4; }
    .rank-badge { background: linear-gradient(135deg, #10B981 0%, #059669 100%); color: white; display: inline-flex; align-items: center; justify-content: center; width: 60px; height: 60px; border-radius: 50%; font-size: 32px; font-weight: 800; margin-top: 10px; }
    .rank-info { margin-top: 10px; }
    .rank-label { display: flex; align-items: center; gap: 5px; font-size: 13px; margin: 5px 0; }
    .rank-dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
    .rank-dot.good { background: #10B981; }
    .rank-dot.average { background: #F59E0B; }
    .rank-dot.poor { background: #EF4444; }
    .audit-scores { background: white; border: 1px solid #E5E7EB; border-radius: 12px; padding: 24px; margin-top: 12px; }
    .score-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 20px; margin-bottom: 24px; }
    .score-item { text-align: center; padding: 20px; background: #F9FAFB; border-radius: 8px; }
    .score-value { font-size: 40px; font-weight: 800; color: #111827; margin: 0 0 8px 0; line-height: 1; }
    .score-label { color: #6B7280; font-size: 13px; margin: 0; font-weight: 600; }
    .audit-buttons { display: flex; gap: 10px; margin-top: 20px; }
    .audit-button { flex: 1; text-align: center; padding: 12px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 14px; }
    .audit-button-primary { background: #1E40AF; color: white; }
    .audit-button-secondary { background: white; color: #111827; border: 2px solid #E5E7EB; }
    .trial-end-section { background: linear-gradient(135deg, #FEF3C7 0%, #FDE68A 100%); padding: 25px; border-radius: 12px; margin: 30px 0; border: 2px solid #FCD34D; }
    .trial-end-title { font-size: 22px; font-weight: 800; color: #78350F; margin: 0 0 10px 0; }
    .trial-end-text { color: #92400E; font-size: 14px; margin: 0 0 15px 0; line-height: 1.6; }
    .trial-features { margin: 15px 0; }
    .trial-feature { color: #92400E; font-size: 14px; margin: 8px 0; padding-left: 20px; position: relative; }
    .trial-feature::before { content: '•'; position: absolute; left: 5px; font-weight: bold; }
    .upgrade-button { display: inline-block; background: #1E40AF; color: #FFFFFF !important; padding: 14px 40px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 16px; margin-top: 10px; border: none; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 13px; border-top: 1px solid #E5E7EB; }
    .footer-links { margin: 15px 0; }
    .footer-link { color: #1E40AF; text-decoration: none; margin: 0 15px; font-weight: 600; }
    .footer-text { margin: 15px 0; font-size: 12px; }
    /* Classes for mobile responsiveness */
    @media only screen and (max-width: 600px) {
      .container { max-width: 100% !important; padding: 0 !important; width: 100% !important; }
      .content { padding: 20px !important; }
      .banner-desktop { display: none !important; max-height: 0 !important; visibility: hidden !important; }
      .banner-mobile { display: block !important; max-height: none !important; visibility: visible !important; }
      .section-header { font-size: 18px !important; }
      .greeting { font-size: 16px !important; }
      .intro-text { font-size: 14px !important; }
      .trial-end-section { padding: 20px !important; margin: 20px 0 !important; }
      .trial-end-title { font-size: 20px !important; }
      .trial-end-text { font-size: 13px !important; }
      .upgrade-button { display: block !important; width: 100% !important; padding: 16px 20px !important; font-size: 16px !important; box-sizing: border-box; }
      .footer { padding: 20px !important; }
      .footer-links { display: block !important; }
      .footer-link { display: block !important; margin: 10px 0 !important; }
      /* Mobile table stacking */
      .mobile-stack { display: table !important; width: 100% !important; }
      .mobile-stack tr { display: block !important; width: 100% !important; }
      .mobile-stack td { display: block !important; width: 100% !important; max-width: 350px !important; margin: 0 auto 15px !important; padding-left: 0 !important; padding-right: 0 !important; }
      .mobile-stack td[width="4%"] { display: none !important; }
      .mobile-stack td[width="48%"] { max-width: 100% !important; width: 100% !important; padding: 0 !important; }
      .mobile-hide { display: none !important; }
      /* Trial banner adjustments */
      table[width="100%"] td[style*="background: #FFF8E1"] { display: block !important; padding: 15px !important; }
      table[width="100%"] td[style*="background: #FFF8E1"] table { display: block !important; }
      table[width="100%"] td[style*="background: #FFF8E1"] td { display: block !important; width: 100% !important; text-align: center !important; padding: 5px 0 !important; }
      table[width="100%"] td[style*="background: #FFF8E1"] a { display: block !important; margin-top: 10px !important; }
    }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header Banner -->
    <div class="banner-container">
      <img src="cid:banner_desktop" alt="LOBAISEO Daily Activity Report" class="banner-desktop" style="display: block; width: 100%; height: auto;" />
      <img src="cid:banner_mobile" alt="LOBAISEO Daily Activity Report" class="banner-mobile" style="display: none; width: 100%; height: auto;" />
    </div>

    <!-- Content -->
    <div class="content">
      ${trialBanner}

      <p class="greeting">Hi ${userName ? userName.toLowerCase().replace(/\s+/g, '') : userEmail.split('@')[0]},</p>
      <p class="intro-text">LOBAISEO is in action — no manual work needed. Sit back and let LOBAISEO make your Google Business Profile shine on Google search.</p>

      <!-- Daily Activity Section -->
      <div class="daily-activity-section">
        <h3 class="section-header">Daily Activity</h3>
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;" class="mobile-stack">
          <tr class="mobile-stack">
            <td width="188" style="background: #F0F7FF; border-radius: 5px; padding: 16px; text-align: center; border: 1px solid #E5E5E5; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05); vertical-align: middle;">
              <table width="100%" cellpadding="0" cellspacing="0" style="height: 99px;">
                <tr>
                  <td style="text-align: center; vertical-align: top; padding-top: 8px;">
                    <h2 style="font-size: 48px; font-weight: 800; color: #EF4444; margin: 0; line-height: 1;">${postsCreated.length}</h2>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; vertical-align: bottom; padding-bottom: 8px;">
                    <p style="color: #111827; font-size: 14px; margin: 0; font-weight: 600;">Posts Published</p>
                  </td>
                </tr>
              </table>
            </td>
            <td width="20" class="mobile-hide"></td>
            <td width="188" style="background: #F0F7FF; border-radius: 5px; padding: 16px; text-align: center; border: 1px solid #E5E5E5; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05); vertical-align: middle;">
              <table width="100%" cellpadding="0" cellspacing="0" style="height: 99px;">
                <tr>
                  <td style="text-align: center; vertical-align: top; padding-top: 8px;">
                    <h2 style="font-size: 48px; font-weight: 800; color: #EF4444; margin: 0; line-height: 1;">${reviewsReplied.length}</h2>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; vertical-align: bottom; padding-bottom: 8px;">
                    <p style="color: #111827; font-size: 14px; margin: 0; font-weight: 600;">Reviews Responded</p>
                  </td>
                </tr>
              </table>
            </td>
            <td width="20" class="mobile-hide"></td>
            <td width="188" style="background: #F0F7FF; border-radius: 5px; padding: 16px; text-align: center; border: 1px solid #E5E5E5; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05); vertical-align: middle;">
              <table width="100%" cellpadding="0" cellspacing="0" style="height: 99px;">
                <tr>
                  <td style="text-align: center; vertical-align: top; padding-top: 8px;">
                    <h2 style="font-size: 48px; font-weight: 800; color: #3B82F6; margin: 0; line-height: 1;">${locations.length}</h2>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; vertical-align: bottom; padding-bottom: 8px;">
                    <p style="color: #111827; font-size: 14px; margin: 0; font-weight: 600;">Locations</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>
      </div>

      <!-- Audit Report Section -->
      ${auditData ? `
      <div class="audit-section" style="margin: 30px 0;">
        <h3 style="font-size: 20px; font-weight: 700; color: #111827; margin-bottom: 20px;">Audit Report</h3>
        
        <!-- Google Search Rank Box -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 10px;">
          <tr>
            <td style="background: #F0F7FF; border-radius: 5px; padding: 21px 28px; border: 1px solid #E5E5E5; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05);">
              <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                  <td width="48" style="vertical-align: middle; padding-right: 15px;">
                    <img src="https://www.gstatic.com/images/branding/product/1x/googleg_48dp.png" width="48" height="48" alt="Google" style="display: block;" />
                  </td>
                  <td style="vertical-align: middle;">
                    <h3 style="font-size: 18px; font-weight: 700; color: #111827; margin: 0 0 5px 0; line-height: 1.2;">Google Search Rank</h3>
                    <p style="color: #6B7280; font-size: 13px; margin: 0; line-height: 1.4;">Avg. position of your business on Google Search</p>
                  </td>
                  <td width="80" style="text-align: center; vertical-align: middle;">
                    <h2 style="font-size: 48px; font-weight: 800; color: #10B981; margin: 0; line-height: 1;">${auditData.googleSearchRank || 5}</h2>
                    <p style="margin: 5px 0 0 0; color: #10B981; font-size: 13px; font-weight: 700;">Good</p>
                  </td>
                </tr>
                <tr>
                  <td colspan="3" style="padding-top: 15px;">
                    <table width="100%" cellpadding="0" cellspacing="0">
                      <tr>
                        <td style="padding-right: 15px;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10B981; margin-right: 5px; vertical-align: middle;"></span>
                          <span style="color: #6B7280; font-size: 13px; vertical-align: middle;">Good | Less than 5</span>
                        </td>
                        <td style="padding-right: 15px;">
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #F59E0B; margin-right: 5px; vertical-align: middle;"></span>
                          <span style="color: #6B7280; font-size: 13px; vertical-align: middle;">Average | Between 6-10</span>
                        </td>
                        <td>
                          <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #EF4444; margin-right: 5px; vertical-align: middle;"></span>
                          <span style="color: #6B7280; font-size: 13px; vertical-align: middle;">Poor | Beyond 10</span>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Score Boxes -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin: 20px 0;" class="mobile-stack">
          <tr class="mobile-stack">
            <td width="188" style="background: #F0F7FF; border-radius: 5px; padding: 16px; text-align: center; border: 1px solid #E5E5E5; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05); vertical-align: middle;">
              <table width="100%" cellpadding="0" cellspacing="0" style="height: 99px;">
                <tr>
                  <td style="text-align: center; vertical-align: top; padding-top: 8px;">
                    <h2 style="font-size: 48px; font-weight: 800; color: #111827; margin: 0; line-height: 1;">${auditData.profileCompletion || 67}%</h2>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; vertical-align: bottom; padding-bottom: 8px;">
                    <p style="color: #111827; font-size: 14px; margin: 0; font-weight: 600;">Profile Completion</p>
                  </td>
                </tr>
              </table>
            </td>
            <td width="20" class="mobile-hide"></td>
            <td width="188" style="background: #F0F7FF; border-radius: 5px; padding: 16px; text-align: center; border: 1px solid #E5E5E5; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05); vertical-align: middle;">
              <table width="100%" cellpadding="0" cellspacing="0" style="height: 99px;">
                <tr>
                  <td style="text-align: center; vertical-align: top; padding-top: 8px;">
                    <h2 style="font-size: 48px; font-weight: 800; color: #111827; margin: 0; line-height: 1;">${auditData.seoScore || 100}%</h2>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; vertical-align: bottom; padding-bottom: 8px;">
                    <p style="color: #111827; font-size: 14px; margin: 0; font-weight: 600;">SEO Score</p>
                  </td>
                </tr>
              </table>
            </td>
            <td width="20" class="mobile-hide"></td>
            <td width="188" style="background: #F0F7FF; border-radius: 5px; padding: 16px; text-align: center; border: 1px solid #E5E5E5; box-shadow: 0px 14px 24px 0px rgba(0, 0, 0, 0.05); vertical-align: middle;">
              <table width="100%" cellpadding="0" cellspacing="0" style="height: 99px;">
                <tr>
                  <td style="text-align: center; vertical-align: top; padding-top: 8px;">
                    <h2 style="font-size: 48px; font-weight: 800; color: #111827; margin: 0; line-height: 1;">${auditData.reviewReplyScore || 100}%</h2>
                  </td>
                </tr>
                <tr>
                  <td style="text-align: center; vertical-align: bottom; padding-bottom: 8px;">
                    <p style="color: #111827; font-size: 14px; margin: 0; font-weight: 600;">Review Reply Score</p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
        </table>

        <!-- Action Buttons -->
        <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 20px;" class="mobile-stack">
          <tr class="mobile-stack">
            <td width="48%" style="padding-right: 8px; vertical-align: top;">
              <a href="${this.appUrl}/dashboard/audit" style="display: block; background: #1E40AF; color: #FFFFFF; padding: 16px 20px; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; box-sizing: border-box;">View Full Audit Report</a>
            </td>
            <td width="4%"></td>
            <td width="48%" style="padding-left: 8px; vertical-align: top;">
              <a href="${this.appUrl}/dashboard" style="display: block; background: #FFFFFF; color: #111827; padding: 16px 20px; text-align: center; text-decoration: none; border-radius: 8px; font-weight: 700; font-size: 15px; border: 2px solid #E5E5E5; box-sizing: border-box;">Go To Dashboard</a>
            </td>
          </tr>
        </table>
      </div>
      ` : ''}

      <!-- Trial End Section (for active trial users) -->
      ${isTrialUser && !isTrialExpired ? `
      <div class="trial-end-section">
        <h3 class="trial-end-title">Your Free Trial Ends Soon</h3>
        <p class="trial-end-text">You have ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''} before your automation features pause.</p>
        <p class="trial-end-text" style="margin-bottom: 5px; font-weight: 600;">Upgrade Now to keep:</p>
        <div class="trial-features">
          <div class="trial-feature">Auto-posting across Google Business Profiles</div>
          <div class="trial-feature">Smart review replies</div>
          <div class="trial-feature">Daily SEO performance insights</div>
          <div class="trial-feature">Location management tools</div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <a href="${this.appUrl}/dashboard/billing" style="display: inline-block; background: #1E40AF; color: #FFFFFF; padding: 16px 50px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 17px; margin-top: 10px; border: none; box-shadow: 0px 4px 12px rgba(30, 64, 175, 0.3);">Upgrade To Pro →</a>
        </div>
      </div>
      ` : ''}

      <!-- Trial Expired Section (for expired trial users) -->
      ${isTrialExpired ? `
      <div class="trial-end-section" style="background: linear-gradient(135deg, #FEE2E2 0%, #FECACA 100%); border-color: #FCA5A5;">
        <h3 class="trial-end-title" style="color: #991B1B;">⚠️ Your Free Trial Has Ended</h3>
        <p class="trial-end-text" style="color: #991B1B;">Your automation features are currently paused. Upgrade now to continue enjoying seamless Google Business Profile management.</p>
        <p class="trial-end-text" style="color: #991B1B; margin-bottom: 5px; font-weight: 600;">Reactivate these features:</p>
        <div class="trial-features">
          <div class="trial-feature" style="color: #991B1B;">Auto-posting across Google Business Profiles</div>
          <div class="trial-feature" style="color: #991B1B;">Smart review replies</div>
          <div class="trial-feature" style="color: #991B1B;">Daily SEO performance insights</div>
          <div class="trial-feature" style="color: #991B1B;">Location management tools</div>
        </div>
        <div style="text-align: center; margin-top: 20px;">
          <a href="${this.appUrl}/dashboard/billing" style="display: inline-block; background: #991B1B; color: #FFFFFF; padding: 16px 50px; border-radius: 8px; text-decoration: none; font-weight: 700; font-size: 17px; margin-top: 10px; border: none; box-shadow: 0px 4px 12px rgba(153, 27, 27, 0.3);">Please Upgrade →</a>
        </div>
      </div>
      ` : ''}
    </div>

    <!-- Footer -->
    <div class="footer">
      <div style="text-align: center; margin-bottom: 20px;">
        <p style="margin: 0 0 15px 0; color: #111827; font-weight: 700; font-size: 14px;">Quick Links :</p>
        <div class="footer-links">
          <a href="${this.appUrl}/dashboard" class="footer-link">Dashboard</a>
          |
          <a href="${this.appUrl}/dashboard/posts" class="footer-link">Manage Posts</a>
          |
          <a href="${this.appUrl}/dashboard/reviews" class="footer-link">Manage Reviews</a>
          |
          <a href="${this.appUrl}/dashboard/settings" class="footer-link">Settings</a>
        </div>
      </div>

      <p class="footer-text" style="margin: 20px 0; font-size: 13px; color: #6B7280;">
        © ${new Date().getFullYear()} LOBAISEO. All rights reserved.
      </p>

      <p class="footer-text" style="color: #9CA3AF; font-size: 12px;">
        You're receiving this daily report because you have an active LOBAISEO account.<br>
        <a href="${this.appUrl}/dashboard/settings" style="color: #9CA3AF; text-decoration: underline;">Manage email preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
    `;

    const text = `
LOBAISEO Daily Activity Report - ${today}

Hi ${userName || userEmail.split('@')[0]}!

LOBAISEO is in action — no manual work needed. Sit back and let LOBAISEO make your Google Business Profile shine on Google search.

Daily Activity:
- Posts Published: ${postsCreated.length}
- Reviews Responded: ${reviewsReplied.length}
- Locations: ${locations.length}

${auditData ? `
Audit Report:
- Google Search Rank: ${auditData.googleSearchRank || 5}
- Profile Completion: ${auditData.profileCompletion || 67}%
- SEO Score: ${auditData.seoScore || 100}%
- Review Reply Score: ${auditData.reviewReplyScore || 100}%
` : ''}

${isTrialUser && !isTrialExpired ? `Your Free Trial Ends in ${trialDaysRemaining} day${trialDaysRemaining !== 1 ? 's' : ''}. Upgrade now!` : ''}
${isTrialExpired ? 'Your trial has ended. Please upgrade to continue using LOBAISEO.' : ''}

View your dashboard: ${this.appUrl}/dashboard
Upgrade: ${this.appUrl}/dashboard/billing

© ${new Date().getFullYear()} LOBAISEO. All rights reserved.
    `;

    return { subject, html, text };
  }

  /**
   * Send daily activity report email
   */
  async sendDailyReport(userEmail, userData, activityData, auditData = null) {
    if (this.disabled) {
      console.log('[NewDailyActivityEmailService] Email service disabled - skipping');
      return { success: false, error: 'Email service disabled' };
    }

    try {
      console.log(`[NewDailyActivityEmailService] 📧 Sending daily report to ${userEmail}`);

      const { subject, html, text } = this.generateDailyReportEmail(userData, activityData, auditData);

      // Read banner images and convert to base64
      const publicPath = path.join(__dirname, '../../public');
      const bannerDesktopPath = path.join(publicPath, 'banner_desktop.png');
      const bannerMobilePath = path.join(publicPath, 'banner_mobile.png');

      console.log('[NewDailyActivityEmailService] Banner paths:', {
        publicPath,
        bannerDesktopPath,
        bannerMobilePath,
        desktopExists: fs.existsSync(bannerDesktopPath),
        mobileExists: fs.existsSync(bannerMobilePath)
      });

      let attachments = [];
      try {
        if (fs.existsSync(bannerDesktopPath)) {
          const bannerDesktop = fs.readFileSync(bannerDesktopPath);
          attachments.push({
            filename: 'banner_desktop.png',
            content: bannerDesktop,
            cid: 'banner_desktop'
          });
          console.log('[NewDailyActivityEmailService] ✅ Banner desktop attached');
        } else {
          console.warn('[NewDailyActivityEmailService] ⚠️ Banner desktop not found at:', bannerDesktopPath);
        }

        if (fs.existsSync(bannerMobilePath)) {
          const bannerMobile = fs.readFileSync(bannerMobilePath);
          attachments.push({
            filename: 'banner_mobile.png',
            content: bannerMobile,
            cid: 'banner_mobile'
          });
          console.log('[NewDailyActivityEmailService] ✅ Banner mobile attached');
        } else {
          console.warn('[NewDailyActivityEmailService] ⚠️ Banner mobile not found at:', bannerMobilePath);
        }
      } catch (err) {
        console.error('[NewDailyActivityEmailService] ❌ Error attaching banner images:', err.message);
      }

      console.log(`[NewDailyActivityEmailService] Sending email with ${attachments.length} attachments`);

      // Use Gmail SMTP to send email with attachments
      const response = await this.gmailService.sendEmail({
        to: userEmail,
        subject,
        html,
        text,
        attachments: attachments
      });

      console.log(`[NewDailyActivityEmailService] ✅ Daily report sent to ${userEmail}`);

      return response;
    } catch (error) {
      console.error('[NewDailyActivityEmailService] ❌ Error sending daily report:', error);

      if (error.response) {
        console.error('[NewDailyActivityEmailService] SendGrid error response:', error.response.body);
      }

      return {
        success: false,
        error: error.message,
        details: error.response?.body
      };
    }
  }
}

export default new NewDailyActivityEmailService();
