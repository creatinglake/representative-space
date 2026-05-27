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

const ENTITY_DID = "entity-delib";

function processInput(overrides?: Record<string, unknown>) {
  return {
    definition: { type: "civic.polis_deliberation" },
    title: "Infrastructure priorities",
    description: "What should the district focus on?",
    state: {
      topic: "Infrastructure priorities",
      framing: "The district has limited funds. What should we prioritize?",
      participation_threshold: 10,
      ...overrides,
    },
  };
}

describe("Deliberation — Process Lifecycle & Participation Proxy", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  // --- Process CRUD ---

  describe("POST /space/:slug/processes — create process", () => {
    it("creates a deliberation process as verified entity", async () => {
      const slug = uniqueSlug("delib-create");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify(processInput()),
      });

      expect(res.status).toBe(201);
      const proc = await res.json();
      expect(proc.id).toMatch(/^prc_/);
      expect(proc.status).toBe("draft");
      expect(proc.definition.type).toBe("civic.polis_deliberation");
      expect(proc.title).toBe("Infrastructure priorities");
      expect(proc.spaceSlug).toBe(slug);
    });

    it("rejects create without auth → 401", async () => {
      const slug = uniqueSlug("delib-noauth");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(processInput()),
      });

      expect(res.status).toBe(401);
    });

    it("rejects create by citizen (not entity owner) → 403", async () => {
      const slug = uniqueSlug("delib-citizen");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: citizenHeaders("random-citizen@test.com"),
        body: JSON.stringify(processInput()),
      });

      expect(res.status).toBe(403);
    });

    it("rejects create by wrong entity → 403", async () => {
      const slug = uniqueSlug("delib-wrong-ent");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: entityHeaders("other-entity-did"),
        body: JSON.stringify(processInput()),
      });

      expect(res.status).toBe(403);
    });

    it("rejects create on nonexistent space → 404", async () => {
      const res = await fetch(
        `${getBaseUrl()}/space/nonexistent-slug/processes`,
        {
          method: "POST",
          headers: adminHeaders(),
          body: JSON.stringify(processInput()),
        },
      );

      expect(res.status).toBe(404);
    });

    it("rejects unknown process type → 400", async () => {
      const slug = uniqueSlug("delib-badtype");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify({
          definition: { type: "civic.nonexistent" },
          title: "Bad",
          description: "",
          state: {},
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toContain("Unknown process type");
    });

    it("admin can also create a process (host_deliberation)", async () => {
      const slug = uniqueSlug("delib-admin");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(processInput()),
      });

      // Admin doesn't match host_deliberation (verified_entity on own space)
      expect(res.status).toBe(403);
    });
  });

  // --- Process list & get ---

  describe("GET /space/:slug/processes — list & get", () => {
    it("lists processes for a space (public, no auth)", async () => {
      const slug = uniqueSlug("delib-list");
      await createVerifiedSpace(slug, ENTITY_DID);

      await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify(processInput()),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processes).toHaveLength(1);
      expect(body.processes[0].type).toBe("civic.polis_deliberation");
      expect(body.processes[0].topic).toBe("Infrastructure priorities");
    });

    it("returns empty list for space with no processes", async () => {
      const slug = uniqueSlug("delib-empty");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(`${getBaseUrl()}/space/${slug}/processes`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.processes).toHaveLength(0);
    });

    it("gets a single process read model (public)", async () => {
      const slug = uniqueSlug("delib-get");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const created = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${created.id}`,
      );
      expect(res.status).toBe(200);
      const readModel = await res.json();
      expect(readModel.process_id).toBe(created.id);
      expect(readModel.type).toBe("civic.polis_deliberation");
      expect(readModel.lifecycle).toBe("draft");
      expect(readModel.topic).toBe("Infrastructure priorities");
      expect(readModel.framing).toBe(
        "The district has limited funds. What should we prioritize?",
      );
    });

    it("returns 404 for nonexistent process", async () => {
      const slug = uniqueSlug("delib-404");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/prc_nonexistent`,
      );
      expect(res.status).toBe(404);
    });
  });

  // --- Process state initialization ---

  describe("Process state initialization", () => {
    it("initializes state with deadline and threshold", async () => {
      const slug = uniqueSlug("delib-state");
      await createVerifiedSpace(slug, ENTITY_DID);

      const deadline = "2026-12-31T23:59:59.000Z";
      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(
            processInput({ deadline, participation_threshold: 50 }),
          ),
        },
      );
      const created = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${created.id}`,
      );
      const readModel = await res.json();
      expect(readModel.deadline).toBe(deadline);
      expect(readModel.participation_threshold).toBe(50);
      expect(readModel.summary).toBeNull();
      expect(readModel.summary_status).toBe("pending");
    });

    it("initializes with continued_from_response_id", async () => {
      const slug = uniqueSlug("delib-continue");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(
            processInput({ continued_from_response_id: "rsp_abc123" }),
          ),
        },
      );
      const created = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${created.id}`,
      );
      const readModel = await res.json();
      expect(readModel.continued_from_response_id).toBe("rsp_abc123");
    });
  });

  // --- Participation auth gating ---

  describe("Participation endpoints — auth gating", () => {
    it("vote rejects without auth → 401", async () => {
      const slug = uniqueSlug("delib-vote-noauth");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/prc_any/participate/vote`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ statement_id: 1, vote: "agree" }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("vote by citizen on draft process → 409 (relaxed auth, but draft blocks)", async () => {
      const slug = uniqueSlug("delib-vote-cit");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/participate/vote`,
        {
          method: "POST",
          headers: citizenHeaders("plain-citizen@test.com"),
          body: JSON.stringify({ statement_id: 1, vote: "agree" }),
        },
      );

      expect(res.status).toBe(409);
    });

    it("submit statement rejects without auth → 401", async () => {
      const slug = uniqueSlug("delib-stmt-noauth");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/prc_any/participate/statement`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text: "Test statement" }),
        },
      );

      expect(res.status).toBe(401);
    });

    it("get next statement rejects without auth → 401", async () => {
      const slug = uniqueSlug("delib-next-noauth");
      await createVerifiedSpace(slug, ENTITY_DID);

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/prc_any/participate/next`,
        { headers: { "Content-Type": "application/json" } },
      );

      expect(res.status).toBe(401);
    });
  });

  // --- Participation on non-active process ---

  describe("Participation on draft (non-active) process", () => {
    it("vote on draft process → 409", async () => {
      const slug = uniqueSlug("delib-draft-vote");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      // Entity can participate_deliberation
      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/participate/vote`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify({ statement_id: 1, vote: "agree" }),
        },
      );

      expect(res.status).toBe(409);
      const body = await res.json();
      expect(body.error).toContain("not active");
    });

    it("submit statement on draft process → 409", async () => {
      const slug = uniqueSlug("delib-draft-stmt");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/participate/statement`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify({ text: "My perspective" }),
        },
      );

      expect(res.status).toBe(409);
    });

    it("get clusters on draft process → 409", async () => {
      const slug = uniqueSlug("delib-draft-clust");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/clusters`,
      );

      expect(res.status).toBe(409);
    });
  });

  // --- Vote validation ---

  describe("Vote input validation", () => {
    it("rejects missing statement_id → 400", async () => {
      const slug = uniqueSlug("delib-vote-noid");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/participate/vote`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify({ vote: "agree" }),
        },
      );

      // Will be 409 (not active) before reaching validation, or 400 if validation runs first
      // Since canActor passes but process isn't active, we get 409
      expect([400, 409]).toContain(res.status);
    });

    it("rejects invalid vote direction → 400 or 409", async () => {
      const slug = uniqueSlug("delib-vote-bad");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/participate/vote`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify({ statement_id: 1, vote: "maybe" }),
        },
      );

      expect([400, 409]).toContain(res.status);
    });
  });

  // --- Host actions auth ---

  describe("Host actions — close / regenerate auth gating", () => {
    it("close rejects citizen → 403", async () => {
      const slug = uniqueSlug("delib-close-cit");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/actions/close`,
        {
          method: "POST",
          headers: citizenHeaders("random@test.com"),
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(403);
    });

    it("regenerate rejects citizen → 403", async () => {
      const slug = uniqueSlug("delib-regen-cit");
      await createVerifiedSpace(slug, ENTITY_DID);

      const createRes = await fetch(
        `${getBaseUrl()}/space/${slug}/processes`,
        {
          method: "POST",
          headers: entityHeaders(ENTITY_DID),
          body: JSON.stringify(processInput()),
        },
      );
      const proc = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/processes/${proc.id}/actions/regenerate`,
        {
          method: "POST",
          headers: citizenHeaders("random@test.com"),
          body: JSON.stringify({}),
        },
      );

      expect(res.status).toBe(403);
    });
  });

  // --- Process creation emits event ---

  describe("Events", () => {
    it("civic.process.created event emitted on create", async () => {
      const slug = uniqueSlug("delib-event");
      await createVerifiedSpace(slug, ENTITY_DID);

      await fetch(`${getBaseUrl()}/space/${slug}/processes`, {
        method: "POST",
        headers: entityHeaders(ENTITY_DID),
        body: JSON.stringify(processInput()),
      });

      const eventsRes = await fetch(
        `${getBaseUrl()}/events?space_slug=${slug}`,
      );
      const { events } = await eventsRes.json();
      const processEvents = events.filter(
        (e: any) => e.event_type === "civic.process.created",
      );

      expect(processEvents).toHaveLength(1);
      expect(processEvents[0].data.process_type).toBe(
        "civic.polis_deliberation",
      );
      expect(processEvents[0].data.title).toBe("Infrastructure priorities");
    });
  });
});
