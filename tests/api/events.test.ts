import { describe, it, expect, beforeAll, afterAll, beforeEach } from "vitest";
import {
  startServer,
  stopServer,
  getBaseUrl,
  resetStores,
  adminHeaders,
  uniqueSlug,
  candidateInput,
} from "../fixtures/helpers.js";

describe("Events", () => {
  beforeAll(async () => {
    process.env.RS_ADMIN_EMAILS = "test-admin@example.com";
    await startServer();
  });
  afterAll(stopServer);
  beforeEach(resetStores);

  it("emits civic.space.created on space creation", async () => {
    const slug = uniqueSlug("evt-create");
    await fetch(`${getBaseUrl()}/space`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(candidateInput(slug)),
    });

    const res = await fetch(`${getBaseUrl()}/events`);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.count).toBe(1);

    const event = body.events[0];
    expect(event.event_type).toBe("civic.space.created");
    expect(event.version).toBe("1.0");
    expect(event.data.space_slug).toBe(slug);
    expect(event.source.hub_id).toBe("representative-space-local");
    expect(event.meta.visibility).toBeDefined();
  });

  it("emits civic.space.updated on space update", async () => {
    const slug = uniqueSlug("evt-update");
    await fetch(`${getBaseUrl()}/space`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(candidateInput(slug)),
    });

    await fetch(`${getBaseUrl()}/space/${slug}`, {
      method: "PATCH",
      headers: adminHeaders(),
      body: JSON.stringify({ display_name: "Updated" }),
    });

    const res = await fetch(`${getBaseUrl()}/events`);
    const body = await res.json();
    expect(body.count).toBe(2);

    const updateEvent = body.events.find(
      (e: { event_type: string }) => e.event_type === "civic.space.updated",
    );
    expect(updateEvent).toBeDefined();
    expect(updateEvent.data.space_slug).toBe(slug);
  });

  it("emits civic.space.verified on verification", async () => {
    const slug = uniqueSlug("evt-verify");
    await fetch(`${getBaseUrl()}/space`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(candidateInput(slug)),
    });

    await fetch(`${getBaseUrl()}/space/${slug}/verify`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify({ method: "official_records" }),
    });

    const res = await fetch(`${getBaseUrl()}/events`);
    const body = await res.json();
    expect(body.count).toBe(2);

    const verifyEvent = body.events.find(
      (e: { event_type: string }) => e.event_type === "civic.space.verified",
    );
    expect(verifyEvent).toBeDefined();
    expect(verifyEvent.data.space_slug).toBe(slug);
  });

  it("filters events by space_slug query param", async () => {
    const slug1 = uniqueSlug("evt-filt-a");
    const slug2 = uniqueSlug("evt-filt-b");

    await fetch(`${getBaseUrl()}/space`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(candidateInput(slug1)),
    });
    await fetch(`${getBaseUrl()}/space`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(candidateInput(slug2)),
    });

    const res = await fetch(
      `${getBaseUrl()}/events?space_slug=${slug1}`,
    );
    const body = await res.json();
    expect(body.count).toBe(1);
    expect(body.events[0].data.space_slug).toBe(slug1);
  });

  it("event has correct civic event structure", async () => {
    const slug = uniqueSlug("evt-struct");
    await fetch(`${getBaseUrl()}/space`, {
      method: "POST",
      headers: adminHeaders(),
      body: JSON.stringify(candidateInput(slug)),
    });

    const res = await fetch(`${getBaseUrl()}/events`);
    const body = await res.json();
    const event = body.events[0];

    expect(event.id).toMatch(/^evt_/);
    expect(event.version).toBe("1.0");
    expect(event.event_type).toBeDefined();
    expect(event.timestamp).toBeDefined();
    expect(event.actor).toBeDefined();
    expect(event.action_url).toBeDefined();
    expect(event.source).toBeDefined();
    expect(event.source.hub_id).toBeDefined();
    expect(event.source.hub_url).toBeDefined();
    expect(event.data).toBeDefined();
    expect(event.meta).toBeDefined();
    expect(event.meta.visibility).toBeDefined();
  });
});
