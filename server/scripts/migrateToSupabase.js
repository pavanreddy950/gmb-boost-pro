/**
 * Data Migration Script - JSON Files to Supabase
 * Migrates all existing data from JSON files to Supabase PostgreSQL
 * 
 * Usage: node scripts/migrateToSupabase.js
 */

import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import supabaseConfig from '../config/supabase.js';

// Load environment variables from .env.local
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const envPath = path.join(__dirname, '../.env.local');
const dataDir = path.join(__dirname, '../data');

dotenv.config({ path: envPath });
console.log('✅ Loaded environment from .env.local\n');

class DataMigrator {
  constructor() {
    this.client = null;
    this.results = {
      subscriptions: { success: 0, failed: 0, errors: [] },
      paymentHistory: { success: 0, failed: 0, errors: [] },
      userGbpMapping: { success: 0, failed: 0, errors: [] },
      auditLogs: { success: 0, failed: 0, errors: [] },
      auditResults: { success: 0, failed: 0, errors: [] },
      automationSettings: { success: 0, failed: 0, errors: [] },
      automationLogs: { success: 0, failed: 0, errors: [] },
      qrCodes: { success: 0, failed: 0, errors: [] },
      coupons: { success: 0, failed: 0, errors: [] }
    };
  }

  async initialize() {
    console.log('🚀 Initializing Data Migration to Supabase...\n');
    
    try {
      this.client = await supabaseConfig.ensureInitialized();
      console.log('✅ Supabase connection established\n');
      return true;
    } catch (error) {
      console.error('❌ Failed to connect to Supabase:', error.message);
      console.error('\n💡 Make sure you have set SUPABASE_URL and SUPABASE_SERVICE_KEY in .env.local');
      return false;
    }
  }

  loadJsonFile(filename) {
    try {
      const filePath = path.join(dataDir, filename);
      if (!fs.existsSync(filePath)) {
        console.warn(`⚠️  File not found: ${filename}`);
        return null;
      }

      const data = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`❌ Error loading ${filename}:`, error.message);
      return null;
    }
  }

  async migrateSubscriptions() {
    console.log('📦 Migrating Subscriptions...');
    
    const data = this.loadJsonFile('subscriptions.json');
    if (!data || !data.subscriptions) {
      console.log('   No subscriptions to migrate\n');
      return;
    }

    const subscriptions = Object.values(data.subscriptions);
    
    for (const sub of subscriptions) {
      try {
        // Extract payment history for separate table
        const paymentHistory = sub.paymentHistory || [];
        delete sub.paymentHistory; // Remove from subscription object

        // Insert subscription
        const { error: subError } = await this.client
          .from('subscriptions')
          .upsert({
            id: sub.id,
            user_id: sub.userId,
            gbp_account_id: sub.gbpAccountId,
            email: sub.email,
            status: sub.status,
            plan_id: sub.planId,
            profile_count: sub.profileCount || 0,
            trial_start_date: sub.trialStartDate,
            trial_end_date: sub.trialEndDate,
            subscription_start_date: sub.subscriptionStartDate,
            subscription_end_date: sub.subscriptionEndDate,
            last_payment_date: sub.lastPaymentDate,
            razorpay_payment_id: sub.razorpayPaymentId,
            razorpay_order_id: sub.razorpayOrderId,
            amount: sub.amount,
            currency: sub.currency,
            paid_at: sub.paidAt,
            cancelled_at: sub.cancelledAt,
            cancelled_by: sub.cancelledBy,
            created_at: sub.createdAt,
            updated_at: sub.updatedAt
          });

        if (subError) {
          this.results.subscriptions.failed++;
          this.results.subscriptions.errors.push({ id: sub.id, error: subError.message });
          console.error(`   ❌ Failed to migrate subscription ${sub.id}:`, subError.message);
        } else {
          this.results.subscriptions.success++;
          console.log(`   ✅ Migrated subscription: ${sub.id}`);

          // Migrate payment history
          await this.migratePaymentHistory(sub.id, paymentHistory);
        }
      } catch (error) {
        this.results.subscriptions.failed++;
        this.results.subscriptions.errors.push({ id: sub.id, error: error.message });
        console.error(`   ❌ Error migrating subscription ${sub.id}:`, error.message);
      }
    }

    console.log(`   Subscriptions: ${this.results.subscriptions.success} success, ${this.results.subscriptions.failed} failed\n`);
  }

  async migratePaymentHistory(subscriptionId, paymentHistory) {
    if (!paymentHistory || paymentHistory.length === 0) return;

    for (const payment of paymentHistory) {
      try {
        const { error } = await this.client
          .from('payment_history')
          .upsert({
            id: payment.id,
            subscription_id: subscriptionId,
            amount: payment.amount,
            currency: payment.currency,
            status: payment.status,
            razorpay_payment_id: payment.razorpayPaymentId,
            razorpay_order_id: payment.razorpayOrderId,
            razorpay_signature: payment.razorpaySignature,
            description: payment.description,
            paid_at: payment.paidAt,
            created_at: payment.createdAt
          });

        if (error) {
          this.results.paymentHistory.failed++;
          console.error(`     ❌ Failed to migrate payment ${payment.id}:`, error.message);
        } else {
          this.results.paymentHistory.success++;
        }
      } catch (error) {
        this.results.paymentHistory.failed++;
        console.error(`     ❌ Error migrating payment ${payment.id}:`, error.message);
      }
    }
  }

  async migrateUserGbpMapping() {
    console.log('📦 Migrating User-GBP Mappings...');
    
    const data = this.loadJsonFile('userGbpMapping.json');
    if (!data || !data.mappings) {
      console.log('   No mappings to migrate\n');
      return;
    }

    const mappings = Object.entries(data.mappings);
    
    for (const [userId, gbpAccountIds] of mappings) {
      try {
        for (const gbpAccountId of gbpAccountIds) {
          const { error } = await this.client
            .from('user_gbp_mapping')
            .upsert({
              user_id: userId,
              gbp_account_id: gbpAccountId
            }, {
              onConflict: 'user_id, gbp_account_id'
            });

          if (error) {
            this.results.userGbpMapping.failed++;
            console.error(`   ❌ Failed to migrate mapping ${userId} -> ${gbpAccountId}:`, error.message);
          } else {
            this.results.userGbpMapping.success++;
          }
        }
      } catch (error) {
        this.results.userGbpMapping.failed++;
        console.error(`   ❌ Error migrating mapping for ${userId}:`, error.message);
      }
    }

    console.log(`   Mappings: ${this.results.userGbpMapping.success} success, ${this.results.userGbpMapping.failed} failed\n`);
  }

  async migrateQRCodes() {
    console.log('📦 Migrating QR Codes...');
    
    const data = this.loadJsonFile('qrCodes.json');
    if (!data || !data.codes) {
      console.log('   No QR codes to migrate\n');
      return;
    }

    const codes = Object.values(data.codes);
    
    for (const code of codes) {
      try {
        const { error } = await this.client
          .from('qr_codes')
          .upsert({
            code: code.code,
            location_id: code.locationId,
            user_id: code.userId,
            place_id: code.placeId,
            qr_data_url: code.qrDataUrl,
            review_link: code.reviewLink,
            scans: code.scans || 0,
            last_scanned_at: code.lastScannedAt,
            created_at: code.createdAt
          }, {
            onConflict: 'code'
          });

        if (error) {
          this.results.qrCodes.failed++;
          console.error(`   ❌ Failed to migrate QR code ${code.code}:`, error.message);
        } else {
          this.results.qrCodes.success++;
        }
      } catch (error) {
        this.results.qrCodes.failed++;
        console.error(`   ❌ Error migrating QR code:`, error.message);
      }
    }

    console.log(`   QR Codes: ${this.results.qrCodes.success} success, ${this.results.qrCodes.failed} failed\n`);
  }

  async migrateCoupons() {
    console.log('📦 Migrating Coupons...');
    
    const data = this.loadJsonFile('coupons.json');
    if (!data || !data.coupons) {
      console.log('   No coupons to migrate\n');
      return;
    }

    const coupons = Object.values(data.coupons);
    
    for (const coupon of coupons) {
      try {
        const { error } = await this.client
          .from('coupons')
          .upsert({
            code: coupon.code,
            discount_type: coupon.discountType,
            discount_value: coupon.discountValue,
            max_uses: coupon.maxUses,
            used_count: coupon.usedCount || 0,
            valid_from: coupon.validFrom,
            valid_until: coupon.validUntil,
            applicable_plans: coupon.applicablePlans || [],
            is_active: coupon.isActive !== false,
            single_use: coupon.singleUse || false,
            created_by: coupon.createdBy,
            created_at: coupon.createdAt,
            updated_at: coupon.updatedAt
          }, {
            onConflict: 'code'
          });

        if (error) {
          this.results.coupons.failed++;
          console.error(`   ❌ Failed to migrate coupon ${coupon.code}:`, error.message);
        } else {
          this.results.coupons.success++;
        }
      } catch (error) {
        this.results.coupons.failed++;
        console.error(`   ❌ Error migrating coupon:`, error.message);
      }
    }

    console.log(`   Coupons: ${this.results.coupons.success} success, ${this.results.coupons.failed} failed\n`);
  }

  printSummary() {
    console.log('\n📊 Migration Summary:');
    console.log('═══════════════════════════════════════════');
    
    let totalSuccess = 0;
    let totalFailed = 0;

    for (const [category, result] of Object.entries(this.results)) {
      if (result.success > 0 || result.failed > 0) {
        console.log(`\n${category}:`);
        console.log(`  ✅ Success: ${result.success}`);
        console.log(`  ❌ Failed:  ${result.failed}`);
        
        if (result.errors.length > 0 && result.errors.length <= 5) {
          console.log(`  Errors:`);
          result.errors.forEach(e => {
            console.log(`    - ${e.id || 'unknown'}: ${e.error}`);
          });
        }
        
        totalSuccess += result.success;
        totalFailed += result.failed;
      }
    }

    console.log('\n═══════════════════════════════════════════');
    console.log(`Total: ${totalSuccess} success, ${totalFailed} failed`);
    console.log('═══════════════════════════════════════════\n');
  }

  async migrateAutomationSettings() {
    console.log('📦 Migrating Automation Settings...');
    
    const data = this.loadJsonFile('automationSettings.json');
    if (!data || !data.automations) {
      console.log('   No automation settings to migrate\n');
      return;
    }

    const automations = Object.entries(data.automations);
    
    for (const [locationId, config] of automations) {
      try {
        if (!config.userId) continue;

        const { error } = await this.client
          .from('automation_settings')
          .upsert({
            user_id: config.userId,
            location_id: locationId,
            enabled: config.autoPosting?.enabled || config.autoReply?.enabled || false,
            auto_reply_enabled: config.autoReply?.enabled || false,
            reply_tone: config.autoReply?.tone,
            reply_language: config.autoReply?.language,
            custom_instructions: config.autoReply?.customInstructions,
            settings: config
          }, {
            onConflict: 'user_id, location_id'
          });

        if (error) {
          this.results.automationSettings.failed++;
          console.error(`   ❌ Failed to migrate automation ${locationId}:`, error.message);
        } else {
          this.results.automationSettings.success++;
        }
      } catch (error) {
        this.results.automationSettings.failed++;
        console.error(`   ❌ Error migrating automation:`, error.message);
      }
    }

    console.log(`   Automation Settings: ${this.results.automationSettings.success} success, ${this.results.automationSettings.failed} failed\n`);
  }

  async run() {
    const initialized = await this.initialize();
    if (!initialized) {
      console.error('\n❌ Migration aborted due to initialization failure\n');
      process.exit(1);
    }

    try {
      await this.migrateSubscriptions();
      await this.migrateUserGbpMapping();
      await this.migrateQRCodes();
      await this.migrateCoupons();
      await this.migrateAutomationSettings();

      this.printSummary();

      console.log('✅ Migration completed!');
      console.log('\n💡 Next steps:');
      console.log('   1. Verify data in Supabase dashboard');
      console.log('   2. Test the application thoroughly');
      console.log('   3. Once confirmed, you can backup and remove JSON files\n');

      process.exit(0);
    } catch (error) {
      console.error('\n❌ Migration failed:', error);
      process.exit(1);
    }
  }
}

// Run migration
const migrator = new DataMigrator();
migrator.run().catch(console.error);

