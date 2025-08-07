import { initializeApp, getApps, getApp, FirebaseOptions, type FirebaseApp } from 'firebase/app';
import { getAuth, type Auth } from 'firebase/auth';
import { getFirestore, type Firestore } from 'firebase/firestore';

// Helper function to check if we're running in a browser environment
const isBrowser = () => typeof window !== 'undefined';

// To use a custom domain with Firebase Authentication, you must complete two steps:
//
// 1. Add your new domain to the list of "Authorized domains" in your Firebase project settings.
//    You can find this in the Firebase Console under:
//    Authentication > Settings > Sign-in method.
//
// 2. Set the NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN environment variable to your new domain.
//    For local development, you can add this to a .env.local file.
//    For production, set this in your hosting provider's environment variable settings.
//
const firebaseConfig: FirebaseOptions = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
};

// Only initialize Firebase in the browser
let app: FirebaseApp | undefined;
let auth: Auth | undefined;
let db: Firestore | undefined;

// Make sure we're in a browser environment before initializing Firebase
if (isBrowser()) {
  try {
    app = !getApps().length ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (error) {
    console.error('Firebase initialization error:', error);
  }
}

export { app, auth, db };
