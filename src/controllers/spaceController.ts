import type { Request, Response } from "express";
import * as spaceService from "../services/spaceService.js";
import { getAuthUser, resolveActor } from "../middleware/auth.js";

export async function handleCreateSpace(req: Request, res: Response): Promise<void> {
  try {
    const user = getAuthUser(res);
    const space = await spaceService.createSpace(req.body, user.id);
    res.status(201).json(space);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    const status = message.includes("already exists") ? 409 : 400;
    res.status(status).json({ error: message });
  }
}

export async function handleListSpaces(_req: Request, res: Response): Promise<void> {
  const spaces = await spaceService.getAllSpaces();
  res.json(spaces);
}

export async function handleGetSpace(req: Request, res: Response): Promise<void> {
  const slug = req.params.slug as string;
  const space = await spaceService.getSpaceBySlug(slug);
  if (!space) {
    res.status(404).json({ error: "Space not found" });
    return;
  }
  res.json(space);
}

export async function handleUpdateSpace(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const actor = await resolveActor(res, slug);
    const updated = await spaceService.updateSpace(slug, req.body, actor);
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

export async function handleVerifyEntity(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const user = getAuthUser(res);
    const result = await spaceService.verifyEntity(slug, user.id, req.body);
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

export async function handleArchiveSpace(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const user = getAuthUser(res);
    const { reason, successor_space_slug } = req.body ?? {};
    const space = await spaceService.archiveSpace(slug, user.id, reason, successor_space_slug);
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

export async function handleUnarchiveSpace(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const user = getAuthUser(res);
    const space = await spaceService.unarchiveSpace(slug, user.id);
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
