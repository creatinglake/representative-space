import type { Position } from "../models/position.js";

const positions = new Map<string, Position>();

export function addPosition(position: Position): void {
  positions.set(position.id, position);
}

export function getPositionById(id: string): Position | undefined {
  return positions.get(id);
}

export function getPositionsBySlug(slug: string): Position[] {
  return Array.from(positions.values())
    .filter((p) => p.space_slug === slug && p.status === "current")
    .sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );
}

export function getPositionHistory(positionId: string): Position[] {
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

export function updatePosition(
  id: string,
  patch: Partial<Position>,
): Position | undefined {
  const existing = positions.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  positions.set(id, updated);
  return updated;
}

export function clearPositions(): void {
  positions.clear();
}
