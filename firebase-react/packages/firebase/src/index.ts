import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getAnalytics } from "firebase/analytics";
import { initializeAppCheck, ReCaptchaV3Provider } from "firebase/app-check";

const runtimeHost = typeof window < "u" ? window.location.hostname : "";
const isLocalHost = ["localhost", "127.0.0.1", "::1"].includes(runtimeHost);

const firebaseConfigByHost = {
  staging: {
    apiKey: "AIzaSyCydfzxKGa-OBRiPEGVwi0HV-2EVbZkYMM",
    authDomain: "agentregi-d77a3.firebaseapp.com",
    projectId: "agentregi-d77a3",
    storageBucket: "agentregi-d77a3.firebasestorage.app",
    messagingSenderId: "524652826247",
    appId: "1:524652826247:web:f3188b16db4fb6f5813222",
    measurementId: "G-K17M93Y1T0",
  },
  prod: {
    apiKey: "AIzaSyAaVp-7itlHDgHlLvkZAb5k8ZXh-GiRaMo",
    authDomain: "agent-eregi.firebaseapp.com",
    projectId: "agent-eregi",
    storageBucket: "agent-eregi.firebasestorage.app",
    messagingSenderId: "337988126020",
    appId: "1:337988126020:web:1baed287ef934f8063c311",
    measurementId: "G-VYFLLG9C6P",
  },
} as const;

function getDefaultFirebaseConfig() {
  if (!isLocalHost && runtimeHost.includes("agentregi-d77a3")) {
    return firebaseConfigByHost.staging;
  }
  return firebaseConfigByHost.prod;
}

const defaultFirebaseConfig = getDefaultFirebaseConfig();

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || defaultFirebaseConfig.apiKey,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || defaultFirebaseConfig.authDomain,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || defaultFirebaseConfig.projectId,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || defaultFirebaseConfig.storageBucket,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || defaultFirebaseConfig.messagingSenderId,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || defaultFirebaseConfig.appId,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || defaultFirebaseConfig.measurementId,
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
