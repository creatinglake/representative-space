import type { Position } from "../models/position.js";
import { getSupabase, useDatabase } from "../lib/supabase.js";

const TABLE = "positions";

const positions = new Map<string, Position>();

export async function addPosition(position: Position): Promise<void> {
  if (!useDatabase()) {
    positions.set(position.id, position);
    return;
  }
  const { error } = await getSupabase().from(TABLE).insert(position);
  if (error) throw error;
}

export async function getPositionById(
  id: string,
): Promise<Position | undefined> {
  if (!useDatabase()) {
    return positions.get(id);
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function getPositionsBySlug(slug: string): Promise<Position[]> {
  if (!useDatabase()) {
    return Array.from(positions.values())
      .filter((p) => p.space_slug === slug && p.status === "current")
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("space_slug", slug)
    .eq("status", "current")
    .order("timestamp", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getPositionHistory(
  positionId: string,
): Promise<Position[]> {
  if (!useDatabase()) {
    const chain: Position[] = [];
    let current = positions.get(positionId);
    while (current) {
      chain.push(current);
      current = current.prior_version_id
        ? positions.get(current.prior_version_id)
        : undefined;
    }
    return chain;
  }

  // Supabase path: walk the prior_version_id chain iteratively
  const chain: Position[] = [];
  let currentId: string | null = positionId;

  while (currentId) {
    const result = await getSupabase()
      .from(TABLE)
      .select("*")
      .eq("id", currentId)
      .maybeSingle();
    if (result.error) throw result.error;
    if (!result.data) break;
    const row = result.data as Position;
    chain.push(row);
    currentId = row.prior_version_id ?? null;
  }

  return chain;
}

export async function updatePosition(
  id: string,
  patch: Partial<Position>,
): Promise<Position | undefined> {
  if (!useDatabase()) {
    const existing = positions.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    positions.set(id, updated);
    return updated;
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(patch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export function clearPositions(): void {
  positions.clear();
}
