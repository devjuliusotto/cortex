import { create } from "zustand";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  MAX_COMMAND_HISTORY_PER_WORKSPACE,
  normalizeCommandForHistory,
  shouldStoreCommand,
  type CommandHistoryDraft,
  type CommandHistoryEntry,
} from "@/features/terminal/commandHistory";
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

export type SavedCommand = {
  id: string;
  title: string;
  description?: string;
  command: string;
  category?: string;
  privateLocal?: boolean;
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

export type TemplateKind = "note" | "command-history" | "git-map";
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

export type UpdateCheckMode = "automatic" | "manual";

export type CortexSettings = {
  updateCheckMode: UpdateCheckMode;
};

export type CortexPersistedState = {
  version: 1;
  workspaces: Workspace[];
  sessions: TerminalSession[];
  commandHistory: CommandHistoryEntry[];
  savedCommands: SavedCommand[];
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
  createMarketingModeDemo: () => void;
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
  createSavedCommand: (
    command: Pick<SavedCommand, "title" | "description" | "command" | "category" | "privateLocal">,
  ) => void;
  updateSavedCommand: (
    commandId: string,
    command: Pick<SavedCommand, "title" | "description" | "command" | "category" | "privateLocal">,
  ) => void;
  deleteSavedCommand: (commandId: string) => void;
  deleteWorkspace: (workspaceId: string) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  createSession: (workspaceId: string, profileId?: TerminalProfileId) => void;
  duplicateSession: (sessionId: string) => void;
  renameSession: (sessionId: string, name: string) => void;
  addCommandHistoryEntry: (entry: CommandHistoryDraft) => void;
  deleteCommandHistoryEntry: (entryId: string) => void;
  clearCommandHistory: (workspaceId: string) => void;
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
  commandHistory: [],
  savedCommands: [],
  templateInstances: [],
  layouts: [],
  settings: {
    updateCheckMode: "automatic",
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

function createStandardWorkspaceItems(workspaceId: string, timestamp: string) {
  const terminalId = createId("session");
  const commandHistoryId = createId("template");
  const gitMapId = createId("template");
  const noteId = createId("template");
  const leftPane = createLeaf([terminalId], terminalId);
  const rightPane = createLeaf([gitMapId, commandHistoryId, noteId], gitMapId);

  const session: TerminalSession = {
    id: terminalId,
    workspaceId,
    name: "PowerShell",
    profileId: "powershell",
    status: "running",
    terminalHistory: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const commandHistory: TemplateInstance = {
    id: commandHistoryId,
    workspaceId,
    templateId: "command-history",
    kind: "command-history",
    title: "Command History",
    content: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const gitMap: TemplateInstance = {
    id: gitMapId,
    workspaceId,
    templateId: "git-map",
    kind: "git-map",
    title: "Git Map",
    content: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const note: TemplateInstance = {
    id: noteId,
    workspaceId,
    templateId: "workspace-note",
    kind: "note",
    title: "Notes",
    content: "",
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const paneTree: PaneNode = {
    id: createId("pane-split"),
    type: "split",
    direction: "horizontal",
    ratio: 0.58,
    first: leftPane,
    second: rightPane,
  };

  return {
    session,
    templates: [gitMap, commandHistory, note],
    layout: {
      workspaceId,
      activeSessionId: terminalId,
      activeItemId: terminalId,
      tabOrder: [terminalId, gitMapId, commandHistoryId, noteId],
      splitPanePreview: true,
      paneTree,
      activePaneId: leftPane.id,
    } satisfies WorkspaceLayout,
  };
}

type DemoGitSnapshot = {
  overview: {
    isRepo: true;
    root: string;
    currentBranch: string;
    remoteName: string;
    remoteUrl: string;
    clean: boolean;
    modifiedCount: number;
    stagedCount: number;
    untrackedCount: number;
    ahead: number;
    behind: number;
    latestCommit: {
      hash: string;
      shortHash: string;
      message: string;
      author: string;
      date: string;
      files: string[];
    };
    refreshedAt: string;
  };
  status: {
    isRepo: true;
    root: string;
    files: Array<{
      path: string;
      originalPath: string | null;
      status: string;
      staged: boolean;
    }>;
    stagedCount: number;
    modifiedCount: number;
    untrackedCount: number;
  };
  history: Array<{
    hash: string;
    shortHash: string;
    message: string;
    author: string;
    date: string;
    files: string[];
  }>;
  branches: {
    isRepo: true;
    currentBranch: string;
    dirty: boolean;
    local: Array<{
      name: string;
      isCurrent: boolean;
      isRemote: boolean;
      upstream: string | null;
      lastCommit: string;
    }>;
    remote: Array<{
      name: string;
      isCurrent: boolean;
      isRemote: boolean;
      upstream: string | null;
      lastCommit: string;
    }>;
  };
  releaseInfo: {
    isRepo: true;
    currentBranch: string;
    clean: boolean;
    packageVersion: string;
    tauriVersion: string;
    cargoVersion: string;
    latestTag: string;
  };
};

function isoMinutesAgo(minutes: number) {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

function demoTerminalHistory(project: string, branch: string) {
  return [
    `PS C:\\Projects\\${project}> git status --short --branch`,
    `## ${branch}...origin/${branch} [ahead 2]`,
    " M src/features/dashboard/ActivityFeed.tsx",
    " M src/styles.css",
    "?? docs/screenshot-checklist.md",
    "",
    `PS C:\\Projects\\${project}> npm run build`,
    "",
    "> cortex-demo@0.4.0 build",
    "> tsc && vite build",
    "",
    "vite v6.4.2 building for production...",
    "✓ 2148 modules transformed.",
    "✓ built in 4.88s",
    "",
    `PS C:\\Projects\\${project}> git add src docs`,
    `PS C:\\Projects\\${project}> git commit -m "Polish screenshot workflow"`,
    `[${branch} 8f42c91] Polish screenshot workflow`,
    " 3 files changed, 128 insertions(+), 14 deletions(-)",
    "",
  ].join("\r\n");
}

function demoGitSnapshot(project: string, branch: string, remote: string): DemoGitSnapshot {
  const root = `C:\\Projects\\${project}`;
  const history = [
    {
      hash: "8f42c91d7c2a9ef9d84755e32e74b21de190a411",
      shortHash: "8f42c91",
      message: "Polish screenshot workflow",
      author: "Julius Otto",
      date: isoMinutesAgo(18),
      files: ["src/features/dashboard/ActivityFeed.tsx", "docs/screenshot-checklist.md"],
    },
    {
      hash: "51d0c24b2d0679770e72166bbdbf73441c231aef",
      shortHash: "51d0c24",
      message: "Add marketing capture workspace",
      author: "Julius Otto",
      date: isoMinutesAgo(74),
      files: ["src/stores/cortexStore.ts", "src/features/git/GitMapPanel.tsx"],
    },
    {
      hash: "f14ac7c8e57a420de46ddf4498cfb82bf7b1904a",
      shortHash: "f14ac7c",
      message: "Tune command palette copy",
      author: "Mira Chen",
      date: isoMinutesAgo(165),
      files: ["src/features/command-palette/components/CommandPalette.tsx"],
    },
    {
      hash: "b8a6e3fce5428bb39c2942034ff0725a55c99ab1",
      shortHash: "b8a6e3f",
      message: "Create release checklist notes",
      author: "Julius Otto",
      date: isoMinutesAgo(260),
      files: ["docs/release-checklist.md", "src/features/git/GitReleasesTab.tsx"],
    },
  ];
  const files = [
    { path: "src/features/dashboard/ActivityFeed.tsx", originalPath: null, status: "Modified", staged: true },
    { path: "src/styles.css", originalPath: null, status: "Modified", staged: false },
    { path: "docs/screenshot-checklist.md", originalPath: null, status: "Untracked", staged: false },
  ];
  return {
    overview: {
      isRepo: true,
      root,
      currentBranch: branch,
      remoteName: "origin",
      remoteUrl: remote,
      clean: false,
      modifiedCount: 1,
      stagedCount: 1,
      untrackedCount: 1,
      ahead: 2,
      behind: 0,
      latestCommit: history[0],
      refreshedAt: String(Math.floor(Date.now() / 1000)),
    },
    status: {
      isRepo: true,
      root,
      files,
      stagedCount: 1,
      modifiedCount: 1,
      untrackedCount: 1,
    },
    history,
    branches: {
      isRepo: true,
      currentBranch: branch,
      dirty: true,
      local: [
        { name: branch, isCurrent: true, isRemote: false, upstream: `origin/${branch}`, lastCommit: history[0].message },
        { name: "main", isCurrent: false, isRemote: false, upstream: "origin/main", lastCommit: "Release v0.4.0" },
        { name: "feature/onboarding", isCurrent: false, isRemote: false, upstream: null, lastCommit: "Improve empty workspace setup" },
      ],
      remote: [
        { name: `origin/${branch}`, isCurrent: false, isRemote: true, upstream: null, lastCommit: history[0].message },
        { name: "origin/main", isCurrent: false, isRemote: true, upstream: null, lastCommit: "Release v0.4.0" },
      ],
    },
    releaseInfo: {
      isRepo: true,
      currentBranch: branch,
      clean: false,
      packageVersion: "0.4.0",
      tauriVersion: "0.4.0",
      cargoVersion: "0.4.0",
      latestTag: "v0.4.0",
    },
  };
}

function createMarketingWorkspace(
  name: string,
  project: string,
  branch: string,
  remote: string,
  note: string,
  timestamp: string,
) {
  const workspaceId = createId("workspace");
  const terminalId = createId("session");
  const gitMapId = createId("template");
  const commandHistoryId = createId("template");
  const noteId = createId("template");
  const leftPane = createLeaf([terminalId], terminalId);
  const rightPane = createLeaf([gitMapId, commandHistoryId, noteId], gitMapId);
  const root = `C:\\Projects\\${project}`;

  const workspace: Workspace = {
    id: workspaceId,
    name: `Marketing · ${name}`,
    defaultWorkingDirectory: root,
    autoStartTerminalsOnOpen: false,
    color: "#8b5cf6",
    snippets: [
      {
        id: createId("snippet"),
        name: "Capture build",
        command: "npm run build && git status --short",
        description: "Screenshot-ready build verification",
        profileId: "powershell",
        createdAt: timestamp,
        updatedAt: timestamp,
      },
    ],
    createdAt: timestamp,
    updatedAt: timestamp,
  };

  const sessions: TerminalSession[] = [
    {
      id: terminalId,
      workspaceId,
      name: "Demo Terminal",
      profileId: "powershell",
      cwd: root,
      status: "completed",
      terminalHistory: demoTerminalHistory(project, branch),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const templates: TemplateInstance[] = [
    {
      id: gitMapId,
      workspaceId,
      templateId: "git-map",
      kind: "git-map",
      title: "Git Map",
      content: JSON.stringify({ marketingDemo: true, ...demoGitSnapshot(project, branch, remote) }),
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: commandHistoryId,
      workspaceId,
      templateId: "command-history",
      kind: "command-history",
      title: "Command History",
      content: "",
      createdAt: timestamp,
      updatedAt: timestamp,
    },
    {
      id: noteId,
      workspaceId,
      templateId: "workspace-note",
      kind: "note",
      title: "Launch Notes",
      content: note,
      createdAt: timestamp,
      updatedAt: timestamp,
    },
  ];

  const commands = [
    "git status --short --branch",
    "npm run build",
    "git add src docs",
    "git commit -m \"Polish screenshot workflow\"",
    "git push origin HEAD",
    "npm run tauri:build",
  ].map<CommandHistoryEntry>((command, index) => ({
    id: createId("history"),
    workspaceId,
    sessionId: terminalId,
    command,
    profileId: "powershell",
    cwd: root,
    createdAt: isoMinutesAgo(12 + index * 9),
  }));

  const paneTree: PaneNode = {
    id: createId("pane-split"),
    type: "split",
    direction: "horizontal",
    ratio: 0.56,
    first: leftPane,
    second: rightPane,
  };

  const layout: WorkspaceLayout = {
    workspaceId,
    activeSessionId: terminalId,
    activeItemId: terminalId,
    tabOrder: [terminalId, gitMapId, commandHistoryId, noteId],
    splitPanePreview: true,
    paneTree,
    activePaneId: leftPane.id,
  };

  return { workspace, sessions, templates, commands, layout };
}

function createMarketingModeState() {
  const timestamp = now();
  const demos = [
    createMarketingWorkspace(
      "Launch Console",
      "cortex-launch",
      "feature/landing-assets",
      "https://github.com/devjuliusotto/cortex-launch.git",
      "# Launch Notes\n\n- Capture Git Map with pending changes visible\n- Show command history filtered to release/build commands\n- Keep terminal output at successful build state\n- Use Overview for hero screenshot and Changes for feature crop\n",
      timestamp,
    ),
    createMarketingWorkspace(
      "Client Portal",
      "client-portal",
      "feature/billing-flow",
      "https://github.com/acme/client-portal.git",
      "# Client Portal\n\n## Screenshot Beats\n\n- Terminal: tests passing\n- Git Map: staged UI changes\n- Notes: deployment checklist\n\n## Status\n\nReady for landing page capture.\n",
      timestamp,
    ),
    createMarketingWorkspace(
      "Release Desk",
      "release-desk",
      "release/v1.2.0",
      "git@github.com:studio/release-desk.git",
      "# Release Desk\n\n- Verify changelog\n- Build desktop artifacts\n- Tag release after screenshot pass\n",
      timestamp,
    ),
  ];

  return {
    workspaces: demos.map((demo) => demo.workspace),
    sessions: demos.flatMap((demo) => demo.sessions),
    templateInstances: demos.flatMap((demo) => demo.templates),
    commandHistory: demos.flatMap((demo) => demo.commands),
    layouts: demos.map((demo) => demo.layout),
    activeWorkspaceId: demos[0]?.workspace.id ?? null,
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

function trimCommandHistoryByWorkspace(commandHistory: CommandHistoryEntry[]) {
  const entriesByWorkspace = new Map<string, CommandHistoryEntry[]>();
  for (const entry of commandHistory) {
    const entries = entriesByWorkspace.get(entry.workspaceId) ?? [];
    entries.push(entry);
    entriesByWorkspace.set(entry.workspaceId, entries);
  }

  return [...entriesByWorkspace.values()].flatMap((entries) =>
    entries.slice(-MAX_COMMAND_HISTORY_PER_WORKSPACE),
  );
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
    commandHistory: trimCommandHistoryByWorkspace(state.commandHistory),
    savedCommands: state.savedCommands,
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
    commandHistory: trimCommandHistoryByWorkspace(
      (state.commandHistory ?? [])
        .map((entry) => ({
          ...entry,
          command: normalizeCommandForHistory(entry.command),
          cwd: entry.cwd?.trim() || undefined,
        }))
        .filter((entry) => entry.command),
    ),
    savedCommands: (state.savedCommands ?? []).map((command) => ({
      ...command,
      title: command.title.trim(),
      description: command.description?.trim() || undefined,
      command: command.command.trim(),
      category: command.category?.trim() || undefined,
      privateLocal: command.privateLocal === true,
    })).filter((command) => command.title && command.command),
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
      updateCheckMode: "automatic",
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

  createMarketingModeDemo: () =>
    set((state) => {
      const demo = createMarketingModeState();
      const demoWorkspaceIds = new Set(
        state.workspaces
          .filter((workspace) => workspace.name.startsWith("Marketing · "))
          .map((workspace) => workspace.id),
      );
      const next: CortexState = {
        ...state,
        workspaces: [
          ...state.workspaces.filter((workspace) => !demoWorkspaceIds.has(workspace.id)),
          ...demo.workspaces,
        ],
        sessions: [
          ...state.sessions.filter((session) => !demoWorkspaceIds.has(session.workspaceId)),
          ...demo.sessions,
        ],
        commandHistory: [
          ...state.commandHistory.filter((entry) => !demoWorkspaceIds.has(entry.workspaceId)),
          ...demo.commandHistory,
        ],
        templateInstances: [
          ...state.templateInstances.filter((template) => !demoWorkspaceIds.has(template.workspaceId)),
          ...demo.templateInstances,
        ],
        layouts: [
          ...state.layouts.filter((layout) => !demoWorkspaceIds.has(layout.workspaceId)),
          ...demo.layouts,
        ],
        activeWorkspaceId: demo.activeWorkspaceId,
      };
      saveState(next);
      return next;
    }),

  createWorkspace: () =>
    set((state) => {
      const timestamp = now();
      const workspace: Workspace = {
        id: createId("workspace"),
        name: workspaceName(state.workspaces),
        autoStartTerminalsOnOpen: true,
        snippets: [],
        createdAt: timestamp,
        updatedAt: timestamp,
      };

      const standardItems = createStandardWorkspaceItems(workspace.id, timestamp);
      const next: CortexState = {
        ...state,
        workspaces: [...state.workspaces, workspace],
        sessions: [...state.sessions, standardItems.session],
        templateInstances: [...state.templateInstances, ...standardItems.templates],
        layouts: [...state.layouts, standardItems.layout],
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

  createSavedCommand: (command) =>
    set((state) => {
      const cleanTitle = command.title.trim();
      const cleanCommand = command.command.trim();
      if (!cleanTitle || !cleanCommand) {
        return state;
      }

      const timestamp = now();
      const next = {
        ...state,
        savedCommands: [
          ...state.savedCommands,
          {
            id: createId("saved-command"),
            title: cleanTitle,
            description: command.description?.trim() || undefined,
            command: cleanCommand,
            category: command.category?.trim() || undefined,
            privateLocal: command.privateLocal === true,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ],
      };
      saveState(next);
      return next;
    }),

  updateSavedCommand: (commandId, command) =>
    set((state) => {
      const cleanTitle = command.title.trim();
      const cleanCommand = command.command.trim();
      if (!cleanTitle || !cleanCommand) {
        return state;
      }

      const timestamp = now();
      const next = {
        ...state,
        savedCommands: state.savedCommands.map((item) =>
          item.id === commandId
            ? {
                ...item,
                title: cleanTitle,
                description: command.description?.trim() || undefined,
                command: cleanCommand,
                category: command.category?.trim() || undefined,
                privateLocal: command.privateLocal === true,
                updatedAt: timestamp,
              }
            : item,
        ),
      };
      saveState(next);
      return next;
    }),

  deleteSavedCommand: (commandId) =>
    set((state) => {
      const next = {
        ...state,
        savedCommands: state.savedCommands.filter((command) => command.id !== commandId),
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
        commandHistory: state.commandHistory.filter((entry) => entry.workspaceId !== workspaceId),
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

  addCommandHistoryEntry: (entry) =>
    set((state) => {
      const command = normalizeCommandForHistory(entry.command);
      const previous = [...state.commandHistory]
        .reverse()
        .find((item) => item.workspaceId === entry.workspaceId)?.command;
      if (!shouldStoreCommand(command, previous)) {
        return state;
      }

      const timestamp = now();
      const nextEntry: CommandHistoryEntry = {
        ...entry,
        id: createId("command"),
        command,
        cwd: entry.cwd?.trim() || undefined,
        createdAt: timestamp,
      };
      const workspaceEntries = [...state.commandHistory, nextEntry]
        .filter((item) => item.workspaceId === entry.workspaceId)
        .slice(-MAX_COMMAND_HISTORY_PER_WORKSPACE);
      const next = {
        ...state,
        commandHistory: [
          ...state.commandHistory.filter((item) => item.workspaceId !== entry.workspaceId),
          ...workspaceEntries,
        ],
      };
      saveState(next);
      return next;
    }),

  deleteCommandHistoryEntry: (entryId) =>
    set((state) => {
      const next = {
        ...state,
        commandHistory: state.commandHistory.filter((entry) => entry.id !== entryId),
      };
      saveState(next);
      return next;
    }),

  clearCommandHistory: (workspaceId) =>
    set((state) => {
      const next = {
        ...state,
        commandHistory: state.commandHistory.filter((entry) => entry.workspaceId !== workspaceId),
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
