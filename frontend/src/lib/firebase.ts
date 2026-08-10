import { initializeApp, type FirebaseApp } from "firebase/app";
import { getAuth, type Auth } from "firebase/auth";

export interface FirebaseConfig {
  apiKey: string;
  authDomain: string;
  projectId: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
}

function readConfig(): FirebaseConfig {
  return {
    apiKey: import.meta.env.VITE_FIREBASE_API_KEY ?? "",
    authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN ?? "",
    projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID ?? "",
    storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
    appId: import.meta.env.VITE_FIREBASE_APP_ID,
  };
}

export function isConfigured(cfg: FirebaseConfig): boolean {
  return Boolean(cfg.apiKey && cfg.authDomain && cfg.projectId);
}

let cached: { app: FirebaseApp; auth: Auth } | null = null;

export function getFirebase(): { app: FirebaseApp; auth: Auth } | null {
  if (cached) return cached;
  const cfg = readConfig();
  if (!isConfigured(cfg)) return null;
  const app = initializeApp(cfg);
  cached = { app, auth: getAuth(app) };
  return cached;
}
