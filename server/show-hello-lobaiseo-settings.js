/**
 * Show automation settings for hello.lobaiseo@gmail.com
 */

import dotenv from 'dotenv';
dotenv.config();

import supabaseConfig from './config/supabase.js';

async function showSettings() {
  console.log('📋 SHOWING AUTOMATION SETTINGS FOR hello.lobaiseo@gmail.com\n');
  console.log('===============================================\n');

  try {
    const supabase = await supabaseConfig.ensureInitialized();

    const { data: settings, error } = await supabase
      .from('automation_settings')
      .select('*')
      .eq('user_id', 'QlJvlBBTEPSV4tb2rsYsDaxdSgd2');

    if (error) throw error;

    console.log(`Found ${settings.length} automation settings\n`);

    settings.forEach((setting, index) => {
      console.log(`\n${index + 1}. Location: ${setting.location_id}`);
      console.log(`   Created: ${setting.created_at}`);
      console.log(`   Updated: ${setting.updated_at}`);
      console.log(`\n   Settings object:`);
      console.log('   ----------------------------------------');
      console.log(`   accountId: ${setting.settings?.accountId || 'NOT SET'}`);
      console.log(`   gbpAccountId: ${setting.settings?.gbpAccountId || 'NOT SET'}`);
      console.log(`   autoPosting.accountId: ${setting.settings?.autoPosting?.accountId || 'NOT SET'}`);
      console.log(`   autoPosting.gbpAccountId: ${setting.settings?.autoPosting?.gbpAccountId || 'NOT SET'}`);
      console.log(`   autoReply.accountId: ${setting.settings?.autoReply?.accountId || 'NOT SET'}`);
      console.log(`   autoReply.gbpAccountId: ${setting.settings?.autoReply?.gbpAccountId || 'NOT SET'}`);
      console.log('   ----------------------------------------');
    });

    console.log('\n===============================================');
    process.exit(0);

  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

showSettings();
