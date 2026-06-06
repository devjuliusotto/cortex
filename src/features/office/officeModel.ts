import type { CommandHistoryEntry } from "@/features/terminal/commandHistory";
import type { TerminalSession } from "@/stores/cortexStore";
import { officeTarget } from "./officeLayout";
import type { OfficeAgentModel, OfficeAgentPose, OfficeSignal, OfficeSummary, OfficeZone } from "./officeTypes";

export const OFFICE_ACTIVITY_LIMIT = 42;

const ansiPattern = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const errorPattern = /\b(error|failed|failure|fatal|exception|panic|not found|denied)\b/i;
const successPattern = /\b(success|succeeded|passed|completed|built|compiled|finished|done|0 errors?)\b/i;

const aiAgentPattern = /\b(claude|codex|gpt|gemini|agent)\b/i;
const zonePatterns: Array<[OfficeZone, RegExp]> = [
  ["debugCorner", /\b(error|failed?|debug|exception|panic|stack\s*trace|trace|fix)\b/i],
  ["testBoard", /\b(test|check|lint|vitest|jest|spec|verify|typecheck|tsc)\b/i],
  ["buildLab", /\b(build|compile|npm|pnpm|yarn|cargo|vite|webpack|bundle|serve|dev)\b/i],
  ["researchLibrary", /\b(search|research|docs?|documentation|web|browse|read|fetch|find|lookup)\b/i],
  ["gitBoard", /\b(git|commit|stage|diff|branch|merge|rebase|push|pull|release)\b/i],
  ["codingDesks", /\b(code|write|edit|file|implement|refactor|create|patch|component|function)\b/i],
];

function compactActivity(value: string) {
  const clean = value.replace(ansiPattern, "").replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return "Working";
  return clean.length <= OFFICE_ACTIVITY_LIMIT ? clean : `${clean.slice(0, OFFICE_ACTIVITY_LIMIT - 3).trimEnd()}...`;
}

function lastOutputLine(history: string) {
  return history.replace(ansiPattern, "").split(/\r?\n|\r/).map(compactActivity).filter(Boolean).at(-1) ?? "Working";
}

function signalForSession(session: TerminalSession, activity: string): OfficeSignal {
  if (session.status === "error" || errorPattern.test(activity)) return "warning";
  if (session.status === "completed" || successPattern.test(activity)) return "success";
  if (session.status === "running" || session.status === "waiting") return "active";
  return "idle";
}

function zoneForActivity(session: TerminalSession, activity: string): OfficeZone {
  if (session.status === "error" || errorPattern.test(activity)) return "debugCorner";
  if (session.status === "waiting") return "lounge";
  return zonePatterns.find(([, pattern]) => pattern.test(activity))?.[0] ?? "codingDesks";
}

function poseForZone(zone: OfficeZone): OfficeAgentPose {
  if (zone === "researchLibrary") return "reading";
  if (zone === "buildLab" || zone === "testBoard" || zone === "gitBoard") return "observing";
  if (zone === "debugCorner") return "debugging";
  if (zone === "lounge") return "idle";
  return "typing";
}

function sessionActivity(session: TerminalSession, commandHistory: CommandHistoryEntry[]) {
  const command = commandHistory.filter((entry) => entry.sessionId === session.id).at(-1)?.command;
  return compactActivity(command || lastOutputLine(session.terminalHistory));
}

function isVisibleAgent(session: TerminalSession) {
  return session.status === "running" || session.status === "waiting" || session.status === "error";
}

export function createOfficeAgents(sessions: TerminalSession[], commandHistory: CommandHistoryEntry[]): OfficeAgentModel[] {
  return sessions.filter(isVisibleAgent).map((session) => {
    const activity = sessionActivity(session, commandHistory);
    const zone = zoneForActivity(session, activity);
    return {
      id: session.id,
      terminalName: session.name,
      profileLabel: session.profileId.replace("wsl-", ""),
      sessionStatus: session.status,
      signal: signalForSession(session, activity),
      phase: "active",
      pose: poseForZone(zone),
      activity,
      zone,
      target: officeTarget(zone, session.id),
      isAiAgent: aiAgentPattern.test(`${session.name} ${activity}`),
    };
  });
}

export function summarizeOffice(agents: OfficeAgentModel[]): OfficeSummary {
  const latest = agents.find((agent) => agent.signal === "active") ?? agents[0];
  return {
    active: agents.filter((agent) => agent.phase === "active" && agent.signal === "active").length,
    errors: agents.filter((agent) => agent.signal === "warning").length,
    total: agents.filter((agent) => agent.phase === "active").length,
    lastActivity: latest?.activity ?? "Waiting for agents",
  };
}
