import { callClaude, DEFAULT_MODEL } from "../../utils/anthropic.js";
import { ModerationBlockedError } from "./errors.js";

const CODE_OF_CONDUCT = `You are a content moderation system for a civic participation platform.

Evaluate the following user-submitted content against this Code of Conduct:

1. No personal attacks — critique ideas, not people
2. No identity-based slurs or hate speech targeting any group
3. No incitement to violence or threats
4. No harassment, bullying, or intimidation
5. No spam or commercial solicitation
6. Content must relate to civic matters

Respond with ONLY a JSON object:
- If the content is acceptable: {"allowed":true}
- If the content violates the Code of Conduct: {"allowed":false,"violation_reason":"Brief explanation of which rule was violated and why"}

Do not include any text outside the JSON object.`;

export interface ModerationResult {
  allowed: boolean;
  violation_reason?: string;
}

export async function moderateContent(
  content: string,
): Promise<ModerationResult> {
  // Fail open: if no API key, allow everything
  if (!process.env.ANTHROPIC_API_KEY) {
    return { allowed: true };
  }

  try {
    const response = await callClaude({
      model: DEFAULT_MODEL,
      system: CODE_OF_CONDUCT,
      userText: content,
      maxTokens: 256,
    });

    // Try to parse the response as JSON
    let text = response.text.trim();

    // Handle markdown code fences
    const fenceMatch = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fenceMatch) {
      text = fenceMatch[1].trim();
    }

    try {
      const parsed = JSON.parse(text);
      if (typeof parsed.allowed !== "boolean") {
        // Malformed response — fail open
        return { allowed: true };
      }
      return {
        allowed: parsed.allowed,
        violation_reason: parsed.violation_reason,
      };
    } catch {
      // JSON parse failure — fail open
      return { allowed: true };
    }
  } catch {
    // API error — fail open
    return { allowed: true };
  }
}

export async function requireModeration(content: string): Promise<void> {
  const result = await moderateContent(content);
  if (!result.allowed) {
    throw new ModerationBlockedError(result.violation_reason ?? "Content policy violation");
  }
}
