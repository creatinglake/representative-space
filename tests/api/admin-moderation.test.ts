import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  adminHeaders,
  citizenHeaders,
  uniqueSlug,
  createVerifiedSpace,
} from "../fixtures/helpers.js";

const ADMIN = "test-admin@example.com";
const CITIZEN = "citizen-admin-test@example.com";

function issueInput(overrides?: Record<string, unknown>) {
  return {
    entry_type: "issue",
    title: "Park needs better lighting",
    body: "The walking paths in Riverside Park are too dark at night.",
    jurisdiction_tag: "us-ca-12",
    ...overrides,
  };
}

describe("Admin Moderation (hide/restore)", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = ADMIN;
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  async function createIssue(slug: string) {
    const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
      method: "POST",
      headers: citizenHeaders(CITIZEN),
      body: JSON.stringify(issueInput()),
    });
    return res.json();
  }

  describe("PATCH /space/:slug/issues/:id/hide", () => {
    it("admin hides an issue", async () => {
      const slug = uniqueSlug("hide");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({ reason: "Personal attack in the body" }),
        },
      );

      expect(res.status).toBe(200);
      const hidden = await res.json();
      expect(hidden.moderation.hidden).toBe(true);
      expect(hidden.moderation.reason).toBe("Personal attack in the body");
      expect(hidden.moderation.hidden_by).toBe(ADMIN);
      expect(hidden.moderation.hidden_at).toBeTruthy();
    });

    it("hidden issue excluded from list", async () => {
      const slug = uniqueSlug("hide-list");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({ reason: "Spam" }),
        },
      );

      const listRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`);
      const issues = await listRes.json();
      expect(issues).toHaveLength(0);
    });

    it("hidden issue body is redacted on direct get", async () => {
      const slug = uniqueSlug("hide-redact");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({ reason: "Harassment" }),
        },
      );

      const detailRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}`,
      );
      const detail = await detailRes.json();
      expect(detail.body).toBe("[Content hidden by moderator]");
      expect(detail.title).toBe("Park needs better lighting"); // title preserved for reference
    });

    it("requires reason", async () => {
      const slug = uniqueSlug("hide-no-reason");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(400);
    });

    it("non-admin denied", async () => {
      const slug = uniqueSlug("hide-nonadmin");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: citizenHeaders(CITIZEN),
          body: JSON.stringify({ reason: "test" }),
        },
      );

      expect(res.status).toBe(403);
    });
  });

  describe("PATCH /space/:slug/issues/:id/restore", () => {
    it("admin restores a hidden issue", async () => {
      const slug = uniqueSlug("restore");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      // Hide first
      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({ reason: "Spam" }),
        },
      );

      // Then restore
      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/restore`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(200);
      const restored = await res.json();
      expect(restored.moderation.hidden).toBe(false);
      expect(restored.moderation.restored_at).toBeTruthy();
    });

    it("restored issue reappears in list", async () => {
      const slug = uniqueSlug("restore-list");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({ reason: "Spam" }),
        },
      );

      // Verify hidden
      const hiddenList = await (
        await fetch(`${getBaseUrl()}/space/${slug}/issues`)
      ).json();
      expect(hiddenList).toHaveLength(0);

      // Restore
      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/restore`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({}),
        },
      );

      // Verify restored
      const restoredList = await (
        await fetch(`${getBaseUrl()}/space/${slug}/issues`)
      ).json();
      expect(restoredList).toHaveLength(1);
      expect(restoredList[0].id).toBe(issue.id);
    });

    it("non-admin denied", async () => {
      const slug = uniqueSlug("restore-nonadmin");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/restore`,
        {
          method: "PATCH",
          headers: citizenHeaders(CITIZEN),
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(403);
    });
  });

  describe("GET /admin/moderation/log", () => {
    it("returns moderation events for admin", async () => {
      const slug = uniqueSlug("mod-log");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({ reason: "Personal attack" }),
        },
      );

      const res = await fetch(`${getBaseUrl()}/admin/moderation/log`, {
        headers: adminHeaders(),
      });

      expect(res.status).toBe(200);
      const log = await res.json();
      expect(log.count).toBeGreaterThanOrEqual(1);

      const hideEvent = log.entries.find(
        (e: any) => e.event_type === "civic.content.hidden",
      );
      expect(hideEvent).toBeDefined();
      expect(hideEvent.data.content_id).toBe(issue.id);
      expect(hideEvent.data.reason).toBe("Personal attack");
    });

    it("non-admin denied", async () => {
      const res = await fetch(`${getBaseUrl()}/admin/moderation/log`, {
        headers: citizenHeaders(CITIZEN),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("Public events exclude restricted-visibility", () => {
    it("hide/restore events not in public feed", async () => {
      const slug = uniqueSlug("evt-filter");
      await createVerifiedSpace(slug, "entity-1");
      const issue = await createIssue(slug);

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/hide`,
        {
          method: "PATCH",
          headers: adminHeaders(),
          body: JSON.stringify({ reason: "Test" }),
        },
      );

      const eventsRes = await fetch(`${getBaseUrl()}/events`);
      const events = await eventsRes.json();

      const restricted = events.events.filter(
        (e: any) => e.meta.visibility === "restricted",
      );
      expect(restricted).toHaveLength(0);

      // But the event IS in the admin log
      const logRes = await fetch(`${getBaseUrl()}/admin/moderation/log`, {
        headers: adminHeaders(),
      });
      const log = await logRes.json();
      expect(log.count).toBeGreaterThanOrEqual(1);
    });
  });
});
