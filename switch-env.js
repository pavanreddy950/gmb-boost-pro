#!/usr/bin/env node

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const mode = process.argv[2];

if (!mode || !['local', 'azure'].includes(mode)) {
  console.log('Usage: node switch-env.js [local|azure]');
  process.exit(1);
}

const frontendEnvPath = path.join(__dirname, '.env.local');
const backendEnvPath = path.join(__dirname, 'server', '.env');

if (mode === 'azure') {
  console.log('🚀 Switching to Azure configuration...');
  
  // Update frontend .env.local
  let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  frontendEnv = frontendEnv.replace(
    'VITE_BACKEND_URL=http://localhost:5000',
    'VITE_BACKEND_URL=https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net'
  );
  fs.writeFileSync(frontendEnvPath, frontendEnv);
  
  console.log('✅ Frontend configured for Azure');
  console.log('📦 Now run: npm run build');
  console.log('☁️  Then deploy the dist folder to Azure Static Web Apps');
  
} else if (mode === 'local') {
  console.log('💻 Switching to Local configuration...');
  
  // Update frontend .env.local
  let frontendEnv = fs.readFileSync(frontendEnvPath, 'utf8');
  frontendEnv = frontendEnv.replace(
    'VITE_BACKEND_URL=https://scale12345-hccmcmf7g3bwbvd0.canadacentral-01.azurewebsites.net',
    'VITE_BACKEND_URL=http://localhost:5000'
  );
  fs.writeFileSync(frontendEnvPath, frontendEnv);
  
  console.log('✅ Frontend configured for localhost');
  console.log('🏃 Now run: npm run dev');
}

console.log('\n📋 Current Configuration:');
const currentEnv = fs.readFileSync(frontendEnvPath, 'utf8');
const backendUrl = currentEnv.match(/VITE_BACKEND_URL=(.*)/)?.[1];
console.log(`   Backend URL: ${backendUrl}`);