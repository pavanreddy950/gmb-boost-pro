import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('========================================');
console.log('📧 SENDGRID EMAIL TEST');
console.log('========================================\n');

const apiKey = process.env.SENDGRID_API_KEY;

console.log('SendGrid API Key:', apiKey ? `${apiKey.substring(0, 15)}...` : 'NOT FOUND');
console.log('From Email:', process.env.SENDGRID_FROM_EMAIL || 'support@lobaiseo.com');
console.log('From Name:', process.env.SENDGRID_FROM_NAME || 'LOBAISEO Support');
console.log('');

if (!apiKey) {
  console.error('❌ SENDGRID_API_KEY not found in environment variables!');
  console.log('\n💡 Make sure .env file contains:');
  console.log('   SENDGRID_API_KEY=your_api_key_here');
  process.exit(1);
}

sgMail.setApiKey(apiKey);

const msg = {
  to: 'rajpaulgupta5@gmail.com',
  from: {
    email: process.env.SENDGRID_FROM_EMAIL || 'support@lobaiseo.com',
    name: process.env.SENDGRID_FROM_NAME || 'LOBAISEO Support'
  },
  subject: '🧪 Test Email - 14 Days Trial Reminder for Scale Point',
  text: `Hi Raja,

This is a test trial reminder email from LOBAISEO for your location:
Scale Point Strategy & Business Growth Solutions

You have 14 days remaining in your trial.

This email confirms that the autoposting system email functionality is working correctly.

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
    .urgency-badge { background-color: #2563EB; color: white; display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
    .heading { color: #111827; font-size: 28px; font-weight: bold; margin: 0 0 20px 0; }
    .message { color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
    .location-box { background-color: #F0F7FF; border-left: 4px solid #2563EB; padding: 15px 20px; margin: 20px 0; border-radius: 4px; }
    .location-name { color: #1E40AF; font-weight: 600; font-size: 18px; margin: 0; }
    .cta-button { display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 20px 0; transition: all 0.3s; }
    .features { background-color: #F9FAFB; padding: 25px; border-radius: 8px; margin: 25px 0; }
    .feature-item { display: flex; align-items: start; margin-bottom: 12px; }
    .feature-icon { color: #10B981; font-size: 18px; margin-right: 10px; font-weight: bold; }
    .feature-text { color: #374151; font-size: 14px; line-height: 1.5; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; }
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
      <div class="urgency-badge">🧪 TEST EMAIL - 14 DAYS LEFT</div>
      <h2 class="heading">Your Trial is Active!</h2>

      <p class="message">Hi Raja,</p>

      <p class="message">This is a test trial reminder email for your location:</p>

      <div class="location-box">
        <p class="location-name">📍 Scale Point Strategy & Business Growth Solutions</p>
      </div>

      <p class="message">
        <strong>Trial Status:</strong> You have 14 days remaining in your trial period.
      </p>

      <p class="message">
        Make the most of your LOBAISEO automation features including:
      </p>

      <!-- Features -->
      <div class="features">
        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Automated Posting:</strong> Daily posts to your Google Business Profile</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Review Management:</strong> AI-powered responses to customer reviews</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Multi-Location Support:</strong> Manage all your business profiles</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Analytics Dashboard:</strong> Track your performance metrics</span>
        </div>
      </div>

      <div style="text-align: center; margin: 30px 0;">
        <a href="https://app.lobaiseo.com/billing" class="cta-button">View Upgrade Options</a>
      </div>

      <p class="message" style="font-size: 14px; color: #6B7280;">
        Questions? Reply to this email or visit our <a href="https://www.lobaiseo.com" style="color: #2563EB;">website</a> for more information.
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 10px 0;">© 2025 LOBAISEO. All rights reserved.</p>
      <p style="font-size: 12px; color: #9CA3AF; margin-top: 15px;">
        This is a test email confirming email functionality is working.<br>
        Location ID: 14977377147025961194
      </p>
    </div>
  </div>
</body>
</html>
  `
};

console.log('📤 Sending test email to: rajpaulgupta5@gmail.com');
console.log('   Subject: 🧪 Test Email - 14 Days Trial Reminder for Scale Point');
console.log('   For Location: Scale Point Strategy & Business Growth Solutions');
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
  console.log('✅ TEST COMPLETED SUCCESSFULLY');
  console.log('========================================');
  console.log('');
  console.log('💡 Check your inbox: rajpaulgupta5@gmail.com');
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
  console.error('Full Error:', error);
  console.error('');
  console.error('========================================');
  console.error('❌ TEST FAILED');
  console.error('========================================');
  process.exit(1);
}
