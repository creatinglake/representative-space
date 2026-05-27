const API_BASE = import.meta.env.DEV ? "http://localhost:3001" : "/api";
const TOKEN_KEY = "rs_auth_token";

function getStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown,
): Promise<T> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  const token = getStoredToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText }));
    throw new Error(err.error ?? `Request failed: ${res.status}`);
  }

  return res.json();
}

// --- Types ---

export type SpaceSubType = "individual" | "candidate";
export type VerificationStatus = "unverified" | "verified";
export type LifecycleState = "active" | "archived";

export interface ContactChannels {
  phone?: string;
  email?: string;
  office_address?: string;
}

export interface TermDates {
  start: string;
  end?: string;
}

export interface CandidacyRecord {
  filing_date?: string;
  election_date?: string;
  election_type?: string;
  status?: string;
}

export interface ProfileData {
  display_name: string;
  hero_image_url: string;
  profile_image_url: string;
  contact_channels: ContactChannels;
  public_bio: string;
  linked_official_sites: string[];
}

export interface RepresentativeSpace {
  id: string;
  sub_type: SpaceSubType;
  entity_did: string | null;
  entity_slug: string;
  jurisdiction: string;
  office_or_candidacy_label: string;
  party_affiliation: string | null;
  term_dates: TermDates | null;
  candidacy_record: CandidacyRecord | null;
  creation_date: string;
  verification_status: VerificationStatus;
  lifecycle_state: LifecycleState;
  profile: ProfileData;
}

export interface CreateSpaceInput {
  sub_type: SpaceSubType;
  entity_slug: string;
  jurisdiction: string;
  office_or_candidacy_label: string;
  display_name: string;
  party_affiliation?: string;
  term_dates?: TermDates;
  candidacy_record?: CandidacyRecord;
  contact_channels?: ContactChannels;
  public_bio?: string;
  linked_official_sites?: string[];
}

export interface UpdateSpaceInput {
  display_name?: string;
  hero_image_url?: string;
  profile_image_url?: string;
  contact_channels?: ContactChannels;
  public_bio?: string;
  linked_official_sites?: string[];
}

export interface CivicEvent {
  id: string;
  version: string;
  event_type: string;
  timestamp: string;
  process_id: string;
  actor: string;
  jurisdiction: string;
  action_url: string;
  data: Record<string, unknown>;
  meta: { visibility: string };
}

// --- Prompt 2 types ---

export interface ParticipationStats {
  total_participants: number;
  eligible_participants?: number;
  participation_rate?: number;
}

export interface OutcomeDelivery {
  id: string;
  originating_process_id: string;
  originating_hub_id: string;
  outcome_summary: string;
  participation_stats: ParticipationStats;
  result: Record<string, unknown>;
  delivery_timestamp: string;
  addressed_to_slug: string;
  response_id: string | null;
  latest_response: ResponseRecord | null;
}

export interface ResponseRecord {
  id: string;
  author_did: string;
  in_response_to_type: string;
  in_response_to_id: string;
  content: string;
  timestamp: string;
  version: number;
  prior_version_id: string | null;
}

export interface OutcomeWithResponse {
  outcome: OutcomeDelivery;
  response: ResponseRecord | null;
  response_history: ResponseRecord[];
}

// --- Issue types ---

export type EntryType = "issue" | "question" | "poll";
export type IssueStatus = "open" | "responded" | "closed";

export interface PollOption {
  id: string;
  label: string;
}

export interface SignalTally {
  support: number;
  oppose: number;
}

export interface ModerationInfo {
  hidden: boolean;
  reason?: string;
  hidden_by?: string;
  hidden_at?: string;
  restored_at?: string;
}

export interface IssueResponse {
  id: string;
  issue_id: string;
  author_did: string;
  in_response_to_type: string;
  content: string;
  timestamp: string;
  version: number;
  prior_version_id: string | null;
}

export interface CitizenIssue {
  id: string;
  space_slug: string;
  author_id: string;
  entry_type: EntryType;
  title: string;
  body: string;
  jurisdiction_tag: string;
  status: IssueStatus;
  version: number;
  prior_version_id: string | null;
  poll_options: PollOption[];
  poll_tally: Record<string, number>;
  signal_tally: SignalTally;
  latest_response: IssueResponse | null;
  moderation: ModerationInfo;
  created_at: string;
  updated_at: string;
}

export interface RaiseIssueInput {
  entry_type: EntryType;
  title: string;
  body: string;
  jurisdiction_tag?: string;
  poll_options?: string[];
}

// --- Ledger types ---

export type LedgerEventType =
  | "civic.outcome_delivered"
  | "civic.response_posted"
  | "civic.position_posted"
  | "civic.position_updated"
  | "civic.issue_raised"
  | "civic.issue_responded"
  | "civic.space.archived";

export interface LedgerResponse {
  events: CivicEvent[];
  next_cursor: string | null;
  has_more: boolean;
}

export interface LedgerQueryOptions {
  event_types?: LedgerEventType[];
  from?: string;
  to?: string;
  limit?: number;
  cursor?: string;
}

// --- Deliberation types ---

export type ProcessStatus = "draft" | "scheduled" | "active" | "closed" | "finalized";

export interface ProcessSummary {
  process_id: string;
  type: string;
  title: string;
  topic: string;
  lifecycle: ProcessStatus;
  participant_count: number;
  summary_status: string;
}

export interface DeliberationSummary {
  summary_text: string;
  directed_questions: string[];
  top_consensus_statements: {
    statement_text: string;
    agree_rate: number;
    vote_count: number;
  }[];
  opinion_groups: {
    group_id: number;
    size: number;
    representative_statements: {
      text: string;
      agreement_within_group: number;
    }[];
  }[];
  participation_stats: {
    total_participants: number;
    total_statements: number;
    total_votes: number;
    opinion_groups_formed: number;
  };
  linked_polis_data_uri: string;
  methodology: {
    prompt_version: string;
    model_used: string;
    generated_at: string;
  };
}

export interface ProcessReadModel {
  process_id: string;
  type: string;
  lifecycle: ProcessStatus;
  topic: string;
  framing: string;
  polis_conversation_id: string | null;
  deadline: string | null;
  participation_threshold: number | null;
  summary: DeliberationSummary | null;
  summary_status: string;
  continued_from_response_id: string | null;
}

export interface StatementRecord {
  id: number;
  text: string;
  is_seed: boolean;
  created: string;
}

export interface ClusterState {
  participant_count: number;
  statement_count: number;
  math_tick: number;
  groups: {
    id: number;
    size: number;
    representative_statements: {
      text: string;
      direction: "agree" | "disagree";
      repness: number;
    }[];
  }[];
  consensus: {
    agree: { statement_id: number; text: string; agree_rate: number; vote_count: number }[];
    disagree: { statement_id: number; text: string; agree_rate: number; vote_count: number }[];
  };
}

export type VoteDirection = "agree" | "disagree" | "pass";

export type PositionStatus = "current" | "superseded";

export interface Position {
  id: string;
  topic: string;
  author_did: string;
  space_slug: string;
  statement: string;
  timestamp: string;
  version: number;
  status: PositionStatus;
  prior_version_id: string | null;
  linked_outcomes: string[];
}

// --- API functions ---

export function listSpaces(): Promise<RepresentativeSpace[]> {
  return request("GET", "/space");
}

export function getSpace(slug: string): Promise<RepresentativeSpace> {
  return request("GET", `/space/${slug}`);
}

export function createSpace(
  input: CreateSpaceInput,
): Promise<RepresentativeSpace> {
  return request("POST", "/space", input);
}

export function updateSpace(
  slug: string,
  input: UpdateSpaceInput,
): Promise<RepresentativeSpace> {
  return request("PATCH", `/space/${slug}`, input);
}

export function verifyEntity(
  slug: string,
  entityDid?: string,
  notes?: string,
): Promise<{ space: RepresentativeSpace }> {
  return request("POST", `/space/${slug}/verify`, {
    entity_did: entityDid,
    notes,
  });
}

export function getEvents(
  spaceSlug?: string,
): Promise<{ events: CivicEvent[]; count: number }> {
  const qs = spaceSlug ? `?space_slug=${spaceSlug}` : "";
  return request("GET", `/events${qs}`);
}

// --- Outcome Deliveries ---

export function getOutcomes(slug: string): Promise<OutcomeDelivery[]> {
  return request("GET", `/space/${slug}/outcomes`);
}

export function getOutcome(
  slug: string,
  id: string,
): Promise<OutcomeWithResponse> {
  return request("GET", `/space/${slug}/outcomes/${id}`);
}

export function postResponse(
  slug: string,
  outcomeId: string,
  content: string,
): Promise<ResponseRecord> {
  return request("POST", `/space/${slug}/outcomes/${outcomeId}/response`, {
    content,
  });
}

export function editResponse(
  slug: string,
  outcomeId: string,
  content: string,
): Promise<ResponseRecord> {
  return request("PATCH", `/space/${slug}/outcomes/${outcomeId}/response`, {
    content,
  });
}

// --- Position Statements ---

export function getPositions(slug: string): Promise<Position[]> {
  return request("GET", `/space/${slug}/positions`);
}

export function getPositionHistory(
  slug: string,
  id: string,
): Promise<Position[]> {
  return request("GET", `/space/${slug}/positions/${id}/history`);
}

export function postPosition(
  slug: string,
  topic: string,
  statement: string,
  linkedOutcomes?: string[],
): Promise<Position> {
  return request("POST", `/space/${slug}/positions`, {
    topic,
    statement,
    linked_outcomes: linkedOutcomes,
  });
}

export function editPosition(
  slug: string,
  id: string,
  statement: string,
  linkedOutcomes?: string[],
): Promise<Position> {
  return request("PATCH", `/space/${slug}/positions/${id}`, {
    statement,
    linked_outcomes: linkedOutcomes,
  });
}

// --- Deliberation / Process API ---

export function getProcesses(slug: string): Promise<{ processes: ProcessSummary[] }> {
  return request("GET", `/space/${slug}/processes`);
}

export function getProcess(slug: string, processId: string): Promise<ProcessReadModel> {
  return request("GET", `/space/${slug}/processes/${processId}`);
}

export interface CreateProcessInput {
  definition: { type: string };
  title: string;
  description?: string;
  state: {
    topic: string;
    framing: string;
    deadline?: string;
    participation_threshold?: number;
    seed_statements?: string[];
    continued_from_response_id?: string;
    polis_moderation?: "open" | "strict";
  };
}

export function createProcess(slug: string, input: CreateProcessInput): Promise<unknown> {
  return request("POST", `/space/${slug}/processes`, input);
}

export function participateVote(
  slug: string,
  processId: string,
  statementId: number,
  vote: VoteDirection,
): Promise<{ ok: boolean }> {
  return request("POST", `/space/${slug}/processes/${processId}/participate/vote`, {
    statement_id: statementId,
    vote,
  });
}

export function participateSubmitStatement(
  slug: string,
  processId: string,
  text: string,
): Promise<{ statement_id: number }> {
  return request("POST", `/space/${slug}/processes/${processId}/participate/statement`, {
    text,
  });
}

export function participateGetNext(
  slug: string,
  processId: string,
): Promise<{ statement: StatementRecord | null }> {
  return request("GET", `/space/${slug}/processes/${processId}/participate/next`);
}

export function getClusterState(
  slug: string,
  processId: string,
): Promise<ClusterState> {
  return request("GET", `/space/${slug}/processes/${processId}/clusters`);
}

export function executeProcessAction(
  slug: string,
  processId: string,
  action: string,
): Promise<unknown> {
  return request("POST", `/space/${slug}/processes/${processId}/actions/${action}`, {});
}

// --- Issue API ---

export function getIssues(
  slug: string,
  filters?: { entry_type?: string; response_status?: string },
): Promise<CitizenIssue[]> {
  const params = new URLSearchParams();
  if (filters?.entry_type) params.set("entry_type", filters.entry_type);
  if (filters?.response_status) params.set("status", filters.response_status);
  const qs = params.toString();
  return request("GET", `/space/${slug}/issues${qs ? `?${qs}` : ""}`);
}

export function raiseIssue(
  slug: string,
  input: RaiseIssueInput,
): Promise<CitizenIssue> {
  return request("POST", `/space/${slug}/issues`, input);
}

export function signalIssue(
  slug: string,
  issueId: string,
  signal: string,
): Promise<{ signal: string; issue_id: string }> {
  return request("POST", `/space/${slug}/issues/${issueId}/signal`, {
    signal,
  });
}

export function postIssueResponse(
  slug: string,
  issueId: string,
  content: string,
): Promise<IssueResponse> {
  return request("POST", `/space/${slug}/issues/${issueId}/response`, {
    content,
  });
}

export function editIssueResponse(
  slug: string,
  issueId: string,
  content: string,
): Promise<IssueResponse> {
  return request("PATCH", `/space/${slug}/issues/${issueId}/response`, {
    content,
  });
}

export function closeIssue(
  slug: string,
  issueId: string,
): Promise<CitizenIssue> {
  return request("PATCH", `/space/${slug}/issues/${issueId}/close`, {});
}

// --- Ledger API ---

export function getLedger(
  slug: string,
  options?: LedgerQueryOptions,
): Promise<LedgerResponse> {
  const params = new URLSearchParams();
  if (options?.event_types) {
    for (const t of options.event_types) {
      params.append("event_types", t);
    }
  }
  if (options?.from) params.set("from", options.from);
  if (options?.to) params.set("to", options.to);
  if (options?.limit) params.set("limit", String(options.limit));
  if (options?.cursor) params.set("cursor", options.cursor);
  const qs = params.toString();
  return request("GET", `/space/${slug}/ledger${qs ? `?${qs}` : ""}`);
}
