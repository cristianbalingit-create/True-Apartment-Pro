// Dedicated Standalone Vercel Serverless Function for Facebook Messenger Webhook
// Route: /api/webhook/facebook
// Fully self-contained for Vercel production deployment (zero external .ts relative imports)

import fs from "fs";
import path from "path";
import os from "os";
import { GoogleGenAI } from "@google/genai";

// =========================================================================
// 1. CONSTANTS & CONFIGURATION
// =========================================================================
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

// =========================================================================
// 2. SELF-CONTAINED DATABASE SERVICE FOR VERCEL SERVERLESS RUNTIME
// =========================================================================
let cachedDBState: any = null;

function sanitizeDBState(parsed: any): any {
  const state = {
    apartments: Array.isArray(parsed?.apartments) ? parsed.apartments : [],
    rooms: Array.isArray(parsed?.rooms) ? parsed.rooms : [],
    tenants: Array.isArray(parsed?.tenants) ? parsed.tenants : [],
    billingRecords: Array.isArray(parsed?.billingRecords) ? parsed.billingRecords : [],
    notifications: Array.isArray(parsed?.notifications) ? parsed.notifications : [],
    inquiries: Array.isArray(parsed?.inquiries) ? parsed.inquiries : [],
    maintenanceRequests: Array.isArray(parsed?.maintenanceRequests) ? parsed.maintenanceRequests : [],
    announcements: Array.isArray(parsed?.announcements) ? parsed.announcements : [],
    rules: Array.isArray(parsed?.rules) ? parsed.rules : [],
    depositLedger: Array.isArray(parsed?.depositLedger) ? parsed.depositLedger : [],
    transactionLogs: Array.isArray(parsed?.transactionLogs) ? parsed.transactionLogs : []
  };

  // Ensure tenant balance fields exist
  state.tenants.forEach((t: any) => {
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

function loadInitialSeedFallback(): any {
  return {
    apartments: [
      {
        id: "apt-1",
        name: "ApartmentPro Plaza",
        address: "123 Rizal Ave, Manila",
        total_floors: 5,
        description: "Centrally located modern complex with active 24/7 security and high-speed elevators.",
        status: "active"
      }
    ],
    rooms: [
      {
        id: "room-101",
        apartment_id: "apt-1",
        room_number: "101",
        floor: 1,
        status: "occupied",
        tenant_id: "tenant-1",
        rent_amount: 12000,
        room_type: "studio"
      }
    ],
    tenants: [
      {
        id: "tenant-1",
        name: "Juan Dela Cruz",
        contact: "09171234567",
        email: "juan@example.com",
        apartment_id: "apt-1",
        room_id: "room-101",
        rent_amount: 12000,
        deposit: 24000,
        deposit_balance: 24000,
        advance_payment: 12000,
        advance_balance: 12000,
        status: "active"
      }
    ],
    billingRecords: [
      {
        id: "bill-101",
        tenant_id: "tenant-1",
        room_number: "101",
        billing_month: "September 2026",
        rent_amount: 12000,
        water_amount: 450,
        electric_amount: 1200,
        total_amount: 13650,
        due_date: "2026-09-15",
        payment_status: "unpaid"
      }
    ],
    rules: [
      { id: "rule-1", category: "Quiet Hours", rule_text: "Quiet hours are observed strictly between 10:00 PM and 7:00 AM." },
      { id: "rule-2", category: "Visitors", rule_text: "Guests must register at the reception. Overnight stays must be notified 24 hours in advance." },
      { id: "rule-3", category: "Trash", rule_text: "Garbage must be segregated into Biodegradable and Non-Biodegradable and disposed of in designated bins." },
      { id: "rule-4", category: "Safety", rule_text: "No smoking or vaping inside the rooms or enclosed hallways." }
    ],
    announcements: [
      {
        id: "ann-1",
        title: "Scheduled Water Interruption Notice",
        content: "Please be advised that Manila Water will conduct pipeline maintenance on Saturday from 1:00 PM to 5:00 PM.",
        created_at: new Date().toISOString()
      },
      {
        id: "ann-2",
        title: "Online Rent Payment via GCash & Bank",
        content: "Tenants can now settle monthly rent and utilities via GCash (0917-888-9999) or direct bank transfer to BDO / BPI.",
        created_at: new Date().toISOString()
      }
    ],
    maintenanceRequests: [],
    notifications: [],
    inquiries: [],
    depositLedger: [],
    transactionLogs: []
  };
}

export function readDB(): any {
  if (cachedDBState) return cachedDBState;

  const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
  const candidates = [
    isVercel ? path.join(os.tmpdir(), "data.json") : null,
    path.join(process.cwd(), "data.json"),
    path.join(process.cwd(), "dist", "data.json")
  ].filter(Boolean) as string[];

  for (const filePath of candidates) {
    try {
      if (fs.existsSync(filePath)) {
        const raw = fs.readFileSync(filePath, "utf-8");
        const parsed = JSON.parse(raw);
        cachedDBState = sanitizeDBState(parsed);
        return cachedDBState;
      }
    } catch (e) {
      // continue to next candidate
    }
  }

  cachedDBState = loadInitialSeedFallback();
  return cachedDBState;
}

export function writeDB(state: any): void {
  cachedDBState = sanitizeDBState(state);
  try {
    const isVercel = !!(process.env.VERCEL || process.env.AWS_LAMBDA_FUNCTION_NAME || process.env.LAMBDA_TASK_ROOT);
    const savePath = isVercel
      ? path.join(os.tmpdir(), "data.json")
      : path.join(process.cwd(), "data.json");
    fs.writeFileSync(savePath, JSON.stringify(cachedDBState, null, 2), "utf-8");
  } catch (err) {
    console.warn("Notice: unable to persist data.json to disk in read-only environment:", err);
  }
}

export function logTransaction(db: any, log: {
  category: "billing" | "payment" | "tenant" | "maintenance" | "system";
  action: "create" | "update" | "delete" | "pay";
  title: string;
  details: string;
  tenant_id?: string;
  tenant_name?: string;
  room_number?: string;
  amount?: number;
}) {
  db.transactionLogs = db.transactionLogs || [];
  db.transactionLogs.unshift({
    id: `tx-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
    ...log,
    created_at: new Date().toISOString()
  });
}

// =========================================================================
// 3. SAFE DIAGNOSTIC (Zero secrets exposed)
// =========================================================================
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
    const meData = (await meRes.json()) as any;
    if (meData && meData.id) {
      tokenPageId = String(meData.id);
      tokenPageName = meData.name || null;
      isPageToken = true;
    }
  } catch (err: any) {
    console.warn("Token diagnostic error:", err?.message || err);
  }

  const isOfficialPage = tokenPageId === OFFICIAL_PAGE_ID;
  const isOldRetiredPage = tokenPageId === RETIRED_OLD_PAGE_ID;
  const matches = Boolean(tokenPageId && webhookPageId && tokenPageId === webhookPageId);

  return {
    isPageToken,
    tokenPageId,
    tokenPageName,
    expectedPageId: OFFICIAL_PAGE_ID,
    expectedPageName: OFFICIAL_PAGE_NAME,
    isOfficialPage,
    isOldRetiredPage,
    webhookPageId,
    match: webhookPageId ? matches : undefined
  };
}

// =========================================================================
// 4. FACEBOOK GRAPH SEND API INTEGRATION
// =========================================================================
export async function sendFacebookMessage(senderPsid: string, responsePayload: any): Promise<void> {
  const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  if (!PAGE_ACCESS_TOKEN) {
    console.warn("FACEBOOK_PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKEN is not configured in environment variables.");
    return;
  }

  let msgObj: any = typeof responsePayload === "string" ? { text: responsePayload } : { ...responsePayload };
  if (!msgObj.quick_replies && msgObj.text && !msgObj.attachment) {
    msgObj.quick_replies = standardQuickReplies;
  }

  const requestBody = {
    recipient: { id: senderPsid },
    message: msgObj
  };

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
  const url = `https://graph.facebook.com/${graphVersion}/me/messages`;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${PAGE_ACCESS_TOKEN}`
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
      console.error("Facebook Send API error:", resData);
    } else {
      console.log(`Successfully dispatched reply to Messenger user ${senderPsid}`);
    }
  } catch (error: any) {
    console.error("Failed to call Facebook Graph API:", error?.message || error);
  }
}

// =========================================================================
// 5. APARTMENTPRO CHATBOT ENGINE & CONTEXT RESOLVER
// =========================================================================
export async function processChatbotMessage(
  messageText: string,
  tenantId: string | null,
  senderPsid: string
): Promise<string> {
  const db = readDB();
  const announcementsList = db.announcements || [];
  const rulesList = db.rules || [];

  // Gather tenant financial and lease context
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

      const tenantBills = (db.billingRecords || []).filter((b: any) => b.tenant_id === tenantId);
      const unpaidBills = tenantBills.filter((b: any) => b.payment_status === "unpaid" || b.payment_status === "overdue");
      outstandingBalance = unpaidBills.reduce((sum: number, b: any) => sum + Number(b.total_amount || 0), 0);

      if (unpaidBills.length > 0) {
        const sortedBills = [...unpaidBills].sort(
          (a: any, b: any) => new Date(a.due_date).getTime() - new Date(b.due_date).getTime()
        );
        nextDueDate = sortedBills[0].due_date;
        nextDueMonth = sortedBills[0].billing_month || "";
      }

      tenantContext = `The user is logged in as a tenant via Facebook Messenger.
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

  // Fast Rule-Based & Action Handlers
  const generateLocalResponse = (msg: string): string => {
    const text = msg.toLowerCase().trim();

    // BUTTON 1 — TRANSACTION HISTORY
    if (
      text === "get_history" ||
      text === "history" ||
      text.includes("transaction history") ||
      text.includes("my transactions") ||
      text.includes("ledger history") ||
      text.includes("payment history")
    ) {
      if (!tenantObj) {
        return `🔒 *ACCOUNT VERIFICATION REQUIRED*\n\nTo protect your financial privacy, transaction histories are strictly confidential.\n\n👉 To view your personal records, please link your tenant account:\nType: *link <contact_number>*\nExample: *link 09171234567*`;
      }

      const tenantBills = (db.billingRecords || []).filter((b: any) => b.tenant_id === tenantObj.id);
      let historyText = `📋 *OFFICIAL TENANT LEDGER & STATEMENT*\n` +
        `🏢 *${aptName}* — Unit ${roomNum}\n` +
        `👤 *Tenant:* ${tenantObj.name}\n` +
        `-----------------------------------\n\n`;

      if (tenantBills.length === 0) {
        historyText += `No previous statements or bill records logged.\n`;
      } else {
        const sorted = [...tenantBills].sort(
          (a: any, b: any) => new Date(b.due_date).getTime() - new Date(a.due_date).getTime()
        );
        historyText += `*BILLING INVOICES & STATEMENTS:*\n`;
        sorted.slice(0, 5).forEach((bill: any) => {
          const statusIcon = bill.payment_status === "paid" ? "✅ PAID" : bill.payment_status === "overdue" ? "🔴 OVERDUE" : "⏳ UNPAID";
          historyText += `• ${bill.billing_month || bill.due_date}: ₱${Number(bill.total_amount).toLocaleString("en-US")} — ${statusIcon}\n`;
        });
      }

      const curDep = tenantObj.deposit_balance !== undefined ? tenantObj.deposit_balance : tenantObj.deposit || 0;
      const curAdv = tenantObj.advance_balance !== undefined ? tenantObj.advance_balance : (tenantObj.advance_payment || tenantObj.rent_amount || 0);
      historyText += `\n-----------------------------------\n` +
        `💰 *ACTIVE BALANCES:*\n` +
        `• Outstanding Dues: ₱${Number(outstandingBalance).toLocaleString("en-US")}\n` +
        `• Security Deposit Balance: ₱${Number(curDep).toLocaleString("en-US")}\n` +
        `• Advance Rent Balance: ₱${Number(curAdv).toLocaleString("en-US")}`;

      return historyText;
    }

    // BUTTON 2 — SEND PAYMENT
    if (
      text === "send_payment" ||
      text === "pay" ||
      text.includes("how to pay") ||
      text.includes("payment method") ||
      text.includes("pay rent") ||
      text.includes("bank account") ||
      text.includes("gcash") ||
      text.includes("maya")
    ) {
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

    // Submitting payment reference
    if (
      text.startsWith("paid ") ||
      (text.includes("ref") && (text.includes("gcash") || text.includes("bdo") || text.includes("bpi") || text.includes("transfer") || text.includes("payment")))
    ) {
      const senderName = tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 6)})`;
      const senderRoom = tenantObj ? `Room ${roomNum}` : "Unlinked Room";

      logTransaction(db, {
        category: "payment",
        action: "create",
        title: `Payment Reference Submitted via Messenger`,
        details: `Tenant ${senderName} (${senderRoom}) submitted payment reference: "${msg}". Awaiting admin verification and invoice clearing.`,
        tenant_id: tenantObj?.id || "guest",
        tenant_name: senderName,
        room_number: roomNum
      });

      db.notifications = db.notifications || [];
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
    if (
      text === "get_balance" ||
      text === "balance" ||
      text.includes("my balance") ||
      text.includes("deposit balance") ||
      text.includes("advance balance") ||
      text.includes("how much") ||
      text.includes("rent due") ||
      text.includes("statement")
    ) {
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

    // Rules & Policies
    if (
      text === "view_rules" ||
      text.includes("rule") ||
      text.includes("policy") ||
      text.includes("policies") ||
      text.includes("overnight") ||
      text.includes("pet") ||
      text.includes("noise") ||
      text.includes("smoking")
    ) {
      const rulesStr = rulesList
        .map((r: any, idx: number) => `${idx + 1}. *[${r.category || "General"}]* ${r.rule_text}`)
        .join("\n\n");
      return `🏢 *ABC APARTMENT COMPLEX RULES & REGULATIONS:*\n\n${rulesStr || "No specific rules logged at this time."}`;
    }

    // Announcements
    if (
      text === "view_announcements" ||
      text.includes("announcement") ||
      text.includes("news") ||
      text.includes("update") ||
      text.includes("schedule")
    ) {
      const annStr = announcementsList
        .map((a: any) => `📢 *${a.title}*\n${a.content}\n_(Posted: ${new Date(a.created_at).toLocaleDateString()})_`)
        .join("\n\n---\n\n");
      return `📢 *LATEST PROPERTY ANNOUNCEMENTS:*\n\n${annStr || "No new announcements posted."}`;
    }

    // Tenant Profile
    if (text.includes("profile") || text.includes("my account") || text.includes("who am i")) {
      if (tenantObj) {
        return `👤 *TENANT PROFILE:*\n- *Name:* ${tenantObj.name}\n- *Unit:* Room ${roomNum} (${aptName})\n- *Contact:* ${tenantObj.contact}\n- *Email:* ${tenantObj.email || "N/A"}\n- *Monthly Rent:* ₱${Number(tenantObj.rent_amount || 0).toLocaleString("en-US")}\n- *Status:* ${tenantObj.status.toUpperCase()}`;
      } else {
        return "You are currently chatting as a Guest. To link your tenant profile, type:\n👉 link <your_contact_number>";
      }
    }

    // Maintenance request keyword detection
    const categories = [
      "plumbing",
      "electrical",
      "internet",
      "aircon",
      "air conditioning",
      "furniture",
      "cleaning",
      "leak",
      "water",
      "light",
      "faucet",
      "clogged",
      "broken",
      "wifi",
      "maintenance",
      "repair"
    ];
    const containsMaintKeyword = text === "report_maintenance" || categories.some(cat => text.includes(cat));

    if (containsMaintKeyword) {
      let category: any = "Other";
      let priority: "High" | "Medium" | "Low" = "Medium";
      let description = msg;

      if (
        text.includes("leak") ||
        text.includes("water") ||
        text.includes("plumbing") ||
        text.includes("faucet") ||
        text.includes("toilet") ||
        text.includes("sink")
      ) {
        category = "Plumbing";
        if (text.includes("no water") || text.includes("burst") || text.includes("flooding") || text.includes("flood"))
          priority = "High";
      } else if (
        text.includes("electricity") ||
        text.includes("light") ||
        text.includes("wire") ||
        text.includes("spark") ||
        text.includes("power") ||
        text.includes("outlet") ||
        text.includes("electrical")
      ) {
        category = "Electrical";
        if (text.includes("no power") || text.includes("spark") || text.includes("burning") || text.includes("short circuit"))
          priority = "High";
      } else if (text.includes("internet") || text.includes("wifi") || text.includes("router") || text.includes("connection")) {
        category = "Internet";
        priority = "Low";
      } else if (
        text.includes("aircon") ||
        text.includes("air conditioning") ||
        text.includes("cooling") ||
        text.includes("ac")
      ) {
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

      const urgencyStr =
        priority === "High" ? "🔴 HIGH PRIORITY" : priority === "Medium" ? "🟡 MEDIUM PRIORITY" : "🟢 LOW PRIORITY";
      db.notifications = db.notifications || [];
      db.notifications.push({
        id: `notif-${Date.now()}`,
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`,
        message: `🔧 Maintenance Ticket [${urgencyStr}]: New ${category} ticket submitted via Facebook Messenger by Room ${roomNum || "Guest"} - "${description.substring(0, 80)}..."`,
        type: "general" as const,
        status: "sent" as const,
        channel: "in_app" as const,
        created_at: new Date().toISOString()
      });
      writeDB(db);

      const priorityEmoji = priority === "High" ? "🔴" : priority === "Medium" ? "🟡" : "🟢";
      return `🔧 *MAINTENANCE TICKET FILED SUCCESSFULLY!*\n\nI have automatically logged your issue in our maintenance database:\n- *Ticket ID:* \`${newMaintId}\`\n- *Category:* ${category}\n- *Priority:* ${priorityEmoji} ${priority}\n- *Unit:* Room ${roomNum || "Guest"}\n- *Status:* ⏳ Pending Admin Review\n\nOur maintenance staff has been dispatched an urgent alert.`;
    }

    return `👋 Hello! I am the **ABC Apartment Assistant**.\n\nHow can I help you today? Tap any of the quick action buttons below:\n\n• 📋 *Transaction History* — View ledger & receipts\n• 💳 *Send Payment* — Payment channels & instructions\n• 💰 *Balance / Deposit / Advance* — Live account summary\n• 🔧 *Report Maintenance* — Log a repair ticket\n• 📢 *Announcements* — Building news & advisories\n• 📜 *Apartment Rules* — Policies & guidelines\n\n👉 If you haven't linked your account, type: *link <your_contact_number>* (e.g. *link 09171234567*)`;
  };

  // 3. Try Gemini AI Model
  const ai = getAIClient();
  if (!ai) {
    return generateLocalResponse(messageText);
  }

  try {
    const rulesSummary = rulesList.map((r: any) => `- Rule: ${r.rule_text}`).join("\n");
    const annSummary = announcementsList
      .map((a: any) => `- [${a.title}]: ${a.content} (Posted: ${a.created_at})`)
      .join("\n");

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
  "intent": "get_rent_balance | view_due_date | report_maintenance | view_announcements | view_rules | view_profile | chat",
  "create_ticket": true or false,
  "ticket_details": {
    "category": "Plumbing | Electrical | Internet | Air Conditioning | Furniture | Cleaning | Other",
    "priority": "High | Medium | Low",
    "description": "Brief summary of the issue reported"
  }
}
Note: ticket_details is required only if create_ticket is true.`;

    const contents = [
      {
        role: "user",
        parts: [{ text: messageText }]
      }
    ];

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

    // If Gemini decided to create a maintenance ticket, commit to DB
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

      const urgencyStr =
        newMaint.priority === "High" ? "🔴 HIGH PRIORITY" : newMaint.priority === "Medium" ? "🟡 MEDIUM PRIORITY" : "🟢 LOW PRIORITY";
      db.notifications = db.notifications || [];
      db.notifications.push({
        id: `notif-${Date.now()}`,
        tenant_id: tenantId || "guest",
        tenant_name: tenantObj ? tenantObj.name : `Facebook Guest (${senderPsid.substring(0, 5)})`,
        message: `🔧 Maintenance Ticket [${urgencyStr}]: New ${newMaint.category} ticket submitted via Facebook Messenger by Room ${roomNum || "Guest"} - "${newMaint.issue_description.substring(0, 80)}..."`,
        type: "general" as const,
        status: "sent" as const,
        channel: "in_app" as const,
        created_at: new Date().toISOString()
      });
      writeDB(db);

      const priorityEmoji = newMaint.priority === "High" ? "🔴" : newMaint.priority === "Medium" ? "🟡" : "🟢";
      return `${parsedRes.reply}\n\n* **Ticket ID:** \`${newMaintId}\`\n* **Category:** ${newMaint.category}\n* **Priority:** ${priorityEmoji} ${newMaint.priority}\n* **Status:** ⏳ Pending Admin Review`;
    }

    return parsedRes.reply;
  } catch (error: any) {
    console.error("Gemini API Error, falling back to local processing:", error?.message || error);
    return generateLocalResponse(messageText);
  }
}

// =========================================================================
// 6. MESSENGER WEBHOOK EVENT HANDLER
// =========================================================================
export async function handleMessengerWebhookEvent(webhook_event: any, webhookPageId?: string): Promise<void> {
  const senderPsid = webhook_event?.sender?.id;
  if (!senderPsid) return;

  // Extract text from standard message, quick reply payload, or postback
  let messageText = "";
  if (webhook_event.message) {
    if (webhook_event.message.quick_reply && webhook_event.message.quick_reply.payload) {
      messageText = webhook_event.message.quick_reply.payload;
    } else if (webhook_event.message.text) {
      messageText = webhook_event.message.text;
    }
  } else if (webhook_event.postback && webhook_event.postback.payload) {
    messageText = webhook_event.postback.payload;
  }

  if (!messageText) return;

  const db = readDB();
  const textLower = messageText.toLowerCase().trim();

  // Find if user is linked
  const linkedTenant = (db.tenants || []).find(
    (t: any) => t.facebook_psid === senderPsid || t.messenger_psid === senderPsid
  );

  // 1. Account linking workflow: "link <contact_number>"
  if (textLower.startsWith("link")) {
    const query = messageText.replace(/^link\s*/i, "").replace(/[^0-9+]/g, "").trim();
    const matched = (db.tenants || []).find((t: any) => {
      const c = (t.contact || "").replace(/[^0-9+]/g, "").trim();
      return c && (c === query || c.endsWith(query) || query.endsWith(c));
    });

    if (matched) {
      matched.facebook_psid = senderPsid;
      matched.messenger_psid = senderPsid;
      writeDB(db);

      const room = (db.rooms || []).find((r: any) => r.id === matched.room_id);
      const roomNum = room ? room.room_number : "Unit Assigned";
      await sendFacebookMessage(senderPsid, {
        text: `🎉 *ACCOUNT LINKED SUCCESSFULLY!*\n\nWelcome, *${matched.name}* (Room ${roomNum})!\nYour Facebook Messenger is now officially linked to your ApartmentPro tenant account.\n\nYou can now check your balance, submit payment receipts, and report maintenance issues anytime directly in this chat.`
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
    const botReply = await processChatbotMessage(messageText, linkedTenant ? linkedTenant.id : null, senderPsid);
    await sendFacebookMessage(senderPsid, { text: botReply });
  } catch (err: any) {
    console.error("Failed to process chatbot reply:", err);
    await sendFacebookMessage(senderPsid, {
      text: "Sorry, I'm having trouble processing your request right now. Please try again later."
    });
  }
}

// Helper to parse body in serverless environment
async function parseBody(req: any): Promise<any> {
  if (req.body) {
    if (typeof req.body === "string") {
      try {
        return JSON.parse(req.body);
      } catch {
        return req.body;
      }
    }
    return req.body;
  }
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk: any) => {
      data += chunk;
    });
    req.on("end", () => {
      try {
        resolve(JSON.parse(data));
      } catch {
        resolve(data);
      }
    });
  });
}

// =========================================================================
// 7. VERCEL SERVERLESS FUNCTION DEFAULT HANDLER
// =========================================================================
export default async function handler(req: any, res: any) {
  // =========================================================================
  // 1. GET: Facebook Webhook Verification Endpoint & Safe Diagnostic
  // =========================================================================
  if (req.method === "GET") {
    const url = new URL(req.url || "", "http://localhost");

    // Safe Diagnostic Endpoint (Zero secrets exposed)
    const isDiagRequest = req.query?.diagnostic === "1" || url.searchParams.get("diagnostic") === "1";
    if (isDiagRequest) {
      const diagResult = await runSafeTokenDiagnostic();
      if (res.status) {
        return res.status(200).json(diagResult);
      }
      if (res.setHeader) res.setHeader("Content-Type", "application/json");
      res.statusCode = 200;
      return res.end(JSON.stringify(diagResult, null, 2));
    }

    const mode = req.query?.["hub.mode"] || (req.query?.["hub"] as any)?.mode || url.searchParams.get("hub.mode");
    const token =
      req.query?.["hub.verify_token"] || (req.query?.["hub"] as any)?.verify_token || url.searchParams.get("hub.verify_token");
    const challenge =
      req.query?.["hub.challenge"] || (req.query?.["hub"] as any)?.challenge || url.searchParams.get("hub.challenge");

    const configuredToken = process.env.FACEBOOK_VERIFY_TOKEN?.trim();
    const fallbackToken = "abc_apartment_verify_token";

    console.log("=== FACEBOOK WEBHOOK VERIFICATION (GET) ===");
    console.log("Received mode:", mode);
    console.log("Received token provided:", Boolean(token));
    console.log("Is FACEBOOK_VERIFY_TOKEN configured?", Boolean(configuredToken));

    if (mode === "subscribe" && token) {
      const receivedToken = String(token).trim();
      const isMatch = (configuredToken && receivedToken === configuredToken) || receivedToken === fallbackToken;

      if (isMatch) {
        console.log("✅ FACEBOOK_WEBHOOK_VERIFIED SUCCESSFULLY. Challenge returned:", challenge);
        if (res.setHeader) res.setHeader("Content-Type", "text/plain");
        if (res.status) {
          return res.status(200).send(String(challenge));
        }
        res.statusCode = 200;
        return res.end(String(challenge));
      } else {
        console.warn("❌ FACEBOOK_WEBHOOK_VERIFICATION FAILED: Verification token mismatch");
        if (res.setHeader) res.setHeader("Content-Type", "text/plain");
        if (res.status) {
          return res.status(403).send("Verification token mismatch");
        }
        res.statusCode = 403;
        return res.end("Verification token mismatch");
      }
    }

    if (res.setHeader) res.setHeader("Content-Type", "text/plain");
    if (res.status) {
      return res.status(400).send("Missing hub.mode or hub.verify_token query parameter");
    }
    res.statusCode = 400;
    return res.end("Missing hub.mode or hub.verify_token query parameter");
  }

  // =========================================================================
  // 2. POST: Facebook Messenger Webhook Events Receiver
  // =========================================================================
  if (req.method === "POST") {
    try {
      const body = await parseBody(req);

      console.log("===== FACEBOOK WEBHOOK RAW BODY =====");
      console.log(typeof body === "object" ? JSON.stringify(body, null, 2) : body);

      if (body && body.object === "page") {
        for (const entry of body.entry || []) {
          const webhookPageId = entry.id;
          const messagingEvents = entry.messaging || [];
          for (const webhook_event of messagingEvents) {
            // Process incoming message with real ApartmentPro AI Chatbot
            await handleMessengerWebhookEvent(webhook_event, webhookPageId);
          }
        }
      }

      // Respond with HTTP 200 to Facebook after processing so it knows delivery succeeded
      if (res.setHeader) res.setHeader("Content-Type", "text/plain");
      if (res.status) {
        return res.status(200).send("EVENT_RECEIVED");
      }
      res.statusCode = 200;
      return res.end("EVENT_RECEIVED");
    } catch (err: any) {
      console.error("===== MESSENGER WEBHOOK ERROR =====");
      console.error(err?.message || err);

      // Always return 200 OK to Meta to avoid retry storms
      if (res.setHeader) res.setHeader("Content-Type", "text/plain");
      if (res.status) {
        return res.status(200).send("EVENT_RECEIVED");
      }
      res.statusCode = 200;
      return res.end("EVENT_RECEIVED");
    }
  }

  if (res.status) return res.status(405).send("Method Not Allowed");
  res.statusCode = 405;
  return res.end("Method Not Allowed");
}
