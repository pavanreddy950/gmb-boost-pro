/**
 * Check all subscription statuses
 */

import dotenv from 'dotenv';
dotenv.config();

import supabaseSubscriptionService from './services/supabaseSubscriptionService.js';

async function checkSubscriptions() {
  console.log('🔍 CHECKING ALL SUBSCRIPTIONS\n');
  console.log('===============================================\n');

  try {
    await supabaseSubscriptionService.initialize();
    const subs = await supabaseSubscriptionService.getAllSubscriptions();

    console.log(`Total subscriptions: ${subs.length}\n`);

    // Count by status
    const statusCounts = {};
    subs.forEach(s => {
      statusCounts[s.status] = (statusCounts[s.status] || 0) + 1;
    });

    console.log('📊 Subscription Status Summary:');
    Object.entries(statusCounts).forEach(([status, count]) => {
      console.log(`   ${status}: ${count}`);
    });

    console.log('\n===============================================\n');
    console.log('📋 Active/Paid Subscriptions:\n');

    const activeSubs = subs.filter(s => s.status === 'active' || s.status === 'paid');

    if (activeSubs.length === 0) {
      console.log('⚠️ NO ACTIVE OR PAID SUBSCRIPTIONS FOUND!');
    } else {
      activeSubs.forEach(s => {
        console.log(`\n📧 User: ${s.email || s.gbpAccountId}`);
        console.log(`   Status: ${s.status}`);
        console.log(`   Paid Slots: ${s.paidSlots}`);
        console.log(`   Profile Count: ${s.profileCount}`);
        console.log(`   Trial End: ${s.trialEndDate || 'N/A'}`);
        console.log(`   Subscription End: ${s.subscriptionEndDate || 'N/A'}`);
        console.log(`   Created: ${s.createdAt}`);
      });
    }

    console.log('\n===============================================\n');
    console.log('📋 Trial Subscriptions:\n');

    const trialSubs = subs.filter(s => s.status === 'trial');

    if (trialSubs.length === 0) {
      console.log('⚠️ NO TRIAL SUBSCRIPTIONS FOUND!');
    } else {
      trialSubs.forEach(s => {
        const trialEndDate = s.trialEndDate ? new Date(s.trialEndDate) : null;
        const now = new Date();
        const isExpired = trialEndDate && trialEndDate <= now;

        console.log(`\n📧 User: ${s.email || s.gbpAccountId}`);
        console.log(`   Status: ${s.status} ${isExpired ? '⚠️ EXPIRED' : '✅ Active'}`);
        console.log(`   Trial End: ${s.trialEndDate || 'N/A'}`);
        console.log(`   Profile Count: ${s.profileCount}`);

        if (trialEndDate) {
          const daysLeft = Math.ceil((trialEndDate - now) / (1000 * 60 * 60 * 24));
          console.log(`   Days ${isExpired ? 'expired' : 'remaining'}: ${Math.abs(daysLeft)}`);
        }
      });
    }

    console.log('\n===============================================\n');
    console.log('📋 Expired Subscriptions:\n');

    const expiredSubs = subs.filter(s => s.status === 'expired');

    console.log(`Total expired: ${expiredSubs.length}`);
    if (expiredSubs.length > 0) {
      expiredSubs.forEach(s => {
        console.log(`\n📧 User: ${s.email || s.gbpAccountId}`);
        console.log(`   Status: ${s.status}`);
        console.log(`   Last Active: ${s.subscriptionEndDate || s.trialEndDate || 'N/A'}`);
      });
    }

    console.log('\n===============================================');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkSubscriptions();
