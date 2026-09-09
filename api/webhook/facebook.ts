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

// Official Facebook Page for ApartmentPro
const OFFICIAL_PAGE_ID = (process.env.FACEBOOK_PAGE_ID || process.env.PAGE_ID || "3246715018859879").trim();
const OFFICIAL_PAGE_NAME = "ApartmentPro";
const RETIRED_OLD_PAGE_ID = "1049465111594454";
const RETIRED_OLD_PAGE_NAME = "FullReddit";

async function runSafeTokenDiagnostic(webhookPageId?: string): Promise<{
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

  // 1. Check if token is a Page Access Token via /me?fields=id,name
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

  // 2. If /me requires pages_read_engagement, extract identity from /me/conversations
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

  // 3. Fallback check on /me/messenger_profile to verify token validity on a Page
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

            // Safe Diagnostic: Verify Token Identity & Page Match
            const webhookPageId = entry.id || webhook_event.recipient?.id;
            await runSafeTokenDiagnostic(webhookPageId);

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

