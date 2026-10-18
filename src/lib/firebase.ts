import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';
import { getStorage, connectStorageEmulator } from 'firebase/storage';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || 'demo-gizay-api-key',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || 'demo-gizay.firebaseapp.com',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || 'demo-gizay',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || 'demo-gizay.appspot.com',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '123456789012',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '1:123456789012:web:abcdef123456',
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || 'G-DEMOGIZAY',
};

// Initialize Firebase once
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);
export const db = getFirestore(app);
export const functions = getFunctions(app, 'us-central1');
export const storage = getStorage(app);

// Connect to emulators if flag is enabled
const useEmulator = import.meta.env.VITE_USE_FIREBASE_EMULATOR === 'true';

if (useEmulator && typeof window !== 'undefined') {
  try {
    const authUrl = import.meta.env.VITE_EMULATOR_AUTH_URL || 'http://localhost:9099';
    connectAuthEmulator(auth, authUrl, { disableWarnings: true });

    const firestoreHost = import.meta.env.VITE_EMULATOR_FIRESTORE_HOST || 'localhost';
    const firestorePort = Number(import.meta.env.VITE_EMULATOR_FIRESTORE_PORT) || 8080;
    connectFirestoreEmulator(db, firestoreHost, firestorePort);

    const functionsHost = import.meta.env.VITE_EMULATOR_FUNCTIONS_HOST || 'localhost';
    const functionsPort = Number(import.meta.env.VITE_EMULATOR_FUNCTIONS_PORT) || 5001;
    connectFunctionsEmulator(functions, functionsHost, functionsPort);

    const storageHost = import.meta.env.VITE_EMULATOR_STORAGE_HOST || 'localhost';
    const storagePort = Number(import.meta.env.VITE_EMULATOR_STORAGE_PORT) || 9199;
    connectStorageEmulator(storage, storageHost, storagePort);

    console.info('Connected to Firebase Local Emulator Suite');
  } catch (err) {
    console.warn('Error connecting to Firebase emulators:', err);
  }
}

export default app;
