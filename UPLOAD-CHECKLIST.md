# 📤 Hostinger Upload Checklist

## 🗂️ Files to Upload to Your Domain

### **Required Folders:**
```
/public_html/ (or your domain folder)
├── server/           ← Upload entire server folder
│   ├── server.js
│   ├── start-production.js
│   ├── package.json
│   ├── .env.production (rename to .env and fill in values)
│   └── (upload all server files)
└── dist/            ← Upload entire dist folder (React build)
    ├── index.html
    ├── assets/
    └── (all build files)
```

## 🔧 Setup Steps on Hostinger

### Step 1: Upload Files
1. **Via File Manager or FTP:**
   - Upload `server/` folder to your domain directory
   - Upload `dist/` folder to your domain directory

### Step 2: Configure Environment
1. **Copy** `server/.env.production` to `server/.env`
2. **Edit** `server/.env` with your actual values:
   ```bash
   NODE_ENV=production
   PORT=8080
   GOOGLE_CLIENT_ID=your_actual_google_client_id
   GOOGLE_CLIENT_SECRET=your_actual_google_client_secret
   GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
   FRONTEND_URL=https://yourdomain.com
   ```

### Step 3: Install Dependencies (if Node.js hosting)
1. **In Terminal/SSH:**
   ```bash
   cd server
   npm install --production
   ```

### Step 4: Start Application
1. **Set Entry Point:** `server/start-production.js`
2. **Or run manually:** `cd server && npm run start:production`

## 🌐 Update Google Cloud Console

### OAuth Settings:
- **Authorized redirect URIs:** `https://yourdomain.com/auth/google/callback`
- **Authorized origins:** `https://yourdomain.com`

## ✅ Test Your Deployment

1. **Health Check:** `https://yourdomain.com/health`
2. **App Access:** `https://yourdomain.com`
3. **API Test:** `https://yourdomain.com/api/accounts`

## 🚨 If Hostinger Doesn't Support Node.js

### Alternative: Frontend Only + External Backend
1. **Upload only `dist/` folder contents to public_html**
2. **Deploy server to:**
   - Vercel (recommended)
   - Railway
   - Render
   - Heroku

3. **Update frontend environment:**
   ```bash
   VITE_BACKEND_URL=https://your-backend-url.vercel.app
   ```

---

🎉 **Your GMP Profile Pulse app is ready to go live!**