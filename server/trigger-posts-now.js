// Quick script to trigger the missed post checker
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import automationScheduler from './services/automationScheduler.js';

async function triggerMissedPosts() {
    console.log('========================================');
    console.log('🚀 MANUALLY TRIGGERING MISSED POST CHECK');
    console.log('========================================\n');
    console.log(`Current time: ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })} IST\n`);

    try {
        // Load settings first
        console.log('📥 Loading automation settings from Supabase...\n');
        await automationScheduler.loadSettings();

        const automations = automationScheduler.settings.automations || {};
        const autoPostingEnabled = Object.entries(automations).filter(([id, config]) => config.autoPosting?.enabled);

        console.log(`📋 Found ${Object.keys(automations).length} total automations`);
        console.log(`📝 Found ${autoPostingEnabled.length} with auto-posting ENABLED\n`);

        if (autoPostingEnabled.length === 0) {
            console.log('⚠️  NO AUTO-POSTING ENABLED!');
            console.log('   Users need to enable auto-posting in their dashboard.\n');
            process.exit(0);
        }

        // Show first 3 enabled auto-posting configs
        console.log('🔍 Sample auto-posting configs:\n');
        autoPostingEnabled.slice(0, 3).forEach(([locationId, config], i) => {
            console.log(`${i + 1}. Location: ${locationId}`);
            console.log(`   Business: ${config.autoPosting?.businessName || config.businessName || 'Unknown'}`);
            console.log(`   Schedule: ${config.autoPosting?.schedule || 'Not set'}`);
            console.log(`   Frequency: ${config.autoPosting?.frequency || 'Not set'}`);
            console.log(`   Last Run: ${config.autoPosting?.lastRun || 'NEVER'}`);
            console.log('');
        });

        // Now trigger the missed post checker
        console.log('========================================');
        console.log('⚡ TRIGGERING checkAndCreateMissedPosts()...');
        console.log('========================================\n');

        await automationScheduler.checkAndCreateMissedPosts();

        console.log('\n========================================');
        console.log('✅ DONE! Check server logs for post creation results.');
        console.log('========================================');

    } catch (error) {
        console.error('❌ Error:', error);
    }

    // Wait a bit for async operations to complete
    setTimeout(() => process.exit(0), 5000);
}

triggerMissedPosts();
