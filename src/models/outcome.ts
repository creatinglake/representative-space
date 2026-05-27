export interface ParticipationStats {
  total_participants: number;
  eligible_participants?: number;
  participation_rate?: number;
}

export interface OutcomeDelivery {
  id: string;
  originating_process_id: string;
  originating_hub_id: string;
  originating_process_type?: string;
  outcome_summary: string;
  participation_stats: ParticipationStats;
  result: Record<string, unknown>;
  delivery_timestamp: string;
  addressed_to_slug: string;
  response_id: string | null;
}

export interface InboxPayload {
  originating_process_id: string;
  originating_hub_id: string;
  outcome_summary: string;
  participation_stats: ParticipationStats;
  result: Record<string, unknown>;
  addressed_to_slug: string;
}
