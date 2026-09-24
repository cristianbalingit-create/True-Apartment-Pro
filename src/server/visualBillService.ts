import fs from "fs";
import path from "path";
import os from "os";
import { Resvg } from "@resvg/resvg-js";
import type { BillingRecord, Tenant } from "../types";
import { readDB, writeDB, logTransaction, sendFacebookMessage } from "./chatbotService";
import { dbService } from "./dbService";

// Helper to escape XML / SVG special characters
export function escapeXml(unsafe: string | number | undefined | null): string {
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
  if (bill.id && bill.id.startsWith("bill-")) {
    return bill.id.replace("bill-", "INV-");
  }
  return bill.id || `INV-${Date.now()}`;
}

// Exact Receipt Data Object matching user specification
export interface ReceiptDataObject {
  tenantName: string;
  roomNumber: string;
  billingPeriod: string;
  billNumber: string;
  dueDate: string;
  rent: number;
  electricityKwh: number;
  electricityRate: number;
  electricityAmount: number;
  waterCubicMeters: number;
  waterRate: number;
  waterAmount: number;
  otherCharges?: number;
  otherChargesDescription?: string;
  totalAmountDue: number;
  paymentStatus: string;
}

// Data validation before rendering
export function validateReceiptData(data: ReceiptDataObject): { valid: boolean; error?: string } {
  if (!data.tenantName || data.tenantName.trim().length === 0) {
    return { valid: false, error: "Validation Error: Tenant name is missing. Please assign a tenant name." };
  }
  if (!data.roomNumber || data.roomNumber.trim().length === 0) {
    return { valid: false, error: "Validation Error: Room number is missing. Please assign a room number." };
  }
  if (!data.billingPeriod || data.billingPeriod.trim().length === 0) {
    return { valid: false, error: "Validation Error: Billing period is missing. Please set the billing period." };
  }
  if (!data.dueDate || data.dueDate.trim().length === 0) {
    return { valid: false, error: "Validation Error: Due date is missing. Please set the payment due date." };
  }
  if (typeof data.rent !== "number" || isNaN(data.rent) || data.rent < 0) {
    return { valid: false, error: "Validation Error: Rent amount is missing or invalid." };
  }
  if (typeof data.totalAmountDue !== "number" || isNaN(data.totalAmountDue) || data.totalAmountDue < 0) {
    return { valid: false, error: "Validation Error: Total amount due is missing or invalid." };
  }
  return { valid: true };
}

// Build receipt data object from database records
export function buildReceiptData(tenant: Tenant, bill: BillingRecord, db?: any): ReceiptDataObject {
  const tenantName = (bill.tenant_name || tenant.name || "").trim();

  let roomNumber = (bill.room_number || "").trim();
  if (!roomNumber && db?.rooms && tenant.room_id) {
    const room = db.rooms.find((r: any) => r.id === tenant.room_id);
    if (room && room.room_number) {
      roomNumber = room.room_number.trim();
    }
  }
  if (!roomNumber && tenant.room_id) {
    roomNumber = tenant.room_id.replace(/^room-/, "");
  }
  if (!roomNumber) {
    roomNumber = "101";
  }

  const billingPeriod = (bill.billing_month || "").trim();
  const billNumber = getBillReference(bill);
  const dueDate = (bill.due_date || "").trim();

  const rent = Number(bill.rent_amount || 0);
  const electricityKwh = Number(bill.electricity_usage || 0);
  const electricityAmount = Number(bill.electricity_amount || 0);
  const electricityRate = electricityKwh > 0 && electricityAmount > 0
    ? Number((electricityAmount / electricityKwh).toFixed(2))
    : Number((bill as any).electricity_rate || 10);

  const waterCubicMeters = Number(bill.water_usage || 0);
  const waterAmount = Number(bill.water_amount || 0);
  const waterRate = waterCubicMeters > 0 && waterAmount > 0
    ? Number((waterAmount / waterCubicMeters).toFixed(2))
    : Number((bill as any).water_rate || 35);

  const otherCharges = Number(bill.other_charges || 0);
  const otherChargesDescription = bill.other_charges_description;
  const totalAmountDue = Number(bill.total_amount || (rent + electricityAmount + waterAmount + otherCharges));
  const paymentStatus = (bill.payment_status || "UNPAID").toUpperCase();

  return {
    tenantName,
    roomNumber,
    billingPeriod,
    billNumber,
    dueDate,
    rent,
    electricityKwh,
    electricityRate,
    electricityAmount,
    waterCubicMeters,
    waterRate,
    waterAmount,
    otherCharges,
    otherChargesDescription,
    totalAmountDue,
    paymentStatus
  };
}

// Generate deterministic SVG receipt template matching the ApartmentPro design reference
export function generateReceiptSvg(data: ReceiptDataObject): string {
  const width = 800;

  // Payment status styling
  let statusBadgeBg = "#fee2e2";
  let statusBadgeBorder = "#f87171";
  let statusTextColor = "#dc2626";

  if (data.paymentStatus === "PAID") {
    statusBadgeBg = "#dcfce7";
    statusBadgeBorder = "#4ade80";
    statusTextColor = "#16a34a";
  } else if (data.paymentStatus === "OVERDUE") {
    statusBadgeBg = "#ffe4e6";
    statusBadgeBorder = "#fb7185";
    statusTextColor = "#b91c1c";
  } else if (data.paymentStatus.includes("PARTIAL")) {
    statusBadgeBg = "#f3e8ff";
    statusBadgeBorder = "#c084fc";
    statusTextColor = "#7e22ce";
  }

  // Sublines with calculations
  const rentSub = "Base Lease Rate";
  const electricitySub = data.electricityKwh > 0
    ? `${data.electricityKwh} kWh × ₱${data.electricityRate.toFixed(2)}/kWh`
    : "Metered Power Consumption";
  const waterSub = data.waterCubicMeters > 0
    ? `${data.waterCubicMeters} m³ × ₱${data.waterRate.toFixed(2)}/m³`
    : "Metered Water Consumption";

  // Rows definition with clean vector SVG icons (NO emojis to avoid missing glyphs)
  const rows: Array<{
    title: string;
    sub: string;
    amount: number;
    iconSvg: string;
  }> = [
    {
      title: "Monthly Room Rent",
      sub: rentSub,
      amount: data.rent,
      // Home icon path
      iconSvg: `<path d="M3 10.5L12 3l9 7.5v9a1.5 1.5 0 0 1-1.5 1.5H15v-6h-6v6H4.5A1.5 1.5 0 0 1 3 19.5v-9z" fill="#0284c7"/>`
    },
    {
      title: "Electricity",
      sub: electricitySub,
      amount: data.electricityAmount,
      // Lightning icon path
      iconSvg: `<path d="M13 2L3 14h7v8l11-12h-8l1-8z" fill="#f59e0b"/>`
    },
    {
      title: "Water",
      sub: waterSub,
      amount: data.waterAmount,
      // Water droplet path
      iconSvg: `<path d="M12 2.69l5.66 5.66a8 8 0 1 1-11.31 0z" fill="#06b6d4"/>`
    }
  ];

  if (data.otherCharges && data.otherCharges > 0) {
    rows.push({
      title: "Other Charges",
      sub: data.otherChargesDescription || "Property Services & Add-on Fees",
      amount: data.otherCharges,
      // Document path
      iconSvg: `<path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8zM14 2v6h6M16 13H8M16 17H8M10 9H8" fill="#64748b"/>`
    });
  }

  const startY = 380;
  const rowHeight = 74;
  const rowsSvg = rows
    .map((row, i) => {
      const y = startY + i * rowHeight;
      return `
      <!-- Row ${i + 1}: ${escapeXml(row.title)} -->
      <g transform="translate(50, ${y})">
        <rect width="700" height="66" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
        <g transform="translate(20, 20) scale(1.1)">
          ${row.iconSvg}
        </g>
        <text x="62" y="32" font-family="FreeSans" font-size="18" font-weight="bold" fill="#0f172a">
          ${escapeXml(row.title)}
        </text>
        <text x="62" y="52" font-family="FreeSans" font-size="12" fill="#64748b">
          ${escapeXml(row.sub)}
        </text>
        <text x="676" y="42" text-anchor="end" font-family="FreeSans" font-size="22" font-weight="bold" fill="#0f172a">
          ${formatPHP(row.amount)}
        </text>
      </g>
      `;
    })
    .join("");

  const totalBoxY = startY + rows.length * rowHeight + 15;
  const footerY = totalBoxY + 165;
  const totalHeight = footerY + 115;

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${totalHeight}" viewBox="0 0 ${width} ${totalHeight}">
  <defs>
    <linearGradient id="headerGrad" x1="0%" y1="0%" x2="100%" y2="100%">
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

  <!-- Canvas Background -->
  <rect width="${width}" height="${totalHeight}" fill="#f1f5f9"/>

  <!-- Main Statement Card -->
  <rect x="25" y="20" width="750" height="${totalHeight - 40}" rx="22" fill="#ffffff" stroke="#cbd5e1" stroke-width="2" filter="url(#cardShadow)"/>

  <!-- Brand Accent Top Bar -->
  <path d="M 25 42 A 22 22 0 0 1 47 20 L 753 20 A 22 22 0 0 1 775 42 L 775 32 L 25 32 Z" fill="url(#accentBar)"/>

  <!-- Header Banner -->
  <g transform="translate(50, 48)">
    <rect width="700" height="110" rx="16" fill="url(#headerGrad)"/>
    <circle cx="650" cy="55" r="75" fill="#fb6c00" opacity="0.12"/>
    
    <text x="32" y="44" font-family="FreeSans" font-size="28" font-weight="bold" fill="#ffffff" letter-spacing="1">
      APARTMENTPRO
    </text>
    <text x="32" y="74" font-family="FreeSans" font-size="16" font-weight="bold" fill="#fb923c" letter-spacing="1">
      MONTHLY BILL
    </text>
    <text x="32" y="96" font-family="FreeSans" font-size="12" fill="#94a3b8">
      Official Utility &amp; Rent Statement
    </text>

    <!-- Bill Reference Pill -->
    <rect x="525" y="36" width="145" height="34" rx="8" fill="#1e293b" stroke="#334155" stroke-width="1.2"/>
    <text x="597" y="58" text-anchor="middle" font-family="FreeSans" font-size="12" font-weight="bold" fill="#cbd5e1">
      ${escapeXml(data.billNumber)}
    </text>
  </g>

  <!-- Tenant Details Card (High Contrast, Elder-Friendly) -->
  <g transform="translate(50, 175)">
    <rect width="700" height="165" rx="16" fill="#f8fafc" stroke="#cbd5e1" stroke-width="1.5"/>
    
    <!-- Tenant Name -->
    <text x="30" y="34" font-family="FreeSans" font-size="12" font-weight="bold" fill="#64748b" letter-spacing="1">
      TENANT
    </text>
    <text x="30" y="66" font-family="FreeSans" font-size="23" font-weight="bold" fill="#0f172a">
      ${escapeXml(data.tenantName)}
    </text>

    <!-- Room Number -->
    <text x="420" y="34" font-family="FreeSans" font-size="12" font-weight="bold" fill="#64748b" letter-spacing="1">
      ROOM
    </text>
    <text x="420" y="66" font-family="FreeSans" font-size="23" font-weight="bold" fill="#0f172a">
      ${escapeXml(data.roomNumber)}
    </text>

    <!-- Divider Line -->
    <line x1="30" y1="90" x2="670" y2="90" stroke="#e2e8f0" stroke-width="1.5"/>

    <!-- Billing Period -->
    <text x="30" y="118" font-family="FreeSans" font-size="12" font-weight="bold" fill="#64748b" letter-spacing="1">
      BILLING PERIOD
    </text>
    <text x="30" y="146" font-family="FreeSans" font-size="18" font-weight="bold" fill="#1e293b">
      ${escapeXml(data.billingPeriod)}
    </text>

    <!-- Due Date (High Contrast Warning Color) -->
    <text x="420" y="118" font-family="FreeSans" font-size="12" font-weight="bold" fill="#64748b" letter-spacing="1">
      DUE DATE
    </text>
    <text x="420" y="146" font-family="FreeSans" font-size="19" font-weight="bold" fill="#dc2626">
      ${escapeXml(data.dueDate)}
    </text>
  </g>

  <!-- Section Title: BILL BREAKDOWN -->
  <g transform="translate(50, 362)">
    <text x="5" y="0" font-family="FreeSans" font-size="13" font-weight="bold" fill="#475569" letter-spacing="1">
      BILL BREAKDOWN
    </text>
    <line x1="150" y1="-4" x2="700" y2="-4" stroke="#cbd5e1" stroke-width="1"/>
  </g>

  <!-- Dynamic Item Rows -->
  ${rowsSvg}

  <!-- Grand Total Box (Massive Visual Prominence) -->
  <g transform="translate(50, ${totalBoxY})">
    <rect width="700" height="150" rx="18" fill="#0f172a" stroke="#1e293b" stroke-width="2"/>
    <circle cx="650" cy="50" r="85" fill="#fb6c00" opacity="0.12"/>

    <text x="32" y="40" font-family="FreeSans" font-size="13" font-weight="bold" fill="#94a3b8" letter-spacing="1.5">
      TOTAL AMOUNT DUE
    </text>

    <text x="32" y="92" font-family="FreeSans" font-size="44" font-weight="bold" fill="#ffffff" letter-spacing="0.5">
      ${formatPHP(data.totalAmountDue)}
    </text>

    <!-- Payment Status Badge -->
    <rect x="32" y="106" width="160" height="32" rx="7" fill="${statusBadgeBg}" stroke="${statusBadgeBorder}" stroke-width="1.5"/>
    <text x="112" y="127" text-anchor="middle" font-family="FreeSans" font-size="13" font-weight="bold" fill="${statusTextColor}" letter-spacing="1">
      ${escapeXml(data.paymentStatus)}
    </text>

    <text x="668" y="78" text-anchor="end" font-family="FreeSans" font-size="14" font-weight="bold" fill="#cbd5e1">
      Philippine Peso (PHP)
    </text>
    <text x="668" y="100" text-anchor="end" font-family="FreeSans" font-size="12" fill="#94a3b8">
      Rent &amp; utilities included
    </text>
  </g>

  <!-- Elder-Friendly Footer -->
  <g transform="translate(50, ${footerY})">
    <rect width="700" height="75" rx="12" fill="#f8fafc" stroke="#e2e8f0" stroke-width="1.5"/>
    <text x="350" y="34" text-anchor="middle" font-family="FreeSans" font-size="14" font-weight="bold" fill="#1e293b">
      Please settle your bill on or before the due date.
    </text>
    <text x="350" y="56" text-anchor="middle" font-family="FreeSans" font-size="13" fill="#64748b">
      Thank you! — ApartmentPro
    </text>
  </g>
</svg>`;
}

// Global cached font buffers for deterministic rendering
let cachedFontBuffers: Buffer[] | null = null;

export function getFontBuffers(): Buffer[] {
  if (cachedFontBuffers) return cachedFontBuffers;

  const fontCandidates = [
    path.join(process.cwd(), "src/server/fonts/FreeSans.ttf"),
    path.join(process.cwd(), "src/server/fonts/FreeSansBold.ttf"),
    "/usr/share/fonts/truetype/freefont/FreeSans.ttf",
    "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"
  ];

  const buffers: Buffer[] = [];
  for (const fp of fontCandidates) {
    try {
      if (fs.existsSync(fp)) {
        buffers.push(fs.readFileSync(fp));
      }
    } catch (e) {
      // ignore
    }
  }

  cachedFontBuffers = buffers;
  return buffers;
}

// Render Receipt PNG from ReceiptDataObject
export function renderReceiptPng(data: ReceiptDataObject): Buffer {
  // Validate required fields
  const validation = validateReceiptData(data);
  if (!validation.valid) {
    throw new Error(validation.error || "Invalid receipt data.");
  }

  const svg = generateReceiptSvg(data);
  const fontRegular = path.join(process.cwd(), "src/server/fonts/FreeSans.ttf");
  const fontBold = path.join(process.cwd(), "src/server/fonts/FreeSansBold.ttf");
  const fontFiles = [fontRegular, fontBold, "/usr/share/fonts/truetype/freefont/FreeSans.ttf", "/usr/share/fonts/truetype/freefont/FreeSansBold.ttf"].filter(p => fs.existsSync(p));

  const resvg = new Resvg(svg, {
    fitTo: {
      mode: "width",
      value: 800
    },
    font: {
      fontFiles: fontFiles.length > 0 ? fontFiles : undefined,
      defaultFontFamily: "FreeSans",
      loadSystemFonts: true
    }
  });

  const rendered = resvg.render();
  return Buffer.from(rendered.asPng());
}

// Backwards-compatible SVG generator
export function generateBillSvg(bill: BillingRecord): string {
  const db = readDB();
  const tenant = db.tenants?.find((t: any) => t.id === bill.tenant_id) || {
    id: bill.tenant_id,
    name: bill.tenant_name,
    room_id: bill.room_id
  };
  const data = buildReceiptData(tenant as Tenant, bill, db);
  return generateReceiptSvg(data);
}

// Backwards-compatible PNG generator
export function generateBillPng(bill: BillingRecord): Buffer {
  const db = readDB();
  const tenant = db.tenants?.find((t: any) => t.id === bill.tenant_id) || {
    id: bill.tenant_id,
    name: bill.tenant_name,
    room_id: bill.room_id
  };
  const data = buildReceiptData(tenant as Tenant, bill, db);
  return renderReceiptPng(data);
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
  const forceRetry = options?.forceRetry || false;

  // 1. DATA VALIDATION (Stop deployment immediately if required fields are missing!)
  const receiptData = buildReceiptData(tenant, bill, db);
  const validation = validateReceiptData(receiptData);
  if (!validation.valid) {
    console.error(`[VALIDATION FAILED] Missing required fields for tenant ${tenant.name}:`, validation.error);
    return {
      success: false,
      status: "failed",
      bill_id: bill.id,
      error: validation.error,
      message: validation.error
    };
  }

  // 2. DUPLICATE PREVENTION
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

  // 3. Resolve Public Base URL and render PNG image deterministically
  const publicBaseUrl = getPublicBaseUrl(options?.req);
  let publicImageUrl = `${publicBaseUrl}/api/billing/${bill.id}/image.png`;
  bill.bill_image_url = publicImageUrl;

  let pngBuffer: Buffer;
  try {
    pngBuffer = renderReceiptPng(receiptData);
  } catch (err: any) {
    console.error("Failed to render bill PNG:", err);
    return {
      success: false,
      status: "failed",
      bill_id: bill.id,
      error: `Failed to render receipt image: ${err?.message || "Unknown rendering error"}`,
      message: `Failed to render receipt image: ${err?.message || "Unknown rendering error"}`
    };
  }

  // 4. Upload image to Firebase Storage infrastructure (or uploads directory)
  if (pngBuffer && pngBuffer.length > 0) {
    try {
      const base64Data = pngBuffer.toString("base64");
      const uploadRes = await dbService.uploadFile(`bill_${bill.id}.png`, `data:image/png;base64,${base64Data}`);
      if (uploadRes.url && uploadRes.url.startsWith("http")) {
        publicImageUrl = uploadRes.url;
        bill.bill_image_url = uploadRes.url;
      }
    } catch (e: any) {
      console.warn("Storage upload note:", e?.message);
    }
  }

  // 5. Check tenant's linked Messenger PSID
  const rawPsid = tenant.facebook_psid || tenant.messenger_psid || "";
  const targetPsid = String(rawPsid).trim();
  const isLinked = Boolean(targetPsid && targetPsid !== "none" && targetPsid !== "false" && /^\d+$/.test(targetPsid));

  // If tenant is unlinked: Save bill in DB, log transaction, but DO NOT send to anyone else!
  if (!isLinked) {
    console.warn(`[UNLINKED TENANT] Tenant ${tenant.name} has no linked Facebook Messenger account. Bill saved.`);
    
    const billIdx = db.billingRecords?.findIndex((b: any) => b.id === bill.id);
    if (billIdx !== -1 && billIdx !== undefined) {
      db.billingRecords[billIdx].bill_image_url = bill.bill_image_url;
      writeDB(db);
    }

    logTransaction(db, {
      category: "billing",
      action: "update",
      title: "Visual Bill Ready (Unlinked Messenger)",
      details: `Generated visual bill for ${tenant.name} (Room ${receiptData.roomNumber}). Tenant has not yet connected their Facebook Messenger account.`,
      amount: Number(bill.total_amount || 0),
      tenant_id: tenant.id,
      tenant_name: tenant.name,
      room_number: receiptData.roomNumber
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

  // 6. PREPARE MESSENGER NOTIFICATION
  // Exact user requested companion text:
  const companionMessageText =
    `📋 Your monthly bill is ready.\n\n` +
    `Please review your attached statement and settle the total amount on or before the due date.\n\n` +
    `Thank you! — ApartmentPro`;

  const billQuickReplies = [
    { content_type: "text", title: "💰 View Balance", payload: "GET_BALANCE" },
    { content_type: "text", title: "📋 History", payload: "GET_HISTORY" },
    { content_type: "text", title: "💳 Send Payment", payload: "SEND_PAYMENT" }
  ];

  try {
    // Step A: Send ACTUAL GENERATED RECEIPT IMAGE first
    let imageSendRes: { success: boolean; error?: string; message_id?: string } = { success: false };

    if (pngBuffer && pngBuffer.length > 0) {
      imageSendRes = await sendFacebookMessage(targetPsid, {
        fileBuffer: pngBuffer,
        fileName: `bill_${bill.id}.png`
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
        }
      });
    }

    // Step B: Send companion text with quick reply actions
    let textSendRes: { success: boolean; error?: string; message_id?: string } = { success: false };
    if (imageSendRes.success) {
      textSendRes = await sendFacebookMessage(targetPsid, {
        text: companionMessageText,
        quick_replies: billQuickReplies
      });
    } else {
      console.warn("Visual bill image sending failed, checking fallback:", imageSendRes.error);
      const emergencyFallbackText =
        `🏠 ApartmentPro\n\n` +
        `Your monthly bill for ${receiptData.billingPeriod} is ready.\n\n` +
        `Total Amount Due: ${formatPHP(bill.total_amount)}\n` +
        `Due Date: ${receiptData.dueDate}\n\n` +
        `View Digital Bill: ${publicImageUrl}\n\n` +
        `Thank you! — ApartmentPro`;

      textSendRes = await sendFacebookMessage(targetPsid, {
        text: emergencyFallbackText,
        quick_replies: billQuickReplies
      });
    }

    // 7. EVALUATE RESULT
    if (imageSendRes.success || textSendRes.success) {
      bill.notification_sent = true;
      bill.notification_sent_at = new Date().toISOString();
      bill.notification_channel = "messenger";

      const billIdx = db.billingRecords?.findIndex((b: any) => b.id === bill.id);
      if (billIdx !== -1 && billIdx !== undefined) {
        db.billingRecords[billIdx] = { ...db.billingRecords[billIdx], ...bill };
      }

      if (!db.notifications) db.notifications = [];
      db.notifications.push({
        id: `notif-${Date.now()}`,
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        billing_id: bill.id,
        message: `Visual monthly bill for ${receiptData.billingPeriod} sent via Messenger to ${tenant.name}. Total due: ${formatPHP(bill.total_amount)}.`,
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
        room_number: receiptData.roomNumber
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
      console.error(`Messenger delivery failed for tenant ${tenant.name}:`, imageSendRes.error || textSendRes.error);

      logTransaction(db, {
        category: "billing",
        action: "update",
        title: "Messenger Bill Dispatch Failed",
        details: `Failed to deliver monthly bill to ${tenant.name} via Messenger. Error: ${imageSendRes.error || textSendRes.error || "Graph API delivery rejected"}`,
        amount: Number(bill.total_amount || 0),
        tenant_id: tenant.id,
        tenant_name: tenant.name,
        room_number: receiptData.roomNumber
      });
      writeDB(db);

      return {
        success: false,
        status: "failed",
        bill_id: bill.id,
        bill_image_url: bill.bill_image_url,
        error: "Bill saved successfully, but Messenger notification could not be delivered.",
        message: "Bill saved successfully, but Messenger notification could not be delivered.",
        details: imageSendRes.error || textSendRes.error
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
