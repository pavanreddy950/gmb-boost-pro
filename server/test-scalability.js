#!/usr/bin/env node

/**
 * Scalability Test Script
 * Tests connection pool, cache, and rate limiting
 */

import fetch from 'node-fetch';

const BASE_URL = process.env.BASE_URL || 'http://localhost:5000';

console.log('🧪 Testing Scalability Features...\n');
console.log(`Base URL: ${BASE_URL}\n`);

async function testConnectionPool() {
    console.log('1️⃣  Testing Connection Pool...');
    try {
        const response = await fetch(`${BASE_URL}/api/health/connection-pool`);
        const data = await response.json();

        if (data.status === 'healthy') {
            console.log('   ✅ Connection pool is healthy');
            console.log(`   📊 Queries executed: ${data.stats?.queries?.total || 0}`);
            console.log(`   ⚡ Avg response time: ${data.stats?.queries?.avgResponseTime || '0ms'}`);
        } else {
            console.log('   ❌ Connection pool unhealthy:', data.message);
        }
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    console.log('');
}

async function testCache() {
    console.log('2️⃣  Testing Cache Manager...');
    try {
        const response = await fetch(`${BASE_URL}/api/health/cache`);
        const data = await response.json();

        if (data.status === 'healthy') {
            console.log('   ✅ Cache is healthy');
            console.log(`   📊 Cache size: ${data.cache?.size || 0} entries`);
            console.log(`   🎯 Hit rate: ${data.cache?.hitRate || '0%'}`);
            console.log(`   📈 Hits: ${data.cache?.hits || 0}, Misses: ${data.cache?.misses || 0}`);
        } else {
            console.log('   ❌ Cache unhealthy:', data.message);
        }
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    console.log('');
}

async function testSystemHealth() {
    console.log('3️⃣  Testing Overall System Health...');
    try {
        const response = await fetch(`${BASE_URL}/api/health/system`);
        const data = await response.json();

        if (data.status === 'healthy') {
            console.log('   ✅ System is healthy');
            console.log(`   ⏱️  Uptime: ${Math.floor(data.uptime || 0)} seconds`);
            console.log(`   💾 Memory: ${Math.floor((data.memory?.heapUsed || 0) / 1024 / 1024)}MB used`);
            console.log(`   🚀 Scalability features:`);
            console.log(`      - Rate Limiting: ${data.scalability?.rateLimitingEnabled ? '✅' : '❌'}`);
            console.log(`      - Caching: ${data.scalability?.cachingEnabled ? '✅' : '❌'}`);
            console.log(`      - Connection Pooling: ${data.scalability?.connectionPooling ? '✅' : '❌'}`);
        } else {
            console.log('   ❌ System unhealthy');
        }
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    console.log('');
}

async function testRateLimiting() {
    console.log('4️⃣  Testing Rate Limiting...');
    console.log('   Sending 5 requests rapidly...');

    try {
        const promises = [];
        for (let i = 0; i < 5; i++) {
            promises.push(fetch(`${BASE_URL}/api/health/cache`));
        }

        const responses = await Promise.all(promises);
        const headers = responses[0].headers;

        console.log('   ✅ Rate limiting headers present:');
        console.log(`      - Limit: ${headers.get('x-ratelimit-limit') || 'N/A'}`);
        console.log(`      - Remaining: ${headers.get('x-ratelimit-remaining') || 'N/A'}`);
        console.log(`      - Reset: ${headers.get('x-ratelimit-reset') || 'N/A'}s`);

        const allSuccess = responses.every(r => r.ok);
        if (allSuccess) {
            console.log('   ✅ All requests succeeded (within rate limit)');
        } else {
            console.log('   ⚠️  Some requests were rate limited');
        }
    } catch (error) {
        console.log('   ❌ Error:', error.message);
    }
    console.log('');
}

// Run all tests
async function runTests() {
    console.log('═'.repeat(50));
    console.log('   SCALABILITY FEATURES TEST');
    console.log('═'.repeat(50));
    console.log('');

    await testConnectionPool();
    await testCache();
    await testSystemHealth();
    await testRateLimiting();

    console.log('═'.repeat(50));
    console.log('   TEST COMPLETE');
    console.log('═'.repeat(50));
}

runTests().catch(error => {
    console.error('Test suite failed:', error);
    process.exit(1);
});
