import type { Process } from "../processes/types.js";
import { getSupabase, useDatabase } from "../lib/supabase.js";

const TABLE = "processes";

const processes = new Map<string, Process>();

// ─── camelCase ↔ snake_case mapping ──────────────────────────

interface ProcessRow {
  id: string;
  definition: { type: string; version: string };
  title: string;
  description: string;
  status: string;
  host_id: string;
  space_slug: string;
  jurisdiction: string;
  created_by: string;
  created_at: string;
  updated_at: string;
  state: Record<string, unknown>;
}

function toRow(p: Process): ProcessRow {
  return {
    id: p.id,
    definition: p.definition,
    title: p.title,
    description: p.description,
    status: p.status,
    host_id: p.hostId,
    space_slug: p.spaceSlug,
    jurisdiction: p.jurisdiction,
    created_by: p.createdBy,
    created_at: p.createdAt,
    updated_at: p.updatedAt,
    state: p.state,
  };
}

function fromRow(row: ProcessRow): Process {
  return {
    id: row.id,
    definition: row.definition,
    title: row.title,
    description: row.description,
    status: row.status as Process["status"],
    hostId: row.host_id,
    spaceSlug: row.space_slug,
    jurisdiction: row.jurisdiction,
    createdBy: row.created_by,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    state: row.state,
  };
}

function patchToRow(patch: Partial<Process>): Record<string, unknown> {
  const row: Record<string, unknown> = {};
  if ("definition" in patch) row.definition = patch.definition;
  if ("title" in patch) row.title = patch.title;
  if ("description" in patch) row.description = patch.description;
  if ("status" in patch) row.status = patch.status;
  if ("hostId" in patch) row.host_id = patch.hostId;
  if ("spaceSlug" in patch) row.space_slug = patch.spaceSlug;
  if ("jurisdiction" in patch) row.jurisdiction = patch.jurisdiction;
  if ("createdBy" in patch) row.created_by = patch.createdBy;
  if ("createdAt" in patch) row.created_at = patch.createdAt;
  if ("updatedAt" in patch) row.updated_at = patch.updatedAt;
  if ("state" in patch) row.state = patch.state;
  return row;
}

// ─── Store functions ─────────────────────────────────────────

export async function addProcess(process: Process): Promise<void> {
  if (!useDatabase()) {
    processes.set(process.id, process);
    return;
  }
  const { error } = await getSupabase().from(TABLE).insert(toRow(process));
  if (error) throw error;
}

export async function getProcessById(
  id: string,
): Promise<Process | undefined> {
  if (!useDatabase()) {
    return processes.get(id);
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ProcessRow) : undefined;
}

export async function getProcessesBySlug(slug: string): Promise<Process[]> {
  if (!useDatabase()) {
    return Array.from(processes.values())
      .filter((p) => p.spaceSlug === slug)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("space_slug", slug)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as ProcessRow));
}

export async function updateProcess(
  id: string,
  patch: Partial<Process>,
): Promise<Process | undefined> {
  if (!useDatabase()) {
    const existing = processes.get(id);
    if (!existing) return undefined;
    const updated = {
      ...existing,
      ...patch,
      updatedAt: new Date().toISOString(),
    };
    processes.set(id, updated);
    return updated;
  }
  const rowPatch = patchToRow(patch);
  rowPatch.updated_at = new Date().toISOString();
  const { data, error } = await getSupabase()
    .from(TABLE)
    .update(rowPatch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  return data ? fromRow(data as ProcessRow) : undefined;
}

export async function getProcessesByStatus(
  status: string,
): Promise<Process[]> {
  if (!useDatabase()) {
    return Array.from(processes.values()).filter((p) => p.status === status);
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("status", status);
  if (error) throw error;
  return (data ?? []).map((r) => fromRow(r as ProcessRow));
}

export function clearProcesses(): void {
  processes.clear();
}
