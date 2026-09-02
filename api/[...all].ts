import app from "../server";

export default function handler(req: any, res: any) {
  // Normalize req.url if needed
  if (req.headers && req.headers["x-matched-path"] && req.url === "/api") {
    req.url = req.headers["x-matched-path"];
  }
  return app(req, res);
}
