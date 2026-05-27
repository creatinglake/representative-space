import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getBaseUrl } from "../fixtures/helpers.js";

describe("GET /health", () => {
  beforeAll(startServer);
  afterAll(stopServer);

  it("returns 200 with ok status", async () => {
    const res = await fetch(`${getBaseUrl()}/health`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.status).toBe("ok");
    expect(body.timestamp).toBeDefined();
  });
});
