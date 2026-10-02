import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getDatabase } from "firebase-admin/database";

const projectId =
  process.env.FIREBASE_ADMIN_PROJECT_ID ||
  process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

const databaseURL = process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const rawPrivateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

const credential =
  projectId && clientEmail && rawPrivateKey
    ? cert({
        projectId,
        clientEmail,
        privateKey: rawPrivateKey.replace(/\\n/g, "\n"),
      })
    : undefined;

const adminApp =
  getApps()[0] ??
  initializeApp({
    ...(credential ? { credential } : {}),
    ...(projectId ? { projectId } : {}),
    ...(databaseURL ? { databaseURL } : {}),
  });

export const adminAuth = getAuth(adminApp);
export const adminDb = getDatabase(adminApp);
