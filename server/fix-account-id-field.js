/**
 * FIX: Update accountId fields to match gbpAccountId
 *
 * Problem: autoPosting.accountId and autoReply.accountId still have old account IDs
 * Solution: Update all accountId fields to match the correct gbpAccountId
 */

import dotenv from 'dotenv';
dotenv.config();

import supabaseConfig from './config/supabase.js';

async function fixAccountIdFields() {
  console.log('🔧 FIXING ACCOUNT ID FIELDS TO MATCH GBP ACCOUNT ID\n');
  console.log('===============================================\n');

  try {
    const supabase = await supabaseConfig.ensureInitialized();

    // Get all automation settings
    const { data: settings, error } = await supabase
      .from('automation_settings')
      .select('*');

    if (error) throw error;

    console.log(`Found ${settings.length} automation settings\n`);

    let fixCount = 0;

    for (const setting of settings) {
      const gbpAccountId = setting.settings?.gbpAccountId;

      if (!gbpAccountId) {
        console.log(`⚠️ Location ${setting.location_id}: No gbpAccountId - skipping`);
        continue;
      }

      const currentAccountId = setting.settings?.accountId;
      const currentAutoPostingAccountId = setting.settings?.autoPosting?.accountId;
      const currentAutoReplyAccountId = setting.settings?.autoReply?.accountId;

      let needsUpdate = false;
      const issues = [];

      if (currentAccountId && currentAccountId !== gbpAccountId) {
        needsUpdate = true;
        issues.push(`root accountId: ${currentAccountId} → ${gbpAccountId}`);
      }

      if (currentAutoPostingAccountId && currentAutoPostingAccountId !== gbpAccountId) {
        needsUpdate = true;
        issues.push(`autoPosting.accountId: ${currentAutoPostingAccountId} → ${gbpAccountId}`);
      }

      if (currentAutoReplyAccountId && currentAutoReplyAccountId !== gbpAccountId) {
        needsUpdate = true;
        issues.push(`autoReply.accountId: ${currentAutoReplyAccountId} → ${gbpAccountId}`);
      }

      if (needsUpdate) {
        console.log(`\n📍 Location: ${setting.location_id}`);
        console.log(`   User: ${setting.user_id}`);
        console.log(`   Correct GBP Account ID: ${gbpAccountId}`);
        console.log(`   Issues found:`);
        issues.forEach(issue => console.log(`     - ${issue}`));
        console.log(`   Fixing...`);

        // Update settings with correct accountId everywhere
        const updatedSettings = {
          ...setting.settings,
          accountId: gbpAccountId, // Set root level
          autoPosting: {
            ...setting.settings?.autoPosting,
            accountId: gbpAccountId,
            gbpAccountId: gbpAccountId
          },
          autoReply: {
            ...setting.settings?.autoReply,
            accountId: gbpAccountId,
            gbpAccountId: gbpAccountId
          }
        };

        const { error: updateError } = await supabase
          .from('automation_settings')
          .update({
            settings: updatedSettings,
            updated_at: new Date().toISOString()
          })
          .eq('id', setting.id);

        if (updateError) {
          console.log(`   ❌ Failed: ${updateError.message}`);
        } else {
          console.log(`   ✅ FIXED!`);
          fixCount++;
        }
      }
    }

    console.log('\n===============================================');
    console.log('✅ FIX COMPLETE!');
    console.log('===============================================');
    console.log(`\n📊 Summary: Fixed ${fixCount} automation settings\n`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

fixAccountIdFields();
