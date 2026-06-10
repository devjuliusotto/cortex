import type { OfficeEvent, OfficeEventType, OfficeZoneId } from "./officeTypes";

const MAX_EVENTS = 500;
const MAX_AGENT_EVENTS = 50;
const DUPLICATE_WINDOW_MS = 4_000;
let events: OfficeEvent[] = [];
const listeners = new Set<() => void>();

function emit() { for (const listener of listeners) listener(); }

export function subscribeOfficeEvents(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getOfficeEvents() { return events; }

export function officeEventsForAgent(agentId: string) {
  return events.filter((event) => event.agentId === agentId).slice(-MAX_AGENT_EVENTS);
}

export function addOfficeEvent(input: Omit<OfficeEvent, "id" | "timestamp"> & { timestamp?: number }) {
  const timestamp = input.timestamp ?? Date.now();
  const duplicate = events.at(-1);
  if (duplicate && duplicate.agentId === input.agentId && duplicate.type === input.type && duplicate.label === input.label && timestamp - duplicate.timestamp < DUPLICATE_WINDOW_MS) return duplicate;
  const event: OfficeEvent = { ...input, timestamp, id: `office-${timestamp}-${Math.random().toString(36).slice(2, 7)}` };
  events = [...events, event].slice(-MAX_EVENTS);
  emit();
  return event;
}

export function addMoveEvent(agentId: string, workspaceId: string | undefined, zone: OfficeZoneId, label: string, type: OfficeEventType = "move") {
  addOfficeEvent({ agentId, workspaceId, type, label, zone });
}
