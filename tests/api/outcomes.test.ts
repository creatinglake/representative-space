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
  outcomePayload,
  createVerifiedSpace,
  TEST_INBOX_SECRET,
} from "../fixtures/helpers.js";

describe("Outcomes & Responses", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    process.env.RS_INBOX_SECRET = TEST_INBOX_SECRET;
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  describe("POST /space/:slug/inbox", () => {
    it("accepts outcome with valid HMAC", async () => {
      const slug = uniqueSlug("inbox");
      await createVerifiedSpace(slug, "entity-did-1");

      const body = JSON.stringify(outcomePayload(slug));
      const res = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body),
        body,
      });

      expect(res.status).toBe(201);
      const outcome = await res.json();
      expect(outcome.id).toMatch(/^out_/);
      expect(outcome.addressed_to_slug).toBe(slug);
      expect(outcome.originating_hub_id).toBe("civic-hub-local");
    });

    it("rejects with invalid HMAC", async () => {
      const slug = uniqueSlug("inbox-bad");
      await createVerifiedSpace(slug, "entity-did-1");

      const body = JSON.stringify(outcomePayload(slug));
      const res = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body, "wrong-secret"),
        body,
      });

      expect(res.status).toBe(403);
    });

    it("rejects with missing signature", async () => {
      const slug = uniqueSlug("inbox-nosig");
      await createVerifiedSpace(slug, "entity-did-1");

      const body = JSON.stringify(outcomePayload(slug));
      const res = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body,
      });

      expect(res.status).toBe(401);
    });

    it("rejects for nonexistent space", async () => {
      const body = JSON.stringify(outcomePayload("nonexistent-space-xyz"));
      const res = await fetch(
        `${getBaseUrl()}/space/nonexistent-space-xyz/inbox`,
        {
          method: "POST",
          headers: hmacHeaders(body),
          body,
        },
      );

      expect(res.status).toBe(404);
    });
  });

  describe("GET /space/:slug/outcomes", () => {
    it("returns outcomes in reverse-chron order", async () => {
      const slug = uniqueSlug("out-list");
      await createVerifiedSpace(slug, "entity-did-1");

      const body1 = JSON.stringify(outcomePayload(slug));
      await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body1),
        body: body1,
      });

      const payload2 = {
        ...outcomePayload(slug),
        outcome_summary: "Second outcome",
      };
      const body2 = JSON.stringify(payload2);
      await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body2),
        body: body2,
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/outcomes`);
      expect(res.status).toBe(200);
      const outcomes = await res.json();
      expect(outcomes).toHaveLength(2);
      expect(outcomes[0].outcome_summary).toBe("Second outcome");
    });
  });

  describe("GET /space/:slug/outcomes/:id", () => {
    it("returns outcome with response data", async () => {
      const slug = uniqueSlug("out-detail");
      await createVerifiedSpace(slug, "entity-did-1");

      const body = JSON.stringify(outcomePayload(slug));
      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body),
        body,
      });
      const outcome = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}`,
      );
      expect(res.status).toBe(200);
      const detail = await res.json();
      expect(detail.outcome.id).toBe(outcome.id);
      expect(detail.response).toBeNull();
      expect(detail.response_history).toEqual([]);
    });
  });

  describe("POST /space/:slug/outcomes/:id/response", () => {
    it("creates a response as verified entity", async () => {
      const slug = uniqueSlug("rsp-post");
      const entityDid = "entity-did-rsp";
      await createVerifiedSpace(slug, entityDid);

      const body = JSON.stringify(outcomePayload(slug));
      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body),
        body,
      });
      const outcome = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "We will act on this outcome." }),
        },
      );

      expect(res.status).toBe(201);
      const response = await res.json();
      expect(response.id).toMatch(/^rsp_/);
      expect(response.version).toBe(1);
      expect(response.content).toBe("We will act on this outcome.");
    });

    it("rejects without auth", async () => {
      const slug = uniqueSlug("rsp-noauth");
      await createVerifiedSpace(slug, "entity-did-1");

      const body = JSON.stringify(outcomePayload(slug));
      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body),
        body,
      });
      const outcome = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content: "test" }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("rejects with wrong entity", async () => {
      const slug = uniqueSlug("rsp-wrong");
      await createVerifiedSpace(slug, "entity-did-1");

      const body = JSON.stringify(outcomePayload(slug));
      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body),
        body,
      });
      const outcome = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "POST",
          headers: entityHeaders("wrong-entity"),
          body: JSON.stringify({ content: "test" }),
        },
      );

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /space/:slug/outcomes/:id/response", () => {
    it("creates new version preserving old", async () => {
      const slug = uniqueSlug("rsp-edit");
      const entityDid = "entity-did-edit";
      await createVerifiedSpace(slug, entityDid);

      const body = JSON.stringify(outcomePayload(slug));
      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body),
        body,
      });
      const outcome = await createRes.json();

      await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "First response" }),
        },
      );

      const editRes = await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "Updated response" }),
        },
      );

      expect(editRes.status).toBe(200);
      const edited = await editRes.json();
      expect(edited.version).toBe(2);
      expect(edited.prior_version_id).toBeDefined();
      expect(edited.content).toBe("Updated response");

      const detailRes = await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}`,
      );
      const detail = await detailRes.json();
      expect(detail.response.version).toBe(2);
      expect(detail.response_history).toHaveLength(2);
    });
  });

  describe("Events", () => {
    it("emits civic.response_posted and civic.response_edited", async () => {
      const slug = uniqueSlug("rsp-evt");
      const entityDid = "entity-did-evt";
      await createVerifiedSpace(slug, entityDid);

      const body = JSON.stringify(outcomePayload(slug));
      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(body),
        body,
      });
      const outcome = await createRes.json();

      await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "First" }),
        },
      );

      await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "Edited" }),
        },
      );

      const eventsRes = await fetch(
        `${getBaseUrl()}/events?space_slug=${slug}`,
      );
      const events = await eventsRes.json();
      const types = events.events.map(
        (e: { event_type: string }) => e.event_type,
      );

      expect(types).toContain("civic.outcome_delivered");
      expect(types).toContain("civic.response_posted");
      expect(types).toContain("civic.response_edited");
    });
  });
});
