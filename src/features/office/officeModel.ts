import type { TerminalSession } from "@/stores/cortexStore";
import { compactOfficeText } from "./officeDetection";
import { officeTarget } from "./officeLayout";
import type {
  AgentActivity,
  AgentConfidenceLevel,
  AgentLocation,
  AgentSnapshot,
  OfficeActivityCategory,
  OfficeAgentIdentity,
  OfficeAgentModel,
  OfficeAgentPose,
  OfficeKanbanCard,
  OfficeSignal,
  OfficeSummary,
  OfficeZoneId,
} from "./officeTypes";

export const OFFICE_ACTIVITY_LIMIT = 42;

function identityFor(agent: AgentSnapshot): OfficeAgentIdentity {
  const providers: Record<AgentSnapshot["provider"], Pick<OfficeAgentIdentity, "color" | "accessory">> = {
    claude: { color: 0xc98264, accessory: "spark" },
    codex: { color: 0x63d9d4, accessory: "brackets" },
    gpt: { color: 0x77b987, accessory: "note" },
    gemini: { color: 0x7196df, accessory: "lens" },
    cursor: { color: 0x8b82c4, accessory: "brackets" },
    aider: { color: 0xd2aa62, accessory: "terminal" },
    cline: { color: 0x68a8c4, accessory: "terminal" },
    unknown: { color: 0x8991a5, accessory: "terminal" },
  };
  return { name: agent.name, role: agent.role, ...providers[agent.provider] };
}

function confidenceLevel(confidence: number): AgentConfidenceLevel {
  if (confidence >= 0.8) return "confirmed";
  if (confidence >= 0.5) return "inferred";
  return "unknown";
}

function zoneForAgent(agent: AgentSnapshot): OfficeZoneId {
  const context = `${agent.detail ?? ""} ${agent.toolName ?? ""}`.toLowerCase();
  if (/debug|error|failed|failure|exception|trace/.test(context)) return "debugCorner";
  if (agent.location === "buildlab" || /build|compile|test|lint|check/.test(context)) return "buildLab";
  if (agent.activity === "researching" || agent.location === "library") return "researchLibrary";
  if (agent.activity === "waiting_approval") return "bossDesk";
  if (agent.activity === "waiting_input" || agent.location === "meeting") return "meetingRoom";
  if (agent.activity === "idle" || agent.activity === "completed" || agent.location === "lounge") return "lounge";
  return "codingDesks";
}

function categoryFor(activity: AgentActivity, location: AgentLocation): OfficeActivityCategory {
  if (activity === "researching") return "research";
  if (activity === "completed") return "success";
  if (activity === "idle" || activity === "waiting_input" || activity === "waiting_approval") return "idle";
  if (location === "buildlab") return "build";
  return "coding";
}

function signalFor(activity: AgentActivity): OfficeSignal {
  if (activity === "waiting_approval") return "warning";
  if (activity === "completed") return "success";
  if (activity === "idle" || activity === "waiting_input") return "idle";
  return "active";
}

function poseFor(activity: AgentActivity, location: AgentLocation, zone: OfficeZoneId): OfficeAgentPose {
  if (zone === "debugCorner") return "debugging";
  if (activity === "waiting_input" || activity === "waiting_approval" || location === "meeting") return "meeting";
  if (activity === "researching") return "reading";
  if (activity === "reviewing" || location === "buildlab") return "observing";
  if (activity === "idle" || activity === "completed") return "idle";
  return "typing";
}

export function createOfficeActors(agentSnapshots: AgentSnapshot[], sessions: TerminalSession[]) {
  const sessionsById = new Map(sessions.map((session) => [session.id, session]));
  return agentSnapshots.map((agent): OfficeAgentModel => {
    const session = agent.terminalId ? sessionsById.get(agent.terminalId) : undefined;
    const zone = zoneForAgent(agent);
    const category = categoryFor(agent.activity, agent.location);
    return {
      ...agent,
      terminalName: session?.name ?? agent.name,
      profileLabel: session?.profileId.replace("wsl-", "") ?? agent.provider,
      sessionStatus: session?.status ?? (agent.activity === "completed" ? "completed" : "running"),
      confidenceLevel: confidenceLevel(agent.confidence),
      signal: signalFor(agent.activity),
      phase: "active",
      pose: poseFor(agent.activity, agent.location, zone),
      category,
      zone,
      target: officeTarget(zone, agent.id),
      identity: identityFor(agent),
      meetingLabel:
        agent.activity === "waiting_approval"
          ? "Waiting for approval"
          : agent.activity === "waiting_input"
            ? "Waiting for input"
            : undefined,
    };
  });
}

export function summarizeOffice(agents: OfficeAgentModel[], lastEvent?: string): OfficeSummary {
  return {
    active: agents.filter((agent) => agent.phase === "active" && agent.signal === "active").length,
    errors: agents.filter((agent) => agent.signal === "warning").length,
    buildsTests: agents.filter((agent) => agent.location === "buildlab").length,
    total: agents.filter((agent) => agent.phase === "active").length,
    lastActivity: lastEvent ?? agents[0]?.detail ?? agents[0]?.activity ?? "No active AI agents detected",
  };
}

export function createKanbanCards(agents: OfficeAgentModel[]): OfficeKanbanCard[] {
  return agents.filter((agent) => agent.phase === "active").slice(0, 8).map((agent) => ({
    id: agent.id,
    title: compactOfficeText(`${agent.identity.name}: ${agent.currentGoal ?? agent.detail ?? agent.activity}`, 30),
    column: agent.activity === "completed" ? "done" : "progress",
    warning: agent.activity === "waiting_approval",
  }));
}
