import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  adminHeaders,
  entityHeaders,
  uniqueSlug,
  candidateInput,
  individualInput,
} from "../fixtures/helpers.js";

describe("Space CRUD", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  describe("POST /space (create)", () => {
    it("creates a candidate space with admin auth", async () => {
      const slug = uniqueSlug("cand");
      const res = await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.entity_slug).toBe(slug);
      expect(body.sub_type).toBe("candidate");
      expect(body.verification_status).toBe("unverified");
      expect(body.lifecycle_state).toBe("active");
      expect(body.profile.display_name).toBe("Test Candidate");
      expect(body.candidacy_record.election_type).toBe("general");
    });

    it("creates an individual space", async () => {
      const slug = uniqueSlug("ind");
      const res = await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(individualInput(slug)),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.sub_type).toBe("individual");
      expect(body.term_dates.start).toBe("2023-01-03");
    });

    it("rejects duplicate slugs", async () => {
      const slug = uniqueSlug("dup");
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      const res = await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      expect(res.status).toBe(409);
    });

    it("rejects without admin auth", async () => {
      const slug = uniqueSlug("noauth");
      const res = await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: entityHeaders("random-user"),
        body: JSON.stringify(candidateInput(slug)),
      });

      expect(res.status).toBe(403);
    });

    it("rejects without any auth", async () => {
      const slug = uniqueSlug("nohdr");
      const res = await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(candidateInput(slug)),
      });

      expect(res.status).toBe(401);
    });

    it("rejects invalid slug format", async () => {
      const res = await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput("AB")),
      });

      expect(res.status).toBe(400);
    });
  });

  describe("GET /space (list)", () => {
    it("returns empty array when no spaces", async () => {
      const res = await fetch(`${getBaseUrl()}/space`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toEqual([]);
    });

    it("returns all created spaces", async () => {
      const slug1 = uniqueSlug("list-a");
      const slug2 = uniqueSlug("list-b");
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug1)),
      });
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(individualInput(slug2)),
      });

      const res = await fetch(`${getBaseUrl()}/space`);
      const body = await res.json();
      expect(body).toHaveLength(2);
    });
  });

  describe("GET /space/:slug", () => {
    it("returns a space by slug", async () => {
      const slug = uniqueSlug("get");
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}`);
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.entity_slug).toBe(slug);
    });

    it("returns 404 for unknown slug", async () => {
      const res = await fetch(`${getBaseUrl()}/space/nonexistent-slug-xyz`);
      expect(res.status).toBe(404);
    });
  });

  describe("PATCH /space/:slug (update)", () => {
    it("admin can update space fields", async () => {
      const slug = uniqueSlug("upd");
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ display_name: "Updated Name" }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.profile.display_name).toBe("Updated Name");
    });

    it("returns 404 for unknown slug", async () => {
      const res = await fetch(`${getBaseUrl()}/space/nonexistent-xyz`, {
        method: "PATCH",
        headers: adminHeaders(),
        body: JSON.stringify({ display_name: "X" }),
      });

      expect(res.status).toBe(404);
    });

    it("rejects unauthenticated requests", async () => {
      const slug = uniqueSlug("upd-noauth");
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ display_name: "Hacked" }),
      });

      expect(res.status).toBe(401);
    });
  });

  describe("POST /space/:slug/verify", () => {
    it("verifies a space entity", async () => {
      const slug = uniqueSlug("ver");
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/verify`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({
          method: "official_records",
          notes: "Test verification",
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.space.verification_status).toBe("verified");
    });

    it("rejects non-admin verification", async () => {
      const slug = uniqueSlug("ver-noauth");
      await fetch(`${getBaseUrl()}/space`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify(candidateInput(slug)),
      });

      const res = await fetch(`${getBaseUrl()}/space/${slug}/verify`, {
        method: "POST",
        headers: entityHeaders("random-user"),
        body: JSON.stringify({ method: "official_records" }),
      });

      expect(res.status).toBe(403);
    });

    it("returns 404 for unknown slug", async () => {
      const res = await fetch(`${getBaseUrl()}/space/nonexistent-xyz/verify`, {
        method: "POST",
        headers: adminHeaders(),
        body: JSON.stringify({ method: "official_records" }),
      });

      expect(res.status).toBe(404);
    });
  });
});
