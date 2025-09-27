# 🚀 GMP Profile Pulse - Deployment Guide

## 📋 Pre-Deployment Checklist

### 1. **Domain Setup**
- [ ] Domain/Subdomain configured on Hostinger
- [ ] SSL certificate enabled
- [ ] DNS pointing to hosting server

### 2. **Google Cloud Console Configuration**
- [ ] Update OAuth redirect URI: `https://yourdomain.com/auth/google/callback`
- [ ] Add domain to authorized origins: `https://yourdomain.com`
- [ ] Enable required APIs:
  - Google My Business API
  - Google Business Profile API
  - Google My Business Account Management API

### 3. **Environment Variables**
Copy `server/.env.production` to `server/.env` and fill in:
```bash
NODE_ENV=production
PORT=8080
GOOGLE_CLIENT_ID=your_actual_client_id
GOOGLE_CLIENT_SECRET=your_actual_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
FRONTEND_URL=https://yourdomain.com
```

## 🔧 Build Process

### Step 1: Prepare Production Build
```bash
# In project root
npm run build:production
```

### Step 2: Test Locally (Optional)
```bash
npm run start:production
```

## 📤 Upload to Hostinger

### Files to Upload:
1. **Server files**: Upload entire `server/` folder
2. **Built frontend**: The `dist/` folder is referenced by server
3. **Dependencies**: Run `npm install` on server

### File Structure on Server:
```
/public_html/
├── server/
│   ├── server.js (main entry point)
│   ├── package.json
│   ├── .env (your production environment)
│   └── node_modules/ (install dependencies)
├── dist/ (React build files)
│   ├── index.html
│   ├── assets/
│   └── ...
```

## ⚙️ Hostinger Configuration

### Option 1: Node.js Hosting (Recommended)
If Hostinger supports Node.js:
1. Set entry point to: `server/server.js`
2. Set Node.js version to: 18+
3. Install dependencies: `npm install`
4. Set environment variables in hosting panel

### Option 2: Traditional Hosting + External Backend
If no Node.js support:
1. Upload `dist/` files to public_html
2. Deploy backend to Vercel/Railway/Render
3. Update CORS and API URLs

## 🔄 Environment Variables Setup

In Hostinger control panel, set:
```bash
NODE_ENV=production
PORT=8080
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=https://yourdomain.com/auth/google/callback
FRONTEND_URL=https://yourdomain.com
```

## 🌐 URL Structure (Single Domain)
- **Frontend**: `https://yourdomain.com/*`
- **API**: `https://yourdomain.com/api/*`
- **OAuth**: `https://yourdomain.com/auth/*`
- **Health Check**: `https://yourdomain.com/health`

## ✅ Post-Deployment Testing

1. **Visit**: `https://yourdomain.com/health`
   - Should return server status

2. **Test Google OAuth**:
   - Try connecting Google Business Profile
   - Check for proper redirects

3. **Test API Endpoints**:
   - Login functionality
   - Profile data loading
   - Auto-posting features

## 🔧 Troubleshooting

### Common Issues:

**CORS Errors**: 
- Update `allowedOrigins` in server.js
- Add your domain to Google Cloud Console

**OAuth Redirect Mismatch**:
- Update redirect URI in Google Cloud Console
- Check `.env` GOOGLE_REDIRECT_URI

**API Not Found**:
- Verify file structure
- Check server logs for errors

**Static Files Not Loading**:
- Ensure `dist/` folder is uploaded
- Verify `NODE_ENV=production`

## 📞 Support URLs
- **Health Check**: `https://yourdomain.com/health`
- **OAuth URL**: `https://yourdomain.com/auth/google/url`
- **API Base**: `https://yourdomain.com/api/`

---

🎉 **Your app is now ready for deployment!**