import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { cortexStorage } from "@/lib/storage/cortexStorage";

export type TerminalProfileId = "powershell" | "cmd" | "wsl-ubuntu";
export type SessionStatus = "inactive" | "running" | "waiting" | "completed" | "error";

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
  createdAt: string;
  updatedAt: string;
};

export type TerminalSession = {
  id: string;
  workspaceId: string;
  name: string;
  profileId: TerminalProfileId;
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
  renameWorkspace: (workspaceId: string, name: string) => void;
  setWorkspaceDefaultWorkingDirectory: (workspaceId: string, path: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  createSession: (workspaceId: string, profileId?: TerminalProfileId) => void;
  renameSession: (sessionId: string, name: string) => void;
  appendTerminalHistory: (sessionId: string, output: string) => void;
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
      status: "inactive",
      terminalHistory: trimTerminalHistory(session.terminalHistory ?? ""),
    })),
    templateInstances: state.templateInstances ?? [],
    layouts: (state.layouts ?? []).map((layout) => ({
      ...layout,
      activeItemId: layout.activeItemId ?? layout.activeSessionId,
      tabOrder: layout.tabOrder ?? [],
    })),
    workspaces: state.workspaces ?? [],
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
        createdAt: timestamp,
        updatedAt: timestamp,
      };

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
          },
        ],
        activeWorkspaceId: workspace.id,
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
      const session: TerminalSession = {
        id: createId("session"),
        workspaceId,
        name: sessionName(state.sessions, workspaceId),
        profileId,
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
                }
              : layout,
          )
        : [
            ...state.layouts,
            {
              workspaceId,
              activeSessionId: session.id,
              activeItemId: session.id,
              tabOrder: [session.id],
              splitPanePreview: true,
            },
          ];

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
          const activeItemId = layout.activeItemId ?? layout.activeSessionId;
          return {
            ...layout,
            tabOrder,
            activeSessionId:
              layout.activeSessionId === sessionId
                ? tabOrder[0] ?? null
                : layout.activeSessionId,
            activeItemId: activeItemId === sessionId ? tabOrder[0] ?? null : activeItemId,
          };
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
                }
              : layout,
          )
        : [
            ...state.layouts,
            {
              workspaceId,
              activeSessionId: null,
              activeItemId: instance.id,
              tabOrder: [instance.id],
              splitPanePreview: true,
            },
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
          const activeItemId = layout.activeItemId ?? layout.activeSessionId;
          return {
            ...layout,
            tabOrder,
            activeItemId:
              activeItemId === templateInstanceId ? tabOrder[0] ?? null : activeItemId,
          };
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
            ? { ...layout, activeSessionId: sessionId, activeItemId: sessionId }
            : layout,
        ),
      };
      saveState(next);
      return next;
    }),

  setActiveItem: (workspaceId, itemId) =>
    set((state) => {
      const next = {
        ...state,
        layouts: state.layouts.map((layout) =>
          layout.workspaceId === workspaceId ? { ...layout, activeItemId: itemId } : layout,
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
