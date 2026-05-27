import type { Request, Response } from "express";
import * as responseService from "../services/responseService.js";
import { resolveActor } from "../middleware/auth.js";
import { ModerationBlockedError } from "../modules/civic.moderation/errors.js";
import { requireModeration } from "../modules/civic.moderation/service.js";

export async function handlePostResponse(req: Request, res: Response): Promise<void> {
  try {
    const actor = await resolveActor(res, (req.params.slug as string));

    // Moderation check
    await requireModeration(req.body.content ?? "");

    const response = await responseService.postResponse(
      (req.params.slug as string),
      (req.params.id as string),
      req.body,
      actor,
    );
    res.status(201).json(response);
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      res.status(400).json({
        error: "Content blocked",
        reason: err.violation_reason,
      });
      return;
    }
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

export async function handleEditResponse(req: Request, res: Response): Promise<void> {
  try {
    const actor = await resolveActor(res, (req.params.slug as string));

    // Moderation check
    await requireModeration(req.body.content ?? "");

    const response = await responseService.editResponse(
      (req.params.slug as string),
      (req.params.id as string),
      req.body,
      actor,
    );
    res.json(response);
  } catch (err) {
    if (err instanceof ModerationBlockedError) {
      res.status(400).json({
        error: "Content blocked",
        reason: err.violation_reason,
      });
      return;
    }
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
