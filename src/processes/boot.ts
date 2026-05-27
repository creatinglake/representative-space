import { registerProcessHandler, getRegisteredTypes } from "./registry.js";
import { createPolisDeliberationHandler } from "../../../shared/process-plugins/polis_deliberation/src/handler.js";
import { createPolisAdapter } from "../../../shared/process-plugins/polis_deliberation/src/adapter/polisAdapter.js";
import { createPolisSummarizer } from "../../../shared/process-plugins/polis_deliberation/src/summarization/polisSummarizer.js";
import { emitEvent } from "../events/eventEmitter.js";
import { generateId } from "../utils/id.js";
import { writeInternalOutcome } from "../services/outcomeService.js";
import { getResponseById } from "../stores/responseStore.js";
import { getSpaceBySlug } from "../stores/spaceStore.js";
import { callClaude } from "../utils/llmClient.js";
import type { PolisHostInterface } from "../../../shared/process-plugins/polis_deliberation/src/hostInterface.js";
import type { PolisAdapter } from "../../../shared/process-plugins/polis_deliberation/src/adapter/types.js";

let _adapter: PolisAdapter | null = null;

export function getPolisAdapter(): PolisAdapter {
  if (!_adapter) throw new Error("Process registry not booted yet");
  return _adapter;
}

export function bootProcessRegistry(): void {
  const polisBaseUrl = process.env.POLIS_BASE_URL || "https://pol.is";
  const polisAuthToken = process.env.POLIS_AUTH_TOKEN || "";

  if (!polisAuthToken) {
    console.log(
      "[process-registry] POLIS_AUTH_TOKEN not set — Polis deliberation handler registered in mock mode",
    );
  }

  _adapter = createPolisAdapter({
    baseUrl: polisBaseUrl,
    authToken: polisAuthToken,
  });
  const adapter = _adapter;

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY || "";
  const llmClient = {
    async complete(params: {
      system: string;
      user: string;
      maxTokens: number;
    }): Promise<string> {
      if (!anthropicApiKey) {
        throw new Error("ANTHROPIC_API_KEY not configured");
      }
      return callClaude(params.system, params.user, anthropicApiKey);
    },
  };

  const summarize = createPolisSummarizer({
    llmClient,
    polisBaseUrl,
  });

  const host: PolisHostInterface = {
    emitEvent(input) {
      const space = getSpaceBySlug(input.space_slug);
      emitEvent({
        event_type: input.event_type,
        actor: input.actor,
        space_slug: input.space_slug,
        jurisdiction: input.jurisdiction || space?.jurisdiction || "",
        data: input.data,
      });
    },
    generateId(prefix) {
      return generateId(prefix || "id");
    },
    writeOutcomeDelivery(slug, payload) {
      const outcome = writeInternalOutcome(slug, payload);
      return { id: outcome.id, delivery_timestamp: outcome.delivery_timestamp };
    },
    getResponseById(responseId) {
      const r = getResponseById(responseId);
      if (!r) return null;
      return { id: r.id, content: r.content };
    },
  };

  const handler = createPolisDeliberationHandler({
    adapter,
    summarize,
    host,
    polisBaseUrl,
  });

  registerProcessHandler(handler as any);

  console.log(
    `[process-registry] Booted. Registered types: [${getRegisteredTypes().join(", ")}]`,
  );
}
