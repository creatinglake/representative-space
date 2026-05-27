import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  adminHeaders,
  citizenHeaders,
  entityHeaders,
  uniqueSlug,
  createVerifiedSpace,
} from "../fixtures/helpers.js";

const ADMIN = "test-admin@example.com";
const CITIZEN = "citizen-archive-test@example.com";

function issueInput() {
  return {
    entry_type: "issue",
    title: "Test issue",
    body: "Test issue body for archive tests.",
    jurisdiction_tag: "us-ca-12",
  };
}

describe("Archive Mode", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = ADMIN;
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  describe("POST /space/:slug/archive", () => {
    it("admin archives a space", async () => {
      const slug = uniqueSlug("arch");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Term ended" }),
      });

      expect(res.status).toBe(200);
      const space = await res.json();
      expect(space.lifecycle_state).toBe("archived");
      expect(space.archived_at).toBeTruthy();
      expect(space.archived_by).toBe(ADMIN);
      expect(space.archived_reason).toBe("Term ended");
    });

    it("archives with successor space", async () => {
      const slug1 = uniqueSlug("arch-old");
      const slug2 = uniqueSlug("arch-new");
      await createVerifiedSpace(slug1, "entity-1");
      await createVerifiedSpace(slug2, "entity-2");

      const res = await fetch(`${getBaseUrl()}/space/${slug1}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          reason: "New term, new space",
          successor_space_slug: slug2,
        }),
      });

      expect(res.status).toBe(200);
      const space = await res.json();
      expect(space.successor_space_slug).toBe(slug2);
    });

    it("rejects nonexistent successor", async () => {
      const slug = uniqueSlug("arch-bad-succ");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          reason: "test",
          successor_space_slug: "nonexistent-space",
        }),
      });

      expect(res.status).toBe(404);
    });

    it("requires reason", async () => {
      const slug = uniqueSlug("arch-no-reason");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(400);
    });

    it("non-admin denied", async () => {
      const slug = uniqueSlug("arch-nonadmin");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify({ reason: "test" }),
      });

      expect(res.status).toBe(403);
    });

    it("emits civic.space.archived event", async () => {
      const slug = uniqueSlug("arch-evt");
      await createVerifiedSpace(slug, "entity-1");

      await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Term ended" }),
      });

      const eventsRes = await fetch(
        `${getBaseUrl()}/events?space_slug=${slug}`,
      );
      const events = await eventsRes.json();
      const archiveEvent = events.events.find(
        (e: any) => e.event_type === "civic.space.archived",
      );
      expect(archiveEvent).toBeDefined();
      expect(archiveEvent.data.reason).toBe("Term ended");
    });
  });

  describe("Archived space blocks writes", () => {
    it("rejects POST issues on archived space", async () => {
      const slug = uniqueSlug("arch-block-iss");
      await createVerifiedSpace(slug, "entity-1");

      await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Archived" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain("archived");
    });

    it("rejects POST positions on archived space", async () => {
      const slug = uniqueSlug("arch-block-pos");
      await createVerifiedSpace(slug, "entity-pos");

      await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Archived" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders("entity-pos"),
        body: JSON.stringify({
          topic: "Test",
          statement: "Test statement",
        }),
      });

      expect(res.status).toBe(403);
    });

    it("still serves GET issues on archived space", async () => {
      const slug = uniqueSlug("arch-read");
      await createVerifiedSpace(slug, "entity-1");

      // Create an issue before archiving
      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      // Archive the space
      await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Archived" }),
      });

      // GET should still work
      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`);
      expect(res.status).toBe(200);
      const issues = await res.json();
      expect(issues).toHaveLength(1);
    });

    it("includes successor_space_slug in 403 response", async () => {
      const slug1 = uniqueSlug("arch-succ-403");
      const slug2 = uniqueSlug("arch-succ-new");
      await createVerifiedSpace(slug1, "entity-1");
      await createVerifiedSpace(slug2, "entity-2");

      await fetch(`${getBaseUrl()}/space/${slug1}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          reason: "Moved",
          successor_space_slug: slug2,
        }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug1}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.successor_space_slug).toBe(slug2);
    });
  });

  describe("POST /space/:slug/unarchive", () => {
    it("admin unarchives a space", async () => {
      const slug = uniqueSlug("unarch");
      await createVerifiedSpace(slug, "entity-1");

      await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Test" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/unarchive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(200);
      const space = await res.json();
      expect(space.lifecycle_state).toBe("active");
      expect(space.archived_at).toBeNull();
      expect(space.successor_space_slug).toBeNull();
    });

    it("writes work again after unarchive", async () => {
      const slug = uniqueSlug("unarch-write");
      await createVerifiedSpace(slug, "entity-1");

      // Archive
      await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Test" }),
      });

      // Verify blocked
      const blocked = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      expect(blocked.status).toBe(403);

      // Unarchive
      await fetch(`${getBaseUrl()}/space/${slug}/unarchive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({}),
      });

      // Verify writes work again
      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      expect(res.status).toBe(201);
    });

    it("non-admin denied", async () => {
      const slug = uniqueSlug("unarch-nonadmin");
      await createVerifiedSpace(slug, "entity-1");

      await fetch(`${getBaseUrl()}/space/${slug}/archive`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Test" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/unarchive`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(403);
    });
  });
});
