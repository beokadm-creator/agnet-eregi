import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

function runtimeAuthDomain(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
  if (isLocal) return null;
  if (!host) return null;
  return host;
}

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAaVp-7itlHDgHlLvkZAb5k8ZXh-GiRaMo",
  authDomain: runtimeAuthDomain() || import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agent-eregi.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agent-eregi",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agent-eregi.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "337988126020",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:337988126020:web:1baed287ef934f8063c311",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-VYFLLG9C6P",
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
