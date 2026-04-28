import { initializeApp } from "firebase/app";
import { getAuth, signInAnonymously } from "firebase/auth";
import { getApiBaseUrl } from "./apiBase";

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAaVp-7itlHDgHlLvkZAb5k8ZXh-GiRaMo",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "agent-eregi.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "agent-eregi",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "agent-eregi.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "337988126020",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:337988126020:web:1baed287ef934f8063c311",
});

const auth = getAuth(app);

export const apiBase = getApiBaseUrl();

export async function ensureLogin(): Promise<string> {
  if (!auth.currentUser) await signInAnonymously(auth);
  const token = await auth.currentUser?.getIdToken(true);
  if (!token) throw new Error("Firebase auth token could not be issued.");
  return token;
}
