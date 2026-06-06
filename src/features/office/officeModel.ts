import type { CommandHistoryEntry } from "@/features/terminal/commandHistory";
import type { TerminalSession, Workspace } from "@/stores/cortexStore";
import { compactOfficeText, detectOfficeActivity } from "./officeDetection";
import { officeTarget } from "./officeLayout";
import type { OfficeAgentIdentity, OfficeAgentModel, OfficeAgentPose, OfficeKanbanCard, OfficeScope, OfficeSignal, OfficeSummary, OfficeZoneId } from "./officeTypes";

export const OFFICE_ACTIVITY_LIMIT = 42;
const ansiPattern = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;

function lastOutputLine(history: string) {
  return history.replace(ansiPattern, "").split(/\r?\n|\r/).map((line) => compactOfficeText(line, OFFICE_ACTIVITY_LIMIT)).filter(Boolean).at(-1) ?? "Working";
}

function sessionActivity(session: TerminalSession, history: CommandHistoryEntry[]) {
  const command = history.filter((entry) => entry.sessionId === session.id).at(-1)?.command;
  return compactOfficeText(command || lastOutputLine(session.terminalHistory), OFFICE_ACTIVITY_LIMIT);
}

function identityFor(session: TerminalSession, activity: string): OfficeAgentIdentity {
  const value = `${session.name} ${activity}`.toLowerCase();
  if (value.includes("claude")) return { name: "Claude", role: "AI Engineer", color: 0xc98264, accessory: "spark" };
  if (value.includes("codex")) return { name: "Codex", role: "Code Agent", color: 0x63d9d4, accessory: "brackets" };
  if (/\bgpt\b/.test(value)) return { name: "GPT", role: "Documentation Agent", color: 0x77b987, accessory: "note" };
  if (value.includes("gemini")) return { name: "Gemini", role: "Research Agent", color: 0x7196df, accessory: "lens" };
  return { name: session.name, role: "Terminal Worker", color: 0x8991a5, accessory: "terminal" };
}

function signalFor(session: TerminalSession, category: ReturnType<typeof detectOfficeActivity>["category"]): OfficeSignal {
  if (session.status === "error" || category === "error") return "warning";
  if (session.status === "completed" || category === "success") return "success";
  if (session.status === "running") return "active";
  return "idle";
}

function poseForZone(zone: OfficeZoneId): OfficeAgentPose {
  if (zone === "meetingRoom") return "meeting";
  if (zone === "researchLibrary") return "reading";
  if (["buildLab", "testBoard", "gitBoard"].includes(zone)) return "observing";
  if (zone === "debugCorner") return "debugging";
  if (zone === "lounge") return "idle";
  return "typing";
}

function applyMeetingHeuristic(agents: OfficeAgentModel[]) {
  const errors = agents.filter((agent) => agent.category === "error" || agent.signal === "warning");
  if (errors.length >= 2) return agents.map((agent) => errors.includes(agent) ? meetingAgent(agent, "Reviewing error") : agent);
  for (const category of ["build", "test", "git", "coding"] as const) {
    const group = agents.filter((agent) => agent.category === category && agent.signal === "active");
    if (group.length >= 2) return agents.map((agent) => group.includes(agent) ? meetingAgent(agent, category === "git" ? "Syncing task" : `Discussing ${category}`) : agent);
  }
  return agents;
}

function meetingAgent(agent: OfficeAgentModel, label: string): OfficeAgentModel {
  return { ...agent, zone: "meetingRoom", pose: "meeting", meetingLabel: label, target: officeTarget("meetingRoom", agent.id) };
}

type CreateOfficeAgentsOptions = {
  scope: OfficeScope;
  currentWorkspaceId: string | null;
  workspaces: Workspace[];
};

function shortWorkspaceName(name: string) {
  const compact = name.trim().replace(/\s+/g, " ");
  return compact.length > 14 ? `${compact.slice(0, 13)}…` : compact;
}

export function createOfficeAgents(sessions: TerminalSession[], commandHistory: CommandHistoryEntry[], options: CreateOfficeAgentsOptions) {
  const workspaceById = new Map(options.workspaces.map((workspace) => [workspace.id, workspace]));
  const visible = sessions.filter((session) =>
    ["running", "waiting", "error"].includes(session.status) &&
    (options.scope === "allWorkspaces" || session.workspaceId === options.currentWorkspaceId),
  );
  const agents = visible.map((session): OfficeAgentModel => {
    const activity = sessionActivity(session, commandHistory);
    const detected = detectOfficeActivity(activity);
    const zone = session.status === "waiting" ? "lounge" : detected.zone;
    const workspaceName = workspaceById.get(session.workspaceId)?.name ?? "Unknown project";
    return {
      id: session.id, workspaceId: session.workspaceId, workspaceName,
      workspaceShortName: shortWorkspaceName(workspaceName), terminalName: session.name,
      profileLabel: session.profileId.replace("wsl-", ""),
      sessionStatus: session.status, signal: signalFor(session, detected.category), phase: "active",
      pose: poseForZone(zone), activity, category: detected.category, zone, target: officeTarget(zone, session.id),
      identity: identityFor(session, activity),
    };
  });
  if (options.scope === "currentWorkspace") return applyMeetingHeuristic(agents);
  return [...new Set(agents.map((agent) => agent.workspaceId))].flatMap((workspaceId) =>
    applyMeetingHeuristic(agents.filter((agent) => agent.workspaceId === workspaceId)),
  );
}

export function summarizeOffice(agents: OfficeAgentModel[], lastEvent?: string): OfficeSummary {
  return {
    active: agents.filter((agent) => agent.phase === "active" && agent.signal === "active").length,
    errors: agents.filter((agent) => agent.signal === "warning").length,
    buildsTests: agents.filter((agent) => agent.category === "build" || agent.category === "test").length,
    total: agents.filter((agent) => agent.phase === "active").length,
    lastActivity: lastEvent ?? agents[0]?.activity ?? "Waiting for agents",
  };
}

export function createKanbanCards(agents: OfficeAgentModel[]): OfficeKanbanCard[] {
  return agents.filter((agent) => agent.phase === "active").slice(0, 8).map((agent) => ({
    id: agent.id, title: compactOfficeText(`${agent.identity.name}: ${agent.activity}`, 30),
    column: agent.signal === "success" ? "done" : "progress", warning: agent.signal === "warning",
  }));
}
