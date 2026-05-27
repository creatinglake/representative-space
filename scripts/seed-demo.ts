/**
 * Seed script for representative-space demo data.
 *
 * Usage:
 *   npx tsx scripts/seed-demo.ts [BASE_URL]
 *
 * Defaults to https://representative-space.vercel.app
 * Set RS_ADMIN_EMAIL to override the admin token (default: creatinglake@gmail.com)
 * Set RS_INBOX_SECRET for outcome delivery HMAC (default: civic-demo-inbox-2026)
 */

import { createHmac } from "node:crypto";

const BASE =
  process.argv[2] || "https://representative-space.vercel.app";
const API = `${BASE}/api`;
const ADMIN_TOKEN = process.env.RS_ADMIN_EMAIL || "creatinglake@gmail.com";
const INBOX_SECRET = process.env.RS_INBOX_SECRET || "civic-demo-inbox-2026";

function computeHmac(bodyStr: string): string {
  return "sha256=" + createHmac("sha256", INBOX_SECRET).update(bodyStr).digest("hex");
}

async function api(
  method: string,
  path: string,
  body?: unknown,
  token?: string,
) {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    // 409 = already exists, skip gracefully
    if (res.status === 409) {
      console.log(`  ⏭️  Already exists (409), skipping`);
      return null;
    }
    console.error(`❌ ${method} ${path} → ${res.status}`, data);
    throw new Error(`API error: ${res.status}`);
  }
  return data;
}

/** POST to inbox with HMAC signature */
async function deliverOutcome(slug: string, payload: unknown) {
  const bodyStr = JSON.stringify(payload);
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "X-Civic-Signature": computeHmac(bodyStr),
  };

  const res = await fetch(`${API}/space/${slug}/inbox`, {
    method: "POST",
    headers,
    body: bodyStr,
  });

  const text = await res.text();
  let data: any;
  try {
    data = JSON.parse(text);
  } catch {
    data = text;
  }

  if (!res.ok) {
    console.error(`❌ POST /space/${slug}/inbox → ${res.status}`, data);
    throw new Error(`Inbox error: ${res.status}`);
  }
  return data;
}

async function main() {
  console.log(`\n🌱 Seeding demo data on ${BASE}\n`);

  // --- Delete test space if it exists ---
  console.log("Cleaning up test space...");
  const spaces = await api("GET", "/space");
  const testSpace = spaces?.find((s: any) => s.entity_slug === "test-db-space");
  if (testSpace) {
    // Archive it (no delete endpoint, but we can leave it)
    console.log("  ⏭️  test-db-space found — will be superseded by demo data");
  }

  // ========================================
  // 1. Create candidate space — Jamie Rivera
  // ========================================
  console.log("\n📦 Creating candidate space: jamie-rivera");
  const jamie = await api(
    "POST",
    "/space",
    {
      sub_type: "candidate",
      entity_slug: "jamie-rivera",
      jurisdiction: "us-va-floyd",
      office_or_candidacy_label: "County Board of Supervisors, District 3",
      display_name: "Jamie Rivera",
      party_affiliation: "Independent",
      candidacy_record: {
        filing_date: "2026-03-15",
        election_date: "2026-11-03",
        election_type: "general",
        status: "active",
      },
      contact_channels: {
        email: "jamie@riveraforfloyd.com",
        phone: "(540) 555-0147",
      },
      public_bio:
        "Third-generation Floyd County resident. Small business owner (Rivera Hardware, est. 1998). Floyd County Planning Commission member 2020–2025. Running to bring transparent, responsive governance to District 3.",
      linked_official_sites: [
        "https://riveraforfloyd.com",
      ],
    },
    ADMIN_TOKEN,
  );
  const jamieSlug = jamie?.entity_slug || "jamie-rivera";
  console.log(`  ✅ Created: ${jamieSlug}`);

  // Verify the entity
  console.log("\n🔒 Verifying jamie-rivera...");
  await api(
    "POST",
    `/space/${jamieSlug}/verify`,
    {
      entity_did: "did:web:riveraforfloyd.com",
      notes: "Identity verified via county filing records",
    },
    ADMIN_TOKEN,
  );
  console.log("  ✅ Verified");

  // Update profile with images
  console.log("\n🖼️  Updating profile images...");
  await api(
    "PATCH",
    `/space/${jamieSlug}`,
    {
      hero_image_url:
        "https://images.unsplash.com/photo-1506905925346-21bda4d32df4?w=1200&h=400&fit=crop",
      profile_image_url:
        "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop&crop=face",
    },
    "did:web:riveraforfloyd.com", // verified entity token
  );
  console.log("  ✅ Updated");

  // ========================================
  // 2. Post position statements
  // ========================================
  console.log("\n📝 Posting position statements...");

  const positions = [
    {
      topic: "Broadband Infrastructure",
      statement:
        "Every household in Floyd County deserves reliable high-speed internet. I support the county's application for BEAD funding and will push for open-access fiber to underserved areas in the first 18 months of my term.",
    },
    {
      topic: "Agricultural Land Preservation",
      statement:
        "Floyd's farmland is our heritage and our economy. I oppose rezoning agricultural parcels for large-scale commercial development and support expanding the Purchase of Development Rights program.",
    },
    {
      topic: "County Budget Transparency",
      statement:
        "Citizens deserve to see where every dollar goes. I will publish quarterly budget reports in plain language on the county website and host open budget review sessions before each fiscal year vote.",
    },
  ];

  for (const pos of positions) {
    console.log(`  → ${pos.topic}`);
    await api(
      "POST",
      `/space/${jamieSlug}/positions`,
      pos,
      "did:web:riveraforfloyd.com",
    );
  }
  console.log("  ✅ 3 positions posted");

  // ========================================
  // 3. Deliver outcomes (simulating civic hub)
  // ========================================
  console.log("\n📨 Delivering outcomes...");

  const outcomes = [
    {
      originating_process_id: "proc_broadband_advisory_2026",
      originating_hub_id: "hub_floyd_civic",
      outcome_summary:
        "Floyd County Broadband Advisory Vote: 78% of 412 participants supported prioritizing BEAD funding for underserved rural areas over downtown upgrades.",
      participation_stats: {
        total_participants: 412,
        eligible_participants: 3200,
        participation_rate: 0.129,
      },
      result: {
        question:
          "Should Floyd County prioritize BEAD broadband funding for underserved rural areas?",
        options: [
          { label: "Yes — rural areas first", votes: 321, percentage: 77.9 },
          { label: "No — balanced approach", votes: 91, percentage: 22.1 },
        ],
        process_type: "civic.vote",
      },
    },
    {
      originating_process_id: "proc_budget_priorities_2026",
      originating_hub_id: "hub_floyd_civic",
      outcome_summary:
        "Community Budget Priorities Survey: Top 3 priorities were road maintenance (64%), school funding (58%), and emergency services (51%). 289 residents participated.",
      participation_stats: {
        total_participants: 289,
        eligible_participants: 3200,
        participation_rate: 0.09,
      },
      result: {
        question: "What should be Floyd County's top budget priorities for FY2027?",
        ranked_priorities: [
          { label: "Road maintenance & repair", support_pct: 64 },
          { label: "School funding increase", support_pct: 58 },
          { label: "Emergency services", support_pct: 51 },
          { label: "Parks & recreation", support_pct: 34 },
          { label: "County broadband investment", support_pct: 29 },
        ],
        process_type: "civic.vote",
      },
    },
  ];

  for (const outcome of outcomes) {
    console.log(`  → ${outcome.originating_process_id}`);
    await deliverOutcome(jamieSlug, {
      ...outcome,
      addressed_to_slug: jamieSlug,
    });
  }
  console.log("  ✅ 2 outcomes delivered");

  // ========================================
  // 4. Post a response to the broadband outcome
  // ========================================
  console.log("\n💬 Posting response to broadband outcome...");
  const outcomesList = await api("GET", `/space/${jamieSlug}/outcomes`);
  const broadbandOutcome = outcomesList?.find((o: any) =>
    o.originating_process_id === "proc_broadband_advisory_2026"
  );
  if (broadbandOutcome) {
    await api(
      "POST",
      `/space/${jamieSlug}/outcomes/${broadbandOutcome.id}/response`,
      {
        content:
          "I hear you loud and clear. 78% support for prioritizing rural broadband is a strong mandate. If elected, I will make this my first agenda item and push the Board to submit the BEAD application by Q1 2027. I've already spoken with the county IT director about mapping the worst-served areas. Let's get this done.",
      },
      "did:web:riveraforfloyd.com",
    );
    console.log("  ✅ Response posted to broadband outcome");
  }

  // ========================================
  // 5. Raise citizen issues
  // ========================================
  console.log("\n🗣️  Raising citizen issues...");

  const issues = [
    {
      entry_type: "issue" as const,
      title: "Pothole damage on Route 8 near Floydada",
      body: "The stretch of Route 8 between mile markers 12 and 14 has severe pothole damage that's been getting worse since March. Two of my neighbors have had tire damage. What's your plan for road maintenance prioritization?",
      jurisdiction_tag: "us-va-floyd",
      token: "citizen_sarah_m@example.com",
    },
    {
      entry_type: "question" as const,
      title: "Where do you stand on the proposed Dollar General?",
      body: "There's a proposal for a Dollar General on the old Henderson lot on Route 221. A lot of people in the community are concerned about it. What's your position on commercial development in rural residential areas?",
      jurisdiction_tag: "us-va-floyd",
      token: "citizen_tom_b@example.com",
    },
    {
      entry_type: "poll" as const,
      title: "Should the county require public hearings before rezoning?",
      body: "Currently, rezoning decisions can happen without a dedicated public hearing. Should the county require at least one public hearing with 30 days notice before any rezoning vote?",
      jurisdiction_tag: "us-va-floyd",
      poll_options: [
        "Yes — require public hearings",
        "No — current process is fine",
        "Yes, but only for parcels over 5 acres",
      ],
      token: "citizen_mary_k@example.com",
    },
  ];

  for (const issue of issues) {
    const { token, ...input } = issue;
    console.log(`  → [${input.entry_type}] ${input.title}`);
    await api("POST", `/space/${jamieSlug}/issues`, input, token);
  }
  console.log("  ✅ 3 citizen issues raised");

  // Signal support on the rezoning issue
  console.log("\n👍 Adding signals to issues...");
  const issuesList = await api("GET", `/space/${jamieSlug}/issues`);
  const rezoningIssue = issuesList?.find((i: any) =>
    i.title?.includes("rezoning")
  );
  if (rezoningIssue) {
    // Multiple citizens signal support
    for (const citizen of [
      "citizen_1@example.com",
      "citizen_2@example.com",
      "citizen_3@example.com",
      "citizen_4@example.com",
      "citizen_5@example.com",
    ]) {
      await api(
        "POST",
        `/space/${jamieSlug}/issues/${rezoningIssue.id}/signal`,
        { signal: "support" },
        citizen,
      );
    }
    console.log("  ✅ 5 support signals on rezoning issue");
  }

  // Respond to the Dollar General question
  const dollarGenIssue = issuesList?.find((i: any) =>
    i.title?.includes("Dollar General")
  );
  if (dollarGenIssue) {
    console.log("\n💬 Posting representative response to Dollar General question...");
    await api(
      "POST",
      `/space/${jamieSlug}/issues/${dollarGenIssue.id}/response`,
      {
        content:
          "Great question. I believe commercial development should serve the community, not just pass through it. I'd want to see a traffic impact study, and I think any commercial project in a rural residential zone should go through a public hearing process. I'm not opposed to new business — Floyd needs jobs — but it has to fit the character of the area and the wishes of nearby residents.",
      },
      "did:web:riveraforfloyd.com",
    );
    console.log("  ✅ Response posted");
  }

  // ========================================
  // 6. Create individual space — Pat Morgan
  // ========================================
  console.log("\n📦 Creating individual space: pat-morgan");
  const pat = await api(
    "POST",
    "/space",
    {
      sub_type: "individual",
      entity_slug: "pat-morgan",
      jurisdiction: "us-va-floyd",
      office_or_candidacy_label: "County Board of Supervisors, District 3 (Incumbent)",
      display_name: "Pat Morgan",
      party_affiliation: "Republican",
      contact_channels: {
        email: "pmorgan@floydcountyva.gov",
        office_address: "100 E Main St, Floyd, VA 24091",
      },
      public_bio:
        "Serving Floyd County since 2018. Former volunteer firefighter. Focused on keeping taxes low and maintaining our rural way of life.",
    },
    ADMIN_TOKEN,
  );
  const patSlug = pat?.entity_slug || "pat-morgan";
  console.log(`  ✅ Created: ${patSlug}`);

  console.log("\n🔒 Verifying pat-morgan...");
  await api(
    "POST",
    `/space/${patSlug}/verify`,
    {
      entity_did: "did:web:floydcountyva.gov:supervisors:pat-morgan",
      notes: "Verified via county government directory",
    },
    ADMIN_TOKEN,
  );
  console.log("  ✅ Verified");

  // Post one position for Pat
  console.log("\n📝 Posting position for pat-morgan...");
  await api(
    "POST",
    `/space/${patSlug}/positions`,
    {
      topic: "County Budget",
      statement:
        "I've kept property tax rates flat for three consecutive years while maintaining core services. Fiscal responsibility isn't a slogan — it's the baseline expectation.",
    },
    "did:web:floydcountyva.gov:supervisors:pat-morgan",
  );
  console.log("  ✅ 1 position posted");

  // ========================================
  // Done
  // ========================================
  console.log("\n" + "=".repeat(50));
  console.log("🎉 Demo seed complete!");
  console.log(`\n  Candidate space: ${BASE}/space/jamie-rivera`);
  console.log(`  Individual space: ${BASE}/space/pat-morgan`);
  console.log("=".repeat(50) + "\n");
}

main().catch((err) => {
  console.error("\n💥 Seed failed:", err.message);
  process.exit(1);
});
