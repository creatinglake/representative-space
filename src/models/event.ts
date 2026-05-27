export interface EventSource {
  hub_id: string;
  hub_url: string;
}

export interface EventMeta {
  visibility: "public" | "restricted";
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
  source: EventSource;
  dedupe_key?: string;
  data: Record<string, unknown>;
  meta: EventMeta;
}

export interface CreateEventInput {
  event_type: string;
  actor: string;
  space_slug: string;
  jurisdiction: string;
  data: Record<string, unknown>;
  dedupe_key?: string;
  visibility?: "public" | "restricted";
  action_url_path?: string;
  timestamp?: string;
}
