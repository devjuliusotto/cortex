import { check } from "@tauri-apps/plugin-updater";
import { invoke } from "@tauri-apps/api/core";
import {
  useCortexStore,
  type CustomCommand,
  type TerminalProfileId,
  type Workspace,
} from "@/stores/cortexStore";
import { commandForShell, focusTerminal, writeTerminal } from "@/features/terminal/terminalBridge";

export type InternalCommandId =
  | "workspace.open"
  | "workspace.rename"
  | "workspace.setDefaultPath"
  | "terminal.new"
  | "terminal.sendText"
  | "pane.splitRight"
  | "pane.splitDown"
  | "note.new"
  | "browser.open"
  | "settings.open"
  | "commandHistory.open"
  | "updates.check"
  | "github.releases.open"
  | "customCommand.run";

export type CommandContext = {
  workspaceId: string | null;
  openSettings?: () => void;
};

export type CommandAction =
  | { id: "workspace.open" }
  | { id: "workspace.rename" }
  | { id: "workspace.setDefaultPath" }
  | { id: "terminal.new"; profileId?: TerminalProfileId }
  | { id: "terminal.sendText"; text: string; runImmediately?: boolean }
  | { id: "pane.splitRight" }
  | { id: "pane.splitDown" }
  | { id: "note.new" }
  | { id: "browser.open"; url?: string }
  | { id: "settings.open" }
  | { id: "commandHistory.open" }
  | { id: "updates.check" }
  | { id: "github.releases.open" }
  | { id: "customCommand.run"; command: CustomCommand };

export async function dispatchCommand(action: CommandAction, context: CommandContext) {
  const state = useCortexStore.getState();
  const workspaceId = context.workspaceId ?? state.activeWorkspaceId;
  const workspace = workspaceId
    ? state.workspaces.find((item) => item.id === workspaceId)
    : undefined;

  switch (action.id) {
    case "workspace.open":
      state.createWorkspace();
      return;
    case "workspace.rename":
      if (workspace) {
        const name = window.prompt("Workspace name", workspace.name);
        if (name) {
          state.renameWorkspace(workspace.id, name);
        }
      }
      return;
    case "workspace.setDefaultPath":
      if (workspace) {
        const path = window.prompt("Workspace default terminal path", workspace.defaultWorkingDirectory ?? "");
        if (path !== null) {
          state.setWorkspaceDefaultWorkingDirectory(workspace.id, path);
        }
      }
      return;
    case "terminal.new":
      if (workspaceId) {
        state.createSession(workspaceId, action.profileId);
      }
      return;
    case "terminal.sendText":
      await sendToActiveTerminal(action.text, action.runImmediately ?? false);
      return;
    case "pane.splitRight":
      if (workspaceId) {
        state.splitActivePane(workspaceId, "horizontal");
      }
      return;
    case "pane.splitDown":
      if (workspaceId) {
        state.splitActivePane(workspaceId, "vertical");
      }
      return;
    case "note.new":
      if (workspaceId) {
        state.createTemplateInstance(workspaceId, {
          templateId: "workspace-note",
          kind: "note",
          title: "Untitled note",
          content: "",
        });
      }
      return;
    case "browser.open":
      if (workspaceId) {
        state.createBrowserTab(workspaceId, action.url);
      }
      return;
    case "settings.open":
      context.openSettings?.();
      return;
    case "commandHistory.open":
      if (workspaceId) {
        const existing = state.templateInstances.find(
          (item) => item.workspaceId === workspaceId && item.kind === "command-history",
        );
        if (existing) {
          const layout = state.layouts.find((item) => item.workspaceId === workspaceId);
          state.setActivePaneTab(workspaceId, layout?.activePaneId ?? "", existing.id);
          return;
        }
        state.createTemplateInstance(workspaceId, {
          templateId: "command-history",
          kind: "command-history",
          title: "Command History",
          content: "",
        });
      }
      return;
    case "updates.check":
      await check().then((update) => {
        window.alert(update ? `Cortex ${update.version} is available.` : "Cortex is up to date.");
      });
      return;
    case "github.releases.open":
      await openExternal("https://github.com/devjuliusotto/cortex/releases");
      return;
    case "customCommand.run":
      await runCustomCommand(action.command, workspace);
      return;
  }
}

async function sendToActiveTerminal(text: string, runImmediately: boolean) {
  const state = useCortexStore.getState();
  const layout = state.activeWorkspaceId
    ? state.layouts.find((item) => item.workspaceId === state.activeWorkspaceId)
    : undefined;
  const terminalId = layout?.activeSessionId;
  if (!terminalId) {
    return;
  }

  await writeTerminal(terminalId, commandForShell(text, runImmediately));
  focusTerminal(terminalId);
}

async function runCustomCommand(command: CustomCommand, workspace?: Workspace) {
  const state = useCortexStore.getState();
  const layout = workspace
    ? state.layouts.find((item) => item.workspaceId === workspace.id)
    : undefined;
  const activeSessionId = layout?.activeSessionId ?? null;
  const text = commandForShell(command.command, command.runBehavior !== "paste");

  if (command.runBehavior === "new-terminal-run" && workspace) {
    state.createSession(workspace.id, command.profileId);
    window.setTimeout(() => {
      const nextState = useCortexStore.getState();
      const nextLayout = nextState.layouts.find((item) => item.workspaceId === workspace.id);
      const nextSessionId = nextLayout?.activeSessionId;
      if (nextSessionId) {
        void writeTerminal(nextSessionId, text);
      }
    }, 350);
    return;
  }

  if (activeSessionId) {
    await writeTerminal(activeSessionId, text);
    focusTerminal(activeSessionId);
  }
}

async function openExternal(url: string) {
  await invoke("open_external_url", { url }).catch(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  });
}
