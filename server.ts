import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { dbService } from "./src/server/dbService.ts";

dotenv.config();

const app = express();
const PORT = 3000;

// High limits for handling large base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// =========================================================================
// 1. FAST-PATH FACEBOOK WEBHOOK VERIFICATION (GET)
// Must be registered before filesystem, Firebase or database operations
// =========================================================================
app.get(["/api/webhook/facebook", "/webhook/facebook"], (req, res) => {
  const rawVerifyToken = process.env.FACEBOOK_VERIFY_TOKEN || "abc_apartment_verify_token";
  const VERIFY_TOKEN = rawVerifyToken.trim();
  const fallbackToken = "abc_apartment_verify_token";

  // Support both flat query keys (hub.mode) and nested objects parsed by query parser (hub: { mode })
  const mode = req.query["hub.mode"] || (req.query["hub"] as any)?.mode;
  const token = req.query["hub.verify_token"] || (req.query["hub"] as any)?.verify_token;
  const challenge = req.query["hub.challenge"] || (req.query["hub"] as any)?.challenge;

  console.log("=== FACEBOOK WEBHOOK VERIFICATION REQUEST (EARLY ROUTE) ===");
  console.log("Received Query Params:", req.query);
  console.log("Parsed Verification fields:", { mode, token, challenge });
  console.log("Configured Verify Token:", `"${VERIFY_TOKEN}"`);

  if (mode && token) {
    const receivedToken = String(token).trim();
    const isMatch = (receivedToken === VERIFY_TOKEN) || (receivedToken === fallbackToken);

    if (mode === "subscribe" && isMatch) {
      console.log("✅ FACEBOOK_WEBHOOK_VERIFIED SUCCESSFULLY. Challenge returned:", challenge);
      res.set("Content-Type", "text/plain");
      return res.status(200).send(String(challenge));
    } else {
      console.warn("❌ FACEBOOK_WEBHOOK_VERIFICATION FAILED: Match mismatch!");
      console.warn(`Expected: "${VERIFY_TOKEN}" or "${fallbackToken}", Received: "${receivedToken}", Mode: "${mode}"`);
      return res.status(403).send("Verification token mismatch");
    }
  }
  console.warn("❌ FACEBOOK_WEBHOOK_VERIFICATION FAILED: Missing mode or token query params.");
  return res.status(400).send("Missing hub.mode or hub.verify_token query parameter");
});

// Ensure uploads folder does not attempt directory creation on read-only Vercel filesystem
const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
const uploadsDir = isVercel
  ? path.join(os.tmpdir(), "uploads")
  : path.join(process.cwd(), "uploads");

if (!isVercel) {
  try {
    if (!fs.existsSync(uploadsDir)) {
      fs.mkdirSync(uploadsDir, { recursive: true });
    }
  } catch (err) {
    console.warn("Could not create local uploads folder:", err);
  }
}

// Serve uploaded static files if directory exists
if (fs.existsSync(uploadsDir)) {
  app.use("/uploads", express.static(uploadsDir));
}

// Initialize Database Service Layer asynchronously (non-blocking)
dbService.initialize().catch((err: any) => {
  console.warn("DB Service initialization async notice:", err?.message || err);
});

// File Database path resolution with Vercel serverless /tmp fallback
const getDbPath = () => {
  if (process.env.VERCEL) {
    const tmpPath = path.join("/tmp", "data.json");
    if (!fs.existsSync(tmpPath)) {
      try {
        const rootDbPath = path.join(process.cwd(), "data.json");
        if (fs.existsSync(rootDbPath)) {
          fs.copyFileSync(rootDbPath, tmpPath);
        } else {
          fs.writeFileSync(tmpPath, JSON.stringify(initialData, null, 2));
        }
      } catch (err) {
        console.warn("Could not copy initial data to /tmp:", err);
      }
    }
    return tmpPath;
  }
  return path.join(process.cwd(), "data.json");
};

let inMemoryDBCache: any = null;

// Define default initial seed data
const initialData = {
  apartments: [
    {
      id: "apt-1",
      name: "ApartmentPro Plaza",
      address: "123 Rizal Ave, Manila",
      total_floors: 5,
      description: "Centrally located modern complex with active 24/7 security, high-speed elevators, and a shared rooftop lounge.",
      status: "active"
    },
    {
      id: "apt-2",
      name: "ApartmentPro Heights",
      address: "456 Quezon Blvd, Quezon City",
      total_floors: 4,
      description: "Family-friendly apartments with spacious floor plans, secure parking, and proximity to retail malls.",
      status: "active"
    },
    {
      id: "apt-3",
      name: "ApartmentPro Residences",
      address: "789 Shaw Blvd, Mandaluyong",
      total_floors: 3,
      description: "Premium boutique residential building with luxury amenities, located in the heart of the business district.",
      status: "inactive"
    }
  ],
  rooms: [
    // Apartment 1 Rooms
    {
      id: "room-101",
      apartment_id: "apt-1",
      room_number: "101",
      floor: 1,
      status: "occupied",
      tenant_id: "tenant-1",
      rent_amount: 12000,
      room_type: "studio",
      description: "Cozy ground-floor studio unit. Highly accessible, comes with built-in wardrobe, and semi-furnished kitchen countertop.",
      amenities: "Aircon, Wifi, Kitchen, Cabinet",
      image_url: "https://images.unsplash.com/photo-1522771739844-6a9f6d5f14af?auto=format&fit=crop&w=800&q=80",
      is_newly_available: false
    },
    {
      id: "room-102",
      apartment_id: "apt-1",
      room_number: "102",
      floor: 1,
      status: "vacant",
      rent_amount: 18000,
      room_type: "1BR",
      description: "Spacious 1-bedroom apartment with a dedicated living area. Newly refurbished with premium modern light fixtures.",
      amenities: "Aircon, Wifi, Refrigerator, Stove, Balcony",
      image_url: "https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?auto=format&fit=crop&w=800&q=80",
      is_newly_available: true
    },
    {
      id: "room-201",
      apartment_id: "apt-1",
      room_number: "201",
      floor: 2,
      status: "occupied",
      tenant_id: "tenant-2",
      rent_amount: 25000,
      room_type: "2BR",
      description: "Beautiful corner 2-bedroom unit overlooking the quiet side street. Great ventilation and abundant natural morning sunlight.",
      amenities: "Aircon, Wifi, Microwave, Parking, Gym Access",
      image_url: "https://images.unsplash.com/photo-1560448204-e02f11c3d0e2?auto=format&fit=crop&w=800&q=80",
      is_newly_available: false
    },
    {
      id: "room-301",
      apartment_id: "apt-1",
      room_number: "301",
      floor: 3,
      status: "maintenance",
      rent_amount: 35000,
      room_type: "3BR",
      description: "Expansive 3-bedroom penthouse room. High ceilings, panoramic windows. Currently undergoing deep cleaning and interior touchups.",
      amenities: "Aircon, Wifi, Laundry, Parking, Security, Gym Access",
      image_url: "https://images.unsplash.com/photo-1585418694458-dc8085ab369d?auto=format&fit=crop&w=800&q=80",
      is_newly_available: false
    },
    // Apartment 2 Rooms
    {
      id: "room-202",
      apartment_id: "apt-2",
      room_number: "202",
      floor: 2,
      status: "vacant",
      rent_amount: 14500,
      room_type: "studio",
      description: "Premium studio unit on the second floor. Includes custom modern layout, noise-reduction glass, and pristine hardwood style floors.",
      amenities: "Aircon, Wifi, Cabinet, Microwave",
      image_url: "https://images.unsplash.com/photo-1536376072261-38c75010e6c9?auto=format&fit=crop&w=800&q=80",
      is_newly_available: true
    },
    {
      id: "room-302",
      apartment_id: "apt-2",
      room_number: "302",
      floor: 3,
      status: "occupied",
      tenant_id: "tenant-3",
      rent_amount: 19000,
      room_type: "1BR",
      description: "Quiet 1-bedroom unit with a serene courtyard view. Spacious bedroom, separate dining area, and dedicated work desk space.",
      amenities: "Aircon, Wifi, Fridge, Desk, Washing Machine",
      image_url: "https://images.unsplash.com/photo-1502672011032-944d183f416a?auto=format&fit=crop&w=800&q=80",
      is_newly_available: false
    }
  ],
  tenants: [
    {
      id: "tenant-1",
      name: "John Doe",
      contact: "09171234567",
      email: "john.doe@example.com",
      room_id: "room-101",
      apartment_id: "apt-1",
      rent_amount: 12000,
      deposit: 24000,
      messenger_psid: "john.doe.messenger",
      status: "active",
      move_in_date: "2026-01-15"
    },
    {
      id: "tenant-2",
      name: "Maria Santos",
      contact: "09187654321",
      email: "maria.santos@example.com",
      room_id: "room-201",
      apartment_id: "apt-1",
      rent_amount: 25000,
      deposit: 50000,
      messenger_psid: "maria.santos.fb",
      status: "active",
      move_in_date: "2025-11-01"
    },
    {
      id: "tenant-3",
      name: "Juan dela Cruz",
      contact: "09204445555",
      email: "juan.delacruz@example.com",
      room_id: "room-302",
      apartment_id: "apt-2",
      rent_amount: 19000,
      deposit: 38000,
      messenger_psid: "juan.dc.pro",
      status: "active",
      move_in_date: "2026-03-01"
    }
  ],
  billingRecords: [
    {
      id: "bill-1",
      tenant_id: "tenant-1",
      tenant_name: "John Doe",
      room_id: "room-101",
      room_number: "101",
      apartment_id: "apt-1",
      rent_amount: 12000,
      electricity_amount: 1450,
      electricity_usage: 145,
      total_amount: 13450,
      billing_month: "June 2026",
      due_date: "2026-07-05",
      payment_status: "unpaid",
      notes: "Standard monthly rental and power billing for June 2026."
    },
    {
      id: "bill-2",
      tenant_id: "tenant-2",
      tenant_name: "Maria Santos",
      room_id: "room-201",
      room_number: "201",
      apartment_id: "apt-1",
      rent_amount: 25000,
      electricity_amount: 3200,
      electricity_usage: 320,
      total_amount: 28200,
      billing_month: "June 2026",
      due_date: "2026-07-05",
      payment_status: "paid",
      notes: "June billing paid in full on June 23, 2026."
    },
    {
      id: "bill-3",
      tenant_id: "tenant-3",
      tenant_name: "Juan dela Cruz",
      room_id: "room-302",
      room_number: "302",
      apartment_id: "apt-2",
      rent_amount: 19000,
      electricity_amount: 2100,
      electricity_usage: 210,
      total_amount: 21100,
      billing_month: "May 2026",
      due_date: "2026-06-05",
      payment_status: "overdue",
      notes: "Outstanding rent and electrical dues for May 2026. Friendly warning sent."
    }
  ],
  notifications: [
    {
      id: "notif-1",
      tenant_id: "tenant-1",
      tenant_name: "John Doe",
      billing_id: "bill-1",
      message: "Your rent and utility billing for June 2026 has been generated. Total due: ₱13,450.00. Due on 2026-07-05.",
      type: "billing",
      status: "sent",
      channel: "in_app",
      created_at: "2026-06-25T08:00:00Z"
    },
    {
      id: "notif-2",
      tenant_id: "tenant-3",
      tenant_name: "Juan dela Cruz",
      billing_id: "bill-3",
      message: "Overdue Alert: Your May 2026 bill of ₱21,100.00 is still unpaid. Please settle immediately to avoid convenience fees.",
      type: "overdue",
      status: "sent",
      channel: "in_app",
      created_at: "2026-06-10T10:00:00Z"
    }
  ],
  inquiries: [
    {
      id: "inq-1",
      name: "Clarissa Reyes",
      email: "clarissa.reyes@example.com",
      phone: "09159998888",
      room_id: "room-102",
      room_number: "102",
      apartment_name: "ApartmentPro Plaza",
      message: "Hi! I am very interested in Room 102. Is it available for viewing this weekend? I would like to schedule a quick walk-through.",
      preferred_visit_date: "2026-06-28",
      status: "new",
      created_at: "2026-06-24T14:30:00Z"
    },
    {
      id: "inq-2",
      name: "Vince David",
      email: "vince.david@example.com",
      phone: "09351112222",
      room_id: "room-202",
      room_number: "202",
      apartment_name: "ApartmentPro Heights",
      message: "Good day! Does the ₱14,500 rent for Room 202 already include wifi or is it separate? Thanks!",
      preferred_visit_date: "2026-06-30",
      status: "contacted",
      created_at: "2026-06-23T09:15:00Z"
    }
  ],
  maintenanceRequests: [
    {
      id: "maint-1",
      room_id: "room-101",
      room_number: "101",
      tenant_id: "tenant-1",
      tenant_name: "John Doe",
      issue_description: "The kitchen sink is leaking heavily whenever the tap is turned on. Need a plumber to fix the joint.",
      category: "Plumbing",
      priority: "Medium",
      status: "pending",
      created_at: "2026-06-25T10:00:00Z"
    },
    {
      id: "maint-2",
      room_id: "room-302",
      room_number: "302",
      tenant_id: "tenant-3",
      tenant_name: "Juan dela Cruz",
      issue_description: "The aircon unit makes a grinding noise and doesn't cool the room properly. Please check.",
      category: "Air Conditioning",
      priority: "Medium",
      status: "in_progress",
      created_at: "2026-06-24T08:30:00Z"
    }
  ],
  announcements: [
    {
      id: "ann-1",
      title: "Routine Water Tank Deep Cleaning Scheduled",
      content: "Please be informed that our water tanks will undergo annual deep cleaning on July 25, 2026. Water supply may experience lower pressure or intermittent interruption from 9:00 AM to 12:00 PM. Thank you for your cooperation.",
      created_at: "2026-07-15T09:00:00Z"
    },
    {
      id: "ann-2",
      title: "Elevator Maintenance Notice (Manila Block)",
      content: "The main passenger elevator in ApartmentPro Plaza will be shut down for monthly safety inspection and gear lubrication this Thursday, July 23, from 2:00 PM to 4:00 PM. Please use the stairs or service lift during this period.",
      created_at: "2026-07-18T10:30:00Z"
    },
    {
      id: "ann-3",
      title: "Garbage Disposal Guidelines Reminder",
      content: "A friendly reminder to all residents: please segregate wet and dry garbage. Ensure all trash bags are securely tied before placing them in the ground-floor chute. Let's keep our community clean and green!",
      created_at: "2026-07-19T08:00:00Z"
    }
  ],
  rules: [
    { id: "rule-1", rule_text: "Quiet hours are strictly observed from 10:00 PM to 6:00 AM daily. Please keep TV/music volumes low." },
    { id: "rule-2", rule_text: "Trash must be segregated into Biodegradable and Non-biodegradable and disposed of strictly inside designated bins." },
    { id: "rule-3", rule_text: "Visitors are allowed between 8:00 AM and 10:00 PM. Any overnight guests must be pre-registered with the management for security purposes." },
    { id: "rule-4", rule_text: "Pets are permitted only if they are registered, weigh under 15 lbs, and are kept on a leash in common areas at all times." },
    { id: "rule-5", rule_text: "Smoking is strictly prohibited inside the rooms and hallways. Please use the designated smoking area in the rooftop garden." },
    { id: "rule-6", rule_text: "No modifications or drilling of walls without prior approval from the property management office." }
  ],
  depositLedger: [],
  transactionLogs: [
    {
      id: "log-101",
      timestamp: new Date(Date.now() - 1000 * 60 * 30).toISOString(),
      category: "payment",
      action: "payment",
      title: "Rent & Utilities Payment Settled",
      details: "Payment of ₱28,200.00 for June 2026 statement was processed and marked as PAID.",
      amount: 28200,
      tenant_id: "tenant-2",
      tenant_name: "Maria Santos",
      room_number: "201",
      performed_by: "Admin User"
    },
    {
      id: "log-102",
      timestamp: new Date(Date.now() - 1000 * 60 * 180).toISOString(),
      category: "billing",
      action: "create",
      title: "Monthly Statement Generated",
      details: "Created June 2026 billing invoice (Rent: ₱12,000, Power: ₱1,450). Total due: ₱13,450.00.",
      amount: 13450,
      tenant_id: "tenant-1",
      tenant_name: "John Doe",
      room_number: "101",
      performed_by: "Admin User"
    },
    {
      id: "log-103",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 24).toISOString(),
      category: "deposit",
      action: "update",
      title: "Security Deposit Received",
      details: "Initial security deposit payment recorded during tenant onboarding.",
      amount: 38000,
      tenant_id: "tenant-3",
      tenant_name: "Juan dela Cruz",
      room_number: "302",
      performed_by: "Admin User"
    },
    {
      id: "log-104",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 36).toISOString(),
      category: "tenant",
      action: "move_in",
      title: "New Tenant Move-In Registered",
      details: "Registered Juan dela Cruz as active tenant in Room 302 with move-in date 2026-03-01.",
      amount: 38000,
      tenant_id: "tenant-3",
      tenant_name: "Juan dela Cruz",
      room_number: "302",
      performed_by: "Admin User"
    },
    {
      id: "log-105",
      timestamp: new Date(Date.now() - 1000 * 60 * 60 * 48).toISOString(),
      category: "maintenance",
      action: "create",
      title: "Maintenance Ticket Dispatched",
      details: "Plumbing service ticket dispatched for kitchen sink leak inspection.",
      tenant_id: "tenant-1",
      tenant_name: "John Doe",
      room_number: "101",
      performed_by: "System Dispatcher"
    }
  ]
};

// Log Transaction Helper
const logTransaction = (db: any, entry: {
  category: 'payment' | 'billing' | 'deposit' | 'tenant' | 'room' | 'apartment' | 'maintenance' | 'system';
  action?: 'create' | 'update' | 'delete' | 'payment' | 'move_in' | 'move_out' | 'status_change';
  title: string;
  details: string;
  amount?: number;
  tenant_id?: string;
  tenant_name?: string;
  room_number?: string;
  performed_by?: string;
}) => {
  if (!db.transactionLogs) db.transactionLogs = [];
  const newLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    category: entry.category,
    action: entry.action || 'create',
    title: entry.title,
    details: entry.details,
    amount: entry.amount,
    tenant_id: entry.tenant_id,
    tenant_name: entry.tenant_name,
    room_number: entry.room_number,
    performed_by: entry.performed_by || 'Admin User'
  };
  db.transactionLogs.unshift(newLog);
  return newLog;
};

// Database helper functions connected to Database Service Layer
const readDB = () => {
  return dbService.getDB();
};

const writeDB = (data: any) => {
  dbService.saveDB(data);
};

// Initialize DB state
readDB();

// ---------------- AUTH RATE LIMITING & SANITIZATION ----------------

interface AuthAttemptRecord {
  failedAttempts: number;
  lockoutCount: number;
  lockoutUntil: number; // timestamp in ms
}

const authAttempts = new Map<string, AuthAttemptRecord>();

// Helper to determine lockout duration based on how many times locked out
const getLockoutDurationSeconds = (lockoutCount: number): number => {
  if (lockoutCount <= 1) return 60;        // 1st lockout: 1 minute
  if (lockoutCount === 2) return 300;       // 2nd lockout: 5 minutes
  if (lockoutCount === 3) return 900;       // 3rd lockout: 15 minutes
  if (lockoutCount === 4) return 1800;      // 4th lockout: 30 minutes
  return 3600;                              // 5th+ lockout: 60 minutes
};

// Input sanitization helper to strip dangerous tags, quotes, control characters
const sanitizeAuthInput = (input: unknown, maxLength = 100): { clean: string; sanitized: boolean } => {
  if (typeof input !== "string") return { clean: "", sanitized: false };
  
  const original = input;
  let clean = input
    .replace(/\0/g, "")                  // remove null bytes
    .replace(/<[^>]*>?/gm, "")           // strip HTML tags
    .replace(/[<>"'`;\\$]/g, "")         // remove common script/SQL injection characters
    .trim();                             // trim whitespace

  if (clean.length > maxLength) {
    clean = clean.substring(0, maxLength);
  }

  const sanitized = clean !== original;
  return { clean, sanitized };
};

const getClientKey = (req: express.Request): string => {
  const forwarded = req.headers['x-forwarded-for'];
  const ip = typeof forwarded === 'string' ? forwarded.split(',')[0].trim() : req.socket.remoteAddress || 'client-unknown';
  return ip;
};

// ---------------- API ENDPOINTS ----------------

// Health & Database Connection Check
app.get(["/api/health", "/api/db/health"], async (req, res) => {
  try {
    const health = await dbService.getHealth();
    res.json({
      status: "ok",
      uptime: process.uptime(),
      timestamp: new Date().toISOString(),
      ...health
    });
  } catch (err: any) {
    res.status(500).json({ status: "error", message: err.message });
  }
});

// Auth Lockout Status Endpoint
app.get("/api/auth/status", (req, res) => {
  const key = getClientKey(req);
  const record = authAttempts.get(key);
  const now = Date.now();

  if (record && record.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
    const durationSeconds = getLockoutDurationSeconds(record.lockoutCount);
    res.json({
      locked: true,
      remainingSeconds,
      lockoutCount: record.lockoutCount,
      lockoutMinutes: Math.round(durationSeconds / 60),
      attemptsLeft: 0
    });
  } else {
    const failedAttempts = record ? record.failedAttempts : 0;
    const attemptsLeft = Math.max(0, 3 - failedAttempts);
    res.json({
      locked: false,
      remainingSeconds: 0,
      attemptsLeft,
      lockoutCount: record ? record.lockoutCount : 0
    });
  }
});

// 1. Auth Endpoint with 3-attempt limit, progressive timer lockout & input sanitization
app.post("/api/auth/login", (req, res) => {
  const key = getClientKey(req);
  const now = Date.now();
  let record = authAttempts.get(key);

  if (!record) {
    record = { failedAttempts: 0, lockoutCount: 0, lockoutUntil: 0 };
    authAttempts.set(key, record);
  }

  // 1. Check if currently locked out
  if (record.lockoutUntil > now) {
    const remainingSeconds = Math.ceil((record.lockoutUntil - now) / 1000);
    const durationSeconds = getLockoutDurationSeconds(record.lockoutCount);
    return res.status(429).json({
      success: false,
      locked: true,
      remainingSeconds,
      lockoutCount: record.lockoutCount,
      lockoutMinutes: Math.round(durationSeconds / 60),
      attemptsLeft: 0,
      message: `Account locked due to excessive failed attempts. Please wait ${remainingSeconds} second(s) before trying again.`
    });
  }

  // If lockout expired, reset lockoutUntil
  if (record.lockoutUntil > 0 && record.lockoutUntil <= now) {
    record.lockoutUntil = 0;
    record.failedAttempts = 0;
  }

  // 2. Sanitize inputs
  const rawUsername = req.body?.username;
  const rawPassword = req.body?.password;

  const { clean: username, sanitized: userSanitized } = sanitizeAuthInput(rawUsername, 50);
  const { clean: password, sanitized: passSanitized } = sanitizeAuthInput(rawPassword, 100);

  if (!username || !password) {
    return res.status(400).json({
      success: false,
      locked: false,
      attemptsLeft: Math.max(0, 3 - record.failedAttempts),
      message: "Username and password are required and cannot be blank or contain illegal characters."
    });
  }

  // 3. Verify Admin Credentials
  const expectedUser = process.env.ADMIN_USERNAME || "admin";
  const expectedPass = process.env.ADMIN_PASSWORD || "admin123";
  const isValid = username === expectedUser && password === expectedPass;

  if (isValid) {
    // Reset failed attempts and lockout levels on successful login
    record.failedAttempts = 0;
    record.lockoutCount = 0;
    record.lockoutUntil = 0;
    authAttempts.delete(key);

    const db = readDB();
    logTransaction(db, {
      category: "system",
      action: "payment", // or audit status
      title: "Admin Manager Login Successful",
      details: "Authorized administrator session started from property management portal.",
      performed_by: "Property Manager (Admin)"
    });
    writeDB(db);

    // Generate non-predictable, cryptographically secure session token
    const randomHex = crypto.randomBytes(32).toString("hex");
    const sessionToken = `apt_session_${randomHex}_${Date.now()}`;

    return res.json({
      success: true,
      token: sessionToken,
      user: { name: "Property Manager", role: "admin" }
    });
  }

  // 4. Failed Login Attempt
  record.failedAttempts += 1;

  if (record.failedAttempts >= 3) {
    // Increment lockout level (1 = 1 min, 2 = 5 min, 3 = 15 min, etc.)
    record.lockoutCount += 1;
    const durationSeconds = getLockoutDurationSeconds(record.lockoutCount);
    record.lockoutUntil = now + (durationSeconds * 1000);
    record.failedAttempts = 0; // reset failed count for next cycle

    const durationMinutes = Math.round(durationSeconds / 60);

    const db = readDB();
    logTransaction(db, {
      category: "system",
      action: "delete",
      title: `Security Lockout Triggered (${durationMinutes} min)`,
      details: `3 consecutive failed admin login attempts detected. Portal access temporarily locked for ${durationMinutes} minute(s) [Lockout Level ${record.lockoutCount}].`,
      performed_by: "Security Firewall"
    });
    writeDB(db);

    return res.status(429).json({
      success: false,
      locked: true,
      remainingSeconds: durationSeconds,
      lockoutCount: record.lockoutCount,
      lockoutMinutes: durationMinutes,
      attemptsLeft: 0,
      message: `Maximum 3 failed attempts reached. Portal access is locked for ${durationMinutes} minute${durationMinutes > 1 ? 's' : ''}.`
    });
  }

  const attemptsLeft = 3 - record.failedAttempts;

  return res.status(401).json({
    success: false,
    locked: false,
    attemptsLeft,
    lockoutCount: record.lockoutCount,
    message: `Invalid credentials, ${attemptsLeft} attempt${attemptsLeft === 1 ? '' : 's'} remaining`
  });
});

// 2. Fetch full DB state
app.get("/api/db", (req, res) => {
  res.json(readDB());
});

// 3. APARTMENTS CRUD
app.post("/api/apartments", (req, res) => {
  const db = readDB();
  const newApt = {
    id: `apt-${Date.now()}`,
    ...req.body
  };
  db.apartments.push(newApt);
  logTransaction(db, {
    category: "apartment",
    action: "create",
    title: "Building Complex Registered",
    details: `Added ${newApt.name} at ${newApt.address || 'N/A'} (${newApt.total_floors || 1} floors).`
  });
  writeDB(db);
  res.json(newApt);
});

app.put("/api/apartments/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.apartments.findIndex((a: any) => a.id === id);
  if (index !== -1) {
    db.apartments[index] = { ...db.apartments[index], ...req.body };
    logTransaction(db, {
      category: "apartment",
      action: "update",
      title: "Building Complex Updated",
      details: `Updated configuration for ${db.apartments[index].name}.`
    });
    writeDB(db);
    res.json(db.apartments[index]);
  } else {
    res.status(404).json({ message: "Apartment not found" });
  }
});

// 4. ROOMS CRUD
app.post("/api/rooms", (req, res) => {
  const db = readDB();
  const newRoom = {
    id: `room-${Date.now()}`,
    ...req.body
  };
  db.rooms.push(newRoom);
  logTransaction(db, {
    category: "room",
    action: "create",
    title: "Room Unit Added",
    details: `Created Room ${newRoom.room_number} (${(newRoom.room_type || 'Studio').toUpperCase()}, Rent: ₱${Number(newRoom.rent_amount || 0).toLocaleString()}).`,
    room_number: newRoom.room_number,
    amount: Number(newRoom.rent_amount || 0)
  });
  writeDB(db);
  res.json(newRoom);
});

app.put("/api/rooms/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.rooms.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    db.rooms[index] = { ...db.rooms[index], ...req.body };
    logTransaction(db, {
      category: "room",
      action: "update",
      title: "Room Unit Updated",
      details: `Updated Room ${db.rooms[index].room_number} status to ${(db.rooms[index].status || '').toUpperCase()}.`,
      room_number: db.rooms[index].room_number
    });
    writeDB(db);
    res.json(db.rooms[index]);
  } else {
    res.status(404).json({ message: "Room not found" });
  }
});

// 5. TENANTS CRUD & Room Assignment Logic
app.post("/api/tenants", (req, res) => {
  const db = readDB();
  const dep = Number(req.body.deposit || 0);
  const adv = Number(req.body.advance_payment || 0);

  const newTenant = {
    id: `tenant-${Date.now()}`,
    ...req.body,
    deposit: dep,
    advance_payment: adv,
    deposit_balance: dep,
    advance_balance: adv,
    status: "active"
  };
  db.tenants.push(newTenant);

  // Auto assign room: Set room to occupied and assign tenant_id
  let roomNum = "N/A";
  const roomIdx = db.rooms.findIndex((r: any) => r.id === newTenant.room_id);
  if (roomIdx !== -1) {
    db.rooms[roomIdx].status = "occupied";
    db.rooms[roomIdx].tenant_id = newTenant.id;
    roomNum = db.rooms[roomIdx].room_number;
  }

  logTransaction(db, {
    category: "tenant",
    action: "move_in",
    title: "New Tenant Registered",
    details: `Onboarded ${newTenant.name} into Room ${roomNum}. Security Deposit: ₱${dep.toLocaleString()}, Advance Rent: ₱${adv.toLocaleString()}.`,
    amount: dep + adv,
    tenant_id: newTenant.id,
    tenant_name: newTenant.name,
    room_number: roomNum
  });

  writeDB(db);
  res.json(newTenant);
});

app.put("/api/tenants/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.tenants.findIndex((t: any) => t.id === id);
  if (index !== -1) {
    const oldTenant = db.tenants[index];
    const updatedTenant = { ...oldTenant, ...req.body };
    db.tenants[index] = updatedTenant;

    // Handle room reassignment if room_id changed
    if (oldTenant.room_id !== updatedTenant.room_id) {
      // Mark old room as vacant
      const oldRoomIdx = db.rooms.findIndex((r: any) => r.id === oldTenant.room_id);
      if (oldRoomIdx !== -1) {
        db.rooms[oldRoomIdx].status = "vacant";
        delete db.rooms[oldRoomIdx].tenant_id;
      }

      // Mark new room as occupied
      const newRoomIdx = db.rooms.findIndex((r: any) => r.id === updatedTenant.room_id);
      if (newRoomIdx !== -1) {
        db.rooms[newRoomIdx].status = "occupied";
        db.rooms[newRoomIdx].tenant_id = updatedTenant.id;
      }
    }

    // Handle tenant status change (e.g. moved_out)
    if (updatedTenant.status === "moved_out") {
      const roomIdx = db.rooms.findIndex((r: any) => r.id === updatedTenant.room_id);
      if (roomIdx !== -1) {
        db.rooms[roomIdx].status = "vacant";
        delete db.rooms[roomIdx].tenant_id;
      }
    } else if (updatedTenant.status === "active") {
      const roomIdx = db.rooms.findIndex((r: any) => r.id === updatedTenant.room_id);
      if (roomIdx !== -1) {
        db.rooms[roomIdx].status = "occupied";
        db.rooms[roomIdx].tenant_id = updatedTenant.id;
      }
    }

    const roomObj = db.rooms.find((r: any) => r.id === updatedTenant.room_id);
    logTransaction(db, {
      category: "tenant",
      action: "update",
      title: "Tenant Profile Updated",
      details: `Updated details for ${updatedTenant.name} (Status: ${(updatedTenant.status || '').toUpperCase()}).`,
      tenant_id: updatedTenant.id,
      tenant_name: updatedTenant.name,
      room_number: roomObj?.room_number || "N/A"
    });

    writeDB(db);
    res.json(updatedTenant);
  } else {
    res.status(404).json({ message: "Tenant not found" });
  }
});

// Move Out Endpoint
app.post("/api/tenants/:id/move-out", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const tenantIdx = db.tenants.findIndex((t: any) => t.id === id);
  if (tenantIdx !== -1) {
    db.tenants[tenantIdx].status = "moved_out";
    
    // Set associated room to vacant
    const roomId = db.tenants[tenantIdx].room_id;
    const roomIdx = db.rooms.findIndex((r: any) => r.id === roomId);
    let roomNum = "N/A";
    if (roomIdx !== -1) {
      db.rooms[roomIdx].status = "vacant";
      delete db.rooms[roomIdx].tenant_id;
      roomNum = db.rooms[roomIdx].room_number;
    }

    logTransaction(db, {
      category: "tenant",
      action: "move_out",
      title: "Tenant Move-Out Processed",
      details: `Tenant ${db.tenants[tenantIdx].name} officially moved out of Room ${roomNum}. Room set to vacant.`,
      tenant_id: db.tenants[tenantIdx].id,
      tenant_name: db.tenants[tenantIdx].name,
      room_number: roomNum
    });

    writeDB(db);
    res.json(db.tenants[tenantIdx]);
  } else {
    res.status(404).json({ message: "Tenant not found" });
  }
});

// Record Deposit or Advance Ledger Transaction & Dispatch to Messenger
app.post("/api/tenants/:id/ledger", async (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const { type, amount, description } = req.body;

  const tenantIdx = db.tenants.findIndex((t: any) => t.id === id);
  if (tenantIdx === -1) {
    return res.status(404).json({ message: "Tenant not found" });
  }

  const tenant = db.tenants[tenantIdx];
  const numAmount = Number(amount || 0);

  if (isNaN(numAmount) || numAmount <= 0) {
    return res.status(400).json({ message: "Amount must be a positive number" });
  }

  // Initialize fields if undefined
  tenant.deposit_balance = tenant.deposit_balance !== undefined ? Number(tenant.deposit_balance) : Number(tenant.deposit || 0);
  tenant.advance_payment = tenant.advance_payment !== undefined ? Number(tenant.advance_payment) : Number(tenant.rent_amount || 0);
  tenant.advance_balance = tenant.advance_balance !== undefined ? Number(tenant.advance_balance) : Number(tenant.advance_payment || 0);

  // Apply changes to balances
  switch (type) {
    case "deposit_payment":
      tenant.deposit_balance += numAmount;
      break;
    case "deposit_refund":
      tenant.deposit_balance = Math.max(0, tenant.deposit_balance - numAmount);
      break;
    case "deposit_deduction":
      tenant.deposit_balance = Math.max(0, tenant.deposit_balance - numAmount);
      break;
    case "advance_payment":
      tenant.advance_payment += numAmount;
      tenant.advance_balance += numAmount;
      break;
    case "advance_use":
      tenant.advance_balance = Math.max(0, tenant.advance_balance - numAmount);
      break;
    case "advance_refund":
      tenant.advance_balance = Math.max(0, tenant.advance_balance - numAmount);
      break;
    default:
      return res.status(400).json({ message: "Invalid transaction type" });
  }

  // Record ledger entry
  const newEntry = {
    id: `ledger-${Date.now()}`,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    type,
    amount: numAmount,
    description: description || "",
    created_at: new Date().toISOString()
  };

  db.depositLedger = db.depositLedger || [];
  db.depositLedger.push(newEntry);

  const roomObj = db.rooms.find((r: any) => r.id === tenant.room_id);
  const roomNumber = roomObj ? roomObj.room_number : "N/A";
  const aptObj = db.apartments.find((a: any) => a.id === tenant.apartment_id);
  const aptName = aptObj ? aptObj.name : "ApartmentPro Plaza";

  const typeLabels: Record<string, string> = {
    deposit_payment: "Security Deposit Payment (Added)",
    deposit_refund: "Security Deposit Refund (Released)",
    deposit_deduction: "Security Deposit Deduction",
    advance_payment: "Advance Rent Payment (Added)",
    advance_use: "Advance Rent Applied to Stay / Bill",
    advance_refund: "Advance Rent Refund (Released)"
  };
  const typeLabel = typeLabels[type] || type.replace(/_/g, ' ').toUpperCase();

  const formattedDate = new Date().toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });

  // Construct comprehensive formatted Messenger receipt text
  const messengerReceipt = `📜 APARTMENT LEDGER & ESCROW RECEIPT\n` +
    `🏢 ${aptName}\n` +
    `👤 Tenant: ${tenant.name} (Room ${roomNumber})\n` +
    `📅 Transaction Date: ${formattedDate}\n\n` +
    `-----------------------------------\n` +
    `📌 Transaction: ${typeLabel}\n` +
    `💵 Amount: ₱${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
    (description ? `📝 Remarks / Reason: ${description}\n` : '') +
    `-----------------------------------\n` +
    `📊 UPDATED ACCOUNT BALANCES:\n` +
    `🛡️ Security Deposit Balance: ₱${tenant.deposit_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n` +
    `💳 Advance Rent Balance: ₱${tenant.advance_balance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}\n\n` +
    `This transaction has been officially recorded in your property ledger. Please retain this receipt for your reference. Thank you!`;

  // 1. In-App Notification
  const notifMsg = `💰 Ledger Update [${type.replace("_", " ").toUpperCase()}]: ₱${numAmount.toLocaleString()} recorded for ${tenant.name}. (New Deposit Bal: ₱${tenant.deposit_balance.toLocaleString()}, Advance Bal: ₱${tenant.advance_balance.toLocaleString()})`;
  db.notifications.push({
    id: `notif-${Date.now()}`,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    message: notifMsg,
    type: "general" as const,
    status: "sent" as const,
    channel: "in_app" as const,
    created_at: new Date().toISOString()
  });

  // 2. Facebook Messenger Notification Record
  db.notifications.push({
    id: `notif-msg-${Date.now()}`,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    message: messengerReceipt,
    type: "general" as const,
    status: "sent" as const,
    channel: "messenger" as const,
    created_at: new Date().toISOString()
  });

  logTransaction(db, {
    category: "deposit",
    action: "update",
    title: `Ledger Entry: ${type.replace(/_/g, ' ').toUpperCase()}`,
    details: `${description || type} of ₱${numAmount.toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${tenant.name} (Room ${roomNumber}). Dispatched transaction receipt to tenant Messenger. (Deposit Bal: ₱${tenant.deposit_balance.toLocaleString('en-US')}, Advance Bal: ₱${tenant.advance_balance.toLocaleString('en-US')})`,
    amount: numAmount,
    tenant_id: tenant.id,
    tenant_name: tenant.name,
    room_number: roomNumber
  });

  writeDB(db);

  // 3. Dispatch directly to Facebook Messenger via Graph API if PSID and token are present
  const targetPsid = tenant.facebook_psid || tenant.messenger_psid;
  if (targetPsid && !targetPsid.includes("@") && !targetPsid.includes(".fb") && !targetPsid.startsWith("http")) {
    try {
      await sendFacebookMessage(targetPsid, { text: messengerReceipt });
    } catch (fbErr) {
      console.warn("Could not dispatch ledger receipt to Facebook Messenger PSID:", fbErr);
    }
  }

  const messengerUrl = tenant.messenger_psid 
    ? (tenant.messenger_psid.startsWith("http") ? tenant.messenger_psid : `https://www.messenger.com/t/${tenant.messenger_psid}`)
    : "https://www.messenger.com";

  res.json({
    success: true,
    tenant,
    entry: newEntry,
    messenger_text: messengerReceipt,
    messenger_psid: tenant.messenger_psid || tenant.facebook_psid,
    messenger_url: messengerUrl
  });
});

// GET all ledger records
app.get("/api/ledger", (req, res) => {
  const db = readDB();
  res.json(db.depositLedger || []);
});

// Update / Adjust a ledger record
app.put("/api/ledger/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const { description } = req.body;

  const entryIdx = (db.depositLedger || []).findIndex((e: any) => e.id === id);
  if (entryIdx === -1) {
    return res.status(404).json({ message: "Ledger entry not found" });
  }

  if (description !== undefined) {
    db.depositLedger[entryIdx].description = description;
  }

  writeDB(db);
  res.json(db.depositLedger[entryIdx]);
});

// Delete / Reverse a ledger record
app.delete("/api/ledger/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;

  const entryIdx = (db.depositLedger || []).findIndex((e: any) => e.id === id);
  if (entryIdx === -1) {
    return res.status(404).json({ message: "Ledger entry not found" });
  }

  const entry = db.depositLedger[entryIdx];
  const tenant = db.tenants.find((t: any) => t.id === entry.tenant_id);

  // Reverse balance if tenant exists
  if (tenant) {
    const numAmount = Number(entry.amount || 0);
    switch (entry.type) {
      case "deposit_payment":
        tenant.deposit_balance = Math.max(0, (tenant.deposit_balance || 0) - numAmount);
        break;
      case "deposit_refund":
      case "deposit_deduction":
        tenant.deposit_balance = (tenant.deposit_balance || 0) + numAmount;
        break;
      case "advance_payment":
        tenant.advance_balance = Math.max(0, (tenant.advance_balance || 0) - numAmount);
        tenant.advance_payment = Math.max(0, (tenant.advance_payment || 0) - numAmount);
        break;
      case "advance_use":
      case "advance_refund":
        tenant.advance_balance = (tenant.advance_balance || 0) + numAmount;
        break;
    }
  }

  // Remove from ledger
  db.depositLedger.splice(entryIdx, 1);

  logTransaction(db, {
    category: "deposit",
    action: "delete",
    title: `Ledger Entry Reversal: ${entry.type}`,
    details: `Reversed ledger entry of ₱${Number(entry.amount || 0).toLocaleString()} for ${entry.tenant_name}.`,
    amount: entry.amount,
    tenant_id: entry.tenant_id,
    tenant_name: entry.tenant_name
  });

  writeDB(db);
  res.json({ success: true, message: "Ledger entry reversed successfully", tenant });
});

// 6. BILLING RECORDS CRUD & Auto Tenant Notification
app.post("/api/billing", (req, res) => {
  const db = readDB();
  const billingId = `bill-${Date.now()}`;
  const newBill = {
    id: billingId,
    ...req.body
  };
  db.billingRecords.push(newBill);

  // Auto-create an in-app notification for the tenant
  const tenant = db.tenants.find((t: any) => t.id === newBill.tenant_id);
  if (tenant) {
    const newNotif = {
      id: `notif-${Date.now()}`,
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      billing_id: billingId,
      message: `Your rent and utility billing for ${newBill.billing_month} has been generated. Total due: ₱${Number(newBill.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}. Due on ${newBill.due_date}.`,
      type: "billing" as const,
      status: "sent" as const,
      channel: "in_app" as const,
      created_at: new Date().toISOString()
    };
    db.notifications.push(newNotif);
  }

  logTransaction(db, {
    category: "billing",
    action: "create",
    title: "Billing Invoice Statement Issued",
    details: `Issued ${newBill.billing_month} billing statement for ${newBill.tenant_name} (Room ${newBill.room_number}). Total due: ₱${Number(newBill.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })}. Payment Due Date: ${newBill.due_date}.`,
    amount: Number(newBill.total_amount),
    tenant_id: newBill.tenant_id,
    tenant_name: newBill.tenant_name,
    room_number: newBill.room_number
  });

  writeDB(db);
  res.json(newBill);
});

app.put("/api/billing/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.billingRecords.findIndex((b: any) => b.id === id);
  if (index !== -1) {
    db.billingRecords[index] = { ...db.billingRecords[index], ...req.body };
    const bill = db.billingRecords[index];
    logTransaction(db, {
      category: "billing",
      action: "update",
      title: "Billing Statement Modified",
      details: `Updated ${bill.billing_month} billing record for ${bill.tenant_name} (Status: ${bill.payment_status.toUpperCase()}).`,
      amount: Number(bill.total_amount),
      tenant_id: bill.tenant_id,
      tenant_name: bill.tenant_name,
      room_number: bill.room_number
    });
    writeDB(db);
    res.json(db.billingRecords[index]);
  } else {
    res.status(404).json({ message: "Billing record not found" });
  }
});

// Mark as Paid
app.post("/api/billing/:id/pay", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.billingRecords.findIndex((b: any) => b.id === id);
  if (index !== -1) {
    db.billingRecords[index].payment_status = "paid";
    const bill = db.billingRecords[index];

    logTransaction(db, {
      category: "payment",
      action: "payment",
      title: "Rent & Utilities Payment Settled",
      details: `Payment of ₱${Number(bill.total_amount).toLocaleString('en-US', { minimumFractionDigits: 2 })} for ${bill.billing_month} statement was received and marked as PAID for ${bill.tenant_name} (Room ${bill.room_number}).`,
      amount: Number(bill.total_amount),
      tenant_id: bill.tenant_id,
      tenant_name: bill.tenant_name,
      room_number: bill.room_number
    });

    writeDB(db);
    res.json(db.billingRecords[index]);
  } else {
    res.status(404).json({ message: "Billing record not found" });
  }
});

// 7. INQUIRIES ENDPOINTS
app.post("/api/inquiries", (req, res) => {
  const db = readDB();
  const newInq = {
    id: `inq-${Date.now()}`,
    ...req.body,
    status: "new",
    created_at: new Date().toISOString()
  };
  db.inquiries.push(newInq);

  logTransaction(db, {
    category: "system",
    action: "create",
    title: "Guest Inquiry Received",
    details: `Inquiry received from ${newInq.name} (${newInq.email || newInq.phone}) regarding Room ${newInq.room_number || "Vacant Room"}.`,
    room_number: newInq.room_number,
    performed_by: "Guest Inquiry Web Form"
  });

  writeDB(db);
  res.json(newInq);
});

app.put("/api/inquiries/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  const index = db.inquiries.findIndex((i: any) => i.id === id);
  if (index !== -1) {
    db.inquiries[index] = { ...db.inquiries[index], ...req.body };
    writeDB(db);
    res.json(db.inquiries[index]);
  } else {
    res.status(404).json({ message: "Inquiry not found" });
  }
});

// 8. NOTIFICATIONS ENDPOINTS
app.post("/api/notifications/mark-read", (req, res) => {
  const db = readDB();
  db.notifications.forEach((n: any) => {
    n.status = "sent"; // Or other custom read status if needed
  });
  writeDB(db);
  res.json({ success: true });
});

// 10. CHATBOT AND APARTMENT SERVICES
// Initialize Google GenAI
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
let aiClient: any = null;

const getAIClient = () => {
  if (!aiClient) {
    if (GEMINI_API_KEY) {
      aiClient = new GoogleGenAI({
        apiKey: GEMINI_API_KEY,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });
    }
  }
  return aiClient;
};

// Chatbot query route
app.post("/api/chatbot/query", async (req, res) => {
  const { message, tenantId, history } = req.body;
  if (!message) {
    return res.status(400).json({ error: "Message is required" });
  }

  const db = readDB();
  const announcementsList = db.announcements || [];
  const rulesList = db.rules || [];

  // 1. Gather tenant context if logged in
  let tenantContext = "The user is browsing as a Guest. No specific tenant details are logged in.";
  let tenantObj: any = null;
  let outstandingBalance = 0;
  let nextDueDate = "No active dues";
  let roomNum = "";

  if (tenantId) {
    tenantObj = db.tenants.find((t: any) => t.id === tenantId);
    if (tenantObj) {
      const room = db.rooms.find((r: any) => r.id === tenantObj.room_id);
      roomNum = room ? room.room_number : "";
      
      const tenantBills = db.billingRecords.filter((b: any) => b.tenant_id === tenantId);
      const unpaidBills = tenantBills.filter((b: any) => b.payment_status === "unpaid" || b.payment_status === "overdue");
      outstandingBalance = unpaidBills.reduce((sum: number, b: any) => sum + b.total_amount, 0);
      
      if (unpaidBills.length > 0) {
        // Find earliest due date
        const sortedBills = [...unpaidBills].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        nextDueDate = sortedBills[0].due_date;
      }

      tenantContext = `The user is logged in as a tenant.
Tenant Profile:
- Name: ${tenantObj.name}
- Room Number: ${roomNum}
- Contact Number: ${tenantObj.contact}
- Rent Amount: ₱${Number(tenantObj.rent_amount).toLocaleString('en-US')}
- Outstanding Rent & Utility Balance: ₱${Number(outstandingBalance).toLocaleString('en-US')}
- Next Rent Due Date: ${nextDueDate}
- Contract Status: ${tenantObj.status === 'active' ? 'Active Lease Agreement' : tenantObj.status}`;
    }
  }

  // 2. Local Fallback generator (for offline / no API key)
  const generateLocalResponse = (msg: string) => {
    const text = msg.toLowerCase().trim();
    
    // Quick Actions
    if (text.includes("balance") || text.includes("outstanding") || (text.includes("how much") && text.includes("rent"))) {
      if (tenantObj) {
        return {
          reply: `Hello ${tenantObj.name}! Your current outstanding balance is **₱${Number(outstandingBalance).toLocaleString('en-US')}**. This includes your monthly rent and utilities.`,
          intent: "get_rent_balance",
          suggested_replies: ["📅 View Due Date", "📜 Apartment Rules", "🔧 Report Maintenance"]
        };
      } else {
        return {
          reply: "To check your rent balance, please select your Tenant Profile first from the profile switcher at the top of the chat window.",
          intent: "get_rent_balance",
          suggested_replies: ["👤 Identify Myself", "📜 Apartment Rules", "📢 View Announcements"]
        };
      }
    }

    if (text.includes("due date") || text.includes("when is rent due") || text.includes("deadline")) {
      if (tenantObj) {
        return {
          reply: `Your next rent and utilities payment due date is **${nextDueDate}**. Please settle on or before this date to avoid convenience charges.`,
          intent: "view_due_date",
          suggested_replies: ["💰 Check Rent Balance", "🔧 Report Maintenance", "📜 Apartment Rules"]
        };
      } else {
        return {
          reply: "To check your rent due date, please select your Tenant Profile from the profile switcher at the top of the chat window.",
          intent: "view_due_date",
          suggested_replies: ["👤 Identify Myself", "📜 Apartment Rules", "📢 View Announcements"]
        };
      }
    }

    if (text.includes("rules") || text.includes("policies") || text.includes("overnight") || text.includes("pet") || text.includes("noise") || text.includes("smoking")) {
      const rulesStr = rulesList.map((r: any, idx: number) => `**Rule ${idx + 1}:** ${r.rule_text}`).join("\n\n");
      return {
        reply: `### ABC Apartment Complex Rules:\n\n${rulesStr || "No rules are currently logged."}`,
        intent: "view_rules",
        suggested_replies: ["💰 Check Rent Balance", "📢 View Announcements", "🔧 Report Maintenance"]
      };
    }

    if (text.includes("announcement") || text.includes("news") || text.includes("updates") || text.includes("schedule")) {
      const annStr = announcementsList.map((a: any) => `📢 **${a.title}**\n${a.content}\n*(Posted: ${new Date(a.created_at).toLocaleDateString()})*`).join("\n\n⸻\n\n");
      return {
        reply: `### Latest Complex Announcements:\n\n${annStr || "No announcements have been posted yet."}`,
        intent: "view_announcements",
        suggested_replies: ["📜 Apartment Rules", "🔧 Report Maintenance", "💰 Check Rent Balance"]
      };
    }

    if (text.includes("profile") || text.includes("my account") || text.includes("who am i")) {
      if (tenantObj) {
        return {
          reply: `### Tenant Profile:\n- **Name:** ${tenantObj.name}\n- **Room Number:** ${roomNum}\n- **Contact:** ${tenantObj.contact}\n- **Rent Amount:** ₱${Number(tenantObj.rent_amount).toLocaleString('en-US')}/mo\n- **Contract Status:** ${tenantObj.status.toUpperCase()}`,
          intent: "view_profile",
          suggested_replies: ["💰 Check Rent Balance", "📅 View Due Date", "🔧 Report Maintenance"]
        };
      } else {
        return {
          reply: "You are currently browsing as a Guest. Please select your Tenant Profile from the dropdown menu at the top of the chat screen.",
          intent: "view_profile",
          suggested_replies: ["👤 Identify Myself", "📜 Apartment Rules", "📢 View Announcements"]
        };
      }
    }

    // Check if reporting maintenance manually
    const categories = ["plumbing", "electrical", "internet", "aircon", "air conditioning", "furniture", "cleaning", "leak", "water", "light", "faucet", "clogged", "broken", "wifi"];
    const containsMaintKeyword = categories.some(cat => text.includes(cat)) || text.includes("maintenance") || text.includes("repair");
    
    if (containsMaintKeyword) {
      // Determine category and priority locally
      let category: any = "Other";
      let priority: 'High' | 'Medium' | 'Low' = "Medium";
      let description = msg;

      if (text.includes("leak") || text.includes("water") || text.includes("plumbing") || text.includes("faucet") || text.includes("toilet") || text.includes("sink")) {
        category = "Plumbing";
        if (text.includes("no water") || text.includes("burst") || text.includes("flooding") || text.includes("flood")) {
          priority = "High";
        }
      } else if (text.includes("electricity") || text.includes("light") || text.includes("wire") || text.includes("spark") || text.includes("power") || text.includes("outlet") || text.includes("electrical")) {
        category = "Electrical";
        if (text.includes("no power") || text.includes("spark") || text.includes("burning") || text.includes("short circuit")) {
          priority = "High";
        }
      } else if (text.includes("internet") || text.includes("wifi") || text.includes("router") || text.includes("connection")) {
        category = "Internet";
        priority = "Low";
      } else if (text.includes("aircon") || text.includes("air conditioning") || text.includes("cooling") || text.includes("ac")) {
        category = "Air Conditioning";
        priority = "Medium";
      } else if (text.includes("furniture") || text.includes("bed") || text.includes("chair") || text.includes("table") || text.includes("cabinet") || text.includes("cupboard")) {
        category = "Furniture";
        priority = "Low";
      } else if (text.includes("cleaning") || text.includes("trash") || text.includes("dirt") || text.includes("pest") || text.includes("bugs")) {
        category = "Cleaning";
        priority = "Low";
      }

      // Automatically create a maintenance request ticket!
      const newMaintId = `maint-${Date.now()}`;
      const newMaint = {
        id: newMaintId,
        room_id: tenantObj ? tenantObj.room_id : "",
        room_number: roomNum || "Guest Room/Unknown",
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : "Guest Visitor",
        issue_description: description,
        category,
        priority,
        status: "pending" as const,
        created_at: new Date().toISOString()
      };
      
      db.maintenanceRequests = db.maintenanceRequests || [];
      db.maintenanceRequests.push(newMaint);

      // Notify Admin
      const urgencyStr = priority === "High" ? "🔴 HIGH PRIORITY" : priority === "Medium" ? "🟡 MEDIUM PRIORITY" : "🟢 LOW PRIORITY";
      const newNotif = {
        id: `notif-${Date.now()}`,
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : "Guest Visitor",
        message: `🔧 Maintenance Ticket [${urgencyStr}]: New ${category} ticket submitted by Room ${roomNum || "Guest"} - "${description.substring(0, 80)}..."`,
        type: "general" as const,
        status: "sent" as const,
        channel: "in_app" as const,
        created_at: new Date().toISOString()
      };
      db.notifications.push(newNotif);
      writeDB(db);

      const priorityEmoji = priority === "High" ? "🔴" : priority === "Medium" ? "🟡" : "🟢";
      return {
        reply: `🔧 **Maintenance Request Filed!**\n\nI have logged the issue in our system:\n- **Ticket ID:** \`${newMaintId}\`\n- **Category:** ${category}\n- **Assigned Priority:** ${priorityEmoji} ${priority}\n- **Status:** ⏳ Pending Review\n\nOur property administration team has been notified immediately and will contact you shortly.`,
        intent: "report_maintenance",
        create_ticket: true,
        ticket_details: { category, priority, description },
        suggested_replies: ["💰 Check Rent Balance", "📢 View Announcements", "📜 Apartment Rules"]
      };
    }

    // Default conversational reply
    return {
      reply: `Hello! I am **ABC Apartment Assistant**. I can help you with your property needs:\n\n- 💰 **Check Rent Balance**\n- 📅 **View Due Date**\n- 🔧 **Report Maintenance**\n- 📢 **View Announcements**\n- 📜 **Apartment Rules**\n- 👤 **My Profile**\n\nWhat can I assist you with today?`,
      intent: "chat",
      suggested_replies: ["💰 Check Rent Balance", "📜 Apartment Rules", "📢 View Announcements"]
    };
  };

  // 3. Try Gemini API
  const ai = getAIClient();
  if (!ai) {
    console.log("No Gemini API key configured. Utilizing local hybrid/rule chatbot parser.");
    return res.json(generateLocalResponse(message));
  }

  try {
    const rulesSummary = rulesList.map((r: any, i: number) => `- Rule: ${r.rule_text}`).join("\n");
    const annSummary = announcementsList.map((a: any) => `- [${a.title}]: ${a.content} (Posted: ${a.created_at})`).join("\n");

    const systemPrompt = `You are "ABC Apartment Assistant", a highly polished, helpful, and professional virtual property assistant for the ABC Apartment complex.
Your job is to assist tenants and guests. You are fully integrated with the property database.

Current Context:
${tenantContext}

Apartment Policies/Rules:
${rulesSummary || "No rules registered."}

Active Announcements:
${annSummary || "No announcements registered."}

INSTRUCTIONS:
1. Detect user's intent. If they are asking about rent, rules, announcements, due date, profile, or a maintenance problem, answer accurately using the context.
2. If the user is describing a physical or maintenance problem (e.g. leaking faucet, broken lights, no water, broken AC), classified as "report_maintenance":
   - You MUST set "create_ticket" to true.
   - Select a "category" from: "Plumbing", "Electrical", "Internet", "Air Conditioning", "Furniture", "Cleaning", "Other".
   - Select a "priority" from: "High" (urgent matters like no water, burning smell, total blackout, severe flooding), "Medium" (faucet leaks, broken AC unit noise, appliance malfunctioning), "Low" (broken desk chair, lightbulb burnt, minor cleanup).
   - In your conversational "reply", reassure the user that their ticket has been filed and the admin has been notified.
3. Be natural, professional, and use bullet points and emojis to keep responses readable.
4. Keep the conversational reply in standard markdown text.
5. Provide 2-3 logical "suggested_replies" as quick-action prompts (e.g. ["View Due Date", "Report Leak", "Apartment Rules"]).
6. You MUST return ONLY a JSON response matching this schema:
{
  "reply": "Conversational reply text, formatted in markdown",
  "intent": "get_rent_balance | view_due_date | report_maintenance | view_announcements | view_rules | view_profile | chat",
  "create_ticket": true or false,
  "ticket_details": {
    "category": "Plumbing | Electrical | Internet | Air Conditioning | Furniture | Cleaning | Other",
    "priority": "High | Medium | Low",
    "description": "Brief summary of the issue reported"
  },
  "suggested_replies": ["Action A", "Action B"]
}
Note: ticket_details is required only if create_ticket is true.`;

    // Map history to Gemini format
    const contents: any[] = [];
    if (history && history.length > 0) {
      // Limit to last 6 messages to avoid bloating
      const recentHistory = history.slice(-6);
      for (const h of recentHistory) {
        contents.push({
          role: h.sender === 'user' ? 'user' : 'model',
          parts: [{ text: h.text }]
        });
      }
    }
    // Append latest user message
    contents.push({
      role: 'user',
      parts: [{ text: message }]
    });

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: contents,
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.3
      }
    });

    const rawResponse = response.text || "";
    const parsedRes = JSON.parse(rawResponse.trim());

    // If AI decided to create a maintenance ticket, write it to database immediately!
    if (parsedRes.create_ticket && parsedRes.ticket_details) {
      const details = parsedRes.ticket_details;
      const newMaintId = `maint-${Date.now()}`;
      const newMaint = {
        id: newMaintId,
        room_id: tenantObj ? tenantObj.room_id : "",
        room_number: roomNum || "Guest/Unknown",
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : "Guest Visitor",
        issue_description: details.description || message,
        category: details.category || "Other",
        priority: details.priority || "Medium",
        status: "pending" as const,
        created_at: new Date().toISOString()
      };

      db.maintenanceRequests = db.maintenanceRequests || [];
      db.maintenanceRequests.push(newMaint);

      // Create admin notification
      const urgencyStr = newMaint.priority === "High" ? "🔴 HIGH PRIORITY" : newMaint.priority === "Medium" ? "🟡 MEDIUM PRIORITY" : "🟢 LOW PRIORITY";
      const newNotif = {
        id: `notif-${Date.now()}`,
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : "Guest Visitor",
        message: `🔧 Maintenance Ticket [${urgencyStr}]: New ${newMaint.category} ticket submitted by Room ${roomNum || "Guest"} - "${newMaint.issue_description.substring(0, 80)}..."`,
        type: "general" as const,
        status: "sent" as const,
        channel: "in_app" as const,
        created_at: new Date().toISOString()
      };
      db.notifications.push(newNotif);
      writeDB(db);

      // Append confirmation details to the bot reply text
      const priorityEmoji = newMaint.priority === "High" ? "🔴" : newMaint.priority === "Medium" ? "🟡" : "🟢";
      parsedRes.reply = `${parsedRes.reply}\n\n* **Ticket ID:** \`${newMaintId}\`\n* **Category:** ${newMaint.category}\n* **Priority:** ${priorityEmoji} ${newMaint.priority}\n* **Status:** ⏳ Pending Admin Review`;
    }

    res.json(parsedRes);

  } catch (error: any) {
    console.error("Gemini API Error, falling back to local processing:", error);
    res.json(generateLocalResponse(message));
  }
});

// Maintenance requests endpoints
app.post("/api/maintenance", (req, res) => {
  const db = readDB();
  const newMaint = {
    id: `maint-${Date.now()}`,
    status: "pending",
    created_at: new Date().toISOString(),
    ...req.body
  };
  db.maintenanceRequests = db.maintenanceRequests || [];
  db.maintenanceRequests.push(newMaint);

  // Notify admin
  const urgencyStr = newMaint.priority === "High" ? "🔴 HIGH PRIORITY" : newMaint.priority === "Medium" ? "🟡 MEDIUM PRIORITY" : "🟢 LOW PRIORITY";
  const descText = String(newMaint.issue_description || newMaint.description || "Maintenance request submitted");
  const newNotif = {
    id: `notif-${Date.now()}`,
    tenant_id: newMaint.tenant_id || "guest",
    tenant_name: newMaint.tenant_name || "Guest",
    message: `🔧 Maintenance Request [${urgencyStr}]: Room ${newMaint.room_number || "Guest"} - ${descText.substring(0, 80)}`,
    type: "general" as const,
    status: "sent" as const,
    channel: "in_app" as const,
    created_at: new Date().toISOString()
  };
  db.notifications.push(newNotif);

  logTransaction(db, {
    category: "maintenance",
    action: "create",
    title: `Maintenance Request [${newMaint.category || 'General'}]`,
    details: `Ticket submitted for Room ${newMaint.room_number || 'N/A'}: "${descText}" (${urgencyStr}).`,
    tenant_id: newMaint.tenant_id,
    tenant_name: newMaint.tenant_name,
    room_number: newMaint.room_number
  });

  writeDB(db);
  res.json(newMaint);
});

app.put("/api/maintenance/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  db.maintenanceRequests = db.maintenanceRequests || [];
  const index = db.maintenanceRequests.findIndex((m: any) => m.id === id);
  if (index !== -1) {
    db.maintenanceRequests[index] = { ...db.maintenanceRequests[index], ...req.body };
    const maint = db.maintenanceRequests[index];

    logTransaction(db, {
      category: "maintenance",
      action: "update",
      title: `Maintenance Request ${maint.status.toUpperCase()}`,
      details: `Updated ticket for Room ${maint.room_number || 'N/A'} (${maint.category}): Status changed to ${maint.status.toUpperCase()}.`,
      tenant_id: maint.tenant_id,
      tenant_name: maint.tenant_name,
      room_number: maint.room_number
    });

    writeDB(db);
    res.json(db.maintenanceRequests[index]);
  } else {
    res.status(404).json({ message: "Maintenance request not found" });
  }
});

// Announcements endpoints
app.post("/api/announcements", (req, res) => {
  const db = readDB();
  const newAnn = {
    id: `ann-${Date.now()}`,
    created_at: new Date().toISOString(),
    ...req.body
  };
  db.announcements = db.announcements || [];
  db.announcements.push(newAnn);

  logTransaction(db, {
    category: "system",
    action: "create",
    title: "Property Announcement Published",
    details: `Published announcement: "${newAnn.title}" - ${newAnn.content?.substring(0, 100)}...`
  });

  writeDB(db);
  res.json(newAnn);
});

app.delete("/api/announcements/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  db.announcements = db.announcements || [];
  const index = db.announcements.findIndex((a: any) => a.id === id);
  if (index !== -1) {
    const deleted = db.announcements.splice(index, 1)[0];
    logTransaction(db, {
      category: "system",
      action: "delete",
      title: "Property Announcement Removed",
      details: `Removed announcement: "${deleted?.title || id}".`
    });
    writeDB(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ message: "Announcement not found" });
  }
});

// Rules endpoints
app.post("/api/rules", (req, res) => {
  const db = readDB();
  const newRule = {
    id: `rule-${Date.now()}`,
    ...req.body
  };
  db.rules = db.rules || [];
  db.rules.push(newRule);

  logTransaction(db, {
    category: "system",
    action: "create",
    title: "Apartment Policy Created",
    details: `Added rule: "${newRule.rule_text}"`
  });

  writeDB(db);
  res.json(newRule);
});

app.delete("/api/rules/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  db.rules = db.rules || [];
  const index = db.rules.findIndex((r: any) => r.id === id);
  if (index !== -1) {
    db.rules.splice(index, 1);
    logTransaction(db, {
      category: "system",
      action: "delete",
      title: "Apartment Policy Deleted",
      details: `Deleted rule ID: ${id}`
    });
    writeDB(db);
    res.json({ success: true });
  } else {
    res.status(404).json({ message: "Rule not found" });
  }
});

// Clear logs endpoint
app.post("/api/logs/clear", (req, res) => {
  const db = readDB();
  db.transactionLogs = [];
  logTransaction(db, {
    category: "system",
    action: "delete",
    title: "Transaction Audit Logs Reset",
    details: "All historical transaction logs were cleared by Property Administration."
  });
  writeDB(db);
  res.json({ success: true });
});



// 9. IMAGE UPLOAD ENDPOINT (Receives Base64, uploads to Firebase Storage or persistent fallback, returns URL)
app.post("/api/upload", async (req, res) => {
  const { name, base64 } = req.body;
  if (!base64 || !name) {
    return res.status(400).json({ error: "Missing base64 data or filename" });
  }

  try {
    const result = await dbService.uploadFile(name, base64);
    res.json({ url: result.url, storage: result.storage });
  } catch (error: any) {
    console.error("Upload error:", error);
    res.status(500).json({ error: "Failed to save file: " + error.message });
  }
});



// 12. FACEBOOK MESSENGER INTEGRATION WEBHOOKS & BOT ENGINE

const standardQuickReplies = [
  { content_type: "text", title: "📋 History", payload: "GET_HISTORY" },
  { content_type: "text", title: "💳 Send Payment", payload: "SEND_PAYMENT" },
  { content_type: "text", title: "💰 Balances", payload: "GET_BALANCE" },
  { content_type: "text", title: "🔧 Maintenance", payload: "REPORT_MAINTENANCE" },
  { content_type: "text", title: "📢 Updates", payload: "VIEW_ANNOUNCEMENTS" },
  { content_type: "text", title: "📜 Rules", payload: "VIEW_RULES" }
];

async function sendFacebookMessage(senderPsid: string, responsePayload: any) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN;
  if (!PAGE_ACCESS_TOKEN) {
    console.warn("FACEBOOK_PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKEN is not configured. Cannot send reply to Messenger user.");
    return;
  }

  // Format message payload and include 1-tap quick action buttons
  let msgObj: any = typeof responsePayload === "string" ? { text: responsePayload } : { ...responsePayload };
  if (!msgObj.quick_replies && msgObj.text && !msgObj.attachment) {
    msgObj.quick_replies = standardQuickReplies;
  }

  const requestBody = {
    recipient: {
      id: senderPsid
    },
    message: msgObj
  };

  try {
    const res = await fetch(`https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify(requestBody)
    });

    if (!res.ok) {
      const errorJson = await res.json() as any;
      console.error("Facebook Graph API Error response:", errorJson);
    } else {
      console.log(`Successfully sent message to Facebook Messenger user: ${senderPsid}`);
    }
  } catch (error) {
    console.error("Error calling Facebook Graph API:", error);
  }
}

async function sendMessengerTestReply(senderPsid: string, replyText: string) {
  const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  if (!PAGE_ACCESS_TOKEN) {
    console.error("===== MESSENGER WEBHOOK ERROR =====");
    console.error("Neither PAGE_ACCESS_TOKEN nor FACEBOOK_PAGE_ACCESS_TOKEN is configured in environment variables.");
    return;
  }

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
  const url = `https://graph.facebook.com/${graphVersion}/me/messages`;

  const requestBody = {
    recipient: { id: senderPsid },
    message: { text: replyText }
  };

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAGE_ACCESS_TOKEN}`
      },
      body: JSON.stringify(requestBody)
    });

    const resText = await res.text();
    let resData: any;
    try {
      resData = JSON.parse(resText);
    } catch {
      resData = resText;
    }

    if (!res.ok) {
      console.error("===== FACEBOOK SEND RESPONSE =====");
      console.error(`Status: ${res.status} ${res.statusText}`);
      console.error(typeof resData === "object" ? JSON.stringify(resData, null, 2) : resData);
      console.error("===== MESSENGER WEBHOOK ERROR =====");
      console.error(resData?.error?.message || "Failed to send message via Facebook Graph API");
    } else {
      console.log("===== FACEBOOK SEND RESPONSE =====");
      console.log(typeof resData === "object" ? JSON.stringify(resData, null, 2) : resData);
    }
  } catch (error: any) {
    console.error("===== MESSENGER WEBHOOK ERROR =====");
    console.error(error?.message || String(error));
  }
}

async function processChatbotMessage(messageText: string, tenantId: string | null, senderPsid: string): Promise<string> {
  const db = readDB();
  const announcementsList = db.announcements || [];
  const rulesList = db.rules || [];

  // Gather tenant context if logged in
  let tenantContext = "The user is browsing as a Guest. No specific tenant details are logged in.";
  let tenantObj: any = null;
  let outstandingBalance = 0;
  let nextDueDate = "No active dues";
  let nextDueMonth = "";
  let roomNum = "N/A";
  let aptName = "ApartmentPro Complex";

  if (tenantId) {
    tenantObj = db.tenants.find((t: any) => t.id === tenantId);
    if (tenantObj) {
      const room = db.rooms.find((r: any) => r.id === tenantObj.room_id);
      roomNum = room ? room.room_number : "N/A";
      const apt = db.apartments.find((a: any) => a.id === tenantObj.apartment_id);
      aptName = apt ? apt.name : "ApartmentPro Complex";
      
      const tenantBills = db.billingRecords.filter((b: any) => b.tenant_id === tenantId);
      const unpaidBills = tenantBills.filter((b: any) => b.payment_status === "unpaid" || b.payment_status === "overdue");
      outstandingBalance = unpaidBills.reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0);
      
      if (unpaidBills.length > 0) {
        const sortedBills = [...unpaidBills].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        nextDueDate = sortedBills[0].due_date;
        nextDueMonth = sortedBills[0].billing_month || "";
      }

      tenantContext = `The user is logged in as a tenant via Facebook Messenger.
Tenant Profile:
- Name: ${tenantObj.name}
- Room Number: ${roomNum} (${aptName})
- Contact Number: ${tenantObj.contact}
- Monthly Rent Amount: ₱${Number(tenantObj.rent_amount || 0).toLocaleString('en-US')}
- Outstanding Rent & Utility Balance: ₱${Number(outstandingBalance).toLocaleString('en-US')}
- Security Deposit Active Balance: ₱${Number(tenantObj.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj.deposit || 0).toLocaleString('en-US')}
- Advance Rent Active Balance: ₱${Number(tenantObj.advance_balance !== undefined ? tenantObj.advance_balance : tenantObj.advance_payment || 0).toLocaleString('en-US')}
- Next Rent Due Date: ${nextDueDate} ${nextDueMonth ? `(${nextDueMonth})` : ''}
- Contract Status: ${tenantObj.status === 'active' ? 'Active Lease Agreement' : tenantObj.status}`;
    }
  }

  // Core Messenger Flow & Local Response Engine
  const generateLocalResponse = (msg: string) => {
    const text = msg.toLowerCase().trim();

    // BUTTON 1 — TRANSACTION HISTORY
    if (text === "get_history" || text === "history" || text.includes("transaction history") || text.includes("my transactions") || text.includes("ledger history") || text.includes("payment history")) {
      if (!tenantObj) {
        return `🔒 *ACCOUNT VERIFICATION REQUIRED*\n\nTo protect your financial privacy, transaction histories are strictly confidential.\n\n👉 To view your personal records, please link your tenant account:\nType: *link <contact_number>*\nExample: *link 09171234567*`;
      }

      const tenantLedgers = (db.depositLedger || []).filter((l: any) => l.tenant_id === tenantObj.id);
      const tenantBills = (db.billingRecords || []).filter((b: any) => b.tenant_id === tenantObj.id);
      const tenantLogs = (db.transactionLogs || []).filter((log: any) => log.tenant_id === tenantObj.id);

      let historyText = `📋 *TRANSACTION & LEDGER HISTORY*\n` +
        `👤 *Tenant:* ${tenantObj.name} (Room ${roomNum})\n` +
        `🏢 *Building:* ${aptName}\n` +
        `-----------------------------------\n\n`;

      if (tenantLedgers.length === 0 && tenantBills.length === 0 && tenantLogs.length === 0) {
        historyText += `No transactions have been recorded yet for your account.`;
      } else {
        // Section A: Security Deposit & Advance Rent Transactions
        historyText += `🛡️ *DEPOSIT & ADVANCE ESCROW LEDGER:*\n`;
        if (tenantLedgers.length === 0) {
          historyText += `_No escrow adjustments recorded._\n\n`;
        } else {
          const recentLedgers = [...tenantLedgers].reverse().slice(0, 5);
          recentLedgers.forEach((l: any) => {
            const dateStr = new Date(l.created_at || Date.now()).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
            const typeLabel = l.type ? l.type.replace(/_/g, ' ').toUpperCase() : 'TRANSACTION';
            historyText += `• *${dateStr}* — ${typeLabel}\n  💵 ₱${Number(l.amount || 0).toLocaleString('en-US', { minimumFractionDigits: 2 })}${l.description ? ` (${l.description})` : ''}\n`;
          });
          historyText += `\n`;
        }

        // Section B: Monthly Statements & Invoices
        historyText += `📄 *MONTHLY BILLING INVOICES:*\n`;
        if (tenantBills.length === 0) {
          historyText += `_No billing statements generated yet._\n\n`;
        } else {
          const recentBills = [...tenantBills].reverse().slice(0, 5);
          recentBills.forEach((b: any) => {
            const statusEmoji = b.payment_status === 'paid' ? '✅ PAID' : b.payment_status === 'overdue' ? '⚠️ OVERDUE' : '⏳ UNPAID';
            historyText += `• *${b.billing_month || 'Statement'}* [${statusEmoji}]\n  Total: ₱${Number(b.total_amount || 0).toLocaleString('en-US')} (Due: ${b.due_date})\n`;
          });
          historyText += `\n`;
        }

        // Section C: Current Running Balances
        const curDep = tenantObj.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj.deposit || 0;
        const curAdv = tenantObj.advance_balance !== undefined ? tenantObj.advance_balance : (tenantObj.advance_payment || tenantObj.rent_amount || 0);
        historyText += `-----------------------------------\n` +
          `💰 *ACTIVE BALANCES:*\n` +
          `• Outstanding Dues: ₱${Number(outstandingBalance).toLocaleString('en-US')}\n` +
          `• Security Deposit Balance: ₱${Number(curDep).toLocaleString('en-US')}\n` +
          `• Advance Rent Balance: ₱${Number(curAdv).toLocaleString('en-US')}`;
      }

      return historyText;
    }

    // BUTTON 2 — SEND PAYMENT
    if (text === "send_payment" || text === "pay" || text.includes("how to pay") || text.includes("payment method") || text.includes("pay rent") || text.includes("bank account") || text.includes("gcash") || text.includes("maya")) {
      let payMsg = `💳 *HOW TO SEND YOUR RENT PAYMENT*\n\n`;
      
      if (tenantObj) {
        payMsg += `👤 *Tenant:* ${tenantObj.name} (Room ${roomNum})\n` +
          `💵 *Current Amount Due:* ₱${Number(outstandingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
          `📅 *Due Date:* ${nextDueDate} ${nextDueMonth ? `(${nextDueMonth})` : ''}\n\n`;
      }

      payMsg += `Please settle your payments through any of our official channels:\n\n` +
        `📱 *GCash / Maya (Instant)*\n` +
        `• Account Name: ApartmentPro Property Management\n` +
        `• Mobile Number: 0917-888-9999\n\n` +
        `🏦 *Bank Transfer / Online Banking*\n` +
        `• Bank: BDO Unibank (Current Account)\n` +
        `• Account Name: ApartmentPro Estates Inc.\n` +
        `• Account Number: 0012-3456-7890\n\n` +
        `• Bank: BPI (Bank of the Philippine Islands)\n` +
        `• Account Name: ApartmentPro Estates Inc.\n` +
        `• Account Number: 0987-6543-2100\n\n` +
        `-----------------------------------\n` +
        `📸 *PAYMENT CONFIRMATION INSTRUCTIONS:*\n` +
        `After completing your transfer, simply reply here with your reference details:\n` +
        `👉 Type: *paid <amount> ref <reference_number>*\n` +
        `Example: *paid 13450 ref 987654321*\n\n` +
        `Our administration will immediately verify and update your official ledger!`;

      return payMsg;
    }

    // Tenant submitting payment reference
    if (text.startsWith("paid ") || (text.includes("ref") && (text.includes("gcash") || text.includes("bdo") || text.includes("bpi") || text.includes("transfer") || text.includes("payment")))) {
      const senderName = tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 6)})`;
      const senderRoom = tenantObj ? `Room ${roomNum}` : "Unlinked Room";

      // Log in transaction logs
      logTransaction(db, {
        category: "payment",
        action: "create",
        title: `Payment Reference Submitted via Messenger`,
        details: `Tenant ${senderName} (${senderRoom}) submitted payment reference: "${msg}". Awaiting admin verification and invoice clearing.`,
        tenant_id: tenantObj?.id || "guest",
        tenant_name: senderName,
        room_number: roomNum
      });

      // Urgent Admin In-App Notification
      db.notifications.push({
        id: `notif-pay-${Date.now()}`,
        tenant_id: tenantObj?.id || "guest",
        tenant_name: senderName,
        message: `💳 Payment Reference Received via Messenger from ${senderName} (${senderRoom}): "${msg}". Please verify bank/GCash deposit.`,
        type: "general" as const,
        status: "sent" as const,
        channel: "in_app" as const,
        created_at: new Date().toISOString()
      });
      writeDB(db);

      return `✅ *PAYMENT REFERENCE SUBMITTED!*\n\n` +
        `Thank you, *${senderName}*! We have successfully registered your payment submission:\n` +
        `📝 Reference Details: "${msg}"\n\n` +
        `Our property management team has been notified. Once verified against our bank records, your statement status will automatically update to PAID.`;
    }

    // BUTTON 3 — BALANCE / DEPOSIT / ADVANCE
    if (text === "get_balance" || text === "balance" || text.includes("my balance") || text.includes("deposit balance") || text.includes("advance balance") || text.includes("how much") || text.includes("rent due") || text.includes("statement")) {
      if (!tenantObj) {
        return `🔒 *ACCOUNT VERIFICATION REQUIRED*\n\nTo view your live balances, deposit ledger, and due date, please link your tenant account:\n\n👉 Type: *link <contact_number>*\nExample: *link 09171234567*`;
      }

      const depBal = tenantObj.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj.deposit || 0;
      const advBal = tenantObj.advance_balance !== undefined ? tenantObj.advance_balance : (tenantObj.advance_payment || tenantObj.rent_amount || 0);

      return `💰 *LIVE FINANCIAL & ESCROW SUMMARY*\n` +
        `🏢 *${aptName}* — Room ${roomNum}\n` +
        `👤 *Tenant:* ${tenantObj.name}\n` +
        `-----------------------------------\n\n` +
        `💵 *CURRENT OUTSTANDING DUES:* ₱${Number(outstandingBalance).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
        `📅 *Next Due Date:* ${nextDueDate} ${nextDueMonth ? `(${nextDueMonth})` : ''}\n` +
        `🏠 *Monthly Rent Rate:* ₱${Number(tenantObj.rent_amount || 0).toLocaleString('en-US')}/month\n\n` +
        `-----------------------------------\n` +
        `🛡️ *SECURITY DEPOSIT BALANCE:*\n` +
        `₱${Number(depBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
        `_(Refundable escrow held against damages/unpaid utilities upon checkout)_\n\n` +
        `💳 *ADVANCE RENT BALANCE:*\n` +
        `₱${Number(advBal).toLocaleString('en-US', { minimumFractionDigits: 2 })}\n` +
        `_(Prepaid rent available to apply towards future billing or final month stay)_\n\n` +
        `👉 To send payment, tap *💳 Send Payment* or type *pay*.`;
    }

    // Rules & Policies
    if (text === "view_rules" || text.includes("rule") || text.includes("policy") || text.includes("policies") || text.includes("overnight") || text.includes("pet") || text.includes("noise") || text.includes("smoking")) {
      const rulesStr = rulesList.map((r: any, idx: number) => `${idx + 1}. *[${r.category || 'General'}]* ${r.rule_text}`).join("\n\n");
      return `🏢 *ABC APARTMENT COMPLEX RULES & REGULATIONS:*\n\n${rulesStr || "No specific rules logged at this time."}`;
    }

    // Announcements
    if (text === "view_announcements" || text.includes("announcement") || text.includes("news") || text.includes("update") || text.includes("schedule")) {
      const annStr = announcementsList.map((a: any) => `📢 *${a.title}*\n${a.content}\n_(Posted: ${new Date(a.created_at).toLocaleDateString()})_`).join("\n\n---\n\n");
      return `📢 *LATEST PROPERTY ANNOUNCEMENTS:*\n\n${annStr || "No new announcements posted."}`;
    }

    // Tenant Profile
    if (text.includes("profile") || text.includes("my account") || text.includes("who am i")) {
      if (tenantObj) {
        return `👤 *TENANT PROFILE:*\n- *Name:* ${tenantObj.name}\n- *Unit:* Room ${roomNum} (${aptName})\n- *Contact:* ${tenantObj.contact}\n- *Email:* ${tenantObj.email || 'N/A'}\n- *Monthly Rent:* ₱${Number(tenantObj.rent_amount || 0).toLocaleString('en-US')}\n- *Status:* ${tenantObj.status.toUpperCase()}`;
      } else {
        return "You are currently chatting as a Guest. To link your tenant profile, type:\n👉 link <your_contact_number>";
      }
    }

    // Maintenance request keyword detection
    const categories = ["plumbing", "electrical", "internet", "aircon", "air conditioning", "furniture", "cleaning", "leak", "water", "light", "faucet", "clogged", "broken", "wifi", "maintenance", "repair"];
    const containsMaintKeyword = text === "report_maintenance" || categories.some(cat => text.includes(cat));
    
    if (containsMaintKeyword) {
      let category: any = "Other";
      let priority: 'High' | 'Medium' | 'Low' = "Medium";
      let description = msg;

      if (text.includes("leak") || text.includes("water") || text.includes("plumbing") || text.includes("faucet") || text.includes("toilet") || text.includes("sink")) {
        category = "Plumbing";
        if (text.includes("no water") || text.includes("burst") || text.includes("flooding") || text.includes("flood")) priority = "High";
      } else if (text.includes("electricity") || text.includes("light") || text.includes("wire") || text.includes("spark") || text.includes("power") || text.includes("outlet") || text.includes("electrical")) {
        category = "Electrical";
        if (text.includes("no power") || text.includes("spark") || text.includes("burning") || text.includes("short circuit")) priority = "High";
      } else if (text.includes("internet") || text.includes("wifi") || text.includes("router") || text.includes("connection")) {
        category = "Internet";
        priority = "Low";
      } else if (text.includes("aircon") || text.includes("air conditioning") || text.includes("cooling") || text.includes("ac")) {
        category = "Air Conditioning";
        priority = "Medium";
      }

      const newMaintId = `maint-${Date.now()}`;
      const newMaint = {
        id: newMaintId,
        room_id: tenantObj ? tenantObj.room_id : "",
        room_number: roomNum || "Guest/Unknown",
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`,
        issue_description: description,
        category,
        priority,
        status: "pending" as const,
        created_at: new Date().toISOString()
      };
      
      db.maintenanceRequests = db.maintenanceRequests || [];
      db.maintenanceRequests.push(newMaint);

      const urgencyStr = priority === "High" ? "🔴 HIGH PRIORITY" : priority === "Medium" ? "🟡 MEDIUM PRIORITY" : "🟢 LOW PRIORITY";
      const newNotif = {
        id: `notif-${Date.now()}`,
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`,
        message: `🔧 Maintenance Ticket [${urgencyStr}]: New ${category} ticket submitted via Facebook Messenger by Room ${roomNum || "Guest"} - "${description.substring(0, 80)}..."`,
        type: "general" as const,
        status: "sent" as const,
        channel: "in_app" as const,
        created_at: new Date().toISOString()
      };
      db.notifications.push(newNotif);
      writeDB(db);

      const priorityEmoji = priority === "High" ? "🔴" : priority === "Medium" ? "🟡" : "🟢";
      return `🔧 *MAINTENANCE TICKET FILED SUCCESSFULLY!*\n\nI have automatically logged your issue in our maintenance database:\n- *Ticket ID:* \`${newMaintId}\`\n- *Category:* ${category}\n- *Priority:* ${priorityEmoji} ${priority}\n- *Unit:* Room ${roomNum || 'Guest'}\n- *Status:* ⏳ Pending Admin Review\n\nOur maintenance staff has been dispatched an urgent alert.`;
    }

    return `👋 Hello! I am the **ABC Apartment Assistant**.\n\nHow can I help you today? Tap any of the quick action buttons below:\n\n• 📋 *Transaction History* — View ledger & receipts\n• 💳 *Send Payment* — Payment channels & instructions\n• 💰 *Balance / Deposit / Advance* — Live account summary\n• 🔧 *Report Maintenance* — Log a repair ticket\n• 📢 *Announcements* — Building news & advisories\n• 📜 *Apartment Rules* — Policies & guidelines\n\n👉 If you haven't linked your account, type: *link <your_contact_number>* (e.g. *link 09171234567*)`;
  };

  const ai = getAIClient();
  if (!ai) {
    return generateLocalResponse(messageText);
  }

  try {
    const rulesSummary = rulesList.map((r: any, i: number) => `- Rule: ${r.rule_text}`).join("\n");
    const annSummary = announcementsList.map((a: any) => `- [${a.title}]: ${a.content} (Posted: ${a.created_at})`).join("\n");

    const systemPrompt = `You are "ABC Apartment Assistant", a highly polished, helpful, and professional virtual property assistant for the ABC Apartment complex.
Your job is to assist tenants and guests via Facebook Messenger. You are fully integrated with the property database.

Current Context:
${tenantContext}

Apartment Policies/Rules:
${rulesSummary || "No rules registered."}

Active Announcements:
${annSummary || "No announcements registered."}

INSTRUCTIONS:
1. If the user clicked or requested one of the three main options:
   - "Transaction History": Provide their complete, confidential ledger and payment history from the context.
   - "Send Payment": Provide the official payment accounts and step-by-step instructions.
   - "Balance / Deposit / Advance": Provide their exact live balance breakdown (unpaid bills, due date, deposit balance, advance balance).
2. If the user is describing a physical or maintenance problem (e.g. leaking faucet, broken lights, no water, broken AC):
   - You MUST set "create_ticket" to true.
   - Select a "category" from: "Plumbing", "Electrical", "Internet", "Air Conditioning", "Furniture", "Cleaning", "Other".
   - Select a "priority" from: "High" (urgent matters like no water, burning smell, total blackout, severe flooding), "Medium" (faucet leaks, broken AC unit noise, appliance malfunctioning), "Low" (broken desk chair, lightbulb burnt, minor cleanup).
3. Format your response cleanly using emojis and bold headers (*text*). Do not output HTML tags.
4. You MUST return ONLY a JSON response matching this schema:
{
  "reply": "Conversational reply text, formatted in clean text with emojis",
  "intent": "get_history | send_payment | get_balance | report_maintenance | view_announcements | view_rules | view_profile | chat",
  "create_ticket": true or false,
  "ticket_details": {
    "category": "Plumbing | Electrical | Internet | Air Conditioning | Furniture | Cleaning | Other",
    "priority": "High | Medium | Low",
    "description": "Brief summary of the issue reported"
  }
}
Note: ticket_details is required only if create_ticket is true.`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: 'user', parts: [{ text: messageText }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.3
      }
    });

    const parsedRes = JSON.parse((response.text || "").trim());

    if (parsedRes.create_ticket && parsedRes.ticket_details) {
      const details = parsedRes.ticket_details;
      const newMaintId = `maint-${Date.now()}`;
      const newMaint = {
        id: newMaintId,
        room_id: tenantObj ? tenantObj.room_id : "",
        room_number: roomNum || "Guest/Unknown",
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`,
        issue_description: details.description || messageText,
        category: details.category || "Other",
        priority: details.priority || "Medium",
        status: "pending" as const,
        created_at: new Date().toISOString()
      };

      db.maintenanceRequests = db.maintenanceRequests || [];
      db.maintenanceRequests.push(newMaint);

      const urgencyStr = newMaint.priority === "High" ? "🔴 HIGH PRIORITY" : newMaint.priority === "Medium" ? "🟡 MEDIUM PRIORITY" : "🟢 LOW PRIORITY";
      const newNotif = {
        id: `notif-${Date.now()}`,
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`,
        message: `🔧 Maintenance Ticket [${urgencyStr}]: New ${newMaint.category} ticket submitted via Facebook Messenger by Room ${roomNum || "Guest"} - "${newMaint.issue_description.substring(0, 80)}..."`,
        type: "general" as const,
        status: "sent" as const,
        channel: "in_app" as const,
        created_at: new Date().toISOString()
      };
      db.notifications.push(newNotif);
      writeDB(db);

      const priorityEmoji = newMaint.priority === "High" ? "🔴" : newMaint.priority === "Medium" ? "🟡" : "🟢";
      return `${parsedRes.reply}\n\n🔧 *Maintenance Request Filed!*\n- *Ticket ID:* \`${newMaintId}\`\n- *Category:* ${newMaint.category}\n- *Priority:* ${priorityEmoji} ${newMaint.priority}\n- *Status:* ⏳ Pending Admin Review`;
    }

    return parsedRes.reply;
  } catch (error) {
    console.error("Error with Gemini for Messenger user, falling back to rule processing:", error);
    const localRes = generateLocalResponse(messageText);
    return typeof localRes === "string" ? localRes : (localRes as any).reply;
  }
}

// FB WEBHOOK VERIFICATION (GET) - Supports both /api/webhook/facebook and /webhook/facebook
app.get(["/api/webhook/facebook", "/webhook/facebook"], (req, res) => {
  const rawVerifyToken = process.env.FACEBOOK_VERIFY_TOKEN || "abc_apartment_verify_token";
  const VERIFY_TOKEN = rawVerifyToken.trim();
  const fallbackToken = "abc_apartment_verify_token";

  // Support both flat query keys (hub.mode) and nested objects parsed by query parser (hub: { mode })
  const mode = req.query["hub.mode"] || (req.query["hub"] as any)?.mode;
  const token = req.query["hub.verify_token"] || (req.query["hub"] as any)?.verify_token;
  const challenge = req.query["hub.challenge"] || (req.query["hub"] as any)?.challenge;

  console.log("=== FACEBOOK WEBHOOK VERIFICATION REQUEST ===");
  console.log("Received Query Params:", req.query);
  console.log("Parsed Verification fields:", { mode, token, challenge });
  console.log("Configured Verify Token (trimmed):", `"${VERIFY_TOKEN}"`);

  if (mode && token) {
    const receivedToken = String(token).trim();
    const isMatch = (receivedToken === VERIFY_TOKEN) || (receivedToken === fallbackToken);

    if (mode === "subscribe" && isMatch) {
      console.log("✅ FACEBOOK_WEBHOOK_VERIFIED SUCCESSFULLY. Challenge returned:", challenge);
      res.set("Content-Type", "text/plain");
      return res.status(200).send(String(challenge));
    } else {
      console.warn("❌ FACEBOOK_WEBHOOK_VERIFICATION FAILED: Match mismatch!");
      console.warn(`Expected: "${VERIFY_TOKEN}" or "${fallbackToken}", Received: "${receivedToken}", Mode: "${mode}"`);
      return res.status(403).send("Verification token mismatch");
    }
  }
  console.warn("❌ FACEBOOK_WEBHOOK_VERIFICATION FAILED: Missing mode or token query params.");
  return res.status(400).send("Missing hub.mode or hub.verify_token query parameter");
});

// FB MESSENGER EVENTS HANDLER (POST - Supports Messages, Quick Replies & Postbacks)
app.post(["/api/webhook/facebook", "/webhook/facebook"], async (req, res) => {
  const body = req.body;

  console.log("===== FACEBOOK WEBHOOK RAW BODY =====");
  console.log(typeof body === "object" ? JSON.stringify(body, null, 2) : body);

  if (body.object === "page") {
    for (const entry of body.entry || []) {
      for (const webhook_event of entry.messaging || []) {
        const senderPsid = webhook_event.sender?.id;
        if (!senderPsid) continue;

        // Extract message text or button payload
        let messageText = "";
        if (webhook_event.message?.text) {
          messageText = webhook_event.message.text;
        } else if (webhook_event.message?.quick_reply?.payload) {
          messageText = webhook_event.message.quick_reply.payload;
        } else if (webhook_event.postback?.payload) {
          messageText = webhook_event.postback.payload;
        } else if (webhook_event.message?.attachments) {
          messageText = "[Attachment/Media]";
        }

        console.log("===== MESSENGER MESSAGE RECEIVED =====");
        console.log(`Sender ID: ${senderPsid}`);
        console.log(`Message: ${messageText}`);

        // =========================================================================
        // TEMPORARY WEBHOOK CONNECTIVITY TEST
        // Sends fixed reply: "✅ Messenger webhook is working!"
        // =========================================================================
        await sendMessengerTestReply(senderPsid, "✅ Messenger webhook is working!");

        /* =========================================================================
         * [PRESERVED ORIGINAL CHATBOT / LINKAGE LOGIC - READY FOR RESTORATION]
         * =========================================================================
         *
         * // Check DB for linkage
         * const db = readDB();
         * db.tenants = db.tenants || [];
         * let linkedTenant = db.tenants.find((t: any) => t.facebook_psid === senderPsid || t.messenger_psid === senderPsid);
         * const textLower = messageText.toLowerCase().trim();
         *
         * // 1. Account linking workflow: "link <query>"
         * if (textLower.startsWith("link ") || textLower.startsWith("verify ")) {
         *   const query = textLower.replace(/^(link|verify)\s+/, "").trim();
         *   const matchedTenant = db.tenants.find((t: any) => 
         *     (t.contact && t.contact.trim().replace(/\D/g, "") === query.replace(/\D/g, "")) ||
         *     (t.id && t.id.toLowerCase() === query) ||
         *     (t.name && t.name.toLowerCase().includes(query))
         *   );
         *   if (matchedTenant) {
         *     matchedTenant.facebook_psid = senderPsid;
         *     matchedTenant.messenger_psid = senderPsid;
         *     writeDB(db);
         *     const room = db.rooms.find((r: any) => r.id === matchedTenant.room_id);
         *     const roomNum = room ? room.room_number : "Unknown";
         *     await sendFacebookMessage(senderPsid, {
         *       text: `🎉 *Account Linked Successfully!*\n\nWelcome back, *${matchedTenant.name}* (Room ${roomNum}). Your Messenger is now connected to your tenant portal.\n\nYou can now use the 1-tap buttons below to check your live balance, view your deposit ledger, or report maintenance.`
         *     });
         *   } else {
         *     await sendFacebookMessage(senderPsid, {
         *       text: `❌ Sorry, we couldn't locate a tenant record matching "${query}" in our directory.\n\nPlease type: *link <your_contact_number>*\nExample: *link 09171234567*`
         *     });
         *   }
         *   continue;
         * }
         *
         * // 2. Account unlinking workflow: "unlink"
         * if (textLower === "unlink" || textLower === "disconnect") {
         *   if (linkedTenant) {
         *     const oldName = linkedTenant.name;
         *     delete linkedTenant.facebook_psid;
         *     writeDB(db);
         *     await sendFacebookMessage(senderPsid, {
         *       text: `🚪 You have successfully unlinked your Facebook profile from ${oldName}'s tenant record.`
         *     });
         *   } else {
         *     await sendFacebookMessage(senderPsid, {
         *       text: "No tenant account is currently linked to this Facebook Profile."
         *     });
         *   }
         *   continue;
         * }
         *
         * // 3. Process chatbot message through the integrated engine
         * try {
         *   const botReply = await processChatbotMessage(messageText, linkedTenant ? linkedTenant.id : null, senderPsid);
         *   await sendFacebookMessage(senderPsid, { text: botReply });
         * } catch (err) {
         *   console.error("Failed to process chatbot reply:", err);
         *   await sendFacebookMessage(senderPsid, {
         *     text: "Sorry, I encountered an internal error processing your request. Please try again shortly."
         *   });
         * }
         * ========================================================================= */
      }
    }

    // Return 200 OK to Meta to confirm delivery succeeded
    return res.status(200).send("EVENT_RECEIVED");
  } else {
    res.sendStatus(404);
  }
});



// 11. Vite & static asset serving configuration (only loaded for standalone dev/prod runtime)
async function setupServer() {
  if (process.env.NODE_ENV !== "production") {
    console.log("Starting server in DEVELOPMENT mode with Vite middleware...");
    const { createServer: createViteServer } = await import("vite");
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    console.log("Starting server in PRODUCTION mode...");
    const distPath = path.join(process.cwd(), "dist");
    app.use(express.static(distPath));
    app.get("*", (req, res) => {
      res.sendFile(path.join(distPath, "index.html"));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`ApartmentPro backend server is actively listening on http://0.0.0.0:${PORT}`);
  });
}

// Only launch standalone listener in continuous runtime environments (e.g., local dev or Cloud Run container)
// Never launch in Vercel or serverless/lambda environment
const isServerlessRuntime = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
if (!isServerlessRuntime) {
  setupServer();
}

export default app;
export { app };
