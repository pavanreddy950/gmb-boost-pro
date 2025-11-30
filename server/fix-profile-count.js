import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

// ============================================
// CONFIGURATION - UPDATE THESE VALUES
// ============================================
const USER_ID = 'eWw8jjayQcSKN8uk9GLyNg49lMn2';
const GBP_ACCOUNT_ID = '104728397456701856554'; // The account found in database
const PROFILE_COUNT = 10; // Change this to the actual number you paid for
const PLAN_ID = 'per_profile_yearly';
const PLAN_NAME = `Per Profile Yearly - ${PROFILE_COUNT} Profiles`;

console.log('========================================');
console.log('🔧 FIXING PROFILE COUNT IN DATABASE');
console.log('========================================\n');
console.log(`User ID: ${USER_ID}`);
console.log(`GBP Account ID: ${GBP_ACCOUNT_ID}`);
console.log(`New Profile Count: ${PROFILE_COUNT}`);
console.log(`Plan ID: ${PLAN_ID}`);
console.log(`Plan Name: ${PLAN_NAME}`);
console.log('\n========================================\n');

async function fixProfileCount() {
  try {
    // Step 1: Get current subscription
    console.log('📥 Fetching current subscription...\n');
    const { data: currentSub, error: fetchError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('gbp_account_id', GBP_ACCOUNT_ID)
      .single();

    if (fetchError) {
      console.error('❌ Error fetching subscription:', fetchError);
      return;
    }

    if (!currentSub) {
      console.log('⚠️ No subscription found for this GBP Account ID');
      return;
    }

    console.log('✅ Current subscription found:');
    console.log(`   - Profile Count: ${currentSub.profile_count || 0}`);
    console.log(`   - Plan ID: ${currentSub.plan_id || 'NULL'}`);
    console.log(`   - Plan Name: ${currentSub.plan_name || 'NULL'}`);
    console.log(`   - Status: ${currentSub.status}`);
    console.log('');

    // Step 2: Update subscription
    console.log('🔄 Updating subscription...\n');
    const { data: updatedSub, error: updateError } = await supabase
      .from('subscriptions')
      .update({
        profile_count: PROFILE_COUNT,
        plan_id: PLAN_ID
      })
      .eq('gbp_account_id', GBP_ACCOUNT_ID)
      .select();

    if (updateError) {
      console.error('❌ Error updating subscription:', updateError);
      return;
    }

    console.log('✅ SUBSCRIPTION UPDATED SUCCESSFULLY!\n');
    console.log('New values:');
    console.log(`   - Profile Count: ${PROFILE_COUNT}`);
    console.log(`   - Plan ID: ${PLAN_ID}`);
    console.log('');

    console.log('========================================');
    console.log('🎉 DONE!');
    console.log('========================================\n');
    console.log('The user can now access all their profiles!');
    console.log('They should refresh their browser to see the changes.\n');

  } catch (error) {
    console.error('❌ Error:', error);
  }
}

fixProfileCount().then(() => {
  console.log('Fix complete!');
  process.exit(0);
});
