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
    
    if (!keyId || !keySecret) {
      console.error('WARNING: Razorpay credentials not found in environment variables!');
      console.error('Please ensure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET are set in .env file');
    }
    
    this.razorpay = new Razorpay({
      key_id: keyId || 'rzp_test_example',
      key_secret: keySecret || 'example_secret'
    });
  }

  async createOrder(amount, currency = 'INR', notes = {}) {
    try {
      // Generate a shorter receipt ID (max 40 chars)
      // Using timestamp + random string to keep it unique and short
      const timestamp = Date.now().toString(36);
      const randomStr = Math.random().toString(36).substring(2, 8);
      const receipt = `rcpt_${timestamp}_${randomStr}`;
      
      const options = {
        amount: amount * 100, // Amount in paise
        currency,
        receipt,
        notes
      };

      const order = await this.razorpay.orders.create(options);
      console.log('Created Razorpay order:', order);
      return order;
    } catch (error) {
      console.error('Error creating Razorpay order:', error);
      throw error;
    }
  }

  async createSubscription(planId, customerId, notes = {}) {
    try {
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
      const customerOptions = {
        name,
        email,
        contact,
        fail_existing: 0
      };

      const customer = await this.razorpay.customers.create(customerOptions);
      console.log('Created Razorpay customer:', customer);
      return customer;
    } catch (error) {
      console.error('Error creating Razorpay customer:', error);
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
    const body = orderId + '|' + paymentId;
    const expectedSignature = crypto
      .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET || 'example_secret')
      .update(body.toString())
      .digest('hex');

    return expectedSignature === signature;
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
}

export default PaymentService;