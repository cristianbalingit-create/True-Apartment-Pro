// Dedicated Vercel Serverless Function for Facebook Messenger Webhook
// Route: /api/webhook/facebook
// Production-safe bundled loader to eliminate Vercel ESM ERR_MODULE_NOT_FOUND

import { createRequire } from "module";
import path from "path";
import fs from "fs";

let loadedModule: any = null;

function getLoadedModule() {
  if (loadedModule) return loadedModule;

  // 1. Try createRequire with multiple candidate paths for Vercel / serverless runtimes
  try {
    const req = createRequire(import.meta.url);
    const candidatePaths = [
      path.resolve(process.cwd(), "dist/facebookWebhook.cjs"),
      path.resolve(process.cwd(), "dist/webhookFacebook.cjs"),
      path.resolve(process.cwd(), "dist/chatbotService.cjs"),
      new URL("../../dist/facebookWebhook.cjs", import.meta.url).pathname,
      new URL("../dist/facebookWebhook.cjs", import.meta.url).pathname
    ];

    for (const p of candidatePaths) {
      if (fs.existsSync(p)) {
        loadedModule = req(p);
        return loadedModule;
      }
    }
  } catch (err) {
    console.warn("createRequire notice in /api/webhook/facebook:", err);
  }

  return null;
}

async function getAsyncModule(): Promise<any> {
  const sync = getLoadedModule();
  if (sync) return sync;
  try {
    // @ts-ignore
    return await import("../../dist/facebookWebhook.cjs");
  } catch {
    try {
      // @ts-ignore
      return await import("../dist/facebookWebhook.cjs");
    } catch {
      // @ts-ignore
      return await import("../../src/server/facebookWebhook.ts");
    }
  }
}

export default async function handler(req: any, res: any) {
  let mod = getLoadedModule();

  if (!mod) {
    try {
      mod = await getAsyncModule();
    } catch (err: any) {
      console.error("FATAL: Failed to load facebookWebhook bundle in /api/webhook/facebook:", err);
      if (res.status) {
        return res.status(500).json({
          error: "WEBHOOK_INITIALIZATION_FAILED",
          message: err?.message || String(err)
        });
      }
      res.statusCode = 500;
      return res.end(JSON.stringify({ error: "WEBHOOK_INITIALIZATION_FAILED", message: err?.message }));
    }
  }

  const handlerFn = mod?.default?.default || mod?.default || mod;
  if (typeof handlerFn === "function") {
    return handlerFn(req, res);
  } else {
    console.error("Loaded module has no valid handler function:", mod);
    if (res.status) return res.status(500).send("Webhook handler not found");
    res.statusCode = 500;
    return res.end("Webhook handler not found");
  }
}

// Named exports for diagnostic and programmatic access
export async function handleMessengerWebhookEvent(...args: any[]) {
  const mod = await getAsyncModule();
  const fn = mod.handleMessengerWebhookEvent || mod.default?.handleMessengerWebhookEvent;
  return fn(...args);
}

export async function runSafeTokenDiagnostic(...args: any[]) {
  const mod = await getAsyncModule();
  const fn = mod.runSafeTokenDiagnostic || mod.default?.runSafeTokenDiagnostic;
  return fn(...args);
}

export async function processChatbotMessage(...args: any[]) {
  const mod = await getAsyncModule();
  const fn = mod.processChatbotMessage || mod.default?.processChatbotMessage;
  return fn(...args);
}

export async function getMaintenanceSession(...args: any[]) {
  const mod = await getAsyncModule();
  const fn = mod.getMaintenanceSession || mod.default?.getMaintenanceSession;
  return fn(...args);
}

export async function clearMaintenanceSession(...args: any[]) {
  const mod = await getAsyncModule();
  const fn = mod.clearMaintenanceSession || mod.default?.clearMaintenanceSession;
  return fn(...args);
}

export const standardQuickReplies = [
  { content_type: "text", title: "📋 History", payload: "GET_HISTORY" },
  { content_type: "text", title: "💳 Send Payment", payload: "SEND_PAYMENT" },
  { content_type: "text", title: "💰 Balances", payload: "GET_BALANCE" },
  { content_type: "text", title: "🔧 Maintenance", payload: "REPORT_MAINTENANCE" },
  { content_type: "text", title: "📢 Updates", payload: "VIEW_ANNOUNCEMENTS" },
  { content_type: "text", title: "📜 Rules", payload: "VIEW_RULES" }
];
