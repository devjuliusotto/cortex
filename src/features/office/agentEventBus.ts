import { AgentStateMachine } from "./agentStateMachine";
import type { AgentEventEnvelope, AgentSnapshot } from "./officeTypes";

const MAX_EVENTS = 1_000;
const machine = new AgentStateMachine();
const listeners = new Set<() => void>();
const seenEventIds = new Set<string>();
let events: AgentEventEnvelope[] = [];
let snapshots: AgentSnapshot[] = [];

export function publishAgentEvents(nextEvents: AgentEventEnvelope[], now = Date.now()) {
  const unseen = nextEvents.filter((event) => {
    if (seenEventIds.has(event.id)) return false;
    seenEventIds.add(event.id);
    return true;
  });
  if (unseen.length > 0) {
    events = [...events, ...unseen].slice(-MAX_EVENTS);
    if (seenEventIds.size > MAX_EVENTS * 2) {
      seenEventIds.clear();
      for (const event of events) seenEventIds.add(event.id);
    }
  }
  const stateChanged = machine.apply(unseen, now);
  const nextSnapshots = machine.snapshots();
  if (unseen.length > 0 || stateChanged || signature(nextSnapshots) !== signature(snapshots)) {
    snapshots = nextSnapshots;
    emit();
  }
}

export function tickAgentEventBus(now = Date.now()) {
  if (!machine.tick(now)) return;
  snapshots = machine.snapshots();
  emit();
}

export function subscribeAgentStates(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getAgentSnapshots() {
  return snapshots;
}

export function getAgentEvents() {
  return events;
}

export function agentEventsForAgent(agentId: string) {
  return events.filter((event) => event.agent.id === agentId).slice(-50);
}

export function resetAgentEventBus() {
  events = [];
  snapshots = [];
  seenEventIds.clear();
  machine.reset();
  emit();
}

function emit() {
  for (const listener of listeners) listener();
}

function signature(items: AgentSnapshot[]) {
  return items
    .map((item) => `${item.id}:${item.activity}:${item.location}:${item.confidence}:${item.currentGoal ?? ""}:${item.lastEventAt}`)
    .join("|");
}
