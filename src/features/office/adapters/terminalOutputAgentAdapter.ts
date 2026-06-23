import { compactOfficeText, detectOfficeActivity, providerFromText } from "../officeDetection";
import type {
  AgentActivity,
  AgentDescriptor,
  AgentEvent,
  AgentEventEnvelope,
  AgentLocation,
  OfficeActivityAdapter,
  OfficeAgentProvider,
} from "../officeTypes";

const ACTIVE_WINDOW_MS = 10 * 60_000;

export const terminalOutputAgentAdapter: OfficeActivityAdapter = {
  id: "terminal-output",
  source: "heuristic",
  detectEvents(input) {
    const workspaces = new Map(input.workspaces.map((workspace) => [workspace.id, workspace]));
    return input.sessions.flatMap((session): AgentEventEnvelope[] => {
      if (input.scope !== "allWorkspaces" && session.workspaceId !== input.currentWorkspaceId) return [];
      const history = session.terminalHistory.slice(-2_400);
      const command = input.commandHistory.filter((entry) => entry.sessionId === session.id).at(-1)?.command ?? "";
      const provider = providerFromText(`${session.name}\n${command}`);
      if (!provider) return [];
      const lastSeenAt = Date.parse(session.updatedAt) || Date.now();
      if (Date.now() - lastSeenAt > ACTIVE_WINDOW_MS && session.status === "inactive") return [];

      const workspaceName = workspaces.get(session.workspaceId)?.name ?? "Unknown project";
      const latestLine = history.split(/\r?\n|\r/).filter(Boolean).at(-1);
      const detail = compactOfficeText(latestLine || command || `${provider} is active`, 58);
      const descriptor = descriptorFor(provider, session.id, session.workspaceId, workspaceName);
      const inferred = inferFallbackEvent(detail, session.status);
      return [{
        id: `terminal:${session.id}:${lastSeenAt}:${hash(`${inferred.event.type}:${detail}`)}`,
        timestamp: lastSeenAt,
        source: "heuristic",
        confidence: inferred.confidence,
        agent: descriptor,
        event: inferred.event,
        activity: inferred.activity,
        location: inferred.location,
        currentGoal: command.trim() ? compactOfficeText(command, 80) : undefined,
        detail,
        toolName: inferred.event.type === "tool.started" || inferred.event.type === "tool.finished" ? inferred.event.tool : undefined,
      }];
    });
  },
};

function inferFallbackEvent(detail: string, sessionStatus: string): {
  event: AgentEvent;
  activity: AgentActivity;
  location: AgentLocation;
  confidence: number;
} {
  if (/permission|approve|authorization|allow this|confirm/i.test(detail)) {
    return { event: { type: "approval.requested" }, activity: "waiting_approval", location: "desk", confidence: 0.48 };
  }
  if (/input required|waiting for (?:your|user)|enter (?:a |the )?value|your answer/i.test(detail)) {
    return { event: { type: "input.requested" }, activity: "waiting_input", location: "desk", confidence: 0.46 };
  }
  if (sessionStatus === "completed" || /\b(done|completed|finished|succeeded)\b/i.test(detail)) {
    return { event: { type: "task.completed" }, activity: "completed", location: "lounge", confidence: 0.45 };
  }
  if (sessionStatus === "inactive" || /\b(idle|stopped|exited)\b/i.test(detail)) {
    return { event: { type: "idle" }, activity: "idle", location: "lounge", confidence: 0.42 };
  }

  const detected = detectOfficeActivity(detail);
  if (detected.category === "research") {
    return { event: { type: "tool.started", tool: "research" }, activity: "researching", location: "library", confidence: 0.38 };
  }
  if (detected.category === "test" || detected.category === "build") {
    return { event: { type: "tool.started", tool: detected.category }, activity: "reviewing", location: "buildlab", confidence: 0.4 };
  }
  if (detected.category === "git") {
    return { event: { type: "tool.started", tool: "git" }, activity: "reviewing", location: "desk", confidence: 0.36 };
  }
  return { event: { type: "message.generated" }, activity: "coding", location: "desk", confidence: 0.34 };
}

function descriptorFor(
  provider: OfficeAgentProvider,
  sessionId: string,
  workspaceId: string,
  workspaceName: string,
): AgentDescriptor {
  const name = provider === "gpt" ? "GPT" : provider[0].toUpperCase() + provider.slice(1);
  return {
    id: `${provider}:${sessionId}`,
    provider,
    name,
    role: provider === "claude" ? "Claude Code Agent" : provider === "codex" ? "Codex Agent" : `${provider.toUpperCase()} Agent`,
    terminalId: sessionId,
    workspaceId,
    workspaceName,
    workspaceShortName: shortName(workspaceName),
    isSubagent: false,
  };
}

function shortName(name: string) {
  const compact = name.trim().replace(/\s+/g, " ");
  return compact.length > 14 ? `${compact.slice(0, 13)}...` : compact;
}

function hash(value: string) {
  return Array.from(value).reduce((result, char) => (result * 31 + char.charCodeAt(0)) >>> 0, 7).toString(36);
}
