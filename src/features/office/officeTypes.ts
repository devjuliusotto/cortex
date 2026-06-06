import type { SessionStatus } from "@/stores/cortexStore";

export type OfficeSignal = "active" | "idle" | "success" | "warning";

export type OfficeDeskModel = {
  id: string;
  terminalName: string;
  profileLabel: string;
  sessionStatus: SessionStatus;
  signal: OfficeSignal;
  activity: string;
  x: number;
  y: number;
  scale: number;
};

export type OfficeSummary = {
  active: number;
  errors: number;
  total: number;
  lastActivity: string;
};

