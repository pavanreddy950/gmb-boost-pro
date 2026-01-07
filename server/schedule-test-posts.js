// Script to schedule ALL business profiles to post at 9:55 AM for testing
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

const TEST_SCHEDULE = '09:55'; // 9:55 AM IST

async function scheduleAllAutomations() {
    console.log('========================================');
    console.log('🧪 SCHEDULING ALL AUTOMATIONS FOR TESTING');
    console.log(`⏰ Target time: ${TEST_SCHEDULE} IST`);
    console.log('========================================\n');

    try {
        // Get all enabled automations
        const { data: automations, error } = await supabase
            .from('automation_settings')
            .select('*')
            .eq('enabled', true);

        if (error) {
            console.error('Error fetching automations:', error);
            process.exit(1);
        }

        console.log(`📋 Found ${automations.length} enabled automations\n`);

        let updatedCount = 0;

        for (const auto of automations) {
            const settings = typeof auto.settings === 'string' ? JSON.parse(auto.settings) : (auto.settings || {});

            // Get current autoPosting config or create new one
            const currentAutoPosting = settings.autoPosting || {};

            // Update to test schedule
            const updatedAutoPosting = {
                ...currentAutoPosting,
                enabled: true,
                schedule: TEST_SCHEDULE,
                frequency: 'daily',
                lastRun: null // Clear lastRun so it will trigger
            };

            // Update the full settings object
            const updatedSettings = {
                ...settings,
                autoPosting: updatedAutoPosting
            };

            // Update in database
            const { error: updateError } = await supabase
                .from('automation_settings')
                .update({
                    settings: updatedSettings,
                    updated_at: new Date().toISOString()
                })
                .eq('id', auto.id);

            if (updateError) {
                console.error(`❌ Failed to update ${auto.location_id}:`, updateError);
            } else {
                const businessName = settings.autoPosting?.businessName || settings.businessName || 'Unknown';
                console.log(`✅ Updated: ${businessName}`);
                console.log(`   Location: ${auto.location_id}`);
                console.log(`   Schedule: ${TEST_SCHEDULE}`);
                console.log(`   LastRun: CLEARED (will trigger at 9:55)`);
                console.log('');
                updatedCount++;
            }
        }

        console.log('========================================');
        console.log(`📊 SUMMARY`);
        console.log(`   Updated: ${updatedCount} automations`);
        console.log(`   Schedule: ${TEST_SCHEDULE} IST`);
        console.log(`\n⏰ Posts will be created at 9:55 AM IST`);
        console.log(`📋 Posts should appear in Scheduled Posts section ~30 min before`);
        console.log('========================================\n');

        console.log('⚠️  IMPORTANT: Restart the server to reload the schedules!');
        console.log('   Press Ctrl+C in the server terminal, then run: npm run dev');

    } catch (err) {
        console.error('Error:', err);
    }

    process.exit(0);
}

scheduleAllAutomations();
