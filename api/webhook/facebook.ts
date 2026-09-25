// Dedicated Vercel Serverless Function for Facebook Messenger Webhook
// Route: /api/webhook/facebook
// Loads the compiled production bundle dist/facebookWebhook.cjs via createRequire

import { createRequire } from "node:module";
import path from "node:path";
import fs from "node:fs";

const require = createRequire(import.meta.url);

let cachedWebhookModule: any = null;

function loadWebhookBundle(): any {
  if (cachedWebhookModule) {
    return cachedWebhookModule;
  }

  const candidatePaths = [
    path.join(process.cwd(), "dist", "facebookWebhook.cjs"),
    path.resolve(process.cwd(), "dist/facebookWebhook.cjs"),
    new URL("../../dist/facebookWebhook.cjs", import.meta.url).pathname,
    "/var/task/dist/facebookWebhook.cjs",
    path.join(process.cwd(), "../dist/facebookWebhook.cjs")
  ];

  for (const candidate of candidatePaths) {
    try {
      if (fs.existsSync(candidate)) {
        cachedWebhookModule = require(candidate);
        if (cachedWebhookModule) {
          console.log(`[Webhook Entrypoint] Successfully loaded dist bundle from: ${candidate}`);
          return cachedWebhookModule;
        }
      }
    } catch (e: any) {
      console.warn(`[Webhook Entrypoint] Warning loading candidate path ${candidate}:`, e?.message || e);
    }
  }

  // Fallback to relative require
  try {
    cachedWebhookModule = require("../../dist/facebookWebhook.cjs");
    return cachedWebhookModule;
  } catch (err: any) {
    try {
      cachedWebhookModule = require("./dist/facebookWebhook.cjs");
      return cachedWebhookModule;
    } catch (err2: any) {
      console.error("[Webhook Entrypoint CRITICAL] Failed to load dist/facebookWebhook.cjs:", err?.message || err, err2?.message || err2);
      throw new Error(`Cannot find or load dist/facebookWebhook.cjs: ${err?.message || err}`);
    }
  }
}

export async function handleMessengerWebhookEvent(event: any, webhookPageId?: string) {
  const mod = loadWebhookBundle();
  return mod.handleMessengerWebhookEvent(event, webhookPageId);
}

export async function runSafeTokenDiagnostic(targetPageId?: string) {
  const mod = loadWebhookBundle();
  return mod.runSafeTokenDiagnostic(targetPageId);
}

export async function processChatbotMessage(senderPsid: string, text: string, attachments?: any[], targetPageId?: string) {
  const mod = loadWebhookBundle();
  return mod.processChatbotMessage(senderPsid, text, attachments, targetPageId);
}

export function getMaintenanceSession(senderPsid: string) {
  const mod = loadWebhookBundle();
  return mod.getMaintenanceSession(senderPsid);
}

export function clearMaintenanceSession(senderPsid: string) {
  const mod = loadWebhookBundle();
  return mod.clearMaintenanceSession(senderPsid);
}

export function saveMaintenanceSession(senderPsid: string, session: any) {
  const mod = loadWebhookBundle();
  return mod.saveMaintenanceSession(senderPsid, session);
}

export async function sendFacebookMessage(recipientPsid: string, messagePayload: any, targetPageId?: string) {
  const mod = loadWebhookBundle();
  return mod.sendFacebookMessage(recipientPsid, messagePayload, targetPageId);
}

export function splitMessageIntoChunks(text: string, maxLength: number = 1900): string[] {
  const mod = loadWebhookBundle();
  return mod.splitMessageIntoChunks(text, maxLength);
}

export default async function handler(req: any, res: any) {
  try {
    const webhookModule = loadWebhookBundle();
    const webhookHandler = webhookModule.default || webhookModule.handler || webhookModule;

    if (typeof webhookHandler === "function") {
      return await webhookHandler(req, res);
    }

    throw new Error("dist/facebookWebhook.cjs does not export a valid default handler function");
  } catch (err: any) {
    console.error("Vercel Webhook Serverless Execution Error:", err);
    if (res.status) {
      return res.status(500).json({
        error: "WEBHOOK_HANDLER_FAILED",
        message: err?.message || String(err),
        code: err?.code,
        stack: err?.stack
      });
    }
    res.statusCode = 500;
    if (res.setHeader) res.setHeader("Content-Type", "application/json");
    return res.end(
      JSON.stringify({
        error: "WEBHOOK_HANDLER_FAILED",
        message: err?.message || String(err),
        code: err?.code
      })
    );
  }
}
