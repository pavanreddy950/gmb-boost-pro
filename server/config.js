import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Get __dirname equivalent for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Configuration manager for switching between local and Azure environments
 */
class Config {
  constructor() {
    this.loadConfiguration();
  }

  loadConfiguration() {
    // Determine which config to load based on RUN_MODE or NODE_ENV
    const runMode = process.env.RUN_MODE;
    let envFile = '.env.local'; // Default to local

    // Force Azure mode if running in production or if RUN_MODE is AZURE
    if (runMode === 'AZURE' || process.env.NODE_ENV === 'production') {
      envFile = '.env.azure';
      // Set RUN_MODE to AZURE if not already set
      if (!process.env.RUN_MODE) {
        process.env.RUN_MODE = 'AZURE';
      }
    }

    // Load the appropriate .env file
    const envPath = path.join(__dirname, envFile);
    const result = dotenv.config({ path: envPath });
    
    if (result.error) {
      console.warn(`⚠️ Could not load ${envFile}, falling back to default environment variables`);
      // Try loading the other config as fallback
      const fallbackFile = envFile === '.env.local' ? '.env.azure' : '.env.local';
      const fallbackPath = path.join(__dirname, fallbackFile);
      dotenv.config({ path: fallbackPath });
    } else {
      console.log(`✅ Loaded configuration from ${envFile}`);
    }

    this.validateConfiguration();
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
        console.error(`\n🔧 AZURE DEPLOYMENT CONFIGURATION REQUIRED:`);
        console.error(`Set the following environment variables in your Azure Container/App Service:`);
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
        
        console.error(`\n🚀 Azure Configuration Steps:`);
        console.error(`1. Go to Azure Portal > Container Apps/App Service`);
        console.error(`2. Navigate to Configuration > Environment Variables`);
        console.error(`3. Add each environment variable listed above`);
        console.error(`4. Restart the container/app service`);
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
      'FRONTEND_URL': 'https://your-frontend-url.azurestaticapps.net',
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
    return process.env.RUN_MODE === 'LOCAL' || this.isDevelopment;
  }

  get isAzure() {
    return process.env.RUN_MODE === 'AZURE' || this.isProduction;
  }

  get frontendUrl() {
    // Use Azure frontend URL if in production mode
    if (process.env.NODE_ENV === 'production') {
      return process.env.FRONTEND_URL || 'https://delightful-sea-062191a0f.2.azurestaticapps.net';
    }
    return process.env.FRONTEND_URL || 'http://localhost:3000';
  }

  get backendUrl() {
    return process.env.BACKEND_URL || `http://localhost:${this.port}`;
  }

  get googleRedirectUri() {
    return process.env.GOOGLE_REDIRECT_URI || `${this.frontendUrl}/auth/google/callback`;
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

    if (this.isAzure) {
      // Azure production origins - Updated for new backend URL
      origins.push(
        'https://delightful-sea-062191a0f.2.azurestaticapps.net',
        'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net'
      );

      // Add dynamic Azure hostname if available
      if (process.env.WEBSITE_HOSTNAME) {
        origins.push(`https://${process.env.WEBSITE_HOSTNAME}`);
      }
    }

    // Always include Azure origins if running in production (fallback)
    if (process.env.NODE_ENV === 'production') {
      origins.push(
        'https://delightful-sea-062191a0f.2.azurestaticapps.net',
        'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net'
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
      mode: this.isLocal ? 'LOCAL' : 'AZURE',
      environment: process.env.NODE_ENV || 'development',
      port: this.port,
      frontendUrl: this.frontendUrl,
      backendUrl: this.backendUrl,
      redirectUri: this.googleRedirectUri,
      allowedOrigins: this.allowedOrigins,
      hasGoogleClientId: !!process.env.GOOGLE_CLIENT_ID,
      hasGoogleClientSecret: !!process.env.GOOGLE_CLIENT_SECRET,
      azureHostname: process.env.WEBSITE_HOSTNAME || 'not-detected'
    };
  }
}

// Create and export a single instance
const config = new Config();

export default config;