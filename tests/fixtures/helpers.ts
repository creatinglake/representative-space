import { createHmac } from "node:crypto";
import type { Server } from "node:http";
import { createApp } from "../../src/app.js";
import { clearSpaces } from "../../src/stores/spaceStore.js";
import { clearIssues, clearSignals } from "../../src/stores/issueStore.js";
import { clearOutcomes } from "../../src/stores/outcomeStore.js";
import { clearPositions } from "../../src/stores/positionStore.js";
import { clearResponses } from "../../src/stores/responseStore.js";
import { clearEvents } from "../../src/stores/eventStore.js";
import { clearProcesses } from "../../src/stores/processStore.js";

let server: Server | null = null;
let port = 0;

export const TEST_INBOX_SECRET = "test-hmac-secret-key";

export async function startServer(): Promise<void> {
  process.env.RS_INBOX_SECRET = TEST_INBOX_SECRET;
  const app = createApp();
  return new Promise((resolve) => {
    server = app.listen(0, () => {
      const addr = server!.address();
      if (addr && typeof addr === "object") {
        port = addr.port;
      }
      resolve();
    });
  });
}

export async function stopServer(): Promise<void> {
  return new Promise((resolve) => {
    if (server) {
      server.close(() => resolve());
      server = null;
    } else {
      resolve();
    }
  });
}

export function getBaseUrl(): string {
  return `http://localhost:${port}`;
}

export function resetStores(): void {
  clearSpaces();
  clearIssues();
  clearSignals();
  clearOutcomes();
  clearPositions();
  clearResponses();
  clearEvents();
  clearProcesses();
}

// --- Auth headers ---

const ADMIN_EMAIL = "test-admin@example.com";

export function adminHeaders(): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${ADMIN_EMAIL}`,
  };
}

export function citizenHeaders(email: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${email}`,
  };
}

export function entityHeaders(entityDid: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    Authorization: `Bearer ${entityDid}`,
  };
}

// --- HMAC helpers ---

export function hmacSignature(body: string, secret = TEST_INBOX_SECRET): string {
  return createHmac("sha256", secret).update(body).digest("hex");
}

export function hmacHeaders(body: string, secret?: string): Record<string, string> {
  return {
    "Content-Type": "application/json",
    "x-civic-signature": `sha256=${hmacSignature(body, secret)}`,
  };
}

// --- Convenience factories ---

let slugCounter = 0;

export function uniqueSlug(prefix = "test"): string {
  slugCounter++;
  return `${prefix}-${Date.now()}-${slugCounter}`;
}

export async function createVerifiedSpace(
  slug: string,
  entityDid: string,
): Promise<void> {
  const base = getBaseUrl();

  await fetch(`${base}/space`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      sub_type: "individual",
      entity_slug: slug,
      jurisdiction: "us-ca-12",
      office_or_candidacy_label: "Test Office",
      display_name: `Entity ${slug}`,
    }),
  });

  await fetch(`${base}/space/${slug}/verify`, {
    method: "POST",
    headers: adminHeaders(),
    body: JSON.stringify({
      entity_did: entityDid,
      notes: "Test verification",
    }),
  });
}

export function outcomePayload(slug: string): Record<string, unknown> {
  return {
    originating_process_id: "proc_test_123",
    originating_hub_id: "civic-hub-local",
    outcome_summary: "Advisory vote completed with majority support for Option A.",
    participation_stats: { total_participants: 42, participation_rate: 0.68 },
    result: { winning_option: "Option A", margin: "62%" },
    addressed_to_slug: slug,
  };
}

export function individualInput(slug: string) {
  return {
    sub_type: "individual",
    entity_slug: slug,
    jurisdiction: "us-ca-12",
    office_or_candidacy_label: "U.S. Representative CA-12",
    display_name: "Test Representative",
    party_affiliation: "Democratic",
    public_bio: "A test representative bio.",
    contact_channels: {
      email: "rep@test.com",
      phone: "202-555-0100",
      office_address: "123 Main St",
    },
    term_dates: { start: "2023-01-03", end: "2025-01-03" },
  };
}

export function candidateInput(slug: string) {
  return {
    sub_type: "candidate",
    entity_slug: slug,
    jurisdiction: "us-va-09",
    office_or_candidacy_label: "U.S. House VA-9 Candidate",
    display_name: "Test Candidate",
    party_affiliation: "Independent",
    public_bio: "A test candidate bio.",
    contact_channels: { email: "candidate@test.com" },
    candidacy_record: {
      election_date: "2026-11-03",
      election_type: "general",
      status: "filed",
    },
  };
}
