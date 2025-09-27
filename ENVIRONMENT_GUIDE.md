# 🌍 Environment Switching Guide

Simple guide for switching between local development and production deployment.

## Quick Commands

### For Local Development:
```bash
npm run env:local    # Switch to local mode
npm run dev          # Start development
```

### For Production Deployment:
```bash
npm run env:production   # Switch to production mode
npm run build           # Build for deployment
# Then deploy dist folder to Azure Static Web Apps
```

## What Each Mode Does:

### 🏠 Local Mode (`npm run env:local`)
- **Frontend**: Runs on `http://localhost:3000`
- **Backend**: Points to `http://localhost:5000`
- **Use Case**: Local development and testing
- **Shows**: Blue "LOCAL" badge in top-right corner

### 🚀 Production Mode (`npm run env:production`)
- **Frontend**: Built for production
- **Backend**: Points to Azure backend URL
- **Use Case**: Building for deployment
- **Shows**: No badge (production)

## How It Works:

1. **Safe Switching**: Always creates a backup before changing
2. **Non-Destructive**: Your original deployment setup is never broken
3. **Visual Indicator**: Shows current mode in development

## Commands Available:

```bash
# Environment switching
npm run env:local        # Switch to local development
npm run env:production   # Switch to production deployment
npm run env:restore      # Restore from backup
npm run env:show         # Show current environment
npm run env:help         # Show help

# Combined commands (switch + action)
npm run dev:local        # Switch to local + start dev
npm run dev:production   # Switch to production + start dev
npm run build:local      # Switch to local + build
npm run build:prod       # Switch to production + build

# Quick switching (just change environment)
npm run quick:local      # Just switch to local
npm run quick:production # Just switch to production
```

## Your Existing Deployment Process Still Works:

```bash
# Your current deployment (unchanged)
npm run switch:azure     # Old way
npm run build           # Build
# Deploy dist folder

# OR use new way (same result)
npm run env:production  # New way
npm run build          # Build
# Deploy dist folder
```

## Safety Features:

- ✅ Always creates backup before switching
- ✅ Easy restore with `npm run env:restore`
- ✅ Never modifies your original deployment files
- ✅ Visual indicator shows current mode
- ✅ Your existing workflow continues to work

## File Structure:

```
├── .env.local          # Current active environment (modified by switching)
├── .env.local.backup   # Automatic backup (created when switching)
├── .env.local.dev      # Local development template
├── .env.production     # Production template
└── scripts/
    └── safe-switch.js  # Safe switching script
```

## Troubleshooting:

### If something goes wrong:
```bash
npm run env:restore     # Restore from backup
npm run env:show        # Check current state
```

### If you want to see what will change:
```bash
npm run env:help        # Shows preview of changes
```

### If you want to go back to your original setup:
Just use your existing commands:
```bash
npm run switch:azure    # Your original deployment method
npm run switch:local    # Your original local method
```

This new system is **additive only** - it doesn't break anything you already have!