import fs from 'fs';
import automationScheduler from '../services/automationScheduler.js';
import supabaseAutomationService from '../services/supabaseAutomationService.js';

async function checkSchedulerStatus() {
    console.log('Loading automations...');
    await automationScheduler.initializeAutomations();

    const automations = automationScheduler.settings.automations || {};
    const nowInIST = new Date(new Date().toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));

    // Added log stream and custom log function
    const logStream = fs.createWriteStream('debug-output.txt');
    function log(msg) {
        console.log(msg);
        logStream.write(msg + '\n');
    }

    log(`\n\n=== SCHEDULER DIAGNOSTIC ===`);
    log(`Current Time (IST): ${nowInIST.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`);
    log(`Total Automations: ${Object.keys(automations).length}`);

    for (const [locationId, config] of Object.entries(automations)) {
        const autoPosting = config.autoPosting;
        if (!autoPosting?.enabled) continue;

        log(`\nLocation: ${locationId} (${autoPosting.businessName})`);
        log(`  - Enabled: ${autoPosting.enabled}`);
        log(`  - Schedule: ${autoPosting.schedule}`);
        log(`  - Frequency: ${autoPosting.frequency}`);

        const lastRun = autoPosting.lastRun ? new Date(autoPosting.lastRun) : null;
        log(`  - Last Run: ${lastRun ? lastRun.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'NEVER'}`);

        if (autoPosting.frequency === 'daily') {
            const scheduleTime = autoPosting.schedule || '10:00';
            const [scheduleHour, scheduleMinute] = scheduleTime.split(':').map(Number);

            const scheduledTimeToday = new Date(nowInIST);
            scheduledTimeToday.setHours(scheduleHour, scheduleMinute, 0, 0);

            let postedToday = false;
            if (lastRun) {
                const lastRunIST = new Date(lastRun.toLocaleString('en-US', { timeZone: 'Asia/Kolkata' }));
                postedToday = lastRunIST.toDateString() === nowInIST.toDateString();
            }

            const isScheduleTimePassed = nowInIST >= scheduledTimeToday;
            const shouldPost = isScheduleTimePassed && !postedToday;

            log(`  - Posted Today: ${postedToday}`);
            log(`  - Schedule Time Passed: ${isScheduleTimePassed}`);
            log(`  - SHOULD POST NOW: ${shouldPost}`);
        } else {
            const nextScheduledTime = automationScheduler.calculateNextScheduledTime(autoPosting, lastRun);
            log(`  - Next Scheduled: ${nextScheduledTime ? nextScheduledTime.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' }) : 'N/A'}`);
            log(`  - Overdue: ${nextScheduledTime && nowInIST >= nextScheduledTime}`);
        }
    }
    logStream.end(); // Close the log stream
}

checkSchedulerStatus().catch(console.error);
