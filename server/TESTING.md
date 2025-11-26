# Scalability Testing Guide

## 🧪 Local Testing Steps

### Step 1: Apply SQL Schema First! ⚠️

**IMPORTANT:** Before starting the server, you MUST apply the SQL schema to Supabase.

1. Go to https://app.supabase.com/project/YOUR_PROJECT/sql/new
2. Copy the entire contents of `server/database/scalability-schema.sql`
3. Paste into the SQL Editor
4. Click "Run" or press Ctrl+Enter
5. You should see: "Success. No rows returned"

**Verify it worked:**
```sql
SELECT * FROM leader_election;
-- Should return empty table (no error)
```

---

### Step 2: Start the Server

```powershell
# Navigate to server directory
cd "c:\Users\meena\Desktop\raja gupta client\gmb-boost-pro-1\server"

# Start server
npm run dev
```

**Look for these log messages:**
```
✅ Connection pool initialized successfully
✅ Token storage initialized  
✅ All scalability components ready
✅ Rate limiting active
👑 [LEADER ELECTION] Starting leader election...
✅ [LEADER ELECTION] Leader election started!
✅ [LEADER ELECTION] 👑 This server is now LEADER
```

---

### Step 3: Test Health Endpoints

**Open a NEW PowerShell window** and run:

```powershell
# Test connection pool
curl http://localhost:5000/api/health/connection-pool | ConvertFrom-Json

# Test cache
curl http://localhost:5000/api/health/cache | ConvertFrom-Json

# Test leader election
curl http://localhost:5000/api/health/leader-election | ConvertFrom-Json

# Test system overall
curl http://localhost:5000/api/health/system | ConvertFrom-Json
```

**Expected Results:**

1. **Connection Pool:**
```json
{
  "status": "healthy",
  "stats": {
    "initialized": true,
    "queries": { "total": 0, "avgResponseTime": "0ms" }
  }
}
```

2. **Cache:**
```json
{
  "status": "healthy",
  "cache": {
    "size": 0,
    "hitRate": "0.00%"
  }
}
```

3. **Leader Election:**
```json
{
  "status": "healthy",
  "currentServer": {
    "isLeader": true
  },
  "leader": {
    "serverId": "server-XXX..."
  }
}
```

4. **System:**
```json
{
  "status": "healthy",
  "scalability": {
    "rateLimitingEnabled": true,
    "cachingEnabled": true,
    "connectionPooling": true,
    "leaderElectionEnabled": true,
    "horizontalScalingReady": true
  }
}
```

---

### Step 4: Run Automated Tests

```powershell
# Run the test script
node test-scalability.js
```

**Expected output:**
```
══════════════════════════════════════════════════
   SCALABILITY FEATURES TEST
══════════════════════════════════════════════════

1️⃣  Testing Connection Pool...
   ✅ Connection pool is healthy
   📊 Queries executed: 5
   ⚡ Avg response time: 45ms

2️⃣  Testing Cache Manager...
   ✅ Cache is healthy
   📊 Cache size: 2 entries
   🎯 Hit rate: 75%

3️⃣  Testing Overall System Health...
   ✅ System is healthy
   ⏱️  Uptime: 120 seconds
   🚀 All scalability features enabled

4️⃣  Testing Rate Limiting...
   ✅ Rate limiting headers present
   ✅ All requests succeeded (within rate limit)

══════════════════════════════════════════════════
   TEST COMPLETE
══════════════════════════════════════════════════
```

---

### Step 5: Test Rate Limiting

```powershell
# Send 150 requests rapidly (should get rate limited after 100)
1..150 | ForEach-Object {
    $response = curl -UseBasicParsing http://localhost:5000/api/health/cache
    Write-Host "Request $_: $($response.StatusCode)"
}

# You should see:
# Request 1-100: 200
# Request 101-150: 429 (Too Many Requests)
```

---

## 🐛 Troubleshooting

### Error: "Cannot find module './database/connectionPool.js'"

**Solution:**
The file paths are correct. Make sure you're in the `server` directory:
```powershell
cd "c:\Users\meena\Desktop\raja gupta client\gmb-boost-pro-1\server"
npm run dev
```

### Error: "relation 'leader_election' does not exist"

**Solution:**
You haven't applied the SQL schema yet!
1. Go to Supabase SQL Editor
2. Run `server/database/scalability-schema.sql`
3. Restart server

### Error: "SUPABASE_URL is not defined"

**Solution:**
Check your `.env` file in the `server` directory:
```env
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_KEY=your-service-key
```

### Server starts but crashes immediately

**Check logs for:**
- ❌ Connection pool initialization failed
- ❌ Failed to initialize Supabase

**Solution:**
1. Verify environment variables
2. Check Supabase is accessible
3. Apply SQL schema

---

## ✅ Success Criteria

- [x] Server starts without errors
- [x] All health endpoints return 200
- [x] Leader election shows `isLeader: true`
- [x] Rate limiting works (429 after 100 requests)
- [x] No errors in console logs

---

## 📞 Need Help?

If you see errors, check:
1. ✅ SQL schema applied in Supabase?
2. ✅ Environment variables set correctly?
3. ✅ Running from `server` directory?
4. ✅ Port 5000 not already in use?

Share the error message and I'll help debug! 🚀
