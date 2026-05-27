import type { Request, Response } from "express";
import * as processService from "../services/processService.js";
import { resolveActor } from "../middleware/auth.js";

function extractTokenValue(req: Request): string | null {
  const auth = req.headers.authorization;
  if (auth && auth.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

export function createProcess(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const actor = resolveActor(res, slug);
    const { definition, title, description, state } = req.body;

    if (!definition?.type || !title) {
      res.status(400).json({ error: "definition.type and title are required" });
      return;
    }

    const process = processService.createProcess(
      slug,
      { definition, title, description: description ?? "", createdBy: actor.userId, state },
      actor,
    );

    res.status(201).json(process);
  } catch (err: any) {
    if (err.message?.includes("Not authorized")) {
      res.status(403).json({ error: err.message });
    } else if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else if (err.message?.includes("Unknown process type")) {
      res.status(400).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export function getProcess(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const actorId = extractTokenValue(req);
    const readModel = processService.getProcess(slug, processId, actorId ?? undefined);
    res.json(readModel);
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export function listProcesses(req: Request, res: Response): void {
  try {
    const slug = req.params.slug as string;
    const processes = processService.listProcesses(slug);
    res.json({ processes });
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export async function executeAction(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const actor = resolveActor(res, slug);
    const { type, payload } = req.body;

    if (!type) {
      res.status(400).json({ error: "Action type is required" });
      return;
    }

    const result = await processService.executeAction(slug, processId, {
      type,
      actor: actor.userId,
      payload: payload ?? {},
    });

    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Not authorized")) {
      res.status(403).json({ error: err.message });
    } else if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}
