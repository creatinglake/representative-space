import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getBaseUrl } from "../fixtures/helpers.js";

describe("Methodology endpoint", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    await startServer();
  });
  afterAll(stopServer);

  it("GET /methodology/polis-summarization-v1 returns prompt metadata", async () => {
    const res = await fetch(
      `${getBaseUrl()}/methodology/polis-summarization-v1`,
    );

    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.version).toBe("polis-summarization-v1");
    expect(body.model).toBeDefined();
    expect(body.system_prompt).toBeDefined();
    expect(body.system_prompt.length).toBeGreaterThan(100);
    expect(body.description).toContain("transparency");
  });

  it("prompt contains required behavioral constraints", async () => {
    const res = await fetch(
      `${getBaseUrl()}/methodology/polis-summarization-v1`,
    );
    const body = await res.json();
    const prompt = body.system_prompt;

    expect(prompt).toContain("Neutral");
    expect(prompt).toContain("Faithful");
    expect(prompt).toContain("Actionable");
    expect(prompt).toContain("directed_questions");
    expect(prompt).toContain("JSON");
  });
});
