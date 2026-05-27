import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from "vitest";

// Mock the anthropic module globally so all moderation calls use our mock
vi.mock("../../src/utils/anthropic.js", () => ({
  callClaude: vi.fn(),
  DEFAULT_MODEL: "claude-sonnet-4-6",
}));

import { callClaude } from "../../src/utils/anthropic.js";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  citizenHeaders,
  entityHeaders,
  uniqueSlug,
  createVerifiedSpace,
  hmacHeaders,
  outcomePayload,
  TEST_INBOX_SECRET,
} from "../fixtures/helpers.js";

const mockCallClaude = callClaude as ReturnType<typeof vi.fn>;
const CITIZEN = "citizen-mod-test@example.com";

function issueInput(overrides?: Record<string, unknown>) {
  return {
    entry_type: "issue",
    title: "Park needs better lighting",
    body: "The walking paths in Riverside Park are too dark at night.",
    jurisdiction_tag: "us-ca-12",
    ...overrides,
  };
}

describe("AI Moderation on Submit", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    process.env.ANTHROPIC_API_KEY = "sk-ant-test-key";
    process.env.RS_INBOX_SECRET = TEST_INBOX_SECRET;
    await startServer();
  });

  afterAll(async () => {
    delete process.env.ANTHROPIC_API_KEY;
    await stopServer();
  });

  beforeEach(() => {
    resetStores();
    vi.clearAllMocks();
  });

  // ─── Issues ───────────────────────────────────────────

  describe("POST /space/:slug/issues (raise issue)", () => {
    it("allows clean content through", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":true}',
        model: "claude-sonnet-4-6",
      });

      const slug = uniqueSlug("mod-iss");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(201);
      const issue = await res.json();
      expect(issue.id).toMatch(/^iss_/);
    });

    it("blocks violating content with 400 and reason", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":false,"violation_reason":"Personal attack: insults a person rather than addressing ideas."}',
        model: "claude-sonnet-4-6",
      });

      const slug = uniqueSlug("mod-iss-block");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(
          issueInput({ title: "Hateful title", body: "You're an idiot" }),
        ),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Content blocked");
      expect(body.reason).toContain("Personal attack");
    });

    it("does NOT persist issue when blocked", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":false,"violation_reason":"Spam"}',
        model: "claude-sonnet-4-6",
      });

      const slug = uniqueSlug("mod-no-persist");
      await createVerifiedSpace(slug, "entity-1");

      await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      // Verify the issue was not stored
      const listRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`);
      const issues = await listRes.json();
      expect(issues).toHaveLength(0);
    });
  });

  describe("PATCH /space/:slug/issues/:id (edit issue)", () => {
    it("blocks violating edits", async () => {
      // First call for create is allowed, second call for edit is blocked
      mockCallClaude
        .mockResolvedValueOnce({
          text: '{"allowed":true}',
          model: "claude-sonnet-4-6",
        })
        .mockResolvedValueOnce({
          text: '{"allowed":false,"violation_reason":"Harassment detected"}',
          model: "claude-sonnet-4-6",
        });

      const slug = uniqueSlug("mod-edit");
      await createVerifiedSpace(slug, "entity-1");

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      const editRes = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}`,
        {
          method: "PATCH",
          headers: citizenHeaders(CITIZEN),
          body: JSON.stringify({ body: "Updated with harassment" }),
        },
      );

      expect(editRes.status).toBe(400);
      const body = await editRes.json();
      expect(body.error).toBe("Content blocked");
    });
  });

  // ─── Positions ────────────────────────────────────────

  describe("POST /space/:slug/positions", () => {
    it("allows clean position through", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":true}',
        model: "claude-sonnet-4-6",
      });

      const slug = uniqueSlug("mod-pos");
      await createVerifiedSpace(slug, "entity-pos");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders("entity-pos"),
        body: JSON.stringify({
          topic: "Education",
          statement: "I support increased funding for public schools.",
        }),
      });

      expect(res.status).toBe(201);
    });

    it("blocks violating position", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":false,"violation_reason":"Identity-based slur targeting a religious group."}',
        model: "claude-sonnet-4-6",
      });

      const slug = uniqueSlug("mod-pos-block");
      await createVerifiedSpace(slug, "entity-pos-b");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/positions`, {
        method: "POST",
        headers: entityHeaders("entity-pos-b"),
        body: JSON.stringify({
          topic: "Immigration",
          statement: "Hateful statement with slurs",
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Content blocked");
      expect(body.reason).toContain("slur");
    });
  });

  // ─── Outcome Responses ────────────────────────────────

  describe("POST /space/:slug/outcomes/:id/response", () => {
    it("blocks violating outcome response", async () => {
      mockCallClaude.mockResolvedValue({
        text: '{"allowed":false,"violation_reason":"Incitement to violence"}',
        model: "claude-sonnet-4-6",
      });

      const slug = uniqueSlug("mod-rsp");
      await createVerifiedSpace(slug, "entity-rsp");

      const payloadBody = JSON.stringify(outcomePayload(slug));
      const outcomeRes = await fetch(`${getBaseUrl()}/space/${slug}/inbox`, {
        method: "POST",
        headers: hmacHeaders(payloadBody),
        body: payloadBody,
      });
      const outcome = await outcomeRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/outcomes/${outcome.id}/response`,
        {
          method: "POST",
          headers: entityHeaders("entity-rsp"),
          body: JSON.stringify({ content: "Violent response" }),
        },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Content blocked");
      expect(body.reason).toContain("violence");
    });
  });

  // ─── Issue responses (rep responding to issue) ────────

  describe("POST /space/:slug/issues/:id/response", () => {
    it("blocks violating issue response", async () => {
      // First call for issue creation, second for response
      mockCallClaude
        .mockResolvedValueOnce({
          text: '{"allowed":true}',
          model: "claude-sonnet-4-6",
        })
        .mockResolvedValueOnce({
          text: '{"allowed":false,"violation_reason":"Personal attack on citizen"}',
          model: "claude-sonnet-4-6",
        });

      const slug = uniqueSlug("mod-iss-rsp");
      await createVerifiedSpace(slug, "entity-iss-rsp");

      const createRes = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });
      const issue = await createRes.json();

      const res = await fetch(
        `${getBaseUrl()}/space/${slug}/issues/${issue.id}/response`,
        {
          method: "POST",
          headers: entityHeaders("entity-iss-rsp"),
          body: JSON.stringify({ content: "Attacking response" }),
        },
      );

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("Content blocked");
    });
  });

  // ─── Graceful degradation ─────────────────────────────

  describe("Graceful degradation", () => {
    it("allows content when AI returns malformed response", async () => {
      mockCallClaude.mockResolvedValue({
        text: "Sorry, I cannot evaluate this content.",
        model: "claude-sonnet-4-6",
      });

      const slug = uniqueSlug("mod-graceful");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(201);
    });

    it("allows content when AI throws an error", async () => {
      mockCallClaude.mockRejectedValue(new Error("API timeout"));

      const slug = uniqueSlug("mod-error");
      await createVerifiedSpace(slug, "entity-1");

      const res = await fetch(`${getBaseUrl()}/space/${slug}/issues`, {
        method: "POST",
        headers: citizenHeaders(CITIZEN),
        body: JSON.stringify(issueInput()),
      });

      expect(res.status).toBe(201);
    });
  });
});
