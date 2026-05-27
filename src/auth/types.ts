export type ActorRole =
  | "citizen"
  | "verified_citizen"
  | "verified_entity"
  | "admin";

export interface Actor {
  role: ActorRole;
  userId: string;
  spaceSlug?: string;
}

export type Action =
  | "create_space"
  | "edit_space"
  | "edit_profile"
  | "verify_entity"
  | "view_space"
  | "list_spaces"
  | "respond_to_outcome"
  | "post_position"
  | "edit_position"
  | "raise_issue"
  | "signal_issue"
  | "close_issue"
  | "respond_to_issue"
  | "hide_content"
  | "restore_content"
  | "archive_space"
  | "unarchive_space"
  | "host_deliberation"
  | "participate_deliberation";

export interface Resource {
  type: "space";
  slug?: string;
}
