# Phone Number Feature - Implementation & Cache Fix

## Problem Identified

The phone number feature was implemented correctly in the backend, but the frontend was using **cached data** that was stored **before** the server fix was applied. The cache had a 30-minute TTL (Time To Live) and was persisted in browser localStorage.

### Root Cause
1. Backend was correctly extracting `phoneNumbers.primaryPhone` from Google Business Profile API
2. Frontend cache service stored account data in localStorage with 30-minute expiration
3. Even after server restart, frontend continued using old cached data without `phoneNumber` field
4. Cache key: `accounts:OBm8qZc0jOWcY53x6rQuX4gKKnQ2` (visible in console logs)

## Changes Made

### 1. Backend - Phone Number Extraction (server/server.js)
**Lines 1508, 1537-1586**

Fixed the phone number extraction to handle Google's actual data structure:

```javascript
// Fixed readMask - removed invalid fields
const readMask = 'name,title,storefrontAddress,websiteUri,phoneNumbers,categories,latlng,metadata,profile,regularHours,serviceArea,labels,languageCode,openInfo,specialHours';

// Phone number extraction logic
if (location.phoneNumbers) {
  // Google returns: { primaryPhone: '077197 56319' }
  if (typeof location.phoneNumbers === 'object' && !Array.isArray(location.phoneNumbers)) {
    if (location.phoneNumbers.primaryPhone) {
      phoneNumber = location.phoneNumbers.primaryPhone;
    }
  }
}
```

**Console logs added:** Look for 📞 emoji in server logs to track phone extraction

### 2. Frontend - Cache Management

#### A. Cache Service Enhancement ([src/lib/gbpCacheService.ts](src/lib/gbpCacheService.ts))
**Lines 178-186**

Added method to clear all GBP data caches:

```typescript
clearAllGBPData(): void {
  this.invalidatePattern('accounts:.*');
  this.invalidatePattern('locations:.*');
  this.invalidatePattern('reviews:.*');
  this.invalidatePattern('posts:.*');
  console.log('[Cache] Cleared all GBP data caches');
  this.saveCacheToStorage();
}
```

#### B. Google Business Profile Service ([src/lib/googleBusinessProfile.ts](src/lib/googleBusinessProfile.ts))
**Lines 765-778**

Added `forceRefresh` parameter to bypass cache:

```typescript
async getBusinessAccounts(forceRefresh: boolean = false): Promise<BusinessAccount[]> {
  if (!forceRefresh) {
    const cachedAccounts = gbpCache.getCachedAccounts(this.currentUserId);
    if (cachedAccounts) {
      return cachedAccounts;
    }
  } else {
    console.log('🔄 Force refresh requested - bypassing cache');
    gbpCache.clearAllGBPData();
  }
  // ... fetch fresh data
}
```

#### C. React Hook ([src/hooks/useGoogleBusinessProfile.ts](src/hooks/useGoogleBusinessProfile.ts))
**Lines 61, 379-383**

Updated to support force refresh:

```typescript
const refreshAccounts = useCallback(async (forceRefresh: boolean = false) => {
  if (isConnected) {
    await loadBusinessAccounts(forceRefresh);
  }
}, [isConnected, loadBusinessAccounts]);
```

### 3. Frontend - Phone Number Display ([src/components/ProfileDetails/AutoPostingTab.tsx](src/components/ProfileDetails/AutoPostingTab.tsx))
**Lines 1110-1132**

Removed manual input, made phone number read-only:

```typescript
{config.button?.type === 'call_now' && (
  <div className="space-y-2 sm:space-y-3">
    <Label>Business Phone Number</Label>
    <div className="p-3 bg-muted rounded-md border border-border">
      <p className="text-sm font-medium">
        {location.phoneNumber || 'No phone number found'}
      </p>
      <p className="text-xs text-muted-foreground mt-1">
        {location.phoneNumber
          ? '✅ Automatically fetched from your Google Business Profile'
          : '⚠️ No phone number found in your Google Business Profile'
        }
      </p>
    </div>
  </div>
)}
```

## How to Fix the Cache Issue

### Option 1: Use Browser Console (Quick)

1. Open your app in the browser
2. Press **F12** to open Developer Console
3. Go to **Console** tab
4. Paste this code:

```javascript
localStorage.removeItem('gbp_cache');
sessionStorage.clear();
window.location.reload();
```

5. Press **Enter**

### Option 2: Use Clear Cache HTML Page (User-Friendly)

1. Open the file: `clear-cache.html` in your browser
2. Click "Clear Cache & Reload" button
3. It will automatically clear cache and redirect to your app

### Option 3: Manual Browser Cache Clear

1. Open browser settings
2. Clear browsing data (Ctrl+Shift+Delete)
3. Select "Cached images and files" and "Cookies and site data"
4. Clear data for "Last hour"
5. Reload the app

## Testing Steps

### 1. Clear Cache (use any option above)

### 2. Verify Phone Number in Console

After reload, check browser console for:

```
📞 Processing location phone numbers: {...}
📞 Extracted phone from phoneNumbers.primaryPhone: 077197 56319
📞 Final phoneNumber for location: 077197 56319
```

### 3. Check Frontend Display

Navigate to **Profile Details > Auto Posting** tab:

- If **"Call Now"** button is selected
- You should see: **"Business Phone Number"** section
- Display: `077197 56319` (read-only)
- Message: ✅ Automatically fetched from your Google Business Profile

### 4. Test Automated Post

1. Configure an automated post with "Call Now" button
2. Save the automation
3. Check the created post in your Google Business Profile
4. Verify the post has "Call Now" button with your phone number

## Files Changed Summary

| File | Lines | Change |
|------|-------|--------|
| [server/server.js](server/server.js) | 1508, 1537-1586 | Fixed phone extraction from `phoneNumbers.primaryPhone` |
| [src/lib/gbpCacheService.ts](src/lib/gbpCacheService.ts) | 178-186 | Added `clearAllGBPData()` method |
| [src/lib/googleBusinessProfile.ts](src/lib/googleBusinessProfile.ts) | 765-778 | Added `forceRefresh` parameter to `getBusinessAccounts()` |
| [src/hooks/useGoogleBusinessProfile.ts](src/hooks/useGoogleBusinessProfile.ts) | 61, 379-383 | Updated to support force refresh |
| [src/components/ProfileDetails/AutoPostingTab.tsx](src/components/ProfileDetails/AutoPostingTab.tsx) | 1110-1132 | Made phone number read-only, auto-populated |

## New Files Created

1. **[force-refresh-cache.js](force-refresh-cache.js)** - Browser console script to clear cache
2. **[clear-cache.html](clear-cache.html)** - User-friendly HTML page to clear cache
3. **PHONE_NUMBER_FIX.md** - This documentation

## Console Logs to Monitor

### Backend Logs (look for 📞)
```
📞 Processing location phone numbers: { locationName, hasPhoneNumbers, phoneNumbersValue }
📞 Extracted phone from phoneNumbers.primaryPhone: 077197 56319
📞 Final phoneNumber for location: 077197 56319
```

### Frontend Logs (look for [Cache])
```
[Cache] HIT: accounts:OBm8qZc0jOWcY53x6rQuX4gKKnQ2  ❌ BAD (old data)
[Cache] MISS: accounts:OBm8qZc0jOWcY53x6rQuX4gKKnQ2 ✅ GOOD (fetching fresh)
[Cache] Cleared all GBP data caches                ✅ GOOD (cache cleared)
🔄 Force refresh requested - bypassing cache        ✅ GOOD (force refresh)
```

## Expected Behavior After Fix

1. **Frontend loads** → Checks cache
2. **Cache cleared** → Fetches fresh data from backend
3. **Backend receives request** → Fetches from Google API with `phoneNumbers` in readMask
4. **Google returns data** → `{ phoneNumbers: { primaryPhone: '077197 56319' } }`
5. **Backend transforms** → Extracts to `location.phoneNumber = '077197 56319'`
6. **Frontend receives** → Displays phone number in UI
7. **User saves automation** → Posts created with "Call Now" button + phone number

## Troubleshooting

### Phone number still empty after cache clear?

1. Check backend logs for 📞 markers
2. If no 📞 logs appear, backend isn't being called (still cached)
3. Try **hard refresh**: Ctrl+Shift+R (Windows) or Cmd+Shift+R (Mac)
4. Try incognito/private browsing mode
5. Check network tab for API call to `/api/accounts/.../locations`

### Backend logs show phone extraction but frontend shows empty?

1. Check frontend console for the location object
2. Look for: `console.log('Location data:', location)`
3. Verify `location.phoneNumber` exists in the object
4. If missing, the cache is still being used

### "Call Now" button shows but no phone?

1. Check the automation configuration in database
2. Verify `button.phoneNumber` field is populated
3. Check the actual post creation API call
4. Look for Google API errors in backend logs

## Next Steps

1. ✅ Clear cache using one of the methods above
2. ✅ Verify phone number appears in frontend
3. ✅ Test creating an automated post
4. ✅ Check the post in your actual Google Business Profile
5. ✅ Verify "Call Now" button works

## Support

If issues persist after clearing cache:

1. Provide backend console logs (look for 📞)
2. Provide frontend console logs (look for [Cache])
3. Provide screenshot of Auto Posting tab
4. Provide network tab showing API responses
