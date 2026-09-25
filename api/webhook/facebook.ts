// Dedicated Vercel Serverless Function for Facebook Messenger Webhook
// Route: /api/webhook/facebook
// Uses relative path import with explicit .js extension to pre-bundled ESM chatbotService

import {
  handleMessengerWebhookEvent,
  runSafeTokenDiagnostic,
  processChatbotMessage,
  getMaintenanceSession,
  clearMaintenanceSession,
  saveMaintenanceSession,
  standardQuickReplies,
  sendFacebookMessage,
  splitMessageIntoChunks
} from "../../src/server/chatbotService";

export {
  handleMessengerWebhookEvent,
  runSafeTokenDiagnostic,
  processChatbotMessage,
  getMaintenanceSession,
  clearMaintenanceSession,
  saveMaintenanceSession,
  standardQuickReplies,
  sendFacebookMessage,
  splitMessageIntoChunks
};

// Helper to robustly parse body in various Vercel / serverless runtimes
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
    if (typeof req.on !== "function") {
      return resolve({});
    }
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
            // Process incoming message with unified ApartmentPro Maintenance & Chatbot Service
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
