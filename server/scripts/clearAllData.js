import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const dataDir = path.join(__dirname, '../data');

const emptyDataStructures = {
  'auditLogs.json': { logs: [] },
  'auditResults.json': { audits: [] },
  'automation_log.json': { logs: [] },
  'automationSettings.json': { settings: {} },
  'coupons.json': {},
  'qrCodes.json': { codes: [] },
  'subscriptions.json': { subscriptions: {} },
  'token_failures.json': { failures: [] },
  'tokens.json': {},
  'userGbpMapping.json': { userToGbpMapping: {}, gbpToUserMapping: {} }
};

console.log('🗑️  Clearing all JSON data files...\n');

let clearedCount = 0;
let deletedCount = 0;

Object.entries(emptyDataStructures).forEach(([filename, emptyData]) => {
  const filePath = path.join(dataDir, filename);

  if (fs.existsSync(filePath)) {
    try {
      fs.writeFileSync(filePath, JSON.stringify(emptyData, null, 2), 'utf8');
      console.log(`✅ Cleared: ${filename}`);
      clearedCount++;
    } catch (error) {
      console.error(`❌ Error clearing ${filename}:`, error.message);
    }
  } else {
    console.log(`⏭️  Skipped: ${filename} (doesn't exist)`);
  }
});

// Delete specific review reply files (they have dynamic names)
const files = fs.readdirSync(dataDir);
files.forEach(file => {
  if (file.startsWith('replied_reviews_') && file.endsWith('.json')) {
    try {
      fs.unlinkSync(path.join(dataDir, file));
      console.log(`🗑️  Deleted: ${file}`);
      deletedCount++;
    } catch (error) {
      console.error(`❌ Error deleting ${file}:`, error.message);
    }
  }
});

console.log(`\n📊 Summary:`);
console.log(`   Files cleared: ${clearedCount}`);
console.log(`   Files deleted: ${deletedCount}`);
console.log(`\n✅ All JSON data files have been reset to empty state!`);
