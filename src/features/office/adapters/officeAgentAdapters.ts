import type { AgentEventEnvelope, OfficeAdapterInput } from "../officeTypes";
import { claudeJsonlAdapter } from "./claudeJsonlAdapter";
import { terminalOutputAgentAdapter } from "./terminalOutputAgentAdapter";

export async function collectOfficeAgentEvents(input: OfficeAdapterInput) {
  const structured = await claudeJsonlAdapter.detectEvents(input);
  const fallback = await terminalOutputAgentAdapter.detectEvents(input);
  const structuredTerminalIds = new Set(structured.map((item) => item.agent.terminalId).filter(Boolean));
  const structuredClaudeWorkspaces = new Set(
    structured.filter((item) => item.agent.provider === "claude").map((item) => item.agent.workspaceId),
  );
  return dedupeEvents([
    ...structured,
    ...fallback.filter((item) =>
      !structuredTerminalIds.has(item.agent.terminalId) &&
      !(item.agent.provider === "claude" && structuredClaudeWorkspaces.has(item.agent.workspaceId)),
    ),
  ]);
}

function dedupeEvents(events: AgentEventEnvelope[]) {
  const byId = new Map<string, AgentEventEnvelope>();
  for (const event of events) byId.set(event.id, event);
  return [...byId.values()];
}
