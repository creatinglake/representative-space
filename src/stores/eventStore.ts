import type { CivicEvent } from "../models/event.js";
import { getSupabase, useDatabase } from "../lib/supabase.js";

const TABLE = "civic_events";

const events: CivicEvent[] = [];

export async function appendEvent(event: CivicEvent): Promise<void> {
  if (!useDatabase()) {
    events.push(event);
    return;
  }
  const space_slug =
    (event.data as Record<string, unknown>).space_slug ?? null;
  const { error } = await getSupabase()
    .from(TABLE)
    .insert({ ...event, space_slug });
  if (error) throw error;
}

export async function getAllEvents(): Promise<CivicEvent[]> {
  if (!useDatabase()) {
    return [...events].sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(stripSpaceSlugColumn);
}

export async function getEventsBySpaceSlug(
  slug: string,
): Promise<CivicEvent[]> {
  if (!useDatabase()) {
    return (await getAllEvents()).filter(
      (e) => (e.data as Record<string, unknown>).space_slug === slug,
    );
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("space_slug", slug)
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return (data ?? []).map(stripSpaceSlugColumn);
}

export async function getEventCount(): Promise<number> {
  if (!useDatabase()) {
    return events.length;
  }
  const { count, error } = await getSupabase()
    .from(TABLE)
    .select("id", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

/** Clears in-memory store only. Used in tests. */
export function clearEvents(): void {
  events.length = 0;
}

// ─── Ledger Query Infrastructure ─────────────────────────────

/**
 * Event types that appear in the public responsiveness ledger.
 * Excludes internal lifecycle events, edit events, and restricted-visibility events.
 */
export const LEDGER_RENDERABLE_TYPES = [
  "civic.outcome_delivered",
  "civic.response_posted",
  "civic.position_posted",
  "civic.position_updated",
  "civic.issue_raised",
  "civic.issue_responded",
  "civic.space.archived",
] as const;

export type LedgerRenderableType = (typeof LEDGER_RENDERABLE_TYPES)[number];

const LEDGER_TYPE_SET: ReadonlySet<string> = new Set(LEDGER_RENDERABLE_TYPES);

export function isLedgerRenderableType(type: string): boolean {
  return LEDGER_TYPE_SET.has(type);
}

// ─── Cursor encoding ────────────────────────────────────────

interface CursorPayload {
  ts: string;
  id: string;
}

export function encodeCursor(event: CivicEvent): string {
  const json = JSON.stringify({ ts: event.timestamp, id: event.id });
  return Buffer.from(json).toString("base64url");
}

export function decodeCursor(cursor: string): CursorPayload {
  try {
    const json = Buffer.from(cursor, "base64url").toString("utf-8");
    const parsed = JSON.parse(json);
    if (typeof parsed.ts !== "string" || typeof parsed.id !== "string") {
      throw new Error("Invalid cursor payload");
    }
    return parsed as CursorPayload;
  } catch {
    throw new Error("Invalid cursor");
  }
}

// ─── Ledger query ───────────────────────────────────────────

export interface LedgerQueryParams {
  spaceSlug: string;
  eventTypes?: string[];
  from?: string;
  to?: string;
  limit: number;
  cursor?: string;
}

export interface LedgerQueryResult {
  events: CivicEvent[];
  next_cursor: string | null;
  has_more: boolean;
}

export async function queryLedgerEvents(
  params: LedgerQueryParams,
): Promise<LedgerQueryResult> {
  const { spaceSlug, eventTypes, from, to, limit, cursor } = params;

  if (!useDatabase()) {
    return queryLedgerEventsInMemory(params);
  }

  // ── Supabase path ──────────────────────────────────────────
  let query = getSupabase()
    .from(TABLE)
    .select("*")
    .eq("space_slug", spaceSlug)
    .neq("meta->>visibility", "restricted")
    .in("event_type", eventTypes && eventTypes.length > 0
      ? eventTypes
      : [...LEDGER_RENDERABLE_TYPES],
    );

  // Date range filters
  if (from) {
    query = query.gte("timestamp", from);
  }
  if (to) {
    query = query.lte("timestamp", to);
  }

  // Cursor pagination
  if (cursor) {
    const decoded = decodeCursor(cursor);
    query = query.or(
      `timestamp.lt.${decoded.ts},and(timestamp.eq.${decoded.ts},id.lt.${decoded.id})`,
    );
  }

  // Sort and limit
  query = query
    .order("timestamp", { ascending: false })
    .order("id", { ascending: false })
    .limit(limit + 1);

  const { data, error } = await query;
  if (error) throw error;

  const rows = (data ?? []).map(stripSpaceSlugColumn);
  const hasMore = rows.length > limit;
  const resultEvents = hasMore ? rows.slice(0, limit) : rows;

  const nextCursor =
    hasMore && resultEvents.length > 0
      ? encodeCursor(resultEvents[resultEvents.length - 1])
      : null;

  return {
    events: resultEvents,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

// ─── In-memory ledger query (unchanged logic) ───────────────

function queryLedgerEventsInMemory(
  params: LedgerQueryParams,
): LedgerQueryResult {
  const { spaceSlug, eventTypes, from, to, limit, cursor } = params;

  // Decode cursor position if provided
  let cursorTs: string | undefined;
  let cursorId: string | undefined;
  if (cursor) {
    const decoded = decodeCursor(cursor);
    cursorTs = decoded.ts;
    cursorId = decoded.id;
  }

  // Start from all events for this space slug
  let filtered = events.filter(
    (e) => (e.data as Record<string, unknown>).space_slug === spaceSlug,
  );

  // Exclude restricted-visibility events
  filtered = filtered.filter((e) => e.meta.visibility !== "restricted");

  // Only include ledger-renderable types
  filtered = filtered.filter((e) => LEDGER_TYPE_SET.has(e.event_type));

  // Filter by specific event types if provided
  if (eventTypes && eventTypes.length > 0) {
    const typeSet = new Set(eventTypes);
    filtered = filtered.filter((e) => typeSet.has(e.event_type));
  }

  // Date range filter
  if (from) {
    const fromTime = new Date(from).getTime();
    filtered = filtered.filter(
      (e) => new Date(e.timestamp).getTime() >= fromTime,
    );
  }
  if (to) {
    const toTime = new Date(to).getTime();
    filtered = filtered.filter(
      (e) => new Date(e.timestamp).getTime() <= toTime,
    );
  }

  // Sort: reverse-chronological, with id descending as tiebreaker
  filtered.sort((a, b) => {
    const timeDiff =
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    if (timeDiff !== 0) return timeDiff;
    return b.id.localeCompare(a.id);
  });

  // Apply cursor: skip events at or before the cursor position
  if (cursorTs && cursorId) {
    const cursorTime = new Date(cursorTs).getTime();
    const cursorIndex = filtered.findIndex((e) => {
      const eventTime = new Date(e.timestamp).getTime();
      if (eventTime < cursorTime) return true;
      if (eventTime === cursorTime && e.id.localeCompare(cursorId!) <= 0)
        return true;
      return false;
    });
    if (cursorIndex >= 0) {
      filtered = filtered.slice(cursorIndex);
      // Exclude the cursor event itself
      if (
        filtered.length > 0 &&
        filtered[0].timestamp === cursorTs &&
        filtered[0].id === cursorId
      ) {
        filtered = filtered.slice(1);
      }
    }
  }

  // Take limit + 1 to determine has_more
  const page = filtered.slice(0, limit + 1);
  const hasMore = page.length > limit;
  const resultEvents = hasMore ? page.slice(0, limit) : page;

  const nextCursor =
    hasMore && resultEvents.length > 0
      ? encodeCursor(resultEvents[resultEvents.length - 1])
      : null;

  return {
    events: resultEvents,
    next_cursor: nextCursor,
    has_more: hasMore,
  };
}

// ─── Helpers ────────────────────────────────────────────────

/**
 * Strips the denormalized `space_slug` column that exists only in the
 * Supabase table so callers always receive a clean CivicEvent shape.
 */
function stripSpaceSlugColumn(row: Record<string, unknown>): CivicEvent {
  const { space_slug: _strip, ...rest } = row;
  return rest as unknown as CivicEvent;
}
