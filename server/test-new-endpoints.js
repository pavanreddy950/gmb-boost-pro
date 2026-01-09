/**
 * Test the new user-payment endpoints
 */

import dotenv from 'dotenv';
import userService from './services/userService.js';

dotenv.config();

async function testEndpoints() {
  console.log('==========================================');
  console.log('🧪 Testing New User-Payment Endpoints');
  console.log('==========================================\n');

  // Test 1: Check subscription status for existing user
  console.log('1️⃣ Test: Check subscription status for hello.lobaiseo@gmail.com');
  console.log('-'.repeat(50));

  const status = await userService.checkSubscriptionStatus('hello.lobaiseo@gmail.com');
  console.log('Result:', JSON.stringify(status, null, 2));

  // Test 2: Check subscription status for admin user
  console.log('\n2️⃣ Test: Check subscription status for admin (scalepointstrategy@gmail.com)');
  console.log('-'.repeat(50));

  const adminStatus = await userService.checkSubscriptionStatus('scalepointstrategy@gmail.com');
  console.log('Result:', JSON.stringify(adminStatus, null, 2));

  // Test 3: Check subscription status for non-existent user
  console.log('\n3️⃣ Test: Check subscription status for non-existent user');
  console.log('-'.repeat(50));

  const newUserStatus = await userService.checkSubscriptionStatus('newuser@example.com');
  console.log('Result:', JSON.stringify(newUserStatus, null, 2));

  // Test 4: Get user by email
  console.log('\n4️⃣ Test: Get user data');
  console.log('-'.repeat(50));

  const user = await userService.getUserByEmail('hello.lobaiseo@gmail.com');
  console.log('User found:', user ? 'Yes' : 'No');
  if (user) {
    console.log('  Email:', user.gmail_id);
    console.log('  Status:', user.subscription_status);
    console.log('  Profile Count:', user.profile_count);
    console.log('  Has Valid Token:', user.has_valid_token);
  }

  console.log('\n==========================================');
  console.log('✅ All tests completed');
  console.log('==========================================\n');
}

testEndpoints().catch(console.error);
