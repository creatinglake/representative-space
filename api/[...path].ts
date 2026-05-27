/**
 * Vercel serverless catch-all function.
 * Strips the /api prefix and forwards to the Express app.
 */
import type { VercelRequest, VercelResponse } from "@vercel/node";
import app from "../src/app.js";

export default function handler(req: VercelRequest, res: VercelResponse) {
  // Strip /api prefix so Express routes match (e.g. /api/space/foo → /space/foo)
  req.url = req.url?.replace(/^\/api/, "") || "/";
  return app(req as any, res as any);
}
