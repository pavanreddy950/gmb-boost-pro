import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration manager for the application
 */
class Config {
  constructor() {
    this.loadConfiguration();
  }

  loadConfiguration() {
    // Load environment configuration
    let envFile = '.env.local'; // Default to local

    // Load the appropriate .env file
    const envPath = path.join(__dirname, envFile);
    const result = dotenv.config({ path: envPath });

    if (result.error) {
      console.warn(`⚠️ Could not load ${envFile} from ${envPath}`);
      console.warn(`⚠️ Error: ${result.error.message}`);
      console.warn(`⚠️ Relying on environment variables...`);
    } else {
      console.log(`✅ Loaded configuration from ${envFile}`);
    }

    // Set production defaults if running in production and values are missing
    if (process.env.NODE_ENV === 'production') {
      this.setProductionDefaults();
    }

    this.validateConfiguration();
  }

  setProductionDefaults() {
    console.log('🔧 [CONFIG] Setting production defaults for missing environment variables...');

    const productionDefaults = {
      NODE_ENV: 'production',
      FRONTEND_URL: 'https://app.lobaiseo.com',
      GOOGLE_REDIRECT_URI: 'https://app.lobaiseo.com/auth/google/callback',
      GOOGLE_CLIENT_ID: '52772597205-9ogv54i6sfvucse3jrqj1nl1hlkspcv1.apps.googleusercontent.com',
      GOOGLE_CLIENT_SECRET: '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',
      HARDCODED_ACCOUNT_ID: '106433552101751461082',
      RAZORPAY_KEY_ID: 'rzp_live_RFSzT9EvJ2cwJI',
      RAZORPAY_KEY_SECRET: '7i0iikfS6eO7w4DSLXldCBX5',
      AZURE_OPENAI_ENDPOINT: 'https://rajag-mjx5q079-eastus2.cognitiveservices.azure.com',
      AZURE_OPENAI_API_KEY: '7EdRCwZiy4teOevPf63fO9PCAem0uNowvpC0eCrv0llNwnM6fmRdJQQJ99CAACHYHv6XJ3w3AAAAACOGI5pT',
      AZURE_OPENAI_DEPLOYMENT: 'gpt-4o-mini-3',
      AZURE_OPENAI_API_VERSION: '2025-01-01-preview',
      FIREBASE_PROJECT_ID: 'gbp-467810-a56e2',
      RAZORPAY_WEBHOOK_SECRET: 'gmb_boost_pro_webhook_secret_2024'
    };

    let defaultsApplied = 0;
    Object.entries(productionDefaults).forEach(([key, value]) => {
      if (!process.env[key]) {
        process.env[key] = value;
        console.log(`   ✓ ${key} = ${key.includes('SECRET') || key.includes('KEY') ? '***' : value}`);
        defaultsApplied++;
      }
    });

    if (defaultsApplied > 0) {
      console.log(`✅ [CONFIG] Applied ${defaultsApplied} production default values`);
    } else {
      console.log(`✅ [CONFIG] All production values already configured via environment variables`);
    }
  }

  validateConfiguration() {
    const required = [
      'GOOGLE_CLIENT_ID',
      'GOOGLE_CLIENT_SECRET',
      'FRONTEND_URL',
      'HARDCODED_ACCOUNT_ID'
    ];

    const optional = [
      'RAZORPAY_KEY_ID',
      'RAZORPAY_KEY_SECRET',
      'AZURE_OPENAI_ENDPOINT',
      'AZURE_OPENAI_API_KEY'
    ];

    const missing = required.filter(key => !process.env[key]);
    const missingOptional = optional.filter(key => !process.env[key]);

    if (missing.length > 0) {
      console.error(`❌ CRITICAL: Missing required environment variables: ${missing.join(', ')}`);
      
      if (this.isProduction) {
        console.error(`\n🔧 DEPLOYMENT CONFIGURATION REQUIRED:`);
        console.error(`Set the following environment variables in your deployment platform:`);
        console.error(`\n📋 Required Environment Variables:`);
        missing.forEach(key => {
          const example = this.getExampleValue(key);
          console.error(`   ${key}=${example}`);
        });
        
        console.error(`\n📋 Optional but Recommended:`);
        missingOptional.forEach(key => {
          const example = this.getExampleValue(key);
          console.error(`   ${key}=${example}`);
        });
        
        console.error(`\n🚀 Configuration Steps:`);
        console.error(`1. Go to your deployment platform dashboard`);
        console.error(`2. Navigate to Environment Variables`);
        console.error(`3. Add each environment variable listed above`);
        console.error(`4. Restart the service`);
        console.error(`\n⚠️ WARNING: Application may not function correctly without required variables!\n`);
      }
    }

    if (missingOptional.length > 0 && missing.length === 0) {
      console.warn(`⚠️ Missing optional environment variables: ${missingOptional.join(', ')}`);
      console.warn(`Some features may not work correctly. Check deployment configuration.`);
    }

    // Log successful configuration
    if (missing.length === 0) {
      console.log(`✅ All required environment variables are configured`);
      if (missingOptional.length === 0) {
        console.log(`✅ All optional environment variables are configured`);
      }
    }
  }

  getExampleValue(key) {
    const examples = {
      'GOOGLE_CLIENT_ID': 'your-google-client-id.apps.googleusercontent.com',
      'GOOGLE_CLIENT_SECRET': 'GOCSPX-your-google-client-secret',
      'FRONTEND_URL': 'https://your-frontend-url.com',
      'HARDCODED_ACCOUNT_ID': '106433552101751461082',
      'RAZORPAY_KEY_ID': 'rzp_live_your-razorpay-key',
      'RAZORPAY_KEY_SECRET': 'your-razorpay-secret',
      'AZURE_OPENAI_ENDPOINT': 'https://your-openai-resource.openai.azure.com/',
      'AZURE_OPENAI_API_KEY': 'your-azure-openai-api-key'
    };
    return examples[key] || 'your-value-here';
  }

  // Getters for common configuration values
  get port() {
    return process.env.PORT || 5000;
  }

  get isProduction() {
    return process.env.NODE_ENV === 'production';
  }

  get isDevelopment() {
    return process.env.NODE_ENV === 'development';
  }

  get isLocal() {
    return this.isDevelopment;
  }

  get frontendUrl() {
    // Use Azure frontend URL if in production mode
    if (process.env.NODE_ENV === 'production') {
      return process.env.FRONTEND_URL || 'https://app.lobaiseo.com';
    }
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  get backendUrl() {
    return process.env.BACKEND_URL || `http://localhost:${this.port}`;
  }

  get googleRedirectUri() {
    return process.env.GOOGLE_REDIRECT_URI || `${this.frontendUrl}/auth/google/callback`;
  }

  get timezone() {
    // Default timezone for all scheduled tasks (IST - Indian Standard Time)
    return process.env.TIMEZONE || 'Asia/Kolkata';
  }

  get allowedOrigins() {
    const origins = [];

    if (this.isLocal) {
      // Local development origins
      origins.push(
        'http://localhost:3000',
        'http://localhost:3001',
        'http://localhost:3002',
        'http://localhost:3003',
        'http://localhost:3004',
        'http://localhost:3005',
        'http://localhost:3006',
        'http://localhost:3007',
        'http://localhost:3008',
        'http://localhost:3009'
      );
    }

    // Production origins (including custom domain)
    if (process.env.NODE_ENV === 'production') {
      origins.push(
        'https://app.lobaiseo.com',
        'https://lobaiseofrontend.onrender.com',
        'https://lobaiseo-frontend.onrender.com',
        'https://lobaiseo.onrender.com'
      );
    }

    // Always include the configured frontend URL
    origins.push(this.frontendUrl);

    // Remove duplicates and filter out empty values
    const uniqueOrigins = [...new Set(origins.filter(Boolean))];
    
    console.log(`[CONFIG] CORS Origins configured: ${uniqueOrigins.length} origins`);
    uniqueOrigins.forEach((origin, index) => {
      console.log(`[CONFIG] Origin ${index + 1}: ${origin}`);
    });

    return uniqueOrigins;
  }

  // Configuration summary for debugging
  getSummary() {
    return {
      environment: process.env.NODE_ENV || 'development',
      port: this.port,
      frontendUrl: this.frontendUrl,
      backendUrl: this.backendUrl,
      redirectUri: this.googleRedirectUri,
      allowedOrigins: this.allowedOrigins,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET
    };
  }
}

// Create and export a single instance
const config = new Config();

export default config;