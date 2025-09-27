import firebaseConfig from '../config/firebase.js';
import crypto from 'crypto';

class ClientConfigService {
  constructor() {
    this.db = null;
    this.collection = 'client_configurations';
    this.encryptionKey = process.env.CLIENT_CONFIG_ENCRYPTION_KEY || 'client-config-encryption-key-change-in-production';
    this.initialized = false;
    this.initPromise = null;
  }

  async initialize() {
    if (this.initialized) {
      return this.db;
    }

    if (this.initPromise) {
      return this.initPromise;
    }

    this.initPromise = this._doInitialize();
    return this.initPromise;
  }

  async _doInitialize() {
    try {
      console.log('[ClientConfigService] Initializing Firestore connection...');
      const { db } = await firebaseConfig.ensureInitialized();
      this.db = db;
      this.initialized = true;
      console.log('[ClientConfigService] ✅ Firestore connection established');
      return this.db;
    } catch (error) {
      console.error('[ClientConfigService] ❌ Failed to initialize Firestore:', error.message);
      this.initialized = false;
      this.db = null;
      throw error;
    }
  }

  // Encrypt sensitive configuration data
  encrypt(text) {
    try {
      if (!text) return null;
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipher('aes-256-gcm', this.encryptionKey);
      cipher.setAAD(Buffer.from('client-config-data'));

      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      const authTag = cipher.getAuthTag();
      return iv.toString('hex') + ':' + authTag.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('[ClientConfigService] Encryption error:', error);
      return `UNENCRYPTED:${text}`;
    }
  }

  decrypt(encryptedText) {
    try {
      if (!encryptedText) return null;

      if (encryptedText.startsWith('UNENCRYPTED:')) {
        console.warn('[ClientConfigService] ⚠️ Reading unencrypted config');
        return encryptedText.substring(12);
      }

      const parts = encryptedText.split(':');
      if (parts.length !== 3) {
        console.error('[ClientConfigService] Invalid encrypted data format');
        return null;
      }

      const [ivHex, authTagHex, encrypted] = parts;
      const iv = Buffer.from(ivHex, 'hex');
      const authTag = Buffer.from(authTagHex, 'hex');

      const decipher = crypto.createDecipher('aes-256-gcm', this.encryptionKey);
      decipher.setAAD(Buffer.from('client-config-data'));
      decipher.setAuthTag(authTag);

      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      console.error('[ClientConfigService] Decryption error:', error);
      return null;
    }
  }

  // Save email service configuration
  async saveEmailConfig(userId, gbpAccountId, config) {
    await this.initialize();

    const configDoc = {
      userId,
      gbpAccountId,
      serviceType: 'email',
      provider: config.provider, // gmail, sendgrid, mailgun, aws_ses
      config: {
        ...config,
        // Encrypt sensitive fields
        apiKey: config.apiKey ? this.encrypt(config.apiKey) : null,
        apiSecret: config.apiSecret ? this.encrypt(config.apiSecret) : null,
        password: config.password ? this.encrypt(config.password) : null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    const docId = `${userId}_${gbpAccountId}_email`;
    await this.db.collection(this.collection).doc(docId).set(configDoc);

    console.log(`[ClientConfigService] Email config saved for user ${userId}`);
    return configDoc;
  }

  // Save SMS service configuration
  async saveSMSConfig(userId, gbpAccountId, config) {
    await this.initialize();

    const configDoc = {
      userId,
      gbpAccountId,
      serviceType: 'sms',
      provider: config.provider, // twilio, textlocal, aws_sns, vonage
      config: {
        ...config,
        // Encrypt sensitive fields
        apiKey: config.apiKey ? this.encrypt(config.apiKey) : null,
        apiSecret: config.apiSecret ? this.encrypt(config.apiSecret) : null,
        authToken: config.authToken ? this.encrypt(config.authToken) : null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    const docId = `${userId}_${gbpAccountId}_sms`;
    await this.db.collection(this.collection).doc(docId).set(configDoc);

    console.log(`[ClientConfigService] SMS config saved for user ${userId}`);
    return configDoc;
  }

  // Save WhatsApp service configuration
  async saveWhatsAppConfig(userId, gbpAccountId, config) {
    await this.initialize();

    const configDoc = {
      userId,
      gbpAccountId,
      serviceType: 'whatsapp',
      provider: config.provider, // twilio, meta, dialog360
      config: {
        ...config,
        // Encrypt sensitive fields
        apiKey: config.apiKey ? this.encrypt(config.apiKey) : null,
        apiSecret: config.apiSecret ? this.encrypt(config.apiSecret) : null,
        accessToken: config.accessToken ? this.encrypt(config.accessToken) : null,
        authToken: config.authToken ? this.encrypt(config.authToken) : null,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      isActive: true
    };

    const docId = `${userId}_${gbpAccountId}_whatsapp`;
    await this.db.collection(this.collection).doc(docId).set(configDoc);

    console.log(`[ClientConfigService] WhatsApp config saved for user ${userId}`);
    return configDoc;
  }

  // Get all configurations for a client
  async getClientConfigs(userId, gbpAccountId) {
    await this.initialize();

    try {
      const snapshot = await this.db.collection(this.collection)
        .where('userId', '==', userId)
        .where('gbpAccountId', '==', gbpAccountId)
        .where('isActive', '==', true)
        .get();

      const configs = {};
      snapshot.forEach(doc => {
        const data = doc.data();
        // Decrypt sensitive fields
        if (data.config) {
          if (data.config.apiKey) data.config.apiKey = this.decrypt(data.config.apiKey);
          if (data.config.apiSecret) data.config.apiSecret = this.decrypt(data.config.apiSecret);
          if (data.config.password) data.config.password = this.decrypt(data.config.password);
          if (data.config.authToken) data.config.authToken = this.decrypt(data.config.authToken);
          if (data.config.accessToken) data.config.accessToken = this.decrypt(data.config.accessToken);
        }
        configs[data.serviceType] = data;
      });

      return configs;
    } catch (error) {
      console.error('[ClientConfigService] Error getting client configs:', error);
      return {};
    }
  }

  // Get specific service configuration
  async getServiceConfig(userId, gbpAccountId, serviceType) {
    await this.initialize();

    try {
      const docId = `${userId}_${gbpAccountId}_${serviceType}`;
      const doc = await this.db.collection(this.collection).doc(docId).get();

      if (!doc.exists) {
        return null;
      }

      const data = doc.data();
      // Decrypt sensitive fields
      if (data.config) {
        if (data.config.apiKey) data.config.apiKey = this.decrypt(data.config.apiKey);
        if (data.config.apiSecret) data.config.apiSecret = this.decrypt(data.config.apiSecret);
        if (data.config.password) data.config.password = this.decrypt(data.config.password);
        if (data.config.authToken) data.config.authToken = this.decrypt(data.config.authToken);
        if (data.config.accessToken) data.config.accessToken = this.decrypt(data.config.accessToken);
      }

      return data;
    } catch (error) {
      console.error(`[ClientConfigService] Error getting ${serviceType} config:`, error);
      return null;
    }
  }

  // Test service configuration
  async testServiceConfig(userId, gbpAccountId, serviceType, testData = {}) {
    const config = await this.getServiceConfig(userId, gbpAccountId, serviceType);
    if (!config) {
      throw new Error(`No ${serviceType} configuration found`);
    }

    try {
      switch (serviceType) {
        case 'email':
          return await this.testEmailConfig(config, testData);
        case 'sms':
          return await this.testSMSConfig(config, testData);
        case 'whatsapp':
          return await this.testWhatsAppConfig(config, testData);
        default:
          throw new Error(`Unsupported service type: ${serviceType}`);
      }
    } catch (error) {
      console.error(`[ClientConfigService] Test failed for ${serviceType}:`, error);
      throw error;
    }
  }

  // Test email configuration
  async testEmailConfig(config, testData) {
    // This is a basic test - actual implementation would depend on the provider
    // For now, just validate that required fields are present
    const { provider, config: providerConfig } = config;

    switch (provider) {
      case 'gmail':
        if (!providerConfig.email || !providerConfig.password) {
          throw new Error('Gmail configuration requires email and password');
        }
        break;
      case 'sendgrid':
        if (!providerConfig.apiKey) {
          throw new Error('SendGrid configuration requires API key');
        }
        break;
      case 'mailgun':
        if (!providerConfig.apiKey || !providerConfig.domain) {
          throw new Error('Mailgun configuration requires API key and domain');
        }
        break;
      default:
        throw new Error(`Unsupported email provider: ${provider}`);
    }

    return { success: true, message: 'Email configuration is valid' };
  }

  // Test SMS configuration
  async testSMSConfig(config, testData) {
    const { provider, config: providerConfig } = config;

    switch (provider) {
      case 'twilio':
        if (!providerConfig.accountSid || !providerConfig.authToken) {
          throw new Error('Twilio configuration requires Account SID and Auth Token');
        }
        break;
      case 'textlocal':
        if (!providerConfig.apiKey) {
          throw new Error('TextLocal configuration requires API key');
        }
        break;
      default:
        throw new Error(`Unsupported SMS provider: ${provider}`);
    }

    return { success: true, message: 'SMS configuration is valid' };
  }

  // Test WhatsApp configuration
  async testWhatsAppConfig(config, testData) {
    const { provider, config: providerConfig } = config;

    switch (provider) {
      case 'twilio':
        if (!providerConfig.accountSid || !providerConfig.authToken) {
          throw new Error('Twilio WhatsApp configuration requires Account SID and Auth Token');
        }
        break;
      case 'meta':
        if (!providerConfig.accessToken || !providerConfig.phoneNumberId) {
          throw new Error('Meta WhatsApp configuration requires Access Token and Phone Number ID');
        }
        break;
      default:
        throw new Error(`Unsupported WhatsApp provider: ${provider}`);
    }

    return { success: true, message: 'WhatsApp configuration is valid' };
  }

  // Delete service configuration
  async deleteServiceConfig(userId, gbpAccountId, serviceType) {
    await this.initialize();

    const docId = `${userId}_${gbpAccountId}_${serviceType}`;
    await this.db.collection(this.collection).doc(docId).update({
      isActive: false,
      deletedAt: new Date().toISOString()
    });

    console.log(`[ClientConfigService] ${serviceType} config deleted for user ${userId}`);
  }
}

export default ClientConfigService;