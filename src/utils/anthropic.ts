export const DEFAULT_MODEL = "claude-sonnet-4-6";

export interface CallClaudeInput {
  model: string;
  system: string;
  userText: string;
  maxTokens: number;
}

export interface CallClaudeResult {
  text: string;
  model: string;
}

const ANTHROPIC_API_URL = "https://api.anthropic.com/v1/messages";
const TIMEOUT_MS = 180_000;

export async function callClaude(input: CallClaudeInput): Promise<CallClaudeResult> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set");
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(ANTHROPIC_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: input.model,
        max_tokens: input.maxTokens,
        system: input.system,
        messages: [{ role: "user", content: input.userText }],
      }),
      signal: controller.signal,
    });

    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Anthropic API ${res.status}: ${body}`);
    }

    const data = await res.json();
    const text =
      data.content?.[0]?.type === "text" ? data.content[0].text : "";

    return { text, model: data.model ?? input.model };
  } catch (err) {
    if ((err as Error).name === "AbortError") {
      throw new Error(`Anthropic API call exceeded ${TIMEOUT_MS}ms — aborted`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}
