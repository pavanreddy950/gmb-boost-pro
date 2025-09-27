#!/usr/bin/env node

/**
 * Environment Switching Script for GMB Boost Pro
 *
 * This script allows easy switching between development and production environments
 * for both frontend and backend configurations.
 *
 * Usage:
 *   node switch-env.js local    # Switch to local development
 *   node switch-env.js azure    # Switch to Azure production
 *   node switch-env.js status   # Show current environment status
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const environments = {
  local: {
    name: 'Local Development',
    description: 'Uses localhost:5000 backend and local services',
    frontend: {
      source: '.env.development',
      target: '.env.local'
    },
    backend: {
      source: '.env.local',
      target: '.env'
    }
  },
  azure: {
    name: 'Azure Production',
    description: 'Uses Azure backend and production services',
    frontend: {
      source: '.env.production',
      target: '.env.local'
    },
    backend: {
      source: '.env.azure',
      target: '.env'
    }
  }
};

function showUsage() {
  console.log(`
🔧 GMB Boost Pro Environment Switcher

Usage: node switch-env.js <environment>

Available environments:
  local   - Switch to local development (localhost:5000)
  azure   - Switch to Azure production
  status  - Show current environment status

Examples:
  node switch-env.js local
  node switch-env.js azure
  node switch-env.js status
`);
}

function getCurrentEnvironment() {
  const frontendEnvFile = path.join(__dirname, '.env.local');
  const backendEnvFile = path.join(__dirname, 'server', '.env');

  if (!fs.existsSync(frontendEnvFile)) {
    return 'unknown';
  }

  const content = fs.readFileSync(frontendEnvFile, 'utf8');

  if (content.includes('http://localhost:5000')) {
    return 'local';
  } else if (content.includes('pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net')) {
    return 'azure';
  }

  return 'unknown';
}

function showStatus() {
  const current = getCurrentEnvironment();
  const env = environments[current];

  console.log(`
📊 Current Environment Status:

Environment: ${env ? env.name : 'Unknown/Custom'}
${env ? `Description: ${env.description}` : ''}

Frontend Configuration:
  📁 Active file: .env.local
  🔗 Backend URL: ${getBackendUrl()}

Backend Configuration:
  📁 Active file: server/.env
  🔗 Mode: ${getBackendMode()}

${current !== 'unknown' ? '✅ Environment is properly configured' : '⚠️  Environment configuration may be custom or corrupted'}
`);
}

function getBackendUrl() {
  try {
    const envFile = path.join(__dirname, '.env.local');
    if (!fs.existsSync(envFile)) return 'Not configured';

    const content = fs.readFileSync(envFile, 'utf8');
    const match = content.match(/VITE_BACKEND_URL=(.+)/);
    return match ? match[1].trim() : 'Not found';
  } catch (error) {
    return 'Error reading file';
  }
}

function getBackendMode() {
  try {
    const envFile = path.join(__dirname, 'server', '.env');
    if (!fs.existsSync(envFile)) return 'Not configured';

    const content = fs.readFileSync(envFile, 'utf8');
    const modeMatch = content.match(/RUN_MODE=(.+)/);
    const nodeEnvMatch = content.match(/NODE_ENV=(.+)/);

    const mode = modeMatch ? modeMatch[1].trim() : 'Not found';
    const nodeEnv = nodeEnvMatch ? nodeEnvMatch[1].trim() : 'Not found';

    return `${mode} (NODE_ENV: ${nodeEnv})`;
  } catch (error) {
    return 'Error reading file';
  }
}

function copyFile(source, destination, context = '') {
  try {
    if (!fs.existsSync(source)) {
      console.error(`❌ Source file not found: ${source}`);
      return false;
    }

    // Create backup of destination if it exists
    if (fs.existsSync(destination)) {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const backup = `${destination}.backup.${timestamp}`;
      fs.copyFileSync(destination, backup);
      console.log(`📦 Created backup: ${path.basename(backup)}`);
    }

    fs.copyFileSync(source, destination);
    console.log(`✅ ${context}: ${path.basename(source)} → ${path.basename(destination)}`);
    return true;
  } catch (error) {
    console.error(`❌ Failed to copy ${source} to ${destination}:`, error.message);
    return false;
  }
}

function switchEnvironment(targetEnv) {
  const env = environments[targetEnv];

  if (!env) {
    console.error(`❌ Unknown environment: ${targetEnv}`);
    console.log('Available environments: local, azure');
    return false;
  }

  console.log(`\n🔄 Switching to ${env.name} environment...`);
  console.log(`📝 ${env.description}\n`);

  let success = true;

  // Switch frontend environment
  const frontendSource = path.join(__dirname, env.frontend.source);
  const frontendTarget = path.join(__dirname, env.frontend.target);
  success &= copyFile(frontendSource, frontendTarget, 'Frontend');

  // Switch backend environment
  const backendSource = path.join(__dirname, 'server', env.backend.source);
  const backendTarget = path.join(__dirname, 'server', env.backend.target);
  success &= copyFile(backendSource, backendTarget, 'Backend');

  if (success) {
    console.log(`\n✅ Successfully switched to ${env.name} environment!`);
    console.log(`\n📋 Next steps:`);

    if (targetEnv === 'local') {
      console.log(`   1. Start backend: cd server && npm run dev:local`);
      console.log(`   2. Start frontend: npm run dev:local`);
      console.log(`   3. Access app at: http://localhost:3000`);
    } else {
      console.log(`   1. Build for Azure: npm run build:azure`);
      console.log(`   2. Deploy to Azure using your deployment process`);
      console.log(`   3. Test with Azure backend: npm run dev:azure`);
    }

    console.log(`\n🔍 Check status anytime: node switch-env.js status`);
  } else {
    console.log(`\n❌ Environment switch failed. Please check the errors above.`);
  }

  return success;
}

// Main execution
const args = process.argv.slice(2);
const command = args[0];

if (!command) {
  showUsage();
  process.exit(1);
}

switch (command.toLowerCase()) {
  case 'local':
  case 'dev':
  case 'development':
    switchEnvironment('local');
    break;

  case 'azure':
  case 'prod':
  case 'production':
    switchEnvironment('azure');
    break;

  case 'status':
  case 'info':
  case 'current':
    showStatus();
    break;

  case 'help':
  case '--help':
  case '-h':
    showUsage();
    break;

  default:
    console.error(`❌ Unknown command: ${command}`);
    showUsage();
    process.exit(1);
}