// src/firebase/firebaseConfig.js
// ─────────────────────────────────────────────────────────────────────────────
// Firebase is initialized ONCE here and exported as singletons.
// Import { auth } from this file wherever Firebase Auth is needed.
// Never call initializeApp() more than once in the same app.
// ─────────────────────────────────────────────────────────────────────────────

import { initializeApp, getApp, getApps }   from 'firebase/app';
import { initializeAuth,
         browserLocalPersistence,
         browserPopupRedirectResolver }     from 'firebase/auth';

// ── Project configuration ─────────────────────────────────────────────────────
const env = typeof import.meta !== 'undefined' && import.meta.env ? import.meta.env : {};

const firebaseConfig = {
  apiKey:            env.VITE_FIREBASE_API_KEY            || 'AIzaSyCCT87JLxEmyysKTcfCE8jx9Q49vDZTzXI',
  authDomain:        env.VITE_FIREBASE_AUTH_DOMAIN        || 'burn-x-7200b.firebaseapp.com',
  projectId:         env.VITE_FIREBASE_PROJECT_ID         || 'burn-x-7200b',
  storageBucket:     env.VITE_FIREBASE_STORAGE_BUCKET     || 'burn-x-7200b.firebasestorage.app',
  messagingSenderId: env.VITE_FIREBASE_MESSAGING_SENDER_ID || '727012276322',
  appId:             env.VITE_FIREBASE_APP_ID             || '1:727012276322:web:f512f244ee3dcccc37793b',
  measurementId:     env.VITE_FIREBASE_MEASUREMENT_ID     || 'G-DQX8RQ7Q95',
};

// ── Initialize ────────────────────────────────────────────────────────────────
// Prevent duplicate initialization during HMR / Development
const app  = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();

// Use initializeAuth with browserLocalPersistence directly to bypass loading
// indexedDBLocalPersistence which contains a visibilitychange regression
// causing "Database is closing/hidden" error in SDK v1.13.4 (Firebase 12.17.x).
// We include browserPopupRedirectResolver to support popup/redirect oauth flows.
const auth = initializeAuth(app, {
  persistence: browserLocalPersistence,
  popupRedirectResolver: browserPopupRedirectResolver,
});

export { app, auth };
