import dotenv from "dotenv";
dotenv.config();
import { GoogleGenAI } from "@google/genai";
import { dbService } from "./dbService";
import type { MaintenanceRequest } from "../types";

// Meta App ID & Official Facebook Page for ApartmentPro
// Note: 1298546226679849 is the verified Facebook Page ID for ApartmentPro.
// 3246715018859879 is the Meta Application ID (App ID).
export const OFFICIAL_APP_ID = "3246715018859879";
export const OFFICIAL_PAGE_NAME = "ApartmentPro";
export const OFFICIAL_PAGE_ID = (() => {
  const envId = (process.env.FACEBOOK_PAGE_ID || process.env.PAGE_ID || "").trim();
  if (envId && envId !== OFFICIAL_APP_ID) return envId;
  return "1298546226679849";
})();
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

export const paymentMethodQuickReplies = [
  { content_type: "text", title: "📱 GCash", payload: "PAY_GCASH" },
  { content_type: "text", title: "🏦 Bank Transfer", payload: "PAY_BANK" },
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_PAYMENT" }
];

export const paymentCancelQuickReplies = [
  { content_type: "text", title: "❌ Cancel", payload: "CANCEL_PAYMENT" }
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

// Ensure dbService is initialized asynchronously in background
dbService.initialize().catch(err => {
  console.warn("dbService background initialization warning:", err?.message || err);
});

/**
 * Normalizes any phone number into canonical Philippine mobile format (digits only: 639XXXXXXXXX).
 * Supports:
 * - 09171234567 -> 639171234567
 * - +639171234567 -> 639171234567
 * - 639171234567 -> 639171234567
 * - 0917-123-4567 -> 639171234567
 * - 0917 123 4567 -> 639171234567
 * - (0917) 123-4567 -> 639171234567
 * - +63 (917) 123-4567 -> 639171234567
 * - 9171234567 -> 639171234567
 */
export function normalizePhoneNumber(rawPhone: string | null | undefined): string {
  if (!rawPhone || typeof rawPhone !== "string") return "";

  // 1. Trim whitespace
  const trimmed = rawPhone.trim();

  // 2. Remove all non-digit characters (spaces, hyphens, parentheses, pluses, dots, etc.)
  const digits = trimmed.replace(/\D/g, "");
  if (!digits) return "";

  // 3. International exit code format: 00639XXXXXXXXX (14 digits) -> 639XXXXXXXXX
  if (digits.startsWith("00639") && digits.length === 14) {
    return digits.slice(2);
  }

  // 4. Philippine domestic mobile format: 09XXXXXXXXX (11 digits) -> 639XXXXXXXXX
  if (digits.startsWith("09") && digits.length === 11) {
    return `63${digits.slice(1)}`;
  }

  // 5. Philippine international mobile format: 639XXXXXXXXX (12 digits)
  if (digits.startsWith("639") && digits.length === 12) {
    return digits;
  }

  // 6. 10-digit mobile format without leading zero: 9XXXXXXXXX (10 digits) -> 639XXXXXXXXX
  if (digits.startsWith("9") && digits.length === 10) {
    return `63${digits}`;
  }

  // Fallback: return remaining digits
  return digits;
}

/**
 * Checks if the normalized string is a valid Philippine mobile number (639XXXXXXXXX, 12 digits)
 */
export function isValidPhilippineMobile(normalizedNumber: string): boolean {
  if (!normalizedNumber || typeof normalizedNumber !== "string") return false;
  return /^639\d{9}$/.test(normalizedNumber);
}

/**
 * Safely masks phone numbers for production server diagnostic logging (e.g. 0917****567)
 */
export function maskPhoneNumber(phone: string | null | undefined): string {
  if (!phone || typeof phone !== "string") return "[empty]";
  const trimmed = phone.trim();
  if (trimmed.length <= 4) return "****";
  const head = trimmed.slice(0, 4);
  const tail = trimmed.slice(-3);
  return `${head}****${tail}`;
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
  const cleanToken = token.replace(/^["']|["']$/g, "").trim();
  if (!cleanToken) {
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

  // 1. Primary check via debug_token endpoint
  try {
    const debugRes = await fetch(`https://graph.facebook.com/debug_token?input_token=${encodeURIComponent(cleanToken)}&access_token=${encodeURIComponent(cleanToken)}`);
    const debugData = await debugRes.json();
    if (debugRes.ok && debugData?.data) {
      if (debugData.data.type === "PAGE") {
        isPageToken = true;
      }
      if (debugData.data.profile_id) {
        tokenPageId = String(debugData.data.profile_id);
      }
      if (debugData.data.application) {
        tokenPageName = debugData.data.application;
      }
    }
  } catch {}

  // 2. Fallback check via /me?fields=id,name
  if (!tokenPageId) {
    try {
      const meRes = await fetch(`https://graph.facebook.com/${graphVersion}/me?fields=id,name&access_token=${encodeURIComponent(cleanToken)}`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
      });
      const meData = await meRes.json();
      if (meRes.ok && meData.id) {
        tokenPageId = String(meData.id);
        tokenPageName = meData.name || null;
        isPageToken = true;
      }
    } catch {}
  }

  // 3. Fallback check via /me/conversations
  if (!tokenPageId) {
    try {
      const convRes = await fetch(`https://graph.facebook.com/${graphVersion}/me/conversations?fields=link,senders,participants&limit=1&access_token=${encodeURIComponent(cleanToken)}`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
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

  // 4. Fallback check via /me/messenger_profile
  if (!isPageToken) {
    try {
      const profRes = await fetch(`https://graph.facebook.com/${graphVersion}/me/messenger_profile?fields=get_started&access_token=${encodeURIComponent(cleanToken)}`, {
        headers: { Authorization: `Bearer ${cleanToken}` }
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
  console.log(`Meta Application ID: ${OFFICIAL_APP_ID}`);
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

    console.log(`Page IDs Match: ${matches ? "YES (IDs MATCH)" : (isOfficialPage ? "YES (Matches Official Page)" : "NO (MISMATCH DETECTED)")}`);
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

// Helper to safely split messages exceeding Meta's 2000 character limit
export function splitMessageIntoChunks(text: string, maxLength: number = 1900): string[] {
  if (!text || text.length <= maxLength) return [text || ""];
  const chunks: string[] = [];
  let remaining = text.trim();
  while (remaining.length > 0) {
    if (remaining.length <= maxLength) {
      chunks.push(remaining);
      break;
    }
    let splitIdx = remaining.lastIndexOf("\n\n", maxLength);
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = remaining.lastIndexOf("\n", maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = remaining.lastIndexOf(" ", maxLength);
    }
    if (splitIdx === -1 || splitIdx < maxLength / 2) {
      splitIdx = maxLength;
    }
    const chunk = remaining.substring(0, splitIdx).trim();
    if (chunk) chunks.push(chunk);
    remaining = remaining.substring(splitIdx).trim();
  }
  return chunks.length > 0 ? chunks : [text.substring(0, maxLength)];
}

// Send Message via Facebook Graph API with robust formatting, auth, and error diagnostics
export async function sendFacebookMessage(
  senderPsid: string,
  responsePayload: any,
  targetPageId?: string
): Promise<{ success: boolean; error?: string; message_id?: string; windowExpired?: boolean; code?: number; subcode?: number }> {
  const rawToken = (process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  const PAGE_ACCESS_TOKEN = rawToken.replace(/^["']|["']$/g, "").trim();

  if (!PAGE_ACCESS_TOKEN) {
    console.warn("FACEBOOK_PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKEN is not configured. Cannot send reply to Messenger user.");
    return { success: false, error: "Facebook Page Access Token is not configured on the server." };
  }

  if (!senderPsid || typeof senderPsid !== "string" || !senderPsid.trim()) {
    console.warn("sendFacebookMessage called with missing or invalid senderPsid:", senderPsid);
    return { success: false, error: "Invalid recipient PSID." };
  }
  const cleanPsid = senderPsid.trim();

  let msgObj: any = typeof responsePayload === "string" ? { text: responsePayload } : { ...responsePayload };

  // Convert inline base64 data URLs to binary fileBuffer so Meta doesn't reject data: URLs
  if (msgObj.attachment?.payload?.url && typeof msgObj.attachment.payload.url === "string") {
    const rawUrl = msgObj.attachment.payload.url.trim();
    if (rawUrl.startsWith("data:image/")) {
      const match = rawUrl.match(/^data:(image\/[a-zA-Z0-9+.-]+);base64,(.+)$/);
      if (match) {
        const mimeType = match[1];
        msgObj.fileBuffer = Buffer.from(match[2], "base64");
        msgObj.fileName = `attachment_${Date.now()}.${mimeType.includes("png") ? "png" : "jpg"}`;
        delete msgObj.attachment;
      }
    } else if (rawUrl.startsWith("/")) {
      const baseUrl = process.env.APP_URL || (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : "");
      if (baseUrl) {
        msgObj.attachment.payload.url = `${baseUrl.replace(/\/$/, "")}${rawUrl}`;
      }
    }
  }

  // Format message payload and include 1-tap quick action buttons if none provided
  if (!msgObj.quick_replies && msgObj.text && !msgObj.attachment && !msgObj.fileBuffer) {
    msgObj.quick_replies = standardQuickReplies;
  }

  // Sanitize quick replies strictly per Meta specifications:
  // - Maximum 13 items
  // - title: 1-20 characters
  // - payload: 1-1000 characters
  // - content_type: "text"
  // - Must NOT be empty array
  let sanitizedQuickReplies: any[] | undefined = undefined;
  if (Array.isArray(msgObj.quick_replies) && msgObj.quick_replies.length > 0) {
    const validReplies = msgObj.quick_replies
      .filter((q: any) => q && (q.title || q.payload))
      .slice(0, 13)
      .map((q: any) => ({
        content_type: "text",
        title: String(q.title || q.payload || "Option").trim().substring(0, 20),
        payload: String(q.payload || q.title || "OPTION").trim().substring(0, 1000)
      }))
      .filter((q: any) => q.title.length > 0);
    if (validReplies.length > 0) {
      sanitizedQuickReplies = validReplies;
    }
  }

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
  // The Send API endpoint strictly uses /{PAGE_ID}/messages for the verified Page
  const effectivePageId = (() => {
    if (targetPageId && targetPageId.trim() && targetPageId.trim() !== OFFICIAL_APP_ID) {
      return targetPageId.trim();
    }
    return OFFICIAL_PAGE_ID;
  })();

  const url = `https://graph.facebook.com/${graphVersion}/${effectivePageId}/messages?access_token=${encodeURIComponent(PAGE_ACCESS_TOKEN)}`;

  // Direct Binary Multipart Upload (Send generated receipts/images directly)
  if (msgObj.fileBuffer) {
    try {
      const formData = new FormData();
      formData.append("messaging_type", "RESPONSE");
      formData.append("recipient", JSON.stringify({ id: cleanPsid }));

      const messagePayload: any = {
        attachment: {
          type: "image",
          payload: { is_reusable: true }
        }
      };
      if (sanitizedQuickReplies) {
        messagePayload.quick_replies = sanitizedQuickReplies;
      }
      formData.append("message", JSON.stringify(messagePayload));

      const fileName = msgObj.fileName || "attachment.png";
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
        const rawErr = resData?.error || resData || {};
        const errorBody: any = typeof rawErr === "object" ? { ...rawErr } : { message: String(rawErr) };
        delete errorBody.access_token;
        delete errorBody.token;
        delete errorBody.secret;

        console.error("===== FACEBOOK SEND RESPONSE ERROR =====");
        console.error("HTTP STATUS:", res.status);
        console.error("META ERROR:", JSON.stringify(errorBody, null, 2));
        console.error("Facebook API Error Code:", errorBody.code || res.status);
        console.error("Facebook API Error Subcode:", errorBody.error_subcode);
        console.error("Facebook API Error Message:", errorBody.message || "Unknown error");
        console.error("Facebook API Error Type:", errorBody.type);
        console.error("Facebook Trace ID:", errorBody.fbtrace_id);
        const safeErrorMsg = errorBody.message || `Facebook Graph API responded with status ${res.status}`;
        return { success: false, error: safeErrorMsg };
      } else {
        console.log(`Successfully sent multipart media to Facebook Messenger user: ${cleanPsid}`);
        return { success: true, message_id: resData?.message_id };
      }
    } catch (err: any) {
      console.error("Error in sendFacebookMessage multipart upload:", err);
      return { success: false, error: err?.message || "Error dispatching multipart message to Facebook" };
    }
  }

  // Handle text messages with automatic chunking if > 2000 characters
  let textContent = typeof msgObj.text === "string" ? msgObj.text.trim() : "";
  if (!textContent && !msgObj.attachment) {
    textContent = "Hello! How can I assist you with your apartment today?";
  }

  const textChunks = splitMessageIntoChunks(textContent, 1900);

  // If multiple chunks, deliver intermediate chunks first
  for (let i = 0; i < textChunks.length - 1; i++) {
    const chunkBody = {
      messaging_type: "RESPONSE",
      recipient: { id: cleanPsid },
      message: { text: textChunks[i] }
    };
    try {
      await fetch(url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${PAGE_ACCESS_TOKEN}`
        },
        body: JSON.stringify(chunkBody)
      });
    } catch (chunkErr) {
      console.warn("Failed sending intermediate chunk:", chunkErr);
    }
  }

  // Prepare final message payload strictly per Meta rules:
  // Meta Send API does NOT allow message[text] and message[attachment] in the same payload
  const finalChunkText = textChunks[textChunks.length - 1] || textContent;
  const validMessagePayload: any = {};
  if (msgObj.attachment) {
    validMessagePayload.attachment = msgObj.attachment;
    if (sanitizedQuickReplies) {
      validMessagePayload.quick_replies = sanitizedQuickReplies;
    }
  } else {
    if (finalChunkText) {
      validMessagePayload.text = finalChunkText;
    }
    if (sanitizedQuickReplies) {
      validMessagePayload.quick_replies = sanitizedQuickReplies;
    }
  }
  if (msgObj.metadata) {
    validMessagePayload.metadata = msgObj.metadata;
  }

  const requestBody: any = {
    messaging_type: "RESPONSE",
    recipient: {
      id: cleanPsid
    },
    message: validMessagePayload
  };

  try {
    let res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${PAGE_ACCESS_TOKEN}`
      },
      body: JSON.stringify(requestBody)
    });

    let resText = await res.text();
    let resData: any;
    try {
      resData = JSON.parse(resText);
    } catch {
      resData = resText;
    }

    // Under Meta Messenger Platform policies, responses within the 24-hour window use standard messaging_type: "RESPONSE".
    // If the 24-hour messaging window has expired, no deprecated tag or illegal retry will be attempted.

    if (!res.ok) {
      const rawErr = resData?.error || resData || {};
      const errorBody: any = typeof rawErr === "object" ? { ...rawErr } : { message: String(rawErr) };
      delete errorBody.access_token;
      delete errorBody.token;
      delete errorBody.secret;

      const code = Number(errorBody.code || res.status);
      const subcode = Number(errorBody.error_subcode || 0);
      const errMsg = String(errorBody.message || "").toLowerCase();
      // Meta subcode 1893063 means the conversation/recipient is currently
      // restricted from receiving messages. This is NOT the same as a
      // 24-hour-window expiry and must never trigger a deprecated tag retry.
      const recipientRestricted = code === 10 && subcode === 1893063;
      const isWindowExpired = 
        subcode === 2018278 || 
        subcode === 2018001 || 
        subcode === 1893061 || 
        errMsg.includes("outside of allowed window") || 
        errMsg.includes("window expired") || 
        errMsg.includes("24-hour") ||
        errMsg.includes("deprecated message tag");

      console.error("===== FACEBOOK SEND RESPONSE ERROR =====");
      console.error("HTTP STATUS:", res.status);
      console.error("Facebook API Error Code:", code);
      console.error("Facebook API Error Subcode:", subcode);
      console.error("Facebook API Error Message:", errorBody.message || "Unknown error");
      if (isWindowExpired) {
        console.warn("ℹ️ Messenger 24-hour window has expired for recipient. No message tag will be attempted.");
      }
      console.error("Attempted Page ID:", effectivePageId);
      console.error("Attempted Recipient PSID:", cleanPsid ? `${cleanPsid.slice(0, 5)}***` : "unknown");
      if (recipientRestricted) {
        console.error("🚨 META RECIPIENT RESTRICTION (1893063): Meta is temporarily restricting message sends to this conversation or recipient. No retry will be attempted.");
        if (errorBody.error_user_title) console.error("Error User Title:", errorBody.error_user_title);
        if (errorBody.error_user_msg) console.error("Error User Message:", errorBody.error_user_msg);
      }
      console.error("Payload Summary:", JSON.stringify({
        hasText: Boolean(validMessagePayload.text),
        textLength: validMessagePayload.text?.length,
        hasAttachment: Boolean(validMessagePayload.attachment),
        quickRepliesCount: validMessagePayload.quick_replies?.length
      }));
      const safeErrorMsg = errorBody.message || `Facebook Graph API responded with status ${res.status}`;
      return { 
        success: false, 
        windowExpired: isWindowExpired,
        recipientRestricted,
        error: safeErrorMsg,
        code,
        subcode 
      };
    } else {
      console.log(`Successfully sent message to Facebook Messenger user: ${cleanPsid ? `${cleanPsid.slice(0, 5)}***` : "user"}`);
      return { success: true, message_id: resData?.message_id, windowExpired: false };
    }
  } catch (error: any) {
    console.error("Error calling Facebook Graph API:", error);
    return { success: false, windowExpired: false, error: error?.message || "Network error communicating with Facebook Graph API" };
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
  // Normalize common Messenger chat punctuation/spacing so informal Bisaya
  // phrases such as "naguba among suga te", "ga-leak ang gripo", and
  // "dili mo andar among aircon" are recognized consistently.
  const normalized = lower
    .replace(/[\u2018\u2019\u201c\u201d]/g, "'")
    .replace(/[.,!?;:()[\]{}]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

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
  
  // Specific equipment & failure indicators. These include common Bisaya/Cebuano
  // words and informal chat spellings because Messenger tenants may naturally
  // mix Cebuano, English, and Taglish in the same message.
  const acKeywords = [
    "aircon", "air con", "air-con", "air conditioner", "air conditioning", "ac", "cooling",
    "freon", "refrigerant", "compressor", "split type", "not cooling", "warm air", "ac leak", "ac dripping",
    "dili mobugnaw", "dili mo bugnaw", "di mobugnaw", "di mo bugnaw", "init ang aircon", "guba ang aircon",
    "naguba ang aircon", "aircon guba", "aircon nag leak", "ga leak ang aircon", "naga leak ang aircon",
    "ga tulo ang aircon", "nag tulo ang aircon"
  ];
  const plumbingKeywords = [
    "toilet", "cr", "comfort room", "bathroom", "shower", "sink", "faucet", "tap", "pipe", "pipes",
    "water", "leak", "leaking", "leaks", "leaked", "drip", "dripping", "clog", "clogged", "drain",
    "drainage", "overflow", "overflowing", "bidet", "burst", "bursting", "flooding", "flood", "flooded",
    "sewage", "sewer", "no water", "low water pressure", "ceiling", "water coming from",
    "gripo", "gripo", "lababo", "tubo", "tubig", "tagas", "nagtulo", "ga tulo", "nag tulo",
    "ga leak", "naga leak", "nag leak", "barado", "bara", "barado ang cr", "barado ang banyo",
    "walay tubig", "wala nay tubig", "hinay ang tubig", "kusog ang agas"
  ];
  const electricalKeywords = [
    "electricity", "electrical", "power", "power outage", "blackout", "brownout", "light", "lights", "bulb",
    "flicker", "flickering", "flickers", "dim", "socket", "outlet", "plug", "breaker", "circuit breaker",
    "tripped", "wire", "wires", "wiring", "spark", "sparks", "sparking", "sparked", "short circuit",
    "shock", "smoke", "burning smell", "no power", "fuse",
    "suga", "suga sa kwarto", "suga sa banyo", "suga sa kusina", "kuryente", "kurente", "outlet",
    "wala nay suga", "walay suga", "dili mosiga", "di mosiga", "dili na mosiga", "di na mosiga",
    "dili mo andar", "dili moandar", "di mo andar", "di moandar", "wala moandar", "wala nay kuryente",
    "walay kuryente", "nag spark", "ga spark", "naga spark", "nagsiga", "wala nagsiga", "dili nagsiga"
  ];
  const internetKeywords = [
    "wifi", "wi-fi", "internet", "router", "modem", "connection", "slow connection", "lan cable",
    "no internet", "network", "signal", "hinay ang wifi", "hinay among wifi", "wala internet",
    "walay internet", "dili mo connect", "di mo connect", "dili maka connect", "di maka connect", "hinay ang net"
  ];
  const furnitureKeywords = [
    "door", "door knob", "doorknob", "door lock", "padlock", "deadbolt", "key", "lock", "locked out",
    "window", "window latch", "window lock", "bed", "mattress", "chair", "table", "desk", "cabinet",
    "cupboard", "closet", "drawer", "shelf", "sofa", "furniture", "hinge",
    "pultahan", "kandado", "bintana", "katre", "lingkuranan", "lamisa", "aparador", "kabinet",
    "guba ang pultahan", "guba ang kandado", "dili ma lock", "dili ma-lock", "di ma lock", "nabungkag"
  ];
  const cleaningKeywords = [
    "cleaning", "clean", "trash", "garbage", "rubbish", "pest", "pests", "cockroach", "cockroaches",
    "roach", "roaches", "ant", "ants", "bug", "bugs", "rodent", "rat", "rats", "mice", "mouse",
    "infestation", "mold", "mildew", "bad odor", "hugaw", "hugaw kaayo", "daghan basura", "basura",
    "ipis", "ilaga", "langaw", "baho", "amag"
  ];
  const generalMaintWords = [
    "broken", "not working", "stopped working", "keeps going out", "repair", "fix", "damaged", "malfunction",
    "leaking", "clogged", "technician", "problem in my room", "issue in my room",
    "guba", "naguba", "guba among", "guba ang", "nadaot", "nadamage", "dili moandar", "dili mo andar",
    "di moandar", "di mo andar", "wala moandar", "wala nay", "walay", "dili na", "di na",
    "problema", "problema sa among", "problema sa amo", "naay problema", "naa koy problema",
    "tabang", "paayo", "ipaayo", "ayoa", "ipa-repair", "maintenance", "repairman", "technician",
    "te guba", "te naguba", "maam guba", "sir guba", "te ga leak", "maam ga leak", "sir ga leak"
  ];

  // Strong semantic fallback for informal Bisaya/Cebuano maintenance reports.
  // This intentionally uses combinations of a problem/action word + a physical
  // apartment object, rather than requiring the English word "maintenance".
  const bisayaProblemWords = [
    "guba", "naguba", "nadaot", "nabungkag", "nabuak", "nabali",
    "barado", "nabara", "tagas", "nagtulo", "ga tulo", "nag tulo",
    "ga leak", "nag leak", "naga leak", "dili moandar", "di moandar",
    "dili mo andar", "di mo andar", "wala moandar", "wala nay", "walay",
    "dili na", "di na", "problema", "naay problema", "naa koy problema",
    "paayo", "ipaayo", "ayoa", "ipa repair", "ipa-repair"
  ];
  const bisayaMaintenanceObjects = [
    "suga", "kuryente", "kurente", "outlet", "socket", "wire", "breaker",
    "gripo", "lababo", "tubo", "tubig", "banyo", "cr", "toilet", "shower",
    "aircon", "wifi", "internet", "pultahan", "kandado", "bintana",
    "katre", "lingkuranan", "lamisa", "aparador", "kabinet", "tiles",
    "kisame", "salog", "dingding", "kwarto", "room"
  ];
  const hasBisayaProblemWord = bisayaProblemWords.some(word => normalized.includes(word));
  const hasBisayaMaintenanceObject = bisayaMaintenanceObjects.some(word => normalized.includes(word));
  const hasBisayaMaintenancePattern = hasBisayaProblemWord && hasBisayaMaintenanceObject;

  const hasAc = acKeywords.some(kw => matchesKeyword(kw));
  const hasPlumbing = plumbingKeywords.some(kw => matchesKeyword(kw));
  const hasElectrical = electricalKeywords.some(kw => matchesKeyword(kw));
  const hasInternet = internetKeywords.some(kw => matchesKeyword(kw));
  const hasFurniture = furnitureKeywords.some(kw => matchesKeyword(kw));
  const hasCleaning = cleaningKeywords.some(kw => matchesKeyword(kw));
  const hasGeneralProblem = generalMaintWords.some(kw => matchesKeyword(kw));

  // Determine if maintenance intent
  const isMaintenance = isDirectMaintButton || hasAc || hasPlumbing || hasElectrical || hasInternet || hasFurniture || hasCleaning || hasGeneralProblem || hasBisayaMaintenancePattern;

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
  if (hasAc || /\b(aircon|air con|air conditioner)\b/.test(normalized)) {
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
  } else if (hasBisayaMaintenancePattern) {
    // Bisaya fallback category mapping when the English keyword lists do not
    // catch a regional/informal spelling.
    if (/\b(suga|kuryente|kurente|outlet|socket|wire|breaker)\b/.test(normalized)) category = "Electrical";
    else if (/\b(gripo|lababo|tubo|tubig|banyo|cr|toilet|shower|tagas|tulo)\b/.test(normalized)) category = "Plumbing";
    else if (/\b(wifi|internet)\b/.test(normalized)) category = "Internet";
    else if (/\b(pultahan|kandado|bintana|katre|lingkuranan|lamisa|aparador|kabinet|tiles|kisame|salog|dingding)\b/.test(normalized)) category = "Furniture";
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
  description: string,
  senderPsid?: string
): any | null {
  const openTickets = (db.maintenanceRequests || []).filter((t: any) => {
    const matchesTenant = (tenantId && t.tenant_id === tenantId) ||
      (senderPsid && t.messenger_psid === senderPsid) ||
      (roomNum && roomNum !== "N/A" && roomNum !== "Guest/Unknown" && roomNum !== "Unknown" && t.room_number === roomNum);
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
  follow_up_image_url?: string;
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

export async function getMaintenanceSession(psid: string): Promise<MaintenanceSession | null> {
  // Check memory store first for zero-latency lookups
  let session = memorySessionStore.get(psid);
  if (!session) {
    session = await dbService.getMaintenanceSession(psid);
    if (session) {
      memorySessionStore.set(psid, session);
    }
  }

  if (!session) return null;

  // Expire session after 2 hours of inactivity
  if (Date.now() - (session.updatedAt || 0) > 2 * 60 * 60 * 1000) {
    await clearMaintenanceSession(psid);
    return null;
  }
  return session;
}

export async function saveMaintenanceSession(session: MaintenanceSession): Promise<void> {
  session.updatedAt = Date.now();
  memorySessionStore.set(session.psid, { ...session });
  await dbService.saveMaintenanceSession(session.psid, { ...session });
}

export async function clearMaintenanceSession(psid: string): Promise<void> {
  memorySessionStore.delete(psid);
  await dbService.clearMaintenanceSession(psid);
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

// Persists remote Facebook Messenger attachment URLs to Firebase Storage / local uploads
export async function persistMessengerAttachmentUrl(attachmentUrl: string): Promise<string> {
  if (!attachmentUrl || typeof attachmentUrl !== "string") return "";
  const trimmed = attachmentUrl.trim();
  if (trimmed.startsWith("/uploads/") || trimmed.startsWith("data:")) {
    return trimmed;
  }

  // If remote URL, attempt download to ensure permanent retention
  if (trimmed.startsWith("http://") || trimmed.startsWith("https://")) {
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 8000);
      const res = await fetch(trimmed, {
        signal: controller.signal,
        headers: {
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
        }
      });
      clearTimeout(timeout);

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        if (buffer.length > 0) {
          const contentType = res.headers.get("content-type") || "image/jpeg";
          const ext = contentType.includes("png") ? ".png" : ".jpg";
          const fileName = `maint_photo_${Date.now()}${ext}`;
          const base64Data = `data:${contentType};base64,${buffer.toString("base64")}`;
          const uploadRes = await dbService.uploadFile(fileName, base64Data);
          if (uploadRes && uploadRes.url) {
            console.log(`✅ Successfully persisted Messenger image to ${uploadRes.storage}`);
            return uploadRes.url;
          }
        }
      }
    } catch (err: any) {
      console.warn("⚠️ Failed to download/persist Facebook attachment image, falling back to original URL:", err?.message || err);
    }
  }

  return trimmed;
}

// Renders the review screen before ticket creation (Step 6)
export function formatReviewSummary(session: MaintenanceSession, justAttachedPhoto: boolean = false): ChatbotReplyPayload {
  const occurredAt = session.occurredAt || "Not specified";
  const location = session.location || "Not specified";
  const description = session.description || "Not specified";
  const hasPhoto = Boolean(session.photoAttached && session.photoUrl);
  const photoStr = hasPhoto ? "✅ Attached" : "No photo attached";

  const prefix = justAttachedPhoto
    ? "📷 Photo received successfully.\n\nYour photo has been attached to the maintenance report.\n\n"
    : "Here is your maintenance report:\n\n";

  const summaryText = `${prefix}🔧 MAINTENANCE REPORT\n\n` +
    `📅 When:\n${occurredAt}\n\n` +
    `📍 Where:\n${location}\n\n` +
    `📝 Problem:\n${description}\n\n` +
    `📷 Photo:\n${photoStr}\n\n` +
    `Please review your report before submitting.`;

  return {
    text: summaryText,
    quick_replies: reviewQuickReplies,
    session_step: "REVIEW",
    is_maintenance_form: true
  };
}

export async function createMaintenanceTicketRecord(
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
): Promise<{ success: boolean; ticketId?: string; reply: string }> {
  // Validate and sanitize inputs
  let validPhotoUrl = "";
  if (photoUrl && typeof photoUrl === "string") {
    const trimmed = photoUrl.trim();
    if (trimmed.startsWith("http://") || trimmed.startsWith("https://") || trimmed.startsWith("/uploads/")) {
      validPhotoUrl = trimmed;
    } else if (/^data:image\/(?:jpeg|jpg|png|webp);base64,/i.test(trimmed) && trimmed.length <= 950000) {
      // Small inline image fallback for serverless deployments without Storage credentials.
      // Keep the size below Firestore's 1 MiB document limit with room for other fields.
      validPhotoUrl = trimmed;
    }
  }
  const hasPhoto = Boolean(validPhotoUrl.length > 0);

  const sanitizedDesc = description.replace(/<[^>]*>?/gm, "").trim();
  const sanitizedLocation = (location || (roomNum && roomNum !== "N/A" ? `Room ${roomNum}` : "Apartment Unit")).replace(/<[^>]*>?/gm, "").trim();
  const sanitizedOccurred = (occurredAt || "Recently").replace(/<[^>]*>?/gm, "").trim();

  // Generate Clean Ticket ID matching required specification: MT-XXXXXX
  const ticketId = `MT-${Math.floor(100000 + Math.random() * 900000)}`;
  const tenantName = tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`;
  const sanitizedRoom = roomNum && roomNum !== "N/A" && roomNum !== "Guest/Unknown" ? roomNum : "Unknown";
  const resolvedRoomId = tenantObj?.room_id || (sanitizedRoom !== "Unknown" ? `room-${sanitizedRoom}` : "");
  const nowIso = new Date().toISOString();

  // 1. Create Ticket in database matching all required fields
  const newMaint: MaintenanceRequest = {
    id: ticketId,
    ticketId: ticketId,
    room_id: resolvedRoomId,
    room_number: sanitizedRoom,
    roomNumber: sanitizedRoom,
    tenant_id: tenantId || "guest",
    tenantId: tenantId || "guest",
    tenant_name: tenantName,
    tenantName: tenantName,
    category,
    priority,
    severity: priority,
    when: sanitizedOccurred,
    occurred_at: sanitizedOccurred,
    occurredAt: sanitizedOccurred,
    where: sanitizedLocation,
    location: sanitizedLocation,
    description: sanitizedDesc,
    issue_description: sanitizedDesc,
    photoAttached: hasPhoto,
    photo_attached: hasPhoto,
    photoUrl: validPhotoUrl,
    photo_url: validPhotoUrl,
    photo: validPhotoUrl,
    messenger_psid: senderPsid,
    status: "pending" as const,
    created_at: nowIso,
    createdAt: nowIso,
    updated_at: nowIso,
    updatedAt: nowIso
  };

  // Directly persist and await write to Cloud Firestore collection 'maintenanceRequests'
  const saveSuccess = await dbService.saveMaintenanceRequestToFirestore(newMaint);
  if (!saveSuccess) {
    console.error(`[Maintenance Error] Failed to persist ticket ${ticketId} to Cloud Firestore.`);
    return {
      success: false,
      reply: "⚠️ We couldn't save your maintenance report right now.\n\nPlease try submitting it again."
    };
  }

  // Safe server-side diagnostic logging (no sensitive information exposed)
  console.log("===== FIRESTORE MAINTENANCE WRITE =====");
  console.log("Source: Cloud Firestore");
  console.log("Collection: maintenanceRequests");
  console.log(`Ticket ID: ${ticketId}`);
  console.log(`Tenant: ${tenantObj ? tenantObj.name.substring(0, 2) + "****" : "Guest"}`);
  console.log(`Room: ${sanitizedRoom}`);
  console.log(`Priority: ${priority}`);
  console.log(`Category: ${category}`);
  console.log(`Photo attached: ${hasPhoto ? "YES" : "NO"}`);
  console.log("Status: SAVED_TO_FIRESTORE");
  console.log("=======================================");

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

  const photoStr = hasPhoto ? "Attached" : "No photo";
  const displayRoom = sanitizedRoom.startsWith("Room") ? sanitizedRoom : `Room ${sanitizedRoom}`;
  const adminMessage = `${adminTitle}\n\n` +
    `Tenant: ${tenantName}\n` +
    `Room: ${displayRoom}\n\n` +
    `Category: ${category}\n` +
    `Severity: ${priority}\n\n` +
    `📅 When:\n${sanitizedOccurred}\n\n` +
    `📍 Location:\n${sanitizedLocation}\n\n` +
    `📝 Problem:\n${sanitizedDesc}\n\n` +
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
    created_at: nowIso
  };
  await dbService.upsertDoc("notifications", newNotif.id, newNotif);

  // 3. Log in Transaction Audit Trail
  const newLog = {
    category: "maintenance" as const,
    action: "create" as const,
    title: `Maintenance Request [${priority}] - ${category}`,
    details: `Ticket ${ticketId} created for ${tenantName} (${displayRoom}): "${sanitizedDesc}". Priority: ${priority}. Location: ${sanitizedLocation}. Occurred: ${sanitizedOccurred}. Photo: ${photoStr}.`,
    tenant_id: tenantId || "guest",
    tenant_name: tenantName,
    room_number: sanitizedRoom,
    performed_by: "Messenger AI Bot"
  };
  const logEntry = logTransaction(db, newLog);
  await dbService.upsertDoc("transactionLogs", logEntry.id, logEntry);

  // 4. Format Tenant Confirmation Response strictly to specifications (Step 12)
  const photoNote = hasPhoto ? "📷 Photo attached to the report." : "📷 No photo attached.";
  let tenantConfirmation = `🔧 **Maintenance Report Submitted**\n\n` +
    `Ticket ID: ${ticketId}\n\n` +
    `📍 Location: ${sanitizedLocation}\n` +
    `📝 Issue: ${sanitizedDesc}\n` +
    `🏷️ Category: ${category}\n` +
    `⚠️ Priority: ${priority}\n\n` +
    `The administration has been notified.\n\n` +
    `${photoNote}`;

  if (priority === "CRITICAL") {
    tenantConfirmation += `\n\n⚠️ **IMMEDIATE SAFETY ADVISORY:**\n` +
      `Please keep a safe distance from the hazard. Do NOT touch any damaged wiring, outlets, or flooded electrical items. If safe, switch off your unit's main circuit breaker or shut off the main water valve. If there is active smoke or fire, evacuate immediately and call emergency services (911).`;
  }

  return { success: true, ticketId, reply: tenantConfirmation };
}

interface PaymentSession {
  psid: string;
  tenantId: string;
  method: "GCASH" | "BANK";
  step: "METHOD_SELECTED";
  submissionId?: string;
  updatedAt: number;
}

function sanitizePaymentReference(raw: string): string {
  return raw.replace(/[<>\"'`]/g, "").replace(/\s+/g, " ").trim().slice(0, 80);
}

function isPlausiblePaymentReference(value: string): boolean {
  const normalized = value.replace(/^reference\s*(number)?\s*[:#-]?\s*/i, "")
    .replace(/^transaction\s*(number|no\.?)*\s*[:#-]?\s*/i, "")
    .replace(/^ref\s*[:#-]?\s*/i, "")
    .trim();
  return /[A-Za-z0-9]{6,40}/.test(normalized) && normalized.length <= 80;
}

async function getPaymentSession(psid: string): Promise<PaymentSession | null> {
  const session = await dbService.getPaymentSession(psid);
  if (!session) return null;
  if (Date.now() - Number(session.updatedAt || 0) > 2 * 60 * 60 * 1000) {
    await dbService.clearPaymentSession(psid);
    return null;
  }
  return session as PaymentSession;
}

async function savePaymentSession(session: PaymentSession): Promise<void> {
  await dbService.savePaymentSession(session.psid, session);
}

async function clearPaymentSession(psid: string): Promise<void> {
  await dbService.clearPaymentSession(psid);
}

async function persistPaymentReceipt(attachmentUrl: string): Promise<string> {
  if (!attachmentUrl || !/^https?:\/\//i.test(attachmentUrl)) return "";
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const res = await fetch(attachmentUrl, { signal: controller.signal });
    clearTimeout(timeout);
    if (!res.ok) return "";

    const contentType = (res.headers.get("content-type") || "").split(";")[0].toLowerCase();
    if (!contentType.startsWith("image/")) return "";

    const buffer = Buffer.from(await res.arrayBuffer());
    const maxBytes = 5 * 1024 * 1024;
    if (!buffer.length || buffer.length > maxBytes) return "";

    const ext = contentType.includes("png") ? ".png" : contentType.includes("webp") ? ".webp" : ".jpg";
    const rawBase64 = buffer.toString("base64");
    // Persist receipts in Firestore chunks so the admin portal can read them even when
    // Messenger webhook and admin website run on different hosts. No temporary /tmp or
    // local filesystem URL is used for payment evidence.
    const receiptId = `rcpt-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const saved = await dbService.savePaymentReceipt(receiptId, contentType, rawBase64);
    if (!saved) return "";
    return `/api/payments/receipts/${encodeURIComponent(receiptId)}`;
  } catch (err: any) {
    console.warn("Payment receipt persistence failed:", err?.message || err);
    return "";
  }
}

function paymentMethodDetails(method: "GCASH" | "BANK"): string {
  if (method === "GCASH") {
    const name = process.env.APARTMENTPRO_GCASH_NAME || "ApartmentPro Property Management";
    const number = process.env.APARTMENTPRO_GCASH_NUMBER || "NOT CONFIGURED";
    return `📱 *GCASH PAYMENT*\n\n*Account Name:* ${name}\n*GCash Number:* ${number}\n\nPlease double-check the recipient details before sending.\n\nAfter payment, reply with either:\n• 🧾 your *transaction/reference number*, or\n• 📸 a *screenshot/photo of your payment receipt*.\n\n⚠️ Your payment will remain *PENDING VERIFICATION* until management confirms it.`;
  }

  const bank = process.env.APARTMENTPRO_BANK_NAME || "BANK NAME NOT CONFIGURED";
  const accountName = process.env.APARTMENTPRO_BANK_ACCOUNT_NAME || "ApartmentPro Property Management";
  const accountNumber = process.env.APARTMENTPRO_BANK_ACCOUNT_NUMBER || "NOT CONFIGURED";
  return `🏦 *BANK TRANSFER*\n\n*Bank:* ${bank}\n*Account Name:* ${accountName}\n*Account Number:* ${accountNumber}\n\nPlease double-check the recipient details before sending.\n\nAfter payment, reply with either:\n• 🧾 your *transaction/reference number*, or\n• 📸 a *screenshot/photo of your payment receipt*.\n\n⚠️ Your payment will remain *PENDING VERIFICATION* until management confirms it.`;
}

function paymentMethodQrUrl(method: "GCASH" | "BANK"): string {
  const value = method === "GCASH" ? process.env.APARTMENTPRO_GCASH_QR_URL : process.env.APARTMENTPRO_BANK_QR_URL;
  return typeof value === "string" && /^https?:\/\//i.test(value.trim()) ? value.trim() : "";
}

async function recordPaymentAdminNotice(submission: any): Promise<void> {
  const ref = String(submission.reference || "");
  const maskedRef = ref ? `${ref.slice(0, Math.max(0, ref.length - 4)).replace(/./g, "*")}${ref.slice(-4)}` : "Receipt image attached";
  const methodLabel = submission.method === "GCASH" ? "GCash" : "Bank Transfer";
  const message = `💳 Payment confirmation received from ${submission.tenant_name} (Room ${submission.room_number}) via ${methodLabel}. Reference: ${maskedRef}. Status: PENDING VERIFICATION.`;

  await dbService.upsertDoc("notifications", `notif-pay-${submission.id}`, {
    tenant_id: submission.tenant_id,
    tenant_name: submission.tenant_name,
    message,
    type: "general",
    status: "sent",
    channel: "in_app",
    created_at: new Date().toISOString()
  });

  await dbService.upsertDoc("transactionLogs", `log-pay-${submission.id}`, {
    category: "payment",
    action: "payment",
    title: "Messenger Payment Confirmation Submitted",
    details: message,
    tenant_id: submission.tenant_id,
    tenant_name: submission.tenant_name,
    room_number: submission.room_number,
    performed_by: "Messenger Bot"
  });
}

// Core ApartmentPro Chatbot Engine
export async function processChatbotMessage(
  messageText: string,
  tenantId: string | null,
  senderPsid: string,
  attachmentUrl?: string,
  hasUnsupportedAttachment?: boolean
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
    // SECURITY: resolve authenticated tenant from live Firestore, not the stale/local
    // in-memory fallback. This is critical for Vercel/Cloud Run serverless runtimes.
    try {
      await dbService.ensureInitialized();
      const liveTenants = await dbService.getLiveTenants();
      tenantObj = liveTenants.find((t: any) => t.id === tenantId) || null;
    } catch (err) {
      console.error("Failed to load authenticated tenant from live Firestore:", err);
      tenantObj = null;
    }

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
  const activeSession = await getMaintenanceSession(senderPsid);
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
      await clearMaintenanceSession(senderPsid);
      return {
        text: "Maintenance report cancelled. No ticket was created.",
        quick_replies: standardQuickReplies,
        is_maintenance_form: false
      };
    }

    // 0B. Step: WHEN
    if (activeSession.step === "WHEN") {
      activeSession.occurredAt = textTrimmed || activeSession.occurredAt || "Recently";

      if (activeSession.editingField === "WHEN") {
        activeSession.editingField = null;
        activeSession.step = "REVIEW";
        await saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      }

      activeSession.step = "WHERE";
      await saveMaintenanceSession(activeSession);
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
        activeSession.location = textTrimmed || activeSession.location || "Room";
      }

      if (activeSession.editingField === "WHERE") {
        activeSession.editingField = null;
        activeSession.step = "REVIEW";
        await saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      }

      activeSession.step = "DESCRIPTION";
      await saveMaintenanceSession(activeSession);
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
      if (textLower !== "same" && textLower !== "same as above" && textLower !== "keep" && textLower !== "continue" && textTrimmed) {
        activeSession.description = textTrimmed;
      }
      if (attachmentUrl) {
        const persistedUrl = await persistMessengerAttachmentUrl(attachmentUrl);
        activeSession.photoUrl = persistedUrl || attachmentUrl;
        activeSession.photoAttached = true;
      }

      if (activeSession.editingField === "DESCRIPTION") {
        activeSession.editingField = null;
        activeSession.step = "REVIEW";
        await saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession);
      }

      activeSession.step = "PHOTO";
      await saveMaintenanceSession(activeSession);
      return {
        text: "📷 Would you like to attach a photo?",
        quick_replies: photoQuickReplies,
        session_step: "PHOTO",
        is_maintenance_form: true
      };
    }

    // 0E. Step: PHOTO
    if (activeSession.step === "PHOTO") {
      // 1. Check for unsupported attachment
      if (hasUnsupportedAttachment) {
        await saveMaintenanceSession(activeSession);
        return {
          text: "📷 Please send an image/photo of the maintenance problem, or choose Skip Photo.",
          quick_replies: photoQuickReplies,
          session_step: "PHOTO",
          is_maintenance_form: true
        };
      }

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

      // Tenant sends photo: extract, validate exists, persist image, store in session, advance to REVIEW
      if (attachmentUrl) {
        const finalPhotoUrl = await persistMessengerAttachmentUrl(attachmentUrl);
        activeSession.photoUrl = finalPhotoUrl || attachmentUrl;
        activeSession.photoAttached = true;
        activeSession.step = "REVIEW";
        activeSession.editingField = null;
        await saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession, true);
      } else if (isSkip) {
        // Tenant chooses Skip Photo: continue normally to REVIEW without photo
        activeSession.photoUrl = undefined;
        activeSession.photoAttached = false;
        activeSession.step = "REVIEW";
        activeSession.editingField = null;
        await saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession, false);
      } else if (isAttachPrompt) {
        await saveMaintenanceSession(activeSession);
        return {
          text: "📷 Please send the photo of the problem here.",
          quick_replies: photoQuickReplies,
          session_step: "PHOTO",
          is_maintenance_form: true
        };
      } else {
        // Any other text input without image: proceed to REVIEW as skip
        activeSession.photoUrl = undefined;
        activeSession.photoAttached = false;
        activeSession.step = "REVIEW";
        activeSession.editingField = null;
        await saveMaintenanceSession(activeSession);
        return formatReviewSummary(activeSession, false);
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
          await saveMaintenanceSession(activeSession);
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
        const liveRequests = await dbService.getLiveMaintenanceRequests();
        db.maintenanceRequests = liveRequests;
        const openDuplicate = findOpenDuplicateTicket(db, tenantId, roomNum, category, finalDesc, senderPsid);
        if (openDuplicate) {
          await clearMaintenanceSession(senderPsid);

          const notifMsg = `ℹ️ Tenant Follow-up: Room ${roomNum} sent an update regarding open ticket [${openDuplicate.id}]: "${finalDesc}"`;
          const followNotif = {
            id: `notif-followup-${Date.now()}`,
            tenant_id: tenantId || "guest",
            tenant_name: tenantObj?.name || "Guest",
            message: notifMsg,
            type: "general" as const,
            status: "sent" as const,
            channel: "in_app" as const,
            created_at: new Date().toISOString()
          };
          await dbService.upsertDoc("notifications", followNotif.id, followNotif);

          const followLog = {
            category: "maintenance" as const,
            action: "update" as const,
            title: `Tenant Follow-Up on Ticket ${openDuplicate.id}`,
            details: `Tenant ${tenantObj?.name || "Guest"} (Room ${roomNum}) sent update for open ticket ${openDuplicate.id}: "${finalDesc}". Location: ${finalLocation}. Occurred: ${finalOccurred}.`,
            tenant_id: tenantId || "guest",
            tenant_name: tenantObj?.name || "Guest",
            room_number: roomNum,
            performed_by: "Messenger AI Bot"
          };
          const followLogEntry = logTransaction(db, followLog);
          await dbService.upsertDoc("transactionLogs", followLogEntry.id, followLogEntry);

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
        const ticketResult = await createMaintenanceTicketRecord(
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

        if (!ticketResult.success) {
          // If Firestore persistence fails, preserve session for retry
          return {
            text: ticketResult.reply,
            quick_replies: reviewQuickReplies,
            session_step: "REVIEW",
            is_maintenance_form: true
          };
        }

        await clearMaintenanceSession(senderPsid);

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
        await saveMaintenanceSession(activeSession);
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
        await saveMaintenanceSession(activeSession);
        return {
          text: `📅 When did the problem happen?\n\n(Current: "${activeSession.occurredAt || "Not specified"}")`,
          quick_replies: whenQuickReplies,
          session_step: "WHEN",
          is_maintenance_form: true
        };
      } else if (textTrimmed === "EDIT_LOCATION" || textTrimmed === "📍 Location" || textLower === "where" || textLower === "location" || textLower.includes("where") || textLower.includes("location")) {
        activeSession.step = "WHERE";
        activeSession.editingField = "WHERE";
        await saveMaintenanceSession(activeSession);
        return {
          text: `📍 **Where is the problem located?**\n\n(Current: "${activeSession.location || "Not specified"}")`,
          quick_replies: whereQuickReplies,
          session_step: "WHERE",
          is_maintenance_form: true
        };
      } else if (textTrimmed === "EDIT_DESCRIPTION" || textTrimmed === "📝 Description" || textLower === "description" || textLower.includes("description") || textLower.includes("problem") || textLower.includes("issue")) {
        activeSession.step = "DESCRIPTION";
        activeSession.editingField = "DESCRIPTION";
        await saveMaintenanceSession(activeSession);
        return {
          text: `📝 **Please describe the problem.**\n\n(Current: "${activeSession.description || "Not specified"}")`,
          quick_replies: descriptionQuickReplies,
          session_step: "DESCRIPTION",
          is_maintenance_form: true
        };
      } else if (textTrimmed === "EDIT_PHOTO" || textTrimmed === "📷 Photo" || textLower === "photo" || textLower.includes("photo") || textLower.includes("image") || textLower.includes("picture")) {
        activeSession.step = "PHOTO";
        activeSession.editingField = "PHOTO";
        await saveMaintenanceSession(activeSession);
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
    await saveMaintenanceSession(session);

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
      await saveMaintenanceSession(session);
      return {
        text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When did the problem start?`,
        quick_replies: whenQuickReplies,
        session_step: "WHEN",
        is_maintenance_form: true
      };
    } else if (!session.location) {
      session.step = "WHERE";
      await saveMaintenanceSession(session);
      return {
        text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n\n📍 **Where is the problem located?**`,
        quick_replies: whereQuickReplies,
        session_step: "WHERE",
        is_maintenance_form: true
      };
    } else {
      session.step = "PHOTO";
      await saveMaintenanceSession(session);
      return {
        text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n📍 Where: ${session.location}\n📝 Problem: ${session.description}\n\n📷 **Would you like to attach a photo?**`,
        quick_replies: photoQuickReplies,
        session_step: "PHOTO",
        is_maintenance_form: true
      };
    }
  }

  // Local Rule-Based Fallback Generator (Guaranteed reliable, fast, zero secrets)
  const generateLocalResponse = async (msg: string): Promise<ChatbotReplyPayload | string> => {
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
    // PAYMENT METHOD / RECEIPT WORKFLOW
    // SECURITY: Only linked tenants can initiate or submit payment confirmations.
    // Receipts/references are stored as pending verification; no payment is auto-posted.
    // =========================================================================
    const paymentSession = await getPaymentSession(senderPsid);
    const isPaymentMethodSelection = textLower === "pay_gcash" || textLower === "pay_bank" ||
      textLower === "gcash" || textLower === "bank transfer" || textLower === "bank";
    const isPaymentCancel = textLower === "cancel_payment" || textLower === "❌ cancel";

    if (isPaymentCancel && paymentSession) {
      if (paymentSession.submissionId) {
        await dbService.updatePaymentSubmission(paymentSession.submissionId, {
          status: "cancelled",
          cancelled_at: new Date().toISOString(),
          cancellation_reason: "Tenant cancelled payment submission"
        });
      }
      await clearPaymentSession(senderPsid);
      return { text: "Payment submission cancelled. No payment was recorded.", quick_replies: standardQuickReplies };
    }

    if (isPaymentMethodSelection) {
      if (!tenantObj) {
        return `🔒 *ACCOUNT VERIFICATION REQUIRED*\n\nFor your financial security, you must link your ApartmentPro tenant account before submitting a payment.\n\nType: *link <contact_number>*\nExample: *link 09171234567*`;
      }

      const method: "GCASH" | "BANK" = textLower === "pay_bank" || textLower === "bank" || textLower === "bank transfer" ? "BANK" : "GCASH";
      const submissionId = `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const paymentIntent = {
        id: submissionId,
        tenant_id: tenantObj.id,
        messenger_psid: senderPsid,
        tenant_name: tenantObj.name,
        room_number: roomNum,
        method,
        reference: "",
        receipt_url: "",
        status: "awaiting_proof",
        amount_due: Number(outstandingBalance || 0),
        submitted_at: new Date().toISOString(),
        source: "messenger"
      };
      const intentSaved = await dbService.savePaymentSubmissionToFirestore(paymentIntent);
      if (!intentSaved) {
        return { text: "⚠️ We couldn't start your payment submission right now. Please try again.", quick_replies: standardQuickReplies };
      }
      await recordPaymentAdminNotice({ ...paymentIntent, status: "awaiting_proof" });
      await savePaymentSession({ psid: senderPsid, tenantId: tenantObj.id, method, step: "METHOD_SELECTED", submissionId, updatedAt: Date.now() });
      const qrUrl = paymentMethodQrUrl(method);
      return {
        text: paymentMethodDetails(method),
        quick_replies: paymentCancelQuickReplies,
        ...(qrUrl ? { follow_up_image_url: qrUrl } : {})
      };
    }

    if (paymentSession && tenantObj && paymentSession.tenantId === tenantObj.id) {
      if (attachmentUrl) {
        const receiptUrl = await persistPaymentReceipt(attachmentUrl);
        if (!receiptUrl) {
          return {
            text: "⚠️ I couldn't securely save that payment receipt. Please send the screenshot again as an image (JPG, PNG, or WEBP) under 5 MB.",
            quick_replies: paymentCancelQuickReplies
          };
        }

        const submission = {
          id: paymentSession.submissionId || `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          tenant_id: tenantObj.id,
          messenger_psid: senderPsid,
          tenant_name: tenantObj.name,
          room_number: roomNum,
          method: paymentSession.method,
          reference: "",
          receipt_url: receiptUrl,
          status: "pending_verification",
          amount_due: Number(outstandingBalance || 0),
          submitted_at: new Date().toISOString(),
          source: "messenger"
        };
        const saved = await dbService.savePaymentSubmissionToFirestore(submission);
        if (!saved) {
          return { text: "⚠️ We couldn't save your payment receipt right now. Please try again.", quick_replies: paymentCancelQuickReplies };
        }
        await recordPaymentAdminNotice(submission);
        await clearPaymentSession(senderPsid);
        return {
          text: `✅ *PAYMENT RECEIPT RECEIVED*\n\nThank you, *${tenantObj.name}*. Your ${paymentSession.method === "GCASH" ? "GCash" : "bank"} receipt was securely submitted.\n\n🧾 Status: *PENDING VERIFICATION*\n📅 Submitted: ${new Date().toLocaleString("en-PH")}\n\nManagement will verify the transaction before updating your official ledger.`,
          quick_replies: standardQuickReplies
        };
      }

      const reference = sanitizePaymentReference(textTrimmed);
      if (isPlausiblePaymentReference(reference)) {
        const submission = {
          id: paymentSession.submissionId || `pay-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
          tenant_id: tenantObj.id,
          messenger_psid: senderPsid,
          tenant_name: tenantObj.name,
          room_number: roomNum,
          method: paymentSession.method,
          reference,
          receipt_url: "",
          status: "pending_verification",
          amount_due: Number(outstandingBalance || 0),
          submitted_at: new Date().toISOString(),
          source: "messenger"
        };
        const saved = await dbService.savePaymentSubmissionToFirestore(submission);
        if (!saved) {
          return { text: "⚠️ We couldn't save your payment reference right now. Please try again.", quick_replies: paymentCancelQuickReplies };
        }
        await recordPaymentAdminNotice(submission);
        await clearPaymentSession(senderPsid);
        return {
          text: `✅ *PAYMENT REFERENCE RECEIVED*\n\nThank you, *${tenantObj.name}*.\n\n🧾 Reference: *${reference}*\n💳 Method: *${paymentSession.method === "GCASH" ? "GCash" : "Bank Transfer"}*\n📌 Status: *PENDING VERIFICATION*\n\nManagement will verify the transaction before updating your official ledger.`,
          quick_replies: standardQuickReplies
        };
      }

      return {
        text: "🧾 Please send your payment transaction/reference number, or attach a screenshot/photo of your payment receipt.\n\nFor security, payment status will only be updated after management verification.",
        quick_replies: paymentCancelQuickReplies
      };
    }

    // =========================================================================
    // PRIORITY 3: NON-MAINTENANCE INTENTS (LEDGER, PAYMENT, BALANCE, RULES)
    // =========================================================================

    // 1. TRANSACTION HISTORY & FINANCIAL LEDGER
    if (text === "get_history" || text === "history" || text === "📋 history" || text.includes("transaction history") || text.includes("my transactions") || text.includes("ledger history") || text.includes("payment history")) {
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

    // 2. SEND PAYMENT — require the tenant to choose a payment method first.
    if (text === "send_payment" || text === "pay" || text === "💳 send payment" || text.includes("how to pay") || text.includes("payment method") || text.includes("pay rent")) {
      if (!tenantObj) {
        return `🔒 *ACCOUNT VERIFICATION REQUIRED*\n\nFor your financial security, please link your ApartmentPro tenant account before accessing payment instructions.\n\nType: *link <contact_number>*\nExample: *link 09171234567*`;
      }
      return {
        text: `💳 *HOW WOULD YOU LIKE TO PAY?*\n\n👤 *Tenant:* ${tenantObj.name} (Room ${roomNum})\n💵 *Current Amount Due:* ₱${Number(outstandingBalance).toLocaleString("en-US", { minimumFractionDigits: 2 })}\n📅 *Due Date:* ${nextDueDate}\n\nPlease choose your payment method:`,
        quick_replies: paymentMethodQuickReplies
      };
    }

    // 3. LEGACY PAYMENT REFERENCE FORMAT
    // Accept `paid ... ref ...` only for linked tenants, but require method context.
    if (text.startsWith("paid ")) {
      if (!tenantObj) {
        return `🔒 *ACCOUNT VERIFICATION REQUIRED*\n\nPlease link your tenant account before submitting payment information.`;
      }
      return `🧾 Please tap *💳 Send Payment* first, choose *GCash* or *Bank Transfer*, then send your transaction/reference number or receipt screenshot.\n\nThis keeps your payment method and submission securely associated with your account.`;
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
    return await generateLocalResponse(messageText);
  }

  // Try Gemini AI Generation with safety fallback for open conversation
  const ai = getAIClient();
  if (!ai) {
    return await generateLocalResponse(messageText);
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
1. MULTI-LANGUAGE MAINTENANCE UNDERSTANDING:
   - Understand English, Bisaya/Cebuano, Taglish, and mixed Bisaya-English naturally.
   - Do NOT require exact English keywords or the word "maintenance".
   - Interpret the meaning/context of informal Messenger messages, including common Cebuano words such as "guba", "naguba", "suga", "gripo", "lababo", "tubo", "tagas", "barado", "pultahan", "kandado", "bintana", "kuryente", "walay", "wala nay", "dili moandar", "di moandar", "ga leak", "ga tulo", and "problema".
   - Example: "naguba among suga te" means the tenant is reporting a broken/non-working light and MUST be treated as a maintenance report.
   - Example: "guba ang gripo" means a plumbing maintenance issue.
   - Example: "di moandar ang aircon" means an air-conditioning maintenance issue.
   - Example: "ga leak among lababo" means a plumbing maintenance issue.
   - Preserve the tenant's original language in the stored description whenever possible; use the AI interpretation only for intent/category/priority.
2. MAINTENANCE REPORTING PRIORITY:
   - If the user is reporting any maintenance issue or physical problem in their unit (AC, plumbing, electrical, lock, wifi, leak, etc.), regardless of language:
     * DO NOT give generic AI advice or DIY repair tutorials for electrical or high hazard problems.
     * Set "is_maintenance": true.
     * Select "category" from: "Plumbing", "Electrical", "Internet", "Air Conditioning", "Furniture", "Cleaning", "Other".
     * Select "priority" from: "CRITICAL", "HIGH", "MEDIUM", "LOW".
     * Provide a clean summary in "description".
3. STATUS CHECK:
   - If the user asks for the status of their maintenance repair or ticket:
     * Set "is_status_query": true.
4. FINANCIAL PRIVACY:
   - If unverified/guest asks for personal balances/bills, ask them to link their account (link <contact_number>).
5. Return a clean JSON matching this schema:
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
        await saveMaintenanceSession(session);
        return {
          text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When did the problem start?`,
          quick_replies: whenQuickReplies,
          session_step: "WHEN",
          is_maintenance_form: true
        };
      } else if (!session.location) {
        session.step = "WHERE";
        await saveMaintenanceSession(session);
        return {
          text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n\n📍 **Where is the problem located?**`,
          quick_replies: whereQuickReplies,
          session_step: "WHERE",
          is_maintenance_form: true
        };
      } else {
        session.step = "PHOTO";
        await saveMaintenanceSession(session);
        return {
          text: `🔧 **Maintenance Report**\n\nI detected a maintenance issue.\n\n📅 When: ${session.occurredAt}\n📍 Where: ${session.location}\n📝 Problem: ${session.description}\n\n📷 **Would you like to attach a photo?**`,
          quick_replies: photoQuickReplies,
          session_step: "PHOTO",
          is_maintenance_form: true
        };
      }
    }

    if (parsedRes.is_status_query || parsedRes.intent === "maintenance_status") {
      return await generateLocalResponse(messageText);
    }

    return parsedRes.reply || (await generateLocalResponse(messageText));
  } catch (error) {
    console.error("Gemini AI error or timeout, seamlessly using local rules engine:", error);
    return await generateLocalResponse(messageText);
  }
}

// Unified query function for internal web app chatbot & external endpoints
export async function queryChatbotWithResult(
  messageText: string,
  tenantId: string | null,
  senderPsid: string = "web-client",
  attachmentUrl?: string,
  hasUnsupportedAttachment?: boolean
): Promise<{
  reply: string;
  intent: string;
  create_ticket?: boolean;
  follow_up_image_url?: string;
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
  const res = await processChatbotMessage(messageText, tenantId, senderPsid, attachmentUrl, hasUnsupportedAttachment);
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

  // Extract Messenger attachments without requiring message.text.
  // Meta normally sends message.attachments[], but accept the singular attachment
  // shape as a defensive compatibility path for webhook/runtime transformations.
  const rawAttachments = webhook_event.message?.attachments;
  const singularAttachment = webhook_event.message?.attachment;
  const attachments = Array.isArray(rawAttachments)
    ? rawAttachments
    : (singularAttachment ? [singularAttachment] : []);
  const imageAttachment = attachments.find(
    (attachment: any) =>
      (attachment?.type === "image" || attachment?.type === "photo") &&
      typeof attachment?.payload?.url === "string" &&
      attachment.payload.url.trim().length > 0
  );
  const unsupportedAttachment = attachments.find(
    (attachment: any) => attachment.type !== "image"
  );
  const hasUnsupportedAttachment = Boolean(unsupportedAttachment && !imageAttachment);

  const attachmentUrl: string | undefined = imageAttachment?.payload?.url;
  let messageText = "";

  // SECURITY/ROUTING: Messenger quick-reply payloads are authoritative action
  // identifiers. Meta may also include the visible button title in
  // message.text (for example, "📋 History"). If text is checked first, the
  // server loses the payload (GET_HISTORY/SEND_PAYMENT/etc.) and falls back to
  // the generic assistant greeting. Always prefer the signed-in action payload
  // over the human-readable button label.
  if (webhook_event.message?.quick_reply?.payload) {
    messageText = String(webhook_event.message.quick_reply.payload).trim();
  } else if (webhook_event.postback?.payload) {
    messageText = String(webhook_event.postback.payload).trim();
  } else if (webhook_event.message?.text) {
    messageText = webhook_event.message.text;
  } else if (attachments.length > 0 && !imageAttachment) {
    messageText = "[Unsupported Attachment]";
  }

  // If there is neither text nor attachments, ignore event (e.g. read receipts or delivery confirmations)
  if (!messageText && !attachmentUrl && attachments.length === 0) {
    return;
  }

  console.log("===== MESSENGER MESSAGE RECEIVED =====");
  console.log(`Sender ID: ${senderPsid}`);
  console.log(`Message: ${messageText || "[No Text]"}`);
  if (attachmentUrl) {
    console.log("Attachment: [Image attachment received]");
    console.log(`Attachment count: ${attachments.length}`);
    console.log(`Attachment type: ${String(imageAttachment?.type || "image")}`);
  }
  if (hasUnsupportedAttachment) {
    console.log(`Unsupported Attachment detected: ${String(unsupportedAttachment?.type || "unknown")}`);
  }

  // Safe Token Identity Diagnostic
  await runSafeTokenDiagnostic(webhookPageId);

  // Check live Cloud Firestore for tenant linkage (primary production source)
  await dbService.ensureInitialized();
  const liveTenants = await dbService.getLiveTenants();
  let linkedTenant = liveTenants.find((t: any) => t.facebook_psid === senderPsid || t.messenger_psid === senderPsid);
  if (linkedTenant) {
    const interactionTime = new Date().toISOString();
    linkedTenant.last_messenger_interaction_at = interactionTime;
    linkedTenant.last_interaction_at = interactionTime;
    dbService.upsertDoc("tenants", linkedTenant.id, {
      last_messenger_interaction_at: interactionTime,
      last_interaction_at: interactionTime
    }).catch(() => {});
  }
  const textLower = messageText.toLowerCase().trim();

  // 1. Account linking workflow: "link <contact_number>" or "verify <contact_number>"
  if (/^(?:link|verify)(?:[\s:]|$)/i.test(textLower)) {
    const rawInput = textLower.replace(/^(?:link|verify)\s*[:\s]?\s*/i, "").trim();
    const normalizedInput = normalizePhoneNumber(rawInput);

    // Validate Philippine mobile number
    if (!isValidPhilippineMobile(normalizedInput)) {
      await sendFacebookMessage(senderPsid, {
        text: `❌ Please enter a valid Philippine mobile number.\n\nExample:\nlink 09171234567`
      }, webhookPageId);
      return;
    }

    const matchedTenant = liveTenants.find((t: any) => {
      const storedContact = t.contact || t.contact_number || t.phone || t.phone_number || "";
      return normalizePhoneNumber(storedContact) === normalizedInput;
    });

    // Requirement 8: Safe server-side diagnostic logging
    console.log("===== FIRESTORE TENANT LOOKUP =====");
    console.log("Source: Cloud Firestore");
    console.log("Collection: tenants");
    console.log(`Records found: ${liveTenants.length}`);
    console.log(`Input normalized: ${maskPhoneNumber(normalizedInput)}`);
    console.log(`Match found: ${matchedTenant ? "YES" : "NO"}`);
    console.log("===================================");

    if (matchedTenant) {
      // Persist PSID directly to live Cloud Firestore
      await dbService.updateTenantPsidInFirestore(matchedTenant.id, senderPsid);
      matchedTenant.facebook_psid = senderPsid;
      matchedTenant.messenger_psid = senderPsid;

      const db = readDB();
      const room = (db.rooms || []).find((r: any) => r.id === matchedTenant.room_id);
      const roomNum = room ? room.room_number : (matchedTenant.room_id ? matchedTenant.room_id.replace(/^room-/, "") : "Unknown");

      await sendFacebookMessage(senderPsid, {
        text: `🎉 *Account Linked Successfully!*\n\nWelcome back, *${matchedTenant.name}* (Room ${roomNum})!\n\nYour Messenger account is now securely connected to your ApartmentPro tenant portal.\n\nYou can now use the ApartmentPro services below.`,
        quick_replies: standardQuickReplies
      }, webhookPageId);
    } else {
      await sendFacebookMessage(senderPsid, {
        text: `❌ Sorry, we couldn't find a tenant record matching "${rawInput}" in our directory.\n\nPlease type: *link <your_contact_number>*\nExample: *link 09171234567*`
      }, webhookPageId);
    }
    return;
  }

  // 2. Account unlinking workflow: "unlink" or "disconnect"
  if (textLower === "unlink" || textLower === "disconnect") {
    if (linkedTenant) {
      const oldName = linkedTenant.name;
      await dbService.unlinkTenantPsidInFirestore(linkedTenant.id);
      delete linkedTenant.facebook_psid;
      delete linkedTenant.messenger_psid;
      await sendFacebookMessage(senderPsid, {
        text: `🚪 You have successfully unlinked your Facebook profile from ${oldName}'s tenant record.`
      }, webhookPageId);
    } else {
      await sendFacebookMessage(senderPsid, {
        text: "No tenant account is currently linked to this Facebook Profile."
      }, webhookPageId);
    }
    return;
  }

  // 3. Process chatbot message through the real ApartmentPro AI Engine
  try {
    const botReply = await processChatbotMessage(
      messageText,
      linkedTenant ? linkedTenant.id : null,
      senderPsid,
      attachmentUrl,
      hasUnsupportedAttachment
    );
    if (typeof botReply === "string") {
      await sendFacebookMessage(senderPsid, { text: botReply }, webhookPageId);
    } else {
      const replyPayload: any = { ...botReply };
      const followUpImageUrl = typeof replyPayload.follow_up_image_url === "string"
        ? replyPayload.follow_up_image_url.trim()
        : "";
      delete replyPayload.follow_up_image_url;

      await sendFacebookMessage(senderPsid, replyPayload, webhookPageId);

      if (followUpImageUrl && /^https?:\/\//i.test(followUpImageUrl)) {
        await sendFacebookMessage(senderPsid, {
          attachment: {
            type: "image",
            payload: { url: followUpImageUrl, is_reusable: false }
          }
        }, webhookPageId);
      }
    }
  } catch (err) {
    console.error("Failed to process chatbot reply:", err);
    await sendFacebookMessage(senderPsid, {
      text: "Sorry, I'm having trouble processing your request right now. Please try again later."
    }, webhookPageId);
  }
}
