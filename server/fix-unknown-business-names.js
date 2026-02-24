/**
 * fix-unknown-business-names.js
 *
 * Fixes user_locations rows where business_name = 'Unknown' or is a location path.
 * Fetches the real business name from Google Business Profile API using each user's OAuth token.
 *
 * Usage:
 *   node fix-unknown-business-names.js           (dry run - shows what would be fixed)
 *   node fix-unknown-business-names.js --update  (actually updates the database)
 */

import { createClient } from '@supabase/supabase-js';
import { google } from 'googleapis';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, '.env.local') });

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_KEY;
const clientId = process.env.GOOGLE_CLIENT_ID;
const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

function isInvalidName(name) {
  if (!name) return true;
  if (name === 'Unknown') return true;
  if (name.startsWith('locations/')) return true;
  if (/^[0-9]+$/.test(name)) return true;
  return false;
}

async function fetchBusinessNameFromGBP(locationId, accessToken, refreshToken) {
  try {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({
      access_token: accessToken,
      refresh_token: refreshToken
    });

    const mybusinessInfo = google.mybusinessbusinessinformation({ version: 'v1', auth: oauth2Client });

    const locationName = locationId.startsWith('locations/') ? locationId : `locations/${locationId}`;
    const response = await mybusinessInfo.locations.get({
      name: locationName,
      readMask: 'name,title,storefrontAddress'
    });

    const loc = response.data;
    const title = loc?.title;
    const addressLines = loc?.storefrontAddress?.addressLines?.join(', ') || '';
    const city = loc?.storefrontAddress?.locality || '';
    const address = [addressLines, city].filter(Boolean).join(', ');

    return { title, address };
  } catch (err) {
    console.warn(`   ⚠️ GBP API error for location ${locationId}: ${err.message}`);
    return { title: null, address: null };
  }
}

async function fixUnknownBusinessNames(dryRun = true) {
  console.log('='.repeat(80));
  console.log(`🔧 FIXING UNKNOWN BUSINESS NAMES IN user_locations${dryRun ? ' (DRY RUN)' : ''}`);
  console.log('='.repeat(80));

  // Get all locations with unknown/invalid business names, joined with user tokens
  const { data: rows, error } = await supabase
    .from('user_locations')
    .select('*, users!inner(gmail_id, google_access_token, google_refresh_token)')
    .or('business_name.eq.Unknown,business_name.is.null,business_name.like.locations/%');

  if (error) {
    console.error('❌ Error querying user_locations:', error.message);
    process.exit(1);
  }

  // Also fetch rows where business_name is a bare number (location ID saved as name)
  const { data: numericRows, error: numericError } = await supabase
    .from('user_locations')
    .select('*, users!inner(gmail_id, google_access_token, google_refresh_token)');

  if (numericError) {
    console.warn('⚠️ Could not fetch all rows for numeric check:', numericError.message);
  }

  const numericNameRows = (numericRows || []).filter(r => /^[0-9]+$/.test(r.business_name));
  const allRows = [...(rows || []), ...numericNameRows];

  // Deduplicate by location_id+gmail_id
  const seen = new Set();
  const uniqueRows = allRows.filter(r => {
    const key = `${r.gmail_id}:${r.location_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });

  console.log(`\n📊 Found ${uniqueRows.length} locations with invalid business names\n`);

  if (uniqueRows.length === 0) {
    console.log('✅ No locations need fixing!');
    return;
  }

  let fixedCount = 0;
  let skippedCount = 0;
  const updates = [];

  for (const row of uniqueRows) {
    const { location_id, gmail_id, business_name } = row;
    const user = row.users;
    const accessToken = user?.google_access_token;
    const refreshToken = user?.google_refresh_token;

    console.log(`\n📍 ${gmail_id} → ${location_id}`);
    console.log(`   Current business_name: "${business_name || 'NULL'}"`);

    if (!accessToken && !refreshToken) {
      console.log(`   ⚠️ No OAuth tokens found — skipping`);
      skippedCount++;
      continue;
    }

    const { title, address } = await fetchBusinessNameFromGBP(location_id, accessToken, refreshToken);

    if (title && !isInvalidName(title)) {
      console.log(`   ✅ Found real name: "${title}"${address ? ` (${address})` : ''}`);
      updates.push({ location_id, gmail_id, business_name: title, address: address || row.address });
      fixedCount++;
    } else {
      console.log(`   ❌ Could not fetch real name from GBP API`);
      skippedCount++;
    }

    // Small delay to avoid rate limiting
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('\n' + '='.repeat(80));
  console.log(`\n📊 SUMMARY:`);
  console.log(`   Total to fix: ${uniqueRows.length}`);
  console.log(`   Can fix: ${fixedCount}`);
  console.log(`   Skipped (no token / API error): ${skippedCount}`);

  if (dryRun) {
    console.log('\nℹ️  DRY RUN — No changes written. Run with --update to apply fixes.\n');
    if (updates.length > 0) {
      console.log('Would update:');
      updates.forEach(u => console.log(`   • ${u.gmail_id} / ${u.location_id} → "${u.business_name}"`));
    }
    return;
  }

  if (updates.length === 0) {
    console.log('\n⚠️ Nothing to update.\n');
    return;
  }

  console.log('\n🔄 WRITING UPDATES TO DATABASE...\n');
  for (const update of updates) {
    const updateData = { business_name: update.business_name, updated_at: new Date().toISOString() };
    if (update.address) updateData.address = update.address;

    const { error: updateError } = await supabase
      .from('user_locations')
      .update(updateData)
      .eq('location_id', update.location_id)
      .eq('gmail_id', update.gmail_id);

    if (updateError) {
      console.error(`   ❌ Failed to update ${update.location_id}: ${updateError.message}`);
    } else {
      console.log(`   ✅ Updated "${update.business_name}" (${update.location_id})`);
    }
  }

  console.log('\n✅ DONE! Restart the backend server to reload automation settings.\n');
  console.log('='.repeat(80));
}

const shouldUpdate = process.argv.includes('--update');
fixUnknownBusinessNames(!shouldUpdate).catch(console.error);
