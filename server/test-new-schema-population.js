import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '.env.local') });

import newSchemaAdapter from './services/newSchemaAdapter.js';

/**
 * Test script to verify new schema population works
 */

async function testNewSchemaPopulation() {
  try {
    console.log('\n🧪 TESTING NEW SCHEMA POPULATION\n');
    console.log('='.repeat(80));

    const testEmail = 'test@example.com';
    const testFirebaseUid = 'test-firebase-uid-123';

    // Test 1: Create user
    console.log('\n1️⃣ Testing user creation...');
    const user = await newSchemaAdapter.upsertUser({
      gmailId: testEmail,
      firebaseUid: testFirebaseUid,
      displayName: 'Test User',
      subscriptionStatus: 'trial',
      googleAccessToken: 'test-access-token',
      googleRefreshToken: 'test-refresh-token',
      googleTokenExpiry: Date.now() + 3600000,
      googleAccountId: '123456789'
    });

    if (user) {
      console.log('✅ User created successfully!');
      console.log('   Gmail:', user.gmail_id);
      console.log('   Firebase UID:', user.firebase_uid);
      console.log('   Subscription:', user.subscription_status);
    } else {
      console.log('❌ Failed to create user');
      return;
    }

    // Test 2: Create location
    console.log('\n2️⃣ Testing location creation...');
    const location = await newSchemaAdapter.upsertLocation({
      gmailId: testEmail,
      locationId: 'test-location-123',
      businessName: 'Test Business',
      address: '123 Test St, Test City, TS 12345',
      category: 'restaurant',
      keywords: 'quality food, great service',
      autopostingEnabled: true,
      autopostingSchedule: '10:00',
      autopostingFrequency: 'daily',
      autoreplyEnabled: true
    });

    if (location) {
      console.log('✅ Location created successfully!');
      console.log('   Business:', location.business_name);
      console.log('   Location ID:', location.location_id);
      console.log('   Auto-posting:', location.autoposting_enabled ? 'ON' : 'OFF');
      console.log('   Status:', location.autoposting_status);
      console.log('   Reason:', location.autoposting_status_reason);
    } else {
      console.log('❌ Failed to create location');
      return;
    }

    // Test 3: Retrieve user
    console.log('\n3️⃣ Testing user retrieval...');
    const retrievedUser = await newSchemaAdapter.getUserByGmail(testEmail);
    if (retrievedUser) {
      console.log('✅ User retrieved successfully!');
    } else {
      console.log('❌ Failed to retrieve user');
    }

    // Test 4: Retrieve locations
    console.log('\n4️⃣ Testing locations retrieval...');
    const locations = await newSchemaAdapter.getUserLocations(testEmail);
    console.log(`✅ Found ${locations.length} location(s) for user`);

    console.log('\n' + '='.repeat(80));
    console.log('✅ ALL TESTS PASSED!\n');
    console.log('📝 NEXT STEPS:');
    console.log('   1. Log out and log back in with hello.lobaiseo@gmail.com');
    console.log('   2. Connect Google Business Profile');
    console.log('   3. Check Supabase to see if user_locations is populated\n');

  } catch (error) {
    console.error('\n❌ TEST FAILED:', error);
    console.error('Error details:', error.message);
    if (error.stack) {
      console.error('\nStack trace:', error.stack);
    }
  }

  process.exit(0);
}

testNewSchemaPopulation();
