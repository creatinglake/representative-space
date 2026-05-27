import type { NextFunction, Request, Response } from "express";
import type { Actor } from "../auth/types.js";
import { getSpaceBySlug } from "../services/spaceService.js";

export interface AuthUser {
  id: string;
  email: string;
}

function extractToken(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) {
    return auth.slice(7);
  }
  return null;
}

function parseEmailList(raw: string | undefined): Set<string> {
  return new Set(
    (raw ?? "")
      .split(",")
      .map((e) => e.trim().toLowerCase())
      .filter((e) => e.length > 0),
  );
}

function adminEmails(): Set<string> {
  return parseEmailList(process.env.RS_ADMIN_EMAILS);
}

export function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  const token = extractToken(req);
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }
  res.locals.authUser = { id: token, email: token } satisfies AuthUser;
  next();
}

export function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  requireAuth(req, res, () => {
    const user = res.locals.authUser as AuthUser | undefined;
    if (!user) return;

    const allowed = adminEmails();
    if (allowed.size === 0) {
      res.status(503).json({
        error:
          "Admin access is not configured. Set RS_ADMIN_EMAILS on the server.",
      });
      return;
    }
    if (!allowed.has(user.email.toLowerCase())) {
      res.status(403).json({ error: "Admin access required" });
      return;
    }
    next();
  });
}

export function getAuthUser(res: Response): AuthUser {
  const user = res.locals.authUser as AuthUser | undefined;
  if (!user) {
    throw new Error(
      "getAuthUser called on an unauthenticated route (middleware missing)",
    );
  }
  return user;
}

export async function resolveActor(res: Response, spaceSlug?: string): Promise<Actor> {
  const user = getAuthUser(res);
  const admins = adminEmails();

  if (admins.has(user.email.toLowerCase())) {
    return { role: "admin", userId: user.id };
  }

  if (spaceSlug) {
    const space = await getSpaceBySlug(spaceSlug);
    if (
      space &&
      space.verification_status === "verified" &&
      space.entity_did === user.id
    ) {
      return { role: "verified_entity", userId: user.id, spaceSlug };
    }
  }

  return { role: "citizen", userId: user.id };
}
