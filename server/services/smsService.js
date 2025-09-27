import twilio from 'twilio';
import AWS from 'aws-sdk';
import fetch from 'node-fetch';

class SMSService {
  constructor() {
    this.clients = new Map();
  }

  // Create SMS client based on provider
  async createClient(config) {
    const { provider, config: providerConfig } = config;

    switch (provider) {
      case 'twilio':
        return this.createTwilioClient(providerConfig);
      case 'textlocal':
        return this.createTextLocalClient(providerConfig);
      case 'aws_sns':
        return this.createAWSSNSClient(providerConfig);
      case 'vonage':
        return this.createVonageClient(providerConfig);
      default:
        throw new Error(`Unsupported SMS provider: ${provider}`);
    }
  }

  // Twilio SMS client
  createTwilioClient(config) {
    const { accountSid, authToken, fromNumber } = config;

    return {
      provider: 'twilio',
      client: twilio(accountSid, authToken),
      fromNumber
    };
  }

  // TextLocal SMS client (India focused)
  createTextLocalClient(config) {
    const { apiKey, senderId } = config;

    return {
      provider: 'textlocal',
      apiKey,
      senderId,
      baseUrl: 'https://api.textlocal.in/send/'
    };
  }

  // AWS SNS SMS client
  createAWSSNSClient(config) {
    const { accessKeyId, secretAccessKey, region } = config;

    AWS.config.update({
      accessKeyId,
      secretAccessKey,
      region: region || 'us-east-1'
    });

    return {
      provider: 'aws_sns',
      sns: new AWS.SNS({ apiVersion: '2010-03-31' })
    };
  }

  // Vonage (formerly Nexmo) SMS client
  createVonageClient(config) {
    const { apiKey, apiSecret, fromNumber } = config;

    return {
      provider: 'vonage',
      apiKey,
      apiSecret,
      fromNumber,
      baseUrl: 'https://rest.nexmo.com/sms/json'
    };
  }

  // Send SMS using the appropriate provider
  async sendSMS(config, smsData) {
    const client = await this.createClient(config);
    const { provider } = config;

    try {
      switch (provider) {
        case 'twilio':
          return await this.sendWithTwilio(client, smsData);
        case 'textlocal':
          return await this.sendWithTextLocal(client, smsData);
        case 'aws_sns':
          return await this.sendWithAWSSNS(client, smsData);
        case 'vonage':
          return await this.sendWithVonage(client, smsData);
        default:
          throw new Error(`Unsupported provider: ${provider}`);
      }
    } catch (error) {
      console.error(`[SMSService] Failed to send SMS via ${provider}:`, error);
      throw error;
    }
  }

  // Send with Twilio
  async sendWithTwilio(client, smsData) {
    const { to, message } = smsData;
    const { client: twilioClient, fromNumber } = client;

    const result = await twilioClient.messages.create({
      body: message,
      from: fromNumber,
      to: this.formatPhoneNumber(to)
    });

    return {
      success: true,
      messageId: result.sid,
      provider: 'twilio',
      status: result.status
    };
  }

  // Send with TextLocal
  async sendWithTextLocal(client, smsData) {
    const { to, message } = smsData;
    const { apiKey, senderId, baseUrl } = client;

    const params = new URLSearchParams({
      apikey: apiKey,
      numbers: this.formatPhoneNumberForTextLocal(to),
      message: message,
      sender: senderId
    });

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const result = await response.json();

    if (result.status === 'success') {
      return {
        success: true,
        messageId: result.messages[0].id,
        provider: 'textlocal',
        status: 'sent'
      };
    } else {
      throw new Error(`TextLocal API error: ${result.errors[0].message}`);
    }
  }

  // Send with AWS SNS
  async sendWithAWSSNS(client, smsData) {
    const { to, message } = smsData;
    const { sns } = client;

    const params = {
      Message: message,
      PhoneNumber: this.formatPhoneNumber(to),
      MessageAttributes: {
        'AWS.SNS.SMS.SMSType': {
          DataType: 'String',
          StringValue: 'Transactional'
        }
      }
    };

    const result = await sns.publish(params).promise();

    return {
      success: true,
      messageId: result.MessageId,
      provider: 'aws_sns',
      status: 'sent'
    };
  }

  // Send with Vonage
  async sendWithVonage(client, smsData) {
    const { to, message } = smsData;
    const { apiKey, apiSecret, fromNumber, baseUrl } = client;

    const params = new URLSearchParams({
      api_key: apiKey,
      api_secret: apiSecret,
      to: this.formatPhoneNumber(to),
      from: fromNumber,
      text: message
    });

    const response = await fetch(baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded'
      },
      body: params
    });

    const result = await response.json();

    if (result.messages[0].status === '0') {
      return {
        success: true,
        messageId: result.messages[0]['message-id'],
        provider: 'vonage',
        status: 'sent'
      };
    } else {
      throw new Error(`Vonage API error: ${result.messages[0]['error-text']}`);
    }
  }

  // Generate review request SMS template
  generateReviewRequestSMS(customerData, businessData, reviewUrl) {
    const { customerName, businessName } = customerData;

    // Keep SMS short due to character limits
    const message = `Hi ${customerName}! Thanks for choosing ${businessName}. Please share your experience: ${reviewUrl}

Your feedback helps us improve!

- ${businessName} Team`;

    return message;
  }

  // Send review request SMS
  async sendReviewRequest(config, customerData, businessData, reviewUrl) {
    const message = this.generateReviewRequestSMS(customerData, businessData, reviewUrl);

    const smsData = {
      to: customerData.phone,
      message
    };

    return await this.sendSMS(config, smsData);
  }

  // Send bulk review requests via SMS
  async sendBulkReviewRequests(config, customers, businessData, reviewUrl, onProgress = null) {
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
        }, businessData, reviewUrl);

        results.push({
          customer: customer.name,
          phone: customer.phone,
          success: true,
          messageId: result.messageId,
          provider: result.provider
        });

        console.log(`[SMSService] Review request sent to ${customer.phone}`);
      } catch (error) {
        results.push({
          customer: customer.name,
          phone: customer.phone,
          success: false,
          error: error.message
        });

        console.error(`[SMSService] Failed to send to ${customer.phone}:`, error.message);
      }

      processed++;
      if (onProgress) {
        onProgress({
          processed,
          total: customersWithPhone.length,
          percentage: Math.round((processed / customersWithPhone.length) * 100)
        });
      }

      // Rate limiting - wait 1 second between SMS messages
      await new Promise(resolve => setTimeout(resolve, 1000));
    }

    return {
      total: customersWithPhone.length,
      successful: results.filter(r => r.success).length,
      failed: results.filter(r => !r.success).length,
      results
    };
  }

  // Test SMS configuration
  async testConfiguration(config, testPhone) {
    const testMessage = 'Test SMS - Your SMS configuration is working correctly!';

    const smsData = {
      to: testPhone,
      message: testMessage
    };

    return await this.sendSMS(config, smsData);
  }

  // Format phone number for international format
  formatPhoneNumber(phone) {
    // Remove all non-numeric characters
    let cleaned = phone.replace(/\D/g, '');

    // Add country code if not present
    if (!cleaned.startsWith('+')) {
      // Default to India (+91) if no country code
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

  // Format phone number specifically for TextLocal (Indian format)
  formatPhoneNumberForTextLocal(phone) {
    let cleaned = phone.replace(/\D/g, '');

    // TextLocal expects 10-digit Indian numbers
    if (cleaned.startsWith('91') && cleaned.length === 12) {
      cleaned = cleaned.substring(2);
    } else if (cleaned.startsWith('+91')) {
      cleaned = cleaned.substring(3);
    }

    return cleaned;
  }

  // Validate phone number
  validatePhoneNumber(phone) {
    const cleaned = phone.replace(/\D/g, '');

    // Should be at least 10 digits for most countries
    if (cleaned.length < 10) {
      throw new Error('Phone number too short');
    }

    // Should not be more than 15 digits (international standard)
    if (cleaned.length > 15) {
      throw new Error('Phone number too long');
    }

    return true;
  }

  // Get provider-specific settings validation
  getProviderRequiredFields(provider) {
    switch (provider) {
      case 'twilio':
        return ['accountSid', 'authToken', 'fromNumber'];
      case 'textlocal':
        return ['apiKey', 'senderId'];
      case 'aws_sns':
        return ['accessKeyId', 'secretAccessKey'];
      case 'vonage':
        return ['apiKey', 'apiSecret', 'fromNumber'];
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

  // Get SMS character count and parts
  getMessageInfo(message) {
    const length = message.length;
    let parts = 1;
    let maxLength = 160;

    // Check if message contains Unicode characters
    const isUnicode = /[^\x00-\x7F]/.test(message);

    if (isUnicode) {
      maxLength = 70;
    }

    if (length > maxLength) {
      parts = Math.ceil(length / maxLength);
    }

    return {
      length,
      parts,
      maxLength,
      isUnicode,
      remaining: maxLength - (length % maxLength)
    };
  }

  // Get estimated cost (this would depend on provider rates)
  getEstimatedCost(messageCount, provider, country = 'IN') {
    // Approximate costs in USD (rates vary by provider and country)
    const rates = {
      twilio: {
        IN: 0.00581,  // $0.00581 per SMS to India
        US: 0.0075,   // $0.0075 per SMS to US
        GB: 0.04,     // $0.04 per SMS to UK
        default: 0.05
      },
      textlocal: {
        IN: 0.005,    // Approx $0.005 per SMS in India
        default: 0.01
      },
      aws_sns: {
        US: 0.00645,  // $0.00645 per SMS in US
        IN: 0.00581,  // $0.00581 per SMS to India
        default: 0.05
      },
      vonage: {
        IN: 0.0057,   // $0.0057 per SMS to India
        US: 0.0075,   // $0.0075 per SMS to US
        default: 0.05
      }
    };

    const providerRates = rates[provider] || rates.twilio;
    const rate = providerRates[country] || providerRates.default;

    return {
      messageCount,
      costPerMessage: rate,
      totalCost: (messageCount * rate).toFixed(4),
      currency: 'USD'
    };
  }
}

export default SMSService;