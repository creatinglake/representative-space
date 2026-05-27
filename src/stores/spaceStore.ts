import type { RepresentativeSpace } from "../models/space.js";
import { getSupabase, useDatabase } from "../lib/supabase.js";

const TABLE = "representative_spaces";

const spaces = new Map<string, RepresentativeSpace>();
const slugIndex = new Map<string, string>();

export async function createSpace(
  space: RepresentativeSpace,
): Promise<void> {
  if (!useDatabase()) {
    spaces.set(space.id, space);
    slugIndex.set(space.entity_slug, space.id);
    return;
  }
  const { error } = await getSupabase().from(TABLE).insert(space);
  if (error) throw error;
}

export async function getSpaceById(
  id: string,
): Promise<RepresentativeSpace | undefined> {
  if (!useDatabase()) {
    return spaces.get(id);
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function getSpaceBySlug(
  slug: string,
): Promise<RepresentativeSpace | undefined> {
  if (!useDatabase()) {
    const id = slugIndex.get(slug);
    if (!id) return undefined;
    return spaces.get(id);
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("entity_slug", slug)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function getAllSpaces(): Promise<RepresentativeSpace[]> {
  if (!useDatabase()) {
    return Array.from(spaces.values()).sort(
      (a, b) =>
        new Date(b.creation_date).getTime() -
        new Date(a.creation_date).getTime(),
    );
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .order("creation_date", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function updateSpace(
  id: string,
  patch: Partial<RepresentativeSpace>,
): Promise<RepresentativeSpace | undefined> {
  if (!useDatabase()) {
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

  // Supabase path: handle profile merge on the server side
  const updatePayload: Record<string, unknown> = { ...patch };

  if (patch.profile) {
    // Read existing row to merge profile fields
    const { data: existing, error: readError } = await getSupabase()
      .from(TABLE)
      .select("profile")
      .eq("id", id)
      .maybeSingle();
    if (readError) throw readError;
    if (!existing) return undefined;
    updatePayload.profile = { ...existing.profile, ...patch.profile };
  }

  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(updatePayload)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function slugExists(slug: string): Promise<boolean> {
  if (!useDatabase()) {
    return slugIndex.has(slug);
  }
  const { count, error } = await getSupabase()
    .from(TABLE)
    .select("id", { count: "exact", head: true })
    .eq("entity_slug", slug);
  if (error) throw error;
  return (count ?? 0) > 0;
}

/** Clears in-memory stores only. Used in tests. */
export function clearSpaces(): void {
  spaces.clear();
  slugIndex.clear();
}
