# Firebase Authentication Setup Guide

This guide will help you set up Firebase Authentication for your LOBAISEO application.

## Prerequisites

1. A Google account
2. Access to the [Firebase Console](https://console.firebase.google.com/)

## Step 1: Create a Firebase Project

1. Go to the [Firebase Console](https://console.firebase.google.com/)
2. Click "Add project" or "Create a project"
3. Enter your project name (e.g., "lobaiseo")
4. Choose whether to enable Google Analytics (optional)
5. Click "Create project"

## Step 2: Enable Authentication

1. In your Firebase project dashboard, click on "Authentication" in the left sidebar
2. Click "Get started" if this is your first time
3. Go to the "Sign-in method" tab
4. Enable the following sign-in providers:
   - **Email/Password**: Click on it, toggle "Enable", and save
   - **Google**: Click on it, toggle "Enable", add your project support email, and save

## Step 3: Get Your Firebase Configuration

1. In your Firebase project dashboard, click on the gear icon (⚙️) next to "Project Overview"
2. Select "Project settings"
3. Scroll down to the "Your apps" section
4. Click on the web icon (`</>`) to add a web app
5. Register your app with a nickname (e.g., "LOBAISEO Web")
6. Copy the Firebase configuration object

## Step 4: Configure Your Application

1. Open `src/lib/firebase.ts` in your project
2. Replace the placeholder configuration with your actual Firebase config:

```typescript
const firebaseConfig = {
  apiKey: "your-actual-api-key",
  authDomain: "your-project-id.firebaseapp.com",
  projectId: "your-actual-project-id",
  storageBucket: "your-project-id.appspot.com",
  messagingSenderId: "your-actual-sender-id",
  appId: "your-actual-app-id"
};
```

## Step 5: Set up Authorized Domains (for Production)

1. In Firebase Console, go to Authentication > Settings > Authorized domains
2. Add your production domain(s) where your app will be hosted
3. `localhost` is already authorized for development

## Step 6: Test Your Setup

1. Start your development server: `npm run dev`
2. Navigate to the signup page
3. Try creating an account with email/password
4. Try signing in with Google
5. Check the Firebase Console > Authentication > Users to see registered users

## Features Implemented

✅ **Email/Password Authentication**
- User registration with email and password
- User login with email and password
- Password validation (minimum 6 characters)
- Error handling with user-friendly messages

✅ **Google OAuth Authentication**
- Sign up with Google account
- Sign in with Google account
- Automatic profile information extraction

✅ **User Session Management**
- Persistent authentication state
- Automatic login on page refresh
- Secure logout functionality

✅ **Protected Routes**
- Dashboard routes require authentication
- Automatic redirect to login page
- Return to intended page after login

✅ **User Interface Integration**
- Real-time user information in topbar
- Dynamic avatar with user initials
- Loading states during authentication

## Security Features

- Firebase handles all password hashing and security
- Secure token-based authentication
- Automatic session management
- HTTPS enforcement in production

## Environment Variables (Optional)

For additional security, you can store your Firebase config in environment variables:

1. Create a `.env.local` file in your project root
2. Add your Firebase configuration:

```env
VITE_FIREBASE_API_KEY=your-api-key
VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project-id
VITE_FIREBASE_STORAGE_BUCKET=your-project-id.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=your-sender-id
VITE_FIREBASE_APP_ID=your-app-id
```

3. Update `src/lib/firebase.ts` to use environment variables:

```typescript
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};
```

## Troubleshooting

### Common Issues

1. **"Firebase: Error (auth/invalid-api-key)"**
   - Check that your API key is correct in the configuration

2. **"Firebase: Error (auth/unauthorized-domain)"**
   - Add your domain to authorized domains in Firebase Console

3. **Google Sign-in not working**
   - Ensure Google provider is enabled in Firebase Console
   - Check that your OAuth consent screen is configured

4. **Users not appearing in Firebase Console**
   - Check that you're looking at the correct Firebase project
   - Ensure authentication is properly configured

### Getting Help

- Check the [Firebase Documentation](https://firebase.google.com/docs/auth)
- Visit the [Firebase Console](https://console.firebase.google.com/)
- Check browser developer tools for detailed error messages

## Next Steps

Your Firebase authentication is now fully set up! Users can:
- Create accounts with email/password
- Sign in with Google
- Access protected dashboard routes
- Maintain persistent sessions
- Securely log out

The authentication system automatically handles user sessions, route protection, and provides a seamless user experience.

