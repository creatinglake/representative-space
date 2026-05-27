import type { Request, Response } from "express";
import * as spaceService from "../services/spaceService.js";
import { getAuthUser, resolveActor } from "../middleware/auth.js";

export function handleCreateSpace(req: Request, res: Response): void {
  try {
    const user = getAuthUser(res);
    const space = spaceService.createSpace(req.body, user.id);
    res.status(201).json(space);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({ error: message });
  }
}

export function handleListSpaces(_req: Request, res: Response): void {
  const spaces = spaceService.getAllSpaces();
  res.json(spaces);
}

export function handleGetSpace(req: Request, res: Response): void {
  const slug = req.params.slug as string;
  const space = spaceService.getSpaceBySlug(slug);
  if (!space) {
    res.status(404).json({ error: "Space not found" });
    return;
  }
  res.json(space);
}

export function handleUpdateSpace(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const actor = resolveActor(res, slug);
    const updated = spaceService.updateSpace(slug, req.body, actor);
    res.json(updated);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("Not authorized")) {
      res.status(403).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleVerifyEntity(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const user = getAuthUser(res);
    const result = spaceService.verifyEntity(slug, user.id, req.body);
    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleArchiveSpace(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const user = getAuthUser(res);
    const { reason, successor_space_slug } = req.body ?? {};
    const space = spaceService.archiveSpace(slug, user.id, reason, successor_space_slug);
    res.json(space);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else if (message.includes("required")) {
      res.status(400).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export function handleUnarchiveSpace(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const user = getAuthUser(res);
    const space = spaceService.unarchiveSpace(slug, user.id);
    res.json(space);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}
