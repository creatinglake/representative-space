import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { startServer, stopServer, getBaseUrl } from "../fixtures/helpers.js";

describe("GET /.well-known/civic.json", () => {
  beforeAll(startServer);
  afterAll(stopServer);

  it("returns discovery manifest with required fields", async () => {
    const res = await fetch(`${getBaseUrl()}/.well-known/civic.json`);
    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.name).toBe("Representative Space");
    expect(body.version).toBe("0.1.0");
    expect(body.service.type).toBe("representative-space");
    expect(body.service.id).toBeDefined();
    expect(body.endpoints.spaces).toContain("/space");
    expect(body.endpoints.events).toContain("/events");
    expect(body.feeds.events).toContain("/events");
    expect(body.capabilities).toContain("individual");
    expect(body.capabilities).toContain("candidate");
    expect(body.spec.event).toBe("civic-event-spec-v0.1");
  });
});
