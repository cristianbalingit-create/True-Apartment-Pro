/**
 * RentFlow — Messenger Account Linking Security Service
 * Implements: one-to-one PSID enforcement, OTP verification, security logging,
 * rate limiting, admin alerts, and atomic Firestore transactions.
 *
 * All security checks are backend-enforced. Frontend state is never trusted.
 */

import * as crypto from "crypto";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type SecurityEventType =
  | "LINK_SUCCESS"
  | "LINK_REJECTED_ALREADY_LINKED"
  | "LINK_REJECTED_PSID_IN_USE"
  | "LINK_REJECTED_OTP_INVALID"
  | "LINK_REJECTED_OTP_EXPIRED"
  | "LINK_REJECTED_RATE_LIMITED"
  | "LINK_REJECTED_ATTEMPT_LIMIT"
  | "OTP_GENERATED"
  | "OTP_RESEND_REJECTED"
  | "UNLINK_SUCCESS"
  | "UNLINK_REJECTED_UNAUTHORIZED"
  | "ADMIN_UNLINK_SUCCESS"
  | "CONCURRENT_LINK_BLOCKED";

export interface SecurityLogEntry {
  id: string;
  event: SecurityEventType;
  timestamp: string;
  tenantId?: string;          // always present when a tenant record is involved
  attemptedPsid?: string;     // masked/partial — never the full raw PSID
  outcome: "BLOCKED" | "ALLOWED";
  details: string;            // human-readable, safe for admin view
  reviewed?: boolean;
}

export interface OtpRecord {
  tenantId: string;
  codeHash: string;           // SHA-256 of the code — never stored in plaintext
  expiresAt: number;          // epoch ms
  attempts: number;
  resendCount: number;
  lastResendAt: number;
  createdAt: number;
}

// ---------------------------------------------------------------------------
// In-memory stores (survive the serverless warm instance; Firestore is source of truth)
// ---------------------------------------------------------------------------

const otpStore = new Map<string, OtpRecord>();          // key: tenantId
const linkLockSet = new Set<string>();                   // tenantIds currently being linked (concurrency guard)
const psidRateLimiter = new Map<string, number[]>();    // key: masked PSID → timestamps

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const OTP_TTL_MS         = 5 * 60 * 1000;   // 5 minutes
const OTP_MAX_ATTEMPTS   = 3;
const OTP_MAX_RESENDS    = 2;
const OTP_RESEND_COOLDOWN_MS = 60 * 1000;   // 1 minute between resends
const RATE_LIMIT_WINDOW_MS   = 10 * 60 * 1000; // 10-minute window
const RATE_LIMIT_MAX_TRIES   = 5;            // max linking attempts per PSID per window

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Mask a PSID for safe logging: show first 4 and last 3 chars */
function maskPsid(psid: string): string {
  if (!psid || psid.length < 8) return "***";
  return `${psid.slice(0, 4)}***${psid.slice(-3)}`;
}

/** SHA-256 of a value — used for OTP storage */
function sha256(value: string): string {
  return crypto.createHash("sha256").update(value).digest("hex");
}

/** Generate a cryptographically random 6-digit OTP */
function generateOtpCode(): string {
  const buf = crypto.randomBytes(3);
  const num = (buf.readUInt16BE(0) % 900000) + 100000;
  return String(num);
}

/** Unique ID for log entries */
function newId(): string {
  return `sec_${Date.now()}_${crypto.randomBytes(4).toString("hex")}`;
}

// ---------------------------------------------------------------------------
// Rate limiter
// ---------------------------------------------------------------------------

/**
 * Returns true if the PSID has exceeded the allowed linking attempt rate.
 * Operates on masked PSIDs so the limiter itself never stores full PSIDs.
 */
export function isRateLimited(rawPsid: string): boolean {
  const key = maskPsid(rawPsid);
  const now = Date.now();
  const times = (psidRateLimiter.get(key) || []).filter(t => now - t < RATE_LIMIT_WINDOW_MS);
  times.push(now);
  psidRateLimiter.set(key, times);
  return times.length > RATE_LIMIT_MAX_TRIES;
}

// ---------------------------------------------------------------------------
// OTP management
// ---------------------------------------------------------------------------

export interface OtpGenerateResult {
  success: boolean;
  code?: string;          // returned so caller can deliver it — never persisted plaintext
  error?: "RATE_LIMITED" | "RESEND_TOO_SOON" | "RESEND_LIMIT";
}

/**
 * Generates (or regenerates) an OTP for the given tenant.
 * Enforces resend cooldown and resend limit.
 * Returns the plaintext code once — caller must deliver it and discard.
 */
export function generateOtp(tenantId: string): OtpGenerateResult {
  const existing = otpStore.get(tenantId);
  const now = Date.now();

  if (existing) {
    if (existing.resendCount >= OTP_MAX_RESENDS) {
      return { success: false, error: "RESEND_LIMIT" };
    }
    if (now - existing.lastResendAt < OTP_RESEND_COOLDOWN_MS) {
      return { success: false, error: "RESEND_TOO_SOON" };
    }
  }

  const code = generateOtpCode();
  const record: OtpRecord = {
    tenantId,
    codeHash: sha256(code),
    expiresAt: now + OTP_TTL_MS,
    attempts: 0,
    resendCount: existing ? existing.resendCount + 1 : 0,
    lastResendAt: now,
    createdAt: existing?.createdAt ?? now,
  };
  otpStore.set(tenantId, record);

  return { success: true, code };
}

export interface OtpVerifyResult {
  valid: boolean;
  reason?: "NOT_FOUND" | "EXPIRED" | "ATTEMPT_LIMIT" | "WRONG_CODE";
}

/**
 * Verifies a submitted OTP code against the stored hash.
 * Enforces attempt limit and expiry. Clears on success.
 */
export function verifyOtp(tenantId: string, submittedCode: string): OtpVerifyResult {
  const record = otpStore.get(tenantId);
  if (!record) return { valid: false, reason: "NOT_FOUND" };
  if (Date.now() > record.expiresAt) {
    otpStore.delete(tenantId);
    return { valid: false, reason: "EXPIRED" };
  }
  if (record.attempts >= OTP_MAX_ATTEMPTS) {
    otpStore.delete(tenantId);
    return { valid: false, reason: "ATTEMPT_LIMIT" };
  }

  const submittedHash = sha256(submittedCode.trim());
  if (submittedHash !== record.codeHash) {
    record.attempts += 1;
    otpStore.set(tenantId, record);
    return { valid: false, reason: "WRONG_CODE" };
  }

  // Success — clear the OTP so it cannot be reused
  otpStore.delete(tenantId);
  return { valid: true };
}

/** Returns seconds remaining for an OTP, or 0 if expired/missing */
export function otpSecondsRemaining(tenantId: string): number {
  const record = otpStore.get(tenantId);
  if (!record) return 0;
  return Math.max(0, Math.floor((record.expiresAt - Date.now()) / 1000));
}

// ---------------------------------------------------------------------------
// Concurrency lock (prevents simultaneous linking of the same tenant)
// ---------------------------------------------------------------------------

export function acquireLinkLock(tenantId: string): boolean {
  if (linkLockSet.has(tenantId)) return false;
  linkLockSet.add(tenantId);
  return true;
}

export function releaseLinkLock(tenantId: string): void {
  linkLockSet.delete(tenantId);
}

// ---------------------------------------------------------------------------
// Security log (in-memory, flushed to Firestore by caller)
// ---------------------------------------------------------------------------

const securityLog: SecurityLogEntry[] = [];

export function logSecurityEvent(entry: Omit<SecurityLogEntry, "id" | "timestamp">): SecurityLogEntry {
  const full: SecurityLogEntry = {
    ...entry,
    id: newId(),
    timestamp: new Date().toISOString(),
    reviewed: false,
  };
  securityLog.push(full);
  // Keep in-memory log bounded
  if (securityLog.length > 500) securityLog.splice(0, 100);
  return full;
}

export function getSecurityLog(): SecurityLogEntry[] {
  return [...securityLog];
}

// ---------------------------------------------------------------------------
// Duplicate-event deduplication (idempotency guard for webhook retries)
// ---------------------------------------------------------------------------

const recentEventIds = new Set<string>();
const EVENT_DEDUP_TTL_MS = 60 * 1000;
const recentEventTimestamps = new Map<string, number>();

/**
 * Returns true if this event ID has already been processed within the dedup window.
 * Call with the Facebook message mid or a composite key.
 */
export function isDuplicateEvent(eventId: string): boolean {
  const now = Date.now();
  // Evict expired entries
  for (const [id, ts] of recentEventTimestamps.entries()) {
    if (now - ts > EVENT_DEDUP_TTL_MS) {
      recentEventIds.delete(id);
      recentEventTimestamps.delete(id);
    }
  }
  if (recentEventIds.has(eventId)) return true;
  recentEventIds.add(eventId);
  recentEventTimestamps.set(eventId, now);
  return false;
}
