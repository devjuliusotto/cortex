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

export type OfficeAgentIdentity = {
  name: string;
  role: string;
  color: number;
  accessory: "spark" | "brackets" | "note" | "lens" | "terminal";
};

export type OfficeAgentModel = {
  id: string;
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
