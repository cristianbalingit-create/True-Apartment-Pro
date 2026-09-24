import fs from "fs";
import path from "path";
import os from "os";
import { Resvg } from "@resvg/resvg-js";
import type { BillingRecord, Tenant } from "../types";
import { readDB, writeDB, logTransaction, sendFacebookMessage } from "./chatbotService";
import { dbService } from "./dbService";

// Helper to escape XML / SVG special characters
function escapeXml(unsafe: string | number | undefined | null): string {
  if (unsafe === undefined || unsafe === null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

// Philippine Peso formatter
export function formatPHP(amount: number | string | undefined | null): string {
  const num = Number(amount || 0);
  return `₱${num.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

// Determine safe, public production URL (never localhost)
export function getPublicBaseUrl(req?: any): string {
  // 1. Explicit environment variable APP_URL (AI Studio Cloud Run URL or custom domain)
  const envAppUrl = process.env.APP_URL?.trim();
  if (envAppUrl && !envAppUrl.includes("localhost") && !envAppUrl.includes("127.0.0.1") && !envAppUrl.includes("MY_APP_URL")) {
    return envAppUrl.replace(/\/$/, "");
  }

  // 2. Vercel production URL
  const vercelProjectUrl = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (vercelProjectUrl && !vercelProjectUrl.includes("localhost")) {
    return `https://${vercelProjectUrl.replace(/\/$/, "")}`;
  }

  // 3. Vercel deployment URL
  const vercelUrl = process.env.VERCEL_URL?.trim();
  if (vercelUrl && !vercelUrl.includes("localhost")) {
    return `https://${vercelUrl.replace(/\/$/, "")}`;
  }

  // 4. Request host headers from client
  if (req && req.headers) {
    const proto = req.headers["x-forwarded-proto"] || "https";
    const host = req.headers["x-forwarded-host"] || req.headers["host"];
    if (host && !host.includes("localhost") && !host.includes("127.0.0.1")) {
      return `${proto}://${host}`;
    }
  }

  // 5. Cloud Run AI Studio Production Fallback URL
  return "https://ais-dev-x42uaou6vpts3cfqocac36-180192611769.asia-southeast1.run.app";
}

// Format bill invoice reference
export function getBillReference(bill: BillingRecord): string {
  if (bill.invoice_number && bill.invoice_number.trim().length > 0) {
    return bill.invoice_number.trim();
  }
  if (bill.id.startsWith("bill-")) {
    return bill.id.replace("bill-", "INV-");
  }
  return bill.id;
}

// Generate Elder-Friendly, High-Contrast, Professional SVG Bill
export function generateBillSvg(bill: BillingRecord): string {
  const width = 800;
  const rent = Number(bill.rent_amount || 0);
  const water = Number(bill.water_amount || 0);
  const electricity = Number(bill.electricity_amount || 0);
  const other = Number(bill.other_charges || 0);
  const total = Number(bill.total_amount || 0);

  const rawStatus = (bill.payment_status || "unpaid").toLowerCase();
  let statusText = "UNPAID";
  let statusColor = "#dc2626"; // High contrast red
  let statusBg = "#fef2f2";
  let statusBorder = "#f87171";

  if (rawStatus === "paid") {
    statusText = "PAID";
    statusColor = "#15803d"; // Emerald green
    statusBg = "#f0fdf4";
    statusBorder = "#4ade80";
  } else if (rawStatus === "overdue") {
    statusText = "OVERDUE";
    statusColor = "#b91c1c"; // Bold crimson
    statusBg = "#fff1f2";
    statusBorder = "#fb7185";
  } else if (rawStatus === "partial" || rawStatus === "partially paid") {
    statusText = "PARTIALLY PAID";
    statusColor = "#6d28d9"; // Purple
    statusBg = "#faf5ff";
    statusBorder = "#a78bfa";
  }

  const billRef = getBillReference(bill);

  // Line items
  const items: Array<{ label: string; sub: string; amount: number; icon: string }> = [
    {
      label: "RENT",
      sub: "Monthly Base Room Rent",
      amount: rent,
      icon: "🏠"
    },
    {
      label: "WATER",
      sub: bill.water_usage ? `${bill.water_usage} m³ metered consumption` : "Metered Water Utility",
      amount: water,
      icon: "💧"
    },
    {
      label: "ELECTRICITY",
      sub: bill.electricity_usage ? `${bill.electricity_usage} kWh metered consumption` : "Metered Power Utility",
      amount: electricity,
      icon: "⚡"
    }
  ];

  // Optional other charges: only include if > 0 (Requirement 7)
  if (other > 0) {
    items.push({
      label: "OTHER CHARGES",
      sub: bill.other_charges_description || "Property Services & Add-on Fees",
      amount: other,
      icon: "📋"
    });
  }

  const startY = 370;
  const itemHeight = 78;
  const itemsSvg = items
    .map((item, idx) => {
      const y = startY + idx * itemHeight;
      return `
      <g transform="translate(50, ${y})">
        <rect width="700" height="66" rx="12" fill="#ffffff" stroke="#cbd5e1" stroke-width="1.5"/>
        <!-- Item Icon & Label -->
        <text x="24" y="32" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="19" font-weight="800" fill="#0f172a" letter-spacing="0.5">
          ${item.icon}  ${escapeXml(item.label)}
        </text>
        <text x="56" y="52" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="13" font-weight="600" fill="#475569">
          ${escapeXml(item.sub)}
        </text>
        <!-- Amount -->
        <text x="676" y="42" text-anchor="end" font-family="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif" font-size="24" font-weight="900" fill="#0f172a">
          ${formatPHP(item.amount)}
        </text>
      </g>
    `;
    })
    .join("");

  const totalBoxY = startY + items.length * itemHeight + 20;
  const footerY = totalBoxY + 195;
  const totalHeight = footerY + 130;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="headerBg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#0f172a"/>
      <stop offset="100%" stop-color="#1e293b"/>
    </linearGradient>
    <linearGradient id="accentBar" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#e73f1e"/>
      <stop offset="100%" stop-color="#fb6c00"/>
    </linearGradient>
    <filter id="cardShadow" x="-5%" y="-5%" width="110%" height="110%">
      <feDropShadow dx="0" dy="4" stdDeviation="6" flood-color="#0f172a" flood-opacity="0.08"/>
    </filter>
  </defs>

  <!-- Clean Background Canvas -->
  <rect width="${width}" height="${totalHeight}" fill="#f1f5f9"/>

  <!-- Main Statement Card -->
  <rect x="25" y="20" width="750" height="${totalHeight - 40}" rx="24" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" filter="url(#cardShadow)"/>

  <!-- Top Brand Accent Ribbon -->
  <path d="M 25 44 A 24 24 0 0 1 49 20 L 751 20 A 24 24 0 0 1 775 44 L 775 32 L 25 32 Z" fill="url(#accentBar)"/>

  <!-- Header Banner -->
  <g transform="translate(50, 48)">
    <rect width="700" height="115" rx="16" fill="url(#headerBg)"/>
    <circle cx="650" cy="55" r="75" fill="#fb6c00" opacity="0.12"/>
    
    <text x="32" y="44" font-family="system-ui, -apple-system, sans-serif" font-size="30" font-weight="900" fill="#ffffff" letter-spacing="2">
      APARTMENTPRO
    </text>
    <text x="32" y="74" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="800" fill="#fb923c" letter-spacing="1.5">
      MONTHLY BILL
    </text>
    <text x="32" y="96" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="600" fill="#94a3b8">
      Official Digital Statement of Account
    </text>

    <!-- Bill Reference Tag -->
    <rect x="520" y="32" width="155" height="34" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1"/>
    <text x="597" y="54" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="700" fill="#cbd5e1" letter-spacing="0.5">
      ${escapeXml(billRef)}
    </text>
  </g>

  <!-- Tenant Details Card (High Contrast, Elder-Friendly) -->
  <g transform="translate(50, 180)">
    <rect width="700" height="165" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    
    <!-- Left Column: Tenant Name -->
    <text x="28" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#64748b" letter-spacing="1">
      TENANT NAME
    </text>
    <text x="28" y="66" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="900" fill="#0f172a">
      ${escapeXml(bill.tenant_name)}
    </text>

    <!-- Right Column: Room Number -->
    <text x="420" y="34" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#64748b" letter-spacing="1">
      ROOM NUMBER
    </text>
    <text x="420" y="66" font-family="system-ui, -apple-system, sans-serif" font-size="24" font-weight="900" fill="#0f172a">
      Room ${escapeXml(bill.room_number)}
    </text>

    <!-- Divider -->
    <line x1="28" y1="90" x2="672" y2="90" stroke="#e2e8f0" stroke-width="1.5"/>

    <!-- Left Column: Billing Period -->
    <text x="28" y="118" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#64748b" letter-spacing="1">
      BILLING PERIOD
    </text>
    <text x="28" y="146" font-family="system-ui, -apple-system, sans-serif" font-size="19" font-weight="800" fill="#1e293b">
      ${escapeXml(bill.billing_month)}
    </text>

    <!-- Right Column: Due Date (Highlighted) -->
    <text x="420" y="118" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="800" fill="#64748b" letter-spacing="1">
      DUE DATE
    </text>
    <text x="420" y="146" font-family="system-ui, -apple-system, sans-serif" font-size="20" font-weight="900" fill="#dc2626">
      ${escapeXml(bill.due_date)}
    </text>
  </g>

  <!-- Items Breakdown -->
  ${itemsSvg}

  <!-- Grand Total Amount Due Box (High Visual Emphasis) -->
  <g transform="translate(50, ${totalBoxY})">
    <rect width="700" height="175" rx="18" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
    <circle cx="650" cy="50" r="90" fill="#fb6c00" opacity="0.14"/>

    <!-- Top Label -->
    <text x="32" y="44" font-family="system-ui, -apple-system, sans-serif" font-size="14" font-weight="900" fill="#94a3b8" letter-spacing="2">
      TOTAL AMOUNT DUE
    </text>

    <!-- Massive Readable Amount -->
    <text x="32" y="98" font-family="system-ui, -apple-system, sans-serif" font-size="46" font-weight="900" fill="#ffffff" letter-spacing="0.5">
      ${formatPHP(total)}
    </text>

    <!-- Payment Status Badge -->
    <rect x="32" y="118" width="190" height="38" rx="8" fill="${statusBg}" stroke="${statusBorder}" stroke-width="2"/>
    <text x="127" y="143" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="16" font-weight="900" fill="${statusColor}" letter-spacing="1">
      ${escapeXml(statusText)}
    </text>

    <!-- Right Side Currency Badge -->
    <text x="668" y="90" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="15" font-weight="700" fill="#cbd5e1">
      Philippine Peso (PHP)
    </text>
    <text x="668" y="114" text-anchor="end" font-family="system-ui, -apple-system, sans-serif" font-size="12" font-weight="500" fill="#94a3b8">
      Rent &amp; utilities included
    </text>
  </g>

  <!-- Elder-Friendly Bottom Notice -->
  <g transform="translate(50, ${footerY})">
    <rect width="700" height="84" rx="14" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    <text x="350" y="36" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="17" font-weight="800" fill="#0f172a">
      Thank you. Please settle your bill on or before the due date.
    </text>
    <text x="350" y="62" text-anchor="middle" font-family="system-ui, -apple-system, sans-serif" font-size="13" font-weight="600" fill="#64748b">
      ApartmentPro Property Management • Use the Messenger buttons below to send payment or check balance
    </text>
  </g>
</svg>`;
}

// Render SVG to clean, high-resolution PNG Buffer
export function generateBillPng(bill: BillingRecord): Buffer {
  const svg = generateBillSvg(bill);
  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: 800
    },
    font: {
      loadSystemFonts: true
    }
  });
  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

// Master Visual Bill Dispatcher to Facebook Messenger
export async function sendVisualBillToMessenger(
  tenant: Tenant,
  bill: BillingRecord,
  options?: {
    forceRetry?: boolean;
    req?: any;
  }
): Promise<{
  success: boolean;
  status: "sent" | "unlinked" | "failed" | "already_sent";
  message: string;
  warning?: string;
  error?: string;
  details?: string;
  bill_id: string;
  bill_image_url?: string;
  psid?: string;
}> {
  const db = readDB();
  const room = db.rooms?.find((r: any) => r.id === tenant.room_id);
  const roomNumber = room?.room_number || bill.room_number || "N/A";
  const forceRetry = options?.forceRetry || false;

  // 1. DUPLICATE PREVENTION (Requirement 14)
  if (bill.notification_sent && !forceRetry) {
    console.log(`[DUPLICATE PREVENTION] Bill notification already sent for bill ID ${bill.id}`);
    return {
      success: true,
      status: "already_sent",
      bill_id: bill.id,
      bill_image_url: bill.bill_image_url,
      message: "Bill notification already sent."
    };
  }

  // 2. Resolve Public Base URL and generate PNG
  const publicBaseUrl = getPublicBaseUrl(options?.req);
  const publicImageUrl = `${publicBaseUrl}/api/billing/${bill.id}/image.png`;
  bill.bill_image_url = publicImageUrl;

  let pngBuffer: Buffer;
  try {
    pngBuffer = generateBillPng(bill);
  } catch (err: any) {
    console.error("Failed to generate bill PNG:", err);
    pngBuffer = Buffer.from("");
  }

  // Save image file to uploads / Firebase Storage if available
  if (pngBuffer && pngBuffer.length > 0) {
    try {
      const base64Data = pngBuffer.toString("base64");
      const uploadRes = await dbService.uploadFile(`bill_${bill.id}.png`, `data:image/png;base64,${base64Data}`);
      if (uploadRes.url && uploadRes.url.startsWith("http")) {
        bill.bill_image_url = uploadRes.url;
      }
    } catch (e: any) {
      console.warn("Storage upload optional sync note:", e?.message);
    }
  }

  // Check tenant's linked Messenger PSID
  const rawPsid = tenant.facebook_psid || tenant.messenger_psid || "";
  const targetPsid = String(rawPsid).trim();
  const isLinked = Boolean(targetPsid && targetPsid !== "none" && targetPsid !== "false" && /^\d+$/.test(targetPsid));

  // 3. UNLINKED TENANT HANDLING (Do NOT send to any other tenant!)
  if (!isLinked) {
    console.warn(`[UNLINKED TENANT] Tenant ${tenant.name} has no linked Facebook Messenger account. Bill saved.`);
    
    // Save bill in DB with image url
    const billIdx = db.billingRecords?.findIndex((b: any) => b.id === bill.id);
    if (billIdx !== -1 && billIdx !== undefined) {
      db.billingRecords[billIdx].bill_image_url = bill.bill_image_url;
      writeDB(db);
    }

    logTransaction(db, {
      category: "billing",
      action: "update",
      title: "Visual Bill Ready (Unlinked Messenger)",
      details: `Generated visual bill for ${tenant.name} (Room ${roomNumber}). Tenant has not yet connected their Facebook Messenger account.`,
      amount: Number(bill.total_amount || 0),
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      room_number: roomNumber
    });
    writeDB(db);

    return {
      success: true,
      status: "unlinked",
      bill_id: bill.id,
      bill_image_url: bill.bill_image_url,
      warning: "⚠️ Statement deployed, but this tenant has no linked Messenger account.",
      message: "⚠️ Statement deployed, but this tenant has no linked Messenger account."
    };
  }

  // 4. PREPARE MESSENGER NOTIFICATION (Requirements 8 & 9)
  const shortIntroText =
    `🏠 ApartmentPro\n\n` +
    `Your monthly bill for ${bill.billing_month} is ready.\n\n` +
    `Total Amount Due:\n${formatPHP(bill.total_amount)}\n\n` +
    `Due Date:\n${bill.due_date}\n\n` +
    `Please see the attached bill for the complete breakdown.`;

  // Standard ApartmentPro Messenger Action Menu (Requirement 9)
  const billQuickReplies = [
    { content_type: "text", title: "💰 View Balance", payload: "GET_BALANCE" },
    { content_type: "text", title: "📋 History", payload: "GET_HISTORY" },
    { content_type: "text", title: "💳 Send Payment", payload: "SEND_PAYMENT" }
  ];

  try {
    // Step 4A: Send introductory text message
    const introRes = await sendFacebookMessage(targetPsid, {
      text: shortIntroText
    });

    if (!introRes.success) {
      console.warn("Intro text dispatch note:", introRes.error);
    }

    // Step 4B: Send Visual Bill Image (Requirement 2 & 8)
    // First try direct multipart buffer upload so Facebook doesn't need external fetch
    let imageSendRes: { success: boolean; error?: string; message_id?: string } = { success: false };

    if (pngBuffer && pngBuffer.length > 0) {
      imageSendRes = await sendFacebookMessage(targetPsid, {
        fileBuffer: pngBuffer,
        fileName: `bill_${bill.id}.png`,
        quick_replies: billQuickReplies
      });
    }

    // Fallback to public URL attachment if multipart direct upload did not succeed
    if (!imageSendRes.success) {
      console.log(`Trying URL image attachment for PSID ${targetPsid}: ${publicImageUrl}`);
      imageSendRes = await sendFacebookMessage(targetPsid, {
        attachment: {
          type: "image",
          payload: {
            url: publicImageUrl,
            is_reusable: true
          }
        },
        quick_replies: billQuickReplies
      });
    }

    // 5. EVALUATE RESULT
    if (imageSendRes.success || introRes.success) {
      // Success: Record that notification was sent
      bill.notification_sent = true;
      bill.notification_sent_at = new Date().toISOString();
      bill.notification_channel = "messenger";

      const billIdx = db.billingRecords?.findIndex((b: any) => b.id === bill.id);
      if (billIdx !== -1 && billIdx !== undefined) {
        db.billingRecords[billIdx] = { ...db.billingRecords[billIdx], ...bill };
      }

      // Add Notification item
      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: `notif-${Date.now()}`,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        billing_id: bill.id,
        message: `Visual monthly bill for ${bill.billing_month} sent via Messenger to ${tenant.name}. Total due: ${formatPHP(bill.total_amount)}.`,
        type: "billing",
        status: "sent",
        channel: "messenger",
        created_at: new Date().toISOString()
      });

      logTransaction(db, {
        category: "billing",
        action: "update",
        title: "Visual Bill Sent via Messenger",
        details: `Digital monthly bill statement delivered to ${tenant.name} via Facebook Messenger (PSID: ${targetPsid}). Total due: ${formatPHP(bill.total_amount)}.`,
        amount: Number(bill.total_amount || 0),
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        room_number: roomNumber
      });
      writeDB(db);

      return {
        success: true,
        status: "sent",
        bill_id: bill.id,
        bill_image_url: bill.bill_image_url,
        psid: targetPsid,
        message: `✅ Statement sent successfully to ${tenant.name} via Messenger.`
      };
    } else {
      // 6. MESSENGER FAILURE (Requirement 15)
      // DO NOT delete the bill. Keep the bill in the database.
      console.error(`Messenger delivery failed for tenant ${tenant.name}:`, imageSendRes.error || introRes.error);

      logTransaction(db, {
        category: "billing",
        action: "update",
        title: "Messenger Bill Dispatch Failed",
        details: `Failed to deliver monthly bill to ${tenant.name} via Messenger. Error: ${imageSendRes.error || introRes.error || "Graph API delivery rejected"}`,
        amount: Number(bill.total_amount || 0),
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        room_number: roomNumber
      });
      writeDB(db);

      return {
        success: false,
        status: "failed",
        bill_id: bill.id,
        bill_image_url: bill.bill_image_url,
        error: "Bill saved successfully, but Messenger notification could not be delivered.",
        message: "Bill saved successfully, but Messenger notification could not be delivered.",
        details: imageSendRes.error || introRes.error
      };
    }
  } catch (deliveryErr: any) {
    console.error("Unexpected error in sendVisualBillToMessenger:", deliveryErr);
    return {
      success: false,
      status: "failed",
      bill_id: bill.id,
      bill_image_url: bill.bill_image_url,
      error: "Bill saved successfully, but Messenger notification could not be delivered.",
      message: "Bill saved successfully, but Messenger notification could not be delivered.",
      details: deliveryErr?.message || String(deliveryErr)
    };
  }
}
