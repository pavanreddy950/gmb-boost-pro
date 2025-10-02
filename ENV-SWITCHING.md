# Environment Switching Guide

This project supports easy switching between local development and Azure production environments.

## Frontend (React + Vite)

### Environment Files

- **`.env`** - Default configuration (Azure production URLs)
- **`.env.local`** - Local development overrides (git-ignored)
- **`.env.development`** - Development mode settings
- **`.env.production`** - Production build settings

### How to Switch

**For Local Development:**
1. The `.env.local` file is already configured for local development
2. Simply run `npm run dev` - it will automatically use `http://localhost:5000`

**For Azure Production:**
1. Delete or rename `.env.local`
2. Run `npm run dev` - it will use the Azure backend URL from `.env`

**Or use environment-specific commands:**
```bash
# Local development
npm run dev              # Uses .env.local if it exists, otherwise .env

# Production build
npm run build            # Uses .env.production
```

### Current Configuration

- **Local:** `VITE_BACKEND_URL=http://localhost:5000`
- **Azure:** `VITE_BACKEND_URL=https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net`

---

## Backend (Express + Node.js)

### Environment Files

- **`server/.env.local`** - Local development configuration
- **`server/.env.azure`** - Azure production configuration

### How to Switch

The backend uses a `RUN_MODE` environment variable to switch between local and Azure modes.

**For Local Development:**
1. The `server/.env.local` file sets `RUN_MODE=LOCAL`
2. Run `npm run dev` in the server directory
3. Server will run on `http://localhost:5000`

**For Azure Production:**
1. Set `RUN_MODE=AZURE` or `NODE_ENV=production`
2. Or use `server/.env.azure` configuration

**Configuration Loading:**
- The backend automatically loads `.env.local` first
- Falls back to `.env.azure` if `.env.local` doesn't exist
- Uses `RUN_MODE` to determine CORS origins and URLs

### Current Configuration

**Local Mode (`server/.env.local`):**
```
RUN_MODE=LOCAL
FRONTEND_URL=http://localhost:3000
BACKEND_URL=http://localhost:5000
```

**Azure Mode (`server/.env.azure`):**
```
RUN_MODE=AZURE
FRONTEND_URL=https://delightful-sea-062191a0f.2.azurestaticapps.net
BACKEND_URL=https://pavan-client-backend-bxgdaqhvarfdeuhe.canadacentral-01.azurewebsites.net
```

---

## Quick Start for Local Development

1. **Start Backend:**
   ```bash
   cd server
   npm run dev
   # Backend will run on http://localhost:5000 in LOCAL mode
   ```

2. **Start Frontend:**
   ```bash
   npm run dev
   # Frontend will run on http://localhost:3000 and connect to http://localhost:5000
   ```

3. **Verify:**
   - Backend should show: `[SERVER] Config mode: LOCAL`
   - Frontend should connect to `http://localhost:5000`

---

## Quick Start for Azure Production

1. **Backend:**
   - Delete or rename `server/.env.local`
   - Or set `RUN_MODE=AZURE` in environment variables
   - Deploy to Azure App Service

2. **Frontend:**
   - Delete or rename `.env.local`
   - Run `npm run build` (uses `.env.production`)
   - Deploy to Azure Static Web Apps

---

## Troubleshooting

### Users not loading in admin panel?
- Make sure `.env.local` exists with `VITE_BACKEND_URL=http://localhost:5000`
- Check that backend is running on port 5000
- Verify backend shows `[SERVER] Config mode: LOCAL`
- Check browser console for CORS errors

### CORS errors?
- Backend automatically configures CORS based on `RUN_MODE`
- LOCAL mode allows `http://localhost:3000-3009`
- AZURE mode allows Azure URLs only

### Wrong backend URL?
- Check which `.env` file is being used
- `.env.local` takes priority over `.env`
- Delete `.env.local` to use Azure URLs
- Check `import.meta.env.VITE_BACKEND_URL` in browser console
