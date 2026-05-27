import { createHmac, timingSafeEqual } from "node:crypto";
import type { Request, Response, NextFunction } from "express";

export function requireHmac(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const secret = process.env.RS_INBOX_SECRET;
  if (!secret) {
    res
      .status(503)
      .json({ error: "Inbox not configured: RS_INBOX_SECRET not set" });
    return;
  }

  const signature = req.headers["x-civic-signature"] as string | undefined;
  if (!signature || !signature.startsWith("sha256=")) {
    res
      .status(401)
      .json({ error: "Missing or malformed X-Civic-Signature header" });
    return;
  }

  const rawBody = (req as any).rawBody as Buffer | undefined;
  if (!rawBody) {
    res
      .status(400)
      .json({ error: "Could not read request body for signature verification" });
    return;
  }

  const expected =
    "sha256=" + createHmac("sha256", secret).update(rawBody).digest("hex");
  const sigBuffer = Buffer.from(signature);
  const expectedBuffer = Buffer.from(expected);

  if (
    sigBuffer.length !== expectedBuffer.length ||
    !timingSafeEqual(sigBuffer, expectedBuffer)
  ) {
    res.status(403).json({ error: "Invalid signature" });
    return;
  }

  next();
}
