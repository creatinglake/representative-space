import type { Response, ResponseTargetType } from "../models/response.js";
import { getSupabase, useDatabase } from "../lib/supabase.js";

const TABLE = "responses";

const responses = new Map<string, Response>();

export async function addResponse(response: Response): Promise<void> {
  if (!useDatabase()) {
    responses.set(response.id, response);
    return;
  }
  const { error } = await getSupabase().from(TABLE).insert(response);
  if (error) throw error;
}

export async function getResponseById(
  id: string,
): Promise<Response | undefined> {
  if (!useDatabase()) {
    return responses.get(id);
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export async function getResponsesByTargetId(
  targetId: string,
): Promise<Response[]> {
  if (!useDatabase()) {
    return Array.from(responses.values())
      .filter((r) => r.in_response_to_id === targetId)
      .sort((a, b) => {
        const timeDiff =
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
        if (timeDiff !== 0) return timeDiff;
        return b.version - a.version;
      });
  }
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("in_response_to_id", targetId)
    .order("timestamp", { ascending: false })
    .order("version", { ascending: false });
  if (error) throw error;
  return data ?? [];
}

export async function getLatestResponseForTarget(
  targetType: ResponseTargetType,
  targetId: string,
): Promise<Response | undefined> {
  if (!useDatabase()) {
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
  const { data, error } = await getSupabase()
    .from(TABLE)
    .select("*")
    .eq("in_response_to_type", targetType)
    .eq("in_response_to_id", targetId)
    .order("timestamp", { ascending: false })
    .order("version", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data ?? undefined;
}

export function clearResponses(): void {
  responses.clear();
}
