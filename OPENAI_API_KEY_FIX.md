# 🔑 OpenAI API Key Fix Guide

## The Problem
You're getting a **401 Unauthorized** error, which means your OpenAI API key is invalid, expired, or doesn't have the right permissions.

## 🚀 Quick Fix Options

### Option 1: Get a Valid API Key (Recommended)

1. **Go to OpenAI Platform**: https://platform.openai.com/account/api-keys
2. **Login** to your OpenAI account
3. **Delete your old key** (if you have one that's not working)
4. **Create new API key**:
   - Click "Create new secret key" 
   - Give it a name like "GMP Profile Pulse"
   - Copy the key immediately (starts with `sk-`)

5. **Update your .env file**:
   ```bash
   VITE_OPENAI_API_KEY=sk-your-new-working-key-here
   ```

6. **Restart your dev server**: `npm run dev`

### Option 2: Temporary Hardcoded Key (For Testing Only)

**⚠️ ONLY USE THIS FOR TESTING - NEVER COMMIT TO VERSION CONTROL**

1. Open `src/lib/openaiService.ts`
2. Find line 31 with the comment `// this.apiKey = 'sk-your-actual-working-api-key-here';`
3. Uncomment it and replace with your valid key:
   ```typescript
   this.apiKey = 'sk-your-actual-working-key-here';
   ```

## 💳 Common Issues & Solutions

### Issue: "Invalid API Key"
- **Check**: Make sure you copied the full key without extra spaces
- **Fix**: Create a brand new API key

### Issue: "Billing Required" 
- **Check**: Go to https://platform.openai.com/account/billing
- **Fix**: Add a payment method and some credits ($5-10 is plenty)

### Issue: "Project-based Key Not Working"
- **Check**: Your key starts with `sk-proj-` but still fails
- **Fix**: Create a regular API key instead (not project-specific)

## 🧪 Testing Your Fix

After updating your API key, you should see:
```
✅ OpenAI API key loaded successfully
🔑 API key format: Legacy key (or Project-based key)
🤖 Generating content with OpenAI...
✅ Content generated successfully
```

## 🔒 Security Notes

- **Never commit** API keys to version control
- **Use .env files** for local development  
- **Use environment variables** for production
- **Regenerate keys** if accidentally exposed

## Still Having Issues?

If you're still getting errors:

1. **Check OpenAI Status**: https://status.openai.com/
2. **Verify Billing**: Make sure you have active credits
3. **Try Different Model**: The code uses `gpt-3.5-turbo` - make sure you have access
4. **Check Rate Limits**: Wait a few minutes if you've been testing a lot

## Fallback Mode

If you can't get OpenAI working right now, the system will automatically use high-quality template content instead. Posts will still be created successfully!
