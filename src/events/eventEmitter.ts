import type { CivicEvent, CreateEventInput } from "../models/event.js";
import { appendEvent } from "../stores/eventStore.js";
import { generateId } from "../utils/id.js";
import { baseUrl, uiBaseUrl } from "../utils/baseUrl.js";

const SERVICE_ID = "representative-space-local";

export function emitEvent(input: CreateEventInput): CivicEvent {
  const hub = baseUrl();
  const ui = uiBaseUrl();
  const path = input.action_url_path ?? `/space/${input.space_slug}`;
  const isAbsolute = /^https?:\/\//i.test(path);

  const event: CivicEvent = {
    id: generateId("evt"),
    version: "1.0",
    event_type: input.event_type,
    timestamp: input.timestamp ?? new Date().toISOString(),
    process_id: "",
    actor: input.actor,
    jurisdiction: input.jurisdiction,
    action_url: isAbsolute ? path : `${ui}${path}`,
    source: {
      hub_id: SERVICE_ID,
      hub_url: hub,
    },
    data: { ...input.data, space_slug: input.space_slug },
    meta: {
      visibility: input.visibility ?? "public",
    },
  };

  if (input.dedupe_key) {
    event.dedupe_key = input.dedupe_key;
  }

  appendEvent(event);

  console.log(`[event] ${event.event_type} by ${event.actor} (${event.id})`);

  return event;
}
