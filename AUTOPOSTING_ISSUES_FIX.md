# Autoposting Issues - Diagnosis & Fix

## 🔍 Issues Identified

### Issue 1: Autoposting Only Working on One Location
**Location**: 14977377147025961194 (Scale Point Strategy & Business Growth Solutions)

**Root Cause**:
- **0 active cron jobs** are running on the backend server
- The backend automation scheduler has NOT properly initialized automations
- Settings are loaded into memory (13 locations) but cron jobs are not created

**Evidence from Diagnostic**:
```
✅ Enabled in database: 18 locations
✅ Loaded in scheduler: 13 locations
✅ Active cron jobs: 0  ← PROBLEM!

All locations show: "Has cron job: false"
```

**Why Only One Location Gets Posts**:
- Posts are being created by the "missed post checker" (runs every 2 minutes)
- The missed post checker catches overdue posts and creates them
- NOT from the actual cron schedule (which should run at 9 AM daily/alternative)

### Issue 2: Frequency Changing from "Daily" to "Alternative Days"

**Root Cause**:
1. **Default configuration** in `automationStorage.ts` line 292:
   ```typescript
   frequency: 'alternative'  // Default is 'alternative', not 'daily'
   ```

2. **Database has conflicting settings**:
   - Database shows location with frequency: 'daily' (last updated 2025-11-30)
   - But when server restarts/reloads, it might use the default 'alternative'

3. **Potential sync issue**:
   - Frontend stores in localStorage (frequency: 'daily')
   - Backend loads from Supabase (frequency might revert to 'alternative')
   - If backend overwrites frontend, frequency changes back

## ✅ Solutions

### Solution 1: Fix Cron Jobs Not Being Created

**Problem**: Backend server is not properly initializing automations on startup.

**Steps to Fix**:

1. **Restart the backend server** to reinitialize all automations:
   ```bash
   # Stop the current server (Ctrl+C)
   # Then restart:
   cd server
   npm start
   ```

2. **Verify automations are initialized**:
   - Check server logs for: `[AutomationScheduler] ✅ Initialized X posting schedules`
   - Expected: 13+ cron jobs should be created

3. **Check leader election**:
   - If using multiple servers, only the LEADER server runs automations
   - Check logs for: `[LEADER ELECTION] 👑 This server is LEADER`
   - If server is FOLLOWER, automations won't run on that instance

### Solution 2: Fix Frequency Persistence

**Option A: Change Default to 'daily'** (Recommended)

Update `src/lib/automationStorage.ts` line 292:
```typescript
// FROM:
frequency: 'alternative',

// TO:
frequency: 'daily',  // Default to daily posting
```

**Option B: Ensure Frequency is Always Synced to Server**

When user changes frequency in UI, ensure it's immediately saved to Supabase:
- Already implemented in `AutoPostingTab.tsx` line 332-349
- Should work correctly if server is running

**Option C: Fix Database Directly** (Temporary Fix)

For the specific location that keeps changing:
1. Find the location in Supabase `automation_settings` table
2. Update the `settings` JSONB column:
   ```json
   {
     "autoPosting": {
       "frequency": "daily",  // Ensure this is set
       ...
     }
   }
   ```

### Solution 3: Diagnostic & Monitoring

**Run the diagnostic script to check automation status**:
```bash
cd "C:\Users\meena\Desktop\raja gupta client\gmb-boost-pro-1"
node server/debug-automation-settings.js
```

**Expected output after fixes**:
```
✅ Enabled in database: 18 locations
✅ Loaded in scheduler: 18 locations
✅ Active cron jobs: 18 ← Should match!

Each location should show: "Has cron job: true"
```

## 🔧 Immediate Action Plan

### Step 1: Restart Backend Server
```bash
# Terminal 1 - Backend
cd "C:\Users\meena\Desktop\raja gupta client\gmb-boost-pro-1\server"
npm start

# Wait for: "[AutomationScheduler] ✅ Initialized X posting schedules"
```

### Step 2: Verify Cron Jobs
```bash
# Terminal 2 - Run diagnostic
node server/debug-automation-settings.js
```

### Step 3: Check Specific Location
For location 14977377147025961194:
- Go to UI → Settings → Auto-posting
- Verify frequency shows "daily" (if that's what you set)
- Toggle automation OFF then ON again
- This will re-sync to server with current settings

### Step 4: Monitor Logs
Watch server logs for:
```
[AutomationScheduler] ⏰ CRON TRIGGERED - Running scheduled post for location...
[AutomationScheduler] ✅ Successfully created post for location...
```

## 📊 Current Database State

**18 enabled automations found:**

| Location | Business Name | Frequency | Last Run | User ID |
|----------|--------------|-----------|----------|---------|
| 16958152015392254505 | Kubera Wealth | alternative | 2025-11-29 09:01 | default |
| 14977377147025961194 | Scale Point | alternative | NEVER | OBm8qZc... |
| 1497453847846156772 | NK Desert Camp | alternative | 2025-11-29 09:01 | OBm8qZc... |
| 12580110398960005959 | Aventa Granites | **daily** ✅ | 2025-11-30 03:30 | 19II4Jz... |
| 13590844868409001032 | SANGMESHWAR | **daily** ✅ | 2025-11-30 03:30 | g9nPJnK... |
| 9152028977863765725 | Tree House | **daily** ✅ | 2025-11-30 03:30 | na0pIgI... |
| ... | ... | ... | ... | ... |

**Note**: Locations with "daily" frequency DID run at 03:30 (likely different timezone or manual trigger)

## 🎯 Expected Behavior After Fix

1. **All 18 enabled locations** should have active cron jobs
2. **Posts should be created automatically** at 9:00 AM (IST) based on frequency:
   - Daily: Every day at 9 AM
   - Alternative: Every 2 days at 9 AM
   - Weekly: Once a week at 9 AM
3. **Frequency should persist** when set via UI
4. **No more random frequency changes** from daily → alternative

## 🚨 Critical Notes

1. **Leader Election**: If running multiple servers, only ONE will run automations
2. **Token Expiry**: Ensure user has valid Google OAuth tokens in Supabase
3. **Timezone**: All schedules use IST (Asia/Kolkata) by default
4. **Missed Post Checker**: Runs every 2 minutes as a backup (should NOT be the primary posting mechanism)

## 📝 Verification Checklist

After implementing fixes:

- [ ] Backend server restarted successfully
- [ ] Diagnostic shows all locations have cron jobs (`Has cron job: true`)
- [ ] Active cron jobs count matches enabled locations count
- [ ] Server logs show: `[AutomationScheduler] ✅ Initialized X posting schedules`
- [ ] At 9:00 AM IST, cron triggers automatically (check logs)
- [ ] Frequency set to "daily" persists after page refresh
- [ ] Frequency doesn't change when toggling automation off/on

## 🔗 Related Files

- Backend scheduler: `server/services/automationScheduler.js`
- Frontend UI: `src/components/ProfileDetails/AutoPostingTab.tsx`
- Storage layer: `src/lib/automationStorage.ts`
- Server sync: `src/lib/serverAutomationService.ts`
- Database service: `server/services/supabaseAutomationService.js`
- Diagnostic script: `server/debug-automation-settings.js`
