import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const files = [
  'src/components/MandateSetup.tsx',
  'src/components/PaymentModal.tsx',
  'src/components/ProfileDetails/AutoPostingTab.tsx',
  'src/components/ProfileDetails/EditProfileTab.tsx',
  'src/components/TrialSetupModal.tsx',
  'src/contexts/AdminContext.tsx',
  'src/contexts/SubscriptionContext.tsx',
  'src/hooks/useGoogleBusinessProfile.ts',
  'src/lib/automationService.ts',
  'src/lib/googleBusinessProfile.ts',
  'src/lib/reviewAutomationService.ts',
  'src/lib/serverAutomationService.ts',
  'src/lib/simpleGoogleAuth.ts',
  'src/pages/AskForReviews.tsx',
  'src/pages/Billing.tsx',
  'src/pages/PublicReviewSuggestions.tsx',
];

const oldUrl = 'https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net';
const newUrl = 'https://lobaiseo-backend-yjnl.onrender.com';

console.log('🔧 Fixing hardcoded backend URLs...\n');

let fixedCount = 0;
let errorCount = 0;

for (const file of files) {
  try {
    const filePath = join(__dirname, file);
    console.log(`Processing: ${file}`);

    let content = readFileSync(filePath, 'utf8');
    const originalContent = content;

    // Replace all occurrences
    content = content.replace(new RegExp(oldUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), newUrl);

    if (content !== originalContent) {
      writeFileSync(filePath, content, 'utf8');
      console.log(`✅ Fixed: ${file}`);
      fixedCount++;
    } else {
      console.log(`⏭️ Skipped: ${file} (no changes needed)`);
    }
  } catch (error) {
    console.error(`❌ Error processing ${file}:`, error.message);
    errorCount++;
  }
}

console.log(`\n📊 Summary:`);
console.log(`   ✅ Fixed: ${fixedCount} files`);
console.log(`   ⏭️ Skipped: ${files.length - fixedCount - errorCount} files`);
console.log(`   ❌ Errors: ${errorCount} files`);

if (fixedCount > 0) {
  console.log(`\n🎉 All hardcoded URLs updated successfully!`);
  console.log(`   Old: ${oldUrl}`);
  console.log(`   New: ${newUrl}`);
}
