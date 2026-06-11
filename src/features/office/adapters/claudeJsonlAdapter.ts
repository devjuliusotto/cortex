import { invoke } from "@tauri-apps/api/core";
import { compactOfficeText } from "../officeDetection";
import type {
  AgentActivity,
  AgentDescriptor,
  AgentEvent,
  AgentEventEnvelope,
  AgentLocation,
  OfficeActivityAdapter,
  OfficeAdapterInput,
} from "../officeTypes";

type ClaudeTranscriptSnapshot = {
  workspaceId: string;
  sessionId: string;
  path: string;
  modifiedAt: number;
  lines: string[];
  isSubagent: boolean;
  parentSessionId?: string;
};
type ToolUse = { id?: string; name?: string; input?: Record<string, unknown> };

const ACTIVE_MAX_AGE_MS = 10 * 60_000;

export const claudeJsonlAdapter: OfficeActivityAdapter = {
  id: "claude-jsonl",
  source: "structured",
  async detectEvents(input) {
    if (!("__TAURI_INTERNALS__" in window)) return [];
    const workspacePaths = input.workspaces
      .filter((workspace) => input.scope === "allWorkspaces" || workspace.id === input.currentWorkspaceId)
      .map((workspace) => ({
        workspaceId: workspace.id,
        path: workspace.defaultWorkingDirectory ?? input.sessions.find((session) => session.workspaceId === workspace.id)?.cwd,
      }))
      .filter((workspace): workspace is { workspaceId: string; path: string } => Boolean(workspace.path));
    if (workspacePaths.length === 0) return [];
    try {
      const snapshots = await invoke<ClaudeTranscriptSnapshot[]>("office_read_claude_transcripts", { workspacePaths });
      const events = snapshots
        .filter((snapshot) => Date.now() - snapshot.modifiedAt <= ACTIVE_MAX_AGE_MS)
        .flatMap((snapshot) => parseSnapshot(snapshot, input));
      const parentsWithTranscriptSubagents = new Set(
        events
          .filter((item) => item.agent.isSubagent && !item.agent.id.includes(":task:") && item.agent.parentAgentId)
          .map((item) => item.agent.parentAgentId as string),
      );
      return events.filter((item) =>
        !item.agent.id.includes(":task:") || !item.agent.parentAgentId || !parentsWithTranscriptSubagents.has(item.agent.parentAgentId),
      );
    } catch (error) {
      console.warn("Claude structured event detection unavailable", error);
      return [];
    }
  },
};

function parseSnapshot(snapshot: ClaudeTranscriptSnapshot, input: OfficeAdapterInput): AgentEventEnvelope[] {
  const workspace = input.workspaces.find((item) => item.id === snapshot.workspaceId);
  if (!workspace) return [];
  const activeTools = new Map<string, ToolUse>();
  const subagentTools = new Map<string, ToolUse>();
  let latestText = "Claude is working";
  let currentGoal: string | undefined;
  let latestFinishedTool: string | undefined;
  let approvalRequested = false;
  let turnEnded = false;

  for (const line of snapshot.lines) {
    let record: Record<string, any>;
    try { record = JSON.parse(line); } catch { continue; }
    if (/permission|approval/i.test(`${record.type ?? ""} ${record.subtype ?? ""}`)) approvalRequested = true;
    const content = record.message?.content ?? record.content;
    if (record.type === "assistant" && Array.isArray(content)) {
      approvalRequested = false;
      turnEnded = false;
      for (const block of content) {
        if (block.type === "text" && typeof block.text === "string") latestText = compactOfficeText(block.text, 80);
        if (block.type === "tool_use" && block.id) {
          const tool = block as ToolUse;
          activeTools.set(block.id, tool);
          if (tool.name === "Task" || tool.name === "Agent") subagentTools.set(block.id, tool);
        }
      }
    } else if (record.type === "user") {
      if (typeof content === "string") currentGoal = compactOfficeText(content, 80);
      if (Array.isArray(content)) {
        for (const block of content) {
          if (block.type === "text" && typeof block.text === "string") currentGoal = compactOfficeText(block.text, 80);
          if (block.type === "tool_result" && block.tool_use_id) {
            approvalRequested = false;
            latestFinishedTool = activeTools.get(block.tool_use_id)?.name;
            activeTools.delete(block.tool_use_id);
            subagentTools.delete(block.tool_use_id);
          }
        }
      }
    } else if (record.type === "system" && record.subtype === "turn_duration") {
      approvalRequested = false;
      turnEnded = true;
      activeTools.clear();
      subagentTools.clear();
    } else if (record.type === "progress") {
      const parentId = record.parentToolUseID;
      const inner = record.data?.message?.message?.content;
      if (parentId && Array.isArray(inner)) {
        for (const block of inner) if (block.type === "tool_use") subagentTools.set(parentId, block);
      }
    }
  }

  const terminal = findClaudeTerminal(snapshot.workspaceId, input);
  const mainId = `claude-jsonl:${snapshot.sessionId}`;
  const descriptor = descriptorFor(snapshot, workspace.name, terminal?.id);
  const latestTool = [...activeTools.values()].at(-1);
  const mainEvent = eventForClaude(latestTool, latestFinishedTool, latestText, turnEnded, approvalRequested);
  const events: AgentEventEnvelope[] = [envelopeFor({
    snapshot,
    descriptor,
    event: mainEvent.event,
    activity: mainEvent.activity,
    location: mainEvent.location,
    detail: mainEvent.detail,
    toolName: mainEvent.toolName,
    currentGoal,
    suffix: mainEvent.toolName ?? mainEvent.event.type,
  })];

  if (!snapshot.isSubagent) {
    for (const [toolId, tool] of subagentTools) {
      const childGoal = compactOfficeText(String(tool.input?.description ?? tool.input?.prompt ?? "Delegated task"), 80);
      const childDescriptor: AgentDescriptor = {
        ...descriptor,
        id: `${mainId}:task:${toolId}`,
        name: "Claude Subagent",
        role: subagentRole(tool.input),
        parentAgentId: mainId,
        isSubagent: true,
      };
      const child = eventForTool(tool.name ?? "Task", tool.input);
      events.push(envelopeFor({
        snapshot,
        descriptor: childDescriptor,
        event: { type: "task.started" },
        activity: child.activity,
        location: child.location,
        detail: child.detail,
        toolName: tool.name,
        currentGoal: childGoal,
        suffix: `subagent:${toolId}`,
      }));
    }
  }
  return events;
}

function envelopeFor(input: {
  snapshot: ClaudeTranscriptSnapshot;
  descriptor: AgentDescriptor;
  event: AgentEvent;
  activity: AgentActivity;
  location: AgentLocation;
  detail: string;
  toolName?: string;
  currentGoal?: string;
  suffix: string;
}): AgentEventEnvelope {
  return {
    id: `claude:${input.snapshot.sessionId}:${input.snapshot.modifiedAt}:${input.suffix}`,
    timestamp: input.snapshot.modifiedAt,
    source: "structured",
    confidence: 0.96,
    agent: input.descriptor,
    event: input.event,
    activity: input.activity,
    location: input.location,
    currentGoal: input.currentGoal,
    detail: input.detail,
    toolName: input.toolName,
  };
}

function eventForClaude(activeTool: ToolUse | undefined, finishedTool: string | undefined, text: string, turnEnded: boolean, approvalRequested: boolean): {
  event: AgentEvent;
  activity: AgentActivity;
  location: AgentLocation;
  detail: string;
  toolName?: string;
} {
  if (approvalRequested) {
    return { event: { type: "approval.requested" }, activity: "waiting_approval", location: "desk", detail: "Waiting for tool approval" };
  }
  if (activeTool?.name === "AskUserQuestion") {
    return { event: { type: "input.requested" } as AgentEvent, activity: "waiting_input" as const, location: "meeting" as const, detail: "Waiting for your answer", toolName: activeTool.name };
  }
  if (activeTool?.name) {
    const tool = eventForTool(activeTool.name, activeTool.input);
    return { event: { type: "tool.started", tool: activeTool.name } as AgentEvent, ...tool, toolName: activeTool.name };
  }
  if (turnEnded) {
    return { event: { type: "task.completed" } as AgentEvent, activity: "completed" as const, location: "lounge" as const, detail: text };
  }
  if (finishedTool) {
    return { event: { type: "tool.finished", tool: finishedTool } as AgentEvent, activity: "reviewing" as const, location: "desk" as const, detail: `Finished ${finishedTool}`, toolName: finishedTool };
  }
  return { event: { type: "message.generated" } as AgentEvent, activity: "reviewing" as const, location: "desk" as const, detail: text };
}

function eventForTool(toolName: string, input: Record<string, unknown> = {}): { activity: AgentActivity; location: AgentLocation; detail: string } {
  const file = typeof input.file_path === "string" ? input.file_path.split(/[\\/]/).at(-1) : "";
  if (["Read", "Glob", "Grep", "WebFetch", "WebSearch"].includes(toolName)) {
    return { activity: "researching", location: "library", detail: file ? `Reading ${file}` : `Using ${toolName}` };
  }
  if (["Edit", "MultiEdit", "Write", "NotebookEdit", "apply_patch"].includes(toolName)) {
    return { activity: "coding", location: "desk", detail: file ? `Editing ${file}` : `Using ${toolName}` };
  }
  if (toolName === "Bash") {
    const command = compactOfficeText(String(input.command ?? "command"), 58);
    const buildLike = /\b(build|test|lint|typecheck|check|compile|cargo|npm|pnpm|yarn)\b/i.test(command);
    return { activity: buildLike ? "reviewing" : "coding", location: buildLike ? "buildlab" : "desk", detail: `Running ${command}` };
  }
  if (toolName === "Task" || toolName === "Agent") {
    return { activity: "reviewing", location: "meeting", detail: compactOfficeText(`Delegating ${String(input.description ?? "task")}`, 58) };
  }
  return { activity: "reviewing", location: "desk", detail: `Using ${toolName}` };
}

function descriptorFor(snapshot: ClaudeTranscriptSnapshot, workspaceName: string, terminalId?: string): AgentDescriptor {
  return {
    id: `claude-jsonl:${snapshot.sessionId}`,
    provider: "claude",
    name: snapshot.isSubagent ? "Claude Subagent" : "Claude",
    role: snapshot.isSubagent ? "Claude Task Agent" : "Claude Code Agent",
    terminalId,
    workspaceId: snapshot.workspaceId,
    workspaceName,
    workspaceShortName: workspaceName.length > 14 ? `${workspaceName.slice(0, 13)}...` : workspaceName,
    parentAgentId: snapshot.parentSessionId ? `claude-jsonl:${snapshot.parentSessionId}` : undefined,
    isSubagent: snapshot.isSubagent,
  };
}

function findClaudeTerminal(workspaceId: string, input: OfficeAdapterInput) {
  return input.sessions.find((session) => session.workspaceId === workspaceId && /claude/i.test(`${session.name}\n${session.terminalHistory.slice(-1000)}`));
}

function subagentRole(input: Record<string, unknown> = {}) {
  const text = `${input.subagent_type ?? ""} ${input.description ?? ""}`;
  for (const role of ["Research", "Review", "Test", "Documentation", "Code", "Plan"]) {
    if (new RegExp(role, "i").test(text)) return `${role} Agent`;
  }
  return "Task Agent";
}
