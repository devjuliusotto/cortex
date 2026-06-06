import type { TerminalSession } from "@/stores/cortexStore";
import { compactOfficeText } from "./officeDetection";
import { officeTarget } from "./officeLayout";
import type { OfficeActivityCategory, OfficeAgentIdentity, OfficeAgentModel, OfficeAgentPose, OfficeAiAgent, OfficeAiAgentStatus, OfficeKanbanCard, OfficeSignal, OfficeSummary, OfficeZoneId } from "./officeTypes";

export const OFFICE_ACTIVITY_LIMIT = 42;

function identityFor(agent: OfficeAiAgent): OfficeAgentIdentity {
  const providers: Record<OfficeAiAgent["provider"], Pick<OfficeAgentIdentity, "color" | "accessory">> = {
    claude: { color: 0xc98264, accessory: "spark" }, codex: { color: 0x63d9d4, accessory: "brackets" },
    gpt: { color: 0x77b987, accessory: "note" }, gemini: { color: 0x7196df, accessory: "lens" },
    cursor: { color: 0x8b82c4, accessory: "brackets" }, aider: { color: 0xd2aa62, accessory: "terminal" },
    cline: { color: 0x68a8c4, accessory: "terminal" }, unknown: { color: 0x8991a5, accessory: "terminal" },
  };
  return { name: agent.name, role: agent.role, ...providers[agent.provider] };
}

function categoryFor(status: OfficeAiAgentStatus): OfficeActivityCategory {
  if (status === "researching") return "research";
  if (status === "testing") return "test";
  if (status === "building") return "build";
  if (status === "debugging" || status === "error") return "error";
  if (status === "git") return "git";
  if (status === "success") return "success";
  if (status === "idle" || status === "waiting" || status === "stopped") return "idle";
  return "coding";
}

function signalFor(status: OfficeAiAgentStatus): OfficeSignal {
  if (status === "error" || status === "debugging") return "warning";
  if (status === "success") return "success";
  if (status === "idle" || status === "waiting" || status === "stopped") return "idle";
  return "active";
}

function poseFor(status: OfficeAiAgentStatus, zone: OfficeZoneId): OfficeAgentPose {
  if (status === "waiting" || status === "thinking" || zone === "meetingRoom") return "meeting";
  if (status === "researching") return "reading";
  if (status === "building" || status === "testing" || status === "git") return "observing";
  if (status === "debugging" || status === "error") return "debugging";
  if (status === "idle" || status === "success" || status === "stopped") return "idle";
  return "typing";
}

export function createOfficeActors(aiAgents: OfficeAiAgent[], sessions: TerminalSession[]) {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  return aiAgents.map((agent): OfficeAgentModel => {
    const session = agent.terminalId ? sessionsById.get(agent.terminalId) : undefined;
    const category = categoryFor(agent.status);
    return {
      ...agent,
      workspaceId: agent.workspaceId ?? "unknown",
      terminalName: session?.name ?? agent.name,
      profileLabel: session?.profileId.replace("wsl-", "") ?? agent.provider,
      sessionStatus: session?.status ?? (agent.status === "error" ? "error" : agent.status === "stopped" ? "completed" : "running"),
      signal: signalFor(agent.status), phase: agent.status === "stopped" ? "exiting" : "active",
      pose: poseFor(agent.status, agent.zone), category, target: officeTarget(agent.zone, agent.id),
      identity: identityFor(agent), meetingLabel: agent.status === "waiting" ? "Waiting for input" : undefined,
    };
  });
}

export function summarizeOffice(agents: OfficeAgentModel[], lastEvent?: string): OfficeSummary {
  return {
    active: agents.filter((agent) => agent.phase === "active" && agent.signal === "active").length,
    errors: agents.filter((agent) => agent.signal === "warning").length,
    buildsTests: agents.filter((agent) => agent.category === "build" || agent.category === "test").length,
    total: agents.filter((agent) => agent.phase === "active").length,
    lastActivity: lastEvent ?? agents[0]?.activity ?? "No active AI agents detected",
  };
}

export function createKanbanCards(agents: OfficeAgentModel[]): OfficeKanbanCard[] {
  return agents.filter((agent) => agent.phase === "active").slice(0, 8).map((agent) => ({
    id: agent.id, title: compactOfficeText(`${agent.identity.name}: ${agent.activity}`, 30),
    column: agent.signal === "success" ? "done" : "progress", warning: agent.signal === "warning",
  }));
}
