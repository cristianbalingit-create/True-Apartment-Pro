import express from "express";
import path from "path";
import fs from "fs";
import os from "os";
import crypto from "crypto";
import { GoogleGenAI, Type } from "@google/genai";
import dotenv from "dotenv";
import { dbService } from "./src/server/dbService";
import { handleMessengerWebhookEvent, queryChatbotWithResult, sendFacebookMessage } from "./src/server/chatbotService";
import { generateBillPng, generateBillSvg, sendVisualBillToMessenger, getPublicBaseUrl } from "./src/server/visualBillService";

dotenv.config();

const app = express();
const PORT = 3000;

// High limits for handling large base64 image uploads
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// Official Facebook Page for ApartmentPro
const OFFICIAL_PAGE_ID = (process.env.FACEBOOK_PAGE_ID || process.env.PAGE_ID || "3246715018859879").trim();
const OFFICIAL_PAGE_NAME = "ApartmentPro";
const RETIRED_OLD_PAGE_ID = "1049465111594454";
const RETIRED_OLD_PAGE_NAME = "FullReddit";

// Safe Diagnostic (Zero secrets exposed)
async function runSafeTokenDiagnostic(webhookPageId?: string): Promise<{
  isPageToken: boolean;
  tokenPageId: string | null;
  tokenPageName: string | null;
  expectedPageId: string;
  expectedPageName: string;
  isOfficialPage: boolean;
  isOldRetiredPage: boolean;
  webhookPageId?: string;
  match?: boolean;
}> {
  const token = (process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  if (!token) {
    console.error("===== FACEBOOK TOKEN IDENTITY =====");
    console.error("Token configured: NO (Neither PAGE_ACCESS_TOKEN nor FACEBOOK_PAGE_ACCESS_TOKEN found)");
    return {
      isPageToken: false,
      tokenPageId: null,
      tokenPageName: null,
      expectedPageId: OFFICIAL_PAGE_ID,
      expectedPageName: OFFICIAL_PAGE_NAME,
      isOfficialPage: false,
      isOldRetiredPage: false
    };
  }

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
  let tokenPageId: string | null = null;
  let tokenPageName: string | null = null;
  let isPageToken = false;

  // 1. Check if token is a Page Access Token via /me?fields=id,name
  try {
    const meRes = await fetch(`https://graph.facebook.com/${graphVersion}/me?fields=id,name`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    const meData = await meRes.json();
    if (meRes.ok && meData.id) {
      tokenPageId = String(meData.id);
      tokenPageName = meData.name || null;
      isPageToken = true;
    }
  } catch {}

  // 2. If /me requires pages_read_engagement, extract identity from /me/conversations
  if (!tokenPageId) {
    try {
      const convRes = await fetch(`https://graph.facebook.com/${graphVersion}/me/conversations?fields=link,senders,participants&limit=1`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      const convData = await convRes.json();
      if (convRes.ok && convData.data && convData.data.length > 0) {
        isPageToken = true;
        const conv = convData.data[0];
        const linkMatch = conv.link?.match(/^\/(\d+)\//);
        if (linkMatch) {
          tokenPageId = linkMatch[1];
        }
        const senders = conv.senders?.data || [];
        const pageSender = senders.find((s: any) => s.id === tokenPageId || s.email?.startsWith(tokenPageId + "@"));
        if (pageSender) {
          tokenPageName = pageSender.name;
        }
      }
    } catch {}
  }

  // 3. Fallback check on /me/messenger_profile to verify token validity on a Page
  if (!isPageToken) {
    try {
      const profRes = await fetch(`https://graph.facebook.com/${graphVersion}/me/messenger_profile?fields=get_started`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (profRes.ok) {
        isPageToken = true;
      }
    } catch {}
  }

  const matches = Boolean(tokenPageId && webhookPageId && tokenPageId === webhookPageId);
  const isOfficialPage = Boolean(tokenPageId && tokenPageId === OFFICIAL_PAGE_ID);
  const isOldRetiredPage = Boolean(tokenPageId && tokenPageId === RETIRED_OLD_PAGE_ID);

  console.log("===== FACEBOOK TOKEN IDENTITY =====");
  console.log(`Target Official Page: ${OFFICIAL_PAGE_NAME} (ID: ${OFFICIAL_PAGE_ID})`);
  console.log(`Token Type: ${isPageToken ? "Page Access Token" : "Unknown / User Access Token"}`);
  console.log(`Configured Token Page ID: ${tokenPageId || "Could not resolve"}`);
  console.log(`Configured Token Page Name: ${tokenPageName || "Could not resolve"}`);

  if (isOldRetiredPage) {
    console.warn(`🚨 CRITICAL CONFIGURATION MISMATCH: The current token belongs to the OLD RETIRED Facebook Page "${RETIRED_OLD_PAGE_NAME}" (ID: ${RETIRED_OLD_PAGE_ID}). You must generate a Page Access Token for NEW Page "${OFFICIAL_PAGE_NAME}" (ID: ${OFFICIAL_PAGE_ID}) and update FACEBOOK_PAGE_ACCESS_TOKEN in Vercel.`);
  } else if (isOfficialPage) {
    console.log(`✅ Token matches official Facebook Page "${OFFICIAL_PAGE_NAME}" (ID: ${OFFICIAL_PAGE_ID}).`);
  }

  if (webhookPageId) {
    console.log(`Incoming Webhook Event Page ID: ${webhookPageId}`);
    if (webhookPageId === RETIRED_OLD_PAGE_ID) {
      console.warn(`⚠️ WEBHOOK FROM OLD PAGE: This event was sent from the retired page "${RETIRED_OLD_PAGE_NAME}" (${RETIRED_OLD_PAGE_ID}). Update Meta App Webhook subscription to send events from "${OFFICIAL_PAGE_NAME}" (${OFFICIAL_PAGE_ID}).`);
    } else if (webhookPageId === OFFICIAL_PAGE_ID) {
      console.log(`✅ Webhook event verified from official "${OFFICIAL_PAGE_NAME}" Page.`);
    }

    console.log(`Page IDs Match: ${matches ? "YES (IDs MATCH)" : "NO (MISMATCH DETECTED)"}`);
    if (!matches && tokenPageId) {
      console.warn(`⚠️ TOKEN PAGE MISMATCH: The configured token belongs to Page ID ${tokenPageId} ("${tokenPageName || "Unknown"}"), but this webhook was received by Facebook Page ID ${webhookPageId}. A Page Access Token cannot reply to users of a different Facebook Page.`);
    }
  }

  return {
    isPageToken,
    tokenPageId,
    tokenPageName,
    expectedPageId: OFFICIAL_PAGE_ID,
    expectedPageName: OFFICIAL_PAGE_NAME,
    isOfficialPage,
    isOldRetiredPage,
    webhookPageId,
    match: matches
  };
}

// =========================================================================
// 1. FAST-PATH FACEBOOK WEBHOOK VERIFICATION (GET)
// Must be registered before filesystem, Firebase or database operations
// =========================================================================
app.get(["/api/webhook/facebook", "/webhook/facebook"], async (req, res) => {
  if (req.query.diagnostic === "1") {
    const diag = await runSafeTokenDiagnostic();
    return res.status(200).json(diag);
  }

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

// Dynamic Visual Bill Image endpoints (Serving high-contrast, professional receipt image)
app.get("/api/billing/:id/image.png", (req, res) => {
  const db = readDB();
  const bill = db.billingRecords?.find((b: any) => b.id === req.params.id);
  if (!bill) {
    return res.status(404).send("Billing record not found");
  }
  try {
    const pngBuffer = generateBillPng(bill);
    res.setHeader("Content-Type", "image/png");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Content-Disposition", `inline; filename="bill_${bill.id}.png"`);
    res.send(pngBuffer);
  } catch (err: any) {
    console.error("Error generating bill image:", err);
    res.status(500).send("Error generating bill image");
  }
});

app.get("/api/billing/:id/render-svg", (req, res) => {
  const db = readDB();
  const bill = db.billingRecords?.find((b: any) => b.id === req.params.id);
  if (!bill) {
    return res.status(404).send("Billing record not found");
  }
  try {
    const svg = generateBillSvg(bill);
    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(svg);
  } catch (err: any) {
    console.error("Error generating bill SVG:", err);
    res.status(500).send("Error generating bill SVG");
  }
});

// Duplicate prevention cache for Deploy Statement (key: tenantId:hash -> { timestamp, response })
const statementDeployCache = new Map<string, { timestamp: number; response: any }>();

// Deploy Financial Statement directly via Facebook Messenger Send API with Visual Bill Receipt Image
app.post("/api/billing/deploy-statement", async (req, res) => {
  const { tenant_id, billing_id, force_retry } = req.body;

  if (!tenant_id) {
    return res.status(400).json({
      success: false,
      status: "failed",
      error: "Missing required parameter: tenant_id."
    });
  }

  const db = readDB();
  const tenant = db.tenants.find((t: any) => t.id === tenant_id);
  if (!tenant) {
    return res.status(404).json({
      success: false,
      status: "failed",
      error: `Tenant with ID "${tenant_id}" not found.`
    });
  }

  // Find target billing record
  let bill = billing_id ? db.billingRecords?.find((b: any) => b.id === billing_id) : null;
  if (!bill) {
    const tenantBills = (db.billingRecords || []).filter((b: any) => b.tenant_id === tenant_id);
    if (tenantBills.length > 0) {
      bill = tenantBills[tenantBills.length - 1];
    }
  }

  if (!bill) {
    return res.status(404).json({
      success: false,
      status: "failed",
      error: `No billing record found for tenant "${tenant.name}". Please generate a monthly bill first.`
    });
  }

  // Duplicate protection: prevent repeated sends within 10 seconds
  const cacheKey = `${tenant_id}:${bill.id}`;
  const cached = statementDeployCache.get(cacheKey);
  const now = Date.now();
  if (!force_retry && cached && (now - cached.timestamp < 10000)) {
    console.log(`[DUPLICATE PROTECTION] Returning cached statement deploy response for tenant: ${tenant.name}`);
    return res.json(cached.response);
  }

  try {
    const deployResult = await sendVisualBillToMessenger(tenant, bill, {
      forceRetry: Boolean(force_retry),
      req
    });

    statementDeployCache.set(cacheKey, { timestamp: now, response: deployResult });

    if (!deployResult.success) {
      return res.status(502).json(deployResult);
    }
    return res.json(deployResult);
  } catch (err: any) {
    console.error(`[DEPLOY STATEMENT ERROR] Exception deploying bill for ${tenant.name}:`, err);
    return res.status(500).json({
      success: false,
      status: "failed",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      bill_id: bill.id,
      error: `❌ Bill generation or deployment failed: ${err?.message || "Unknown error"}`,
      message: `❌ Bill generation or deployment failed: ${err?.message || "Unknown error"}`
    });
  }
});

// Convenience route for deploying a specific bill by ID
app.post("/api/billing/:id/deploy", async (req, res) => {
  const { id } = req.params;
  const db = readDB();
  const bill = db.billingRecords?.find((b: any) => b.id === id);
  if (!bill) {
    return res.status(404).json({ success: false, status: "failed", error: "Billing record not found" });
  }

  const tenant = db.tenants?.find((t: any) => t.id === bill.tenant_id);
  if (!tenant) {
    return res.status(404).json({ success: false, status: "failed", error: "Associated tenant not found" });
  }

  const cacheKey = `${tenant.id}:${bill.id}`;
  const cached = statementDeployCache.get(cacheKey);
  const now = Date.now();
  if (!req.body.force_retry && cached && (now - cached.timestamp < 10000)) {
    return res.json(cached.response);
  }

  try {
    const deployResult = await sendVisualBillToMessenger(tenant, bill, {
      forceRetry: Boolean(req.body.force_retry),
      req
    });

    statementDeployCache.set(cacheKey, { timestamp: now, response: deployResult });

    if (!deployResult.success) {
      return res.status(502).json(deployResult);
    }
    return res.json(deployResult);
  } catch (err: any) {
    console.error(`[DEPLOY STATEMENT ERROR] Exception deploying bill ${id} for ${tenant.name}:`, err);
    return res.status(500).json({
      success: false,
      status: "failed",
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      bill_id: bill.id,
      error: `❌ Bill generation or deployment failed: ${err?.message || "Unknown error"}`,
      message: `❌ Bill generation or deployment failed: ${err?.message || "Unknown error"}`
    });
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

// Chatbot query route (Unified ApartmentPro AI Engine)
app.post("/api/chatbot/query", async (req, res) => {
  const { message, tenantId, senderPsid, attachmentUrl } = req.body;
  if (!message && !attachmentUrl) {
    return res.status(400).json({ error: "Message or attachment is required" });
  }

  try {
    const psid = senderPsid || (tenantId ? `tenant-web-${tenantId}` : "web-chat");
    const result = await queryChatbotWithResult(message || "", tenantId || null, psid, attachmentUrl);
    res.json(result);
  } catch (error: any) {
    console.error("Chatbot query error:", error);
    res.status(500).json({ error: "Failed to process chat query" });
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

app.delete("/api/maintenance/:id", (req, res) => {
  const db = readDB();
  const { id } = req.params;
  db.maintenanceRequests = db.maintenanceRequests || [];
  const index = db.maintenanceRequests.findIndex((m: any) => m.id === id);
  if (index !== -1) {
    const deleted = db.maintenanceRequests.splice(index, 1)[0];
    logTransaction(db, {
      category: "maintenance",
      action: "delete",
      title: `Deleted Maintenance Ticket ${id}`,
      details: `Deleted ticket ${id} (${deleted.category || 'General'}) for Room ${deleted.room_number || 'N/A'}.`,
      tenant_id: deleted.tenant_id,
      tenant_name: deleted.tenant_name,
      room_number: deleted.room_number
    });
    writeDB(db);
    res.json({ success: true, deleted });
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
// Handled via imported unified chatbotService: handleMessengerWebhookEvent, queryChatbotWithResult

app.post(["/api/webhook/facebook", "/webhook/facebook"], async (req, res) => {
  const body = req.body;

  console.log("===== FACEBOOK WEBHOOK RAW BODY =====");
  console.log(typeof body === "object" ? JSON.stringify(body, null, 2) : body);

  if (body.object === "page") {
    for (const entry of body.entry || []) {
      const webhookPageId = entry.id;
      for (const webhook_event of entry.messaging || []) {
        // Process incoming message with real ApartmentPro AI Chatbot
        await handleMessengerWebhookEvent(webhook_event, webhookPageId);
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
