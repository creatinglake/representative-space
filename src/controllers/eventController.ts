import type { Request, Response } from "express";
import {
  getAllEvents,
  getEventsBySpaceSlug,
  getEventCount,
} from "../stores/eventStore.js";

export async function handleGetEvents(req: Request, res: Response): Promise<void> {
  const spaceSlug = req.query.space_slug as string | undefined;

  let events = spaceSlug
    ? await getEventsBySpaceSlug(spaceSlug)
    : await getAllEvents();

  // Public feed excludes restricted-visibility events
  events = events.filter((e) => e.meta.visibility !== "restricted");

  res.json({
    events,
    count: events.length,
  });
}
