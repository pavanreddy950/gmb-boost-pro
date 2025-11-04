import Razorpay from 'razorpay';
import crypto from 'crypto';
import { v4 as uuidv4 } from 'uuid';

export class PaymentService {
  constructor() {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    
    console.log('Initializing Razorpay with:');
    console.log('Key ID:', keyId ? `${keyId.substring(0, 10)}...` : 'NOT SET');
    console.log('Key Secret:', keySecret ? 'SET (hidden)' : 'NOT SET');
    console.log('All environment variables:', Object.keys(process.env).filter(key => key.includes('RAZORPAY')));
    
    if (!keyId || !keySecret) {
      console.error('❌ RAZORPAY CONFIGURATION MISSING:');
      console.error('Razorpay credentials not found in environment variables!');
      
      if (process.env.NODE_ENV === 'production') {
        console.error('\n🔧 AZURE DEPLOYMENT SETUP REQUIRED:');
        console.error('Add these environment variables in Azure Container/App Service:');
        console.error('   RAZORPAY_KEY_ID=rzp_live_your-razorpay-key');
        console.error('   RAZORPAY_KEY_SECRET=your-razorpay-secret');
        console.error('   RAZORPAY_WEBHOOK_SECRET=your-webhook-secret');
        console.error('\n💡 Payment functionality will be disabled until configured.\n');
        
        // In production, don't throw error - allow app to start with limited functionality
        this.razorpay = null;
        this.isConfigured = false;
        console.warn('⚠️ PaymentService initialized in DISABLED mode (missing credentials)');
        return;
      } else {
        console.error('Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in .env file');
        throw new Error('Razorpay credentials not configured');
      }
    }
    
    this.razorpay = new Razorpay({
      key_id: keyId,
      key_secret: keySecret
    });
    
    this.isConfigured = true;
    console.log('✅ Razorpay initialized successfully');
  }

  _checkConfiguration() {
    if (!this.isConfigured || !this.razorpay) {
      const error = new Error('Payment service is not properly configured. Please check environment variables.');
      error.code = 'PAYMENT_NOT_CONFIGURED';
      throw error;
    }
  }

  async createOrder(amount, currency = 'INR', notes = {}) {
    try {
      this._checkConfiguration();
      console.log('[PaymentService] 💳 Creating order with amount:', amount, 'currency:', currency);

      // Enhanced validation
      if (!amount || isNaN(amount) || amount <= 0) {
        const error = new Error(`Invalid amount provided: ${amount}. Amount must be a positive number.`);
        error.code = 'INVALID_AMOUNT';
        throw error;
      }

      if (!currency || typeof currency !== 'string') {
        const error = new Error(`Invalid currency provided: ${currency}. Currency must be a string.`);
        error.code = 'INVALID_CURRENCY';
        throw error;
      }

      // DEVELOPMENT MODE RESTRICTION REMOVED
      // Full payment amounts are now allowed in development with live keys
      // Previous restriction capped to ₹1 for testing - now removed for production use
      
      // Generate a shorter receipt ID (max 40 chars)
      const timestamp = Date.now().toString(36);
      const randomStr = Math.random().toString(36).substring(2, 8);
      const receipt = `rcpt_${timestamp}_${randomStr}`;
      
      const options = {
        amount: Math.round(amount * 100), // Amount in paise, ensure it's an integer
        currency: currency.toUpperCase(),
        receipt,
        notes: {
          ...notes,
          created_at: new Date().toISOString(),
          service: 'GBP_Management_Platform'
        }
      };

      console.log('[PaymentService] 📋 Razorpay order options:', {
        ...options,
        notes: { service: options.notes.service, created_at: options.notes.created_at }
      });
      
      const order = await this.razorpay.orders.create(options);
      console.log('[PaymentService] ✅ Successfully created Razorpay order:', order.id);
      
      return order;
    } catch (error) {
      console.error('[PaymentService] ❌ Error creating Razorpay order:', error);
      
      // Enhanced error logging with context
      const errorContext = {
        operation: 'createOrder',
        input: { amount, currency, notes },
        timestamp: new Date().toISOString(),
        error: {
          message: error.message,
          code: error.code,
          statusCode: error.statusCode,
          name: error.constructor.name
        }
      };
      
      // Log Razorpay-specific error details
      if (error.response?.data) {
        errorContext.razorpayError = error.response.data;
      }
      
      console.error('[PaymentService] 📊 Error context:', errorContext);
      
      // Create a more user-friendly error
      if (error.code === 'INVALID_AMOUNT' || error.code === 'INVALID_CURRENCY') {
        throw error; // These are validation errors, pass them through
      }
      
      // Handle Razorpay-specific errors
      if (error.statusCode === 400) {
        const userError = new Error('Invalid payment request. Please check your payment details.');
        userError.code = 'PAYMENT_VALIDATION_ERROR';
        userError.originalError = error;
        throw userError;
      } else if (error.statusCode === 401) {
        const userError = new Error('Payment service authentication failed. Please contact support.');
        userError.code = 'PAYMENT_AUTH_ERROR';
        userError.originalError = error;
        throw userError;
      } else if (error.statusCode >= 500) {
        const userError = new Error('Payment service is temporarily unavailable. Please try again later.');
        userError.code = 'PAYMENT_SERVICE_ERROR';
        userError.originalError = error;
        throw userError;
      }
      
      // Generic error handling
      const userError = new Error('Unable to process payment request. Please try again or contact support.');
      userError.code = 'PAYMENT_PROCESSING_ERROR';
      userError.originalError = error;
      throw userError;
    }
  }

  async createSubscription(planId, customerId, notes = {}) {
    try {
      this._checkConfiguration();
      const subscriptionOptions = {
        plan_id: planId,
        customer_id: customerId,
        quantity: 1,
        total_count: 12, // For monthly plans, 12 months
        customer_notify: 1,
        start_at: Math.floor(Date.now() / 1000) + (15 * 24 * 60 * 60), // Start after 15 days trial
        notes
      };

      const subscription = await this.razorpay.subscriptions.create(subscriptionOptions);
      console.log('Created Razorpay subscription:', subscription);
      return subscription;
    } catch (error) {
      console.error('Error creating Razorpay subscription:', error);
      throw error;
    }
  }

  async createCustomer(email, name, contact) {
    try {
      this._checkConfiguration();

      const customerOptions = {
        name: name || email,
        email,
        fail_existing: 0
      };

      // Only add contact if it's a valid phone number (not empty string)
      if (contact && contact.trim() !== '') {
        customerOptions.contact = contact;
      }

      console.log('[PaymentService] Creating customer with options:', {
        name: customerOptions.name,
        email: customerOptions.email,
        hasContact: !!customerOptions.contact
      });

      const customer = await this.razorpay.customers.create(customerOptions);
      console.log('[PaymentService] ✅ Created Razorpay customer:', customer.id);
      return customer;
    } catch (error) {
      console.error('[PaymentService] ❌ Error creating Razorpay customer:', error);
      console.error('[PaymentService] Error details:', {
        message: error.message,
        description: error.description,
        statusCode: error.statusCode,
        error: error.error
      });

      // Check if customer already exists
      // Error description can be in error.description or error.error.description
      const errorMsg = error.description || error.error?.description || error.message || '';
      if (errorMsg.includes('Customer already exists') || errorMsg.includes('already exists for the merchant')) {
        console.log('[PaymentService] 🔍 Customer already exists, fetching existing customer...');
        try {
          // Fetch all customers and find by email
          const customers = await this.razorpay.customers.all();
          const existingCustomer = customers.items.find(c => c.email === email);

          if (existingCustomer) {
            console.log('[PaymentService] ✅ Found existing customer:', existingCustomer.id);
            return existingCustomer;
          } else {
            console.error('[PaymentService] ❌ Could not find existing customer by email');
            throw new Error('Customer exists but could not be retrieved');
          }
        } catch (fetchError) {
          console.error('[PaymentService] ❌ Error fetching existing customer:', fetchError);
          throw fetchError;
        }
      }

      throw error;
    }
  }

  async createPlan(name, amount, currency = 'INR', interval = 'monthly') {
    try {
      const planOptions = {
        period: interval === 'monthly' ? 'monthly' : 'yearly',
        interval: 1,
        item: {
          name,
          amount: amount * 100, // Amount in paise
          currency,
          description: `${name} subscription plan`
        },
        notes: {
          created_at: new Date().toISOString()
        }
      };

      const plan = await this.razorpay.plans.create(planOptions);
      console.log('Created Razorpay plan:', plan);
      return plan;
    } catch (error) {
      console.error('Error creating Razorpay plan:', error);
      throw error;
    }
  }

  verifyPaymentSignature(orderId, paymentId, signature) {
    try {
      console.log('[PaymentService] 🔐 Verifying payment signature...');
      
      // Validate inputs
      if (!orderId || !paymentId || !signature) {
        console.error('[PaymentService] Missing required parameters for signature verification');
        return false;
      }

      const keySecret = process.env.RAZORPAY_KEY_SECRET;
      if (!keySecret) {
        console.error('[PaymentService] RAZORPAY_KEY_SECRET not configured');
        return false;
      }

      const body = orderId + '|' + paymentId;
      const expectedSignature = crypto
        .createHmac('sha256', keySecret)
        .update(body.toString())
        .digest('hex');

      const isValid = expectedSignature === signature;
      
      if (isValid) {
        console.log('[PaymentService] ✅ Payment signature verification successful');
      } else {
        console.error('[PaymentService] ❌ Payment signature verification failed');
        console.error('[PaymentService] Expected vs Received:', {
          expected: expectedSignature.substring(0, 10) + '...',
          received: signature.substring(0, 10) + '...'
        });
      }

      return isValid;
    } catch (error) {
      console.error('[PaymentService] Error during signature verification:', error);
      return false;
    }
  }

  verifyWebhookSignature(body, signature) {
    const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET || 'webhook_secret';
    const expectedSignature = crypto
      .createHmac('sha256', webhookSecret)
      .update(JSON.stringify(body))
      .digest('hex');

    return expectedSignature === signature;
  }

  async getPayment(paymentId) {
    try {
      const payment = await this.razorpay.payments.fetch(paymentId);
      return payment;
    } catch (error) {
      console.error('Error fetching payment:', error);
      throw error;
    }
  }

  async getOrder(orderId) {
    try {
      this._checkConfiguration();
      const order = await this.razorpay.orders.fetch(orderId);
      return order;
    } catch (error) {
      console.error('Error fetching order:', error);
      throw error;
    }
  }

  async getSubscription(subscriptionId) {
    try {
      const subscription = await this.razorpay.subscriptions.fetch(subscriptionId);
      return subscription;
    } catch (error) {
      console.error('Error fetching subscription:', error);
      throw error;
    }
  }

  async cancelSubscription(subscriptionId, cancelAtCycleEnd = true) {
    try {
      const options = {
        cancel_at_cycle_end: cancelAtCycleEnd
      };
      
      const result = await this.razorpay.subscriptions.cancel(subscriptionId, options);
      console.log('Cancelled subscription:', result);
      return result;
    } catch (error) {
      console.error('Error cancelling subscription:', error);
      throw error;
    }
  }

  async refundPayment(paymentId, amount = null, notes = {}) {
    try {
      const options = {
        ...(amount && { amount: amount * 100 }), // Partial refund if amount specified
        notes
      };

      const refund = await this.razorpay.payments.refund(paymentId, options);
      console.log('Created refund:', refund);
      return refund;
    } catch (error) {
      console.error('Error creating refund:', error);
      throw error;
    }
  }

  async getAllInvoices(customerId = null, subscriptionId = null) {
    try {
      const options = {};
      if (customerId) options.customer_id = customerId;
      if (subscriptionId) options.subscription_id = subscriptionId;

      const invoices = await this.razorpay.invoices.all(options);
      return invoices;
    } catch (error) {
      console.error('Error fetching invoices:', error);
      throw error;
    }
  }

  async fetchPaymentDetails(paymentId) {
    try {
      this._checkConfiguration();
      console.log('[PaymentService] Fetching payment details for:', paymentId);

      const payment = await this.razorpay.payments.fetch(paymentId);
      console.log('[PaymentService] Payment details fetched successfully');
      return payment;
    } catch (error) {
      console.error('[PaymentService] Error fetching payment details:', error);
      throw error;
    }
  }

  async createToken(customerId, method, notes = {}) {
    try {
      this._checkConfiguration();
      console.log('[PaymentService] Creating token for customer:', customerId);

      const tokenData = {
        customer_id: customerId,
        method,
        notes
      };

      const token = await this.razorpay.tokens.create(tokenData);
      console.log('[PaymentService] Token created:', token.id);
      return token;
    } catch (error) {
      console.error('[PaymentService] Error creating token:', error);
      throw error;
    }
  }

  async deleteToken(tokenId, customerId) {
    try {
      this._checkConfiguration();
      console.log('[PaymentService] Deleting token:', tokenId);

      const result = await this.razorpay.tokens.delete(tokenId, customerId);
      console.log('[PaymentService] Token deleted successfully');
      return result;
    } catch (error) {
      console.error('[PaymentService] Error deleting token:', error);
      throw error;
    }
  }

  async createRecurringPayment(customerId, tokenId, amount, currency = 'INR', notes = {}) {
    try {
      this._checkConfiguration();
      console.log('[PaymentService] Creating recurring payment for customer:', customerId);

      const paymentData = {
        amount: amount,
        currency,
        customer_id: customerId,
        token: tokenId,
        notes,
        description: 'Recurring payment for subscription'
      };

      const payment = await this.razorpay.payments.createRecurring(paymentData);
      console.log('[PaymentService] Recurring payment created:', payment.id);
      return payment;
    } catch (error) {
      console.error('[PaymentService] Error creating recurring payment:', error);
      throw error;
    }
  }
}

export default PaymentService;