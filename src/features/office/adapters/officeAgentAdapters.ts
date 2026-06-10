import type { OfficeAdapterInput, OfficeAiAgent } from "../officeTypes";
import { claudeJsonlAdapter } from "./claudeJsonlAdapter";
import { terminalOutputAgentAdapter } from "./terminalOutputAgentAdapter";

export async function detectOfficeAiAgents(input: OfficeAdapterInput) {
  const transcriptAgents = await claudeJsonlAdapter.detectAgents(input);
  const fallbackAgents = await terminalOutputAgentAdapter.detectAgents(input);
  const transcriptTerminalIds = new Set(transcriptAgents.map((agent) => agent.terminalId).filter(Boolean));
  const transcriptWorkspaces = new Set(transcriptAgents.map((agent) => agent.workspaceId).filter(Boolean));
  const merged = [
    ...transcriptAgents,
    ...fallbackAgents.filter((agent) => !transcriptTerminalIds.has(agent.terminalId) && !(agent.provider === "claude" && transcriptWorkspaces.has(agent.workspaceId))),
  ];
  return dedupeAgents(merged);
}

function dedupeAgents(agents: OfficeAiAgent[]) {
  const byId = new Map<string, OfficeAiAgent>();
  for (const agent of agents) {
    const current = byId.get(agent.id);
    if (!current || agent.confidence > current.confidence || agent.lastSeenAt > current.lastSeenAt) byId.set(agent.id, agent);
  }
  return [...byId.values()];
}
