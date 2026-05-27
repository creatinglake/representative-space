import type { Response as EntityResponse, CreateResponseInput, UpdateResponseInput } from "../models/response.js";
import type { Actor } from "../auth/types.js";
import { canActor } from "../auth/canActor.js";
import * as responseStore from "../stores/responseStore.js";
import * as outcomeStore from "../stores/outcomeStore.js";
import { getSpaceBySlug } from "../stores/spaceStore.js";
import { emitEvent } from "../events/eventEmitter.js";
import { generateId } from "../utils/id.js";

export function postResponse(
  slug: string,
  outcomeId: string,
  input: CreateResponseInput,
  actor: Actor,
): EntityResponse {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "respond_to_outcome", { type: "space", slug })) {
    throw new Error("Not authorized to respond on this space");
  }

  const outcome = outcomeStore.getOutcomeById(outcomeId);
  if (!outcome || outcome.addressed_to_slug !== slug) {
    throw new Error(`Outcome "${outcomeId}" not found on space "${slug}"`);
  }

  if (outcome.response_id) {
    throw new Error(
      "A response already exists for this outcome. Use edit to update it.",
    );
  }

  if (!input.content || input.content.trim().length === 0) {
    throw new Error("Response content is required");
  }

  const isImmutable =
    outcome.originating_process_type === "civic.polis_deliberation";

  const response: EntityResponse = {
    id: generateId("rsp"),
    author_did: actor.userId,
    in_response_to_type: "outcome_delivery",
    in_response_to_id: outcomeId,
    content: input.content.trim(),
    timestamp: new Date().toISOString(),
    version: 1,
    prior_version_id: null,
    ...(isImmutable ? { immutable: true } : {}),
  };

  responseStore.addResponse(response);
  outcomeStore.updateOutcome(outcomeId, { response_id: response.id });

  emitEvent({
    event_type: "civic.response_posted",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      response_id: response.id,
      outcome_id: outcomeId,
      in_response_to_type: "outcome_delivery",
    },
  });

  return response;
}

export function editResponse(
  slug: string,
  outcomeId: string,
  input: UpdateResponseInput,
  actor: Actor,
): EntityResponse {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "respond_to_outcome", { type: "space", slug })) {
    throw new Error("Not authorized to respond on this space");
  }

  const outcome = outcomeStore.getOutcomeById(outcomeId);
  if (!outcome || outcome.addressed_to_slug !== slug) {
    throw new Error(`Outcome "${outcomeId}" not found on space "${slug}"`);
  }

  if (!outcome.response_id) {
    throw new Error("No existing response to edit. Use post to create one.");
  }

  const prev = responseStore.getResponseById(outcome.response_id);
  if (!prev) {
    throw new Error("Previous response record not found");
  }

  if (prev.immutable) {
    throw new Error(
      "This response is immutable and cannot be edited. Responses to deliberative-loop outcomes are permanent.",
    );
  }

  if (!input.content || input.content.trim().length === 0) {
    throw new Error("Response content is required");
  }

  const response: EntityResponse = {
    id: generateId("rsp"),
    author_did: actor.userId,
    in_response_to_type: "outcome_delivery",
    in_response_to_id: outcomeId,
    content: input.content.trim(),
    timestamp: new Date().toISOString(),
    version: prev.version + 1,
    prior_version_id: prev.id,
  };

  responseStore.addResponse(response);
  outcomeStore.updateOutcome(outcomeId, { response_id: response.id });

  emitEvent({
    event_type: "civic.response_edited",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      response_id: response.id,
      outcome_id: outcomeId,
      prior_version_id: prev.id,
      version: response.version,
    },
  });

  return response;
}
