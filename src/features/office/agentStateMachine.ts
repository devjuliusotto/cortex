import type {
  AgentActivity,
  AgentEventEnvelope,
  AgentEventSource,
  AgentLocation,
  AgentSnapshot,
  AgentState,
} from "./officeTypes";

export const MIN_STATE_DURATION_MS = 15_000;
export const SUBAGENT_TTL = 5 * 60 * 1_000;
export const STRUCTURED_EVENT_PRIORITY_MS = 5 * 60 * 1_000;

type PendingState = {
  state: AgentState;
  source: AgentEventSource;
  since: number;
};

type RuntimeAgent = {
  snapshot: AgentSnapshot;
  pending?: PendingState;
  lastStructuredAt?: number;
};

const sourceRank: Record<AgentEventSource, number> = { heuristic: 1, structured: 2 };

export class AgentStateMachine {
  private agents = new Map<string, RuntimeAgent>();

  apply(events: AgentEventEnvelope[], now = Date.now()) {
    for (const event of events.slice().sort((a, b) => a.timestamp - b.timestamp)) {
      this.applyEvent(event, now);
    }
    return this.tick(now);
  }

  tick(now = Date.now()) {
    let changed = false;
    for (const [agentId, runtime] of this.agents) {
      if (runtime.snapshot.isSubagent && now - runtime.snapshot.lastEventAt >= SUBAGENT_TTL) {
        this.agents.delete(agentId);
        changed = true;
        continue;
      }
      const pending = runtime.pending;
      if (
        pending &&
        now - pending.since >= MIN_STATE_DURATION_MS &&
        now - runtime.snapshot.stateChangedAt >= MIN_STATE_DURATION_MS
      ) {
        runtime.snapshot = {
          ...runtime.snapshot,
          ...pending.state,
          source: pending.source,
          stateChangedAt: now,
        };
        runtime.pending = undefined;
        changed = true;
      }
    }
    return changed;
  }

  snapshots() {
    return [...this.agents.values()]
      .map((runtime) => runtime.snapshot)
      .sort((a, b) => a.workspaceName.localeCompare(b.workspaceName) || a.id.localeCompare(b.id));
  }

  reset() {
    this.agents.clear();
  }

  private applyEvent(envelope: AgentEventEnvelope, now: number) {
    if (envelope.source === "structured") {
      for (const [agentId, runtime] of this.agents) {
        const coveredByStructuredSource =
          runtime.snapshot.source === "heuristic" &&
          runtime.snapshot.provider === envelope.agent.provider &&
          runtime.snapshot.workspaceId === envelope.agent.workspaceId &&
          (!envelope.agent.terminalId || runtime.snapshot.terminalId === envelope.agent.terminalId);
        if (coveredByStructuredSource && agentId !== envelope.agent.id) this.agents.delete(agentId);
      }
    }

    const existing = this.agents.get(envelope.agent.id);
    const confidence = clampConfidence(envelope.confidence);
    const nextState = stateForEvent(envelope, existing?.snapshot);

    if (!existing) {
      this.agents.set(envelope.agent.id, {
        snapshot: {
          ...envelope.agent,
          ...nextState,
          source: envelope.source,
          lastEvent: envelope.event,
          lastEventAt: envelope.timestamp,
          stateChangedAt: envelope.timestamp,
          detail: envelope.detail,
          toolName: envelope.toolName,
        },
        lastStructuredAt: envelope.source === "structured" ? envelope.timestamp : undefined,
      });
      return;
    }

    if (
      envelope.source === "heuristic" &&
      existing.lastStructuredAt !== undefined &&
      now - existing.lastStructuredAt < STRUCTURED_EVENT_PRIORITY_MS
    ) {
      return;
    }

    if (envelope.source === "structured") existing.lastStructuredAt = envelope.timestamp;

    existing.snapshot = {
      ...existing.snapshot,
      ...envelope.agent,
      currentGoal: envelope.currentGoal ?? existing.snapshot.currentGoal,
      lastEvent: envelope.event,
      lastEventAt: Math.max(existing.snapshot.lastEventAt, envelope.timestamp),
      detail: envelope.detail ?? existing.snapshot.detail,
      toolName: envelope.toolName,
    };

    const sameState =
      existing.snapshot.activity === nextState.activity &&
      existing.snapshot.location === nextState.location;
    if (sameState) {
      existing.snapshot = { ...existing.snapshot, confidence, source: envelope.source };
      existing.pending = undefined;
      return;
    }

    const pendingMatches =
      existing.pending?.state.activity === nextState.activity &&
      existing.pending?.state.location === nextState.location;
    if (pendingMatches) {
      if (sourceRank[envelope.source] > sourceRank[existing.pending!.source]) {
        existing.pending = { state: nextState, source: envelope.source, since: existing.pending!.since };
      }
      return;
    }

    existing.pending = { state: nextState, source: envelope.source, since: envelope.timestamp };
  }
}

function stateForEvent(envelope: AgentEventEnvelope, current?: AgentSnapshot): AgentState {
  const fallback = eventDefaults(envelope.event.type, current);
  return {
    activity: envelope.activity ?? fallback.activity,
    location: envelope.location ?? fallback.location,
    confidence: clampConfidence(envelope.confidence),
    currentGoal: envelope.currentGoal ?? current?.currentGoal,
  };
}

function eventDefaults(
  type: AgentEventEnvelope["event"]["type"],
  current?: AgentSnapshot,
): Pick<AgentState, "activity" | "location"> {
  if (type === "approval.requested") return { activity: "waiting_approval", location: current?.location ?? "desk" };
  if (type === "input.requested") return { activity: "waiting_input", location: current?.location ?? "desk" };
  if (type === "task.completed") return { activity: "completed", location: "lounge" };
  if (type === "idle") return { activity: "idle", location: current?.location ?? "lounge" };
  return { activity: current?.activity ?? "coding", location: current?.location ?? "desk" };
}

function clampConfidence(value: number) {
  return Math.max(0, Math.min(1, value));
}
