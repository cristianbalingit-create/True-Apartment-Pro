import fs from "fs";
import path from "path";
import os from "os";
import { initializeApp as initAdminApp, getApps as getAdminApps, cert, applicationDefault, type App as AdminApp, type ServiceAccount } from "firebase-admin/app";
import { getFirestore as getAdminFirestore, Firestore as AdminFirestore } from "firebase-admin/firestore";
import { getStorage as getAdminStorage } from "firebase-admin/storage";
import { initializeApp as initClientApp, getApps as getClientApps, type FirebaseApp } from "firebase/app";
import {
  getFirestore as getClientFirestore,
  collection as clientCollection,
  getDocs as getClientDocs,
  doc as clientDoc,
  setDoc as clientSetDoc,
  deleteDoc as clientDeleteDoc,
  writeBatch as clientWriteBatch,
  query as clientQuery,
  limit as clientLimit,
  type Firestore as ClientFirestore
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

export interface DBState {
  apartments: Apartment[];
  rooms: Room[];
  tenants: Tenant[];
  billingRecords: BillingRecord[];
  notifications: Notification[];
  inquiries: Inquiry[];
  maintenanceRequests: MaintenanceRequest[];
  announcements: Announcement[];
  rules: Rule[];
  depositLedger: DepositLedgerEntry[];
  transactionLogs: TransactionLog[];
}

export const DB_COLLECTIONS: (keyof DBState)[] = [
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

// Load local config file if exists
let localConfig: any = {};
try {
  const configPath = path.join(process.cwd(), "firebase-applet-config.json");
  if (fs.existsSync(configPath)) {
    localConfig = JSON.parse(fs.readFileSync(configPath, "utf-8"));
  }
} catch (e) {
  // ignore
}

export interface FirebaseConfigOptions {
  apiKey: string;
  projectId: string;
  databaseId: string;
  storageBucket: string;
  appId: string;
  messagingSenderId: string;
  authDomain: string;
  serviceAccount?: ServiceAccount;
}

class DatabaseService {
  private adminFirestore: AdminFirestore | null = null;
  private clientFirestore: ClientFirestore | null = null;
  private storageBucket: any = null;
  private isInitialized = false;
  private isConnectedToFirestore = false;
  private isConnectedToStorage = false;
  private connectionMode: "client_sdk" | "admin_sdk" | "local_cache" = "local_cache";
  private connectionError: string | null = null;
  private inMemoryCache: DBState | null = null;
  private config: FirebaseConfigOptions;
  private syncInProgress = false;

  constructor() {
    const envProjectId = process.env.FIREBASE_PROJECT_ID;
    const realProjectId = (envProjectId && envProjectId !== "ApartmentPro" && !envProjectId.includes(" "))
      ? envProjectId
      : (localConfig.projectId || "gen-lang-client-0439520113");

    this.config = {
      apiKey: process.env.FIREBASE_API_KEY || localConfig.apiKey || "AIzaSyB-xnApP91609agpMBhPPtHPaC5MB4Sh08",
      projectId: realProjectId,
      databaseId: process.env.FIREBASE_DATABASE_ID || localConfig.firestoreDatabaseId || "ai-studio-apartmentpro-4ddedeef-b64f-41bb-85a6-1593d7fc4f55",
      storageBucket: process.env.FIREBASE_STORAGE_BUCKET || localConfig.storageBucket || "gen-lang-client-0439520113.firebasestorage.app",
      appId: process.env.FIREBASE_APP_ID || localConfig.appId || "1:444816417263:web:ece8278909a1cfce47161a",
      messagingSenderId: process.env.FIREBASE_MESSAGING_SENDER_ID || localConfig.messagingSenderId || "444816417263",
      authDomain: process.env.FIREBASE_AUTH_DOMAIN || localConfig.authDomain || "gen-lang-client-0439520113.firebaseapp.com",
    };
  }

  public async initialize(): Promise<void> {
    if (this.isInitialized) return;
    this.isInitialized = true;

    // First load fallback data from data.json so app never stalls
    this.loadFallbackData();

    // 1. Try Firebase Admin SDK if service account is provided
    let hasAdminCredential = false;
    let credentialInstance: any = null;

    if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY) {
      try {
        let rawKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY.trim();
        if ((rawKey.startsWith('"') && rawKey.endsWith('"')) || (rawKey.startsWith("'") && rawKey.endsWith("'"))) {
          rawKey = rawKey.slice(1, -1).trim();
        }
        let jsonString = rawKey;
        if (!rawKey.startsWith("{")) {
          try {
            jsonString = Buffer.from(rawKey, "base64").toString("utf-8");
          } catch {
            jsonString = rawKey;
          }
        }
        if (jsonString.includes('\\"')) {
          try {
            JSON.parse(jsonString);
          } catch {
            jsonString = jsonString.replace(/\\"/g, '"');
          }
        }
        const sa = JSON.parse(jsonString);
        if (sa.private_key) {
          sa.private_key = sa.private_key.replace(/\\n/g, "\n");
        }
        credentialInstance = cert(sa);
        if (sa.project_id) this.config.projectId = sa.project_id;
        hasAdminCredential = true;
      } catch (saErr: any) {
        console.warn("Failed to parse FIREBASE_SERVICE_ACCOUNT_KEY:", saErr?.message || saErr);
      }
    } else if (process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
      try {
        let privateKey = process.env.FIREBASE_PRIVATE_KEY.trim();
        if ((privateKey.startsWith('"') && privateKey.endsWith('"')) || (privateKey.startsWith("'") && privateKey.endsWith("'"))) {
          privateKey = privateKey.slice(1, -1).trim();
        }
        privateKey = privateKey.replace(/\\n/g, "\n").replace(/\\r/g, "\r");
        if (!privateKey.includes("-----BEGIN PRIVATE KEY-----") && !privateKey.includes("-----BEGIN RSA PRIVATE KEY-----")) {
          privateKey = `-----BEGIN PRIVATE KEY-----\n${privateKey}\n-----END PRIVATE KEY-----\n`;
        }

        credentialInstance = cert({
          projectId: this.config.projectId,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL.trim(),
          privateKey,
        });
        hasAdminCredential = true;
      } catch (certErr: any) {
        console.warn("Failed to initialize cert with FIREBASE_PRIVATE_KEY:", certErr?.message || certErr);
      }
    }

    if (hasAdminCredential && credentialInstance) {
      try {
        const appName = "apartmentpro-backend-admin";
        let adminApp: AdminApp;
        const existingApps = getAdminApps().filter(a => a && a.name === appName);
        if (existingApps.length > 0) {
          adminApp = existingApps[0]!;
        } else {
          const cleanBucket = this.config.storageBucket?.replace(/^gs:\/\//, "");
          adminApp = initAdminApp({
            credential: credentialInstance,
            projectId: this.config.projectId,
            storageBucket: cleanBucket,
          }, appName);
        }

        this.adminFirestore = this.config.databaseId && this.config.databaseId !== "(default)"
          ? getAdminFirestore(adminApp, this.config.databaseId)
          : getAdminFirestore(adminApp);

        // Test admin connection with a 3.5s timeout so it never hangs Vercel serverless functions
        const testConn = this.adminFirestore.collection("apartments").limit(1).get();
        const timeoutConn = new Promise((_, reject) => setTimeout(() => reject(new Error("Admin Firestore timeout (3.5s)")), 3500));
        await Promise.race([testConn, timeoutConn]);

        this.isConnectedToFirestore = true;
        this.connectionMode = "admin_sdk";
        this.connectionError = null;
        console.log(`✅ Connected to Firebase Firestore via Admin SDK [Database: ${this.config.databaseId}]`);

        // Initialize admin storage safely
        try {
          const cleanBucket = this.config.storageBucket?.replace(/^gs:\/\//, "");
          if (cleanBucket) {
            const storage = getAdminStorage(adminApp);
            this.storageBucket = storage.bucket(cleanBucket);
            this.isConnectedToStorage = true;
          }
        } catch (stErr: any) {
          console.warn("Admin Storage bucket initialization warning:", stErr?.message || stErr);
        }
      } catch (adminErr: any) {
        console.warn("Admin SDK connection failed, will use Client SDK:", adminErr?.message || adminErr);
        this.adminFirestore = null;
      }
    }

    // 2. Client SDK connection with API key
    if (!this.isConnectedToFirestore) {
      try {
        const clientAppName = "apartmentpro-backend-client";
        let clientApp: FirebaseApp;
        const existingClientApps = getClientApps().filter(a => a && a.name === clientAppName);
        if (existingClientApps.length > 0) {
          clientApp = existingClientApps[0]!;
        } else {
          clientApp = initClientApp({
            apiKey: this.config.apiKey,
            authDomain: this.config.authDomain,
            projectId: this.config.projectId,
            storageBucket: this.config.storageBucket,
            messagingSenderId: this.config.messagingSenderId,
            appId: this.config.appId,
          }, clientAppName);
        }

        this.clientFirestore = this.config.databaseId && this.config.databaseId !== "(default)"
          ? getClientFirestore(clientApp, this.config.databaseId)
          : getClientFirestore(clientApp);

        // Test connection with a 3.5s timeout so it never hangs Vercel serverless functions
        const q = clientQuery(clientCollection(this.clientFirestore, "apartments"), clientLimit(1));
        const testClientConn = getClientDocs(q);
        const timeoutClientConn = new Promise((_, reject) => setTimeout(() => reject(new Error("Client Firestore timeout (3.5s)")), 3500));
        await Promise.race([testClientConn, timeoutClientConn]);

        this.isConnectedToFirestore = true;
        this.connectionMode = "client_sdk";
        this.connectionError = null;
        console.log(`✅ Connected to Firebase Firestore via Web Client SDK [Database: ${this.config.databaseId}]`);
      } catch (clientErr: any) {
        this.connectionError = clientErr?.message || String(clientErr);
        console.warn("Client Firestore connection notice:", clientErr?.message || clientErr);
        this.clientFirestore = null;
        this.isConnectedToFirestore = false;
        this.connectionMode = "local_cache";
      }
    }

    // Sync state from Firestore safely
    if (this.isConnectedToFirestore) {
      try {
        await this.syncFromFirestore();
      } catch (syncErr: any) {
        console.warn("Initial syncFromFirestore notice:", syncErr?.message || syncErr);
      }
    }
  }

  // Load fallback data from data.json or /tmp/data.json
  private loadFallbackData(): DBState {
    const isVercel = !!process.env.VERCEL;
    const candidates = [
      isVercel ? path.join(os.tmpdir(), "data.json") : null,
      path.join(process.cwd(), "data.json")
    ].filter(Boolean) as string[];

    for (const filePath of candidates) {
      try {
        if (fs.existsSync(filePath)) {
          const raw = fs.readFileSync(filePath, "utf-8");
          const parsed = JSON.parse(raw);
          this.inMemoryCache = this.sanitizeDBState(parsed);
          return this.inMemoryCache;
        }
      } catch (e) {
        // continue
      }
    }

    // Default empty state
    this.inMemoryCache = {
      apartments: [],
      rooms: [],
      tenants: [],
      billingRecords: [],
      notifications: [],
      inquiries: [],
      maintenanceRequests: [],
      announcements: [],
      rules: [],
      depositLedger: [],
      transactionLogs: []
    };
    return this.inMemoryCache;
  }

  private sanitizeDBState(parsed: any): DBState {
    const state: DBState = {
      apartments: Array.isArray(parsed.apartments) ? parsed.apartments : [],
      rooms: Array.isArray(parsed.rooms) ? parsed.rooms : [],
      tenants: Array.isArray(parsed.tenants) ? parsed.tenants : [],
      billingRecords: Array.isArray(parsed.billingRecords) ? parsed.billingRecords : [],
      notifications: Array.isArray(parsed.notifications) ? parsed.notifications : [],
      inquiries: Array.isArray(parsed.inquiries) ? parsed.inquiries : [],
      maintenanceRequests: Array.isArray(parsed.maintenanceRequests) ? parsed.maintenanceRequests : [],
      announcements: Array.isArray(parsed.announcements) ? parsed.announcements : [],
      rules: Array.isArray(parsed.rules) ? parsed.rules : [],
      depositLedger: Array.isArray(parsed.depositLedger) ? parsed.depositLedger : [],
      transactionLogs: Array.isArray(parsed.transactionLogs) ? parsed.transactionLogs : []
    };

    // Ensure tenant balance fields exist
    state.tenants.forEach(t => {
      if (t.deposit_balance === undefined) {
        t.deposit_balance = Number(t.deposit || 0);
      }
      if (t.advance_payment === undefined) {
        t.advance_payment = Number(t.rent_amount || 0);
      }
      if (t.advance_balance === undefined) {
        t.advance_balance = Number(t.advance_payment || 0);
      }
    });

    return state;
  }

  // Synchronize state from Firestore into memory, or auto-migrate if empty
  public async syncFromFirestore(): Promise<DBState> {
    if (!this.isConnectedToFirestore) {
      return this.getDB();
    }

    try {
      const newState: Partial<DBState> = {};
      let totalFetched = 0;

      if (this.connectionMode === "admin_sdk" && this.adminFirestore) {
        const fetchPromises = DB_COLLECTIONS.map(async (colName) => {
          try {
            const snapshot = await this.adminFirestore!.collection(colName).get();
            const items: any[] = [];
            snapshot.forEach(doc => {
              items.push({ id: doc.id, ...doc.data() });
            });
            return { colName, items };
          } catch (err: any) {
            console.warn(`Admin sync warning for ${colName}:`, err?.message || err);
            return { colName, items: [] };
          }
        });
        const results = await Promise.allSettled(fetchPromises);
        for (const res of results) {
          if (res.status === "fulfilled") {
            (newState as any)[res.value.colName] = res.value.items;
            totalFetched += res.value.items.length;
          }
        }
      } else if (this.clientFirestore) {
        const fetchPromises = DB_COLLECTIONS.map(async (colName) => {
          try {
            const snapshot = await getClientDocs(clientCollection(this.clientFirestore!, colName));
            const items: any[] = [];
            snapshot.forEach(doc => {
              items.push({ id: doc.id, ...doc.data() });
            });
            return { colName, items };
          } catch (err: any) {
            console.warn(`Client sync warning for ${colName}:`, err?.message || err);
            return { colName, items: [] };
          }
        });
        const results = await Promise.allSettled(fetchPromises);
        for (const res of results) {
          if (res.status === "fulfilled") {
            (newState as any)[res.value.colName] = res.value.items;
            totalFetched += res.value.items.length;
          }
        }
      }

      if (totalFetched === 0) {
        console.log("Firestore collections are empty. Auto-migrating data.json into Firestore...");
        await this.migrateDataJsonToFirestore();
        return this.syncFromFirestore();
      }

      this.inMemoryCache = this.sanitizeDBState(newState);
      this.saveFallbackFile(this.inMemoryCache);
      return this.inMemoryCache;
    } catch (err: any) {
      console.error("Error reading collections from Firestore:", err.message);
      return this.getDB();
    }
  }

  // Migrate records from data.json into Firestore
  public async migrateDataJsonToFirestore(): Promise<{ success: boolean; migrated: Record<string, number> }> {
    const localData = this.loadFallbackData();
    const migratedCounts: Record<string, number> = {};

    if (this.connectionMode === "admin_sdk" && this.adminFirestore) {
      for (const colName of DB_COLLECTIONS) {
        const items = (localData as any)[colName] || [];
        if (!Array.isArray(items) || items.length === 0) continue;
        let count = 0;
        const chunkSize = 450;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = this.adminFirestore.batch();
          for (const item of chunk) {
            const docId = String(item.id || `${colName}-${Date.now()}`);
            const docRef = this.adminFirestore.collection(colName).doc(docId);
            const { id, ...dataWithoutId } = item;
            batch.set(docRef, dataWithoutId, { merge: true });
            count++;
          }
          await batch.commit();
        }
        migratedCounts[colName] = count;
      }
    } else if (this.clientFirestore) {
      for (const colName of DB_COLLECTIONS) {
        const items = (localData as any)[colName] || [];
        if (!Array.isArray(items) || items.length === 0) continue;
        let count = 0;
        const chunkSize = 450;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = clientWriteBatch(this.clientFirestore);
          for (const item of chunk) {
            const docId = String(item.id || `${colName}-${Date.now()}`);
            const docRef = clientDoc(this.clientFirestore, colName, docId);
            const { id, ...dataWithoutId } = item;
            batch.set(docRef, dataWithoutId, { merge: true });
            count++;
          }
          await batch.commit();
        }
        migratedCounts[colName] = count;
      }
    }

    console.log("✅ Successfully migrated initial records to Firestore:", migratedCounts);
    return { success: true, migrated: migratedCounts };
  }

  // Get current DB State (synchronous, backed by memory cache)
  public getDB(): DBState {
    if (!this.inMemoryCache) {
      this.loadFallbackData();
    }
    return this.inMemoryCache!;
  }

  // Persist updated DB state
  public async saveDB(updatedState: DBState): Promise<void> {
    this.inMemoryCache = this.sanitizeDBState(updatedState);
    this.saveFallbackFile(this.inMemoryCache);

    if (this.isConnectedToFirestore && !this.syncInProgress) {
      this.syncInProgress = true;
      this.syncToFirestore(this.inMemoryCache)
        .catch(err => console.warn("Background Firestore sync warning:", err.message))
        .finally(() => { this.syncInProgress = false; });
    }
  }

  // Upsert a single document
  public async upsertDoc(colName: keyof DBState, docId: string, data: any): Promise<void> {
    const db = this.getDB();
    const list = db[colName] as any[];
    const idx = list.findIndex(item => item.id === docId);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...data, id: docId };
    } else {
      list.push({ ...data, id: docId });
    }
    this.saveFallbackFile(db);

    if (this.isConnectedToFirestore) {
      try {
        const { id, ...dataWithoutId } = data;
        if (this.connectionMode === "admin_sdk" && this.adminFirestore) {
          await this.adminFirestore.collection(colName).doc(docId).set(dataWithoutId, { merge: true });
        } else if (this.clientFirestore) {
          await clientSetDoc(clientDoc(this.clientFirestore, colName, docId), dataWithoutId, { merge: true });
        }
      } catch (err: any) {
        console.warn(`Error writing ${colName}/${docId} to Firestore:`, err.message);
      }
    }
  }

  // Delete a single document
  public async deleteDoc(colName: keyof DBState, docId: string): Promise<void> {
    const db = this.getDB();
    const list = db[colName] as any[];
    const idx = list.findIndex(item => item.id === docId);
    if (idx !== -1) {
      list.splice(idx, 1);
    }
    this.saveFallbackFile(db);

    if (this.isConnectedToFirestore) {
      try {
        if (this.connectionMode === "admin_sdk" && this.adminFirestore) {
          await this.adminFirestore.collection(colName).doc(docId).delete();
        } else if (this.clientFirestore) {
          await clientDeleteDoc(clientDoc(this.clientFirestore, colName, docId));
        }
      } catch (err: any) {
        console.warn(`Error deleting ${colName}/${docId} from Firestore:`, err.message);
      }
    }
  }

  // Save to Firestore in batches
  private async syncToFirestore(state: DBState): Promise<void> {
    if (!this.isConnectedToFirestore) return;

    if (this.connectionMode === "admin_sdk" && this.adminFirestore) {
      for (const colName of DB_COLLECTIONS) {
        const items = (state as any)[colName] as any[];
        if (!Array.isArray(items)) continue;
        const chunkSize = 450;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = this.adminFirestore.batch();
          for (const item of chunk) {
            if (!item || !item.id) continue;
            const docRef = this.adminFirestore.collection(colName).doc(String(item.id));
            const { id, ...dataWithoutId } = item;
            batch.set(docRef, dataWithoutId, { merge: true });
          }
          await batch.commit();
        }
      }
    } else if (this.clientFirestore) {
      for (const colName of DB_COLLECTIONS) {
        const items = (state as any)[colName] as any[];
        if (!Array.isArray(items)) continue;
        const chunkSize = 450;
        for (let i = 0; i < items.length; i += chunkSize) {
          const chunk = items.slice(i, i + chunkSize);
          const batch = clientWriteBatch(this.clientFirestore);
          for (const item of chunk) {
            if (!item || !item.id) continue;
            const docRef = clientDoc(this.clientFirestore, colName, String(item.id));
            const { id, ...dataWithoutId } = item;
            batch.set(docRef, dataWithoutId, { merge: true });
          }
          await batch.commit();
        }
      }
    }
  }

  // Safe file write that respects Vercel read-only filesystem
  private saveFallbackFile(data: DBState): void {
    const isVercel = !!process.env.VERCEL;
    const targetPath = isVercel
      ? path.join(os.tmpdir(), "data.json")
      : path.join(process.cwd(), "data.json");

    try {
      fs.writeFileSync(targetPath, JSON.stringify(data, null, 2));
    } catch (err: any) {
      // In-memory cache is still intact
    }
  }

  // Upload file to Firebase Storage or local fallback
  public async uploadFile(
    fileName: string,
    base64: string
  ): Promise<{ url: string; storage: string }> {
    const matches = base64.match(/^data:([A-Za-z-+\/]+);base64,(.+)$/);
    const mimeType = matches ? matches[1] : "image/png";
    const rawBase64 = matches ? matches[2] : base64.replace(/^data:[^;]+;base64,/, "");
    const buffer = Buffer.from(rawBase64, "base64");

    const ext = path.extname(fileName) || (mimeType.includes("jpeg") ? ".jpg" : ".png");
    const cleanBase = path.basename(fileName, ext).replace(/[^a-z0-9]/gi, "_").toLowerCase();
    const uniqueName = `${cleanBase}_${Date.now()}${ext}`;
    const storagePath = `uploads/${uniqueName}`;

    // 1. Try Firebase Storage if available
    if (this.storageBucket) {
      try {
        const file = this.storageBucket.file(storagePath);
        await file.save(buffer, {
          metadata: {
            contentType: mimeType,
            cacheControl: "public, max-age=31536000",
          },
          resumable: false,
        });

        try {
          await file.makePublic();
        } catch (e) {
          // ignore
        }

        const bucketName = this.storageBucket.name || this.config.storageBucket;
        const publicUrl = `https://firebasestorage.googleapis.com/v0/b/${bucketName}/o/${encodeURIComponent(storagePath)}?alt=media`;
        return { url: publicUrl, storage: "firebase_storage" };
      } catch (storageErr: any) {
        console.warn("Firebase Storage write warning:", storageErr.message);
      }
    }

    // 2. Safe local / /tmp storage fallback
    const isVercel = !!process.env.VERCEL;
    const uploadsDir = isVercel
      ? path.join(os.tmpdir(), "uploads")
      : path.join(process.cwd(), "uploads");

    try {
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }
      const localFilePath = path.join(uploadsDir, uniqueName);
      fs.writeFileSync(localFilePath, buffer);
      return { url: `/uploads/${uniqueName}`, storage: isVercel ? "tmp_filesystem" : "local_filesystem" };
    } catch (fsErr: any) {
      // 3. Guaranteed inline fallback for serverless environments
      return { url: `data:${mimeType};base64,${rawBase64}`, storage: "data_url" };
    }
  }

  // Health check details
  public async getHealth(): Promise<{
    status: "ok" | "degraded";
    database: "firestore" | "local_fallback";
    connectionMode: string;
    firestoreConnected: boolean;
    storageConnected: boolean;
    projectId: string;
    databaseId: string;
    storageBucket: string;
    collections: Record<string, number>;
    message: string;
    connectionError?: string | null;
  }> {
    const db = this.getDB();
    const collectionCounts: Record<string, number> = {};
    for (const col of DB_COLLECTIONS) {
      collectionCounts[col] = (db[col] || []).length;
    }

    return {
      status: this.isConnectedToFirestore ? "ok" : "degraded",
      database: this.isConnectedToFirestore ? "firestore" : "local_fallback",
      connectionMode: this.connectionMode,
      firestoreConnected: this.isConnectedToFirestore,
      storageConnected: this.isConnectedToStorage,
      projectId: this.config.projectId,
      databaseId: this.config.databaseId,
      storageBucket: this.config.storageBucket,
      collections: collectionCounts,
      message: this.isConnectedToFirestore
        ? `Live Firestore database connected via ${this.connectionMode === "admin_sdk" ? "Admin SDK" : "Firebase Web Client SDK"}`
        : "Running in local/memory fallback.",
      connectionError: this.connectionError
    };
  }
}

export const dbService = new DatabaseService();
