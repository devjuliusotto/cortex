import type { CommandHistoryEntry } from "@/features/terminal/commandHistory";
import type { SessionStatus, TerminalSession, Workspace } from "@/stores/cortexStore";

export type AgentEvent =
  | { type: "task.started" }
  | { type: "task.completed" }
  | { type: "tool.started"; tool: string }
  | { type: "tool.finished"; tool: string }
  | { type: "approval.requested" }
  | { type: "input.requested" }
  | { type: "message.generated" }
  | { type: "idle" };

export type AgentActivity =
  | "coding"
  | "researching"
  | "reviewing"
  | "waiting_input"
  | "waiting_approval"
  | "completed"
  | "idle";

export type AgentLocation = "desk" | "library" | "meeting" | "buildlab" | "lounge";
export type AgentEventSource = "structured" | "heuristic";
export type AgentConfidenceLevel = "confirmed" | "inferred" | "unknown";
export type OfficeScope = "currentWorkspace" | "allWorkspaces";
export type OfficeAgentProvider = "claude" | "codex" | "gpt" | "gemini" | "cursor" | "aider" | "cline" | "unknown";

export interface AgentState {
  activity: AgentActivity;
  location: AgentLocation;
  confidence: number;
  currentGoal?: string;
}

export type AgentDescriptor = {
  id: string;
  provider: OfficeAgentProvider;
  name: string;
  role: string;
  terminalId?: string;
  workspaceId: string;
  workspaceName: string;
  workspaceShortName: string;
  parentAgentId?: string;
  isSubagent: boolean;
};

export type AgentEventEnvelope = {
  id: string;
  timestamp: number;
  source: AgentEventSource;
  confidence: number;
  agent: AgentDescriptor;
  event: AgentEvent;
  activity?: AgentActivity;
  location?: AgentLocation;
  currentGoal?: string;
  detail?: string;
  toolName?: string;
};

export type AgentSnapshot = AgentDescriptor & AgentState & {
  source: AgentEventSource;
  lastEvent: AgentEvent;
  lastEventAt: number;
  stateChangedAt: number;
  detail?: string;
  toolName?: string;
};

export type OfficeAdapterInput = {
  scope: OfficeScope;
  currentWorkspaceId: string | null;
  workspaces: Workspace[];
  sessions: TerminalSession[];
  commandHistory: CommandHistoryEntry[];
};

export type OfficeActivityAdapter = {
  id: string;
  source: AgentEventSource;
  detectEvents(input: OfficeAdapterInput): AgentEventEnvelope[] | Promise<AgentEventEnvelope[]>;
};

export type OfficeSignal = "active" | "idle" | "success" | "warning";
export type OfficeAgentPhase = "active" | "exiting";
export type OfficeAgentPose = "typing" | "reading" | "observing" | "debugging" | "idle" | "meeting";
export type OfficeZoneId =
  | "bossDesk"
  | "codingDesks"
  | "researchLibrary"
  | "buildLab"
  | "testBoard"
  | "debugCorner"
  | "gitBoard"
  | "lounge"
  | "meetingRoom"
  | "entrance";
export type OfficeZone = OfficeZoneId;
export type OfficeActivityCategory = "coding" | "research" | "build" | "test" | "git" | "error" | "success" | "idle";
export type OfficeEventType = "spawn" | "activity" | "move" | "build" | "test" | "git" | "error" | "success" | "meeting" | "idle" | "stop";

export type OfficeEvent = {
  id: string;
  timestamp: number;
  agentId?: string;
  terminalId?: string;
  workspaceId?: string;
  type: OfficeEventType;
  label: string;
  detail?: string;
  zone?: OfficeZoneId;
};

export type OfficePoint = { x: number; y: number };
export type OfficeAgentIdentity = {
  name: string;
  role: string;
  color: number;
  accessory: "spark" | "brackets" | "note" | "lens" | "terminal";
};

export type OfficeAgentModel = AgentSnapshot & {
  terminalName: string;
  profileLabel: string;
  sessionStatus: SessionStatus;
  confidenceLevel: AgentConfidenceLevel;
  signal: OfficeSignal;
  phase: OfficeAgentPhase;
  pose: OfficeAgentPose;
  category: OfficeActivityCategory;
  zone: OfficeZoneId;
  target: OfficePoint;
  identity: OfficeAgentIdentity;
  meetingLabel?: string;
};

export type OfficeSummary = { active: number; errors: number; buildsTests: number; total: number; lastActivity: string };
export type OfficeKanbanCard = { id: string; title: string; column: "progress" | "done"; warning: boolean };
export type OfficeGitSummary = { branch?: string; changedFiles?: number; lastActivity: string };
