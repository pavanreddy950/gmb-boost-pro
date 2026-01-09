# 🗄️ DATABASE MIGRATION GUIDE - Clean Schema

## 📋 Overview

This guide explains how to migrate from the confusing multi-table database to a **clean 2-table structure** organized by Gmail ID.

---

## 🎯 New Database Structure

### ✅ TABLE 1: **users** (Everything about the user)
Organized by **Gmail ID** as primary key

**Columns:**
- `gmail_id` (PRIMARY KEY) - User's Gmail address
- `firebase_uid` - For authentication
- `display_name` - User's name
- **SUBSCRIPTION:**
  - `subscription_status` - 'trial', 'active', 'expired', 'admin'
  - `trial_start_date`, `trial_end_date` (15 days)
  - `subscription_start_date`, `subscription_end_date`
  - `profile_count` - How many profiles user can manage
- **ADMIN:**
  - `is_admin` - TRUE only for scalepointstrategy@gmail.com
- **GOOGLE TOKENS:**
  - `google_access_token`, `google_refresh_token`
  - `google_token_expiry`, `google_account_id`
- **PAYMENT:**
  - `razorpay_order_id`, `razorpay_payment_id`
  - `amount_paid`
- `created_at`, `updated_at`

### ✅ TABLE 2: **locations** (Business locations)
Links to users via **Gmail ID**

**Columns:**
- `id` (SERIAL PRIMARY KEY)
- `gmail_id` (FOREIGN KEY → users.gmail_id)
- `location_id` - GBP location ID
- `business_name`, `address`, `category`, `keywords`
- **AUTO-POSTING:**
  - `autoposting_enabled` - TRUE/FALSE
  - `autoposting_schedule` - "10:00"
  - `autoposting_frequency` - 'daily', 'weekly'
  - `autoposting_timezone` - 'Asia/Kolkata'
  - `last_post_date`, `next_post_date`
- **AUTO-REPLY:**
  - `autoreply_enabled` - TRUE/FALSE
- `created_at`, `updated_at`

---

## 🚀 Migration Steps

### Step 1: Apply Clean Schema

1. **Go to Supabase Dashboard:**
   ```
   https://supabase.com/dashboard/project/YOUR_PROJECT_ID
   ```

2. **Open SQL Editor** (left sidebar)

3. **Copy the entire contents** of:
   ```
   server/database/CLEAN-SCHEMA.sql
   ```

4. **Paste into SQL Editor** and click **RUN**

5. **Verify tables created:**
   - Check that `users` and `locations` tables exist
   - Should see admin user: scalepointstrategy@gmail.com

---

### Step 2: Migrate Existing Data

Run the migration script:

```bash
cd server
node migrate-to-clean-schema.js
```

This will:
- Read old `automation_settings` table
- Create user records in new `users` table
- Create location records in new `locations` table
- Organize everything by Gmail ID

---

### Step 3: Update Backend Services

You'll need to update these files to use the new schema:

**Services to update:**
1. `server/services/supabaseAutomationService.js`
2. `server/services/supabaseSubscriptionService.js`
3. `server/services/supabaseTokenStorage.js`
4. `server/services/subscriptionGuard.js`

**Changes needed:**
- Query `users` table by `gmail_id` instead of `user_id`
- Query `locations` table by `gmail_id` + `location_id`
- Update subscription checks to use `users.subscription_status`
- Update token retrieval to use `users.google_access_token`

---

## 💡 Example Queries

### Get user by Gmail
```sql
SELECT * FROM users WHERE gmail_id = 'user@gmail.com';
```

### Check if user has valid access
```sql
SELECT
  gmail_id,
  subscription_status,
  CASE
    WHEN is_admin = TRUE THEN TRUE
    WHEN subscription_status = 'trial' AND trial_end_date > NOW() THEN TRUE
    WHEN subscription_status = 'active' AND subscription_end_date > NOW() THEN TRUE
    ELSE FALSE
  END as has_access
FROM users WHERE gmail_id = 'user@gmail.com';
```

### Get user's locations with auto-posting enabled
```sql
SELECT * FROM locations
WHERE gmail_id = 'user@gmail.com'
AND autoposting_enabled = TRUE;
```

### Get all locations due for next post
```sql
SELECT l.*, u.google_access_token
FROM locations l
JOIN users u ON l.gmail_id = u.gmail_id
WHERE l.autoposting_enabled = TRUE
AND l.next_post_date <= NOW()
AND (
  u.is_admin = TRUE OR
  (u.subscription_status = 'trial' AND u.trial_end_date > NOW()) OR
  (u.subscription_status = 'active' AND u.subscription_end_date > NOW())
);
```

---

## ✅ Benefits of New Schema

1. **Simple** - Only 2 tables instead of 5+
2. **Organized by Gmail** - Easy to find user data
3. **Clear flow** - Gmail → Subscription → Locations → Settings
4. **Fast queries** - Indexed on Gmail ID
5. **Easy to understand** - No confusing relationships
6. **All user data in one place** - subscription, tokens, payment in `users` table

---

## 🔧 Testing After Migration

1. **Test user lookup:**
   ```bash
   # Query users table
   SELECT * FROM users WHERE gmail_id = 'scalepointstrategy@gmail.com';
   ```

2. **Test location lookup:**
   ```bash
   # Get locations for admin
   SELECT * FROM locations WHERE gmail_id = 'scalepointstrategy@gmail.com';
   ```

3. **Test auto-posting:**
   - Check dashboard shows "Auto-post on" for enabled locations
   - Verify backend can fetch user tokens by Gmail ID
   - Test creating a post

---

## 🗑️ Cleanup (After Confirming Everything Works)

Once you've verified the new schema works, delete old tables:

```sql
DROP TABLE IF EXISTS automation_settings CASCADE;
DROP TABLE IF EXISTS automation_logs CASCADE;
DROP TABLE IF EXISTS subscriptions CASCADE;
DROP TABLE IF EXISTS user_tokens CASCADE;
DROP TABLE IF EXISTS payments CASCADE;
```

---

## 📞 Support

If you have any issues during migration:
1. Check migration script output for errors
2. Verify schema was applied correctly in Supabase
3. Test queries in SQL Editor before updating backend code

---

**Created:** 2026-01-07
**Schema Version:** 1.0 (Clean)
