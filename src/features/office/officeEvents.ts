import { detectOfficeActivity, eventTypeForCategory } from "./officeDetection";
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

export function ensureAgentSpawned(agentId: string, terminalName: string, workspaceId?: string) {
  if (events.some((event) => event.agentId === agentId && event.type === "spawn")) return;
  addOfficeEvent({ agentId, terminalId: agentId, workspaceId, type: "spawn", label: `${terminalName} entered office`, zone: "entrance" });
}

export function ingestOfficeOutput(agentId: string, terminalName: string, workspaceId: string | undefined, output: string) {
  const { category, detail, zone } = detectOfficeActivity(output.slice(-800));
  ensureAgentSpawned(agentId, terminalName, workspaceId);
  const type = eventTypeForCategory(category);
  addOfficeEvent({ agentId, terminalId: agentId, workspaceId, type, label: labelFor(type, detail), detail, zone });
}

export function ingestOfficeStatus(agentId: string, terminalName: string, workspaceId: string | undefined, status: string, error?: string | null) {
  ensureAgentSpawned(agentId, terminalName, workspaceId);
  if (status === "error") addOfficeEvent({ agentId, terminalId: agentId, workspaceId, type: "error", label: "Terminal error detected", detail: error?.slice(0, 90), zone: "debugCorner" });
  if (status === "exited" || status === "idle") addOfficeEvent({ agentId, terminalId: agentId, workspaceId, type: "stop", label: "Terminal stopped", zone: "lounge" });
}

export function addMoveEvent(agentId: string, workspaceId: string | undefined, zone: OfficeZoneId, label: string, type: OfficeEventType = "move") {
  addOfficeEvent({ agentId, terminalId: agentId, workspaceId, type, label, zone });
}

function labelFor(type: OfficeEventType, detail: string) {
  const labels: Partial<Record<OfficeEventType, string>> = { build: "Build started", test: "Test/check started", git: "Git activity", error: "Error detected", success: "Success detected", idle: "Agent waiting" };
  return labels[type] ?? detail;
}
