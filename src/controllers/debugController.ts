import type { Request, Response } from "express";
import { clearSpaces } from "../stores/spaceStore.js";
import { clearEvents } from "../stores/eventStore.js";
import { clearOutcomes } from "../stores/outcomeStore.js";
import { clearResponses } from "../stores/responseStore.js";
import { clearPositions } from "../stores/positionStore.js";
import { createSpace, verifyEntity } from "../services/spaceService.js";
import { receiveOutcomeDelivery } from "../services/outcomeService.js";
import { postResponse } from "../services/responseService.js";
import { postPosition } from "../services/positionService.js";

export function handleSeed(_req: Request, res: Response): void {
  if (process.env.NODE_ENV === "production") {
    res.status(403).json({ error: "Seed is disabled in production" });
    return;
  }

  try {
    clearEvents();
    clearResponses();
    clearOutcomes();
    clearPositions();
    clearSpaces();

    // --- Individual space (incumbent) ---
    const jane = createSpace(
      {
        sub_type: "individual",
        entity_slug: "jane-doe",
        jurisdiction: "us-ca-district5",
        office_or_candidacy_label: "State Senator, District 5",
        display_name: "Jane Doe",
        party_affiliation: "Independent",
        hero_image_url: "https://images.unsplash.com/photo-1606857521015-7f9fcf423740?w=1200&h=400&fit=crop",
        profile_image_url: "https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?w=300&h=300&fit=crop&crop=face",
        public_bio:
          "Serving the people of District 5 since 2022. Focused on education funding, public transit, and transparent governance.",
        contact_channels: {
          email: "jane@example.gov",
          phone: "555-0100",
          office_address: "123 Capitol Way, Sacramento, CA 95814",
        },
        linked_official_sites: ["https://janedoe.gov"],
        term_dates: { start: "2022-01-01", end: "2026-12-31" },
      },
      "admin@example.com",
    );

    verifyEntity(
      "jane-doe",
      "admin@example.com",
      { entity_did: "did:example:jane", notes: "ID verified via state records" },
    );

    // --- Candidate space ---
    createSpace(
      {
        sub_type: "candidate",
        entity_slug: "bob-smith",
        jurisdiction: "us-ca-district5",
        office_or_candidacy_label: "Candidate for State Senator, District 5",
        display_name: "Bob Smith",
        party_affiliation: "Green",
        hero_image_url: "https://images.unsplash.com/photo-1497366216548-37526070297c?w=1200&h=400&fit=crop",
        profile_image_url: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=300&h=300&fit=crop&crop=face",
        public_bio:
          "Running to bring fresh ideas to District 5. Priorities: climate action, affordable housing, and community-driven budgeting.",
        contact_channels: { email: "bob@bobsmith2026.com" },
        candidacy_record: {
          filing_date: "2026-03-01",
          election_date: "2026-11-03",
          election_type: "general",
          status: "active",
        },
      },
      "admin@example.com",
    );

    verifyEntity(
      "bob-smith",
      "admin@example.com",
      { entity_did: "did:example:bob", notes: "Campaign filing verified" },
    );

    // --- Outcome deliveries to Jane's space ---
    const outcome1 = receiveOutcomeDelivery("jane-doe", {
      originating_process_id: "proc_vote_park_reno",
      originating_hub_id: "floyd-county-hub",
      outcome_summary:
        "Advisory vote on Riverside Park renovation passed with 72% approval",
      participation_stats: {
        total_participants: 1200,
        eligible_participants: 5000,
        participation_rate: 0.24,
      },
      result: { approve: 864, reject: 336 },
      addressed_to_slug: "jane-doe",
    });

    const outcome2 = receiveOutcomeDelivery("jane-doe", {
      originating_process_id: "proc_budget_2026",
      originating_hub_id: "floyd-county-hub",
      outcome_summary:
        "Participatory budget finalized: $2M for schools, $500K for transit, $300K for parks",
      participation_stats: {
        total_participants: 3400,
        eligible_participants: 12000,
        participation_rate: 0.283,
      },
      result: { schools: 2000000, transit: 500000, parks: 300000 },
      addressed_to_slug: "jane-doe",
    });

    receiveOutcomeDelivery("jane-doe", {
      originating_process_id: "proc_survey_safety",
      originating_hub_id: "district5-community-hub",
      outcome_summary:
        "Community safety survey: 68% want more crosswalks, 45% want better street lighting",
      participation_stats: { total_participants: 890 },
      result: { crosswalks: 0.68, street_lighting: 0.45, speed_bumps: 0.31 },
      addressed_to_slug: "jane-doe",
    });

    // --- Entity response to first outcome ---
    const janeActor = {
      userId: "did:example:jane",
      role: "verified_entity" as const,
      spaceSlug: "jane-doe",
    };

    postResponse(
      "jane-doe",
      outcome1.id,
      {
        content:
          "Thank you for voicing your support for the Riverside Park renovation. I will champion this initiative in the next session and push for full funding allocation.",
      },
      janeActor,
    );

    // --- Position statements ---
    postPosition(
      "jane-doe",
      {
        topic: "Infrastructure Spending",
        statement:
          "I support increased investment in public transit and school facilities. The participatory budget results reflect community priorities that I fully endorse and will advocate for in committee.",
        linked_outcomes: [outcome2.id],
      },
      janeActor,
    );

    postPosition(
      "jane-doe",
      {
        topic: "Community Safety",
        statement:
          "Pedestrian safety is a top priority. I am working with the transportation department to fast-track crosswalk installations at the 12 intersections identified by constituents.",
      },
      janeActor,
    );

    // --- Bob also posts a position ---
    const bobActor = {
      userId: "did:example:bob",
      role: "verified_entity" as const,
      spaceSlug: "bob-smith",
    };

    postPosition(
      "bob-smith",
      {
        topic: "Climate Action",
        statement:
          "District 5 needs a comprehensive climate resilience plan. I propose mandatory green building standards for all new development and a community solar program to cut energy costs by 30%.",
      },
      bobActor,
    );

    postPosition(
      "bob-smith",
      {
        topic: "Affordable Housing",
        statement:
          "We need to build 5,000 new affordable units in the next 4 years. I support inclusionary zoning, community land trusts, and tenant protection ordinances.",
      },
      bobActor,
    );

    res.json({
      message: "Seed data created",
      spaces: ["jane-doe (individual, verified)", "bob-smith (candidate, verified)"],
      outcomes: 3,
      responses: 1,
      positions: 4,
      auth_hint: {
        admin: "admin@example.com",
        jane: "did:example:jane",
        bob: "did:example:bob",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("[seed] failed:", message);
    res.status(500).json({ error: message });
  }
}
