import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  entityHeaders,
  uniqueSlug,
  createVerifiedSpace,
} from "../fixtures/helpers.js";

describe("Position Statements", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  describe("POST /space/:slug/positions", () => {
    it("creates a position as verified entity", async () => {
      const slug = uniqueSlug("pos-post");
      const entityDid = "entity-did-pos";
      await createVerifiedSpace(slug, entityDid);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({
          topic: "Housing Policy",
          statement: "I support expanding affordable housing programs.",
        }),
      });

      expect(res.status).toBe(201);
      const position = await res.json();
      expect(position.id).toMatch(/^pos_/);
      expect(position.topic).toBe("Housing Policy");
      expect(position.version).toBe(1);
      expect(position.status).toBe("current");
    });

    it("rejects without auth", async () => {
      const slug = uniqueSlug("pos-noauth");
      await createVerifiedSpace(slug, "entity-did-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          topic: "Test",
          statement: "Test statement",
        }),
      });

      expect(res.status).toBe(401);
    });

    it("rejects with wrong entity", async () => {
      const slug = uniqueSlug("pos-wrong");
      await createVerifiedSpace(slug, "entity-did-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders("wrong-entity"),
        body: JSON.stringify({
          topic: "Test",
          statement: "Test statement",
        }),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /space/:slug/positions", () => {
    it("returns only current positions", async () => {
      const slug = uniqueSlug("pos-list");
      const entityDid = "entity-did-list";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/positions`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            topic: "Climate",
            statement: "Original position",
          }),
        },
      );
      const original = await createRes.json();

      await fetch(`${getBaseUrl()}/space/${slug}/positions/${original.id}`, {
        method: "PATCH",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ statement: "Updated position" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/positions`);
      expect(res.status).toBe(200);
      const positions = await res.json();
      expect(positions).toHaveLength(1);
      expect(positions[0].statement).toBe("Updated position");
      expect(positions[0].status).toBe("current");
    });
  });

  describe("PATCH /space/:slug/positions/:id", () => {
    it("creates new version and supersedes old", async () => {
      const slug = uniqueSlug("pos-edit");
      const entityDid = "entity-did-edit";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/positions`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            topic: "Education",
            statement: "Original stance on education.",
          }),
        },
      );
      const original = await createRes.json();

      const editRes = await fetch(
        `${getBaseUrl()}/space/${slug}/positions/${original.id}`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            statement: "Updated stance on education.",
          }),
        },
      );

      expect(editRes.status).toBe(200);
      const updated = await editRes.json();
      expect(updated.version).toBe(2);
      expect(updated.topic).toBe("Education");
      expect(updated.prior_version_id).toBe(original.id);
      expect(updated.status).toBe("current");
    });
  });

  describe("GET /space/:slug/positions/:id/history", () => {
    it("returns full version chain", async () => {
      const slug = uniqueSlug("pos-hist");
      const entityDid = "entity-did-hist";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/positions`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            topic: "Healthcare",
            statement: "Version 1",
          }),
        },
      );
      const v1 = await createRes.json();

      const editRes = await fetch(
        `${getBaseUrl()}/space/${slug}/positions/${v1.id}`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ statement: "Version 2" }),
        },
      );
      const v2 = await editRes.json();

      const histRes = await fetch(
        `${getBaseUrl()}/space/${slug}/positions/${v2.id}/history`,
      );
      expect(histRes.status).toBe(200);
      const history = await histRes.json();
      expect(history).toHaveLength(2);
      expect(history[0].version).toBe(2);
      expect(history[1].version).toBe(1);
    });
  });

  describe("Events", () => {
    it("emits civic.position_posted and civic.position_updated", async () => {
      const slug = uniqueSlug("pos-evt");
      const entityDid = "entity-did-evt";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/positions`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            topic: "Transport",
            statement: "Original",
          }),
        },
      );
      const pos = await createRes.json();

      await fetch(`${getBaseUrl()}/space/${slug}/positions/${pos.id}`, {
        method: "PATCH",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ statement: "Edited" }),
      });

      const eventsRes = await fetch(
        `${getBaseUrl()}/events?space_slug=${slug}`,
      );
      const events = await eventsRes.json();
      const types = events.events.map(
        (e: { event_type: string }) => e.event_type,
      );

      expect(types).toContain("civic.position_posted");
      expect(types).toContain("civic.position_updated");
    });
  });
});
