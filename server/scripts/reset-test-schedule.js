
import automationScheduler from '../services/automationScheduler.js';

async function resetSchedule() {
    const locationId = '12595110707100978856';

    console.log('Loading automations...');
    await automationScheduler.initializeAutomations();

    const settings = automationScheduler.settings.automations?.[locationId];
    if (settings && settings.autoPosting) {
        console.log(`Current lastRun: ${settings.autoPosting.lastRun}`);

        // Set lastRun to yesterday
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        settings.autoPosting.lastRun = yesterday.toISOString();

        await automationScheduler.updateAutomationSettings(locationId, settings);
        console.log(`✅ Reset lastRun to: ${settings.autoPosting.lastRun}`);
        console.log('Auto-post should trigger within 2 minutes if scheduled time has passed.');
    } else {
        console.error('Settings not found for location');
    }
}

resetSchedule().catch(console.error);
