import type { IncomingMessage, ServerResponse } from "http";

export default async function handler(req: any, res: any) {
  // 1. GET: Facebook Webhook Verification
  if (req.method === "GET") {
    const rawVerifyToken = process.env.FACEBOOK_VERIFY_TOKEN || "abc_apartment_verify_token";
    const VERIFY_TOKEN = rawVerifyToken.trim();
    const fallbackToken = "abc_apartment_verify_token";

    // Support flat query keys (hub.mode) and nested query keys (hub: { mode })
    const query = req.query || {};
    const mode = query["hub.mode"] || (query["hub"] as any)?.mode;
    const token = query["hub.verify_token"] || (query["hub"] as any)?.verify_token;
    const challenge = query["hub.challenge"] || (query["hub"] as any)?.challenge;

    console.log("=== VERCEL DEDICATED FB WEBHOOK HANDLER (GET) ===");
    console.log("Query Params:", query);
    console.log("Parsed Verification fields:", { mode, token, challenge });
    console.log("Configured Verify Token:", `"${VERIFY_TOKEN}"`);

    if (mode && token) {
      const receivedToken = String(token).trim();
      const isMatch = (receivedToken === VERIFY_TOKEN) || (receivedToken === fallbackToken);

      if (mode === "subscribe" && isMatch) {
        console.log("✅ FACEBOOK_WEBHOOK_VERIFIED SUCCESSFULLY. Challenge returned:", challenge);
        res.setHeader("Content-Type", "text/plain");
        return res.status(200).send(String(challenge));
      } else {
        console.warn("❌ FACEBOOK_WEBHOOK_VERIFICATION FAILED: Match mismatch!");
        console.warn(`Expected: "${VERIFY_TOKEN}" or "${fallbackToken}", Received: "${receivedToken}", Mode: "${mode}"`);
        return res.status(403).send("Verification token mismatch");
      }
    }

    console.warn("❌ FACEBOOK_WEBHOOK_VERIFICATION FAILED: Missing mode or token query params.");
    return res.status(400).send("Missing hub.mode or hub.verify_token query parameter");
  }

  // 2. POST: Delegate to main server for messaging event processing
  try {
    const serverModule = await import("../../server.ts");
    const app = (serverModule as any).default?.default || (serverModule as any).default || (serverModule as any).app || serverModule;
    return app(req, res);
  } catch (err: any) {
    console.error("Error delegating to server in webhook handler:", err);
    // Respond 200 OK to Meta to prevent retry loops
    return res.status(200).send("EVENT_RECEIVED");
  }
}
