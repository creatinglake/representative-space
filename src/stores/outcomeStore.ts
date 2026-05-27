import type { OutcomeDelivery } from "../models/outcome.js";
import { getSupabase, useDatabase } from "../lib/supabase.js";

const TABLE = "outcome_deliveries";

const outcomes = new Map<string, OutcomeDelivery>();
// Monotonic insertion counter for deterministic same-millisecond ordering
const insertionOrder = new Map<string, number>();
let insertionSeq = 0;

export async function addOutcome(outcome: OutcomeDelivery): Promise<void> {
  if (!useDatabase()) {
    outcomes.set(outcome.id, outcome);
    insertionOrder.set(outcome.id, insertionSeq++);
    return;
  }
  const { error } = await getSupabase().from(TABLE).insert(outcome);
  if (error) throw error;
}

export async function getOutcomeById(
  id: string,
): Promise<OutcomeDelivery | undefined> {
  if (!useDatabase()) {
    return outcomes.get(id);
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function getOutcomesBySlug(
  slug: string,
): Promise<OutcomeDelivery[]> {
  if (!useDatabase()) {
    return Array.from(outcomes.values())
      .filter((o) => o.addressed_to_slug === slug)
      .sort((a, b) => {
        const timeDiff =
          new Date(b.delivery_timestamp).getTime() -
          new Date(a.delivery_timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        // Tiebreaker for same-millisecond deliveries: later insertion first
        return (
          (insertionOrder.get(b.id) ?? 0) - (insertionOrder.get(a.id) ?? 0)
        );
      });
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("addressed_to_slug", slug)
    .order("delivery_timestamp", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateOutcome(
  id: string,
  patch: Partial<OutcomeDelivery>,
): Promise<OutcomeDelivery | undefined> {
  if (!useDatabase()) {
    const existing = outcomes.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    outcomes.set(id, updated);
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

export function clearOutcomes(): void {
  outcomes.clear();
  insertionOrder.clear();
  insertionSeq = 0;
}
