# OpenAI API Setup Guide

This application uses OpenAI's API to generate engaging content for your Google Business Profile posts. Without an API key, the app will use high-quality template content instead.

## Steps to Enable AI-Generated Content

### 1. Get an OpenAI API Key

1. Visit [OpenAI's API Keys page](https://platform.openai.com/api-keys)
2. Sign in to your OpenAI account (create one if needed)
3. Click "Create new secret key"
4. Give your key a descriptive name (e.g., "GBP Profile Pulse")
5. Copy the generated key (starts with `sk-proj-` or `sk-`)

⚠️ **Important**: Copy the key immediately - you won't be able to see it again!

### 2. Add the API Key to Your Environment

1. Open the `.env` file in the project root
2. Find the line: `VITE_OPENAI_API_KEY=`
3. Add your key after the equals sign:
   ```
   VITE_OPENAI_API_KEY=sk-proj-your-actual-key-here
   ```
4. Save the file

### 3. Restart the Development Server

```bash
# Stop the current server (Ctrl+C)
# Then restart:
npm run dev
```

## Setting Up OpenAI Billing

OpenAI requires billing to be set up to use the API:

1. Go to [OpenAI Billing](https://platform.openai.com/account/billing)
2. Add a payment method
3. Set usage limits to control costs
4. Start with a small amount ($5-10) to test

## Usage and Costs

- **Content Generation**: ~$0.001-0.002 per post
- **Review Responses**: ~$0.0005-0.001 per response
- **Monthly estimate**: $1-5 for typical usage

## Troubleshooting

### "Invalid API Key" Errors
- Double-check the key is copied correctly (no extra spaces)
- Ensure billing is set up on your OpenAI account
- Try creating a new API key

### "Rate Limited" Errors
- The app has built-in rate limiting
- If you hit limits, the app will automatically retry
- Consider upgrading your OpenAI plan if needed

### No API Key Configured
- The app will show warnings in the console
- All posts will use high-quality template content
- No functionality is lost, just no AI generation

## Security Notes

- ✅ API keys are now only loaded from environment variables
- ✅ Never commit API keys to version control
- ✅ The `.env` file should not be shared publicly
- ✅ Use different API keys for development and production

## Testing Your Setup

1. Open the browser developer console (F12)
2. Look for OpenAI-related messages:
   - ✅ "OpenAI API key loaded successfully"
   - ✅ "OpenAI API key is valid and working!"
   - ⚠️ "OpenAI API key not configured" (fallback mode)

You can also test by creating a post - AI-generated content will be more personalized than template content.