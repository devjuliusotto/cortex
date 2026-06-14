import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "@/features/my-agents/agentsCatalog";

export type AgentDetectionStatus = "checking" | "installed" | "not-installed" | "unavailable";

export function agentExecutable(agent: Agent) {
  return agent.runCommand.trim().split(/\s+/)[0] ?? agent.runCommand;
}

export async function detectAgent(agent: Agent): Promise<AgentDetectionStatus> {
  if (!("__TAURI_INTERNALS__" in window)) return "unavailable";
  try {
    const installed = await invoke<boolean>("detect_agent_command", {
      command: agentExecutable(agent),
    });
    return installed ? "installed" : "not-installed";
  } catch {
    return "unavailable";
  }
}

export async function detectAgents(agents: Agent[]) {
  return Object.fromEntries(
    await Promise.all(agents.map(async (agent) => [agent.id, await detectAgent(agent)] as const)),
  ) as Record<string, AgentDetectionStatus>;
}
