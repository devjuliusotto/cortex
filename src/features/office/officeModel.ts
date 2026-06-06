import type { CommandHistoryEntry } from "@/features/terminal/commandHistory";
import type { TerminalSession } from "@/stores/cortexStore";
import type { OfficeDeskModel, OfficeSignal, OfficeSummary } from "./officeTypes";

export const OFFICE_SCENE_WIDTH = 1200;
export const OFFICE_SCENE_HEIGHT = 720;
export const OFFICE_ACTIVITY_LIMIT = 52;

const ansiPattern = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const errorPattern = /\b(error|failed|failure|fatal|exception|panic|not found|denied)\b/i;
const successPattern = /\b(success|succeeded|passed|completed|built|compiled|finished|done|0 errors?)\b/i;

function compactActivity(value: string) {
  const clean = value
    .replace(ansiPattern, "")
    .replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (clean.length <= OFFICE_ACTIVITY_LIMIT) {
    return clean;
  }
  return `${clean.slice(0, OFFICE_ACTIVITY_LIMIT - 1).trimEnd()}…`;
}

function lastOutputLine(history: string) {
  const clean = history.replace(ansiPattern, "");
  const lines = clean
    .split(/\r?\n|\r/)
    .map((line) => compactActivity(line))
    .filter(Boolean);
  return lines.at(-1) ?? "No activity yet";
}

function signalForSession(session: TerminalSession, activity: string): OfficeSignal {
  if (session.status === "error" || errorPattern.test(activity)) {
    return "warning";
  }
  if (session.status === "completed" || successPattern.test(activity)) {
    return "success";
  }
  if (session.status === "running" || session.status === "waiting") {
    return "active";
  }
  return "idle";
}

function deskActivity(session: TerminalSession, commandHistory: CommandHistoryEntry[]) {
  const latestCommand = commandHistory
    .filter((entry) => entry.sessionId === session.id)
    .at(-1)?.command;
  return compactActivity(latestCommand || lastOutputLine(session.terminalHistory));
}

export function createOfficeDesks(
  sessions: TerminalSession[],
  commandHistory: CommandHistoryEntry[],
): OfficeDeskModel[] {
  if (sessions.length === 0) {
    return [];
  }

  const columns = Math.min(4, Math.max(1, Math.ceil(Math.sqrt(sessions.length * 1.55))));
  const rows = Math.ceil(sessions.length / columns);
  const cellWidth = 1060 / columns;
  const cellHeight = 480 / rows;
  const scale = Math.min(1, cellWidth / 250, cellHeight / 180);

  return sessions.map((session, index) => {
    const column = index % columns;
    const row = Math.floor(index / columns);
    const activity = deskActivity(session, commandHistory);

    return {
      id: session.id,
      terminalName: session.name,
      profileLabel: session.profileId.replace("wsl-", ""),
      sessionStatus: session.status,
      signal: signalForSession(session, activity),
      activity,
      x: 70 + cellWidth * column + cellWidth / 2,
      y: 165 + cellHeight * row + cellHeight / 2,
      scale,
    };
  });
}

export function summarizeOffice(desks: OfficeDeskModel[]): OfficeSummary {
  const latest = desks
    .slice()
    .sort((first, second) => (first.sessionStatus === "running" ? -1 : second.sessionStatus === "running" ? 1 : 0))[0];

  return {
    active: desks.filter((desk) => desk.signal === "active").length,
    errors: desks.filter((desk) => desk.signal === "warning").length,
    total: desks.length,
    lastActivity: latest?.activity ?? "No terminal activity yet",
  };
}

