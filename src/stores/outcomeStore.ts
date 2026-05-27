import type { OutcomeDelivery } from "../models/outcome.js";

const outcomes = new Map<string, OutcomeDelivery>();
// Monotonic insertion counter for deterministic same-millisecond ordering
const insertionOrder = new Map<string, number>();
let insertionSeq = 0;

export function addOutcome(outcome: OutcomeDelivery): void {
  outcomes.set(outcome.id, outcome);
  insertionOrder.set(outcome.id, insertionSeq++);
}

export function getOutcomeById(id: string): OutcomeDelivery | undefined {
  return outcomes.get(id);
}

export function getOutcomesBySlug(slug: string): OutcomeDelivery[] {
  return Array.from(outcomes.values())
    .filter((o) => o.addressed_to_slug === slug)
    .sort((a, b) => {
      const timeDiff =
        new Date(b.delivery_timestamp).getTime() -
        new Date(a.delivery_timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      // Tiebreaker for same-millisecond deliveries: later insertion first
      return (insertionOrder.get(b.id) ?? 0) - (insertionOrder.get(a.id) ?? 0);
    });
}

export function updateOutcome(
  id: string,
  patch: Partial<OutcomeDelivery>,
): OutcomeDelivery | undefined {
  const existing = outcomes.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  outcomes.set(id, updated);
  return updated;
}

export function clearOutcomes(): void {
  outcomes.clear();
  insertionOrder.clear();
  insertionSeq = 0;
}
