import type { RepresentativeSpace } from "../models/space.js";

const spaces = new Map<string, RepresentativeSpace>();
const slugIndex = new Map<string, string>();

export function createSpace(space: RepresentativeSpace): void {
  spaces.set(space.id, space);
  slugIndex.set(space.entity_slug, space.id);
}

export function getSpaceById(id: string): RepresentativeSpace | undefined {
  return spaces.get(id);
}

export function getSpaceBySlug(
  slug: string,
): RepresentativeSpace | undefined {
  const id = slugIndex.get(slug);
  if (!id) return undefined;
  return spaces.get(id);
}

export function getAllSpaces(): RepresentativeSpace[] {
  return Array.from(spaces.values()).sort(
    (a, b) =>
      new Date(b.creation_date).getTime() -
      new Date(a.creation_date).getTime(),
  );
}

export function updateSpace(
  id: string,
  patch: Partial<RepresentativeSpace>,
): RepresentativeSpace | undefined {
  const existing = spaces.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch };
  if (patch.profile) {
    updated.profile = { ...existing.profile, ...patch.profile };
  }
  // Preserve explicit null values for archive fields
  if ("archived_at" in patch) updated.archived_at = patch.archived_at ?? null;
  if ("archived_by" in patch) updated.archived_by = patch.archived_by ?? null;
  if ("archived_reason" in patch) updated.archived_reason = patch.archived_reason ?? null;
  if ("successor_space_slug" in patch) updated.successor_space_slug = patch.successor_space_slug ?? null;
  spaces.set(id, updated);
  return updated;
}

export function slugExists(slug: string): boolean {
  return slugIndex.has(slug);
}

export function clearSpaces(): void {
  spaces.clear();
  slugIndex.clear();
}
