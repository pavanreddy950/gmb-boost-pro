// Simple diagnostic - check if posts should trigger now
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

async function checkSchedules() {
    console.log('========================================');
    console.log('🕐 CHECKING POST SCHEDULES');
    console.log('========================================\n');

    // Current IST time
    const nowInIST = new Date(
        new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' })
    );
    console.log(`Current IST time: ${nowInIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    console.log(`Current hour: ${nowInIST.getHours()}, minute: ${nowInIST.getMinutes()}\n`);

    const { data: automations, error } = await supabase
        .from('automation_settings')
        .select('*')
        .eq('enabled', true);

    if (error) {
        console.error('Error:', error);
        process.exit(1);
    }

    console.log(`Found ${automations.length} enabled automations\n`);

    let overdueCount = 0;
    let upcomingCount = 0;

    for (const auto of automations) {
        const settings = typeof auto.settings === 'string' ? JSON.parse(auto.settings) : auto.settings;
        const autoPosting = settings?.autoPosting;

        if (!autoPosting?.enabled) continue;

        const schedule = autoPosting.schedule; // e.g., "09:00"
        const lastRun = autoPosting.lastRun ? new Date(autoPosting.lastRun) : null;
        const businessName = autoPosting.businessName || settings?.businessName || 'Unknown';

        if (!schedule) continue;

        const [hour, minute] = schedule.split(':').map(Number);

        // Create today's scheduled time
        const scheduledToday = new Date(nowInIST);
        scheduledToday.setHours(hour, minute, 0, 0);

        // Check if we've already run today
        const alreadyRanToday = lastRun && lastRun.toDateString() === nowInIST.toDateString();

        // Check if overdue
        const isOverdue = nowInIST > scheduledToday && !alreadyRanToday;

        if (isOverdue) {
            overdueCount++;
            console.log(`⚠️  OVERDUE: ${businessName}`);
            console.log(`   Location: ${auto.location_id}`);
            console.log(`   Schedule: ${schedule}`);
            console.log(`   Last Run: ${lastRun ? lastRun.toISOString() : 'NEVER'}`);
            console.log(`   Already ran today: ${alreadyRanToday}`);
            console.log('');
        } else if (!alreadyRanToday) {
            upcomingCount++;
        }
    }

    console.log('========================================');
    console.log(`📊 SUMMARY`);
    console.log(`   Overdue posts: ${overdueCount}`);
    console.log(`   Upcoming posts: ${upcomingCount}`);
    if (overdueCount > 0) {
        console.log('\n⚠️  There are OVERDUE posts that should have been created!');
        console.log('   The missed post checker should pick these up automatically.');
    }
    console.log('========================================');

    process.exit(0);
}

checkSchedules();
