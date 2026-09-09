// Dedicated Standalone Vercel Serverless Function for Facebook Messenger Webhook
// Route: /api/webhook/facebook

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

async function sendMessengerTestReply(senderId: string, replyText: string) {
  // Support both PAGE_ACCESS_TOKEN and FACEBOOK_PAGE_ACCESS_TOKEN environment variables
  const pageAccessToken = (process.env.PAGE_ACCESS_TOKEN || process.env.FACEBOOK_PAGE_ACCESS_TOKEN || "").trim();
  if (!pageAccessToken) {
    console.error("===== MESSENGER WEBHOOK ERROR =====");
    console.error("Neither PAGE_ACCESS_TOKEN nor FACEBOOK_PAGE_ACCESS_TOKEN is configured in environment variables.");
    return;
  }

  const graphVersion = process.env.FACEBOOK_GRAPH_VERSION || "v19.0";
  const url = `https://graph.facebook.com/${graphVersion}/me/messages`;

  const payload = {
    recipient: { id: senderId },
    message: { text: replyText }
  };

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${pageAccessToken}`
      },
      body: JSON.stringify(payload)
    });

    const responseText = await response.text();
    let responseData: any;
    try {
      responseData = JSON.parse(responseText);
    } catch {
      responseData = responseText;
    }

    if (!response.ok) {
      console.error("===== FACEBOOK SEND RESPONSE =====");
      console.error(`HTTP Status: ${response.status} ${response.statusText}`);
      console.error(typeof responseData === "object" ? JSON.stringify(responseData, null, 2) : responseData);
      console.error("===== MESSENGER WEBHOOK ERROR =====");
      console.error(responseData?.error?.message || "Failed to send message via Facebook Graph API");
    } else {
      console.log("===== FACEBOOK SEND RESPONSE =====");
      console.log(typeof responseData === "object" ? JSON.stringify(responseData, null, 2) : responseData);
    }
  } catch (err: any) {
    console.error("===== MESSENGER WEBHOOK ERROR =====");
    console.error(err?.message || String(err));
  }
}

export default async function handler(req: any, res: any) {
  // =========================================================================
  // 1. GET: Facebook Webhook Verification Endpoint
  // =========================================================================
  if (req.method === "GET") {
    const url = new URL(req.url || "", "http://localhost");
    const mode = req.query?.["hub.mode"] || (req.query?.["hub"] as any)?.mode || url.searchParams.get("hub.mode");
    const token = req.query?.["hub.verify_token"] || (req.query?.["hub"] as any)?.verify_token || url.searchParams.get("hub.verify_token");
    const challenge = req.query?.["hub.challenge"] || (req.query?.["hub"] as any)?.challenge || url.searchParams.get("hub.challenge");

    const configuredToken = process.env.FACEBOOK_VERIFY_TOKEN?.trim();
    const fallbackToken = "abc_apartment_verify_token";

    console.log("=== FACEBOOK WEBHOOK VERIFICATION (GET) ===");
    console.log("Received mode:", mode);
    console.log("Received token provided:", Boolean(token));
    console.log("Is FACEBOOK_VERIFY_TOKEN configured?", Boolean(configuredToken));

    if (mode === "subscribe" && token) {
      const receivedToken = String(token).trim();
      const isMatch = (configuredToken && receivedToken === configuredToken) || (receivedToken === fallbackToken);

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
          const messagingEvents = entry.messaging || [];
          for (const webhook_event of messagingEvents) {
            const senderId = webhook_event.sender?.id;
            if (!senderId) continue;

            // Extract message text, quick reply, or postback
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
            console.log(`Sender ID: ${senderId}`);
            console.log(`Message: ${messageText}`);

            // Temporary Connectivity Test Reply: Send fixed message
            await sendMessengerTestReply(senderId, "✅ Messenger webhook is working!");
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

