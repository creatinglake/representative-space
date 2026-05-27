export type ResponseTargetType =
  | "outcome_delivery"
  | "position"
  | "issue_board_entry";

export interface Response {
  id: string;
  author_did: string;
  in_response_to_type: ResponseTargetType;
  in_response_to_id: string;
  content: string;
  timestamp: string;
  version: number;
  prior_version_id: string | null;
  immutable?: boolean;
}

export interface CreateResponseInput {
  content: string;
}

export interface UpdateResponseInput {
  content: string;
}
