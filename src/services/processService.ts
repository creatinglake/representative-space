import type {
  Process,
  ProcessAction,
  CreateProcessInput,
} from "../processes/types.js";
import type { Actor } from "../auth/types.js";
import { canActor } from "../auth/canActor.js";
import { getProcessHandler, getRegisteredTypes } from "../processes/registry.js";
import * as processStore from "../stores/processStore.js";
import { getSpaceBySlug } from "../stores/spaceStore.js";
import { emitEvent } from "../events/eventEmitter.js";
import { generateId } from "../utils/id.js";

export function createProcess(
  slug: string,
  input: CreateProcessInput,
  actor: Actor,
): Process {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  if (!canActor(actor, "host_deliberation", { type: "space", slug })) {
    throw new Error("Not authorized to host deliberations on this space");
  }

  const handler = getProcessHandler(input.definition.type);
  if (!handler) {
    throw new Error(
      `Unknown process type "${input.definition.type}". Registered: ${JSON.stringify(getRegisteredTypes())}`,
    );
  }

  const initialState = handler.initializeState(
    (input.state ?? {}) as Record<string, unknown>,
  );

  const now = new Date().toISOString();

  const process: Process = {
    id: generateId("prc"),
    definition: input.definition,
    title: input.title,
    description: input.description,
    status: "draft",
    hostId: "representative-space-local",
    spaceSlug: slug,
    jurisdiction: space.jurisdiction,
    createdBy: actor.userId,
    createdAt: now,
    updatedAt: now,
    state: initialState,
  };

  processStore.addProcess(process);

  emitEvent({
    event_type: "civic.process.created",
    actor: actor.userId,
    space_slug: slug,
    jurisdiction: space.jurisdiction,
    data: {
      process_id: process.id,
      process_type: input.definition.type,
      title: input.title,
    },
  });

  return process;
}

export async function executeAction(
  slug: string,
  processId: string,
  action: ProcessAction,
): Promise<Record<string, unknown>> {
  const process = processStore.getProcessById(processId);
  if (!process || process.spaceSlug !== slug) {
    throw new Error(`Process "${processId}" not found on space "${slug}"`);
  }

  const handler = getProcessHandler(process.definition.type);
  if (!handler) {
    throw new Error(`No handler for process type "${process.definition.type}"`);
  }

  const result = await handler.handleAction(process, action);

  processStore.updateProcess(processId, {
    state: process.state,
    status: process.status,
  });

  return result;
}

export function getProcess(
  slug: string,
  processId: string,
  actor?: string,
): Record<string, unknown> {
  const process = processStore.getProcessById(processId);
  if (!process || process.spaceSlug !== slug) {
    throw new Error(`Process "${processId}" not found on space "${slug}"`);
  }

  const handler = getProcessHandler(process.definition.type);
  if (!handler) {
    throw new Error(`No handler for process type "${process.definition.type}"`);
  }

  return handler.getReadModel(process, actor);
}

export function listProcesses(slug: string): Record<string, unknown>[] {
  const space = getSpaceBySlug(slug);
  if (!space) {
    throw new Error(`Space "${slug}" not found`);
  }

  const processes = processStore.getProcessesBySlug(slug);
  return processes.map((p) => {
    const handler = getProcessHandler(p.definition.type);
    return handler ? handler.getSummary(p) : { process_id: p.id, type: p.definition.type };
  });
}

export function getRawProcess(
  slug: string,
  processId: string,
): Process | undefined {
  const process = processStore.getProcessById(processId);
  if (!process || process.spaceSlug !== slug) return undefined;
  return process;
}

