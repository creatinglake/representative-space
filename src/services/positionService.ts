import type { Position, CreatePositionInput, UpdatePositionInput } from "../models/position.js";
import type { Actor } from "../auth/types.js";
import { canActor } from "../auth/canActor.js";
import * as store from "../stores/positionStore.js";
import { getSpaceBySlug } from "../stores/spaceStore.js";
import { emitEvent } from "../events/eventEmitter.js";
import { generateId } from "../utils/id.js";

export function postPosition(
  slug: string,
  input: CreatePositionInput,
  actor: Actor,
): Position {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "post_position", { type: "space", slug })) {
    throw new Error("Not authorized to post positions on this space");
  }

  if (!input.topic || input.topic.trim().length === 0) {
    throw new Error("Position topic is required");
  }
  if (!input.statement || input.statement.trim().length === 0) {
    throw new Error("Position statement is required");
  }

  const position: Position = {
    id: generateId("pos"),
    topic: input.topic.trim(),
    author_did: actor.userId,
    space_slug: slug,
    statement: input.statement.trim(),
    timestamp: new Date().toISOString(),
    version: 1,
    status: "current",
    prior_version_id: null,
    linked_outcomes: input.linked_outcomes ?? [],
  };

  store.addPosition(position);

  emitEvent({
    event_type: "civic.position_posted",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      position_id: position.id,
      topic: position.topic,
    },
  });

  return position;
}

export function editPosition(
  slug: string,
  positionId: string,
  input: UpdatePositionInput,
  actor: Actor,
): Position {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "edit_position", { type: "space", slug })) {
    throw new Error("Not authorized to edit positions on this space");
  }

  const prev = store.getPositionById(positionId);
  if (!prev || prev.space_slug !== slug) {
    throw new Error(`Position "${positionId}" not found on space "${slug}"`);
  }

  if (prev.status !== "current") {
    throw new Error("Cannot edit a superseded position");
  }

  if (!input.statement || input.statement.trim().length === 0) {
    throw new Error("Position statement is required");
  }

  store.updatePosition(prev.id, { status: "superseded" });

  const position: Position = {
    id: generateId("pos"),
    topic: prev.topic,
    author_did: prev.author_did,
    space_slug: slug,
    statement: input.statement.trim(),
    timestamp: new Date().toISOString(),
    version: prev.version + 1,
    status: "current",
    prior_version_id: prev.id,
    linked_outcomes: input.linked_outcomes ?? prev.linked_outcomes,
  };

  store.addPosition(position);

  emitEvent({
    event_type: "civic.position_updated",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      position_id: position.id,
      prior_version_id: prev.id,
      topic: position.topic,
      version: position.version,
    },
  });

  return position;
}

export function getPositions(slug: string): Position[] {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }
  return store.getPositionsBySlug(slug);
}

export function getPositionHistory(
  slug: string,
  positionId: string,
): Position[] {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }
  const position = store.getPositionById(positionId);
  if (!position || position.space_slug !== slug) {
    throw new Error(`Position "${positionId}" not found on space "${slug}"`);
  }
  return store.getPositionHistory(positionId);
}
