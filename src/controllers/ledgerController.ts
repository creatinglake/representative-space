import type { Request, Response } from "express";
import { getSpaceBySlug } from "../stores/spaceStore.js";
import {
  queryLedgerEvents,
  isLedgerRenderableType,
} from "../stores/eventStore.js";

export async function handleGetLedger(req: Request, res: Response): Promise<void> {
  const slug = req.params.slug as string;

  // Validate space exists
  const space = await getSpaceBySlug(slug);
  if (!space) {
    res.status(404).json({ error: `Space "${slug}" not found` });
    return;
  }

  // Parse event_types — support both array and single string
  let eventTypes: string[] | undefined;
  const rawTypes = req.query.event_types;
  if (rawTypes) {
    if (Array.isArray(rawTypes)) {
      eventTypes = rawTypes.map(String);
    } else {
      eventTypes = [String(rawTypes)];
    }

    // Validate each type against renderable set
    for (const t of eventTypes) {
      if (!isLedgerRenderableType(t)) {
        res.status(400).json({
          error: `Invalid event type: "${t}". Must be one of the ledger-renderable types.`,
        });
        return;
      }
    }
  }

  // Parse date range
  const from = req.query.from as string | undefined;
  const to = req.query.to as string | undefined;

  // Parse and clamp limit
  let limit = 20;
  if (req.query.limit !== undefined) {
    limit = Math.max(1, Math.min(100, parseInt(String(req.query.limit), 10) || 20));
  }

  // Parse cursor
  const cursor = req.query.cursor as string | undefined;

  try {
    const result = await queryLedgerEvents({
      spaceSlug: slug,
      eventTypes,
      from,
      to,
      limit,
      cursor,
    });

    res.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    if (message.includes("Invalid cursor")) {
      res.status(400).json({ error: message });
      return;
    }
    res.status(500).json({ error: message });
  }
}
