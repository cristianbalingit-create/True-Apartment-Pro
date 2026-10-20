import { initializeApp, getApps, FirebaseApp } from "firebase/app";
import {
  getFirestore,
  collection,
  getDocs,
  doc,
  setDoc,
  deleteDoc,
  Firestore
} from "firebase/firestore";
import type {
  Apartment,
  Room,
  Tenant,
  BillingRecord,
  Notification,
  Inquiry,
  MaintenanceRequest,
  Announcement,
  Rule,
  DepositLedgerEntry,
  TransactionLog
} from "../types";
import type { DBState } from "./api";

const clientEnv = (import.meta as any).env || {};
const firebaseConfig = {
  apiKey: clientEnv.VITE_FIREBASE_API_KEY || "AIzaSyB-xnApP91609agpMBhPPtHPaC5MB4Sh08",
  authDomain: clientEnv.VITE_FIREBASE_AUTH_DOMAIN || "gen-lang-client-0439520113.firebaseapp.com",
  projectId: clientEnv.VITE_FIREBASE_PROJECT_ID || "gen-lang-client-0439520113",
  storageBucket: clientEnv.VITE_FIREBASE_STORAGE_BUCKET || "gen-lang-client-0439520113.firebasestorage.app",
  messagingSenderId: clientEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || "444816417263",
  appId: clientEnv.VITE_FIREBASE_APP_ID || "1:444816417263:web:ece8278909a1cfce47161a"
};

const DATABASE_ID = clientEnv.VITE_FIREBASE_DATABASE_ID || "ai-studio-apartmentpro-4ddedeef-b64f-41bb-85a6-1593d7fc4f55";
const CLIENT_APP_NAME = "apartmentflow-client";

function getClientFirebaseApp(): FirebaseApp {
  const existingApp = getApps().find((app) => app.name === CLIENT_APP_NAME);
  if (existingApp) return existingApp;
  return initializeApp(firebaseConfig, CLIENT_APP_NAME);
}

export function getClientDb(): Firestore {
  const app = getClientFirebaseApp();
  return getFirestore(app, DATABASE_ID);
}

const COLLECTIONS: (keyof DBState)[] = [
  "apartments",
  "rooms",
  "tenants",
  "billingRecords",
  "notifications",
  "inquiries",
  "maintenanceRequests",
  "announcements",
  "rules",
  "depositLedger",
  "transactionLogs"
];

function withTimeout<T>(promise: Promise<T>, ms = 3000): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error(`Firestore client timeout after ${ms}ms`)), ms))
  ]);
}

// Read entire state directly from Cloud Firestore
export async function fetchDirectFromFirestore(): Promise<DBState> {
  const db = getClientDb();
  const result: any = {};

  await Promise.all(
    COLLECTIONS.map(async (colName) => {
      try {
        const snap = await withTimeout(getDocs(collection(db, colName)), 3000);
        result[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err: any) {
        // Silently recover if offline or unreachable within timeout
        result[colName] = [];
      }
    })
  );

  return {
    apartments: (result.apartments || []) as Apartment[],
    rooms: (result.rooms || []) as Room[],
    tenants: (result.tenants || []) as Tenant[],
    billingRecords: (result.billingRecords || []) as BillingRecord[],
    notifications: (result.notifications || []) as Notification[],
    inquiries: (result.inquiries || []) as Inquiry[],
    maintenanceRequests: (result.maintenanceRequests || []) as MaintenanceRequest[],
    announcements: (result.announcements || []) as Announcement[],
    rules: (result.rules || []) as Rule[],
    depositLedger: (result.depositLedger || []) as DepositLedgerEntry[],
    transactionLogs: (result.transactionLogs || []) as TransactionLog[]
  };
}

// Upsert a document directly in Firestore
export async function directUpsertDoc(colName: keyof DBState, docId: string, data: any): Promise<void> {
  try {
    const db = getClientDb();
    const { id, ...dataWithoutId } = data;
    await withTimeout(setDoc(doc(db, colName, docId), dataWithoutId, { merge: true }), 3000);
  } catch (err) {
    // Non-critical fallback; server-side handles authoritative writes
  }
}

// Delete a document directly in Firestore
export async function directDeleteDoc(colName: keyof DBState, docId: string): Promise<void> {
  try {
    const db = getClientDb();
    await withTimeout(deleteDoc(doc(db, colName, docId)), 3000);
  } catch (err) {
    // Non-critical fallback
  }
}

// Record a transaction log directly
export async function directLogTransaction(
  category: TransactionLog["category"],
  title: string,
  details: string,
  action?: TransactionLog["action"],
  performed_by: string = "admin"
): Promise<void> {
  try {
    const id = `log-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
    const logItem: TransactionLog = {
      id,
      timestamp: new Date().toISOString(),
      category,
      action: action || "create",
      title,
      details,
      performed_by
    };
    await directUpsertDoc("transactionLogs", id, logItem);
  } catch (e) {
    console.warn("Direct transaction logging notice:", e);
  }
}
