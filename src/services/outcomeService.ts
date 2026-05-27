import type { OutcomeDelivery, InboxPayload } from "../models/outcome.js";
import type { Response as EntityResponse } from "../models/response.js";
import * as store from "../stores/outcomeStore.js";
import { getLatestResponseForTarget, getResponsesByTargetId } from "../stores/responseStore.js";
import { getSpaceBySlug } from "../stores/spaceStore.js";
import { emitEvent } from "../events/eventEmitter.js";
import { generateId } from "../utils/id.js";

export async function receiveOutcomeDelivery(
  slug: string,
  payload: InboxPayload,
): Promise<OutcomeDelivery> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const outcome: OutcomeDelivery = {
    id: generateId("out"),
    originating_process_id: payload.originating_process_id,
    originating_hub_id: payload.originating_hub_id,
    outcome_summary: payload.outcome_summary,
    participation_stats: payload.participation_stats,
    result: payload.result,
    delivery_timestamp: new Date().toISOString(),
    addressed_to_slug: slug,
    response_id: null,
  };

  await store.addOutcome(outcome);

  await emitEvent({
    event_type: "civic.outcome_delivered",
    actor: payload.originating_hub_id,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      outcome_id: outcome.id,
      originating_process_id: payload.originating_process_id,
      originating_hub_id: payload.originating_hub_id,
    },
  });

  return outcome;
}

export interface InternalOutcomePayload {
  originating_process_id: string;
  originating_process_type: string;
  outcome_summary: string;
  participation_stats: {
    total_participants: number;
    eligible_participants?: number;
    participation_rate?: number;
  };
  result: Record<string, unknown>;
}

export async function writeInternalOutcome(
  slug: string,
  payload: InternalOutcomePayload,
): Promise<OutcomeDelivery> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const outcome: OutcomeDelivery = {
    id: generateId("out"),
    originating_process_id: payload.originating_process_id,
    originating_hub_id: "representative-space-local",
    originating_process_type: payload.originating_process_type,
    outcome_summary: payload.outcome_summary,
    participation_stats: payload.participation_stats,
    result: payload.result,
    delivery_timestamp: new Date().toISOString(),
    addressed_to_slug: slug,
    response_id: null,
  };

  await store.addOutcome(outcome);

  return outcome;
}

export interface OutcomeWithLatestResponse extends OutcomeDelivery {
  latest_response: EntityResponse | null;
}

export async function getOutcomes(slug: string): Promise<OutcomeWithLatestResponse[]> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const outcomes = await store.getOutcomesBySlug(slug);
  const results: OutcomeWithLatestResponse[] = [];
  for (const outcome of outcomes) {
    const latest = await getLatestResponseForTarget("outcome_delivery", outcome.id);
    results.push({
      ...outcome,
      latest_response: latest ?? null,
    });
  }
  return results;
}

export async function getOutcomeWithResponse(
  slug: string,
  outcomeId: string,
): Promise<{
  outcome: OutcomeDelivery;
  response: EntityResponse | null;
  response_history: EntityResponse[];
}> {
  const space = await getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const outcome = await store.getOutcomeById(outcomeId);
  if (!outcome || outcome.addressed_to_slug !== slug) {
    throw new Error(`Outcome "${outcomeId}" not found on space "${slug}"`);
  }

  const latest =
    (await getLatestResponseForTarget("outcome_delivery", outcomeId)) ?? null;
  const history = await getResponsesByTargetId(outcomeId);

  return { outcome, response: latest, response_history: history };
}
