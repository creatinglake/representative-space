import type { Request, Response } from "express";
import * as positionService from "../services/positionService.js";
import { resolveActor } from "../middleware/auth.js";
import { ModerationBlockedError } from "../modules/civic.moderation/errors.js";
import { requireModeration } from "../modules/civic.moderation/service.js";

export async function handlePostPosition(req: Request, res: Response): Promise<void> {
  try {
    const actor = await resolveActor(res, (req.params.slug as string));

    // Moderation check
    const content = `${req.body.topic ?? ""}\n\n${req.body.statement ?? ""}`;
    await requireModeration(content);

    const position = await positionService.postPosition(
      (req.params.slug as string),
      req.body,
      actor,
    );
    res.status(201).json(position);
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

export async function handleEditPosition(req: Request, res: Response): Promise<void> {
  try {
    const actor = await resolveActor(res, (req.params.slug as string));

    // Moderation check
    const content = req.body.statement ?? "";
    await requireModeration(content);

    const position = await positionService.editPosition(
      (req.params.slug as string),
      (req.params.id as string),
      req.body,
      actor,
    );
    res.json(position);
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

export async function handleListPositions(req: Request, res: Response): Promise<void> {
  try {
    const positions = await positionService.getPositions((req.params.slug as string));
    res.json(positions);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}

export async function handleGetPositionHistory(req: Request, res: Response): Promise<void> {
  try {
    const history = await positionService.getPositionHistory(
      (req.params.slug as string),
      (req.params.id as string),
    );
    res.json(history);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("not found")) {
      res.status(404).json({ error: message });
    } else {
      res.status(400).json({ error: message });
    }
  }
}
