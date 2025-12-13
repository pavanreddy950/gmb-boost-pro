# Google Review Link Format Fix - g.page/r/xxx/review

## 🎯 Target Format

The correct Google review link format is:
```
https://g.page/r/CeM_XaUCp_ZxEBM/review
```

Where `CeM_XaUCp_ZxEBM` is a base64url-encoded identifier.

---

## 🔧 What We Fixed

### File: `server/routes/qrCodes.js`

**Updated Method 3 (Business Information API)** to:
1. ✅ Check for `profile.reviewUri` (direct review link)
2. ✅ Check for `websiteUri` containing `g.page` link
3. ✅ Extract CID from maps URLs and convert to `g.page` format
4. ✅ Check for `mapsUri` in metadata
5. ✅ Fallback to Place ID format
6. ✅ Added helper function `constructGPageLinkFromCID()`

**Added new debug endpoint:**
```
POST /api/qr-codes/debug-review-link
```
Tests all 3 Google API methods and shows what data is returned.

---

## 🧪 How to Debug & Test

### Step 1: Start Backend Server
```bash
cd server
npm run dev
```

### Step 2: Open Debug Tool
Open this file in your browser:
```
test-review-link-debug.html
```

### Step 3: Get Your Access Token
1. Login to your app
2. Open browser console (F12)
3. Run:
   ```javascript
   googleBusinessProfileService.getAccessToken()
   ```
4. Copy the token

### Step 4: Test Review Link Fetching
1. Paste your Account ID (e.g., `106433552101751461082`)
2. Paste your Location ID (e.g., `14977377147025961194`)
3. Paste your Access Token
4. Click **"Test All Methods"**

### Step 5: Analyze Results
The debug tool will show:
- ✅ Which API methods succeeded
- 📄 What data Google returned
- 🔗 What review links were found
- 📊 All available fields (placeId, websiteUri, mapsUri, etc.)

---

## 📊 API Methods Priority

### Method 1: GMB v4 API
```
GET https://mybusiness.googleapis.com/v4/accounts/{accountId}/locations/{locationId}
```
**Looks for:** `newReviewUrl`

### Method 2: Account Management API
```
GET https://mybusinessaccountmanagement.googleapis.com/v1/accounts/{accountId}/locations/{locationId}
```
**Looks for:** `newReviewUri`

### Method 3: Business Information API (ENHANCED)
```
GET https://mybusinessbusinessinformation.googleapis.com/v1/locations/{locationId}
```
**Looks for (in priority order):**
1. `profile.reviewUri` - Direct review URI
2. `newReviewUri` - Direct review URI
3. `websiteUri` - May contain g.page or maps link
4. `metadata.mapsUri` - Maps link with CID
5. `metadata.placeId` - Place ID for fallback

---

## 🔄 Review Link Conversion Logic

### If we get a CID (Customer ID):
```javascript
// Example CID: 1234567890123456789
const cid = '1234567890123456789';

// Convert to hex
const hexCid = BigInt(cid).toString(16).toUpperCase();
// Result: "112210F47DE98115"

// Pad if needed
const paddedHex = hexCid.length % 2 === 0 ? hexCid : '0' + hexCid;

// Convert to buffer then base64url
const buffer = Buffer.from(paddedHex, 'hex');
const encodedCid = buffer.toString('base64url');
// Result: "ESIQPkfeYRFU" (example)

// Final link
const reviewLink = `https://g.page/r/${encodedCid}/review`;
```

### Example CID Extraction:
From: `https://maps.google.com/maps?cid=1234567890123456789`  
To: `https://g.page/r/CeM_XaUCp_ZxEBM/review`

---

## 🎯 Expected Outcomes

### Best Case (Direct Review Link):
```json
{
  "profile": {
    "reviewUri": "https://g.page/r/CeM_XaUCp_ZxEBM/review"
  }
}
```
✅ Use directly - no conversion needed!

### Good Case (websiteUri with g.page):
```json
{
  "websiteUri": "https://g.page/r/CeM_XaUCp_ZxEBM/review"
}
```
✅ Use directly!

### Common Case (websiteUri with CID):
```json
{
  "websiteUri": "https://maps.google.com/maps?cid=1234567890"
}
```
✅ Extract CID → Convert to g.page format

### Fallback Case (Place ID):
```json
{
  "metadata": {
    "placeId": "ChIJAQABAQABQARABBBBBB"
  }
}
```
✅ Use: `https://search.google.com/local/writereview?placeid={placeId}`

---

## 🐛 Troubleshooting

### Issue: No review link found

**Check 1: Verify location is claimed**
- Unclaimed locations may not have review links

**Check 2: Check business verification status**
- Unverified businesses may have limited data

**Check 3: Look at debug output**
```
Open test-review-link-debug.html
Run the test
Check which APIs returned data
Look for any of these fields:
  - newReviewUrl
  - newReviewUri  
  - websiteUri
  - metadata.mapsUri
  - metadata.placeId
```

### Issue: g.page link doesn't work

**Possible causes:**
1. CID encoding is incorrect
2. Location doesn't support g.page format
3. Business is not verified

**Fallback:** Use Place ID format instead
```
https://search.google.com/local/writereview?placeid={placeId}
```

---

## 📝 What to Look For in Debug Output

### Priority 1: Direct Review Links
```json
"profile": {
  "reviewUri": "https://g.page/r/..."
}
// OR
"newReviewUri": "https://g.page/r/..."
// OR
"newReviewUrl": "https://g.page/r/..."
```
✅ **BEST** - Use these directly!

### Priority 2: Website URI
```json
"websiteUri": "https://g.page/r/..." 
// OR
"websiteUri": "https://maps.google.com/maps?cid=..."
```
✅ **GOOD** - Extract g.page or convert CID

### Priority 3: Metadata Links
```json
"metadata": {
  "mapsUri": "https://maps.google.com/maps?cid=...",
  "placeId": "ChIJ..."
}
```
✅ **OK** - Convert CID or use Place ID

---

## 🚀 Next Steps

1. **Restart backend server** (to load new code)
   ```bash
   cd server
   npm run dev
   ```

2. **Open debug tool**
   ```
   test-review-link-debug.html
   ```

3. **Test with your location**
   - Get Account ID, Location ID, Access Token
   - Run the debug test
   - Share the output with me

4. **Identify which field has the review link**
   - Look for `g.page/r/` format
   - Or maps link with `cid=`
   - Or `placeId`

5. **I'll update the code** based on what Google actually returns for your locations

---

## 📚 Related Files

### Modified:
- ✏️ `server/routes/qrCodes.js` - Enhanced review link fetching
  - Added profile.reviewUri check
  - Improved websiteUri parsing
  - Better CID extraction
  - Added debug endpoint

### New:
- 🆕 `test-review-link-debug.html` - Debug tool

### Related:
- 📄 `server/routes/googleReviewLink.js` - Similar logic (can be unified)

---

## 💡 Tips

1. **Different locations may return different fields**
   - Some have `profile.reviewUri`
   - Some only have `websiteUri`
   - Some only have `placeId`

2. **g.page links are preferred**
   - Shorter URLs
   - Better for QR codes
   - Direct to review form

3. **Place ID links work universally**
   - Always available for verified businesses
   - Longer URLs but reliable

4. **Test multiple locations**
   - Different businesses may return different data structures

---

**Last Updated:** December 10, 2024  
**Status:** ✅ Enhanced - Ready for Testing  
**Version:** 1.2
