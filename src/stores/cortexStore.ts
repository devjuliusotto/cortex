import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cortexStorage } from "@/lib/storage/cortexStorage";

export type TerminalProfileId = "powershell" | "cmd" | "wsl-ubuntu";
export type SessionStatus = "inactive" | "running" | "waiting" | "completed" | "error";
export type SplitDirection = "horizontal" | "vertical";

export type TerminalProfile = {
  id: TerminalProfileId;
  name: string;
  executable: string;
  args: string[];
};

export type Workspace = {
  id: string;
  name: string;
  defaultWorkingDirectory?: string;
  autoStartTerminalsOnOpen: boolean;
  color?: string;
  snippets: CommandSnippet[];
  createdAt: string;
  updatedAt: string;
};

export type CommandSnippet = {
  id: string;
  name: string;
  command: string;
  description?: string;
  profileId?: TerminalProfileId;
  createdAt: string;
  updatedAt: string;
};

export type TerminalSession = {
  id: string;
  workspaceId: string;
  name: string;
  profileId: TerminalProfileId;
  cwd?: string;
  status: SessionStatus;
  terminalHistory: string;
  createdAt: string;
  updatedAt: string;
};

export type TemplateKind = "note";
export type TemplateInstance = {
  id: string;
  workspaceId: string;
  templateId: string;
  kind: TemplateKind;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
};

export type WorkspaceLayout = {
  workspaceId: string;
  activeSessionId: string | null;
  activeItemId?: string | null;
  tabOrder: string[];
  splitPanePreview: boolean;
  paneTree: PaneNode;
  activePaneId: string;
};

export type PaneNode =
  | {
      id: string;
      type: "leaf";
      tabIds: string[];
      activeTabId: string | null;
    }
  | {
      id: string;
      type: "split";
      direction: SplitDirection;
      ratio: number;
      first: PaneNode;
      second: PaneNode;
    };

export type WindowState = {
  width: number;
  height: number;
  x: number | null;
  y: number | null;
  maximized: boolean;
};

export type UpdateCheckMode = "manual";

export type CortexSettings = {
  updateCheckMode: UpdateCheckMode;
};

export type CortexPersistedState = {
  version: 1;
  workspaces: Workspace[];
  sessions: TerminalSession[];
  templateInstances: TemplateInstance[];
  layouts: WorkspaceLayout[];
  settings: CortexSettings;
  activeWorkspaceId: string | null;
  windowState: WindowState | null;
};

type CortexState = CortexPersistedState & {
  profiles: TerminalProfile[];
  hydrated: boolean;
  hydrate: () => Promise<void>;
  createWorkspace: () => void;
  duplicateWorkspace: (workspaceId: string) => void;
  renameWorkspace: (workspaceId: string, name: string) => void;
  setWorkspaceDefaultWorkingDirectory: (workspaceId: string, path: string) => void;
  setWorkspaceAutoStartTerminalsOnOpen: (workspaceId: string, enabled: boolean) => void;
  setWorkspaceColor: (workspaceId: string, color: string | undefined) => void;
  createSnippet: (
    workspaceId: string,
    snippet: Pick<CommandSnippet, "name" | "command" | "description" | "profileId">,
  ) => void;
  updateSnippet: (
    workspaceId: string,
    snippetId: string,
    snippet: Pick<CommandSnippet, "name" | "command" | "description" | "profileId">,
  ) => void;
  deleteSnippet: (workspaceId: string, snippetId: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  createSession: (workspaceId: string, profileId?: TerminalProfileId) => void;
  duplicateSession: (sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  appendTerminalHistory: (sessionId: string, output: string) => void;
  clearTerminalHistory: (sessionId: string) => void;
  deleteSession: (sessionId: string) => void;
  createTemplateInstance: (
    workspaceId: string,
    template: Pick<TemplateInstance, "templateId" | "kind" | "title" | "content">,
  ) => void;
  renameTemplateInstance: (templateInstanceId: string, title: string) => void;
  updateTemplateInstanceContent: (templateInstanceId: string, content: string) => void;
  deleteTemplateInstance: (templateInstanceId: string) => void;
  setActiveSession: (workspaceId: string, sessionId: string) => void;
  setActiveItem: (workspaceId: string, itemId: string) => void;
  setActivePane: (workspaceId: string, paneId: string) => void;
  setActivePaneTab: (workspaceId: string, paneId: string, tabId: string) => void;
  moveTabToPane: (
    workspaceId: string,
    tabId: string,
    targetPaneId: string,
    targetIndex?: number,
  ) => void;
  splitActivePane: (workspaceId: string, direction: SplitDirection, moveActiveTab?: boolean) => void;
  closePane: (workspaceId: string, paneId: string) => void;
  resizePane: (workspaceId: string, paneId: string, ratio: number) => void;
  setSessionProfile: (sessionId: string, profileId: TerminalProfileId) => void;
  setSessionStatus: (sessionId: string, status: SessionStatus) => void;
  setSplitPanePreview: (workspaceId: string, visible: boolean) => void;
  saveNow: () => Promise<void>;
};

export const MAX_TERMINAL_HISTORY_LINES = 10_000;
export const MAX_TERMINAL_HISTORY_BYTES = 1_000_000;

const profiles: TerminalProfile[] = [
  {
    id: "powershell",
    name: "PowerShell",
    executable: "powershell.exe",
    args: ["-NoLogo"],
  },
  {
    id: "cmd",
    name: "CMD",
    executable: "cmd.exe",
    args: [],
  },
  {
    id: "wsl-ubuntu",
    name: "WSL Ubuntu",
    executable: "wsl.exe",
    args: ["-d", "Ubuntu"],
  },
];

const emptyState: CortexPersistedState = {
  version: 1,
  workspaces: [],
  sessions: [],
  templateInstances: [],
  layouts: [],
  settings: {
    updateCheckMode: "manual",
  },
  activeWorkspaceId: null,
  windowState: null,
};

let saveTimer: ReturnType<typeof setTimeout> | null = null;

function createId(prefix: string) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function now() {
  return new Date().toISOString();
}

function workspaceName(workspaces: Workspace[]) {
  return `Workspace ${workspaces.length + 1}`;
}

function sessionName(sessions: TerminalSession[], workspaceId: string) {
  const count = sessions.filter((session) => session.workspaceId === workspaceId).length;
  return `Terminal ${count + 1}`;
}

function createLeaf(tabIds: string[] = [], activeTabId: string | null = tabIds[0] ?? null): PaneNode {
  return {
    id: createId("pane"),
    type: "leaf",
    tabIds,
    activeTabId,
  };
}

function updatePaneNode(
  node: PaneNode,
  paneId: string,
  update: (node: PaneNode) => PaneNode,
): PaneNode {
  if (node.id === paneId) {
    return update(node);
  }

  if (node.type === "leaf") {
    return node;
  }

  return {
    ...node,
    first: updatePaneNode(node.first, paneId, update),
    second: updatePaneNode(node.second, paneId, update),
  };
}

function paneContains(node: PaneNode, paneId: string): boolean {
  if (node.id === paneId) {
    return true;
  }
  if (node.type === "leaf") {
    return false;
  }
  return paneContains(node.first, paneId) || paneContains(node.second, paneId);
}

function firstLeafId(node: PaneNode): string {
  return node.type === "leaf" ? node.id : firstLeafId(node.first);
}

function firstActiveTabId(node: PaneNode): string | null {
  if (node.type === "leaf") {
    return node.activeTabId ?? node.tabIds[0] ?? null;
  }
  return firstActiveTabId(node.first) ?? firstActiveTabId(node.second);
}

function removeTabFromPaneTree(node: PaneNode, tabId: string): PaneNode {
  if (node.type === "leaf") {
    const tabIds = node.tabIds.filter((id) => id !== tabId);
    return {
      ...node,
      tabIds,
      activeTabId: node.activeTabId === tabId ? tabIds[0] ?? null : node.activeTabId,
    };
  }

  return {
    ...node,
    first: removeTabFromPaneTree(node.first, tabId),
    second: removeTabFromPaneTree(node.second, tabId),
  };
}

function addTabToPaneTree(
  node: PaneNode,
  paneId: string,
  tabId: string,
  targetIndex?: number,
): PaneNode {
  const treeWithoutTab = removeTabFromPaneTree(node, tabId);
  return updatePaneNode(treeWithoutTab, paneId, (target) => {
    if (target.type !== "leaf") {
      return target;
    }

    const insertionIndex =
      targetIndex === undefined
        ? target.tabIds.length
        : Math.min(Math.max(targetIndex, 0), target.tabIds.length);
    const tabIds = [...target.tabIds];
    tabIds.splice(insertionIndex, 0, tabId);
    return {
      ...target,
      tabIds,
      activeTabId: tabId,
    };
  });
}

function removePaneNode(node: PaneNode, paneId: string): PaneNode | null {
  if (node.id === paneId) {
    return null;
  }
  if (node.type === "leaf") {
    return node;
  }

  const first = removePaneNode(node.first, paneId);
  const second = removePaneNode(node.second, paneId);
  if (!first) {
    return second;
  }
  if (!second) {
    return first;
  }
  return { ...node, first, second };
}

function normalizePaneTree(layout: Partial<WorkspaceLayout>): PaneNode {
  function normalizeNode(node: PaneNode): PaneNode {
    if (node.type === "split") {
      return {
        ...node,
        first: normalizeNode(node.first),
        second: normalizeNode(node.second),
      };
    }

    const legacyItemId = (node as unknown as { itemId?: string | null }).itemId;
    const tabIds = Array.isArray(node.tabIds)
      ? node.tabIds
      : legacyItemId
        ? [legacyItemId]
        : [];
    const activeTabId = node.activeTabId && tabIds.includes(node.activeTabId)
      ? node.activeTabId
      : tabIds[0] ?? null;
    return {
      id: node.id,
      type: "leaf",
      tabIds,
      activeTabId,
    };
  }

  if (layout.paneTree) {
    return normalizeNode(layout.paneTree);
  }
  const activeTabId = layout.activeItemId ?? layout.activeSessionId ?? null;
  return createLeaf(activeTabId ? [activeTabId] : [], activeTabId);
}

function syncLayoutActiveFields(
  layout: WorkspaceLayout,
  sessions: TerminalSession[],
): WorkspaceLayout {
  const activeItemId = firstActiveTabId(layout.paneTree);
  const activeSession = activeItemId
    ? sessions.find((session) => session.id === activeItemId)
    : undefined;
  const existingActiveSession = layout.activeSessionId
    ? sessions.find((session) => session.id === layout.activeSessionId)
    : undefined;
  return {
    ...layout,
    activeItemId,
    activeSessionId: activeSession?.id ?? existingActiveSession?.id ?? null,
  };
}

function trimTerminalHistory(history: string) {
  let trimmed = history;
  if (trimmed.length > MAX_TERMINAL_HISTORY_BYTES) {
    trimmed = trimmed.slice(trimmed.length - MAX_TERMINAL_HISTORY_BYTES);
  }

  const lines = trimmed.split(/\r\n|\n|\r/);
  if (lines.length > MAX_TERMINAL_HISTORY_LINES) {
    trimmed = lines.slice(lines.length - MAX_TERMINAL_HISTORY_LINES).join("\n");
  }

  return trimmed;
}

function persisted(state: CortexState): CortexPersistedState {
  return {
    version: 1,
    workspaces: state.workspaces,
    sessions: state.sessions.map((session) => ({
      ...session,
      status: "inactive",
      terminalHistory: trimTerminalHistory(session.terminalHistory),
    })),
    templateInstances: state.templateInstances,
    layouts: state.layouts,
    settings: state.settings,
    activeWorkspaceId: state.activeWorkspaceId,
    windowState: state.windowState,
  };
}

async function withCurrentWindowState(
  state: CortexPersistedState,
): Promise<CortexPersistedState> {
  if (typeof window === "undefined" || !("__TAURI_INTERNALS__" in window)) {
    return state;
  }

  try {
    const appWindow = getCurrentWindow();
    const [size, position, maximized] = await Promise.all([
      appWindow.outerSize(),
      appWindow.outerPosition().catch(() => null),
      appWindow.isMaximized(),
    ]);

    return {
      ...state,
      windowState: {
        width: size.width,
        height: size.height,
        x: position?.x ?? null,
        y: position?.y ?? null,
        maximized,
      },
    };
  } catch {
    return state;
  }
}

function normalizeLoadedState(state: CortexPersistedState): CortexPersistedState {
  return {
    ...emptyState,
    ...state,
    version: 1,
    sessions: (state.sessions ?? []).map((session) => ({
      ...session,
      cwd: session.cwd?.trim() || undefined,
      status: "inactive",
      terminalHistory: trimTerminalHistory(session.terminalHistory ?? ""),
    })),
    templateInstances: state.templateInstances ?? [],
    layouts: (state.layouts ?? []).map((layout) => {
      const paneTree = normalizePaneTree(layout);
      return {
        ...layout,
        activeItemId: layout.activeItemId ?? layout.activeSessionId,
        tabOrder: layout.tabOrder ?? [],
        splitPanePreview: layout.splitPanePreview ?? true,
        paneTree,
        activePaneId:
          layout.activePaneId && paneContains(paneTree, layout.activePaneId)
            ? layout.activePaneId
            : firstLeafId(paneTree),
      };
    }),
    workspaces: (state.workspaces ?? []).map((workspace) => ({
      ...workspace,
      defaultWorkingDirectory: workspace.defaultWorkingDirectory?.trim() || undefined,
      autoStartTerminalsOnOpen: workspace.autoStartTerminalsOnOpen ?? false,
      color: workspace.color?.trim() || undefined,
      snippets: (workspace.snippets ?? []).map((snippet) => ({
        ...snippet,
        description: snippet.description?.trim() || undefined,
        profileId: snippet.profileId || undefined,
      })),
    })),
    settings: {
      updateCheckMode: state.settings?.updateCheckMode ?? "manual",
    },
    activeWorkspaceId: state.activeWorkspaceId ?? null,
    windowState: state.windowState ?? null,
  };
}

function saveState(state: CortexState) {
  if (saveTimer) {
    clearTimeout(saveTimer);
  }

  saveTimer = setTimeout(() => {
    void saveStateNow(state);
  }, 300);
}

async function saveStateNow(state: CortexState) {
  if (saveTimer) {
    clearTimeout(saveTimer);
    saveTimer = null;
  }

  await cortexStorage.save(await withCurrentWindowState(persisted(state)));
}

export const useCortexStore = create<CortexState>((set) => ({
  ...emptyState,
  profiles,
  hydrated: false,

  hydrate: async () => {
    const savedState = await cortexStorage.load();
    set((state) => ({
      ...state,
      ...(savedState ? normalizeLoadedState(savedState) : emptyState),
      hydrated: true,
      profiles,
    }));
  },

  createWorkspace: () =>
    set((state) => {
      const timestamp = now();
      const workspace: Workspace = {
        id: createId("workspace"),
        name: workspaceName(state.workspaces),
        autoStartTerminalsOnOpen: false,
        snippets: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const paneTree = createLeaf();
      const next: CortexState = {
        ...state,
        workspaces: [...state.workspaces, workspace],
        layouts: [
          ...state.layouts,
          {
            workspaceId: workspace.id,
            activeSessionId: null,
            activeItemId: null,
            tabOrder: [],
            splitPanePreview: true,
            paneTree,
            activePaneId: paneTree.id,
          },
        ],
        activeWorkspaceId: workspace.id,
      };
      saveState(next);
      return next;
    }),

  duplicateWorkspace: (workspaceId) =>
    set((state) => {
      const source = state.workspaces.find((workspace) => workspace.id === workspaceId);
      if (!source) {
        return state;
      }

      const timestamp = now();
      const workspace: Workspace = {
        ...source,
        id: createId("workspace"),
        name: `${source.name} copy`,
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const paneTree = createLeaf();
      const next: CortexState = {
        ...state,
        workspaces: [...state.workspaces, workspace],
        layouts: [
          ...state.layouts,
          {
            workspaceId: workspace.id,
            activeSessionId: null,
            activeItemId: null,
            tabOrder: [],
            splitPanePreview: true,
            paneTree,
            activePaneId: paneTree.id,
          },
        ],
        activeWorkspaceId: workspace.id,
      };
      saveState(next);
      return next;
    }),

  setWorkspaceAutoStartTerminalsOnOpen: (workspaceId, enabled) =>
    set((state) => {
      const next = {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? { ...workspace, autoStartTerminalsOnOpen: enabled, updatedAt: now() }
            : workspace,
        ),
      };
      saveState(next);
      return next;
    }),

  setWorkspaceColor: (workspaceId, color) =>
    set((state) => {
      const cleanColor = color?.trim() || undefined;
      const next = {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? { ...workspace, color: cleanColor, updatedAt: now() }
            : workspace,
        ),
      };
      saveState(next);
      return next;
    }),

  createSnippet: (workspaceId, snippet) =>
    set((state) => {
      const cleanName = snippet.name.trim();
      const cleanCommand = snippet.command.trim();
      if (!cleanName || !cleanCommand) {
        return state;
      }

      const timestamp = now();
      const next = {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                snippets: [
                  ...(workspace.snippets ?? []),
                  {
                    id: createId("snippet"),
                    name: cleanName,
                    command: cleanCommand,
                    description: snippet.description?.trim() || undefined,
                    profileId: snippet.profileId || undefined,
                    createdAt: timestamp,
                    updatedAt: timestamp,
                  },
                ],
                updatedAt: timestamp,
              }
            : workspace,
        ),
      };
      saveState(next);
      return next;
    }),

  updateSnippet: (workspaceId, snippetId, snippet) =>
    set((state) => {
      const cleanName = snippet.name.trim();
      const cleanCommand = snippet.command.trim();
      if (!cleanName || !cleanCommand) {
        return state;
      }

      const timestamp = now();
      const next = {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                snippets: (workspace.snippets ?? []).map((item) =>
                  item.id === snippetId
                    ? {
                        ...item,
                        name: cleanName,
                        command: cleanCommand,
                        description: snippet.description?.trim() || undefined,
                        profileId: snippet.profileId || undefined,
                        updatedAt: timestamp,
                      }
                    : item,
                ),
                updatedAt: timestamp,
              }
            : workspace,
        ),
      };
      saveState(next);
      return next;
    }),

  deleteSnippet: (workspaceId, snippetId) =>
    set((state) => {
      const next = {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                snippets: (workspace.snippets ?? []).filter((snippet) => snippet.id !== snippetId),
                updatedAt: now(),
              }
            : workspace,
        ),
      };
      saveState(next);
      return next;
    }),

  renameWorkspace: (workspaceId, name) =>
    set((state) => {
      const cleanName = name.trim();
      if (!cleanName) {
        return state;
      }

      const next = {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? { ...workspace, name: cleanName, updatedAt: now() }
            : workspace,
        ),
      };
      saveState(next);
      return next;
    }),

  setWorkspaceDefaultWorkingDirectory: (workspaceId, path) =>
    set((state) => {
      const cleanPath = path.trim();
      const next = {
        ...state,
        workspaces: state.workspaces.map((workspace) =>
          workspace.id === workspaceId
            ? {
                ...workspace,
                defaultWorkingDirectory: cleanPath || undefined,
                updatedAt: now(),
              }
            : workspace,
        ),
      };
      saveState(next);
      return next;
    }),

  deleteWorkspace: (workspaceId) =>
    set((state) => {
      const workspaces = state.workspaces.filter((workspace) => workspace.id !== workspaceId);
      const nextActiveWorkspaceId =
        state.activeWorkspaceId === workspaceId
          ? workspaces[0]?.id ?? null
          : state.activeWorkspaceId;
      const next = {
        ...state,
        workspaces,
        sessions: state.sessions.filter((session) => session.workspaceId !== workspaceId),
        templateInstances: state.templateInstances.filter(
          (template) => template.workspaceId !== workspaceId,
        ),
        layouts: state.layouts.filter((layout) => layout.workspaceId !== workspaceId),
        activeWorkspaceId: nextActiveWorkspaceId,
      };
      saveState(next);
      return next;
    }),

  setActiveWorkspace: (workspaceId) =>
    set((state) => {
      const next = { ...state, activeWorkspaceId: workspaceId };
      saveState(next);
      return next;
    }),

  createSession: (workspaceId, profileId = "powershell") =>
    set((state) => {
      const timestamp = now();
      const workspace = state.workspaces.find((item) => item.id === workspaceId);
      const cwd = workspace?.defaultWorkingDirectory?.trim() || undefined;
      const session: TerminalSession = {
        id: createId("session"),
        workspaceId,
        name: sessionName(state.sessions, workspaceId),
        profileId,
        cwd,
        status: "running",
        terminalHistory: "",
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const layouts = state.layouts.some((layout) => layout.workspaceId === workspaceId)
        ? state.layouts.map((layout) =>
            layout.workspaceId === workspaceId
              ? {
                  ...layout,
                  activeSessionId: session.id,
                  activeItemId: session.id,
                  tabOrder: [...layout.tabOrder, session.id],
                  paneTree: addTabToPaneTree(layout.paneTree, layout.activePaneId, session.id),
                }
              : layout,
          )
        : [
            ...state.layouts,
            (() => {
              const paneTree = createLeaf([session.id], session.id);
              return {
                workspaceId,
                activeSessionId: session.id,
                activeItemId: session.id,
                tabOrder: [session.id],
                splitPanePreview: true,
                paneTree,
                activePaneId: paneTree.id,
              };
            })(),
          ];

      const next = {
        ...state,
        sessions: [...state.sessions, session],
        layouts,
      };
      saveState(next);
      return next;
    }),

  duplicateSession: (sessionId) =>
    set((state) => {
      const source = state.sessions.find((session) => session.id === sessionId);
      if (!source) {
        return state;
      }

      const timestamp = now();
      const session: TerminalSession = {
        ...source,
        id: createId("session"),
        name: `${source.name} copy`,
        status: "running",
        terminalHistory: source.terminalHistory,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const layouts = state.layouts.map((layout) =>
        layout.workspaceId === source.workspaceId
          ? {
              ...layout,
              activeSessionId: session.id,
              activeItemId: session.id,
              tabOrder: [...layout.tabOrder, session.id],
              paneTree: addTabToPaneTree(layout.paneTree, layout.activePaneId, session.id),
            }
          : layout,
      );

      const next = {
        ...state,
        sessions: [...state.sessions, session],
        layouts,
      };
      saveState(next);
      return next;
    }),

  renameSession: (sessionId, name) =>
    set((state) => {
      const cleanName = name.trim();
      if (!cleanName) {
        return state;
      }

      const next = {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, name: cleanName, updatedAt: now() }
            : session,
        ),
      };
      saveState(next);
      return next;
    }),

  appendTerminalHistory: (sessionId, output) =>
    set((state) => {
      if (!output) {
        return state;
      }

      const next = {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                terminalHistory: trimTerminalHistory(`${session.terminalHistory}${output}`),
                updatedAt: now(),
              }
            : session,
        ),
      };
      saveState(next);
      return next;
    }),

  clearTerminalHistory: (sessionId) =>
    set((state) => {
      const next = {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? {
                ...session,
                terminalHistory: "",
                updatedAt: now(),
              }
            : session,
        ),
      };
      saveState(next);
      return next;
    }),

  deleteSession: (sessionId) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === sessionId);
      const next = {
        ...state,
        sessions: state.sessions.filter((item) => item.id !== sessionId),
        layouts: state.layouts.map((layout) => {
          if (layout.workspaceId !== session?.workspaceId) {
            return layout;
          }

          const tabOrder = layout.tabOrder.filter((id) => id !== sessionId);
          const paneTree = removeTabFromPaneTree(layout.paneTree, sessionId);
          return syncLayoutActiveFields(
            {
              ...layout,
              tabOrder,
              activeSessionId:
                layout.activeSessionId === sessionId
                  ? tabOrder.find((id) => state.sessions.some((session) => session.id === id)) ?? null
                  : layout.activeSessionId,
              paneTree,
            },
            state.sessions.filter((item) => item.id !== sessionId),
          );
        }),
      };
      saveState(next);
      return next;
    }),

  createTemplateInstance: (workspaceId, template) =>
    set((state) => {
      const timestamp = now();
      const instance: TemplateInstance = {
        ...template,
        id: createId("template"),
        workspaceId,
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      const layouts = state.layouts.some((layout) => layout.workspaceId === workspaceId)
        ? state.layouts.map((layout) =>
            layout.workspaceId === workspaceId
              ? {
                  ...layout,
                  activeItemId: instance.id,
                  tabOrder: [...layout.tabOrder, instance.id],
                  paneTree: addTabToPaneTree(layout.paneTree, layout.activePaneId, instance.id),
                }
              : layout,
          )
        : [
            ...state.layouts,
            (() => {
              const paneTree = createLeaf([instance.id], instance.id);
              return {
                workspaceId,
                activeSessionId: null,
                activeItemId: instance.id,
                tabOrder: [instance.id],
                splitPanePreview: true,
                paneTree,
                activePaneId: paneTree.id,
              };
            })(),
          ];

      const next = {
        ...state,
        templateInstances: [...state.templateInstances, instance],
        layouts,
      };
      saveState(next);
      return next;
    }),

  renameTemplateInstance: (templateInstanceId, title) =>
    set((state) => {
      const cleanTitle = title.trim();
      if (!cleanTitle) {
        return state;
      }

      const next = {
        ...state,
        templateInstances: state.templateInstances.map((template) =>
          template.id === templateInstanceId
            ? { ...template, title: cleanTitle, updatedAt: now() }
            : template,
        ),
      };
      saveState(next);
      return next;
    }),

  updateTemplateInstanceContent: (templateInstanceId, content) =>
    set((state) => {
      const next = {
        ...state,
        templateInstances: state.templateInstances.map((template) =>
          template.id === templateInstanceId ? { ...template, content, updatedAt: now() } : template,
        ),
      };
      saveState(next);
      return next;
    }),

  deleteTemplateInstance: (templateInstanceId) =>
    set((state) => {
      const template = state.templateInstances.find((item) => item.id === templateInstanceId);
      const next = {
        ...state,
        templateInstances: state.templateInstances.filter((item) => item.id !== templateInstanceId),
        layouts: state.layouts.map((layout) => {
          if (layout.workspaceId !== template?.workspaceId) {
            return layout;
          }

          const tabOrder = layout.tabOrder.filter((id) => id !== templateInstanceId);
          const paneTree = removeTabFromPaneTree(layout.paneTree, templateInstanceId);
          return syncLayoutActiveFields(
            {
              ...layout,
              tabOrder,
              paneTree,
            },
            state.sessions,
          );
        }),
      };
      saveState(next);
      return next;
    }),

  setActiveSession: (workspaceId, sessionId) =>
    set((state) => {
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId
            ? {
                ...layout,
                activeSessionId: sessionId,
                activeItemId: sessionId,
                paneTree: updatePaneNode(layout.paneTree, layout.activePaneId, (node) =>
                  node.type === "leaf"
                    ? {
                        ...node,
                        tabIds: node.tabIds.includes(sessionId)
                          ? node.tabIds
                          : [...node.tabIds, sessionId],
                        activeTabId: sessionId,
                      }
                    : node,
                ),
              }
            : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  setActiveItem: (workspaceId, itemId) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === itemId);
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId
            ? {
                ...layout,
                activeItemId: itemId,
                activeSessionId: session ? itemId : layout.activeSessionId,
                paneTree: addTabToPaneTree(layout.paneTree, layout.activePaneId, itemId),
              }
            : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  setActivePane: (workspaceId, paneId) =>
    set((state) => {
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId ? { ...layout, activePaneId: paneId } : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  setActivePaneTab: (workspaceId, paneId, tabId) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === tabId);
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId
            ? {
                ...layout,
                activePaneId: paneId,
                activeItemId: tabId,
                activeSessionId: session ? tabId : layout.activeSessionId,
                paneTree: updatePaneNode(layout.paneTree, paneId, (node) =>
                  node.type === "leaf" && node.tabIds.includes(tabId)
                    ? { ...node, activeTabId: tabId }
                    : node,
                ),
              }
            : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  moveTabToPane: (workspaceId, tabId, targetPaneId, targetIndex) =>
    set((state) => {
      const session = state.sessions.find((item) => item.id === tabId);
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId
            ? {
                ...layout,
                activePaneId: targetPaneId,
                activeItemId: tabId,
                activeSessionId: session ? tabId : layout.activeSessionId,
                paneTree: addTabToPaneTree(layout.paneTree, targetPaneId, tabId, targetIndex),
              }
            : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  splitActivePane: (workspaceId, direction, moveActiveTab = false) =>
    set((state) => {
      const next = {
        ...state,
        layouts: state.layouts.map((layout) => {
          if (layout.workspaceId !== workspaceId) {
            return layout;
          }

          const activeTabId = firstActiveTabId(layout.paneTree);
          const newLeaf = createLeaf(moveActiveTab && activeTabId ? [activeTabId] : []);
          return {
            ...layout,
            activePaneId: newLeaf.id,
            paneTree: updatePaneNode(
              moveActiveTab && activeTabId
                ? removeTabFromPaneTree(layout.paneTree, activeTabId)
                : layout.paneTree,
              layout.activePaneId,
              (node) =>
                node.type === "leaf"
                  ? {
                      id: createId("pane-split"),
                      type: "split",
                      direction,
                      ratio: 0.5,
                      first: node,
                      second: newLeaf,
                    }
                  : node,
            ),
          };
        }),
      };
      saveState(next);
      return next;
    }),

  closePane: (workspaceId, paneId) =>
    set((state) => {
      const next = {
        ...state,
        layouts: state.layouts.map((layout) => {
          if (layout.workspaceId !== workspaceId) {
            return layout;
          }
          const paneTree = removePaneNode(layout.paneTree, paneId) ?? createLeaf();
          return syncLayoutActiveFields(
            {
              ...layout,
              paneTree,
              activePaneId: firstLeafId(paneTree),
            },
            state.sessions,
          );
        }),
      };
      saveState(next);
      return next;
    }),

  resizePane: (workspaceId, paneId, ratio) =>
    set((state) => {
      const clamped = Math.min(0.8, Math.max(0.2, ratio));
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId
            ? {
                ...layout,
                paneTree: updatePaneNode(layout.paneTree, paneId, (node) =>
                  node.type === "split" ? { ...node, ratio: clamped } : node,
                ),
              }
            : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  setSessionProfile: (sessionId, profileId) =>
    set((state) => {
      const next = {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId
            ? { ...session, profileId, status: "running" as const, updatedAt: now() }
            : session,
        ),
      };
      saveState(next);
      return next;
    }),

  setSessionStatus: (sessionId, status) =>
    set((state) => {
      const existing = state.sessions.find((session) => session.id === sessionId);
      if (existing?.status === status) {
        return state;
      }

      const next = {
        ...state,
        sessions: state.sessions.map((session) =>
          session.id === sessionId ? { ...session, status, updatedAt: now() } : session,
        ),
      };
      saveState(next);
      return next;
    }),

  setSplitPanePreview: (workspaceId, visible) =>
    set((state) => {
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId
            ? { ...layout, splitPanePreview: visible }
            : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  saveNow: async () => {
    await saveStateNow(useCortexStore.getState());
  },
}));
