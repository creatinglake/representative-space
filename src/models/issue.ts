export type EntryType = "issue" | "question" | "poll";
export type IssueStatus = "open" | "responded" | "closed";

export interface PollOption {
  id: string;
  label: string;
}

export interface ModerationInfo {
  hidden: boolean;
  reason?: string;
  hidden_by?: string;
  hidden_at?: string;
  restored_at?: string;
}

export interface SignalTally {
  support: number;
  oppose: number;
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

export interface IssueResponse {
  id: string;
  issue_id: string;
  author_did: string;
  in_response_to_type: "issue_board_entry";
  content: string;
  timestamp: string;
  version: number;
  prior_version_id: string | null;
}

export interface RaiseIssueInput {
  entry_type: EntryType;
  title: string;
  body: string;
  jurisdiction_tag?: string;
  poll_options?: string[];
}

export interface EditIssueInput {
  title?: string;
  body?: string;
}
