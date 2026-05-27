import type { Process } from "../processes/types.js";

const processes = new Map<string, Process>();

export function addProcess(process: Process): void {
  processes.set(process.id, process);
}

export function getProcessById(id: string): Process | undefined {
  return processes.get(id);
}

export function getProcessesBySlug(slug: string): Process[] {
  return Array.from(processes.values())
    .filter((p) => p.spaceSlug === slug)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function updateProcess(
  id: string,
  patch: Partial<Process>,
): Process | undefined {
  const existing = processes.get(id);
  if (!existing) return undefined;
  const updated = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  processes.set(id, updated);
  return updated;
}

export function getProcessesByStatus(status: string): Process[] {
  return Array.from(processes.values()).filter((p) => p.status === status);
}

export function clearProcesses(): void {
  processes.clear();
}
