import app from "../server.ts";

export default function handler(req: any, res: any) {
  const expressApp = (app as any).default || app;

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
}
