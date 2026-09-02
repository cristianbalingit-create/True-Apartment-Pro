import app from "../server";

export default function handler(req: any, res: any) {
  // If Vercel rewrote /api/... to /api, restore the original URL from headers if available
  const originalUrl = (req.headers && (req.headers["x-matched-path"] || req.headers["x-vercel-matched-path"])) || req.url;
  if (originalUrl && originalUrl.startsWith("/api") && req.url === "/api") {
    req.url = originalUrl;
  }
  return app(req, res);
}
