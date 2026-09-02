let cachedApp: any = null;

async function getApp() {
  if (!cachedApp) {
    let serverMod: any;
    try {
      serverMod = await import("../dist/server.cjs");
    } catch {
      try {
        serverMod = await import("../server.js");
      } catch {
        serverMod = await import("../server.ts");
      }
    }
    cachedApp = serverMod?.default?.default || serverMod?.default || serverMod?.app || serverMod;
  }
  return cachedApp;
}

export default async function handler(req: any, res: any) {
  try {
    const expressApp = await getApp();

    // Restore original URL when Vercel rewrites wildcard /api/(.*) to /api
    const originalUrl = (req.headers && (
      req.headers["x-matched-path"] ||
      req.headers["x-vercel-matched-path"] ||
      req.headers["x-forwarded-uri"] ||
      req.headers["x-invoke-path"]
    )) || req.url;

    if (originalUrl && originalUrl.startsWith("/api") && (req.url === "/api" || req.url?.startsWith("/api?"))) {
      if (req.url.includes("?") && !originalUrl.includes("?")) {
        req.url = originalUrl + req.url.substring(req.url.indexOf("?"));
      } else {
        req.url = originalUrl;
      }
    }

    return expressApp(req, res);
  } catch (err: any) {
    console.error("Vercel Serverless Invocation Error in /api/index:", err);
    if (res.status) {
      return res.status(500).json({
        error: "FUNCTION_INVOCATION_FAILED",
        message: err?.message || String(err),
        code: err?.code,
        stack: err?.stack
      });
    }
    res.statusCode = 500;
    res.setHeader("Content-Type", "application/json");
    return res.end(JSON.stringify({
      error: "FUNCTION_INVOCATION_FAILED",
      message: err?.message || String(err),
      code: err?.code
    }));
  }
}

