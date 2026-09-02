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

const firebaseConfig = {
  apiKey: "AIzaSyB-xnApP91609agpMBhPPtHPaC5MB4Sh08",
  authDomain: "gen-lang-client-0439520113.firebaseapp.com",
  projectId: "gen-lang-client-0439520113",
  storageBucket: "gen-lang-client-0439520113.firebasestorage.app",
  messagingSenderId: "444816417263",
  appId: "1:444816417263:web:ece8278909a1cfce47161a"
};

const DATABASE_ID = "ai-studio-apartmentpro-4ddedeef-b64f-41bb-85a6-1593d7fc4f55";

function getClientFirebaseApp(): FirebaseApp {
  const apps = getApps();
  if (apps.length > 0) return apps[0]!;
  return initializeApp(firebaseConfig);
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

// Read entire state directly from Cloud Firestore
export async function fetchDirectFromFirestore(): Promise<DBState> {
  const db = getClientDb();
  const result: any = {};

  await Promise.all(
    COLLECTIONS.map(async (colName) => {
      try {
        const snap = await getDocs(collection(db, colName));
        result[colName] = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      } catch (err) {
        console.warn(`Error reading collection ${colName} directly from Firestore:`, err);
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
  const db = getClientDb();
  const { id, ...dataWithoutId } = data;
  await setDoc(doc(db, colName, docId), dataWithoutId, { merge: true });
}

// Delete a document directly in Firestore
export async function directDeleteDoc(colName: keyof DBState, docId: string): Promise<void> {
  const db = getClientDb();
  await deleteDoc(doc(db, colName, docId));
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
