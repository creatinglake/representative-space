import type { Response, ResponseTargetType } from "../models/response.js";

const responses = new Map<string, Response>();

export function addResponse(response: Response): void {
  responses.set(response.id, response);
}

export function getResponseById(id: string): Response | undefined {
  return responses.get(id);
}

export function getResponsesByTargetId(targetId: string): Response[] {
  return Array.from(responses.values())
    .filter((r) => r.in_response_to_id === targetId)
    .sort((a, b) => {
      const timeDiff =
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.version - a.version;
    });
}

export function getLatestResponseForTarget(
  targetType: ResponseTargetType,
  targetId: string,
): Response | undefined {
  const matching = Array.from(responses.values())
    .filter(
      (r) =>
        r.in_response_to_type === targetType &&
        r.in_response_to_id === targetId,
    )
    .sort((a, b) => {
      const timeDiff =
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
      if (timeDiff !== 0) return timeDiff;
      return b.version - a.version;
    });
  return matching[0];
}

export function clearResponses(): void {
  responses.clear();
}
