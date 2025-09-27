# Environment Setup Guide

## Frontend Environment Variables

Create a `.env` file in the project root with the following variables:

```bash
# OpenAI Configuration (Required)
VITE_OPENAI_API_KEY=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

# Backend Configuration
VITE_BACKEND_URL=https://scale1234-hnhpfeb6auddawez.canadacentral-01.azurewebsites.net

# Firebase Configuration (if needed)
VITE_FIREBASE_API_KEY=your_firebase_api_key_here
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_auth_domain_here
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id_here

# Development Settings
VITE_NODE_ENV=development
```

## How to Get OpenAI API Key

1. Go to [OpenAI Platform](https://platform.openai.com/)
2. Create an account or login
3. Navigate to API Keys section
4. Create a new secret key
5. Copy the key and paste it as the value for `VITE_OPENAI_API_KEY`

## Important Notes

- The OpenAI API key is required for content generation
- Without it, the system will use fallback content templates
- Keep your API keys secure and never commit them to version control
- The `.env` file should be added to your `.gitignore` file

## Verification

After setting up the environment variables:

1. Restart your development server
2. Check the browser console for "✅ OpenAI API key loaded successfully" message
3. If you see "⚠️ OpenAI API key not found in environment variables", the setup is incorrect
