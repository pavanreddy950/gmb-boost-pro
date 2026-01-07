// Quick diagnostic script to check auto-posting status
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Try multiple env file locations
dotenv.config({ path: path.join(__dirname, '.env.local') });
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_KEY
);

async function checkAutoPostingStatus() {
    console.log('========================================');
    console.log('🔍 CHECKING AUTO-POSTING STATUS');
    console.log('========================================\n');

    try {
        // Get all automations
        const { data: automations, error } = await supabase
            .from('automation_settings')
            .select('*')
            .eq('enabled', true);

        if (error) {
            console.error('❌ Error fetching automations:', error);
            return;
        }

        console.log(`📋 Found ${automations?.length || 0} enabled automations\n`);

        if (!automations || automations.length === 0) {
            console.log('⚠️  NO ENABLED AUTOMATIONS FOUND!');
            console.log('   This is why auto-posting at 9am is not working.');
            console.log('   Users need to enable auto-posting in their dashboard.\n');
            return;
        }

        let autoPostingCount = 0;
        let autoReplyCount = 0;

        for (const auto of automations) {
            const settings = typeof auto.settings === 'string'
                ? JSON.parse(auto.settings)
                : auto.settings;

            const hasAutoPosting = settings?.autoPosting?.enabled;
            const hasAutoReply = auto.auto_reply_enabled;
            const schedule = settings?.autoPosting?.schedule;
            const frequency = settings?.autoPosting?.frequency;
            const businessName = settings?.autoPosting?.businessName || settings?.businessName || 'Unknown';

            if (hasAutoPosting) autoPostingCount++;
            if (hasAutoReply) autoReplyCount++;

            console.log(`📍 Location: ${auto.location_id}`);
            console.log(`   👤 User: ${auto.user_id}`);
            console.log(`   🏢 Business: ${businessName}`);
            console.log(`   📝 Auto-Posting: ${hasAutoPosting ? '✅ ENABLED' : '❌ Disabled'}`);
            if (hasAutoPosting) {
                console.log(`      ⏰ Schedule: ${schedule || 'Not set'}`);
                console.log(`      📅 Frequency: ${frequency || 'Not set'}`);
            }
            console.log(`   💬 Auto-Reply: ${hasAutoReply ? '✅ ENABLED' : '❌ Disabled'}`);
            console.log('');
        }

        console.log('========================================');
        console.log('📊 SUMMARY');
        console.log('========================================');
        console.log(`   Total enabled automations: ${automations.length}`);
        console.log(`   Auto-Posting enabled: ${autoPostingCount}`);
        console.log(`   Auto-Reply enabled: ${autoReplyCount}`);

        if (autoPostingCount === 0) {
            console.log('\n⚠️  NO AUTO-POSTING ENABLED!');
            console.log('   This is why 9am posting is not working.');
        } else {
            console.log('\n✅ Auto-posting should be working for the above locations.');
        }
        console.log('========================================');

    } catch (err) {
        console.error('❌ Script error:', err);
    }

    process.exit(0);
}

checkAutoPostingStatus();
