import type { SessionStatus } from "@/stores/cortexStore";

export type OfficeSignal = "active" | "idle" | "success" | "warning";
export type OfficeAgentPhase = "active" | "exiting";
export type OfficeAgentPose = "typing" | "reading" | "observing" | "debugging" | "idle";
export type OfficeZone =
  | "bossDesk"
  | "codingDesks"
  | "researchLibrary"
  | "buildLab"
  | "testBoard"
  | "debugCorner"
  | "gitBoard"
  | "lounge"
  | "entrance";

export type OfficePoint = { x: number; y: number };

export type OfficeAgentModel = {
  id: string;
  terminalName: string;
  profileLabel: string;
  sessionStatus: SessionStatus;
  signal: OfficeSignal;
  phase: OfficeAgentPhase;
  pose: OfficeAgentPose;
  activity: string;
  zone: OfficeZone;
  target: OfficePoint;
  isAiAgent: boolean;
};

export type OfficeSummary = {
  active: number;
  errors: number;
  total: number;
  lastActivity: string;
};
