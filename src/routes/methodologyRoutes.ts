import { Router } from "express";
import {
  PROMPT_VERSION,
  SYSTEM_PROMPT,
} from "../shared/polis_deliberation/summarization/promptBuilder.js";

const router = Router();

router.get("/methodology/polis-summarization-v1", (_req, res) => {
  res.json({
    version: PROMPT_VERSION,
    model: process.env.ANTHROPIC_MODEL || "claude-sonnet-4-6",
    system_prompt: SYSTEM_PROMPT,
    last_updated: "2026-05-26",
    description:
      "Converts Polis opinion-cluster data into a neutral, factual summary with directed questions for public officials. This prompt is published for transparency — the methodology is part of the accountability mechanism.",
  });
});

export default router;
