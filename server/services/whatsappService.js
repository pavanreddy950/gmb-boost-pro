import twilio from 'twilio';
import fetch from 'node-fetch';

class WhatsAppService {
  constructor() {
    this.clients = new Map();
  }

  // Create WhatsApp client based on provider
  async createClient(config) {
    const { provider, config: providerConfig } = config;

    switch (provider) {
      case 'twilio':
        return this.createTwilioClient(providerConfig);
      case 'meta':
        return this.createMetaClient(providerConfig);
      case 'dialog360':
        return this.createDialog360Client(providerConfig);
      default:
        throw new Error(`Unsupported WhatsApp provider: ${provider}`);
    }
  }

  // Twilio WhatsApp client
  createTwilioClient(config) {
    const { accountSid, authToken, fromNumber } = config;

    return {
      provider: 'twilio',
      client: twilio(accountSid, authToken),
      fromNumber: `whatsapp:${fromNumber}` // Twilio requires whatsapp: prefix
    };
  }

  // Meta WhatsApp Business API client
  createMetaClient(config) {
    const { accessToken, phoneNumberId, businessAccountId } = config;

    return {
      provider: 'meta',
      accessToken,
      phoneNumberId,
      businessAccountId,
      baseUrl: `https://graph.facebook.com/v18.0/${phoneNumberId}/messages`
    };
  }

  // 360Dialog WhatsApp client
  createDialog360Client(config) {
    const { apiKey, channelId } = config;

    return {
      provider: 'dialog360',
      apiKey,
      channelId,
      baseUrl: 'https://waba.360dialog.io/v1/messages'
    };
  }

  // Send WhatsApp message using the appropriate provider
  async sendWhatsApp(config, messageData) {
    const client = await this.createClient(config);
    const { provider } = config;

    try {
      switch (provider) {
        case 'twilio':
          return await this.sendWithTwilio(client, messageData);
        case 'meta':
          return await this.sendWithMeta(client, messageData);
        case 'dialog360':
          return await this.sendWithDialog360(client, messageData);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`[WhatsAppService] Failed to send WhatsApp via ${provider}:`, error);
      throw error;
    }
  }

  // Send with Twilio WhatsApp
  async sendWithTwilio(client, messageData) {
    const { to, message, mediaUrl } = messageData;
    const { client: twilioClient, fromNumber } = client;

    const messageParams = {
      body: message,
      from: fromNumber,
      to: `whatsapp:${this.formatPhoneNumber(to)}`
    };

    // Add media if provided
    if (mediaUrl) {
      messageParams.mediaUrl = [mediaUrl];
    }

    const result = await twilioClient.messages.create(messageParams);

    return {
      success: true,
      messageId: result.sid,
      provider: 'twilio',
      status: result.status
    };
  }

  // Send with Meta WhatsApp Business API
  async sendWithMeta(client, messageData) {
    const { to, message, templateName, templateParams } = messageData;
    const { accessToken, baseUrl } = client;

    let payload;

    if (templateName) {
      // Send template message
      payload = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(to),
        type: 'template',
        template: {
          name: templateName,
          language: {
            code: 'en'
          },
          components: templateParams ? [
            {
              type: 'body',
              parameters: templateParams.map(param => ({ type: 'text', text: param }))
            }
          ] : []
        }
      };
    } else {
      // Send text message
      payload = {
        messaging_product: 'whatsapp',
        to: this.formatPhoneNumber(to),
        type: 'text',
        text: {
          body: message
        }
      };
    }

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok && result.messages) {
      return {
        success: true,
        messageId: result.messages[0].id,
        provider: 'meta',
        status: 'sent'
      };
    } else {
      throw new Error(`Meta API error: ${result.error?.message || 'Unknown error'}`);
    }
  }

  // Send with 360Dialog
  async sendWithDialog360(client, messageData) {
    const { to, message } = messageData;
    const { apiKey, baseUrl } = client;

    const payload = {
      to: this.formatPhoneNumber(to),
      type: 'text',
      text: {
        body: message
      }
    };

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'D360-API-KEY': apiKey,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const result = await response.json();

    if (response.ok && result.messages) {
      return {
        success: true,
        messageId: result.messages[0].id,
        provider: 'dialog360',
        status: 'sent'
      };
    } else {
      throw new Error(`360Dialog API error: ${result.errors?.[0]?.detail || 'Unknown error'}`);
    }
  }

  // Generate review request WhatsApp message template
  generateReviewRequestMessage(customerData, businessData, reviewUrl) {
    const { customerName, businessName } = customerData;

    const message = `Hi ${customerName}! 👋

Thank you for choosing *${businessName}*!

We hope you had a great experience with us. Your feedback means a lot to us and helps other customers make informed decisions.

Could you please take a moment to share your experience by leaving us a review? ⭐

${reviewUrl}

It only takes a minute and really helps our business grow! 🙏

Thank you for being a valued customer!

Best regards,
${businessName} Team`;

    return message;
  }

  // Generate template message parameters for business templates
  generateTemplateMessage(templateName, customerData, businessData, reviewUrl) {
    const { customerName, businessName } = customerData;

    switch (templateName) {
      case 'review_request_template':
        return {
          templateName: 'review_request_template',
          templateParams: [
            customerName,
            businessName,
            reviewUrl
          ]
        };

      case 'thank_you_review_template':
        return {
          templateName: 'thank_you_review_template',
          templateParams: [
            customerName,
            businessName,
            reviewUrl,
            '5 minutes'
          ]
        };

      default:
        return null;
    }
  }

  // Send review request WhatsApp message
  async sendReviewRequest(config, customerData, businessData, reviewUrl, useTemplate = false) {
    let messageData;

    if (useTemplate && config.config.templateName) {
      // Use approved template if available
      const templateData = this.generateTemplateMessage(
        config.config.templateName,
        customerData,
        businessData,
        reviewUrl
      );

      if (templateData) {
        messageData = {
          to: customerData.phone,
          templateName: templateData.templateName,
          templateParams: templateData.templateParams
        };
      } else {
        // Fallback to text message
        messageData = {
          to: customerData.phone,
          message: this.generateReviewRequestMessage(customerData, businessData, reviewUrl)
        };
      }
    } else {
      // Send as regular text message
      messageData = {
        to: customerData.phone,
        message: this.generateReviewRequestMessage(customerData, businessData, reviewUrl)
      };
    }

    return await this.sendWhatsApp(config, messageData);
  }

  // Send bulk review requests via WhatsApp
  async sendBulkReviewRequests(config, customers, businessData, reviewUrl, onProgress = null, useTemplate = false) {
    const results = [];
    let processed = 0;

    // Filter customers with phone numbers
    const customersWithPhone = customers.filter(customer => customer.phone);

    if (customersWithPhone.length === 0) {
      throw new Error('No customers with phone numbers found');
    }

    for (const customer of customersWithPhone) {
      try {
        const result = await this.sendReviewRequest(config, {
          customerName: customer.name,
          phone: customer.phone,
          businessName: businessData.name,
          businessType: businessData.type
        }, businessData, reviewUrl, useTemplate);

        results.push({
          customer: customer.name,
          phone: customer.phone,
          success: true,
          messageId: result.messageId,
          provider: result.provider
        });

        console.log(`[WhatsAppService] Review request sent to ${customer.phone}`);
      } catch (error) {
        results.push({
          customer: customer.name,
          phone: customer.phone,
          success: false,
          error: error.message
        });

        console.error(`[WhatsAppService] Failed to send to ${customer.phone}:`, error.message);
      }

      processed++;
      if (onProgress) {
        onProgress({
          processed,
          total: customersWithPhone.length,
          percentage: Math.round((processed / customersWithPhone.length) * 100)
        });
      }

      // Rate limiting - wait 2 seconds between WhatsApp messages to avoid spam detection
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    return {
      total: customersWithPhone.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // Test WhatsApp configuration
  async testConfiguration(config, testPhone) {
    const testMessage = 'Test WhatsApp message 📱\n\nYour WhatsApp configuration is working correctly! ✅';

    const messageData = {
      to: testPhone,
      message: testMessage
    };

    return await this.sendWhatsApp(config, messageData);
  }

  // Format phone number for WhatsApp (remove whatsapp: prefix if present)
  formatPhoneNumber(phone) {
    // Remove whatsapp: prefix if present
    let cleaned = phone.replace('whatsapp:', '');

    // Remove all non-numeric characters except +
    cleaned = cleaned.replace(/[^\d+]/g, '');

    // Add + if not present
    if (!cleaned.startsWith('+')) {
      // Default to India (+91) if no country code and 10 digits
      if (cleaned.length === 10) {
        cleaned = '+91' + cleaned;
      } else if (cleaned.length === 11 && cleaned.startsWith('91')) {
        cleaned = '+' + cleaned;
      } else if (cleaned.length === 12 && cleaned.startsWith('91')) {
        cleaned = '+' + cleaned;
      } else {
        cleaned = '+' + cleaned;
      }
    }

    return cleaned;
  }

  // Validate WhatsApp phone number
  validatePhoneNumber(phone) {
    const cleaned = this.formatPhoneNumber(phone);

    // WhatsApp numbers should be in international format
    if (!cleaned.startsWith('+')) {
      throw new Error('WhatsApp number must be in international format (+countrycode)');
    }

    // Should be at least 10 digits (including country code)
    const digits = cleaned.replace(/\D/g, '');
    if (digits.length < 10) {
      throw new Error('WhatsApp number too short');
    }

    if (digits.length > 15) {
      throw new Error('WhatsApp number too long');
    }

    return true;
  }

  // Get provider-specific settings validation
  getProviderRequiredFields(provider) {
    switch (provider) {
      case 'twilio':
        return ['accountSid', 'authToken', 'fromNumber'];
      case 'meta':
        return ['accessToken', 'phoneNumberId'];
      case 'dialog360':
        return ['apiKey'];
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

  // Get WhatsApp message character limits
  getMessageLimits() {
    return {
      textMessage: 4096,      // Maximum characters for text message
      templateMessage: 1024,   // Maximum characters for template message
      mediaCaption: 1024      // Maximum characters for media caption
    };
  }

  // Validate message length
  validateMessageLength(message, type = 'text') {
    const limits = this.getMessageLimits();
    const limit = limits[type + 'Message'] || limits.textMessage;

    if (message.length > limit) {
      throw new Error(`Message too long. Maximum ${limit} characters allowed for ${type} messages.`);
    }

    return true;
  }

  // Get estimated cost (varies by provider and region)
  getEstimatedCost(messageCount, provider, country = 'IN') {
    // Approximate costs in USD (rates vary significantly by provider and country)
    const rates = {
      twilio: {
        IN: 0.0075,   // $0.0075 per message to India
        US: 0.005,    // $0.005 per message to US
        GB: 0.009,    // $0.009 per message to UK
        default: 0.01
      },
      meta: {
        IN: 0.004,    // Meta's rates are generally lower
        US: 0.0035,
        GB: 0.006,
        default: 0.008
      },
      dialog360: {
        IN: 0.005,    // 360Dialog competitive rates
        US: 0.004,
        GB: 0.007,
        default: 0.009
      }
    };

    const providerRates = rates[provider] || rates.twilio;
    const rate = providerRates[country] || providerRates.default;

    return {
      messageCount,
      costPerMessage: rate,
      totalCost: (messageCount * rate).toFixed(4),
      currency: 'USD',
      note: 'Rates are approximate and may vary. Check with your provider for exact pricing.'
    };
  }

  // Get template message status (for Meta/360Dialog)
  async getTemplateStatus(config, templateName) {
    const { provider } = config;

    switch (provider) {
      case 'meta':
        return await this.getMetaTemplateStatus(config, templateName);
      case 'dialog360':
        return await this.getDialog360TemplateStatus(config, templateName);
      default:
        throw new Error(`Template status not supported for provider: ${provider}`);
    }
  }

  // Get Meta template status
  async getMetaTemplateStatus(config, templateName) {
    const { accessToken, businessAccountId } = config.config;

    const url = `https://graph.facebook.com/v18.0/${businessAccountId}/message_templates?name=${templateName}`;

    const response = await fetch(url, {
      headers: {
        'Authorization': `Bearer ${accessToken}`
      }
    });

    const result = await response.json();

    if (response.ok && result.data && result.data.length > 0) {
      return {
        templateName,
        status: result.data[0].status,
        category: result.data[0].category,
        language: result.data[0].language,
        approved: result.data[0].status === 'APPROVED'
      };
    }

    return {
      templateName,
      status: 'NOT_FOUND',
      approved: false
    };
  }

  // Get 360Dialog template status
  async getDialog360TemplateStatus(config, templateName) {
    // 360Dialog template status would need to be implemented based on their API
    // This is a placeholder implementation
    return {
      templateName,
      status: 'UNKNOWN',
      approved: false,
      note: '360Dialog template status checking not implemented'
    };
  }
}

export default WhatsAppService;