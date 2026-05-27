import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  adminHeaders,
  entityHeaders,
  citizenHeaders,
  uniqueSlug,
  createVerifiedSpace,
  hmacHeaders,
  outcomePayload,
} from "../fixtures/helpers.js";

const CITIZEN = "citizen-ledger@test.com";

function issueInput(overrides?: Record<string, unknown>) {
  return {
    entry_type: "issue",
    title: "Ledger test issue",
    body: "This issue is for ledger testing.",
    jurisdiction_tag: "us-ca-12",
    ...overrides,
  };
}

describe("Ledger — GET /space/:slug/ledger", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    process.env.RS_INBOX_SECRET = "test-hmac-secret-key";
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  // ─── Basic ──────────────────────────────────────────────

  describe("Basic", () => {
    it("returns empty ledger for new space", async () => {
      const slug = uniqueSlug("ledger-empty");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/ledger`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.events).toEqual([]);
      expect(body.next_cursor).toBeNull();
      expect(body.has_more).toBe(false);
    });

    it("returns 404 for nonexistent space", async () => {
      const res = await fetch(
        `${getBaseUrl()}/space/nonexistent-space-xyz/ledger`,
      );
      expect(res.status).toBe(404);
    });

    it("only returns ledger-renderable event types", async () => {
      const slug = uniqueSlug("ledger-types");
      const entityDid = "entity-ledger-types";
      await createVerifiedSpace(slug, entityDid);

      // space.created + space.verified are NOT renderable
      // Post a position (renderable)
      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "Education", statement: "Fund schools" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/ledger`);
      const body = await res.json();

      // Only position_posted, not space.created / space.verified
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event_type).toBe("civic.position_posted");
    });
  });

  // ─── Event type filtering ──────────────────────────────

  describe("Event type filtering", () => {
    it("filters by single event type", async () => {
      const slug = uniqueSlug("ledger-filter1");
      const entityDid = "entity-filter1";
      await createVerifiedSpace(slug, entityDid);

      // Post a position
      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "Health", statement: "Universal care" }),
      });

      // Raise an issue
      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?event_types=civic.position_posted`,
      );
      const body = await res.json();
      expect(body.events).toHaveLength(1);
      expect(body.events[0].event_type).toBe("civic.position_posted");
    });

    it("filters by multiple event types", async () => {
      const slug = uniqueSlug("ledger-filter-m");
      const entityDid = "entity-filter-m";
      await createVerifiedSpace(slug, entityDid);

      // Post a position
      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "Tax", statement: "Lower taxes" }),
      });

      // Raise an issue
      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      // Deliver an outcome
      const outBody = JSON.stringify(outcomePayload(slug));
      await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(outBody),
        body: outBody,
      });

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?event_types=civic.position_posted&event_types=civic.issue_raised`,
      );
      const body = await res.json();
      expect(body.events).toHaveLength(2);
      const types = body.events.map((e: any) => e.event_type);
      expect(types).toContain("civic.position_posted");
      expect(types).toContain("civic.issue_raised");
    });

    it("returns 400 for invalid event type", async () => {
      const slug = uniqueSlug("ledger-invalid");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?event_types=civic.space.created`,
      );
      expect(res.status).toBe(400);
    });

    it("no filter returns all renderable types", async () => {
      const slug = uniqueSlug("ledger-all");
      const entityDid = "entity-all";
      await createVerifiedSpace(slug, entityDid);

      // Position
      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "Jobs", statement: "Create jobs" }),
      });

      // Issue
      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/ledger`);
      const body = await res.json();
      expect(body.events).toHaveLength(2);
    });
  });

  // ─── Date range ────────────────────────────────────────

  describe("Date range", () => {
    it("filters by from date", async () => {
      const slug = uniqueSlug("ledger-from");
      const entityDid = "entity-from";
      await createVerifiedSpace(slug, entityDid);

      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "Test", statement: "Statement" }),
      });

      // Future date — nothing should match
      const futureDate = new Date(Date.now() + 86400000).toISOString();
      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?from=${futureDate}`,
      );
      const body = await res.json();
      expect(body.events).toHaveLength(0);
    });

    it("filters by to date", async () => {
      const slug = uniqueSlug("ledger-to");
      const entityDid = "entity-to";
      await createVerifiedSpace(slug, entityDid);

      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "Test", statement: "Statement" }),
      });

      // Past date — nothing should match
      const pastDate = new Date(Date.now() - 86400000).toISOString();
      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?to=${pastDate}`,
      );
      const body = await res.json();
      expect(body.events).toHaveLength(0);
    });

    it("filters by both from and to", async () => {
      const slug = uniqueSlug("ledger-range");
      const entityDid = "entity-range";
      await createVerifiedSpace(slug, entityDid);

      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "Test", statement: "Statement" }),
      });

      // Wide range includes the event
      const from = new Date(Date.now() - 86400000).toISOString();
      const to = new Date(Date.now() + 86400000).toISOString();
      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?from=${from}&to=${to}`,
      );
      const body = await res.json();
      expect(body.events).toHaveLength(1);
    });
  });

  // ─── Pagination ────────────────────────────────────────

  describe("Pagination", () => {
    it("respects custom limit", async () => {
      const slug = uniqueSlug("ledger-limit");
      const entityDid = "entity-limit";
      await createVerifiedSpace(slug, entityDid);

      // Create 3 positions
      for (let i = 0; i < 3; i++) {
        await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            topic: `Topic ${i}`,
            statement: `Statement ${i}`,
          }),
        });
      }

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?limit=2`,
      );
      const body = await res.json();
      expect(body.events).toHaveLength(2);
      expect(body.has_more).toBe(true);
      expect(body.next_cursor).toBeTruthy();
    });

    it("clamps limit to 100", async () => {
      const slug = uniqueSlug("ledger-clamp");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?limit=999`,
      );
      expect(res.status).toBe(200);
      // Just verify it doesn't error — the limit is clamped internally
    });

    it("next_cursor is null when all events fit", async () => {
      const slug = uniqueSlug("ledger-nocursor");
      const entityDid = "entity-nocursor";
      await createVerifiedSpace(slug, entityDid);

      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "One", statement: "Only one" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/ledger`);
      const body = await res.json();
      expect(body.events).toHaveLength(1);
      expect(body.has_more).toBe(false);
      expect(body.next_cursor).toBeNull();
    });

    it("cursor returns next page with no overlap", async () => {
      const slug = uniqueSlug("ledger-cursor");
      const entityDid = "entity-cursor";
      await createVerifiedSpace(slug, entityDid);

      // Create 5 positions
      for (let i = 0; i < 5; i++) {
        await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            topic: `Topic ${i}`,
            statement: `Statement ${i}`,
          }),
        });
      }

      // Page 1
      const res1 = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?limit=2`,
      );
      const page1 = await res1.json();
      expect(page1.events).toHaveLength(2);
      expect(page1.has_more).toBe(true);

      // Page 2
      const res2 = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?limit=2&cursor=${page1.next_cursor}`,
      );
      const page2 = await res2.json();
      expect(page2.events).toHaveLength(2);
      expect(page2.has_more).toBe(true);

      // Page 3
      const res3 = await fetch(
        `${getBaseUrl()}/space/${slug}/ledger?limit=2&cursor=${page2.next_cursor}`,
      );
      const page3 = await res3.json();
      expect(page3.events).toHaveLength(1);
      expect(page3.has_more).toBe(false);

      // Verify no overlap across pages
      const allIds = [
        ...page1.events.map((e: any) => e.id),
        ...page2.events.map((e: any) => e.id),
        ...page3.events.map((e: any) => e.id),
      ];
      expect(new Set(allIds).size).toBe(5);
    });

    it("multi-page iteration covers all events", async () => {
      const slug = uniqueSlug("ledger-iterate");
      const entityDid = "entity-iterate";
      await createVerifiedSpace(slug, entityDid);

      // Create 7 positions
      for (let i = 0; i < 7; i++) {
        await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({
            topic: `Topic ${i}`,
            statement: `Statement ${i}`,
          }),
        });
      }

      const collected: any[] = [];
      let cursor: string | null = null;

      do {
        const url = cursor
          ? `${getBaseUrl()}/space/${slug}/ledger?limit=3&cursor=${cursor}`
          : `${getBaseUrl()}/space/${slug}/ledger?limit=3`;
        const res = await fetch(url);
        const page = await res.json();
        collected.push(...page.events);
        cursor = page.next_cursor;
      } while (cursor);

      expect(collected).toHaveLength(7);
      // Verify unique
      expect(new Set(collected.map((e: any) => e.id)).size).toBe(7);
    });
  });

  // ─── Visibility ────────────────────────────────────────

  describe("Visibility", () => {
    it("excludes restricted-visibility events", async () => {
      const slug = uniqueSlug("ledger-vis");
      await createVerifiedSpace(slug, "entity-1");

      // Create an issue and hide it (generates a restricted event)
      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      await fetch(`${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ reason: "Test hiding" }),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/ledger`);
      const body = await res.json();

      // Should have issue_raised but NOT content.hidden
      const types = body.events.map((e: any) => e.event_type);
      expect(types).toContain("civic.issue_raised");
      expect(types).not.toContain("civic.content.hidden");
    });
  });

  // ─── Ordering ──────────────────────────────────────────

  describe("Ordering", () => {
    it("returns events in reverse-chronological order", async () => {
      const slug = uniqueSlug("ledger-order");
      const entityDid = "entity-order";
      await createVerifiedSpace(slug, entityDid);

      // Create events in sequence
      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "First", statement: "First position" }),
      });

      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput({ title: "Second - issue" })),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/ledger`);
      const body = await res.json();

      expect(body.events).toHaveLength(2);
      // Most recent first
      const t0 = new Date(body.events[0].timestamp).getTime();
      const t1 = new Date(body.events[1].timestamp).getTime();
      expect(t0).toBeGreaterThanOrEqual(t1);
    });
  });

  // ─── End-to-end ────────────────────────────────────────

  describe("End-to-end multi-module", () => {
    it("ledger includes outcome + position + issue + response events", async () => {
      const slug = uniqueSlug("ledger-e2e");
      const entityDid = "entity-e2e";
      await createVerifiedSpace(slug, entityDid);

      // Deliver an outcome
      const outBody = JSON.stringify(outcomePayload(slug));
      await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(outBody),
        body: outBody,
      });

      // Post a position
      await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders(entityDid),
        body: JSON.stringify({ topic: "E2E", statement: "End to end test" }),
      });

      // Raise an issue
      const issueRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await issueRes.json();

      // Entity responds to issue
      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "We are on it." }),
        },
      );

      const res = await fetch(`${getBaseUrl()}/space/${slug}/ledger`);
      const body = await res.json();

      const types = body.events.map((e: any) => e.event_type);
      expect(types).toContain("civic.outcome_delivered");
      expect(types).toContain("civic.position_posted");
      expect(types).toContain("civic.issue_raised");
      expect(types).toContain("civic.issue_responded");

      // Should NOT include space.created, space.verified
      expect(types).not.toContain("civic.space.created");
      expect(types).not.toContain("civic.space.verified");
    });
  });
});
