import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('========================================');
console.log('📧 SENDING TEST EMAIL TO SCALE POINT');
console.log('========================================\n');

const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error('❌ SENDGRID_API_KEY not found!');
  process.exit(1);
}

sgMail.setApiKey(apiKey);

// Location details
const locationId = '14977377147025961194';
const businessName = 'Scale Point Strategy & Business Growth Solutions';
const emailAddress = 'scalepointstrategy@gmail.com';

const msg = {
  to: emailAddress,
  from: {
    email: 'support@lobaiseo.com',
    name: 'LOBAISEO Support'
  },
  subject: '🎉 Auto-Posting Test Email - Scale Point Strategy',
  text: `Hi Scale Point Team,

This is a test email from LOBAISEO's automated posting system.

Your Location Details:
- Business Name: ${businessName}
- Location ID: ${locationId}
- Email: ${emailAddress}

Your automated posting system is now configured and ready!

Features Active:
✓ Daily automated posts to Google Business Profile
✓ AI-powered review responses
✓ Performance analytics and insights
✓ Multi-location management

This email confirms that all email notifications are working correctly for your location.

Best regards,
LOBAISEO Team`,
  html: `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <style>
    body { margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f3f4f6; }
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.1); }
    .header { background: linear-gradient(135deg, #1E2DCD 0%, #4F46E5 100%); padding: 40px 30px; text-align: center; }
    .logo { color: #ffffff; font-size: 32px; font-weight: bold; margin: 0; }
    .subtitle { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }
    .content { padding: 40px 30px; }
    .success-badge { background-color: #10B981; color: white; display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
    .heading { color: #111827; font-size: 28px; font-weight: bold; margin: 0 0 20px 0; }
    .message { color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
    .location-box { background: linear-gradient(135deg, #F0F7FF 0%, #E0EFFE 100%); border-left: 4px solid #2563EB; padding: 20px; margin: 25px 0; border-radius: 4px; }
    .location-name { color: #1E40AF; font-weight: 700; font-size: 20px; margin: 0 0 10px 0; }
    .location-detail { color: #4B5563; font-size: 14px; margin: 5px 0; }
    .location-id { background-color: rgba(37, 99, 235, 0.1); color: #2563EB; padding: 4px 12px; border-radius: 4px; font-family: monospace; font-size: 12px; display: inline-block; margin-top: 8px; }
    .features { background-color: #F9FAFB; padding: 25px; border-radius: 8px; margin: 25px 0; }
    .features-title { color: #111827; font-size: 18px; font-weight: 600; margin: 0 0 15px 0; }
    .feature-item { display: flex; align-items: start; margin-bottom: 12px; }
    .feature-icon { color: #10B981; font-size: 18px; margin-right: 10px; font-weight: bold; flex-shrink: 0; }
    .feature-text { color: #374151; font-size: 14px; line-height: 1.5; }
    .cta-button { display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 20px 0; transition: all 0.3s; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; }
    .divider { height: 1px; background: linear-gradient(90deg, transparent, #E5E7EB, transparent); margin: 30px 0; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1 class="logo">LOBAISEO</h1>
      <p class="subtitle">Google Business Profile Automation</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div class="success-badge">✅ SYSTEM TEST SUCCESSFUL</div>
      <h2 class="heading">Auto-Posting System Active!</h2>

      <p class="message">Hi Scale Point Team,</p>

      <p class="message">
        Great news! Your automated posting system is now <strong>configured and ready</strong> for:
      </p>

      <!-- Location Details -->
      <div class="location-box">
        <p class="location-name">📍 ${businessName}</p>
        <p class="location-detail"><strong>Email:</strong> ${emailAddress}</p>
        <p class="location-detail"><strong>Status:</strong> <span style="color: #10B981; font-weight: 600;">Active & Verified ✓</span></p>
        <div class="location-id">Location ID: ${locationId}</div>
      </div>

      <div class="divider"></div>

      <!-- Features -->
      <div class="features">
        <p class="features-title">🚀 Active Features for Your Location:</p>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Automated Daily Posts:</strong> AI-generated posts published to your Google Business Profile at 9:00 AM IST</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Smart Review Replies:</strong> AI-powered responses to all customer reviews within minutes</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Email Notifications:</strong> Daily activity reports and important updates sent to your inbox</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Performance Analytics:</strong> Track engagement, views, and customer interactions</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Address in Every Post:</strong> Your business location automatically included for local SEO</span>
        </div>
      </div>

      <p class="message">
        This test email confirms that all email notifications are working correctly for your location.
        You'll receive automated reports and updates at this email address.
      </p>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://app.lobaiseo.com/dashboard" class="cta-button">View Dashboard</a>
      </div>

      <p class="message" style="font-size: 14px; color: #6B7280;">
        Questions or need support? Reply to this email or visit our
        <a href="https://www.lobaiseo.com" style="color: #2563EB; text-decoration: none;">website</a>.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 10px 0; font-weight: 600; color: #111827;">LOBAISEO - Google Business Profile Automation</p>
      <p style="margin: 15px 0; font-size: 13px;">© 2025 LOBAISEO. All rights reserved.</p>
      <p style="font-size: 12px; color: #9CA3AF; margin-top: 15px;">
        You're receiving this because your business is using LOBAISEO automation.<br>
        <a href="https://app.lobaiseo.com/settings" style="color: #9CA3AF; text-decoration: underline;">Manage preferences</a>
      </p>
    </div>
  </div>
</body>
</html>
  `
};

console.log('📤 Sending test email...');
console.log(`   To: ${emailAddress}`);
console.log(`   Business: ${businessName}`);
console.log(`   Location ID: ${locationId}`);
console.log('');

try {
  const response = await sgMail.send(msg);

  console.log('✅ Email sent successfully!');
  console.log('');
  console.log('Response Details:');
  console.log('  - Status Code:', response[0].statusCode);
  console.log('  - Message ID:', response[0].headers['x-message-id']);
  console.log('');
  console.log('========================================');
  console.log('✅ TEST EMAIL SENT TO SCALE POINT');
  console.log('========================================');
  console.log('');
  console.log(`💡 Check inbox: ${emailAddress}`);
  console.log('   (Also check spam/junk folder if not in inbox)');
  console.log('');

} catch (error) {
  console.error('❌ Failed to send email!');
  console.error('');
  console.error('Error Details:');
  console.error('  - Message:', error.message);
  if (error.response) {
    console.error('  - Status Code:', error.response.statusCode);
    console.error('  - Body:', JSON.stringify(error.response.body, null, 2));
  }
  console.error('');
  process.exit(1);
}
