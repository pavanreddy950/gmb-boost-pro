/**
 * Diagnose subscription validation issue
 */

import dotenv from 'dotenv';
dotenv.config();

import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';
import subscriptionGuard from './services/subscriptionGuard.js';

async function diagnose() {
  console.log('🔍 DIAGNOSING SUBSCRIPTION VALIDATION ISSUE\n');
  console.log('===============================================\n');

  try {
    await supabaseSubscriptionService.initialize();

    // Test with hello.lobaiseo@gmail.com
    const testEmail = 'hello.lobaiseo@gmail.com';
    const testUserId = 'QlJvlBBTEPSV4tb2rsYsDaxdSgd2';
    const testGbpAccountId = '106433552101751461082';

    console.log('📧 Testing subscription for:');
    console.log(`   Email: ${testEmail}`);
    console.log(`   User ID: ${testUserId}`);
    console.log(`   GBP Account ID: ${testGbpAccountId}\n`);

    console.log('===============================================\n');
    console.log('1️⃣  Getting subscription by GBP Account ID...\n');

    const subscriptionByGbp = await supabaseSubscriptionService.getSubscriptionByGbpId(testGbpAccountId);

    if (subscriptionByGbp) {
      console.log('✅ Found subscription by GBP Account ID:');
      console.log(`   ID: ${subscriptionByGbp.id}`);
      console.log(`   Email: ${subscriptionByGbp.email}`);
      console.log(`   Status: ${subscriptionByGbp.status}`);
      console.log(`   Paid Slots: ${subscriptionByGbp.paidSlots}`);
      console.log(`   Profile Count: ${subscriptionByGbp.profileCount}`);
      console.log(`   Trial End: ${subscriptionByGbp.trialEndDate}`);
      console.log(`   Subscription End: ${subscriptionByGbp.subscriptionEndDate}`);
      console.log(`   Last Payment: ${subscriptionByGbp.lastPaymentDate}\n`);

      // Check dates
      const now = new Date();
      const subEndDate = subscriptionByGbp.subscriptionEndDate ? new Date(subscriptionByGbp.subscriptionEndDate) : null;
      const trialEndDate = subscriptionByGbp.trialEndDate ? new Date(subscriptionByGbp.trialEndDate) : null;

      console.log('📅 Date validation:');
      console.log(`   Current time: ${now.toISOString()}`);
      if (subEndDate) {
        console.log(`   Subscription end: ${subEndDate.toISOString()}`);
        console.log(`   Is subscription end in future? ${subEndDate > now ? '✅ YES' : '❌ NO'}`);
        if (subEndDate > now) {
          const daysRemaining = Math.ceil((subEndDate - now) / (1000 * 60 * 60 * 24));
          console.log(`   Days remaining: ${daysRemaining}`);
        }
      } else {
        console.log(`   Subscription end: ❌ NOT SET`);
      }
      if (trialEndDate) {
        console.log(`   Trial end: ${trialEndDate.toISOString()}`);
        console.log(`   Is trial end in future? ${trialEndDate > now ? '✅ YES' : '❌ NO'}`);
      }

      console.log('\n===============================================\n');
      console.log('2️⃣  Testing subscriptionGuard.hasValidAccess...\n');

      const accessCheck = await subscriptionGuard.hasValidAccess(testUserId, testGbpAccountId);

      console.log('📊 Access check result:');
      console.log(`   Has Access: ${accessCheck.hasAccess ? '✅ YES' : '❌ NO'}`);
      console.log(`   Status: ${accessCheck.status || accessCheck.reason}`);
      console.log(`   Message: ${accessCheck.message}`);
      if (accessCheck.daysRemaining) {
        console.log(`   Days Remaining: ${accessCheck.daysRemaining}`);
      }
      if (accessCheck.requiresPayment) {
        console.log(`   Requires Payment: ⚠️  YES`);
      }
      if (accessCheck.subscription) {
        console.log(`\n   Subscription data seen by guard:`);
        console.log(`      Status: ${accessCheck.subscription.status}`);
        console.log(`      Subscription End: ${accessCheck.subscription.subscriptionEndDate}`);
        console.log(`      Trial End: ${accessCheck.subscription.trialEndDate}`);
      }

    } else {
      console.log('❌ NO SUBSCRIPTION FOUND for GBP Account ID:', testGbpAccountId);
    }

    console.log('\n===============================================\n');
    console.log('3️⃣  Getting subscription by Email...\n');

    const subscriptionByEmail = await supabaseSubscriptionService.getSubscriptionByEmail(testEmail);

    if (subscriptionByEmail) {
      console.log('✅ Found subscription by Email:');
      console.log(`   ID: ${subscriptionByEmail.id}`);
      console.log(`   GBP Account ID: ${subscriptionByEmail.gbpAccountId}`);
      console.log(`   Status: ${subscriptionByEmail.status}`);
      console.log(`   Paid Slots: ${subscriptionByEmail.paidSlots}`);
      console.log(`   Profile Count: ${subscriptionByEmail.profileCount}\n`);

      if (subscriptionByEmail.gbpAccountId !== testGbpAccountId) {
        console.log('⚠️  WARNING: GBP Account ID MISMATCH!');
        console.log(`   Expected: ${testGbpAccountId}`);
        console.log(`   Got: ${subscriptionByEmail.gbpAccountId}\n`);
      }
    } else {
      console.log('❌ NO SUBSCRIPTION FOUND for email:', testEmail);
    }

    console.log('\n===============================================\n');
    console.log('4️⃣  Checking payment history...\n');

    if (subscriptionByGbp) {
      const paymentHistory = subscriptionByGbp.paymentHistory || [];
      console.log(`Total payments: ${paymentHistory.length}\n`);

      if (paymentHistory.length > 0) {
        paymentHistory.slice(0, 5).forEach((payment, index) => {
          console.log(`Payment ${index + 1}:`);
          console.log(`   Amount: ${payment.currency} ${payment.amount}`);
          console.log(`   Status: ${payment.status}`);
          console.log(`   Description: ${payment.description || 'N/A'}`);
          console.log(`   Date: ${payment.paidAt || payment.createdAt}`);
          console.log('');
        });
      } else {
        console.log('⚠️  No payment history found!');
      }
    }

    console.log('===============================================');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

diagnose();
