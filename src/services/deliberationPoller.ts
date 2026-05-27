import { getProcessesByStatus } from "../stores/processStore.js";
import * as processService from "./processService.js";

const POLL_INTERVAL_MS = 30_000;
let timer: ReturnType<typeof setInterval> | null = null;

export function startPoller(): void {
  if (timer) return;

  console.log(
    `[deliberation-poller] Started (interval: ${POLL_INTERVAL_MS / 1000}s)`,
  );

  timer = setInterval(async () => {
    const active = getProcessesByStatus("active");
    for (const proc of active) {
      if (proc.definition.type !== "civic.polis_deliberation") continue;
      try {
        await processService.executeAction(proc.spaceSlug, proc.id, {
          type: "poll_state",
          actor: "system",
          payload: {},
        });
      } catch (err) {
        console.error(
          `[deliberation-poller] Error polling ${proc.id}:`,
          err,
        );
      }
    }
  }, POLL_INTERVAL_MS);
}

export function stopPoller(): void {
  if (timer) {
    clearInterval(timer);
    timer = null;
    console.log("[deliberation-poller] Stopped");
  }
}
