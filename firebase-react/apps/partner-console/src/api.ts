import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "demo-api-key",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "demo-rp.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "demo-rp",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "demo-rp.appspot.com",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "000000000000",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:000000000000:web:partner",
});

const auth = getAuth(app);

export const apiBase = import.meta.env.VITE_API_BASE || "";

export async function ensureLogin(): Promise<string> {
  if (!auth.currentUser) await signInAnonymously(auth);
  const token = await auth.currentUser?.getIdToken(true);
  if (!token) throw new Error("Firebase auth token could not be issued.");
  return token;
}
