/**
 * Test subscription guard with new userService
 */

import dotenv from 'dotenv';
dotenv.config();

import subscriptionGuard from './services/subscriptionGuard.js';

async function testSubscriptionGuard() {
  console.log('==========================================');
  console.log('🧪 Testing Subscription Guard');
  console.log('==========================================\n');

  // Test 1: Check by firebase_uid
  console.log('1️⃣ Test: hasValidAccess by firebase_uid (QlJvlBBTEPSV4tb2rsYsDaxdSgd2)');
  console.log('-'.repeat(50));

  const result1 = await subscriptionGuard.hasValidAccess('QlJvlBBTEPSV4tb2rsYsDaxdSgd2', null);
  console.log('Result:', JSON.stringify(result1, null, 2));

  // Test 2: Check by email
  console.log('\n2️⃣ Test: hasValidAccess by email (hello.lobaiseo@gmail.com)');
  console.log('-'.repeat(50));

  const result2 = await subscriptionGuard.hasValidAccess('hello.lobaiseo@gmail.com', null);
  console.log('Result:', JSON.stringify(result2, null, 2));

  // Test 3: Check admin
  console.log('\n3️⃣ Test: hasValidAccess for admin (scalepointstrategy@gmail.com)');
  console.log('-'.repeat(50));

  const result3 = await subscriptionGuard.hasValidAccess('scalepointstrategy@gmail.com', null);
  console.log('Result:', JSON.stringify(result3, null, 2));

  console.log('\n==========================================');
  console.log('✅ Tests completed');
  console.log('==========================================\n');
}

testSubscriptionGuard().catch(console.error);
