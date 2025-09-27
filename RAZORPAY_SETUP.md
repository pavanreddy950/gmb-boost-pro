# Razorpay Payment Integration Setup Guide

## ✅ What's Already Implemented

### 1. **Coupon Code System**
The payment system includes a coupon validation feature. 
For internal testing purposes only, use the hidden code: **RAJATEST** (pays ₹1 only)
Note: This code is not visible to end users.

### 2. **Payment Features**
- ✅ Razorpay order creation
- ✅ Coupon validation and application
- ✅ Payment verification
- ✅ Subscription management
- ✅ Trial period handling (15 days)

## 🔧 Razorpay Dashboard Setup

### Step 1: Configure Webhook URL

1. **Login to Razorpay Dashboard**
   - Go to [https://dashboard.razorpay.com](https://dashboard.razorpay.com)
   - Navigate to **Settings → Webhooks**

2. **Add New Webhook**
   - Click on **"+ Add New Webhook"**
   - Enter webhook details:

   **For Local Testing (using ngrok):**
   ```
   URL: https://your-ngrok-url.ngrok.io/api/payment/webhook
   ```

   **For Production:**
   ```
   URL: https://your-domain.com/api/payment/webhook
   ```

3. **Select Events to Track**
   Select these essential events:
   - ✅ `payment.captured` - When payment is successful
   - ✅ `payment.failed` - When payment fails
   - ✅ `subscription.activated` - When subscription starts
   - ✅ `subscription.completed` - When subscription ends
   - ✅ `subscription.cancelled` - When user cancels
   - ✅ `subscription.paused` - When subscription is paused
   - ✅ `subscription.resumed` - When subscription resumes

4. **Get Webhook Secret**
   - After creating the webhook, you'll get a **Webhook Secret**
   - Copy this secret

### Step 2: Update Environment Variables

Add the webhook secret to your backend `.env` file:

```env
# server/.env
RAZORPAY_WEBHOOK_SECRET=your_webhook_secret_from_dashboard
```

## 🧪 Testing Payments

### Option 1: Test with Internal Coupon (For Admin Use Only)

1. Open the payment modal
2. Select any plan
3. Enter coupon code: **RAJATEST**
4. Click "Apply"
5. The amount will show ₹1 (minimum for Razorpay)
6. Complete payment with test card

### Option 2: Use Razorpay Test Cards

**Test Card Details:**
- Card Number: `4111 1111 1111 1111`
- Expiry: Any future date (e.g., 12/25)
- CVV: Any 3 digits (e.g., 123)
- Name: Any name
- Phone: Any 10 digit number

**Other Test Cards:**
- Success: `5267 3181 8797 5449`
- Failure: `4000 0000 0000 0002`
- International: `4012 8888 8888 1881`

### Option 3: Test Different Scenarios

1. **Successful Payment with Internal Test:**
   - Use RAJATEST coupon (internal only)
   - Pay ₹1 with test card

2. **Full Payment Test:**
   - Don't use any coupon
   - Pay full amount with test card

## 📱 Local Testing with ngrok

To test webhooks locally:

1. **Install ngrok:**
   ```bash
   npm install -g ngrok
   ```

2. **Start your backend server:**
   ```bash
   cd server && npm run dev
   ```

3. **Expose local server:**
   ```bash
   ngrok http 5000
   ```

4. **Use ngrok URL in Razorpay:**
   - Copy the HTTPS URL from ngrok (e.g., `https://abc123.ngrok.io`)
   - Add to Razorpay webhook: `https://abc123.ngrok.io/api/payment/webhook`

## 🔍 Webhook Event Flow

When a payment is made:

1. **Order Creation:**
   - User selects plan
   - Applies coupon (optional)
   - Backend creates Razorpay order

2. **Payment Processing:**
   - User completes payment
   - Razorpay sends `payment.captured` webhook

3. **Subscription Activation:**
   - Backend receives webhook
   - Updates subscription status
   - User gets instant access

## 🚀 Production Checklist

Before going live:

- [ ] Change from TEST to LIVE keys in Razorpay
- [ ] Update `.env` with LIVE credentials
- [ ] Configure production webhook URL
- [ ] Remove or restrict test coupons
- [ ] Set up proper database for subscriptions
- [ ] Implement proper error logging
- [ ] Test with real payment
- [ ] Set up SSL certificate (HTTPS)

## 🛠️ Troubleshooting

### Payment Fails with "Failed to create order"
- Check if backend server is running on port 5000
- Verify Razorpay credentials in `.env`

### Webhook Not Receiving Events
- Check webhook URL in Razorpay dashboard
- Verify webhook secret in `.env`
- Check server logs for webhook hits

### Coupon Not Working
- Ensure backend has restarted after changes
- Check browser console for errors
- Verify coupon code is in UPPERCASE

## 📝 Current Configuration

Your current Razorpay setup:
- **Mode**: LIVE (Be careful!)
- **Key ID**: `rzp_live_RFSzT9EvJ2cwJI`
- **Backend Port**: 5000
- **Frontend Port**: 3000

## 💡 Tips

1. **For internal testing use RAJATEST** - Pay only ₹1 (not visible to users)
2. **Monitor server logs** - Check for payment events
3. **Use browser DevTools** - Watch network requests
4. **Check Razorpay Dashboard** - View payment status

## 📞 Support

- **Razorpay Support**: [https://razorpay.com/support](https://razorpay.com/support)
- **API Documentation**: [https://razorpay.com/docs/api](https://razorpay.com/docs/api)
- **Webhook Guide**: [https://razorpay.com/docs/webhooks](https://razorpay.com/docs/webhooks)

---

**Note:** You're using LIVE Razorpay credentials. Always test with small amounts or test coupons first!