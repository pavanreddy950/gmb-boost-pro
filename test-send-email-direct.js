import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import path from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables from server/.env
dotenv.config({ path: path.join(__dirname, 'server', '.env') });

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
  console.log('\n💡 Make sure server/.env file contains:');
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
  subject: '🧪 Test Email - 14 Days Trial Reminder',
  text: `Hi Raja,

This is a test trial reminder email from LOBAISEO.

You have 14 days remaining in your trial.

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
    .container { max-width: 600px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; }
    .header { background: linear-gradient(135deg, #1E2DCD 0%, #4F46E5 100%); padding: 40px 30px; text-align: center; }
    .logo { color: #ffffff; font-size: 32px; font-weight: bold; margin: 0; }
    .content { padding: 40px 30px; }
    .urgency-badge { background-color: #2563EB; color: white; display: inline-block; padding: 8px 20px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
    .heading { color: #111827; font-size: 28px; font-weight: bold; margin: 0 0 20px 0; }
    .message { color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
    .cta-button { display: inline-block; background-color: #2563EB; color: #ffffff; text-decoration: none; padding: 16px 40px; border-radius: 8px; font-size: 16px; font-weight: 600; margin: 20px 0; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 class="logo">LOBAISEO</h1>
      <p style="color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px;">Google Business Profile Automation</p>
    </div>

    <div class="content">
      <div class="urgency-badge">14 DAYS LEFT</div>
      <h2 class="heading">Your Trial is Active!</h2>

      <p class="message">Hi Raja,</p>
      <p class="message">This is a test email for your Scale Point Strategy & Business Growth Solutions location.</p>
      <p class="message">You have 14 days remaining in your trial period. Make the most of your LOBAISEO automation features!</p>

      <div style="text-align: center;">
        <a href="https://app.lobaiseo.com/billing" class="cta-button">View Upgrade Options</a>
      </div>
    </div>

    <div class="footer">
      <p>© 2025 LOBAISEO. All rights reserved.</p>
      <p style="font-size: 12px; color: #9CA3AF; margin-top: 15px;">
        This is a test email from the autoposting system.
      </p>
    </div>
  </div>
</body>
</html>
  `
};

console.log('📤 Sending test email to: rajpaulgupta5@gmail.com');
console.log('   Subject: 🧪 Test Email - 14 Days Trial Reminder');
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
