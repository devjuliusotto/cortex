import type { SessionStatus } from "@/stores/cortexStore";

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
export type OfficeScope = "currentWorkspace" | "allWorkspaces";
export type OfficeAgentProvider = "claude" | "codex" | "gpt" | "gemini" | "cursor" | "aider" | "cline" | "unknown";
export type OfficeAiAgentStatus = "idle" | "thinking" | "researching" | "coding" | "testing" | "building" | "debugging" | "git" | "waiting" | "success" | "error" | "stopped";

export type OfficeAiAgent = {
  id: string;
  provider: OfficeAgentProvider;
  name: string;
  role: string;
  terminalId?: string;
  workspaceId?: string;
  workspaceName: string;
  workspaceShortName: string;
  parentAgentId?: string;
  isSubagent: boolean;
  status: OfficeAiAgentStatus;
  activity: string;
  toolName?: string;
  zone: OfficeZoneId;
  confidence: number;
  lastSeenAt: number;
};

export type OfficeAdapterInput = {
  scope: OfficeScope;
  currentWorkspaceId: string | null;
  workspaces: import("@/stores/cortexStore").Workspace[];
  sessions: import("@/stores/cortexStore").TerminalSession[];
  commandHistory: import("@/features/terminal/commandHistory").CommandHistoryEntry[];
};

export type OfficeActivityAdapter = {
  id: string;
  detectAgents(input: OfficeAdapterInput): OfficeAiAgent[] | Promise<OfficeAiAgent[]>;
};

export type OfficeAgentIdentity = {
  name: string;
  role: string;
  color: number;
  accessory: "spark" | "brackets" | "note" | "lens" | "terminal";
};

export type OfficeAgentModel = OfficeAiAgent & {
  workspaceId: string;
  terminalId?: string;
  terminalName: string;
  profileLabel: string;
  sessionStatus: SessionStatus;
  signal: OfficeSignal;
  phase: OfficeAgentPhase;
  pose: OfficeAgentPose;
  activity: string;
  category: OfficeActivityCategory;
  zone: OfficeZoneId;
  target: OfficePoint;
  identity: OfficeAgentIdentity;
  meetingLabel?: string;
};

export type OfficeSummary = {
  active: number;
  errors: number;
  buildsTests: number;
  total: number;
  lastActivity: string;
};

export type OfficeKanbanCard = {
  id: string;
  title: string;
  column: "progress" | "done";
  warning: boolean;
};

export type OfficeGitSummary = {
  branch?: string;
  changedFiles?: number;
  lastActivity: string;
};
