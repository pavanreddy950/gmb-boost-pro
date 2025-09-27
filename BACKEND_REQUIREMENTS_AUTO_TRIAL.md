# Backend Requirements for Auto-Trial with Payment Method Setup

## New API Endpoints Required

### 1. Trial Setup Endpoint
**POST** `/api/payment/trial-setup`

**Request Body:**
```json
{
  "amount": 0,
  "currency": "USD",
  "notes": {
    "userId": "user123",
    "email": "user@example.com",
    "gbpAccountId": "gbp123",
    "profileCount": 2,
    "setupType": "trial_with_autopay"
  }
}
```

**Response:**
```json
{
  "order": {
    "id": "order_xyz",
    "amount": 0,
    "currency": "USD"
  }
}
```

### 2. Trial Verification Endpoint
**POST** `/api/payment/trial-verify`

**Request Body:**
```json
{
  "razorpay_order_id": "order_xyz",
  "razorpay_payment_id": "pay_abc",
  "razorpay_signature": "signature",
  "userId": "user123",
  "gbpAccountId": "gbp123",
  "profileCount": 2
}
```

**Response:**
```json
{
  "success": true,
  "subscription": {
    "id": "sub_123",
    "status": "trial",
    "trialEndDate": "2024-01-15",
    "profileCount": 2,
    "amount": 19800
  }
}
```

## Implementation Details

### Trial Setup Flow:
1. Create $0 Razorpay order for payment method collection
2. Customer enters card details (no charge)
3. Save customer ID and payment method from Razorpay
4. Create trial subscription with auto-pay enabled
5. Set trial end date (+15 days)
6. Store subscription with payment method for auto-renewal

### Auto-Pay Logic:
- When trial expires, automatically charge the stored payment method
- Use saved customer ID to create subscription
- Calculate amount based on profileCount × $99/year
- Send success/failure notifications

### Database Schema Updates:
```sql
-- Add to subscriptions table
ALTER TABLE subscriptions ADD COLUMN profile_count INTEGER DEFAULT 1;
ALTER TABLE subscriptions ADD COLUMN price_per_profile INTEGER DEFAULT 9900;
ALTER TABLE subscriptions ADD COLUMN razorpay_customer_id VARCHAR(255);
ALTER TABLE subscriptions ADD COLUMN auto_pay_enabled BOOLEAN DEFAULT false;
```

## Frontend Integration

The frontend will:
1. Show trial setup modal when GBP is connected and no subscription exists
2. Collect payment method via Razorpay (0$ authorization)
3. Create trial subscription with auto-pay enabled
4. User enjoys 15-day trial with all features
5. Auto-charge happens seamlessly at trial end

## User Experience Flow

1. **User connects GBP** → Modal appears: "Claim Your 15-Day Free Trial"
2. **User enters card details** → 0$ authorization to verify payment method
3. **Trial starts immediately** → Full access to all features
4. **14 days later** → Email reminder about upcoming charge
5. **Trial ends** → Auto-charge for calculated amount (profiles × $99)
6. **Seamless continuation** → User keeps full access without interruption

## Security & Compliance

- Use Razorpay's secure tokenization for payment methods
- Comply with PCI DSS standards
- Clear disclosure of auto-pay terms
- Easy cancellation before trial ends
- Transparent pricing calculation