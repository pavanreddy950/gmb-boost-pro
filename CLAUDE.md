# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Development Commands

### Frontend (React + Vite + TypeScript)
```bash
# Install dependencies
npm install

# Start development server (runs on localhost:3000)
npm run dev

# Build for production
npm run build

# Build for development mode
npm run build:dev

# Run ESLint
npm run lint

# Preview production build
npm run preview
```

### Backend (Express + Node.js)
```bash
# Navigate to server directory
cd server

# Install dependencies
npm install

# Start development server with nodemon (runs on localhost:5000)
npm run dev

# Start production server
npm start
```

## Architecture Overview

This is a Google Business Profile (GBP) management application with the following key architectural components:

### Frontend Architecture
- **Framework**: React 18 with TypeScript
- **Build Tool**: Vite with SWC plugin
- **UI Framework**: Radix UI components with Tailwind CSS styling (shadcn/ui)
- **Routing**: React Router DOM with protected routes
- **State Management**: React Context (AuthContext, GoogleBusinessProfileContext)
- **Data Fetching**: TanStack React Query
- **Authentication**: Firebase Auth with Google OAuth and email/password

### Backend Architecture
- **Framework**: Express.js with ES modules
- **Authentication**: Google OAuth2 with googleapis library
- **APIs**: Google Business Profile API, Google My Business APIs
- **Storage**: In-memory token storage (Map-based, needs database for production)
- **CORS**: Configured for frontend communication

### Key Components Structure

#### Authentication System
- **AuthContext**: Firebase authentication state management
- **ProtectedRoute**: Route protection wrapper
- **AuthRedirect**: Redirects authenticated users away from auth pages
- **Login/SignupPage**: Authentication UI components

#### Google Business Profile Integration
- **GoogleBusinessProfileContext**: GBP connection state management
- **ConnectionSetup**: Main GBP connection UI component
- **useGoogleBusinessProfile**: Custom hook for GBP operations
- **googleBusinessProfile.ts**: Core GBP service class
- **SimpleGoogleConnection**: Alternative connection component

#### Dashboard Layout
- **DashboardLayout**: Main app layout with sidebar and topbar
- **Sidebar**: Navigation sidebar component
- **Topbar**: Header with user info and controls

#### Core Pages
- **Dashboard**: Main dashboard view
- **ProfileDetails**: Business profile management
- **Posts**: Post management for locations
- **Reviews**: Review management and responses
- **Settings**: App settings with connection management

### Data Flow

1. **Authentication**: Firebase Auth → AuthContext → Protected Routes
2. **GBP Connection**: OAuth flow → Backend server → Token storage → Frontend context
3. **API Calls**: Frontend → Backend server → Google APIs → Response data
4. **State Management**: React Context + React Query for caching

### Environment Configuration

#### Frontend (.env.local)
```bash
VITE_FIREBASE_API_KEY=your_firebase_key
VITE_FIREBASE_AUTH_DOMAIN=your_firebase_domain
VITE_FIREBASE_PROJECT_ID=your_firebase_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_firebase_storage
VITE_FIREBASE_MESSAGING_SENDER_ID=your_firebase_sender_id
VITE_FIREBASE_APP_ID=your_firebase_app_id
VITE_GOOGLE_CLIENT_ID=your_google_client_id
VITE_BACKEND_URL=http://localhost:5000
```

#### Backend (server/.env)
```bash
GOOGLE_CLIENT_ID=your_google_client_id
GOOGLE_CLIENT_SECRET=your_google_client_secret
GOOGLE_REDIRECT_URI=http://localhost:5000/auth/google/callback
PORT=5000
NODE_ENV=development
FRONTEND_URL=http://localhost:3000
```

### Google Cloud Console Requirements

Required APIs:
- Google My Business API
- Google My Business Business Information API
- Google My Business Account Management API
- Google Business Profile API

OAuth 2.0 redirect URIs:
- http://localhost:5000/auth/google/callback (backend)
- http://localhost:3000/auth/google/callback (frontend)

### Key File Locations

#### Configuration Files
- `vite.config.ts` - Vite configuration with path aliases (@/)
- `tailwind.config.ts` - Tailwind CSS configuration
- `tsconfig.json` - TypeScript configuration
- `components.json` - shadcn/ui component configuration

#### Core Services
- `src/lib/firebase.ts` - Firebase authentication setup
- `src/lib/googleBusinessProfile.ts` - Google Business Profile service
- `src/lib/utils.ts` - Utility functions (cn, etc.)

#### Context Providers
- `src/contexts/AuthContext.tsx` - Firebase authentication
- `src/contexts/GoogleBusinessProfileContext.tsx` - GBP state management

#### Custom Hooks
- `src/hooks/useGoogleBusinessProfile.ts` - GBP operations hook
- `src/hooks/useSimpleGoogleAuth.ts` - Alternative Google auth hook
- `src/hooks/use-toast.ts` - Toast notifications

### Testing and Development

#### Development Workflow
1. Start backend server: `cd server && npm run dev`
2. Start frontend: `npm run dev`
3. Test GBP connection via Settings > Connections tab
4. Test authentication via login/signup pages

#### Common Development Tasks
- Adding new UI components: Use shadcn/ui CLI or create in `src/components/ui/`
- Adding new pages: Create in `src/pages/` and add route in `App.tsx`
- Updating GBP integration: Modify `src/lib/googleBusinessProfile.ts`
- Styling: Use Tailwind classes, components use cn() utility for class merging

### Production Considerations

#### Backend
- Replace in-memory token storage with proper database
- Implement user authentication and session management
- Use HTTPS for OAuth flows
- Add proper error logging and monitoring

#### Frontend
- Build optimization already configured with Vite
- Environment variables for production URLs
- Firebase hosting or similar for deployment

#### Security
- Never commit .env files
- Use proper token encryption for production
- Implement proper CORS policies
- Regular dependency updates for security patches

### Dependencies of Note

#### Frontend Key Dependencies
- `@tanstack/react-query` - Data fetching and caching
- `@radix-ui/*` - Accessible UI primitives (via shadcn/ui)
- `firebase` - Authentication service
- `react-router-dom` - Client-side routing
- `lucide-react` - Icon library
- `react-hook-form` + `@hookform/resolvers` - Form management
- `zod` - Runtime type validation

#### Backend Key Dependencies
- `googleapis` - Google APIs client library
- `express` - Web framework
- `cors` - Cross-origin resource sharing
- `dotenv` - Environment variable management
- `node-fetch` - HTTP requests (for direct API calls)

This application provides a complete Google Business Profile management solution with secure authentication, real-time API integration, and a professional UI similar to tools like Pabbly Connect.