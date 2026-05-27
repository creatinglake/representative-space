import type { ProcessHandler, ProcessFactory } from "./types.js";

const processRegistry: Record<string, ProcessHandler> = {};

let processFactory: ProcessFactory | null = null;

export function registerProcessHandler(handler: ProcessHandler): void {
  processRegistry[handler.type] = handler;
}

export function getProcessHandler(type: string): ProcessHandler | undefined {
  return processRegistry[type];
}

export function getRegisteredTypes(): string[] {
  return Object.keys(processRegistry);
}

export function setProcessFactory(factory: ProcessFactory): void {
  processFactory = factory;
}

export function getProcessFactory(): ProcessFactory {
  if (!processFactory) {
    throw new Error(
      "Process factory not initialized — service layer must call setProcessFactory()",
    );
  }
  return processFactory;
}
