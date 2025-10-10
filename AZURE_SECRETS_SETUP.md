# 🔒 Azure Secrets Configuration Guide

## ⚠️ IMPORTANT: Never Commit Secrets to Git!

This guide explains how to securely configure secrets for your Azure deployment.

---

## 🎯 Quick Setup (Azure App Service)

### Method 1: Azure Portal Configuration (Recommended)

1. Go to **Azure Portal** → Your App Service
2. Navigate to **Settings** → **Configuration**
3. Click **+ New application setting** for each secret:

#### Required Secrets:

```plaintext
GOOGLE_CLIENT_ID = your-google-client-id
GOOGLE_CLIENT_SECRET = your-google-client-secret
RAZORPAY_KEY_ID = your-razorpay-key-id
RAZORPAY_KEY_SECRET = your-razorpay-secret
AZURE_OPENAI_API_KEY = your-azure-openai-key
SUPABASE_URL = https://your-project.supabase.co
SUPABASE_SERVICE_KEY = your-supabase-service-role-key
TOKEN_ENCRYPTION_KEY = your-32-char-encryption-key
```

4. Click **Save** → **Continue** to restart the app
5. Your secrets are now securely stored in Azure!

---

### Method 2: Azure CLI (For Automation)

```bash
# Set app name and resource group
APP_NAME="your-app-service-name"
RESOURCE_GROUP="your-resource-group"

# Set secrets one by one
az webapp config appsettings set --name $APP_NAME --resource-group $RESOURCE_GROUP \
  --settings \
  GOOGLE_CLIENT_ID="your-google-client-id" \
  GOOGLE_CLIENT_SECRET="your-google-client-secret" \
  RAZORPAY_KEY_ID="your-razorpay-key" \
  RAZORPAY_KEY_SECRET="your-razorpay-secret" \
  AZURE_OPENAI_API_KEY="your-openai-key" \
  SUPABASE_URL="https://your-project.supabase.co" \
  SUPABASE_SERVICE_KEY="your-supabase-service-key" \
  TOKEN_ENCRYPTION_KEY="your-encryption-key"
```

---

## 🔐 Method 3: Azure Key Vault (Most Secure - Production)

### Step 1: Create Key Vault

```bash
# Create Key Vault
az keyvault create \
  --name your-keyvault-name \
  --resource-group your-resource-group \
  --location canadacentral

# Add secrets to Key Vault
az keyvault secret set --vault-name your-keyvault-name --name "google-client-secret" --value "your-secret"
az keyvault secret set --vault-name your-keyvault-name --name "razorpay-key-secret" --value "your-secret"
az keyvault secret set --vault-name your-keyvault-name --name "supabase-service-key" --value "your-secret"
az keyvault secret set --vault-name your-keyvault-name --name "token-encryption-key" --value "your-key"
```

### Step 2: Enable Managed Identity

```bash
# Enable system-assigned managed identity for your App Service
az webapp identity assign \
  --name your-app-service-name \
  --resource-group your-resource-group
```

### Step 3: Grant Access

```bash
# Grant App Service access to Key Vault
az keyvault set-policy \
  --name your-keyvault-name \
  --object-id <managed-identity-principal-id> \
  --secret-permissions get list
```

### Step 4: Reference Secrets in App Settings

```bash
# In Azure Portal → App Service → Configuration, use:
GOOGLE_CLIENT_SECRET = @Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/google-client-secret/)
RAZORPAY_KEY_SECRET = @Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/razorpay-key-secret/)
SUPABASE_SERVICE_KEY = @Microsoft.KeyVault(SecretUri=https://your-vault.vault.azure.net/secrets/supabase-service-key/)
```

---

## 📋 Local Development Setup

### 1. Copy the example file:

```bash
cd server
cp .env.azure.example .env.azure
```

### 2. Fill in your actual values

Edit `.env.azure` with your real credentials.

### 3. **NEVER** commit .env.azure to git!

The `.gitignore` file already excludes:
- `.env.azure`
- `.env.local`
- `.env.production`
- All other `.env.*` files

---

## 🔍 How to Get Your Secrets

### Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. APIs & Services → Credentials
3. Copy Client ID and Client Secret

### Razorpay Keys
1. Go to [Razorpay Dashboard](https://dashboard.razorpay.com/)
2. Settings → API Keys
3. Generate **Live** keys for production

### Azure OpenAI Key
1. Go to [Azure Portal](https://portal.azure.com/)
2. Your OpenAI Resource → Keys and Endpoint
3. Copy Key 1 or Key 2

### Supabase Credentials
1. Go to [Supabase Dashboard](https://app.supabase.com/)
2. Project Settings → API
3. Copy **Project URL** and **service_role key** (NOT anon key!)

### Token Encryption Key
Generate a secure 32-character key:

```bash
# On Linux/Mac:
openssl rand -base64 32

# On Windows PowerShell:
-join ((65..90) + (97..122) + (48..57) | Get-Random -Count 32 | % {[char]$_})
```

---

## ✅ Security Checklist

- [ ] `.env.azure` is in `.gitignore`
- [ ] Never commit real secrets to Git
- [ ] Use Azure App Service Configuration for production
- [ ] Consider Azure Key Vault for maximum security
- [ ] Rotate secrets regularly
- [ ] Use different keys for dev/staging/production
- [ ] Enable Azure Monitor for secret access logging

---

## 🚨 If You Accidentally Committed Secrets

### Immediate Actions:

1. **Rotate ALL exposed secrets immediately**
   - Generate new Google OAuth credentials
   - Create new Razorpay keys
   - Regenerate Azure OpenAI keys
   - Create new Supabase service key

2. **Remove from Git history**:

```bash
# Remove the file from Git tracking (keeps local copy)
git rm --cached server/.env.azure

# Remove from all history (nuclear option)
git filter-branch --force --index-filter \
  "git rm --cached --ignore-unmatch server/.env.azure" \
  --prune-empty --tag-name-filter cat -- --all
```

3. **Force push** (⚠️ Use with caution):

```bash
git push origin --force --all
```

4. **Inform your team** to pull the cleaned history

---

## 📖 Additional Resources

- [Azure App Service Configuration](https://learn.microsoft.com/en-us/azure/app-service/configure-common)
- [Azure Key Vault Best Practices](https://learn.microsoft.com/en-us/azure/key-vault/general/best-practices)
- [GitHub Secrets](https://docs.github.com/en/actions/security-guides/encrypted-secrets)

---

## 🎯 Summary

✅ **DO:**
- Use Azure App Service Configuration or Key Vault
- Keep `.env.azure` in `.gitignore`
- Commit `.env.azure.example` with placeholders
- Rotate secrets regularly

❌ **DON'T:**
- Commit `.env.azure` with real secrets
- Share secrets in Slack/email/chat
- Use production secrets in development
- Hard-code secrets in source code
