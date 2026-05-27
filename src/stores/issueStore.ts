import type { CitizenIssue, IssueResponse } from "../models/issue.js";
import { getSupabase, useDatabase } from "../lib/supabase.js";

const ISSUES_TABLE = "citizen_issues";
const SIGNALS_TABLE = "issue_signals";
const RESPONSES_TABLE = "issue_responses";

const issues = new Map<string, CitizenIssue>();

// Signals: composite key "issueId:userId" → signal value
const signals = new Map<string, string>();

// Issue responses
const issueResponses = new Map<string, IssueResponse>();

// ─── Row ↔ Model mapping for CitizenIssue ────────────────────

interface IssueRow {
  id: string;
  space_slug: string;
  author_id: string;
  entry_type: string;
  title: string;
  body: string;
  jurisdiction_tag: string;
  status: string;
  version: number;
  prior_version_id: string | null;
  poll_options: Array<{ id: string; label: string }>;
  poll_tally: Record<string, number>;
  support_count: number;
  oppose_count: number;
  mod_hidden: boolean;
  mod_reason: string | null;
  mod_hidden_by: string | null;
  mod_hidden_at: string | null;
  mod_restored_at: string | null;
  latest_response_id: string | null;
  created_at: string;
  updated_at: string;
}

function mapIssueToRow(
  issue: CitizenIssue,
): Omit<IssueRow, "latest_response_id"> & { latest_response_id: string | null } {
  return {
    id: issue.id,
    space_slug: issue.space_slug,
    author_id: issue.author_id,
    entry_type: issue.entry_type,
    title: issue.title,
    body: issue.body,
    jurisdiction_tag: issue.jurisdiction_tag,
    status: issue.status,
    version: issue.version,
    prior_version_id: issue.prior_version_id,
    poll_options: issue.poll_options,
    poll_tally: issue.poll_tally,
    support_count: issue.signal_tally.support,
    oppose_count: issue.signal_tally.oppose,
    mod_hidden: issue.moderation.hidden,
    mod_reason: issue.moderation.reason ?? null,
    mod_hidden_by: issue.moderation.hidden_by ?? null,
    mod_hidden_at: issue.moderation.hidden_at ?? null,
    mod_restored_at: issue.moderation.restored_at ?? null,
    latest_response_id: issue.latest_response?.id ?? null,
    created_at: issue.created_at,
    updated_at: issue.updated_at,
  };
}

function mapRowToIssue(
  row: IssueRow,
  latestResponse?: IssueResponse | null,
): CitizenIssue {
  return {
    id: row.id,
    space_slug: row.space_slug,
    author_id: row.author_id,
    entry_type: row.entry_type as CitizenIssue["entry_type"],
    title: row.title,
    body: row.body,
    jurisdiction_tag: row.jurisdiction_tag,
    status: row.status as CitizenIssue["status"],
    version: row.version,
    prior_version_id: row.prior_version_id,
    poll_options: row.poll_options ?? [],
    poll_tally: row.poll_tally ?? {},
    signal_tally: {
      support: row.support_count,
      oppose: row.oppose_count,
    },
    latest_response: latestResponse ?? null,
    moderation: {
      hidden: row.mod_hidden,
      ...(row.mod_reason != null && { reason: row.mod_reason }),
      ...(row.mod_hidden_by != null && { hidden_by: row.mod_hidden_by }),
      ...(row.mod_hidden_at != null && { hidden_at: row.mod_hidden_at }),
      ...(row.mod_restored_at != null && { restored_at: row.mod_restored_at }),
    },
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function issuePatchToRow(
  patch: Partial<CitizenIssue>,
): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if ("space_slug" in patch) row.space_slug = patch.space_slug;
  if ("author_id" in patch) row.author_id = patch.author_id;
  if ("entry_type" in patch) row.entry_type = patch.entry_type;
  if ("title" in patch) row.title = patch.title;
  if ("body" in patch) row.body = patch.body;
  if ("jurisdiction_tag" in patch) row.jurisdiction_tag = patch.jurisdiction_tag;
  if ("status" in patch) row.status = patch.status;
  if ("version" in patch) row.version = patch.version;
  if ("prior_version_id" in patch) row.prior_version_id = patch.prior_version_id;
  if ("poll_options" in patch) row.poll_options = patch.poll_options;
  if ("poll_tally" in patch) row.poll_tally = patch.poll_tally;
  if ("created_at" in patch) row.created_at = patch.created_at;
  if ("updated_at" in patch) row.updated_at = patch.updated_at;

  if ("signal_tally" in patch && patch.signal_tally) {
    row.support_count = patch.signal_tally.support;
    row.oppose_count = patch.signal_tally.oppose;
  }

  if ("moderation" in patch && patch.moderation) {
    row.mod_hidden = patch.moderation.hidden;
    row.mod_reason = patch.moderation.reason ?? null;
    row.mod_hidden_by = patch.moderation.hidden_by ?? null;
    row.mod_hidden_at = patch.moderation.hidden_at ?? null;
    row.mod_restored_at = patch.moderation.restored_at ?? null;
  }

  if ("latest_response" in patch) {
    row.latest_response_id = patch.latest_response?.id ?? null;
  }

  return row;
}

// ─── Issue store functions ───────────────────────────────────

export async function addIssue(issue: CitizenIssue): Promise<void> {
  if (!useDatabase()) {
    issues.set(issue.id, issue);
    return;
  }
  const { error } = await getSupabase()
    .from(ISSUES_TABLE)
    .insert(mapIssueToRow(issue));
  if (error) throw error;
}

export async function getIssueById(
  id: string,
): Promise<CitizenIssue | undefined> {
  if (!useDatabase()) {
    return issues.get(id);
  }
  const { data, error } = await getSupabase()
    .from(ISSUES_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;

  const row = data as IssueRow;

  // Fetch the latest response if there is one
  let latestResponse: IssueResponse | null = null;
  if (row.latest_response_id) {
    const { data: respData, error: respError } = await getSupabase()
      .from(RESPONSES_TABLE)
      .select("*")
      .eq("id", row.latest_response_id)
      .maybeSingle();
    if (respError) throw respError;
    latestResponse = (respData as IssueResponse) ?? null;
  }

  return mapRowToIssue(row, latestResponse);
}

export async function getIssuesBySlug(
  slug: string,
): Promise<CitizenIssue[]> {
  if (!useDatabase()) {
    return Array.from(issues.values()).filter((i) => i.space_slug === slug);
  }

  // Fetch issues sorted by net support (support_count - oppose_count) DESC
  // Supabase doesn't support computed ORDER BY directly, so we fetch and sort
  // in-app. For large datasets this would move to a DB view or function.
  const { data, error } = await getSupabase()
    .from(ISSUES_TABLE)
    .select("*")
    .eq("space_slug", slug);
  if (error) throw error;

  const rows = (data ?? []) as IssueRow[];

  // Sort by net support descending
  rows.sort(
    (a, b) =>
      (b.support_count - b.oppose_count) - (a.support_count - a.oppose_count),
  );

  // Batch-fetch latest responses for rows that have one
  const responseIds = rows
    .map((r) => r.latest_response_id)
    .filter((id): id is string => id != null);

  let responseLookup = new Map<string, IssueResponse>();
  if (responseIds.length > 0) {
    const { data: respData, error: respError } = await getSupabase()
      .from(RESPONSES_TABLE)
      .select("*")
      .in("id", responseIds);
    if (respError) throw respError;
    for (const r of (respData ?? []) as IssueResponse[]) {
      responseLookup.set(r.id, r);
    }
  }

  return rows.map((row) =>
    mapRowToIssue(row, row.latest_response_id
      ? responseLookup.get(row.latest_response_id) ?? null
      : null),
  );
}

export async function updateIssue(
  id: string,
  patch: Partial<CitizenIssue>,
): Promise<CitizenIssue | undefined> {
  if (!useDatabase()) {
    const existing = issues.get(id);
    if (!existing) return undefined;
    const updated = { ...existing, ...patch };
    issues.set(id, updated);
    return updated;
  }
  const rowPatch = issuePatchToRow(patch);
  const { data, error } = await getSupabase()
    .from(ISSUES_TABLE)
    .update(rowPatch)
    .eq("id", id)
    .select("*")
    .maybeSingle();
  if (error) throw error;
  if (!data) return undefined;

  const row = data as IssueRow;

  // Fetch the latest response if present
  let latestResponse: IssueResponse | null = null;
  if (row.latest_response_id) {
    const { data: respData, error: respError } = await getSupabase()
      .from(RESPONSES_TABLE)
      .select("*")
      .eq("id", row.latest_response_id)
      .maybeSingle();
    if (respError) throw respError;
    latestResponse = (respData as IssueResponse) ?? null;
  }

  return mapRowToIssue(row, latestResponse);
}

// ─── Signal functions ────────────────────────────────────────

export async function getSignal(
  issueId: string,
  userId: string,
): Promise<string | undefined> {
  if (!useDatabase()) {
    return signals.get(`${issueId}:${userId}`);
  }
  const { data, error } = await getSupabase()
    .from(SIGNALS_TABLE)
    .select("signal")
    .eq("issue_id", issueId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw error;
  return data?.signal ?? undefined;
}

export async function setSignal(
  issueId: string,
  userId: string,
  signal: string,
): Promise<void> {
  if (!useDatabase()) {
    signals.set(`${issueId}:${userId}`, signal);
    return;
  }
  const { error } = await getSupabase()
    .from(SIGNALS_TABLE)
    .upsert(
      { issue_id: issueId, user_id: userId, signal },
      { onConflict: "issue_id,user_id" },
    );
  if (error) throw error;
}

// ─── Issue response functions ────────────────────────────────

export async function addIssueResponse(
  response: IssueResponse,
): Promise<void> {
  if (!useDatabase()) {
    issueResponses.set(response.id, response);
    return;
  }
  const { error } = await getSupabase()
    .from(RESPONSES_TABLE)
    .insert(response);
  if (error) throw error;
}

export async function getIssueResponseById(
  id: string,
): Promise<IssueResponse | undefined> {
  if (!useDatabase()) {
    return issueResponses.get(id);
  }
  const { data, error } = await getSupabase()
    .from(RESPONSES_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function getLatestIssueResponse(
  issueId: string,
): Promise<IssueResponse | undefined> {
  if (!useDatabase()) {
    const matching = Array.from(issueResponses.values())
      .filter((r) => r.issue_id === issueId)
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );
    return matching[0];
  }
  const { data, error } = await getSupabase()
    .from(RESPONSES_TABLE)
    .select("*")
    .eq("issue_id", issueId)
    .order("timestamp", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

// ─── Clear (test-only, memory-only) ─────────────────────────

export function clearIssues(): void {
  issues.clear();
  issueResponses.clear();
}

export function clearSignals(): void {
  signals.clear();
}
