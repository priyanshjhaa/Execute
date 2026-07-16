interface ActiveAgentRun {
  userId: string;
  controller: AbortController;
}

const globalAgentRuns = globalThis as typeof globalThis & {
  __executeActiveAgentRuns?: Map<string, ActiveAgentRun>;
};

const activeRuns = globalAgentRuns.__executeActiveAgentRuns
  ?? new Map<string, ActiveAgentRun>();

globalAgentRuns.__executeActiveAgentRuns = activeRuns;

export function registerAgentRun(runId: string, userId: string): AbortController {
  const existing = activeRuns.get(runId);
  if (existing) {
    existing.controller.abort();
  }

  const controller = new AbortController();
  activeRuns.set(runId, { userId, controller });
  return controller;
}

export function abortAgentRun(runId: string, userId: string): boolean {
  const activeRun = activeRuns.get(runId);
  if (!activeRun || activeRun.userId !== userId) {
    return false;
  }

  activeRun.controller.abort();
  return true;
}

export function unregisterAgentRun(runId: string, userId: string): void {
  const activeRun = activeRuns.get(runId);
  if (activeRun?.userId === userId) {
    activeRuns.delete(runId);
  }
}
