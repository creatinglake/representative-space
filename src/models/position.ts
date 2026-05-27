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

export interface CreatePositionInput {
  topic: string;
  statement: string;
  linked_outcomes?: string[];
}

export interface UpdatePositionInput {
  statement: string;
  linked_outcomes?: string[];
}
