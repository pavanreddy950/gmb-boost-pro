import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCwe2lgsK5rhHePnsVgNflZf68M35qm3wU",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gbp-467810-a56e2.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gbp-467810-a56e2",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gbp-467810-a56e2.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "1027867101",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:1027867101:web:e5a55b106f9238eb72b634"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app);

export default app;
