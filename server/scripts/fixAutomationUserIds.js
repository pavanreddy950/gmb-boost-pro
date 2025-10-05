// Fix automation settings with correct userId
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const settingsFile = path.join(__dirname, '..', 'data', 'automationSettings.json');
const correctUserId = 'OBm8qZc0jOWcY53x6rQuX4gKKnQ2';

console.log('[Fix UserIds] Reading automation settings...');
const data = fs.readFileSync(settingsFile, 'utf8');
const settings = JSON.parse(data);

let fixedCount = 0;

console.log('[Fix UserIds] Checking all locations...');
for (const [locationId, config] of Object.entries(settings.automations)) {
  let needsFix = false;

  // Check autoPosting userId
  if (config.autoPosting && config.autoPosting.userId === 'default') {
    console.log(`[Fix UserIds] Fixing autoPosting userId for location ${locationId}`);
    config.autoPosting.userId = correctUserId;
    needsFix = true;
  }

  // Check autoReply userId
  if (config.autoReply && config.autoReply.userId === 'default') {
    console.log(`[Fix UserIds] Fixing autoReply userId for location ${locationId}`);
    config.autoReply.userId = correctUserId;
    needsFix = true;
  }

  // Check top-level userId
  if (config.userId === 'default' || !config.userId) {
    console.log(`[Fix UserIds] Fixing top-level userId for location ${locationId}`);
    config.userId = correctUserId;
    needsFix = true;
  }

  if (needsFix) {
    config.updatedAt = new Date().toISOString();
    fixedCount++;
  }
}

console.log(`[Fix UserIds] Fixed ${fixedCount} location(s)`);
console.log('[Fix UserIds] Saving updated settings...');

fs.writeFileSync(settingsFile, JSON.stringify(settings, null, 2));

console.log('[Fix UserIds] ✅ Done! Automation settings updated.');
console.log('[Fix UserIds] Please restart the server for changes to take effect.');
