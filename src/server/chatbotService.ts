import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";
import { dbService } from "./dbService";

// Official Facebook Page for ApartmentPro
export const OFFICIAL_PAGE_ID = (process.env.FACEBOOK_PAGE_ID || process.env.PAGE_ID || "3246715018859879").trim();
export const OFFICIAL_PAGE_NAME = "ApartmentPro";
export const RETIRED_OLD_PAGE_ID = "1049465111594454";
export const RETIRED_OLD_PAGE_NAME = "FullReddit";

export const standardQuickReplies = [
  { content_type: "text", title: "📋 History", payload: "GET_HISTORY" },
  { content_type: "text", title: "💳 Send Payment", payload: "SEND_PAYMENT" },
  { content_type: "text", title: "💰 Balances", payload: "GET_BALANCE" },
  { content_type: "text", title: "🔧 Maintenance", payload: "REPORT_MAINTENANCE" },
  { content_type: "text", title: "📢 Updates", payload: "VIEW_ANNOUNCEMENTS" },
  { content_type: "text", title: "📜 Rules", payload: "VIEW_RULES" }
];

// Lazy Gemini AI Client initialization
let aiClient: GoogleGenAI | null = null;
export function getAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!aiClient && apiKey) {
    try {
      aiClient = new GoogleGenAI({
        apiKey,
        httpOptions: {
          headers: {
            "User-Agent": "aistudio-build"
          }
        }
      });
    } catch (err) {
      console.error("Failed to initialize Gemini AI client:", err);
      aiClient = null;
    }
  }
  return aiClient;
}

// Database helper functions
export function readDB() {
  return dbService.getDB();
}

export function writeDB(data: any) {
  dbService.saveDB(data);
}

// Transaction log helper
export function logTransaction(db: any, entry: {
  category: "payment" | "billing" | "deposit" | "tenant" | "room" | "apartment" | "maintenance" | "system";
  action?: "create" | "update" | "delete" | "payment" | "move_in" | "move_out" | "status_change";
  title: string;
  details: string;
  amount?: number;
  tenant_id?: string;
  tenant_name?: string;
  room_number?: string;
  performed_by?: string;
}) {
  if (!db.transactionLogs) db.transactionLogs = [];
  const newLog = {
    id: `log-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
    timestamp: new Date().toISOString(),
    category: entry.category,
    action: entry.action || "create",
    title: entry.title,
    details: entry.details,
    amount: entry.amount,
    tenant_id: entry.tenant_id,
    tenant_name: entry.tenant_name,
    room_number: entry.room_number,
    performed_by: entry.performed_by || "Messenger Bot"
  };
  db.transactionLogs.unshift(newLog);
  return newLog;
}

// Safe Token Identity Diagnostic
export async function runSafeTokenDiagnostic(webhookPageId?: string): Promise<{
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

// Send Message via Facebook Graph API
export async function sendFacebookMessage(
  senderPsid: string,
  responsePayload: any
): Promise<{ success: boolean; error?: string; message_id?: string }> {
  const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  if (!PAGE_ACCESS_TOKEN) {
    console.warn("FACEBOOK_PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKEN is not configured. Cannot send reply to Messenger user.");
    return { success: false, error: "Facebook Page Access Token is not configured on the server." };
  }

  // Format message payload and include 1-tap quick action buttons
  let msgObj: any = typeof responsePayload === "string" ? { text: responsePayload } : { ...responsePayload };
  if (!msgObj.quick_replies && msgObj.text && !msgObj.attachment && !msgObj.fileBuffer) {
    msgObj.quick_replies = standardQuickReplies;
  }

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
  const url = `https://graph.facebook.com/${graphVersion}/me/messages`;

  // Direct Binary Multipart Upload (Send image without external hosting dependencies)
  if (msgObj.fileBuffer) {
    try {
      const formData = new FormData();
      formData.append("recipient", JSON.stringify({ id: senderPsid }));
      
      const messagePayload: any = {
        attachment: {
          type: "image",
          payload: { is_reusable: true }
        }
      };
      if (msgObj.quick_replies) {
        messagePayload.quick_replies = msgObj.quick_replies;
      }
      formData.append("message", JSON.stringify(messagePayload));
      
      const fileName = msgObj.fileName || "bill.png";
      const mimeType = fileName.endsWith(".jpg") || fileName.endsWith(".jpeg") ? "image/jpeg" : "image/png";
      const blob = new Blob([msgObj.fileBuffer], { type: mimeType });
      formData.append("filedata", blob, fileName);

      const res = await fetch(url, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${PAGE_ACCESS_TOKEN}`
        },
        body: formData
      });

      const resText = await res.text();
      let resData: any;
      try {
        resData = JSON.parse(resText);
      } catch {
        resData = resText;
      }

      if (!res.ok) {
        console.error("===== FACEBOOK MULTIPART SEND ERROR =====");
        console.error(`Status: ${res.status} ${res.statusText}`);
        console.error(typeof resData === "object" ? JSON.stringify(resData, null, 2) : resData);
        const safeErrorMsg = resData?.error?.message || `Facebook Graph API responded with status ${res.status}`;
        return { success: false, error: safeErrorMsg };
      } else {
        console.log(`Successfully sent multipart media to Facebook Messenger user: ${senderPsid}`);
        return { success: true, message_id: resData?.message_id };
      }
    } catch (err: any) {
      console.error("Error in sendFacebookMessage multipart upload:", err);
      return { success: false, error: err?.message || "Error dispatching multipart message to Facebook" };
    }
  }

  // Only pass supported Messenger Send API fields to Facebook
  const validMessagePayload: any = {};
  if (msgObj.text) validMessagePayload.text = msgObj.text;
  if (msgObj.quick_replies) validMessagePayload.quick_replies = msgObj.quick_replies;
  if (msgObj.attachment) validMessagePayload.attachment = msgObj.attachment;
  if (msgObj.metadata) validMessagePayload.metadata = msgObj.metadata;

  const requestBody = {
    recipient: {
      id: senderPsid
    },
    message: validMessagePayload
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
      console.error("===== FACEBOOK SEND RESPONSE ERROR =====");
      console.error(`Status: ${res.status} ${res.statusText}`);
      console.error(typeof resData === "object" ? JSON.stringify(resData, null, 2) : resData);
      const safeErrorMsg = resData?.error?.message || `Facebook Graph API responded with status ${res.status}`;
      return { success: false, error: safeErrorMsg };
    } else {
      console.log(`Successfully sent message to Facebook Messenger user: ${senderPsid}`);
      return { success: true, message_id: resData?.message_id };
    }
  } catch (error: any) {
    console.error("Error calling Facebook Graph API:", error);
    return { success: false, error: error?.message || "Network error communicating with Facebook Graph API" };
  }
}

// ==========================================
// MAINTENANCE PRIORITY CLASSIFIER & HELPERS
// ==========================================

export type MaintenanceCategory =
  | "Plumbing"
  | "Electrical"
  | "Internet"
  | "Air Conditioning"
  | "Furniture"
  | "Cleaning"
  | "Other";

export type MaintenanceSeverity = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";

export interface MaintenanceAnalysis {
  is_maintenance: boolean;
  is_status_query: boolean;
  category: MaintenanceCategory;
  priority: MaintenanceSeverity;
  description: string;
  needs_clarification: boolean;
  clarification_question?: string;
  safety_risk: boolean;
  safety_advisory?: string;
}

export function isMaintenanceStatusQuery(rawText: string): boolean {
  const lower = rawText.toLowerCase().trim();
  const statusPhrases = [
    "what's happening with my maintenance",
    "whats happening with my maintenance",
    "what is happening with my maintenance",
    "update on my repair",
    "update on my maintenance",
    "update on maintenance",
    "is my aircon repair done",
    "is my repair done",
    "check my maintenance ticket",
    "check my ticket",
    "check maintenance",
    "what's the status of my report",
    "whats the status of my report",
    "what is the status of my report",
    "status of my report",
    "status of my maintenance",
    "status of my ticket",
    "ticket status",
    "maintenance status",
    "repair status",
    "status of repair",
    "is my ticket finished",
    "is my ticket resolved",
    "any update on my repair",
    "any update on my ticket",
    "check my repair"
  ];
  return statusPhrases.some(phrase => lower.includes(phrase)) ||
    ((lower.includes("status") || lower.includes("update") || lower.includes("check")) && (lower.includes("ticket") || lower.includes("maintenance") || lower.includes("repair")));
}

export function analyzeMaintenanceIntent(rawText: string): MaintenanceAnalysis {
  const text = rawText.trim();
  const lower = text.toLowerCase();

  // 1. Status query check
  if (isMaintenanceStatusQuery(rawText)) {
    return {
      is_maintenance: false,
      is_status_query: true,
      category: "Other",
      priority: "MEDIUM",
      description: text,
      needs_clarification: false,
      safety_risk: false
    };
  }

  // 2. Non-maintenance fast filters (greetings, rent balance questions without problem description)
  const isDirectMaintButton = lower === "report_maintenance" || lower === "report maintenance" || lower === "maintenance" || lower === "repair";
  
  // Guard against purely financial inquiries being misclassified as maintenance
  const hasDefiniteProblemWord = ["leak", "leaking", "broken", "clog", "clogged", "smoke", "fire", "spark", "sparks", "repair", "fix", "outage", "blackout", "brownout", "damaged", "malfunction", "dripping", "overflow", "burst", "smell"].some(w => lower.includes(w));
  const isPureFinancial = (
    lower.includes("balance") ||
    lower.includes("rent due") ||
    lower.includes("due date") ||
    lower.includes("how much") ||
    lower.includes("billing") ||
    lower.includes("statement") ||
    lower.includes("payment") ||
    lower.includes("receipt") ||
    lower.includes("bayad") ||
    lower.includes("magkano")
  ) && !hasDefiniteProblemWord;

  if (isPureFinancial && !isDirectMaintButton) {
    return {
      is_maintenance: false,
      is_status_query: false,
      category: "Other",
      priority: "MEDIUM",
      description: text,
      needs_clarification: false,
      safety_risk: false
    };
  }

  const matchesKeyword = (kw: string) => {
    if (kw.length <= 4) {
      const regex = new RegExp(`\\b${kw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(text);
    }
    return lower.includes(kw);
  };
  
  // Specific equipment & failure indicators
  const acKeywords = ["aircon", "air con", "air-con", "air conditioner", "air conditioning", "ac", "cooling", "freon", "refrigerant", "compressor", "split type", "not cooling", "warm air", "ac leak", "ac dripping"];
  const plumbingKeywords = ["toilet", "cr", "comfort room", "bathroom", "shower", "sink", "faucet", "tap", "pipe", "pipes", "water", "leak", "leaking", "leaks", "leaked", "drip", "dripping", "clog", "clogged", "drain", "drainage", "overflow", "overflowing", "bidet", "burst", "bursting", "flooding", "flood", "flooded", "sewage", "sewer", "no water", "low water pressure", "ceiling", "water coming from"];
  const electricalKeywords = ["electricity", "electrical", "power", "power outage", "blackout", "brownout", "light", "lights", "bulb", "flicker", "flickering", "flickers", "dim", "socket", "outlet", "plug", "breaker", "circuit breaker", "tripped", "wire", "wires", "wiring", "spark", "sparks", "sparking", "sparked", "short circuit", "shock", "smoke", "burning smell", "no power", "fuse"];
  const internetKeywords = ["wifi", "wi-fi", "internet", "router", "modem", "connection", "slow connection", "lan cable", "no internet", "network", "signal"];
  const furnitureKeywords = ["door", "door knob", "doorknob", "door lock", "padlock", "deadbolt", "key", "lock", "locked out", "window", "window latch", "window lock", "bed", "mattress", "chair", "table", "desk", "cabinet", "cupboard", "closet", "drawer", "shelf", "sofa", "furniture", "hinge"];
  const cleaningKeywords = ["cleaning", "clean", "trash", "garbage", "rubbish", "pest", "pests", "cockroach", "cockroaches", "roach", "roaches", "ant", "ants", "bug", "bugs", "rodent", "rat", "rats", "mice", "mouse", "infestation", "mold", "mildew", "bad odor"];
  const generalMaintWords = ["broken", "not working", "stopped working", "keeps going out", "repair", "fix", "damaged", "malfunction", "leaking", "clogged", "technician", "problem in my room", "issue in my room"];

  const hasAc = acKeywords.some(kw => matchesKeyword(kw));
  const hasPlumbing = plumbingKeywords.some(kw => matchesKeyword(kw));
  const hasElectrical = electricalKeywords.some(kw => matchesKeyword(kw));
  const hasInternet = internetKeywords.some(kw => matchesKeyword(kw));
  const hasFurniture = furnitureKeywords.some(kw => matchesKeyword(kw));
  const hasCleaning = cleaningKeywords.some(kw => matchesKeyword(kw));
  const hasGeneralProblem = generalMaintWords.some(kw => matchesKeyword(kw));

  // Determine if maintenance intent
  const isMaintenance = isDirectMaintButton || hasAc || hasPlumbing || hasElectrical || hasInternet || hasFurniture || hasCleaning || hasGeneralProblem;

  if (!isMaintenance) {
    return {
      is_maintenance: false,
      is_status_query: false,
      category: "Other",
      priority: "MEDIUM",
      description: text,
      needs_clarification: false,
      safety_risk: false
    };
  }

  // Check if message is too vague (needs clarification)
  const vagueInputs = ["report_maintenance", "report maintenance", "maintenance", "maintenance please", "repair", "help repair", "something is broken", "it is broken", "it's broken", "can you send a repairman", "i need maintenance", "need maintenance", "broken"];
  const isVague = vagueInputs.includes(lower) || (text.split(" ").length <= 3 && !hasAc && !hasPlumbing && !hasElectrical && !hasFurniture && !hasInternet && !hasCleaning);

  if (isVague) {
    return {
      is_maintenance: true,
      is_status_query: false,
      category: "Other",
      priority: "MEDIUM",
      description: text,
      needs_clarification: true,
      clarification_question: "🔧 **ApartmentPro Maintenance Assistance**\n\nCould you please specify what is broken or which equipment needs repair? (For example: *'My aircon is leaking water'*, *'The toilet is clogged'*, or *'The light in my room is flickering'*).\n\nOnce you describe the problem, I will immediately log your ticket and notify our administration!",
      safety_risk: false
    };
  }

  // Determine Category
  let category: MaintenanceCategory = "Other";
  if (hasAc) {
    category = "Air Conditioning";
  } else if (hasPlumbing) {
    category = "Plumbing";
  } else if (hasElectrical) {
    category = "Electrical";
  } else if (hasInternet) {
    category = "Internet";
  } else if (hasFurniture) {
    category = "Furniture";
  } else if (hasCleaning) {
    category = "Cleaning";
  }

  // Determine Severity (CRITICAL, HIGH, MEDIUM, LOW)
  // CRITICAL: Smoke, fire, flame, spark, burning, live wire, gas leak, burst pipe with major flooding, ceiling collapse
  const criticalTriggers = ["smoke", "fire", "flame", "spark", "sparks", "sparking", "sparked", "burning", "burnt smell", "burning smell", "live wire", "exposed wire", "electric shock", "gas leak", "burst pipe", "flooding", "water everywhere", "ceiling collapsing", "structural"];
  const isCritical = criticalTriggers.some(trigger => lower.includes(trigger));

  // HIGH: Serious water leak, toilet overflowing, entire power out, heavy leak, shower no water, broken main lock
  const highTriggers = ["heavy leak", "really bad leak", "water pouring", "water coming from the ceiling", "toilet overflow", "overflowing", "no electricity in", "entire electricity", "complete blackout", "no water", "shower has no water", "aircon leaking heavily", "lock is broken", "door won't lock", "door wont lock", "broken lock", "can't lock my door", "cant lock my door", "burst"];
  const isHigh = !isCritical && highTriggers.some(trigger => lower.includes(trigger));

  // LOW: Cosmetic, minor fixture, loose handle, slow internet, lightbulb replacement, cleaning/trash
  const lowTriggers = ["light bulb", "bulb", "loose", "scratch", "cabinet hinge", "drawer handle", "door knob loose", "wifi", "internet", "trash", "cleaning"];
  const isLow = !isCritical && !isHigh && lowTriggers.some(trigger => lower.includes(trigger)) && !lower.includes("leak") && !lower.includes("clogged") && !lower.includes("flickering") && !lower.includes("smoke");

  let priority: MaintenanceSeverity = "MEDIUM";
  let safety_risk = false;
  let safety_advisory: string | undefined = undefined;

  if (isCritical) {
    priority = "CRITICAL";
    safety_risk = true;
    safety_advisory = "⚠️ **SAFETY PRECAUTION:** Please keep a safe distance from the hazard. Do NOT touch any damaged wiring, outlets, or flooded electrical items. If safe, switch off your unit's main circuit breaker or shut off the main water valve. If there is active smoke or fire, evacuate immediately and call emergency services (911).";
  } else if (isHigh) {
    priority = "HIGH";
  } else if (isLow) {
    priority = "LOW";
  } else {
    priority = "MEDIUM";
  }

  return {
    is_maintenance: true,
    is_status_query: false,
    category,
    priority,
    description: text,
    needs_clarification: false,
    safety_risk,
    safety_advisory
  };
}

export function findOpenDuplicateTicket(
  db: any,
  tenantId: string | null,
  roomNum: string,
  category: MaintenanceCategory,
  description: string
): any | null {
  const openTickets = (db.maintenanceRequests || []).filter((t: any) => {
    const matchesTenant = (tenantId && t.tenant_id === tenantId) ||
      (roomNum && roomNum !== "N/A" && roomNum !== "Guest/Unknown" && t.room_number === roomNum);
    const isOpen = t.status === "pending" || t.status === "in_progress";
    return matchesTenant && isOpen;
  });

  if (openTickets.length === 0) return null;

  const descLower = description.toLowerCase();
  for (const ticket of openTickets) {
    if (ticket.category === category) {
      const prevDescLower = (ticket.issue_description || "").toLowerCase();
      const isContinuation = descLower.includes("still") ||
        descLower.includes("again") ||
        descLower.includes("update") ||
        descLower.includes("follow up") ||
        descLower.includes("not fixed") ||
        descLower.includes("not yet") ||
        descLower.includes("any news");

      const wordsNew = descLower.replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 3);
      const wordsOld = new Set(prevDescLower.replace(/[^\w\s]/g, " ").split(/\s+/).filter(w => w.length > 3));
      const hasWordOverlap = wordsNew.some(w => wordsOld.has(w));

      if (isContinuation || hasWordOverlap || openTickets.length === 1) {
        return ticket;
      }
    }
  }

  return null;
}

export type MaintenanceSessionStep = "WHEN" | "WHERE" | "DESCRIPTION" | "PHOTO" | "REVIEW" | "EDIT_SELECT";

export interface MaintenanceSession {
  psid: string;
  tenantId: string | null;
  tenantName?: string;
  roomNumber?: string;
  step: MaintenanceSessionStep;
  occurredAt?: string;
  location?: string;
  description?: string;
  photoUrl?: string;
  photoAttached?: boolean;
  editingField?: "WHEN" | "WHERE" | "DESCRIPTION" | "PHOTO" | null;
  updatedAt: number;
}

export interface ChatbotReplyPayload {
  text: string;
  quick_replies?: Array<{ content_type: string; title: string; payload: string }>;
  session_step?: string;
  is_maintenance_form?: boolean;
  create_ticket?: boolean;
  ticket_details?: {
    category: MaintenanceCategory;
    priority: MaintenanceSeverity;
    description: string;
    ticket_id?: string;
    occurred_at?: string;
    location?: string;
    photo_url?: string;
  };
}

export const whenQuickReplies = [
  { content_type: "text", title: "Today", payload: "Today" },
  { content_type: "text", title: "Yesterday", payload: "Yesterday" },
  { content_type: "text", title: "This morning", payload: "This morning" },
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_FORM" }
];

export const whereQuickReplies = [
  { content_type: "text", title: "Bathroom", payload: "Bathroom" },
  { content_type: "text", title: "Bedroom", payload: "Bedroom" },
  { content_type: "text", title: "Kitchen", payload: "Kitchen" },
  { content_type: "text", title: "Living room", payload: "Living room" },
  { content_type: "text", title: "My room", payload: "My room" },
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_FORM" }
];

export const descriptionQuickReplies = [
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_FORM" }
];

export const photoQuickReplies = [
  { content_type: "text", title: "📷 Attach Photo", payload: "ATTACH_PHOTO" },
  { content_type: "text", title: "Skip Photo", payload: "SKIP_PHOTO" },
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_FORM" }
];

export const reviewQuickReplies = [
  { content_type: "text", title: "✅ Submit Report", payload: "SUBMIT_REPORT" },
  { content_type: "text", title: "✏️ Edit", payload: "EDIT_REPORT" },
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_FORM" }
];

export const editSelectQuickReplies = [
  { content_type: "text", title: "📅 When", payload: "EDIT_WHEN" },
  { content_type: "text", title: "📍 Location", payload: "EDIT_LOCATION" },
  { content_type: "text", title: "📝 Description", payload: "EDIT_DESCRIPTION" },
  { content_type: "text", title: "📷 Photo", payload: "EDIT_PHOTO" },
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_FORM" }
];

// Conversation session management for Messenger multi-step workflows
const memorySessionStore = new Map<string, MaintenanceSession>();

export function getMaintenanceSession(psid: string): MaintenanceSession | null {
  // Check memory store first for zero-latency lookups
  let session = memorySessionStore.get(psid);
  if (!session) {
    const db = readDB();
    if (db.maintenanceSessions && db.maintenanceSessions[psid]) {
      session = db.maintenanceSessions[psid];
      if (session) {
        memorySessionStore.set(psid, session);
      }
    }
  }

  if (!session) return null;

  // Expire session after 2 hours of inactivity
  if (Date.now() - (session.updatedAt || 0) > 2 * 60 * 60 * 1000) {
    memorySessionStore.delete(psid);
    const db = readDB();
    if (db.maintenanceSessions && db.maintenanceSessions[psid]) {
      delete db.maintenanceSessions[psid];
      writeDB(db);
    }
    return null;
  }
  return session;
}

export function saveMaintenanceSession(session: MaintenanceSession): void {
  session.updatedAt = Date.now();
  memorySessionStore.set(session.psid, { ...session });
  const db = readDB();
  db.maintenanceSessions = db.maintenanceSessions || {};
  db.maintenanceSessions[session.psid] = { ...session };
  writeDB(db);
}

export function clearMaintenanceSession(psid: string): void {
  memorySessionStore.delete(psid);
  const db = readDB();
  if (db.maintenanceSessions && db.maintenanceSessions[psid]) {
    delete db.maintenanceSessions[psid];
    writeDB(db);
  }
}

// Intelligent extractor to preserve pre-stated info (e.g. "My aircon started leaking this morning in my bedroom")
export function extractMaintenanceDetailsFromText(rawText: string): {
  occurredAt?: string;
  location?: string;
  description?: string;
} {
  const text = rawText.trim();

  let occurredAt: string | undefined = undefined;
  let location: string | undefined = undefined;
  let description: string = text;

  // 1. Time / Timing extraction patterns
  const timePatterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\b(this\s+morning)\b/i, label: "This morning" },
    { regex: /\b(this\s+afternoon)\b/i, label: "This afternoon" },
    { regex: /\b(this\s+evening)\b/i, label: "This evening" },
    { regex: /\b(today(?:\s+around\s+\d+(?::\d+)?\s*(?:am|pm)?)?)\b/i, label: "Today" },
    { regex: /\b(yesterday(?:\s+(?:morning|afternoon|evening|night))?)\b/i, label: "Yesterday" },
    { regex: /\b(last\s+night)\b/i, label: "Last night" },
    { regex: /\b(earlier\s+today)\b/i, label: "Earlier today" },
    { regex: /\b(just\s+now)\b/i, label: "Just now" },
    { regex: /\b(a\s+few\s+moments\s+ago)\b/i, label: "A few moments ago" },
    { regex: /\b(a\s+few\s+(?:hours?|minutes?|days?)\s+ago)\b/i, label: "A few hours ago" },
    { regex: /\b(a\s+couple\s+(?:of\s+)?days\s+ago)\b/i, label: "A couple of days ago" },
    { regex: /\b(\d+\s+days?\s+ago)\b/i, label: "A few days ago" },
    { regex: /\b(since\s+yesterday)\b/i, label: "Since yesterday" },
    { regex: /\b(since\s+this\s+morning)\b/i, label: "Since this morning" }
  ];

  for (const tp of timePatterns) {
    const match = text.match(tp.regex);
    if (match) {
      occurredAt = tp.label;
      break;
    }
  }

  // 2. Location extraction patterns
  const locationPatterns: Array<{ regex: RegExp; label: string }> = [
    { regex: /\b(?:in|at|inside)\s+(?:the\s+|my\s+)?(master\s+bedroom|bedroom|bed\s+room)\b/i, label: "Bedroom" },
    { regex: /\b(?:in|at|inside)\s+(?:the\s+|my\s+)?(bathroom|comfort\s+room|cr|toilet|shower|restroom)\b/i, label: "Bathroom" },
    { regex: /\b(?:in|at|inside)\s+(?:the\s+|my\s+)?(kitchen)\b/i, label: "Kitchen" },
    { regex: /\b(?:in|at|inside)\s+(?:the\s+|my\s+)?(living\s+room|livingroom|hall)\b/i, label: "Living room" },
    { regex: /\b(?:outside\s+the\s+unit|outside\s+my\s+unit|outside\s+corridor|hallway)\b/i, label: "Outside the unit" },
    { regex: /\b(?:near\s+the\s+front\s+door|front\s+door|doorstep)\b/i, label: "Near the front door" },
    { regex: /\b(?:on\s+the\s+balcony|balcony)\b/i, label: "Balcony" },
    { regex: /\b(?:on\s+the\s+ceiling|ceiling)\b/i, label: "Ceiling" },
    { regex: /\b(?:in\s+my\s+room|my\s+room|my\s+unit)\b/i, label: "My room" }
  ];

  for (const lp of locationPatterns) {
    if (lp.regex.test(text)) {
      location = lp.label;
      break;
    }
  }

  // Direct keyword fallback if no preposition phrase
  if (!location) {
    if (/\b(master\s+bedroom|bedroom)\b/i.test(text)) location = "Bedroom";
    else if (/\b(bathroom|toilet|comfort\s+room|shower)\b/i.test(text)) location = "Bathroom";
    else if (/\b(kitchen)\b/i.test(text)) location = "Kitchen";
    else if (/\b(living\s+room)\b/i.test(text)) location = "Living room";
    else if (/\b(balcony)\b/i.test(text)) location = "Balcony";
  }

  return { occurredAt, location, description };
}

// Renders the review screen before ticket creation (Step 6)
export function formatReviewSummary(session: MaintenanceSession): ChatbotReplyPayload {
  const occurredAt = session.occurredAt || "Not specified";
  const location = session.location || "Not specified";
  const description = session.description || "Not specified";
  const photoStr = session.photoAttached ? "Attached" : "No photo";

  const summaryText = `🔧 **Maintenance Report**\n\n` +
    `📅 When:\n${occurredAt}\n\n` +
    `📍 Where:\n${location}\n\n` +
    `📝 Problem:\n${description}\n\n` +
    `📷 Photo:\n${photoStr}\n\n` +
    `Please review your report.`;

  return {
    text: summaryText,
    quick_replies: reviewQuickReplies,
    session_step: "REVIEW",
    is_maintenance_form: true
  };
}

export function createMaintenanceTicketRecord(
  db: any,
  tenantObj: any | null,
  roomNum: string,
  tenantId: string | null,
  senderPsid: string,
  category: MaintenanceCategory,
  priority: MaintenanceSeverity,
  description: string,
  occurredAt: string = "Recently",
  location: string = "Room",
  photoUrl?: string
): { ticketId: string; reply: string } {
  // Generate Clean Ticket ID matching required specification: MT-XXXXXX
  const ticketId = `MT-${Math.floor(100000 + Math.random() * 900000)}`;
  const tenantName = tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`;
  const sanitizedRoom = roomNum && roomNum !== "N/A" && roomNum !== "Guest/Unknown" ? roomNum : "Unknown";

  // 1. Create Ticket in database
  const newMaint = {
    id: ticketId,
    room_id: tenantObj ? tenantObj.room_id : "",
    room_number: sanitizedRoom,
    tenant_id: tenantId || "guest",
    tenant_name: tenantName,
    issue_description: description,
    description: description,
    category,
    priority,
    severity: priority,
    occurred_at: occurredAt,
    occurredAt: occurredAt,
    location: location,
    photo_url: photoUrl || "",
    photo: photoUrl || "",
    messenger_psid: senderPsid,
    status: "pending" as const,
    created_at: new Date().toISOString(),
    createdAt: new Date().toISOString(),
    updated_at: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };

  db.maintenanceRequests = db.maintenanceRequests || [];
  db.maintenanceRequests.push(newMaint);

  // 2. Format Admin Alert strictly to user specifications (Step 11)
  let adminTitle = "";
  let urgentFootnote = "";
  if (priority === "CRITICAL") {
    adminTitle = "🚨 **CRITICAL MAINTENANCE REPORT**";
    urgentFootnote = "\n\n⚠️ Immediate attention required.";
  } else if (priority === "HIGH") {
    adminTitle = "🔴 **HIGH PRIORITY MAINTENANCE**";
  } else if (priority === "MEDIUM") {
    adminTitle = "🟠 **MEDIUM PRIORITY MAINTENANCE**";
  } else {
    adminTitle = "🟢 **LOW PRIORITY MAINTENANCE**";
  }

  const photoStr = (photoUrl && photoUrl.trim().length > 0) ? "Attached" : "No photo";
  const displayRoom = sanitizedRoom.startsWith("Room") ? sanitizedRoom : `Room ${sanitizedRoom}`;
  const adminMessage = `${adminTitle}\n\n` +
    `Tenant: ${tenantName}\n` +
    `Room: ${displayRoom}\n\n` +
    `Category: ${category}\n` +
    `Severity: ${priority}\n\n` +
    `📅 When:\n${occurredAt}\n\n` +
    `📍 Location:\n${location}\n\n` +
    `📝 Problem:\n${description}\n\n` +
    `📷 Photo:\n${photoStr}\n\n` +
    `🎫 Ticket:\n${ticketId}${urgentFootnote}`;

  const newNotif = {
    id: `notif-maint-${Date.now()}`,
    tenant_id: tenantId || "guest",
    tenant_name: tenantName,
    message: adminMessage,
    type: "general" as const,
    status: "sent" as const,
    channel: "in_app" as const,
    created_at: new Date().toISOString()
  };
  if (!db.notifications) db.notifications = [];
  db.notifications.push(newNotif);

  // 3. Log in Transaction Audit Trail
  logTransaction(db, {
    category: "maintenance",
    action: "create",
    title: `Maintenance Request [${priority}] - ${category}`,
    details: `Ticket ${ticketId} created for ${tenantName} (${displayRoom}): "${description}". Priority: ${priority}. Location: ${location}. Occurred: ${occurredAt}. Photo: ${photoStr}.`,
    tenant_id: tenantId || "guest",
    tenant_name: tenantName,
    room_number: sanitizedRoom,
    performed_by: "Messenger AI Bot"
  });

  writeDB(db);

  // 4. Format Tenant Confirmation Response strictly to specifications (Step 12)
  const photoNote = (photoUrl && photoUrl.trim().length > 0) ? "📷 Photo attached to the report." : "📷 No photo attached.";
  let tenantConfirmation = `🔧 **Maintenance Report Submitted**\n\n` +
    `Ticket ID: ${ticketId}\n\n` +
    `📍 Location: ${location}\n` +
    `📝 Issue: ${description}\n` +
    `🏷️ Category: ${category}\n` +
    `⚠️ Priority: ${priority}\n\n` +
    `The administration has been notified.\n\n` +
    `${photoNote}`;

  if (priority === "CRITICAL") {
    tenantConfirmation += `\n\n⚠️ **IMMEDIATE SAFETY ADVISORY:**\n` +
      `Please keep a safe distance from the hazard. Do NOT touch any damaged wiring, outlets, or flooded electrical items. If safe, switch off your unit's main circuit breaker or shut off the main water valve. If there is active smoke or fire, evacuate immediately and call emergency services (911).`;
  }

  return { ticketId, reply: tenantConfirmation };
}

// Core ApartmentPro Chatbot Engine
export async function processChatbotMessage(
  messageText: string,
  tenantId: string | null,
  senderPsid: string,
  attachmentUrl?: string
): Promise<ChatbotReplyPayload | string> {
  const db = readDB();
  const announcementsList = db.announcements || [];
  const rulesList = db.rules || [];

  // Gather tenant context if authenticated/linked
  let tenantContext = "The user is browsing as a Guest. No specific tenant details are logged in.";
  let tenantObj: any = null;
  let outstandingBalance = 0;
  let nextDueDate = "No active dues";
  let nextDueMonth = "";
  let roomNum = "N/A";
  let aptName = "ApartmentPro";

  if (tenantId) {
    tenantObj = (db.tenants || []).find((t: any) => t.id === tenantId);
    if (tenantObj) {
      const room = (db.rooms || []).find((r: any) => r.id === tenantObj.room_id);
      roomNum = room ? room.room_number : "N/A";
      const apt = (db.apartments || []).find((a: any) => a.id === tenantObj.apartment_id);
      aptName = apt ? apt.name : "ApartmentPro";

      const tenantBills = (db.billingRecords || []).filter((b: any) => b.tenant_id === tenantId);
      const unpaidBills = tenantBills.filter((b: any) => b.payment_status === "unpaid" || b.payment_status === "overdue");
      outstandingBalance = unpaidBills.reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0);

      if (unpaidBills.length > 0) {
        const sortedBills = [...unpaidBills].sort((a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime());
        nextDueDate = sortedBills[0].due_date;
        nextDueMonth = sortedBills[0].billing_month || "";
      }

      tenantContext = `The user is logged in as a verified tenant via Facebook Messenger.
Tenant Profile:
- Name: ${tenantObj.name}
- Room Number: ${roomNum} (${aptName})
- Contact Number: ${tenantObj.contact}
- Monthly Rent Amount: ₱${Number(tenantObj.rent_amount || 0).toLocaleString("en-US")}
- Outstanding Rent & Utility Balance: ₱${Number(outstandingBalance).toLocaleString("en-US")}
- Security Deposit Active Balance: ₱${Number(tenantObj.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj.deposit || 0).toLocaleString("en-US")}
- Advance Rent Active Balance: ₱${Number(tenantObj.advance_balance !== undefined ? tenantObj.advance_balance : tenantObj.advance_payment || 0).toLocaleString("en-US")}
- Next Rent Due Date: ${nextDueDate} ${nextDueMonth ? `(${nextDueMonth})` : ""}
- Contract Status: ${tenantObj.status === "active" ? "Active Lease Agreement" : tenantObj.status}`;
    }
  }

  const textTrimmed = (messageText || "").trim();
  const textLower = textTrimmed.toLowerCase();

  // =========================================================================
  // PRIORITY 0: ACTIVE MULTI-STEP MAINTENANCE SESSION STATE MACHINE
  // =========================================================================
  const activeSession = getMaintenanceSession(senderPsid);
  if (activeSession) {
    // 0A. Handle Cancel Request (Can cancel anytime)
    const isCancel = textLower === "cancel" ||
      textLower === "cancel report" ||
      textLower === "cancel maintenance" ||
      textLower === "stop" ||
      textLower === "cancel_form" ||
      textLower === "cancel_maintenance" ||
      textLower === "exit" ||
      textTrimmed === "CANCEL_FORM" ||
      textTrimmed === "CANCEL_MAINTENANCE" ||
      textTrimmed === "❌ Cancel";

    if (isCancel) {
      clearMaintenanceSession(senderPsid);
      return {
        text: "Maintenance report cancelled. No ticket was created.",
        quick_replies: standardQuickReplies,
        is_maintenance_form: false
      };
    }

    // 0B. Step: WHEN
    if (activeSession.step === "WHEN") {
      activeSession.occurredAt = textTrimmed;

      if (activeSession.editingField === "WHEN") {
        activeSession.editingField = null;
        activeSession.step = "REVIEW";
        saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      }

      activeSession.step = "WHERE";
      saveMaintenanceSession(activeSession);
      return {
        text: "📍 **Where is the problem located?**",
        quick_replies: whereQuickReplies,
        session_step: "WHERE",
        is_maintenance_form: true
      };
    }

    // 0C. Step: WHERE
    if (activeSession.step === "WHERE") {
      if (textLower === "my room" || textLower === "in my room" || textLower === "my unit" || textLower === "room") {
        activeSession.location = roomNum && roomNum !== "N/A" ? `Room ${roomNum}` : "Tenant Room";
      } else {
        activeSession.location = textTrimmed;
      }

      if (activeSession.editingField === "WHERE") {
        activeSession.editingField = null;
        activeSession.step = "REVIEW";
        saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      }

      activeSession.step = "DESCRIPTION";
      saveMaintenanceSession(activeSession);
      const descPrompt = activeSession.description
        ? `📝 **Please describe the problem in detail:**\n_(You mentioned: "${activeSession.description}")_`
        : "📝 **Please describe the problem.**";
      return {
        text: descPrompt,
        quick_replies: descriptionQuickReplies,
        session_step: "DESCRIPTION",
        is_maintenance_form: true
      };
    }

    // 0D. Step: DESCRIPTION
    if (activeSession.step === "DESCRIPTION") {
      if (textLower !== "same" && textLower !== "same as above" && textLower !== "keep" && textLower !== "continue") {
        activeSession.description = textTrimmed;
      }
      if (attachmentUrl) {
        activeSession.photoUrl = attachmentUrl;
        activeSession.photoAttached = true;
      }

      if (activeSession.editingField === "DESCRIPTION") {
        activeSession.editingField = null;
        activeSession.step = "REVIEW";
        saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      }

      activeSession.step = "PHOTO";
      saveMaintenanceSession(activeSession);
      return {
        text: "📷 **Would you like to attach a photo?** (Optional)\n\nYou can upload a photo now, or tap **Skip Photo** to proceed.",
        quick_replies: photoQuickReplies,
        session_step: "PHOTO",
        is_maintenance_form: true
      };
    }

    // 0E. Step: PHOTO
    if (activeSession.step === "PHOTO") {
      const isPhotoAttachment = Boolean(attachmentUrl || textLower.startsWith("http://") || textLower.startsWith("https://") || textLower.startsWith("data:image"));
      const isSkip = textLower === "skip" ||
        textLower === "skip photo" ||
        textLower === "skip_photo" ||
        textTrimmed === "SKIP_PHOTO" ||
        textTrimmed === "Skip Photo" ||
        textLower === "no" ||
        textLower === "no photo" ||
        textLower === "none" ||
        textLower === "pass";
      const isAttachPrompt = textLower === "attach photo" ||
        textLower === "attach" ||
        textLower === "upload" ||
        textLower === "attach_photo" ||
        textTrimmed === "ATTACH_PHOTO" ||
        textTrimmed === "📷 Attach Photo" ||
        textLower === "photo";

      if (isPhotoAttachment) {
        activeSession.photoUrl = attachmentUrl || textTrimmed;
        activeSession.photoAttached = true;
        activeSession.step = "REVIEW";
        activeSession.editingField = null;
        saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      } else if (isSkip) {
        activeSession.photoUrl = undefined;
        activeSession.photoAttached = false;
        activeSession.step = "REVIEW";
        activeSession.editingField = null;
        saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      } else if (isAttachPrompt) {
        saveMaintenanceSession(activeSession);
        return {
          text: "📷 Please send or upload the photo of the issue now.",
          quick_replies: [
            { content_type: "text", title: "Skip Photo", payload: "SKIP_PHOTO" },
            { content_type: "text", title: "❌ Cancel", payload: "CANCEL_FORM" }
          ],
          session_step: "PHOTO",
          is_maintenance_form: true
        };
      } else {
        // Text provided at photo step - treat as optional skip or review
        activeSession.step = "REVIEW";
        activeSession.editingField = null;
        saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      }
    }

    // 0F. Step: REVIEW
    if (activeSession.step === "REVIEW") {
      const isSubmit = textLower === "submit" ||
        textLower === "submit report" ||
        textLower === "submit_report" ||
        textTrimmed === "SUBMIT_REPORT" ||
        textTrimmed === "✅ Submit Report" ||
        textLower === "confirm" ||
        textLower === "yes" ||
        textLower === "proceed" ||
        textLower === "send";

      const isEdit = textLower === "edit" ||
        textLower === "edit report" ||
        textLower === "edit_report" ||
        textTrimmed === "EDIT_REPORT" ||
        textTrimmed === "✏️ Edit" ||
        textLower === "change" ||
        textLower === "modify";

      if (isSubmit) {
        // 1. AI Analysis (Step 7)
        const maintAnalysis = analyzeMaintenanceIntent(activeSession.description || "");
        const category = maintAnalysis.category || "Other";
        const priority = maintAnalysis.priority || "MEDIUM";

        // 2. Server-Side Validation (Step 8)
        const finalDesc = (activeSession.description || "").trim();
        if (!finalDesc || finalDesc.length < 3) {
          activeSession.step = "DESCRIPTION";
          saveMaintenanceSession(activeSession);
          return {
            text: "⚠️ Please provide a clear description of the maintenance issue so our technicians know what to fix.\n\n📝 **Please describe the problem:**",
            quick_replies: descriptionQuickReplies,
            session_step: "DESCRIPTION",
            is_maintenance_form: true
          };
        }

        const finalOccurred = (activeSession.occurredAt || "Recently").trim();
        const finalLocation = (activeSession.location || (roomNum && roomNum !== "N/A" ? `Room ${roomNum}` : "Apartment Unit")).trim();

        // 3. Duplicate Ticket Check (Step 9)
        const openDuplicate = findOpenDuplicateTicket(db, tenantId, roomNum, category, finalDesc);
        if (openDuplicate) {
          clearMaintenanceSession(senderPsid);

          logTransaction(db, {
            category: "maintenance",
            action: "update",
            title: `Tenant Follow-Up on Ticket ${openDuplicate.id}`,
            details: `Tenant ${tenantObj?.name || "Guest"} (Room ${roomNum}) sent update for open ticket ${openDuplicate.id}: "${finalDesc}". Location: ${finalLocation}. Occurred: ${finalOccurred}.`,
            tenant_id: tenantId || "guest",
            tenant_name: tenantObj?.name || "Guest",
            room_number: roomNum,
            performed_by: "Messenger AI Bot"
          });

          const notifMsg = `ℹ️ Tenant Follow-up: Room ${roomNum} sent an update regarding open ticket [${openDuplicate.id}]: "${finalDesc}"`;
          if (!db.notifications) db.notifications = [];
          db.notifications.push({
            id: `notif-followup-${Date.now()}`,
            tenant_id: tenantId || "guest",
            tenant_name: tenantObj?.name || "Guest",
            message: notifMsg,
            type: "general" as const,
            status: "sent" as const,
            channel: "in_app" as const,
            created_at: new Date().toISOString()
          });
          writeDB(db);

          const statusLabel = openDuplicate.status === "in_progress" ? "In Progress" : "Pending";
          const duplicateReply = `🔧 **Existing Maintenance Report Found**\n\n` +
            `You already have an active maintenance report for this issue.\n\n` +
            `Ticket ID: ${openDuplicate.id}\n` +
            `Status: ${statusLabel}\n\n` +
            `Your new information has been added as a follow-up.`;

          return {
            text: duplicateReply,
            quick_replies: standardQuickReplies,
            is_maintenance_form: false,
            ticket_details: {
              category: openDuplicate.category,
              priority: openDuplicate.priority,
              description: openDuplicate.issue_description,
              ticket_id: openDuplicate.id
            }
          };
        }

        // 4. Create Ticket Record (Step 10, Step 11, Step 12)
        const ticketResult = createMaintenanceTicketRecord(
          db,
          tenantObj,
          roomNum,
          tenantId,
          senderPsid,
          category,
          priority,
          finalDesc,
          finalOccurred,
          finalLocation,
          activeSession.photoUrl
        );

        clearMaintenanceSession(senderPsid);

        return {
          text: ticketResult.reply,
          quick_replies: standardQuickReplies,
          create_ticket: true,
          is_maintenance_form: false,
          ticket_details: {
            category,
            priority,
            description: finalDesc,
            ticket_id: ticketResult.ticketId,
            occurred_at: finalOccurred,
            location: finalLocation,
            photo_url: activeSession.photoUrl
          }
        };
      }

      if (isEdit) {
        activeSession.step = "EDIT_SELECT";
        saveMaintenanceSession(activeSession);
        return {
          text: "✏️ **What would you like to edit?**\n\nPlease choose which information to change:",
          quick_replies: editSelectQuickReplies,
          session_step: "EDIT_SELECT",
          is_maintenance_form: true
        };
      }

      // Default review prompt
      return formatReviewSummary(activeSession);
    }

    // 0G. Step: EDIT_SELECT
    if (activeSession.step === "EDIT_SELECT") {
      if (textTrimmed === "EDIT_WHEN" || textTrimmed === "📅 When" || textLower === "when" || textLower.includes("when") || textLower.includes("time") || textLower.includes("date")) {
        activeSession.step = "WHEN";
        activeSession.editingField = "WHEN";
        saveMaintenanceSession(activeSession);
        return {
          text: `📅 When did the problem happen?\n\n(Current: "${activeSession.occurredAt || "Not specified"}")`,
          quick_replies: whenQuickReplies,
          session_step: "WHEN",
          is_maintenance_form: true
        };
      } else if (textTrimmed === "EDIT_LOCATION" || textTrimmed === "📍 Location" || textLower === "where" || textLower === "location" || textLower.includes("where") || textLower.includes("location")) {
        activeSession.step = "WHERE";
        activeSession.editingField = "WHERE";
        saveMaintenanceSession(activeSession);
        return {
          text: `📍 **Where is the problem located?**\n\n(Current: "${activeSession.location || "Not specified"}")`,
          quick_replies: whereQuickReplies,
          session_step: "WHERE",
          is_maintenance_form: true
        };
      } else if (textTrimmed === "EDIT_DESCRIPTION" || textTrimmed === "📝 Description" || textLower === "description" || textLower.includes("description") || textLower.includes("problem") || textLower.includes("issue")) {
        activeSession.step = "DESCRIPTION";
        activeSession.editingField = "DESCRIPTION";
        saveMaintenanceSession(activeSession);
        return {
          text: `📝 **Please describe the problem.**\n\n(Current: "${activeSession.description || "Not specified"}")`,
          quick_replies: descriptionQuickReplies,
          session_step: "DESCRIPTION",
          is_maintenance_form: true
        };
      } else if (textTrimmed === "EDIT_PHOTO" || textTrimmed === "📷 Photo" || textLower === "photo" || textLower.includes("photo") || textLower.includes("image") || textLower.includes("picture")) {
        activeSession.step = "PHOTO";
        activeSession.editingField = "PHOTO";
        saveMaintenanceSession(activeSession);
        return {
          text: `📷 **Would you like to attach a photo?**\n\n(Current: ${activeSession.photoAttached ? "Photo attached" : "No photo"})`,
          quick_replies: photoQuickReplies,
          session_step: "PHOTO",
          is_maintenance_form: true
        };
      } else {
        return {
          text: "✏️ **What would you like to edit?**\n\nPlease choose which information to change:",
          quick_replies: editSelectQuickReplies,
          session_step: "EDIT_SELECT",
          is_maintenance_form: true
        };
      }
    }
  }

  // Pre-analyze message intent
  const maintAnalysis = analyzeMaintenanceIntent(messageText);

  // =========================================================================
  // PRIORITY 1: BUTTON TRIGGERED OR NATURAL LANGUAGE MAINTENANCE REPORTING
  // =========================================================================
  const isMaintenanceButton = textTrimmed === "REPORT_MAINTENANCE" ||
    textTrimmed === "report_maintenance" ||
    textTrimmed === "🔧 Report Maintenance" ||
    textTrimmed === "🔧 Maintenance" ||
    textLower === "maintenance" ||
    textLower === "report maintenance" ||
    textLower === "repair";

  if (isMaintenanceButton) {
    const session: MaintenanceSession = {
      psid: senderPsid,
      tenantId,
      tenantName: tenantObj?.name,
      roomNumber: roomNum,
      step: "WHEN",
      updatedAt: Date.now()
    };
    saveMaintenanceSession(session);

    return {
      text: `🔧 **Maintenance Report**\n\nI can help you submit a maintenance request.\n\nPlease provide the following information:\n\n📅 When did the problem happen?`,
      quick_replies: whenQuickReplies,
      session_step: "WHEN",
      is_maintenance_form: true
    };
  }

  if (maintAnalysis.is_maintenance) {
    const extracted = extractMaintenanceDetailsFromText(messageText);
    const session: MaintenanceSession = {
      psid: senderPsid,
      tenantId,
      tenantName: tenantObj?.name,
      roomNumber: roomNum,
      occurredAt: extracted.occurredAt,
      location: extracted.location,
      description: extracted.description || textTrimmed,
      updatedAt: Date.now(),
      step: "WHEN"
    };

    if (!session.occurredAt) {
      session.step = "WHEN";
      saveMaintenanceSession(session);
      return {
        text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When did the problem start?`,
        quick_replies: whenQuickReplies,
        session_step: "WHEN",
        is_maintenance_form: true
      };
    } else if (!session.location) {
      session.step = "WHERE";
      saveMaintenanceSession(session);
      return {
        text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n\n📍 **Where is the problem located?**`,
        quick_replies: whereQuickReplies,
        session_step: "WHERE",
        is_maintenance_form: true
      };
    } else {
      session.step = "PHOTO";
      saveMaintenanceSession(session);
      return {
        text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n📍 Where: ${session.location}\n📝 Problem: ${session.description}\n\n📷 **Would you like to attach a photo?**`,
        quick_replies: photoQuickReplies,
        session_step: "PHOTO",
        is_maintenance_form: true
      };
    }
  }

  // Local Rule-Based Fallback Generator (Guaranteed reliable, fast, zero secrets)
  const generateLocalResponse = (msg: string): string => {
    const text = msg.toLowerCase().trim();

    // =========================================================================
    // PRIORITY 1: MAINTENANCE STATUS CHECK
    // =========================================================================
    if (maintAnalysis.is_status_query) {
      const tenantTickets = (db.maintenanceRequests || []).filter((t: any) => {
        return (tenantId && t.tenant_id === tenantId) ||
          (roomNum && roomNum !== "N/A" && roomNum !== "Guest/Unknown" && t.room_number === roomNum);
      });

      if (tenantTickets.length === 0) {
        return `ℹ️ *NO ACTIVE MAINTENANCE TICKETS*\n\nThere are currently no maintenance tickets on file for Room ${roomNum}.\n\nIf you have an issue that needs repair, simply describe the problem (e.g. *"My aircon is leaking"* or *"The toilet is clogged"*), and I will log it for you right away!`;
      }

      const recentTickets = [...tenantTickets].reverse().slice(0, 5);
      let statusReply = `🔧 *YOUR MAINTENANCE TICKETS (Room ${roomNum}):*\n\n`;
      recentTickets.forEach((t: any) => {
        const priorityEmoji = t.priority === "Critical" ? "🚨 CRITICAL" : t.priority === "High" ? "🔴 HIGH" : t.priority === "Medium" ? "🟡 MEDIUM" : "🟢 LOW";
        const statusText = t.status === "completed" ? "✅ Completed" : t.status === "in_progress" ? "🛠️ In Progress" : "⏳ Pending Admin Review";
        const dateStr = t.created_at ? new Date(t.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" }) : "Recently";
        statusReply += `• *Ticket ID:* \`${t.id}\` [${priorityEmoji}]\n` +
          `  *Category:* ${t.category}\n` +
          `  *Status:* ${statusText}\n` +
          `  *Reported:* ${dateStr}\n` +
          `  *Issue:* "${t.issue_description}"\n\n`;
      });
      statusReply += `Our property administration is monitoring all open tickets. If you have immediate safety concerns, please contact management directly.`;
      return statusReply;
    }

    // =========================================================================
    // PRIORITY 2: NATURAL-LANGUAGE MAINTENANCE REPORTING
    // (Handled via structured form above; fallback note if called directly)
    // =========================================================================
    if (maintAnalysis.is_maintenance) {
      return `🔧 *MAINTENANCE REPORTING*\n\nTo report a maintenance issue, please use the structured report options:\n• When did it happen?\n• Where is it located?\n• Description\n• Photo (optional)\n\nPlease tap the 🔧 *Report Maintenance* button below to begin!`;
    }

    // =========================================================================
    // PRIORITY 3: NON-MAINTENANCE INTENTS (LEDGER, PAYMENT, BALANCE, RULES)
    // =========================================================================

    // 1. TRANSACTION HISTORY & FINANCIAL LEDGER
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
        historyText += `🛡️ *DEPOSIT & ADVANCE ESCROW LEDGER:*\n`;
        if (tenantLedgers.length === 0) {
          historyText += `_No escrow adjustments recorded._\n\n`;
        } else {
          const recentLedgers = [...tenantLedgers].reverse().slice(0, 5);
          recentLedgers.forEach((l: any) => {
            const dateStr = new Date(l.created_at || Date.now()).toLocaleDateString("en-PH", { month: "short", day: "numeric", year: "numeric" });
            const typeLabel = l.type ? l.type.replace(/_/g, " ").toUpperCase() : "TRANSACTION";
            historyText += `• *${dateStr}* — ${typeLabel}\n  💵 ₱${Number(l.amount || 0).toLocaleString("en-US", { minimumFractionDigits: 2 })}${l.description ? ` (${l.description})` : ""}\n`;
          });
          historyText += `\n`;
        }

        historyText += `📄 *MONTHLY BILLING INVOICES:*\n`;
        if (tenantBills.length === 0) {
          historyText += `_No billing statements generated yet._\n\n`;
        } else {
          const recentBills = [...tenantBills].reverse().slice(0, 5);
          recentBills.forEach((b: any) => {
            const statusEmoji = b.payment_status === "paid" ? "✅ PAID" : b.payment_status === "overdue" ? "⚠️ OVERDUE" : "⏳ UNPAID";
            historyText += `• *${b.billing_month || "Statement"}* [${statusEmoji}]\n  Total: ₱${Number(b.total_amount || 0).toLocaleString("en-US")} (Due: ${b.due_date})\n`;
          });
          historyText += `\n`;
        }

        const curDep = tenantObj.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj.deposit || 0;
        const curAdv = tenantObj.advance_balance !== undefined ? tenantObj.advance_balance : (tenantObj.advance_payment || tenantObj.rent_amount || 0);
        historyText += `-----------------------------------\n` +
          `💰 *ACTIVE BALANCES:*\n` +
          `• Outstanding Dues: ₱${Number(outstandingBalance).toLocaleString("en-US")}\n` +
          `• Security Deposit Balance: ₱${Number(curDep).toLocaleString("en-US")}\n` +
          `• Advance Rent Balance: ₱${Number(curAdv).toLocaleString("en-US")}`;
      }

      return historyText;
    }

    // 2. SEND PAYMENT & PAYMENT CHANNELS
    if (text === "send_payment" || text === "pay" || text.includes("how to pay") || text.includes("payment method") || text.includes("pay rent") || text.includes("bank account") || text.includes("gcash") || text.includes("maya")) {
      let payMsg = `💳 *HOW TO SEND YOUR RENT PAYMENT*\n\n`;

      if (tenantObj) {
        payMsg += `👤 *Tenant:* ${tenantObj.name} (Room ${roomNum})\n` +
          `💵 *Current Amount Due:* ₱${Number(outstandingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
          `📅 *Due Date:* ${nextDueDate} ${nextDueMonth ? `(${nextDueMonth})` : ""}\n\n`;
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

    // 3. SUBMITTING PAYMENT REFERENCE
    if (text.startsWith("paid ") || (text.includes("ref") && (text.includes("gcash") || text.includes("bdo") || text.includes("bpi") || text.includes("transfer") || text.includes("payment")))) {
      const senderName = tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 6)})`;
      const senderRoom = tenantObj ? `Room ${roomNum}` : "Unlinked Room";

      logTransaction(db, {
        category: "payment",
        action: "create",
        title: "Payment Reference Submitted via Messenger",
        details: `Tenant ${senderName} (${senderRoom}) submitted payment reference: "${msg}". Awaiting admin verification and invoice clearing.`,
        tenant_id: tenantObj?.id || "guest",
        tenant_name: senderName,
        room_number: roomNum
      });

      if (!db.notifications) db.notifications = [];
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

    // 4. BALANCES, DUE DATES, ESCROWS
    if (text === "get_balance" || text === "balance" || text.includes("balance") || text.includes("due") || text.includes("how much") || text.includes("rent due") || text.includes("statement") || text.includes("bill") || text.includes("utility") || text.includes("utilities")) {
      if (!tenantObj) {
        return `🔒 *ACCOUNT VERIFICATION REQUIRED*\n\nTo view your live balances, deposit ledger, and due date, please link your tenant account:\n\n👉 Type: *link <contact_number>*\nExample: *link 09171234567*`;
      }

      const depBal = tenantObj.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj.deposit || 0;
      const advBal = tenantObj.advance_balance !== undefined ? tenantObj.advance_balance : (tenantObj.advance_payment || tenantObj.rent_amount || 0);

      return `💰 *LIVE FINANCIAL & ESCROW SUMMARY*\n` +
        `🏢 *${aptName}* — Room ${roomNum}\n` +
        `👤 *Tenant:* ${tenantObj.name}\n` +
        `-----------------------------------\n\n` +
        `💵 *CURRENT OUTSTANDING DUES:* ₱${Number(outstandingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        `📅 *Next Due Date:* ${nextDueDate} ${nextDueMonth ? `(${nextDueMonth})` : ""}\n` +
        `🏠 *Monthly Rent Rate:* ₱${Number(tenantObj.rent_amount || 0).toLocaleString("en-US")}/month\n\n` +
        `-----------------------------------\n` +
        `🛡️ *SECURITY DEPOSIT BALANCE:*\n` +
        `₱${Number(depBal).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        `_(Refundable escrow held against damages/unpaid utilities upon checkout)_\n\n` +
        `💳 *ADVANCE RENT BALANCE:*\n` +
        `₱${Number(advBal).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n` +
        `_(Prepaid rent available to apply towards future billing or final month stay)_\n\n` +
        `👉 To send payment, tap *💳 Send Payment* or type *pay*.`;
    }

    // 5. APARTMENT RULES & POLICIES
    if (text === "view_rules" || text.includes("rule") || text.includes("policy") || text.includes("policies") || text.includes("overnight") || text.includes("pet") || text.includes("noise") || text.includes("smoking")) {
      const rulesStr = rulesList.map((r: any, idx: number) => `${idx + 1}. *[${r.category || "General"}]* ${r.rule_text}`).join("\n\n");
      return `🏢 *APARTMENTPRO RULES & REGULATIONS:*\n\n${rulesStr || "1. Quiet hours observed between 10:00 PM and 7:00 AM.\n2. Keep common hallways clear at all times.\n3. Turn off air conditioning and lights when leaving your unit.\n4. No smoking inside apartment units."}`;
    }

    // 6. ANNOUNCEMENTS & UPDATES
    if (text === "view_announcements" || text.includes("announcement") || text.includes("news") || text.includes("update") || text.includes("schedule")) {
      const annStr = announcementsList.map((a: any) => `📢 *${a.title}*\n${a.content}\n_(Posted: ${new Date(a.created_at).toLocaleDateString()})_`).join("\n\n---\n\n");
      return `📢 *LATEST APARTMENTPRO ANNOUNCEMENTS:*\n\n${annStr || "No new announcements posted at this time. Everything is running smoothly!"}`;
    }

    // 7. TENANT PROFILE
    if (text.includes("profile") || text.includes("my account") || text.includes("who am i")) {
      if (tenantObj) {
        return `👤 *TENANT PROFILE:*\n- *Name:* ${tenantObj.name}\n- *Unit:* Room ${roomNum} (${aptName})\n- *Contact:* ${tenantObj.contact}\n- *Email:* ${tenantObj.email || "N/A"}\n- *Monthly Rent:* ₱${Number(tenantObj.rent_amount || 0).toLocaleString("en-US")}\n- *Status:* ${String(tenantObj.status || "active").toUpperCase()}`;
      } else {
        return "You are currently chatting as a Guest. To link your tenant profile, type:\n👉 link <your_contact_number>\nExample: link 09171234567";
      }
    }

    // Default conversational greeting & navigation menu
    return `👋 Hello! I am the **ApartmentPro Assistant**.\n\nHow can I help you today? Tap any of the quick action buttons below:\n\n• 🔧 *Report Maintenance* — Log a repair ticket (e.g. "My aircon is leaking")\n• 📋 *Transaction History* — View ledger & receipts\n• 💳 *Send Payment* — Payment channels & instructions\n• 💰 *Balances* — Live rent & utility summary\n• 📢 *Announcements* — Building news & advisories\n• 📜 *Apartment Rules* — Policies & guidelines\n\n👉 If you are a tenant, type: *link <your_contact_number>* (e.g. *link 09171234567*) to securely link your profile!`;
  };

  // If Maintenance Intent is detected, process it through the verified priority workflow!
  if (maintAnalysis.is_maintenance || maintAnalysis.is_status_query) {
    return generateLocalResponse(messageText);
  }

  // Try Gemini AI Generation with safety fallback for open conversation
  const ai = getAIClient();
  if (!ai) {
    return generateLocalResponse(messageText);
  }

  try {
    const rulesSummary = rulesList.map((r: any) => `- Rule: ${r.rule_text}`).join("\n");
    const annSummary = announcementsList.map((a: any) => `- [${a.title}]: ${a.content} (Posted: ${a.created_at})`).join("\n");

    const systemPrompt = `You are "ApartmentPro Assistant", a highly polished, helpful, and professional virtual property assistant for the ApartmentPro property management system.
You are assisting tenants and guests via Facebook Messenger.

Current Context:
${tenantContext}

Apartment Policies/Rules:
${rulesSummary || "Quiet hours from 10 PM to 7 AM. Keep corridors clean. Turn off AC when leaving."}

Active Announcements:
${annSummary || "No active announcements."}

CRITICAL DIRECTIVES:
1. MAINTENANCE REPORTING PRIORITY:
   - If the user is reporting any maintenance issue or physical problem in their unit (AC, plumbing, electrical, lock, wifi, leak, etc.):
     * DO NOT give generic AI advice or DIY repair tutorials for electrical or high hazard problems.
     * Set "is_maintenance": true.
     * Select "category" from: "Plumbing", "Electrical", "Internet", "Air Conditioning", "Furniture", "Cleaning", "Other".
     * Select "priority" from: "CRITICAL", "HIGH", "MEDIUM", "LOW".
     * Provide a clean summary in "description".
2. STATUS CHECK:
   - If the user asks for the status of their maintenance repair or ticket:
     * Set "is_status_query": true.
3. FINANCIAL PRIVACY:
   - If unverified/guest asks for personal balances/bills, ask them to link their account (link <contact_number>).
4. Return a clean JSON matching this schema:
{
  "reply": "Conversational reply text formatted in clean Markdown with emojis",
  "intent": "maintenance_report | maintenance_status | get_history | send_payment | get_balance | view_announcements | view_rules | view_profile | chat",
  "is_maintenance": boolean,
  "is_status_query": boolean,
  "category": "Plumbing | Electrical | Internet | Air Conditioning | Furniture | Cleaning | Other",
  "priority": "CRITICAL | HIGH | MEDIUM | LOW",
  "description": "Clean summary of maintenance problem"
}`;

    const generatePromise = ai.models.generateContent({
      model: "gemini-3.6-flash",
      contents: [{ role: "user", parts: [{ text: messageText }] }],
      config: {
        systemInstruction: systemPrompt,
        responseMimeType: "application/json",
        temperature: 0.2
      }
    });

    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Gemini timeout")), 3500));
    const response: any = await Promise.race([generatePromise, timeoutPromise]);
    const parsedRes = JSON.parse((response.text || "").trim());

    // If Gemini identified maintenance, start the structured maintenance form!
    if (parsedRes.is_maintenance || parsedRes.intent === "maintenance_report") {
      const desc = parsedRes.description || messageText;
      const extracted = extractMaintenanceDetailsFromText(desc);
      const session: MaintenanceSession = {
        psid: senderPsid,
        tenantId,
        tenantName: tenantObj?.name,
        roomNumber: roomNum,
        occurredAt: extracted.occurredAt,
        location: extracted.location,
        description: extracted.description || desc,
        updatedAt: Date.now(),
        step: "WHEN"
      };

      if (!session.occurredAt) {
        session.step = "WHEN";
        saveMaintenanceSession(session);
        return {
          text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When did the problem start?`,
          quick_replies: whenQuickReplies,
          session_step: "WHEN",
          is_maintenance_form: true
        };
      } else if (!session.location) {
        session.step = "WHERE";
        saveMaintenanceSession(session);
        return {
          text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n\n📍 **Where is the problem located?**`,
          quick_replies: whereQuickReplies,
          session_step: "WHERE",
          is_maintenance_form: true
        };
      } else {
        session.step = "PHOTO";
        saveMaintenanceSession(session);
        return {
          text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n📍 Where: ${session.location}\n📝 Problem: ${session.description}\n\n📷 **Would you like to attach a photo?**`,
          quick_replies: photoQuickReplies,
          session_step: "PHOTO",
          is_maintenance_form: true
        };
      }
    }

    if (parsedRes.is_status_query || parsedRes.intent === "maintenance_status") {
      return generateLocalResponse(messageText);
    }

    return parsedRes.reply || generateLocalResponse(messageText);
  } catch (error) {
    console.error("Gemini AI error or timeout, seamlessly using local rules engine:", error);
    return generateLocalResponse(messageText);
  }
}

// Unified query function for internal web app chatbot & external endpoints
export async function queryChatbotWithResult(
  messageText: string,
  tenantId: string | null,
  senderPsid: string = "web-client",
  attachmentUrl?: string
): Promise<{
  reply: string;
  intent: string;
  create_ticket?: boolean;
  ticket_details?: {
    category: MaintenanceCategory;
    priority: MaintenanceSeverity;
    description: string;
    ticket_id?: string;
    occurred_at?: string;
    location?: string;
    photo_url?: string;
  };
  suggested_replies?: string[];
  session_step?: string;
  is_maintenance_form?: boolean;
}> {
  const res = await processChatbotMessage(messageText, tenantId, senderPsid, attachmentUrl);
  const maint = analyzeMaintenanceIntent(messageText);

  if (typeof res === "object") {
    const suggestedReplies = res.quick_replies ? res.quick_replies.map((q: any) => q.title) : undefined;
    return {
      reply: res.text,
      intent: res.create_ticket ? "report_maintenance" : res.is_maintenance_form ? "report_maintenance_form" : "chat",
      create_ticket: res.create_ticket,
      ticket_details: res.ticket_details,
      suggested_replies: suggestedReplies,
      session_step: res.session_step,
      is_maintenance_form: res.is_maintenance_form
    };
  }

  if (maint.is_status_query) {
    return {
      reply: res,
      intent: "maintenance_status",
      suggested_replies: ["Report another issue", "💰 Check Rent Balance", "📜 Apartment Rules"]
    };
  }

  return {
    reply: res,
    intent: "chat",
    suggested_replies: ["🔧 Report Maintenance", "💰 Check Rent Balance", "📜 Apartment Rules"]
  };
}

// Master Messenger Webhook Event Processor
export async function handleMessengerWebhookEvent(webhook_event: any, webhookPageId?: string): Promise<void> {
  const senderPsid = webhook_event.sender?.id;
  if (!senderPsid) return;

  // Extract message text, button payload, or attachments
  let messageText = "";
  let attachmentUrl: string | undefined = undefined;

  if (webhook_event.message?.attachments && webhook_event.message.attachments.length > 0) {
    const firstAttachment = webhook_event.message.attachments[0];
    if (firstAttachment?.type === "image" && firstAttachment?.payload?.url) {
      attachmentUrl = firstAttachment.payload.url;
    }
  }

  if (webhook_event.message?.text) {
    messageText = webhook_event.message.text;
  } else if (webhook_event.message?.quick_reply?.payload) {
    messageText = webhook_event.message.quick_reply.payload;
  } else if (webhook_event.postback?.payload) {
    messageText = webhook_event.postback.payload;
  } else if (attachmentUrl) {
    messageText = attachmentUrl;
  } else if (webhook_event.message?.attachments) {
    messageText = "[Attachment/Media]";
  }

  console.log("===== MESSENGER MESSAGE RECEIVED =====");
  console.log(`Sender ID: ${senderPsid}`);
  console.log(`Message: ${messageText}`);
  if (attachmentUrl) console.log(`Attachment: ${attachmentUrl}`);

  // Safe Token Identity Diagnostic
  await runSafeTokenDiagnostic(webhookPageId);

  // Check DB for tenant linkage
  const db = readDB();
  db.tenants = db.tenants || [];
  let linkedTenant = db.tenants.find((t: any) => t.facebook_psid === senderPsid || t.messenger_psid === senderPsid);
  const textLower = messageText.toLowerCase().trim();

  // 1. Account linking workflow: "link <query>" or "verify <query>"
  if (textLower.startsWith("link ") || textLower.startsWith("verify ")) {
    const query = textLower.replace(/^(link|verify)\s+/, "").trim();
    const queryDigits = query.replace(/\D/g, "");

    const matchedTenant = db.tenants.find((t: any) => {
      const contactDigits = (t.contact || "").trim().replace(/\D/g, "");
      const matchContact = queryDigits.length >= 7 && contactDigits.includes(queryDigits);
      const matchId = t.id && t.id.toLowerCase() === query.toLowerCase();
      const matchName = t.name && t.name.toLowerCase().includes(query.toLowerCase()) && query.length >= 3;
      return matchContact || matchId || matchName;
    });

    if (matchedTenant) {
      matchedTenant.facebook_psid = senderPsid;
      matchedTenant.messenger_psid = senderPsid;
      writeDB(db);

      const room = (db.rooms || []).find((r: any) => r.id === matchedTenant.room_id);
      const roomNum = room ? room.room_number : "Unknown";

      await sendFacebookMessage(senderPsid, {
        text: `🎉 *Account Linked Successfully!*\n\nWelcome back, *${matchedTenant.name}* (Room ${roomNum})!\n\nYour Messenger account is now securely connected to your ApartmentPro tenant portal.\n\nYou can now use the 1-tap quick buttons below to check your live rent balances, view your ledger & deposit history, or report maintenance.`
      });
    } else {
      await sendFacebookMessage(senderPsid, {
        text: `❌ Sorry, we couldn't find a tenant record matching "${query}" in our directory.\n\nPlease type: *link <your_contact_number>*\nExample: *link 09171234567*`
      });
    }
    return;
  }

  // 2. Account unlinking workflow: "unlink" or "disconnect"
  if (textLower === "unlink" || textLower === "disconnect") {
    if (linkedTenant) {
      const oldName = linkedTenant.name;
      delete linkedTenant.facebook_psid;
      delete linkedTenant.messenger_psid;
      writeDB(db);
      await sendFacebookMessage(senderPsid, {
        text: `🚪 You have successfully unlinked your Facebook profile from ${oldName}'s tenant record.`
      });
    } else {
      await sendFacebookMessage(senderPsid, {
        text: "No tenant account is currently linked to this Facebook Profile."
      });
    }
    return;
  }

  // 3. Process chatbot message through the real ApartmentPro AI Engine
  try {
    const botReply = await processChatbotMessage(
      messageText,
      linkedTenant ? linkedTenant.id : null,
      senderPsid,
      attachmentUrl
    );
    if (typeof botReply === "string") {
      await sendFacebookMessage(senderPsid, { text: botReply });
    } else {
      await sendFacebookMessage(senderPsid, botReply);
    }
  } catch (err) {
    console.error("Failed to process chatbot reply:", err);
    await sendFacebookMessage(senderPsid, {
      text: "Sorry, I'm having trouble processing your request right now. Please try again later."
    });
  }
}
