import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  adminHeaders,
  entityHeaders,
  uniqueSlug,
  hmacHeaders,
  createVerifiedSpace,
  outcomePayload,
  TEST_INBOX_SECRET,
} from "../fixtures/helpers.js";
import { writeInternalOutcome } from "../../src/services/outcomeService.js";
import { addOutcome } from "../../src/stores/outcomeStore.js";
import { getSpaceBySlug } from "../../src/stores/spaceStore.js";
import { generateId } from "../../src/utils/id.js";

const ENTITY_DID = "entity-immut";

describe("Immutable Responses — Polis deliberation outcomes", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    process.env.RS_INBOX_SECRET = TEST_INBOX_SECRET;
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  async function createPolisOutcome(slug: string) {
    // Create outcome as if the Polis handler produced it
    const outcome = writeInternalOutcome(slug, {
      originating_process_id: "prc_test_polis",
      originating_process_type: "civic.polis_deliberation",
      outcome_summary: "Deliberation found consensus on infrastructure priorities.",
      participation_stats: { total_participants: 25 },
      result: {
        directed_questions: ["What is your timeline for addressing potholes?"],
      },
    });
    return outcome;
  }

  async function createRegularOutcome(slug: string) {
    // Create a normal external outcome via HMAC inbox
    const payload = outcomePayload(slug);
    const body = JSON.stringify(payload);
    const res = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
      method: "POST",
      headers: hmacHeaders(body),
      body,
    });
    return res.json();
  }

  it("response to polis outcome is immutable — edit rejected", async () => {
    const slug = uniqueSlug("immut-polis");
    await createVerifiedSpace(slug, ENTITY_DID);

    const outcome = await createPolisOutcome(slug);

    // Post response
    const postRes = await fetch(
      `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
      {
        method: "POST",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify({
          content: "We will prioritize pothole repairs in Q1.",
        }),
      },
    );
    expect(postRes.status).toBe(201);
    const response = await postRes.json();
    expect(response.immutable).toBe(true);

    // Attempt edit → rejected
    const editRes = await fetch(
      `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
      {
        method: "PATCH",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify({
          content: "Actually, we changed our mind.",
        }),
      },
    );
    expect(editRes.status).toBe(400);
    const editBody = await editRes.json();
    expect(editBody.error).toContain("immutable");
  });

  it("response to regular outcome is editable", async () => {
    const slug = uniqueSlug("immut-regular");
    await createVerifiedSpace(slug, ENTITY_DID);

    const outcome = await createRegularOutcome(slug);

    // Post response
    const postRes = await fetch(
      `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
      {
        method: "POST",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify({ content: "Thank you for this outcome." }),
      },
    );
    expect(postRes.status).toBe(201);
    const response = await postRes.json();
    expect(response.immutable).toBeUndefined();

    // Edit → succeeds
    const editRes = await fetch(
      `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
      {
        method: "PATCH",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify({ content: "Updated response content." }),
      },
    );
    expect(editRes.status).toBe(200);
    const edited = await editRes.json();
    expect(edited.version).toBe(2);
    expect(edited.content).toBe("Updated response content.");
  });

  it("polis outcome has originating_process_type in GET", async () => {
    const slug = uniqueSlug("immut-type");
    await createVerifiedSpace(slug, ENTITY_DID);

    await createPolisOutcome(slug);

    const res = await fetch(`${getBaseUrl()}/space/${slug}/outcomes`);
    expect(res.status).toBe(200);
    const outcomes = await res.json();
    expect(outcomes).toHaveLength(1);
    expect(outcomes[0].originating_process_type).toBe(
      "civic.polis_deliberation",
    );
    expect(outcomes[0].originating_hub_id).toBe("representative-space-local");
  });
});
