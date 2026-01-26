import nodemailer from 'nodemailer';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load environment variables from .env.local
dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

console.log('[GmailService] Loading config...');
console.log('[GmailService] GMAIL_USER:', process.env.GMAIL_USER ? '✅ Set' : '❌ Not set');
console.log('[GmailService] GMAIL_APP_PASSWORD:', process.env.GMAIL_APP_PASSWORD ? '✅ Set' : '❌ Not set');

/**
 * Gmail SMTP Email Service
 * Sends emails using Gmail SMTP directly - no SendGrid needed
 * Works 24/7 with Gmail App Password
 */
class GmailService {
  constructor() {
    const gmailUser = process.env.GMAIL_USER;
    const gmailPassword = process.env.GMAIL_APP_PASSWORD;
    const gmailFromName = process.env.GMAIL_FROM_NAME || 'LOBAISEO';

    if (!gmailUser || !gmailPassword) {
      console.warn('[GmailService] ⚠️ Gmail credentials not set - email notifications disabled');
      this.disabled = true;
      return;
    }

    // Create Gmail SMTP transporter
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: gmailUser,
        pass: gmailPassword
      },
      tls: {
        // Allow self-signed certificates (needed for some corporate networks)
        rejectUnauthorized: false
      }
    });

    this.fromEmail = gmailUser;
    this.fromName = gmailFromName;
    this.disabled = false;

    console.log('[GmailService] ✅ Initialized with Gmail SMTP');
    console.log(`[GmailService] From: ${this.fromName} <${this.fromEmail}>`);

    // Verify connection
    this.verifyConnection();
  }

  /**
   * Verify Gmail SMTP connection
   */
  async verifyConnection() {
    if (this.disabled) return;

    try {
      await this.transporter.verify();
      console.log('[GmailService] ✅ Gmail SMTP connection verified');
    } catch (error) {
      console.error('[GmailService] ❌ Gmail SMTP connection failed:', error.message);
      this.disabled = true;
    }
  }

  /**
   * Send email using Gmail SMTP
   * @param {Object} emailOptions - Email configuration
   * @param {string} emailOptions.to - Recipient email
   * @param {string} emailOptions.subject - Email subject
   * @param {string} emailOptions.html - HTML body
   * @param {string} [emailOptions.text] - Plain text body (optional)
   * @param {string} [emailOptions.senderName] - Custom sender name (optional)
   * @param {Array} [emailOptions.attachments] - Email attachments (optional)
   * @returns {Promise<Object>} Send result
   */
  async sendEmail({ to, subject, html, text, senderName, attachments }) {
    if (this.disabled) {
      console.warn('[GmailService] Email service is disabled - skipping email send');
      return { success: false, error: 'Email service disabled' };
    }

    try {
      // Use custom sender name if provided, otherwise use default
      const fromName = senderName || this.fromName;

      console.log(`[GmailService] 📧 Sending email to: ${to}`);
      console.log(`[GmailService] Subject: ${subject}`);
      console.log(`[GmailService] From Name: ${fromName}`);

      const mailOptions = {
        from: `${fromName} <${this.fromEmail}>`,
        to,
        subject,
        html,
        text: text || this.htmlToText(html)
      };

      // Add attachments if provided
      if (attachments && attachments.length > 0) {
        mailOptions.attachments = attachments.map(att => ({
          filename: att.filename,
          content: att.content,
          encoding: att.encoding || 'base64',
          cid: att.content_id || att.cid,
          contentDisposition: 'inline',  // Display inline, not as downloadable attachment
          contentType: att.contentType || 'image/png'
        }));
        console.log(`[GmailService] 📎 Including ${attachments.length} inline attachment(s)`);
      }

      const result = await this.transporter.sendMail(mailOptions);

      console.log(`[GmailService] ✅ Email sent successfully to ${to}`);
      console.log(`[GmailService] Message ID: ${result.messageId}`);

      return {
        success: true,
        messageId: result.messageId,
        response: result.response
      };
    } catch (error) {
      console.error('[GmailService] ❌ Failed to send email:', error.message);
      console.error('[GmailService] Error details:', error);

      return {
        success: false,
        error: error.message
      };
    }
  }

  /**
   * Simple HTML to text converter for fallback
   */
  htmlToText(html) {
    return html
      .replace(/<[^>]*>/g, '') // Remove HTML tags
      .replace(/&nbsp;/g, ' ')
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .trim();
  }

  /**
   * Send test email
   */
  async sendTestEmail(toEmail) {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0; }
          .content { background: #f9fafb; padding: 30px; border-radius: 0 0 10px 10px; }
          .success { background: #10b981; color: white; padding: 15px; border-radius: 8px; text-align: center; margin: 20px 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>✅ Email Service Working!</h1>
          </div>
          <div class="content">
            <div class="success">
              <h2>🎉 Success!</h2>
              <p>Your Gmail SMTP email service is working perfectly!</p>
            </div>
            <p>This is a test email from LOBAISEO.</p>
            <p><strong>Configuration:</strong></p>
            <ul>
              <li>Service: Gmail SMTP</li>
              <li>From: ${this.fromName} &lt;${this.fromEmail}&gt;</li>
              <li>Status: ✅ Working 24/7</li>
            </ul>
            <p>You can now send daily reports, trial reminders, and other notifications automatically!</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return await this.sendEmail({
      to: toEmail,
      subject: '✅ Gmail SMTP Test - Email Service Working!',
      html
    });
  }
}

// Export singleton instance
const gmailService = new GmailService();
export default gmailService;
