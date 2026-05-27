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
} from "../fixtures/helpers.js";

const VERIFIED_CITIZEN = "verified-citizen@test.com";

function issueInput(overrides?: Record<string, unknown>) {
  return {
    entry_type: "issue",
    title: "Fix the potholes on Main St",
    body: "The potholes on Main St have been a hazard for months.",
    jurisdiction_tag: "us-ca-12",
    ...overrides,
  };
}

describe("Citizen Issue Board", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  describe("POST /space/:slug/issues — raise issue", () => {
    it("creates an issue as verified citizen", async () => {
      const slug = uniqueSlug("iss-post");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(201);
      const issue = await res.json();
      expect(issue.id).toMatch(/^iss_/);
      expect(issue.entry_type).toBe("issue");
      expect(issue.title).toBe("Fix the potholes on Main St");
      expect(issue.status).toBe("open");
      expect(issue.version).toBe(1);
    });

    it("creates a question", async () => {
      const slug = uniqueSlug("iss-q");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(
          issueInput({ entry_type: "question", title: "What is your plan for schools?" }),
        ),
      });

      expect(res.status).toBe(201);
      const issue = await res.json();
      expect(issue.entry_type).toBe("question");
    });

    it("creates a poll with options", async () => {
      const slug = uniqueSlug("iss-poll");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(
          issueInput({
            entry_type: "poll",
            title: "What should we prioritize?",
            poll_options: ["Roads", "Schools", "Parks"],
          }),
        ),
      });

      expect(res.status).toBe(201);
      const issue = await res.json();
      expect(issue.entry_type).toBe("poll");
      expect(issue.poll_options).toHaveLength(3);
      expect(issue.poll_options[0].id).toBe("opt_1");
      expect(issue.poll_options[0].label).toBe("Roads");
    });

    it("rejects without auth", async () => {
      const slug = uniqueSlug("iss-noauth");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(401);
    });

    it("rejects admin (admin cannot raise issues)", async () => {
      const slug = uniqueSlug("iss-admin");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(403);
    });
  });

  describe("GET /space/:slug/issues — list issues", () => {
    it("returns issues sorted by net support (highest first)", async () => {
      const slug = uniqueSlug("iss-list");
      const entityDid = "entity-list";
      await createVerifiedSpace(slug, entityDid);

      const citizen1 = "citizen-a@test.com";
      const citizen2 = "citizen-b@test.com";

      // Create two issues
      const res1 = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(citizen1),
        body: JSON.stringify(issueInput({ title: "Low support issue" })),
      });
      const issue1 = await res1.json();

      const res2 = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(citizen2),
        body: JSON.stringify(issueInput({ title: "High support issue" })),
      });
      const issue2 = await res2.json();

      // Add 2 support signals to issue2
      await fetch(`${getBaseUrl()}/space/${slug}/issues/${issue2.id}/signal`, {
        method: "POST",
        headers: citizenHeaders(citizen1),
        body: JSON.stringify({ signal: "support" }),
      });
      await fetch(`${getBaseUrl()}/space/${slug}/issues/${issue2.id}/signal`, {
        method: "POST",
        headers: citizenHeaders(citizen2),
        body: JSON.stringify({ signal: "support" }),
      });

      const listRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`);
      expect(listRes.status).toBe(200);
      const issues = await listRes.json();
      expect(issues).toHaveLength(2);
      expect(issues[0].title).toBe("High support issue");
      expect(issues[0].signal_tally.support).toBe(2);
    });

    it("filters by entry_type", async () => {
      const slug = uniqueSlug("iss-filter");
      await createVerifiedSpace(slug, "entity-1");

      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput({ entry_type: "issue", title: "Issue" })),
      });
      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput({ entry_type: "question", title: "Question" })),
      });

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues?entry_type=question`,
      );
      const issues = await res.json();
      expect(issues).toHaveLength(1);
      expect(issues[0].entry_type).toBe("question");
    });
  });

  describe("GET /space/:slug/issues/:id — get single issue", () => {
    it("returns issue with signal tallies and response", async () => {
      const slug = uniqueSlug("iss-get");
      const entityDid = "entity-get";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      // Add a signal
      await fetch(`${getBaseUrl()}/space/${slug}/issues/${issue.id}/signal`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify({ signal: "support" }),
      });

      // Entity responds
      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "We are addressing this." }),
        },
      );

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}`,
      );
      expect(res.status).toBe(200);
      const detail = await res.json();
      expect(detail.signal_tally.support).toBe(1);
      expect(detail.latest_response.content).toBe("We are addressing this.");
      expect(detail.status).toBe("responded");
    });
  });

  describe("PATCH /space/:slug/issues/:id — edit issue", () => {
    it("creates new version by author", async () => {
      const slug = uniqueSlug("iss-edit");
      await createVerifiedSpace(slug, "entity-1");

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const original = await createRes.json();

      const editRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${original.id}`,
        {
          method: "PATCH",
          headers: citizenHeaders(VERIFIED_CITIZEN),
          body: JSON.stringify({ body: "Updated description of the problem." }),
        },
      );

      expect(editRes.status).toBe(200);
      const updated = await editRes.json();
      expect(updated.version).toBe(2);
      expect(updated.prior_version_id).toBe(original.id);
      expect(updated.body).toBe("Updated description of the problem.");
    });

    it("rejects edit by non-author", async () => {
      const slug = uniqueSlug("iss-edit-deny");
      await createVerifiedSpace(slug, "entity-1");

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const original = await createRes.json();

      const editRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${original.id}`,
        {
          method: "PATCH",
          headers: citizenHeaders("other-citizen@test.com"),
          body: JSON.stringify({ body: "Hijacking this issue." }),
        },
      );

      expect(editRes.status).toBe(403);
    });
  });

  describe("PATCH /space/:slug/issues/:id/close — close issue", () => {
    it("entity closes an issue", async () => {
      const slug = uniqueSlug("iss-close");
      const entityDid = "entity-close";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      const closeRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/close`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
        },
      );

      expect(closeRes.status).toBe(200);
      const closed = await closeRes.json();
      expect(closed.status).toBe("closed");
    });

    it("closed issue rejects signals", async () => {
      const slug = uniqueSlug("iss-closed-sig");
      const entityDid = "entity-cs";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/close`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
        },
      );

      const sigRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/signal`,
        {
          method: "POST",
          headers: citizenHeaders(VERIFIED_CITIZEN),
          body: JSON.stringify({ signal: "support" }),
        },
      );

      expect(sigRes.status).toBe(400);
    });
  });

  describe("POST /space/:slug/issues/:id/signal — signal", () => {
    it("support signal on an issue", async () => {
      const slug = uniqueSlug("iss-sig");
      await createVerifiedSpace(slug, "entity-1");

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      const sigRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/signal`,
        {
          method: "POST",
          headers: citizenHeaders(VERIFIED_CITIZEN),
          body: JSON.stringify({ signal: "support" }),
        },
      );

      expect(sigRes.status).toBe(200);
      const sig = await sigRes.json();
      expect(sig.signal).toBe("support");
    });

    it("upserts signal (changes from support to oppose)", async () => {
      const slug = uniqueSlug("iss-upsert");
      await createVerifiedSpace(slug, "entity-1");

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/signal`,
        {
          method: "POST",
          headers: citizenHeaders(VERIFIED_CITIZEN),
          body: JSON.stringify({ signal: "support" }),
        },
      );

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/signal`,
        {
          method: "POST",
          headers: citizenHeaders(VERIFIED_CITIZEN),
          body: JSON.stringify({ signal: "oppose" }),
        },
      );

      const listRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`);
      const issues = await listRes.json();
      expect(issues[0].signal_tally.support).toBe(0);
      expect(issues[0].signal_tally.oppose).toBe(1);
    });

    it("votes on a poll option", async () => {
      const slug = uniqueSlug("iss-pollvote");
      await createVerifiedSpace(slug, "entity-1");

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(
          issueInput({
            entry_type: "poll",
            title: "Priority?",
            poll_options: ["Roads", "Schools"],
          }),
        ),
      });
      const issue = await createRes.json();

      const sigRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/signal`,
        {
          method: "POST",
          headers: citizenHeaders(VERIFIED_CITIZEN),
          body: JSON.stringify({ signal: "opt_1" }),
        },
      );

      expect(sigRes.status).toBe(200);

      const detailRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}`,
      );
      const detail = await detailRes.json();
      expect(detail.poll_tally.opt_1).toBe(1);
    });
  });

  describe("POST/PATCH /space/:slug/issues/:id/response — entity response", () => {
    it("entity posts a response", async () => {
      const slug = uniqueSlug("iss-resp");
      const entityDid = "entity-resp";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      const respRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "Thank you for raising this." }),
        },
      );

      expect(respRes.status).toBe(201);
      const response = await respRes.json();
      expect(response.id).toMatch(/^rsp_/);
      expect(response.in_response_to_type).toBe("issue_board_entry");
      expect(response.version).toBe(1);
    });

    it("entity edits a response", async () => {
      const slug = uniqueSlug("iss-resp-edit");
      const entityDid = "entity-resp-e";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "Initial response." }),
        },
      );

      const editRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/response`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "Updated response." }),
        },
      );

      expect(editRes.status).toBe(200);
      const updated = await editRes.json();
      expect(updated.version).toBe(2);
      expect(updated.content).toBe("Updated response.");
    });
  });

  describe("Events", () => {
    it("emits civic.issue_raised, civic.issue_signaled, civic.issue_closed, civic.issue_responded", async () => {
      const slug = uniqueSlug("iss-evt");
      const entityDid = "entity-evt";
      await createVerifiedSpace(slug, entityDid);

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(VERIFIED_CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/signal`,
        {
          method: "POST",
          headers: citizenHeaders(VERIFIED_CITIZEN),
          body: JSON.stringify({ signal: "support" }),
        },
      );

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/response`,
        {
          method: "POST",
          headers: entityHeaders(entityDid),
          body: JSON.stringify({ content: "Noted." }),
        },
      );

      await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/close`,
        {
          method: "PATCH",
          headers: entityHeaders(entityDid),
        },
      );

      const eventsRes = await fetch(
        `${getBaseUrl()}/events?space_slug=${slug}`,
      );
      const events = await eventsRes.json();
      const types = events.events.map(
        (e: { event_type: string }) => e.event_type,
      );

      expect(types).toContain("civic.issue_raised");
      expect(types).toContain("civic.issue_signaled");
      expect(types).toContain("civic.issue_responded");
      expect(types).toContain("civic.issue_closed");
    });
  });
});
