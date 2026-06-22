import { invoke } from "@tauri-apps/api/core";
import type { Agent } from "@/features/my-agents/agentsCatalog";

export type AgentDetectionStatus = "checking" | "installed" | "not-installed" | "unavailable";

const CACHE_TTL_MS = 5 * 60 * 1000;
let cachedStatuses: Record<string, AgentDetectionStatus> | null = null;
let cachedAt = 0;
let pendingDetection: Promise<Record<string, AgentDetectionStatus>> | null = null;

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
  const commands = [...new Set(agents.map(agentExecutable))];
  if (!("__TAURI_INTERNALS__" in window)) {
    return Object.fromEntries(agents.map((agent) => [agent.id, "unavailable"])) as Record<string, AgentDetectionStatus>;
  }

  const detected = await invoke<Record<string, boolean>>("detect_agent_commands", { commands });
  return Object.fromEntries(
    agents.map((agent) => [agent.id, detected[agentExecutable(agent)] ? "installed" : "not-installed"]),
  ) as Record<string, AgentDetectionStatus>;
}

export function getCachedAgentStatuses() {
  return cachedStatuses;
}

export function detectAgentsCached(agents: Agent[], force = false) {
  if (!force && cachedStatuses && Date.now() - cachedAt < CACHE_TTL_MS) {
    return Promise.resolve(cachedStatuses);
  }
  if (!force && pendingDetection) {
    return pendingDetection;
  }

  pendingDetection = detectAgents(agents)
    .catch(() => Object.fromEntries(agents.map((agent) => [agent.id, "unavailable"])) as Record<string, AgentDetectionStatus>)
    .then((statuses) => {
      cachedStatuses = statuses;
      cachedAt = Date.now();
      return statuses;
    })
    .finally(() => {
      pendingDetection = null;
    });
  return pendingDetection;
}
