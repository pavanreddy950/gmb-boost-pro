import sgMail from '@sendgrid/mail';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('========================================');
console.log('📧 SENDING TEST EMAIL TO MEENA');
console.log('========================================\n');

const apiKey = process.env.SENDGRID_API_KEY;

if (!apiKey) {
  console.error('❌ SENDGRID_API_KEY not found!');
  process.exit(1);
}

sgMail.setApiKey(apiKey);

const emailAddress = 'meenakarjale73@gmail.com';

const msg = {
  to: emailAddress,
  from: {
    email: 'support@lobaiseo.com',
    name: 'LOBAISEO Support'
  },
  subject: '✅ LOBAISEO Email System Test - All Systems Working',
  text: `Hi Meena,

This is a test email from the LOBAISEO automated posting system.

Email System Status: ✅ WORKING PERFECTLY

All email notifications are now functioning correctly:
✓ Daily activity reports
✓ Trial reminder emails
✓ System notifications
✓ Automated alerts

Your SendGrid integration is active and ready!

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
    .header { background: linear-gradient(135deg, #10B981 0%, #059669 100%); padding: 40px 30px; text-align: center; }
    .logo { color: #ffffff; font-size: 32px; font-weight: bold; margin: 0; }
    .subtitle { color: rgba(255,255,255,0.9); margin: 10px 0 0 0; font-size: 16px; }
    .content { padding: 40px 30px; }
    .success-badge { background-color: #10B981; color: white; display: inline-block; padding: 10px 24px; border-radius: 20px; font-size: 14px; font-weight: 600; margin-bottom: 20px; }
    .heading { color: #111827; font-size: 28px; font-weight: bold; margin: 0 0 20px 0; }
    .message { color: #4B5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px; }
    .status-box { background: linear-gradient(135deg, #ECFDF5 0%, #D1FAE5 100%); border-left: 4px solid #10B981; padding: 20px; margin: 25px 0; border-radius: 4px; }
    .status-title { color: #065F46; font-weight: 700; font-size: 18px; margin: 0 0 15px 0; }
    .features { background-color: #F9FAFB; padding: 25px; border-radius: 8px; margin: 25px 0; }
    .feature-item { display: flex; align-items: start; margin-bottom: 12px; }
    .feature-icon { color: #10B981; font-size: 18px; margin-right: 10px; font-weight: bold; flex-shrink: 0; }
    .feature-text { color: #374151; font-size: 14px; line-height: 1.5; }
    .footer { background-color: #F9FAFB; padding: 30px; text-align: center; color: #6B7280; font-size: 14px; }
    .checkmark { display: inline-block; width: 60px; height: 60px; border-radius: 50%; background-color: #10B981; color: white; font-size: 32px; line-height: 60px; margin: 20px 0; }
  </style>
</head>
<body>
  <div class="container">
    <!-- Header -->
    <div class="header">
      <h1 class="logo">LOBAISEO</h1>
      <p class="subtitle">Email System Test</p>
    </div>

    <!-- Content -->
    <div class="content">
      <div style="text-align: center;">
        <div class="checkmark">✓</div>
      </div>

      <div class="success-badge" style="display: block; text-align: center; width: fit-content; margin: 0 auto 20px;">✅ ALL SYSTEMS WORKING</div>

      <h2 class="heading" style="text-align: center;">Email System Test Successful!</h2>

      <p class="message">Hi Meena,</p>

      <p class="message">
        Great news! The LOBAISEO email system is now <strong>fully operational</strong> and ready to send automated notifications.
      </p>

      <!-- Status Box -->
      <div class="status-box">
        <p class="status-title">✅ Email System Status: ACTIVE</p>
        <p class="message" style="margin: 0; font-size: 14px; color: #065F46;">
          All email services have been configured and tested successfully. Your SendGrid integration is working perfectly!
        </p>
      </div>

      <!-- Features -->
      <div class="features">
        <p style="color: #111827; font-size: 16px; font-weight: 600; margin: 0 0 15px 0;">📧 Email Notifications Now Active:</p>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Daily Activity Reports:</strong> Automated summaries of posts and reviews</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Trial Reminders:</strong> Notifications at 14, 7, 3, and 1 day before expiry</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>System Alerts:</strong> Important updates and status notifications</span>
        </div>

        <div class="feature-item">
          <span class="feature-icon">✓</span>
          <span class="feature-text"><strong>Custom Notifications:</strong> Personalized alerts for your locations</span>
        </div>
      </div>

      <p class="message" style="background-color: #FEF3C7; padding: 15px; border-left: 4px solid #F59E0B; border-radius: 4px; font-size: 14px;">
        <strong>📌 Note:</strong> This test confirms that SendGrid is properly configured and all email features are working correctly. You should now be able to send emails to any verified address!
      </p>

      <p class="message" style="font-size: 14px; color: #6B7280; text-align: center; margin-top: 30px;">
        If you received this email, everything is working perfectly! 🎉
      </p>
    </div>

    <!-- Footer -->
    <div class="footer">
      <p style="margin: 10px 0; font-weight: 600; color: #111827;">LOBAISEO - Google Business Profile Automation</p>
      <p style="margin: 15px 0; font-size: 13px;">© 2025 LOBAISEO. All rights reserved.</p>
      <p style="font-size: 12px; color: #9CA3AF; margin-top: 15px;">
        This is a test email to verify email functionality.<br>
        Sent at: ${new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })} IST
      </p>
    </div>
  </div>
</body>
</html>
  `
};

console.log('📤 Sending test email...');
console.log(`   To: ${emailAddress}`);
console.log('   Subject: ✅ LOBAISEO Email System Test - All Systems Working');
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
  console.log('✅ TEST EMAIL SENT TO MEENA');
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
