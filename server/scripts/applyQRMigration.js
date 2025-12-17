import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';
import supabaseConfig from '../config/supabase.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Apply QR Code Keywords Migration
 * Adds keywords and business_category columns to qr_codes table
 */
async function applyQRMigration() {
  console.log('\n========================================');
  console.log('🔄 QR Code Keywords Migration');
  console.log('========================================\n');

  try {
    // Initialize Supabase client
    console.log('📡 Connecting to Supabase...');
    const client = await supabaseConfig.ensureInitialized();

    if (!client) {
      throw new Error('Failed to initialize Supabase client');
    }

    console.log('✅ Connected to Supabase\n');

    // Read migration SQL file
    const migrationPath = path.join(__dirname, '../database/migrations/add_qr_keywords_category.sql');
    console.log('📄 Reading migration file:', migrationPath);
    const migrationSQL = await fs.readFile(migrationPath, 'utf8');

    console.log('🔧 Applying migration...\n');

    // Execute migration (Supabase doesn't support running raw SQL directly through client)
    // We'll do it manually using ALTER TABLE

    // Check if columns exist first
    const { data: existingColumns, error: checkError } = await client
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'qr_codes')
      .in('column_name', ['keywords', 'business_category']);

    if (checkError) {
      console.error('❌ Error checking existing columns:', checkError);
    }

    const existingColNames = (existingColumns || []).map(c => c.column_name);

    console.log('📊 Current columns:', existingColNames.length > 0 ? existingColNames.join(', ') : 'none found');

    if (!existingColNames.includes('keywords')) {
      console.log('➕ Adding keywords column...');
      console.log('⚠️  Note: You need to run this SQL manually in Supabase SQL Editor:');
      console.log('\n--- Add keywords column ---');
      console.log('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS keywords TEXT;');
      console.log('');
    } else {
      console.log('✅ keywords column already exists');
    }

    if (!existingColNames.includes('business_category')) {
      console.log('➕ Adding business_category column...');
      console.log('⚠️  Note: You need to run this SQL manually in Supabase SQL Editor:');
      console.log('\n--- Add business_category column ---');
      console.log('ALTER TABLE qr_codes ADD COLUMN IF NOT EXISTS business_category TEXT;');
      console.log('');
    } else {
      console.log('✅ business_category column already exists');
    }

    console.log('\n========================================');
    console.log('📋 MIGRATION SQL TO RUN IN SUPABASE:');
    console.log('========================================\n');
    console.log(migrationSQL);
    console.log('\n========================================');
    console.log('🎯 INSTRUCTIONS:');
    console.log('========================================');
    console.log('1. Go to your Supabase Dashboard');
    console.log('2. Navigate to SQL Editor');
    console.log('3. Copy and paste the SQL above');
    console.log('4. Click "Run" to execute the migration');
    console.log('========================================\n');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error(error.stack);
    process.exit(1);
  }
}

// Run migration
applyQRMigration();
