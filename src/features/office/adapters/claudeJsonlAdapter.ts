import { invoke } from "@tauri-apps/api/core";
import { categoryZones, compactOfficeText, detectOfficeActivity } from "../officeDetection";
import type { OfficeActivityAdapter, OfficeAdapterInput, OfficeAiAgent, OfficeAiAgentStatus } from "../officeTypes";

type ClaudeTranscriptSnapshot = { workspaceId: string; sessionId: string; path: string; modifiedAt: number; lines: string[]; isSubagent: boolean; parentSessionId?: string };
type ToolUse = { id?: string; name?: string; input?: Record<string, unknown> };

const ACTIVE_MAX_AGE_MS = 10 * 60_000;

export const claudeJsonlAdapter: OfficeActivityAdapter = {
  id: "claude-jsonl",
  async detectAgents(input) {
    if (!("__TAURI_INTERNALS__" in window)) return [];
    const workspacePaths = input.workspaces
      .filter((workspace) => input.scope === "allWorkspaces" || workspace.id === input.currentWorkspaceId)
      .map((workspace) => ({ workspaceId: workspace.id, path: workspace.defaultWorkingDirectory ?? input.sessions.find((session) => session.workspaceId === workspace.id)?.cwd }))
      .filter((workspace): workspace is { workspaceId: string; path: string } => Boolean(workspace.path));
    if (workspacePaths.length === 0) return [];
    try {
      const snapshots = await invoke<ClaudeTranscriptSnapshot[]>("office_read_claude_transcripts", { workspacePaths });
      return snapshots.filter((snapshot) => Date.now() - snapshot.modifiedAt <= ACTIVE_MAX_AGE_MS).flatMap((snapshot) => parseSnapshot(snapshot, input));
    } catch (error) {
      console.warn("Claude transcript detection unavailable", error);
      return [];
    }
  },
};

function parseSnapshot(snapshot: ClaudeTranscriptSnapshot, input: OfficeAdapterInput): OfficeAiAgent[] {
  const workspace = input.workspaces.find((item) => item.id === snapshot.workspaceId);
  if (!workspace) return [];
  const activeTools = new Map<string, ToolUse>();
  const subagentTools = new Map<string, ToolUse>();
  let latestText = "Claude is thinking";
  let turnEnded = false;
  for (const line of snapshot.lines) {
    let record: Record<string, any>;
    try { record = JSON.parse(line); } catch { continue; }
    const content = record.message?.content ?? record.content;
    if (record.type === "assistant" && Array.isArray(content)) {
      turnEnded = false;
      for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") latestText = compactOfficeText(block.text, 58);
        if (block.type === "tool_use" && block.id) {
          const tool = block as ToolUse;
          activeTools.set(block.id, tool);
          if (tool.name === "Task" || tool.name === "Agent") subagentTools.set(block.id, tool);
        }
      }
    } else if (record.type === "user" && Array.isArray(content)) {
      for (const block of content) if (block.type === "tool_result" && block.tool_use_id) { activeTools.delete(block.tool_use_id); subagentTools.delete(block.tool_use_id); }
    } else if (record.type === "system" && record.subtype === "turn_duration") {
      turnEnded = true;
      activeTools.clear();
      subagentTools.clear();
    } else if (record.type === "progress") {
      const parentId = record.parentToolUseID;
      const inner = record.data?.message?.message?.content;
      if (parentId && Array.isArray(inner)) for (const block of inner) if (block.type === "tool_use") subagentTools.set(parentId, block);
    }
  }
  const terminal = findClaudeTerminal(snapshot.workspaceId, input);
  const workspaceShortName = workspace.name.length > 14 ? `${workspace.name.slice(0, 13)}...` : workspace.name;
  const latestTool = [...activeTools.values()].at(-1);
  const toolName = latestTool?.name;
  const activity = toolName ? formatClaudeTool(toolName, latestTool?.input) : latestText;
  const status = turnEnded ? "waiting" : statusForTool(toolName, activity);
  const mainId = `claude-jsonl:${snapshot.sessionId}`;
  const main: OfficeAiAgent = {
    id: mainId, provider: "claude", name: snapshot.isSubagent ? "Claude Subagent" : "Claude", role: snapshot.isSubagent ? "Claude Task Agent" : "Claude Code Agent",
    terminalId: terminal?.id, workspaceId: snapshot.workspaceId, workspaceName: workspace.name, workspaceShortName,
    parentAgentId: snapshot.parentSessionId ? `claude-jsonl:${snapshot.parentSessionId}` : undefined, isSubagent: snapshot.isSubagent,
    status, activity, toolName, zone: zoneForStatus(status), confidence: 0.98, lastSeenAt: snapshot.modifiedAt,
  };
  const children = snapshot.isSubagent ? [] : [...subagentTools.entries()].map(([toolId, tool]): OfficeAiAgent => {
    const childActivity = formatClaudeTool(tool.name ?? "Task", tool.input);
    const childStatus = statusForTool(tool.name, childActivity);
    return { ...main, id: `${mainId}:task:${toolId}`, name: "Claude Subagent", role: subagentRole(tool.input), parentAgentId: mainId,
      isSubagent: true, status: childStatus, activity: childActivity, toolName: tool.name, zone: zoneForStatus(childStatus), confidence: 0.95 };
  });
  return [main, ...children];
}

function findClaudeTerminal(workspaceId: string, input: OfficeAdapterInput) {
  return input.sessions.find((session) => session.workspaceId === workspaceId && /claude/i.test(`${session.name}\n${session.terminalHistory.slice(-1000)}`));
}

function formatClaudeTool(toolName: string, input: Record<string, unknown> = {}) {
  const file = typeof input.file_path === "string" ? input.file_path.split(/[\\/]/).at(-1) : "";
  if (toolName === "Read") return `Reading ${file}`;
  if (toolName === "Edit" || toolName === "MultiEdit") return `Editing ${file}`;
  if (toolName === "Write") return `Writing ${file}`;
  if (toolName === "Glob") return "Searching files";
  if (toolName === "Grep") return "Searching code";
  if (toolName === "WebFetch") return "Fetching web content";
  if (toolName === "WebSearch") return "Searching the web";
  if (toolName === "TodoWrite" || toolName === "EnterPlanMode") return "Planning work";
  if (toolName === "Bash") return compactOfficeText(`Running ${String(input.command ?? "command")}`, 58);
  if (toolName === "Task" || toolName === "Agent") return compactOfficeText(`Subtask: ${String(input.description ?? input.prompt ?? "Delegated task")}`, 58);
  if (toolName === "AskUserQuestion") return "Waiting for your answer";
  return `Using ${toolName}`;
}

function statusForTool(toolName: string | undefined, activity: string): OfficeAiAgentStatus {
  if (/waiting|permission|answer|approve/i.test(activity)) return "waiting";
  if (!toolName) return "thinking";
  if (["Read", "Grep", "Glob", "WebFetch", "WebSearch"].includes(toolName)) return "researching";
  if (["Write", "Edit", "MultiEdit", "NotebookEdit", "apply_patch"].includes(toolName)) return "coding";
  if (["TodoWrite", "EnterPlanMode"].includes(toolName)) return "thinking";
  if (toolName === "Bash") {
    if (/\b(test|lint|typecheck|check)\b/i.test(activity)) return "testing";
    if (/\b(git|commit|diff|branch|push|pull)\b/i.test(activity)) return "git";
    return "building";
  }
  return detectOfficeActivity(activity).category === "error" ? "error" : "thinking";
}

function zoneForStatus(status: OfficeAiAgentStatus) {
  if (status === "thinking" || status === "waiting") return "meetingRoom" as const;
  if (status === "researching") return "researchLibrary" as const;
  if (status === "coding") return "codingDesks" as const;
  if (status === "testing") return "testBoard" as const;
  if (status === "building") return "buildLab" as const;
  if (status === "debugging" || status === "error") return "debugCorner" as const;
  if (status === "git") return "gitBoard" as const;
  if (status === "success" || status === "idle" || status === "stopped") return "lounge" as const;
  return categoryZones.coding;
}

function subagentRole(input: Record<string, unknown> = {}) {
  const text = `${input.subagent_type ?? ""} ${input.description ?? ""}`;
  for (const role of ["Research", "Review", "Test", "Documentation", "Code", "Plan"]) if (new RegExp(role, "i").test(text)) return `${role} Agent`;
  return "Task Agent";
}
