import { GoogleGenAI } from "@google/genai";
import { dbService } from "./dbService.ts";

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
export async function sendFacebookMessage(senderPsid: string, responsePayload: any): Promise<boolean> {
  const PAGE_ACCESS_TOKEN = (process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  if (!PAGE_ACCESS_TOKEN) {
    console.warn("FACEBOOK_PAGE_ACCESS_TOKEN or PAGE_ACCESS_TOKEN is not configured. Cannot send reply to Messenger user.");
    return false;
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

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
  const url = `https://graph.facebook.com/${graphVersion}/me/messages`;

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
      return false;
    } else {
      console.log(`Successfully sent message to Facebook Messenger user: ${senderPsid}`);
      return true;
    }
  } catch (error) {
    console.error("Error calling Facebook Graph API:", error);
    return false;
  }
}

// Core ApartmentPro Chatbot Engine
export async function processChatbotMessage(messageText: string, tenantId: string | null, senderPsid: string): Promise<string> {
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

  // Local Rule-Based Fallback Generator (Guaranteed reliable, fast, zero secrets)
  const generateLocalResponse = (msg: string): string => {
    const text = msg.toLowerCase().trim();

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
        // Section A: Security Deposit & Advance Rent Transactions
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

        // Section B: Monthly Statements & Invoices
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

        // Section C: Current Running Balances
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
        title: `Payment Reference Submitted via Messenger`,
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
    if (text === "get_balance" || text === "balance" || text.includes("my balance") || text.includes("deposit balance") || text.includes("advance balance") || text.includes("how much") || text.includes("rent due") || text.includes("statement") || text.includes("bill") || text.includes("utility") || text.includes("utilities")) {
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

    // 8. MAINTENANCE & REPAIR TICKETS
    const categories = ["plumbing", "electrical", "internet", "aircon", "air conditioning", "furniture", "cleaning", "leak", "water", "light", "faucet", "clogged", "broken", "wifi", "maintenance", "repair"];
    const containsMaintKeyword = text === "report_maintenance" || categories.some(cat => text.includes(cat));

    if (containsMaintKeyword) {
      let category: any = "Other";
      let priority: "High" | "Medium" | "Low" = "Medium";
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
      if (!db.notifications) db.notifications = [];
      db.notifications.push(newNotif);
      writeDB(db);

      const priorityEmoji = priority === "High" ? "🔴" : priority === "Medium" ? "🟡" : "🟢";
      return `🔧 *MAINTENANCE TICKET FILED SUCCESSFULLY!*\n\nI have automatically logged your issue in our maintenance database:\n- *Ticket ID:* \`${newMaintId}\`\n- *Category:* ${category}\n- *Priority:* ${priorityEmoji} ${priority}\n- *Unit:* Room ${roomNum || "Guest"}\n- *Status:* ⏳ Pending Admin Review\n\nOur maintenance staff has been dispatched an alert.`;
    }

    // Default conversational greeting & navigation menu
    return `👋 Hello! I am the **ApartmentPro Assistant**.\n\nHow can I help you today? Tap any of the quick action buttons below:\n\n• 📋 *Transaction History* — View ledger & receipts\n• 💳 *Send Payment* — Payment channels & instructions\n• 💰 *Balances* — Live rent & utility summary\n• 🔧 *Report Maintenance* — Log a repair ticket\n• 📢 *Announcements* — Building news & advisories\n• 📜 *Apartment Rules* — Policies & guidelines\n\n👉 If you are a tenant, type: *link <your_contact_number>* (e.g. *link 09171234567*) to securely link your profile!`;
  };

  // Try Gemini AI Generation if available
  const ai = getAIClient();
  if (!ai) {
    return generateLocalResponse(messageText);
  }

  try {
    const rulesSummary = rulesList.map((r: any) => `- Rule: ${r.rule_text}`).join("\n");
    const annSummary = announcementsList.map((a: any) => `- [${a.title}]: ${a.content} (Posted: ${a.created_at})`).join("\n");

    const systemPrompt = `You are "ApartmentPro Assistant", a highly polished, helpful, and professional virtual property assistant for the ApartmentPro property management system.
Your job is to assist tenants and guests via Facebook Messenger. You are connected to the live ApartmentPro database.

Current Context:
${tenantContext}

Apartment Policies/Rules:
${rulesSummary || "Quiet hours from 10 PM to 7 AM. Keep corridors clean. Turn off AC when leaving."}

Active Announcements:
${annSummary || "No active announcements."}

CRITICAL PRIVACY RULES:
1. If the user is NOT logged in/verified as a tenant (browsing as Guest) and asks for personal tenant data (like rent dues, personal utility bills, deposit balance, ledger history, contract status):
   - You MUST NOT reveal any confidential tenant balances or history.
   - Instruct them to link their tenant profile by typing: link <contact_number> (e.g. link 09171234567).
2. If the user IS logged in as a tenant and asks about their balances, history, due dates, or lease:
   - Provide their exact financial details from the context above.
3. If the user is reporting a maintenance issue (water leak, electrical problem, AC, etc.):
   - Set "create_ticket" to true.
   - Select "category" from: "Plumbing", "Electrical", "Internet", "Air Conditioning", "Furniture", "Cleaning", "Other".
   - Select "priority" from: "High", "Medium", "Low".
4. If the user asks how to pay rent:
   - Explain payment options: GCash/Maya (0917-888-9999) or Bank Transfer (BDO: 0012-3456-7890, BPI: 0987-6543-2100).
   - Tell them they can confirm payment by typing: paid <amount> ref <reference_number>.
5. Format your response cleanly using emojis and bold headers (*text*). Do NOT output HTML tags.
6. Return a JSON object matching this schema:
{
  "reply": "Conversational reply text formatted in clean Markdown with emojis",
  "intent": "get_history | send_payment | get_balance | report_maintenance | view_announcements | view_rules | view_profile | chat",
  "create_ticket": true or false,
  "ticket_details": {
    "category": "Plumbing | Electrical | Internet | Air Conditioning | Furniture | Cleaning | Other",
    "priority": "High | Medium | Low",
    "description": "Brief summary of the issue reported"
  }
}`;

    const response = await ai.models.generateContent({
      model: "gemini-3.5-flash",
      contents: [{ role: "user", parts: [{ text: messageText }] }],
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
      if (!db.notifications) db.notifications = [];
      db.notifications.push(newNotif);
      writeDB(db);

      const priorityEmoji = newMaint.priority === "High" ? "🔴" : newMaint.priority === "Medium" ? "🟡" : "🟢";
      return `${parsedRes.reply}\n\n🔧 *Maintenance Request Filed!*\n- *Ticket ID:* \`${newMaintId}\`\n- *Category:* ${newMaint.category}\n- *Priority:* ${priorityEmoji} ${newMaint.priority}\n- *Status:* ⏳ Pending Admin Review`;
    }

    return parsedRes.reply || generateLocalResponse(messageText);
  } catch (error) {
    console.error("Gemini AI error, seamlessly using local rules engine:", error);
    return generateLocalResponse(messageText);
  }
}

// Master Messenger Webhook Event Processor
export async function handleMessengerWebhookEvent(webhook_event: any, webhookPageId?: string): Promise<void> {
  const senderPsid = webhook_event.sender?.id;
  if (!senderPsid) return;

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
    const botReply = await processChatbotMessage(messageText, linkedTenant ? linkedTenant.id : null, senderPsid);
    await sendFacebookMessage(senderPsid, { text: botReply });
  } catch (err) {
    console.error("Failed to process chatbot reply:", err);
    await sendFacebookMessage(senderPsid, {
      text: "Sorry, I'm having trouble processing your request right now. Please try again later."
    });
  }
}
