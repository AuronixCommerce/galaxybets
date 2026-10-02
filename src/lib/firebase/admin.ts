import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

function privateKey() {
  const raw = process.env.FIREBASE_ADMIN_PRIVATE_KEY;
  if (!raw) throw new Error("FIREBASE_ADMIN_PRIVATE_KEY is not configured");
  return raw.replace(/\\n/g, "\n");
}

const adminApp = getApps()[0] ?? initializeApp({
  credential: cert({
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
    clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
    privateKey: privateKey(),
  }),
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
});

export const adminAuth = getAuth(adminApp);
export const adminDb = getDatabase(adminApp);
