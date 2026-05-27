import type { Request, Response } from "express";
import { baseUrl } from "../utils/baseUrl.js";

export function handleDiscoveryManifest(_req: Request, res: Response): void {
  const hub = baseUrl();

  res.json({
    name: "Representative Space",
    version: "0.1.0",
    description:
      "Office-scoped civic space for elected officials and candidates in the Civic.Social ecosystem",
    service: {
      id: "representative-space-local",
      type: "representative-space",
    },
    endpoints: {
      spaces: `${hub}/space`,
      events: `${hub}/events`,
      inbox: `${hub}/space/:slug/inbox`,
      outcomes: `${hub}/space/:slug/outcomes`,
      positions: `${hub}/space/:slug/positions`,
    },
    feeds: {
      events: `${hub}/events`,
    },
    capabilities: [
      "individual",
      "candidate",
      "outcome_delivery",
      "entity_response",
      "position_statements",
    ],
    spec: {
      event: "civic-event-spec-v0.1",
    },
  });
}
