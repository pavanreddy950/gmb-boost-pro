import nodemailer from 'nodemailer';
import sgMail from '@sendgrid/mail';
import Mailgun from 'mailgun.js';
import formData from 'form-data';
import AWS from 'aws-sdk';

class EmailService {
  constructor() {
    this.transporters = new Map();
  }

  // Create email transporter based on provider
  async createTransporter(config) {
    const { provider, config: providerConfig } = config;

    switch (provider) {
      case 'gmail':
        return this.createGmailTransporter(providerConfig);
      case 'sendgrid':
        return this.createSendGridTransporter(providerConfig);
      case 'mailgun':
        return this.createMailgunTransporter(providerConfig);
      case 'aws_ses':
        return this.createAWSSESTransporter(providerConfig);
      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }
  }

  // Gmail SMTP transporter
  createGmailTransporter(config) {
    const { email, password, displayName } = config;

    return nodemailer.createTransporter({
      service: 'Gmail',
      auth: {
        user: email,
        pass: password
      },
      from: `${displayName || 'Review Request'} <${email}>`
    });
  }

  // SendGrid transporter
  createSendGridTransporter(config) {
    const { apiKey, fromEmail, fromName } = config;

    sgMail.setApiKey(apiKey);

    return {
      provider: 'sendgrid',
      apiKey,
      fromEmail,
      fromName: fromName || 'Review Request'
    };
  }

  // Mailgun transporter
  createMailgunTransporter(config) {
    const { apiKey, domain, fromEmail, fromName } = config;

    const mailgun = new Mailgun(formData);
    const mg = mailgun.client({ username: 'api', key: apiKey });

    return {
      provider: 'mailgun',
      client: mg,
      domain,
      fromEmail,
      fromName: fromName || 'Review Request'
    };
  }

  // AWS SES transporter
  createAWSSESTransporter(config) {
    const { accessKeyId, secretAccessKey, region, fromEmail, fromName } = config;

    AWS.config.update({
      accessKeyId,
      secretAccessKey,
      region: region || 'us-east-1'
    });

    return {
      provider: 'aws_ses',
      ses: new AWS.SES({ apiVersion: '2010-12-01' }),
      fromEmail,
      fromName: fromName || 'Review Request'
    };
  }

  // Send email using the appropriate provider
  async sendEmail(config, emailData) {
    const transporter = await this.createTransporter(config);
    const { provider } = config;

    try {
      switch (provider) {
        case 'gmail':
          return await this.sendWithNodemailer(transporter, emailData);
        case 'sendgrid':
          return await this.sendWithSendGrid(transporter, emailData);
        case 'mailgun':
          return await this.sendWithMailgun(transporter, emailData);
        case 'aws_ses':
          return await this.sendWithAWSSES(transporter, emailData);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`[EmailService] Failed to send email via ${provider}:`, error);
      throw error;
    }
  }

  // Send with Nodemailer (Gmail)
  async sendWithNodemailer(transporter, emailData) {
    const { to, subject, html, text } = emailData;

    const mailOptions = {
      to,
      subject,
      html,
      text: text || this.stripHtml(html)
    };

    const result = await transporter.sendMail(mailOptions);
    return {
      success: true,
      messageId: result.messageId,
      provider: 'gmail'
    };
  }

  // Send with SendGrid
  async sendWithSendGrid(transporter, emailData) {
    const { to, subject, html, text } = emailData;
    const { fromEmail, fromName } = transporter;

    const msg = {
      to,
      from: {
        email: fromEmail,
        name: fromName
      },
      subject,
      html,
      text: text || this.stripHtml(html)
    };

    const result = await sgMail.send(msg);
    return {
      success: true,
      messageId: result[0].headers['x-message-id'],
      provider: 'sendgrid'
    };
  }

  // Send with Mailgun
  async sendWithMailgun(transporter, emailData) {
    const { to, subject, html, text } = emailData;
    const { client, domain, fromEmail, fromName } = transporter;

    const messageData = {
      from: `${fromName} <${fromEmail}>`,
      to,
      subject,
      html,
      text: text || this.stripHtml(html)
    };

    const result = await client.messages.create(domain, messageData);
    return {
      success: true,
      messageId: result.id,
      provider: 'mailgun'
    };
  }

  // Send with AWS SES
  async sendWithAWSSES(transporter, emailData) {
    const { to, subject, html, text } = emailData;
    const { ses, fromEmail, fromName } = transporter;

    const params = {
      Destination: {
        ToAddresses: [to]
      },
      Message: {
        Body: {
          Html: {
            Charset: 'UTF-8',
            Data: html
          },
          Text: {
            Charset: 'UTF-8',
            Data: text || this.stripHtml(html)
          }
        },
        Subject: {
          Charset: 'UTF-8',
          Data: subject
        }
      },
      Source: `${fromName} <${fromEmail}>`
    };

    const result = await ses.sendEmail(params).promise();
    return {
      success: true,
      messageId: result.MessageId,
      provider: 'aws_ses'
    };
  }

  // Generate review request email template
  generateReviewRequestEmail(customerData, businessData, reviewUrl) {
    const { customerName, businessName, businessType } = customerData;

    const subject = `Share your experience with ${businessName}`;

    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Review Request</title>
        <style>
          body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
          .container { max-width: 600px; margin: 0 auto; padding: 20px; }
          .header { background: #f8f9fa; padding: 20px; border-radius: 8px; text-align: center; margin-bottom: 20px; }
          .content { padding: 20px; }
          .cta-button {
            display: inline-block;
            background: #4285f4;
            color: white;
            padding: 15px 30px;
            text-decoration: none;
            border-radius: 5px;
            font-weight: bold;
            margin: 20px 0;
          }
          .stars { font-size: 24px; color: #ffc107; }
          .footer { text-align: center; font-size: 12px; color: #666; margin-top: 30px; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Hi ${customerName}!</h1>
            <p>Thank you for choosing ${businessName}</p>
          </div>

          <div class="content">
            <p>We hope you had a great experience with our ${businessType || 'services'}. Your feedback is incredibly valuable to us and helps other customers make informed decisions.</p>

            <p>Would you mind taking a moment to share your experience by leaving us a review?</p>

            <div style="text-align: center;">
              <div class="stars">⭐⭐⭐⭐⭐</div>
              <br>
              <a href="${reviewUrl}" class="cta-button">Leave a Review</a>
            </div>

            <p>Your review helps us improve our services and helps other customers find us. It only takes a minute!</p>

            <p>Thank you for your time and for being a valued customer.</p>

            <p>Best regards,<br>
            The ${businessName} Team</p>
          </div>

          <div class="footer">
            <p>This email was sent to request your honest review. If you have any concerns, please contact us directly.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    const text = `
Hi ${customerName}!

Thank you for choosing ${businessName}.

We hope you had a great experience with our ${businessType || 'services'}. Your feedback is incredibly valuable to us and helps other customers make informed decisions.

Would you mind taking a moment to share your experience by leaving us a review?

Please visit: ${reviewUrl}

Your review helps us improve our services and helps other customers find us. It only takes a minute!

Thank you for your time and for being a valued customer.

Best regards,
The ${businessName} Team
    `;

    return { subject, html, text };
  }

  // Send review request email
  async sendReviewRequest(config, customerData, businessData, reviewUrl) {
    const emailTemplate = this.generateReviewRequestEmail(customerData, businessData, reviewUrl);

    const emailData = {
      to: customerData.email,
      ...emailTemplate
    };

    return await this.sendEmail(config, emailData);
  }

  // Send bulk review requests
  async sendBulkReviewRequests(config, customers, businessData, reviewUrl, onProgress = null) {
    const results = [];
    let processed = 0;

    for (const customer of customers) {
      try {
        const result = await this.sendReviewRequest(config, {
          customerName: customer.name,
          email: customer.email,
          businessName: businessData.name,
          businessType: businessData.type
        }, businessData, reviewUrl);

        results.push({
          customer: customer.name,
          email: customer.email,
          success: true,
          messageId: result.messageId,
          provider: result.provider
        });

        console.log(`[EmailService] Review request sent to ${customer.email}`);
      } catch (error) {
        results.push({
          customer: customer.name,
          email: customer.email,
          success: false,
          error: error.message
        });

        console.error(`[EmailService] Failed to send to ${customer.email}:`, error.message);
      }

      processed++;
      if (onProgress) {
        onProgress({
          processed,
          total: customers.length,
          percentage: Math.round((processed / customers.length) * 100)
        });
      }

      // Rate limiting - wait 100ms between emails
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    return {
      total: customers.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // Test email configuration
  async testConfiguration(config, testEmail) {
    const testData = {
      to: testEmail,
      subject: 'Test Email Configuration',
      html: '<h1>Test Email</h1><p>Your email configuration is working correctly!</p>',
      text: 'Test Email - Your email configuration is working correctly!'
    };

    return await this.sendEmail(config, testData);
  }

  // Utility function to strip HTML tags
  stripHtml(html) {
    return html.replace(/<[^>]*>/g, '');
  }

  // Get provider-specific settings validation
  getProviderRequiredFields(provider) {
    switch (provider) {
      case 'gmail':
        return ['email', 'password'];
      case 'sendgrid':
        return ['apiKey', 'fromEmail'];
      case 'mailgun':
        return ['apiKey', 'domain', 'fromEmail'];
      case 'aws_ses':
        return ['accessKeyId', 'secretAccessKey', 'fromEmail'];
      default:
        return [];
    }
  }

  // Validate configuration
  validateConfig(provider, config) {
    const requiredFields = this.getProviderRequiredFields(provider);
    const missingFields = requiredFields.filter(field => !config[field]);

    if (missingFields.length > 0) {
      throw new Error(`Missing required fields for ${provider}: ${missingFields.join(', ')}`);
    }

    return true;
  }
}

export default EmailService;