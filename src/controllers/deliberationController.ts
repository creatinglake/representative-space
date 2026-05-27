import type { Request, Response } from "express";
import { resolveActor } from "../middleware/auth.js";
import { canActor } from "../auth/canActor.js";
import { getPolisAdapter } from "../processes/boot.js";
import * as processService from "../services/processService.js";
import type { PolisDeliberationState } from "../../../shared/process-plugins/polis_deliberation/src/types.js";
import type { VoteDirection } from "../../../shared/process-plugins/polis_deliberation/src/adapter/types.js";

function getConversationId(slug: string, processId: string): string {
  const process = processService.getRawProcess(slug, processId);
  if (!process) {
    throw new Error(`Process "${processId}" not found on space "${slug}"`);
  }
  if (process.status !== "active") {
    throw new Error("Deliberation is not active");
  }
  const state = process.state as unknown as PolisDeliberationState;
  if (!state.polis_conversation_id) {
    throw new Error("Deliberation has not been started");
  }
  return state.polis_conversation_id;
}

export async function vote(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const actor = resolveActor(res, slug);

    if (!canActor(actor, "participate_deliberation", { type: "space", slug })) {
      res.status(403).json({ error: "Not authorized to participate in deliberations" });
      return;
    }

    const { statement_id, vote: direction } = req.body;
    if (typeof statement_id !== "number" || !direction) {
      res.status(400).json({ error: "statement_id (number) and vote (agree|disagree|pass) are required" });
      return;
    }

    const validVotes: VoteDirection[] = ["agree", "disagree", "pass"];
    if (!validVotes.includes(direction)) {
      res.status(400).json({ error: "vote must be agree, disagree, or pass" });
      return;
    }

    const conversationId = getConversationId(slug, processId);
    const adapter = getPolisAdapter();

    await adapter.recordVote(conversationId, actor.userId, statement_id, direction);
    res.json({ ok: true });
  } catch (err: any) {
    if (err.message?.includes("Not authorized") || err.message?.includes("not authorized")) {
      res.status(403).json({ error: err.message });
    } else if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else if (err.message?.includes("not active") || err.message?.includes("not been started")) {
      res.status(409).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export async function submitStatement(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const actor = resolveActor(res, slug);

    if (!canActor(actor, "participate_deliberation", { type: "space", slug })) {
      res.status(403).json({ error: "Not authorized to participate in deliberations" });
      return;
    }

    const { text } = req.body;
    if (!text || typeof text !== "string" || text.trim().length === 0) {
      res.status(400).json({ error: "text is required" });
      return;
    }

    const conversationId = getConversationId(slug, processId);
    const adapter = getPolisAdapter();

    const result = await adapter.submitStatement(conversationId, actor.userId, text.trim());
    res.status(201).json(result);
  } catch (err: any) {
    if (err.message?.includes("Not authorized") || err.message?.includes("not authorized")) {
      res.status(403).json({ error: err.message });
    } else if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else if (err.message?.includes("not active") || err.message?.includes("not been started")) {
      res.status(409).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export async function getNextStatement(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const actor = resolveActor(res, slug);

    if (!canActor(actor, "participate_deliberation", { type: "space", slug })) {
      res.status(403).json({ error: "Not authorized to participate in deliberations" });
      return;
    }

    const conversationId = getConversationId(slug, processId);
    const adapter = getPolisAdapter();

    const statement = await adapter.getNextStatement(conversationId, actor.userId);
    res.json({ statement });
  } catch (err: any) {
    if (err.message?.includes("Not authorized") || err.message?.includes("not authorized")) {
      res.status(403).json({ error: err.message });
    } else if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else if (err.message?.includes("not active") || err.message?.includes("not been started")) {
      res.status(409).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export async function getClusterState(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const conversationId = getConversationId(slug, processId);
    const adapter = getPolisAdapter();

    const clusters = await adapter.pullClusterState(conversationId);
    res.json(clusters);
  } catch (err: any) {
    if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else if (err.message?.includes("not active") || err.message?.includes("not been started")) {
      res.status(409).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export async function closeDeliberation(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const actor = resolveActor(res, slug);

    if (!canActor(actor, "host_deliberation", { type: "space", slug })) {
      res.status(403).json({ error: "Not authorized to manage deliberations on this space" });
      return;
    }

    const result = await processService.executeAction(slug, processId, {
      type: "close",
      actor: actor.userId,
      payload: {},
    });

    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Not authorized") || err.message?.includes("not authorized")) {
      res.status(403).json({ error: err.message });
    } else if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}

export async function regenerateSummary(req: Request, res: Response): Promise<void> {
  try {
    const slug = req.params.slug as string;
    const processId = req.params.processId as string;
    const actor = resolveActor(res, slug);

    if (!canActor(actor, "host_deliberation", { type: "space", slug })) {
      res.status(403).json({ error: "Not authorized to manage deliberations on this space" });
      return;
    }

    const result = await processService.executeAction(slug, processId, {
      type: "regenerate_summary",
      actor: actor.userId,
      payload: {},
    });

    res.json(result);
  } catch (err: any) {
    if (err.message?.includes("Not authorized") || err.message?.includes("not authorized")) {
      res.status(403).json({ error: err.message });
    } else if (err.message?.includes("not found")) {
      res.status(404).json({ error: err.message });
    } else {
      res.status(500).json({ error: err.message ?? "Internal error" });
    }
  }
}
