import type { IncomingMessage, ServerResponse } from "http";

export default async function handler(req: any, res: any) {
  // 1. GET: Facebook Webhook Verification
  if (req.method === "GET") {
    // Read query params from either req.query (Vercel) or URL search params (fallback)
    const url = new URL(req.url || "", "http://localhost");
    const mode = req.query?.["hub.mode"] || (req.query?.["hub"] as any)?.mode || url.searchParams.get("hub.mode");
    const token = req.query?.["hub.verify_token"] || (req.query?.["hub"] as any)?.verify_token || url.searchParams.get("hub.verify_token");
    const challenge = req.query?.["hub.challenge"] || (req.query?.["hub"] as any)?.challenge || url.searchParams.get("hub.challenge");

    const configuredToken = process.env.FACEBOOK_VERIFY_TOKEN?.trim();

    console.log("=== FACEBOOK WEBHOOK VERIFICATION (STANDALONE VERCEL FUNCTION) ===");
    console.log("Received mode:", mode);
    console.log("Received token provided:", Boolean(token));
    console.log("Is FACEBOOK_VERIFY_TOKEN configured in environment?", Boolean(configuredToken));

    if (!configuredToken) {
      console.warn("FACEBOOK_VERIFY_TOKEN environment variable is not configured in Vercel.");
      if (res.setHeader) res.setHeader("Content-Type", "text/plain");
      if (res.status) {
        return res.status(500).send("FACEBOOK_VERIFY_TOKEN is not configured in Vercel environment variables");
      }
      res.statusCode = 500;
      return res.end("FACEBOOK_VERIFY_TOKEN is not configured in Vercel environment variables");
    }

    if (mode === "subscribe" && token && String(token).trim() === configuredToken) {
      console.log("FACEBOOK_WEBHOOK_VERIFIED SUCCESSFULLY. Challenge:", challenge);
      if (res.setHeader) res.setHeader("Content-Type", "text/plain");
      if (res.status) {
        return res.status(200).send(String(challenge));
      }
      res.statusCode = 200;
      return res.end(String(challenge));
    }

    console.warn("FACEBOOK_WEBHOOK_VERIFICATION FAILED: Token mismatch or invalid mode.");
    if (res.setHeader) res.setHeader("Content-Type", "text/plain");
    if (res.status) {
      return res.status(403).send("Verification token mismatch");
    }
    res.statusCode = 403;
    return res.end("Verification token mismatch");
  }

  // 2. POST: Delegate Messenger webhook events to backend
  if (req.method === "POST") {
    try {
      let serverModule: any;
      try {
        serverModule = await import("../../dist/server.cjs");
      } catch {
        try {
          serverModule = await import("../../server.js");
        } catch {
          serverModule = await import("../../server.ts");
        }
      }
      const app = serverModule?.default?.default || serverModule?.default || serverModule?.app || serverModule;
      return app(req, res);
    } catch (err: any) {
      console.error("Error handling POST webhook event:", err?.message || err);
      if (res.status) return res.status(200).send("EVENT_RECEIVED");
      res.statusCode = 200;
      return res.end("EVENT_RECEIVED");
    }
  }

  if (res.status) return res.status(405).send("Method Not Allowed");
  res.statusCode = 405;
  return res.end("Method Not Allowed");
}

