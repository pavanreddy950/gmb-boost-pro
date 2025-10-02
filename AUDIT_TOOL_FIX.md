# Audit Tool Fix - Performance API Integration

## Problem Identified

The audit tool was showing "no data available" and the Google Cloud Console showed 300 requests/minute quota with 0% usage. The issue was:

1. **Using Deprecated API**: The code was calling the deprecated `Google My Business Insights API v4` which was sunset and no longer works
2. **Wrong API Endpoints**: Using `https://mybusiness.googleapis.com/v4/...` which returns errors

## Solution Implemented

Updated the backend endpoint `/api/locations/:locationId/audit/performance` to use the **Business Profile Performance API v1**:

### New API Details
- **API Name**: Business Profile Performance API
- **Version**: v1
- **Endpoint**: `https://businessprofileperformance.googleapis.com/v1/{location}:getDailyMetricsTimeSeries`
- **Documentation**: https://developers.google.com/my-business/reference/performance/rest

### Metrics Fetched
The updated code now fetches these metrics:
- `BUSINESS_IMPRESSIONS_DESKTOP_MAPS`
- `BUSINESS_IMPRESSIONS_DESKTOP_SEARCH`
- `BUSINESS_IMPRESSIONS_MOBILE_MAPS`
- `BUSINESS_IMPRESSIONS_MOBILE_SEARCH`
- `BUSINESS_CONVERSATIONS`
- `BUSINESS_DIRECTION_REQUESTS`
- `CALL_CLICKS`
- `WEBSITE_CLICKS`

## Required: Enable API in Google Cloud Console

To make this work, you **MUST** enable the API in your Google Cloud project:

### Step 1: Go to Google Cloud Console
1. Visit: https://console.cloud.google.com/
2. Select your project: **gbp-467810**

### Step 2: Enable Business Profile Performance API
1. Go to: **APIs & Services** > **Library**
2. Search for: **"Business Profile Performance API"**
3. Click on it and press **"Enable"**

OR use this direct link:
https://console.cloud.google.com/apis/library/businessprofileperformance.googleapis.com?project=gbp-467810

### Step 3: Verify OAuth Scopes
The current scopes should already include the necessary permissions:
- `https://www.googleapis.com/auth/business.manage`
- `https://www.googleapis.com/auth/plus.business.manage`

If the Performance API requires additional scopes, you may need to re-authenticate users.

### Step 4: Check Quotas
After enabling:
1. Go to: **APIs & Services** > **Enabled APIs**
2. Find **Business Profile Performance API**
3. Click **Quotas** to see usage limits (default is usually 300 requests/minute)

## Testing the Fix

### 1. Restart the Backend Server
```bash
cd server
npm run dev
```

### 2. Test in the Application
1. Login to the application
2. Go to **Audit Tool** page
3. Select a business location
4. Click **Refresh** button
5. You should now see performance metrics and charts

### 3. Check Server Logs
Look for these log messages:
- `🌐 Fetching performance metrics from Business Profile Performance API v1`
- `📡 Business Profile Performance API Response Status: 200`
- `✅ Success with Business Profile Performance API v1`
- `📊 Retrieved X days of metrics`

### 4. Verify in Google Cloud Console
After testing:
1. Go back to **APIs & Services** > **Enabled APIs**
2. Click **Business Profile Performance API**
3. View the usage graph - you should now see API calls being made

## Expected Behavior After Fix

✅ Audit tool loads real performance data
✅ Charts show impressions, views, calls, website clicks, directions
✅ No "data unavailable" error messages
✅ Google Cloud Console shows API usage (no longer 0%)
✅ Real-time metrics update every 5 minutes (if auto-refresh is enabled)

## Troubleshooting

### If you still see "no data available":

1. **Check API is Enabled**
   - Verify Business Profile Performance API is enabled in Cloud Console

2. **Check Authentication**
   - User must be authenticated with proper Google Business Profile access
   - May need to re-authenticate after enabling new API

3. **Check Location ID**
   - Verify the location ID is correct format
   - Should be just the numeric ID, not the full path

4. **Check Server Logs**
   - Look for error messages in the terminal where backend is running
   - Common errors: 403 (API not enabled), 401 (auth issue), 404 (wrong location ID)

5. **Check API Quotas**
   - Make sure you haven't exceeded quota limits
   - Default: 300 requests/minute should be sufficient

## Files Modified

- `server/server.js` (line 2362-2490): Updated `/api/locations/:locationId/audit/performance` endpoint
- Changed from deprecated `mybusiness.googleapis.com/v4` to `businessprofileperformance.googleapis.com/v1`
- Implemented proper date formatting and metric aggregation

## Important Notes

- ⚠️ The Google My Business API v4 is **deprecated** and will not work
- ✅ You MUST use Business Profile Performance API v1 going forward
- 📊 The new API provides more detailed metrics than the old one
- 🔄 Users may need to re-authenticate after enabling the new API
- 🚀 Once enabled, metrics will start appearing immediately

## Next Steps

1. **Enable the API** in Google Cloud Console (most important!)
2. **Restart backend server**
3. **Test the audit tool** with a real business location
4. **Monitor API usage** in Cloud Console to ensure it's working
5. **Check quotas** if you have many users - may need to request quota increase

---

**Status**: ✅ Code Fixed - Waiting for API to be enabled in Google Cloud Console
