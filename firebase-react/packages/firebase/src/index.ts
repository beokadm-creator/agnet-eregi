import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyCydfzxKGa-OBRiPEGVwi0HV-2EVbZkYMM",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agentregi-d77a3.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agentregi-d77a3",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agentregi-d77a3.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "524652826247",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:524652826247:web:f3188b16db4fb6f5813222",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-K17M93Y1T0",
};

export const app = getApps().length ? getApp() : initializeApp(firebaseConfig);

// Initialize Firebase App Check (reCAPTCHA v3) & Analytics
if (typeof window !== "undefined") {
  const recaptchaSiteKey = import.meta.env.VITE_RECAPTCHA_V3_SITE_KEY;
  if (recaptchaSiteKey) {
    try {
      initializeAppCheck(app, {
        provider: new ReCaptchaV3Provider(recaptchaSiteKey),
        isTokenAutoRefreshEnabled: true
      });
    } catch (error) {
      console.warn("[firebase] App Check initialization skipped:", error);
    }
  }

  if (firebaseConfig.measurementId) {
    try {
      getAnalytics(app);
    } catch (error) {
      console.warn("[firebase] Analytics initialization skipped:", error);
    }
  }
}

export const auth = getAuth(app);
