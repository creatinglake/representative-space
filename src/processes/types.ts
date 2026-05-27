// Process types for Representative Space — mirrors the shared process-types
// protocol contract. When the monorepo gains workspace-level TS references,
// this re-exports from shared/process-types/. Until then, keep in sync.

export type ProcessStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "closed"
  | "finalized";

export interface ProcessDefinition {
  type: string;
  version: string;
}

export interface Process {
  id: string;
  definition: ProcessDefinition;
  title: string;
  description: string;
  status: ProcessStatus;
  hostId: string;
  spaceSlug: string;
  jurisdiction: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  state: Record<string, unknown>;
}

export interface ProcessAction {
  type: string;
  actor: string;
  payload: Record<string, unknown>;
}

export interface CreateProcessInput {
  definition: ProcessDefinition;
  title: string;
  description: string;
  createdBy: string;
  state?: Record<string, unknown>;
}

export interface ProcessHandler {
  type: string;
  initializeState(input: Record<string, unknown>): Record<string, unknown>;
  handleAction(
    process: Process,
    action: ProcessAction,
  ): Promise<Record<string, unknown>>;
  getReadModel(process: Process, actor?: string): Record<string, unknown>;
  getSummary(process: Process): Record<string, unknown>;
}

export type ProcessFactory = (input: CreateProcessInput) => Promise<Process>;
