const ANTHROPIC_URL = "https://api.anthropic.com/v1/messages";
const ANTHROPIC_VERSION = "2023-06-01";
const DEFAULT_MODEL = "claude-sonnet-4-6";
const CALL_TIMEOUT_MS = 120_000;

interface AnthropicResponse {
  content: { type: string; text?: string }[];
  error?: { type: string; message: string };
}

export async function callClaude(
  system: string,
  user: string,
  apiKey: string,
): Promise<string> {
  try {
    return await callOnce(system, user, apiKey);
  } catch (err) {
    if (!isTransient(err)) throw err;
    await new Promise((r) => setTimeout(r, 2000));
    return callOnce(system, user, apiKey);
  }
}

async function callOnce(
  system: string,
  user: string,
  apiKey: string,
): Promise<string> {
  const model = process.env.ANTHROPIC_MODEL || DEFAULT_MODEL;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CALL_TIMEOUT_MS);

  let res: Response;
  try {
    res = await fetch(ANTHROPIC_URL, {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": ANTHROPIC_VERSION,
        "content-type": "application/json",
      },
      body: JSON.stringify({
        model,
        max_tokens: 4096,
        system,
        messages: [{ role: "user", content: user }],
      }),
      signal: controller.signal,
    });
  } catch (err) {
    if (err instanceof Error && err.name === "AbortError") {
      throw new Error(`Claude call timed out after ${CALL_TIMEOUT_MS}ms`);
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }

  if (!res.ok) {
    const body = await res.text().catch(() => "");
    const err = new Error(`Anthropic API ${res.status}: ${body}`);
    (err as any).status = res.status;
    throw err;
  }

  const json = (await res.json()) as AnthropicResponse;
  if (json.error) {
    throw new Error(`Anthropic error: ${json.error.message}`);
  }

  const text = json.content.find((c) => c.type === "text")?.text;
  if (!text) {
    throw new Error("No text content in Anthropic response");
  }
  return text;
}

function isTransient(err: unknown): boolean {
  if (!(err instanceof Error)) return false;
  const status = (err as any).status;
  if (typeof status === "number" && status >= 500) return true;
  if (err.message.includes("timed out")) return true;
  return false;
}
