import { compactOfficeText, detectOfficeActivity, providerFromText } from "../officeDetection";
import type { OfficeActivityAdapter, OfficeAiAgent, OfficeAiAgentStatus, OfficeAgentProvider } from "../officeTypes";

const ACTIVE_WINDOW_MS = 10 * 60_000;
const SUBAGENT_PATTERN = /\b(?:launching|spawn(?:ing|ed)?|delegating\s+to|subagent|sub-agent|task\s+agent|research\s+agent|code\s+agent|review\s+agent|test\s+agent|documentation\s+agent|planner)\b/i;

function shortName(name: string) {
  const compact = name.trim().replace(/\s+/g, " ");
  return compact.length > 14 ? `${compact.slice(0, 13)}...` : compact;
}

function statusFor(category: ReturnType<typeof detectOfficeActivity>["category"], text: string): OfficeAiAgentStatus {
  if (/permission|input required|waiting for (?:your|user)|approve|confirmation/i.test(text)) return "waiting";
  if (/plan|planning|todo/i.test(text)) return "thinking";
  if (category === "research") return "researching";
  if (category === "coding") return "coding";
  if (category === "test") return "testing";
  if (category === "build") return "building";
  if (category === "error") return "error";
  if (category === "git") return "git";
  if (category === "success") return "success";
  return "idle";
}

function roleFor(provider: OfficeAgentProvider) {
  return provider === "claude" ? "Claude Code Agent" : provider === "codex" ? "Codex Agent" : `${provider.toUpperCase()} Agent`;
}

export const terminalOutputAgentAdapter: OfficeActivityAdapter = {
  id: "terminal-output",
  detectAgents(input) {
    const workspaces = new Map(input.workspaces.map((workspace) => [workspace.id, workspace]));
    const sessions = input.sessions.filter((session) =>
      ["running", "waiting", "error"].includes(session.status) &&
      (input.scope === "allWorkspaces" || session.workspaceId === input.currentWorkspaceId),
    );
    return sessions.flatMap((session): OfficeAiAgent[] => {
      const history = session.terminalHistory.slice(-1_600);
      const command = input.commandHistory.filter((entry) => entry.sessionId === session.id).at(-1)?.command ?? "";
      const provider = providerFromText(`${session.name}\n${command}\n${history}`);
      if (!provider) return [];
      const workspaceName = workspaces.get(session.workspaceId)?.name ?? "Unknown project";
      const latestLine = history.split(/\r?\n|\r/).filter(Boolean).at(-1);
      const latest = compactOfficeText(latestLine || command || `${provider} is active`, 58);
      const detected = detectOfficeActivity(latest);
      const status = session.status === "waiting" ? "waiting" : session.status === "error" ? "error" : statusFor(detected.category, latest);
      const lastSeenAt = Date.parse(session.updatedAt) || Date.now();
      const main: OfficeAiAgent = {
        id: `${provider}:${session.id}`, provider, name: provider === "gpt" ? "GPT" : provider[0].toUpperCase() + provider.slice(1),
        role: roleFor(provider), terminalId: session.id, workspaceId: session.workspaceId, workspaceName,
        workspaceShortName: shortName(workspaceName), isSubagent: false, status, activity: latest,
        zone: detected.zone, confidence: Date.now() - lastSeenAt < ACTIVE_WINDOW_MS ? 0.72 : 0.55, lastSeenAt,
      };
      const subagentLine = history.split(/\r?\n|\r/).slice(-30).reverse().find((line) => SUBAGENT_PATTERN.test(line));
      if (!subagentLine) return [main];
      const subActivity = compactOfficeText(subagentLine, 58);
      const subDetected = detectOfficeActivity(subActivity);
      return [main, {
        ...main, id: `${main.id}:sub:${simpleHash(subActivity)}`, name: "Subagent", role: subagentRole(subActivity),
        parentAgentId: main.id, isSubagent: true, activity: subActivity, status: statusFor(subDetected.category, subActivity),
        zone: subDetected.zone, confidence: 0.58,
      }];
    });
  },
};

function subagentRole(text: string) {
  for (const role of ["Research", "Review", "Test", "Documentation", "Code", "Planner"]) if (new RegExp(role, "i").test(text)) return `${role} Agent`;
  return "Task Agent";
}

function simpleHash(value: string) {
  return Array.from(value).reduce((hash, char) => (hash * 31 + char.charCodeAt(0)) >>> 0, 7).toString(36);
}
