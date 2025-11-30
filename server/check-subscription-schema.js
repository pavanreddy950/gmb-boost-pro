import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';

dotenv.config();

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_KEY
);

console.log('========================================');
console.log('🔍 CHECKING SUBSCRIPTION TABLE SCHEMA');
console.log('========================================\n');

async function checkSchema() {
  try {
    const { data, error } = await supabase
      .from('subscriptions')
      .select('*')
      .limit(1);

    if (error) {
      console.error('Error:', error);
      return;
    }

    if (data && data.length > 0) {
      console.log('✅ Sample subscription record:\n');
      console.log(JSON.stringify(data[0], null, 2));
      console.log('\n========================================');
      console.log('AVAILABLE COLUMNS:');
      console.log('========================================\n');
      Object.keys(data[0]).forEach(key => {
        console.log(`   - ${key}`);
      });
      console.log('');
    } else {
      console.log('No subscriptions found in database');
    }

  } catch (error) {
    console.error('Error:', error);
  }
}

checkSchema().then(() => {
  console.log('Schema check complete!');
  process.exit(0);
});
