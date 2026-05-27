import type { NextFunction, Request, Response } from "express";
import { getSpaceBySlug } from "../stores/spaceStore.js";

export async function requireActiveSpace(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const slug = req.params.slug as string | undefined;
  if (!slug) {
    next();
    return;
  }

  const space = await getSpaceBySlug(slug);
  if (!space) {
    // Let the downstream handler deal with 404
    next();
    return;
  }

  if (space.lifecycle_state === "archived") {
    const body: Record<string, unknown> = {
      error: `Space "${slug}" is archived and no longer accepts new submissions.`,
    };
    if (space.successor_space_slug) {
      body.successor_space_slug = space.successor_space_slug;
    }
    res.status(403).json(body);
    return;
  }

  next();
}
