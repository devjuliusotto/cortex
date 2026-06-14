import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal, type ILink, type ILinkProvider } from "@xterm/xterm";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Clipboard,
  Clock3,
  Copy,
  FilePlus2,
  FileText,
  GitBranch,
  History,
  Loader2,
  Play,
  Plus,
  RefreshCw,
  SquarePen,
  RotateCcw,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { GitMapPanel } from "@/features/git/GitMapPanel";
import { markAgentInput, useAgentInsight } from "@/features/agents/agentInsightsStore";
import { createCommandRecorder } from "@/features/terminal/commandHistory";
import {
  ensureTerminalSession,
  focusTerminal,
  registerTerminalFocus,
  resizeTerminal,
  subscribeTerminalSession,
  terminateTerminal,
  writeTerminal,
} from "@/features/terminal/terminalBridge";
import { cn } from "@/lib/utils";
import {
  useCortexStore,
  type CommandSnippet,
  type PaneNode,
  type TerminalProfileId,
  type TerminalSession,
  type TemplateInstance,
} from "@/stores/cortexStore";

type TerminalPanelProps = {
  workspaceId: string | null;
};

type TabContextMenuState = {
  tabId: string;
  x: number;
  y: number;
} | null;

const approvalPromptPattern =
  /\b(?:codex|claude|approval|approve|permission|authorize|authorization|allow|proceed|confirm|continue|grant|autorizacao|autorização|permissao|permissão|aprovar|autorizar|permitir|continuar)\b/i;

const approvalPromptCooldownMs = 20_000;

function plainTerminalText(text: string) {
  return text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\u0007]*(?:\u0007|\x1b\\)/g, "")
    .replace(/[\u0000-\u0008\u000b-\u001f\u007f]/g, " ");
}

function looksLikeApprovalPrompt(text: string) {
  const clean = plainTerminalText(text).toLowerCase();
  if (!approvalPromptPattern.test(clean)) {
    return false;
  }

  return /[?:]\s*$|\[[yn]\]|y\/n|yes\/no|allow|approve|proceed|continue|autorizar|permitir|aprovar|continuar/.test(clean);
}

function requestTerminalAttention() {
  if (typeof window !== "undefined" && "__TAURI_INTERNALS__" in window) {
    void getCurrentWindow().requestUserAttention(UserAttentionType.Critical).catch(() => undefined);
  }
}

function normalizePastedText(text: string) {
  return text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
}

async function readClipboardText(event?: ClipboardEvent) {
  const clipboardText = event?.clipboardData?.getData("text/plain");
  if (clipboardText) {
    return clipboardText;
  }

  if (navigator.clipboard?.readText) {
    try {
      return await navigator.clipboard.readText();
    } catch {
      return invoke<string>("read_clipboard_text");
    }
  }

  return invoke<string>("read_clipboard_text");
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Fall through to the Tauri command for desktop contexts that block the Web Clipboard API.
    }
  }

  await invoke("write_clipboard_text", { text });
}

async function pasteFromClipboard(
  sessionId: string,
  terminal: Terminal,
  event?: ClipboardEvent,
  onSingleLinePaste?: (text: string) => void,
) {
  terminal.focus();
  const text = await readClipboardText(event);
  if (!text) {
    return;
  }

  const normalizedText = normalizePastedText(text);
  if (!normalizedText.includes("\n")) {
    onSingleLinePaste?.(normalizedText);
  }
  await writeTerminal(sessionId, normalizedText.replace(/\n/g, "\r"));
}

function commandForShell(command: string, runImmediately: boolean) {
  const normalized = command.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return runImmediately ? `${normalized}\r` : normalized.replace(/\n/g, "\r");
}

function profileLabel(profileId: TerminalProfileId) {
  const labels: Record<TerminalProfileId, string> = {
    cmd: "CMD",
    powershell: "PowerShell",
    "wsl-ubuntu": "WSL Ubuntu",
  };
  return labels[profileId] ?? profileId;
}

const terminalUrlPattern =
  /\b(?:https?:\/\/|localhost(?::\d+)?|127\.0\.0\.1(?::\d+)?|\[::1\](?::\d+)?)(?:[^\s<>"'`]*)/gi;

function normalizeTerminalUrl(text: string) {
  const clean = text.replace(/[),.;:]+$/g, "");
  return clean.startsWith("http://") || clean.startsWith("https://")
    ? clean
    : `http://${clean}`;
}

function openTerminalUrl(url: string) {
  void invoke("open_external_url", { url }).catch(() => {
    window.open(url, "_blank", "noopener,noreferrer");
  });
}

function itemIcon(kind: "terminal" | TemplateInstance["kind"]) {
  if (kind === "terminal") {
    return <TerminalSquare className="h-3.5 w-3.5 text-primary" />;
  }
  if (kind === "command-history") {
    return <History className="h-3.5 w-3.5 text-primary" />;
  }
  if (kind === "git-map") {
    return <GitBranch className="h-3.5 w-3.5 text-primary" />;
  }
  return <FileText className="h-3.5 w-3.5 text-primary" />;
}

function createTerminalLinkProvider(terminal: Terminal): ILinkProvider {
  return {
    provideLinks(bufferLineNumber, callback) {
      const line = terminal.buffer.active.getLine(bufferLineNumber - 1);
      if (!line) {
        callback(undefined);
        return;
      }

      const text = line.translateToString(true);
      const links: ILink[] = [];

      for (const match of text.matchAll(terminalUrlPattern)) {
        const rawText = match[0];
        const linkText = normalizeTerminalUrl(rawText);
        const displayText = rawText.replace(/[),.;:]+$/g, "");
        const startColumn = match.index ?? 0;
        const endColumn = startColumn + displayText.length;

        links.push({
          range: {
            start: { x: startColumn + 1, y: bufferLineNumber },
            end: { x: endColumn + 1, y: bufferLineNumber },
          },
          text: linkText,
          decorations: {
            pointerCursor: true,
            underline: true,
          },
          activate: (_event, url) => openTerminalUrl(url),
        });
      }

      callback(links.length > 0 ? links : undefined);
    },
  };
}

export function TerminalPanel({ workspaceId }: TerminalPanelProps) {
  const {
    createSession,
    createWorkspace,
    layouts,
    workspaces,
  } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const layout = layouts.find((item) => item.workspaceId === workspaceId);

  if (!activeWorkspace) {
    return (
      <EmptyPanel
        icon={<TerminalSquare className="h-6 w-6 text-primary" />}
        title="No workspace selected"
        description="Create a workspace to organize terminal sessions locally on this machine."
        actionLabel="Create workspace"
        onAction={createWorkspace}
      />
    );
  }

  if (!layout) {
    return (
      <EmptyPanel
        icon={<TerminalSquare className="h-6 w-6 text-primary" />}
        title="This workspace is empty"
        description="Create a terminal session or note to add a tab to this workspace."
        actionLabel="Create terminal"
        onAction={() => createSession(activeWorkspace.id)}
      />
    );
  }

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border bg-cortex-graphite"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <WorkspaceTools workspaceId={activeWorkspace.id} />
      <div className="min-h-0 flex-1">
        <PaneTree node={layout.paneTree} workspaceId={activeWorkspace.id} />
      </div>
    </motion.section>
  );
}

function PaneTree({ node, workspaceId }: { node: PaneNode; workspaceId: string }) {
  const { resizePane } = useCortexStore();
  const containerRef = useRef<HTMLDivElement | null>(null);

  if (node.type === "leaf") {
    return <PaneLeaf node={node} workspaceId={workspaceId} />;
  }

  const gridStyle =
    node.direction === "horizontal"
      ? { gridTemplateColumns: `${node.ratio}fr 6px ${1 - node.ratio}fr` }
      : { gridTemplateRows: `${node.ratio}fr 6px ${1 - node.ratio}fr` };

  const startResize = (event: React.PointerEvent<HTMLDivElement>) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) {
      return;
    }

    const move = (moveEvent: PointerEvent) => {
      const ratio =
        node.direction === "horizontal"
          ? (moveEvent.clientX - rect.left) / rect.width
          : (moveEvent.clientY - rect.top) / rect.height;
      resizePane(workspaceId, node.id, ratio);
    };

    const stop = () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", stop);
    };

    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", stop);
  };

  return (
    <div
      className={cn(
        "grid h-full min-h-0 min-w-0 overflow-hidden",
        node.direction === "horizontal" ? "grid-rows-1" : "grid-cols-1",
      )}
      ref={containerRef}
      style={gridStyle}
    >
      <PaneTree node={node.first} workspaceId={workspaceId} />
      <div
        className={cn(
          "bg-border transition-colors hover:bg-primary",
          node.direction === "horizontal" ? "cursor-col-resize" : "cursor-row-resize",
        )}
        onPointerDown={startResize}
        role="separator"
      />
      <PaneTree node={node.second} workspaceId={workspaceId} />
    </div>
  );
}

function PaneLeaf({ node, workspaceId }: { node: Extract<PaneNode, { type: "leaf" }>; workspaceId: string }) {
  const {
    closePane,
    createSession,
    createTemplateInstance,
    deleteSession,
    deleteTemplateInstance,
    layouts,
    moveTabToPane,
    renameSession,
    renameTemplateInstance,
    sessions,
    setActivePane,
    setActivePaneTab,
    templateInstances,
  } = useCortexStore();
  const [newTabChooserOpen, setNewTabChooserOpen] = useState(false);
  const [tabContextMenu, setTabContextMenu] = useState<TabContextMenuState>(null);
  const layout = layouts.find((item) => item.workspaceId === workspaceId);
  const active = layout?.activePaneId === node.id;
  const activeTabId = node.activeTabId && node.tabIds.includes(node.activeTabId)
    ? node.activeTabId
    : node.tabIds[0] ?? null;
  const session = newTabChooserOpen ? undefined : sessions.find((item) => item.id === activeTabId);
  const template = newTabChooserOpen ? undefined : templateInstances.find((item) => item.id === activeTabId);
  const workspaceItems = [
    ...sessions
      .filter((item) => item.workspaceId === workspaceId)
      .map((item) => ({ id: item.id, label: item.name, kind: "terminal" as const, item })),
    ...templateInstances
      .filter((item) => item.workspaceId === workspaceId)
      .map((item) => ({ id: item.id, label: item.title, kind: item.kind, item })),
  ];
  const paneTabs = node.tabIds
    .map((tabId) => workspaceItems.find((item) => item.id === tabId))
    .filter(Boolean);

  const createTerminalInPane = (profileId?: TerminalProfileId) => {
    setActivePane(workspaceId, node.id);
    setNewTabChooserOpen(false);
    createSession(workspaceId, profileId);
  };

  const createNoteInPane = () => {
    setActivePane(workspaceId, node.id);
    setNewTabChooserOpen(false);
    createTemplateInstance(workspaceId, {
      templateId: "workspace-note",
      kind: "note",
      title: "Untitled note",
      content: "",
    });
  };

  const createCommandHistoryInPane = () => {
    setActivePane(workspaceId, node.id);
    setNewTabChooserOpen(false);
    const existing = templateInstances.find(
      (item) => item.workspaceId === workspaceId && item.kind === "command-history",
    );
    if (existing) {
      setActivePaneTab(workspaceId, node.id, existing.id);
      return;
    }
    createTemplateInstance(workspaceId, {
      templateId: "command-history",
      kind: "command-history",
      title: "Command History",
      content: "",
    });
  };

  const createGitMapInPane = () => {
    setActivePane(workspaceId, node.id);
    setNewTabChooserOpen(false);
    const existing = templateInstances.find(
      (item) => item.workspaceId === workspaceId && item.kind === "git-map",
    );
    if (existing) {
      setActivePaneTab(workspaceId, node.id, existing.id);
      return;
    }
    createTemplateInstance(workspaceId, {
      templateId: "git-map",
      kind: "git-map",
      title: "Git Map",
      content: "",
    });
  };

  const openNewTabChooser = () => {
    setActivePane(workspaceId, node.id);
    setNewTabChooserOpen(true);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tabId = event.dataTransfer.getData("application/x-cortex-tab");
    if (!tabId) {
      return;
    }
    moveTabToPane(workspaceId, tabId, node.id);
  };

  const closeTab = (tabId: string) => {
    const terminal = sessions.find((item) => item.id === tabId);
    const note = templateInstances.find((item) => item.id === tabId);
    if (terminal) {
      void terminateTerminal(terminal.id);
      deleteSession(terminal.id);
    }
    if (note) {
      deleteTemplateInstance(note.id);
    }
  };

  const renameTab = (tabId: string) => {
    const terminal = sessions.find((item) => item.id === tabId);
    const template = templateInstances.find((item) => item.id === tabId);
    const currentName = terminal?.name ?? template?.title;
    if (!currentName) {
      return;
    }

    const nextName = window.prompt("Novo nome da aba", currentName)?.trim();
    if (!nextName || nextName === currentName) {
      return;
    }

    if (terminal) {
      renameSession(terminal.id, nextName);
    } else if (template) {
      renameTemplateInstance(template.id, nextName);
    }
  };

  useEffect(() => {
    if (!tabContextMenu) {
      return;
    }

    const closeContextMenu = () => setTabContextMenu(null);
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closeContextMenu();
      }
    };

    window.addEventListener("click", closeContextMenu);
    window.addEventListener("contextmenu", closeContextMenu);
    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("click", closeContextMenu);
      window.removeEventListener("contextmenu", closeContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [tabContextMenu]);

  return (
    <div
      className={cn("flex h-full min-h-0 min-w-0 flex-col overflow-hidden border border-transparent", active && "border-primary/35")}
      onDragOver={(event) => event.preventDefault()}
      onDrop={handleDrop}
      onMouseDown={() => setActivePane(workspaceId, node.id)}
    >
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-card/70 px-2">
        <div className="flex min-w-0 flex-1 items-center gap-1 overflow-x-auto">
          {paneTabs.map((entry, index) => {
            if (!entry) {
              return null;
            }
            const isActive = entry.id === activeTabId;
            return (
              <button
                className={cn(
                  "flex h-7 min-w-28 items-center gap-2 rounded-md px-2 text-left text-xs text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                  isActive && "bg-secondary text-foreground shadow-glow",
                )}
                draggable
                key={entry.id}
                onClick={() => {
                  setNewTabChooserOpen(false);
                  setActivePaneTab(workspaceId, node.id, entry.id);
                }}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setNewTabChooserOpen(false);
                  setActivePaneTab(workspaceId, node.id, entry.id);
                  setTabContextMenu({
                    tabId: entry.id,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
                onDragOver={(event) => event.preventDefault()}
                onDragStart={(event) => {
                  event.dataTransfer.setData("application/x-cortex-tab", entry.id);
                  event.dataTransfer.effectAllowed = "move";
                }}
                onDrop={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  const tabId = event.dataTransfer.getData("application/x-cortex-tab");
                  if (tabId) {
                    moveTabToPane(workspaceId, tabId, node.id, index);
                  }
                }}
                type="button"
              >
                {itemIcon(entry.kind)}
                <span className="truncate">{entry.label}</span>
                <span
                  className="ml-1 rounded px-1 text-muted-foreground hover:bg-background hover:text-foreground"
                  onClick={(event) => {
                    event.stopPropagation();
                    closeTab(entry.id);
                  }}
                  role="button"
                  title="Close tab"
                >
                  x
                </span>
              </button>
            );
          })}
          {tabContextMenu && (
            <div
              className="fixed z-50 min-w-44 rounded-md border border-border bg-card p-1 shadow-2xl"
              onClick={(event) => event.stopPropagation()}
              onContextMenu={(event) => event.preventDefault()}
              style={{ left: tabContextMenu.x, top: tabContextMenu.y }}
            >
              <button
                className="flex h-9 w-full items-center gap-2 rounded px-2 text-left text-sm text-foreground hover:bg-secondary"
                onClick={() => {
                  renameTab(tabContextMenu.tabId);
                  setTabContextMenu(null);
                }}
                type="button"
              >
                <SquarePen className="h-4 w-4 text-primary" />
                Renomear aba
              </button>
            </div>
          )}
          <button
            className={cn(
              "grid h-7 w-8 shrink-0 place-items-center rounded-md text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
              newTabChooserOpen && "bg-secondary text-foreground shadow-glow",
            )}
            onClick={openNewTabChooser}
            title="New tab"
            type="button"
          >
            <Plus className="h-4 w-4" />
          </button>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon" variant="ghost" onClick={openNewTabChooser} title="New tab">
            <Plus className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={createNoteInPane} title="New note in pane">
            <FilePlus2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={createCommandHistoryInPane} title="Command history in pane">
            <History className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={createGitMapInPane} title="Git map in pane">
            <GitBranch className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => createTerminalInPane()} title="New terminal in pane">
            <TerminalSquare className="h-4 w-4" />
          </Button>
          {node.tabIds.length === 0 && (
            <Button size="icon" variant="ghost" onClick={() => closePane(workspaceId, node.id)} title="Close empty pane">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 min-w-0 flex-1 overflow-hidden">
        {newTabChooserOpen && (
          <NewTabChooser
            onCommandHistory={createCommandHistoryInPane}
            onGitMap={createGitMapInPane}
            onNote={createNoteInPane}
            onTerminal={createTerminalInPane}
          />
        )}
        {!newTabChooserOpen && !session && !template && (
          <NewTabChooser
            onCommandHistory={createCommandHistoryInPane}
            onGitMap={createGitMapInPane}
            onNote={createNoteInPane}
            onTerminal={createTerminalInPane}
          />
        )}
        {session && <TerminalPane paneId={node.id} session={session} workspaceId={workspaceId} />}
        {template?.kind === "note" && <NotesPane paneId={node.id} template={template} workspaceId={workspaceId} />}
        {template?.kind === "command-history" && (
          <CommandHistoryPane paneId={node.id} template={template} workspaceId={workspaceId} />
        )}
        {template?.kind === "git-map" && (
          <GitMapPanel paneId={node.id} template={template} workspaceId={workspaceId} />
        )}
      </div>
    </div>
  );
}

function TerminalPane({
  paneId,
  session,
  workspaceId,
}: {
  paneId: string;
  session: TerminalSession;
  workspaceId: string;
}) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const agentInsight = useAgentInsight(session.id);
  const [terminalStartToken, setTerminalStartToken] = useState(0);
  const [terminalClearToken, setTerminalClearToken] = useState(0);
  const [connectionState, setConnectionState] = useState<{
    status: "idle" | "loading" | "connected" | "exited" | "error";
    error: string | null;
  }>({ status: "idle", error: null });
  const approvalPromptBufferRef = useRef("");
  const lastApprovalPromptAtRef = useRef(0);
  const {
    addCommandHistoryEntry,
    appendTerminalHistory,
    clearTerminalHistory,
    duplicateSession,
    profiles,
    setActivePaneTab,
    setSessionProfile,
    setSessionStatus,
    workspaces,
  } = useCortexStore();
  const activeProfile = profiles.find((profile) => profile.id === session.profileId);
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const effectiveCwd = session.cwd ?? workspace?.defaultWorkingDirectory;
  const terminalStopped =
    session.status === "inactive" || session.status === "completed" || session.status === "error";

  const startNewShell = () => {
    appendTerminalHistory(session.id, "\r\n--- New shell started ---\r\n");
    setSessionStatus(session.id, "running");
    setTerminalStartToken((value) => value + 1);
  };

  useEffect(() => {
    if (!terminalRef.current || !activeProfile) {
      return;
    }

    let disposed = false;
    const terminal = new Terminal({
      cursorBlink: true,
      fontFamily: '"Cascadia Mono", Consolas, monospace',
      fontSize: 13,
      lineHeight: 1.25,
      scrollback: 10_000,
      theme: {
        background: "#0b0d10",
        foreground: "#dce7ef",
        cursor: "#56f0ff",
        selectionBackground: "#1f3a44",
      },
    });
    const fitAddon = new FitAddon();
    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    const linkProvider = terminal.registerLinkProvider(createTerminalLinkProvider(terminal));
    if (session.terminalHistory) {
      terminal.write(session.terminalHistory);
    }
    fitAddon.fit();

    const unsubscribe = subscribeTerminalSession(session.id, {
      onData: (data) => {
        terminal.write(data);
        const nextBuffer = `${approvalPromptBufferRef.current}${plainTerminalText(data)}`.slice(-1200);
        approvalPromptBufferRef.current = nextBuffer;
        if (
          looksLikeApprovalPrompt(nextBuffer) &&
          Date.now() - lastApprovalPromptAtRef.current > approvalPromptCooldownMs
        ) {
          lastApprovalPromptAtRef.current = Date.now();
          setSessionStatus(session.id, "waiting");
          requestTerminalAttention();
        }
      },
      onStatus: (status, error) => {
        if (disposed) {
          return;
        }
        setConnectionState({ status, error });
        if (status === "connected") {
          setSessionStatus(session.id, "running");
        } else if (status === "loading") {
          setSessionStatus(session.id, "waiting");
        } else if (status === "exited") {
          setSessionStatus(session.id, "completed");
        } else if (status === "error") {
          setSessionStatus(session.id, "error");
        }
      },
    });

    let resizeFrame = 0;
    const syncSize = () => {
      window.cancelAnimationFrame(resizeFrame);
      resizeFrame = window.requestAnimationFrame(() => {
        if (disposed) {
          return;
        }
        fitAddon.fit();
        terminal.refresh(0, terminal.rows - 1);
        void resizeTerminal(session.id, terminal.rows, terminal.cols);
      });
    };

    const recorder = createCommandRecorder({
      onCommand: (command) => {
        addCommandHistoryEntry({
          command,
          cwd: effectiveCwd,
          profileId: session.profileId,
          sessionId: session.id,
          workspaceId,
        });
      },
    });

    const dataDisposable = terminal.onData((data) => {
      approvalPromptBufferRef.current = "";
      setSessionStatus(session.id, "running");
      markAgentInput(session.id);
      recorder.accept(data);
      void writeTerminal(session.id, data);
    });

    const unregisterFocus = registerTerminalFocus(session.id, () => terminal.focus());

    const copySelection = async () => {
      if (!terminal.hasSelection()) {
        terminal.focus();
        return;
      }
      await writeClipboardText(terminal.getSelection());
      terminal.clearSelection();
      terminal.focus();
    };

    const pasteClipboard = (event?: ClipboardEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      void pasteFromClipboard(
        session.id,
        terminal,
        event,
        (text) => recorder.accept(text),
      ).catch((error) => {
        if (!disposed) {
          setConnectionState({ status: "error", error: `Paste failed: ${String(error)}` });
        }
      });
    };

    terminal.attachCustomKeyEventHandler((event) => {
      if (event.type !== "keydown" || event.altKey || event.metaKey) {
        return true;
      }

      const key = event.key.toLowerCase();
      if (event.ctrlKey && key === "c") {
        event.preventDefault();
        event.stopPropagation();
        if (terminal.hasSelection()) {
          void copySelection();
        } else if (!event.shiftKey) {
          recorder.reset();
          void writeTerminal(session.id, "\x03");
        }
        terminal.focus();
        return false;
      }

      if (event.ctrlKey && key === "v") {
        event.preventDefault();
        event.stopPropagation();
        pasteClipboard();
        return false;
      }

      return true;
    });

    const pasteListener = (event: ClipboardEvent) => pasteClipboard(event);
    const contextMenuListener = (event: MouseEvent) => {
      if (event.shiftKey || event.ctrlKey || event.metaKey || event.altKey) {
        return;
      }
      pasteClipboard();
      event.preventDefault();
      event.stopPropagation();
    };
    const terminalElement = terminalRef.current;
    terminalElement.addEventListener("paste", pasteListener, true);
    terminalElement.addEventListener("contextmenu", contextMenuListener, true);

    if (session.status === "running" || session.status === "waiting") {
      setConnectionState({ status: "loading", error: null });
      void ensureTerminalSession(
        session.id,
        session.profileId,
        terminal.rows,
        terminal.cols,
        effectiveCwd,
      ).catch((error) => {
        if (!disposed) {
          setConnectionState({ status: "error", error: String(error) });
          setSessionStatus(session.id, "error");
        }
      });
    } else {
      setConnectionState({ status: "idle", error: null });
    }

    const resizeObserver = new ResizeObserver(syncSize);
    resizeObserver.observe(terminalRef.current);

    return () => {
      disposed = true;
      unsubscribe();
      dataDisposable.dispose();
      unregisterFocus();
      linkProvider.dispose();
      window.cancelAnimationFrame(resizeFrame);
      terminalElement.removeEventListener("paste", pasteListener, true);
      terminalElement.removeEventListener("contextmenu", contextMenuListener, true);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [
    activeProfile,
    addCommandHistoryEntry,
    effectiveCwd,
    session.id,
    session.profileId,
    setSessionStatus,
    terminalClearToken,
    terminalStartToken,
  ]);

  return (
    <div className="flex h-full min-h-0 min-w-0 flex-col overflow-hidden">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/50 px-3">
        <button
          className="min-w-0 truncate text-left text-sm font-medium"
          onClick={() => setActivePaneTab(workspaceId, paneId, session.id)}
          type="button"
        >
          {session.name}
          <span className="ml-2 text-xs font-normal text-muted-foreground">{activeProfile?.name}</span>
        </button>
        <div className="flex shrink-0 items-center gap-2">
          {agentInsight?.waitingForAuthorization && <span className="flex max-w-64 items-center gap-1.5 truncate rounded-md border border-cortex-amber/35 bg-cortex-amber/10 px-2 py-1 text-[11px] text-cortex-amber" title={agentInsight.waitingMessage}><AlertCircle className="h-3.5 w-3.5 shrink-0" />Aguardando autorização</span>}
          {agentInsight?.usage.totalTokens !== undefined && <span className="rounded-md border border-border bg-secondary px-2 py-1 text-[11px] text-muted-foreground">{new Intl.NumberFormat().format(agentInsight.usage.totalTokens)} tokens</span>}
          <select
            className="h-7 rounded-md border border-border bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            onChange={(event) =>
              setSessionProfile(session.id, event.target.value as TerminalProfileId)
            }
            value={session.profileId}
          >
            {profiles.map((profile) => (
              <option key={profile.id} value={profile.id}>
                {profile.name}
              </option>
            ))}
          </select>
          {terminalStopped && (
            <Button size="sm" variant="outline" onClick={startNewShell}>
              <RotateCcw className="mr-2 h-4 w-4" />
              Start shell
            </Button>
          )}
        </div>
      </div>
      <div className="relative min-h-0 min-w-0 flex-1 overflow-hidden bg-[#0b0d10]">
        <div ref={terminalRef} className="h-full min-h-0 min-w-0 overflow-hidden" />
        {connectionState.status === "loading" && (
          <TerminalOverlay icon={<Loader2 className="h-4 w-4 animate-spin text-primary" />} message="Starting terminal" />
        )}
        {connectionState.status === "error" && (
          <TerminalOverlay icon={<AlertCircle className="h-4 w-4 text-cortex-red" />} message={connectionState.error ?? "Terminal failed"} />
        )}
        {connectionState.status === "connected" && connectionState.error && (
          <TerminalOverlay icon={<AlertCircle className="h-4 w-4 text-yellow-400" />} message={connectionState.error} />
        )}
        {terminalStopped && connectionState.status !== "loading" && (
          <div className="absolute bottom-4 right-4 max-w-[min(28rem,calc(100%-2rem))] rounded-md border border-border bg-card/95 p-4 shadow-glow">
            <div className="flex items-center gap-2 text-sm font-medium">
              <TerminalSquare className="h-4 w-4 text-primary" />
              Shell paused
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              {useCortexStore.getState().settings.terminalHistoryEnabled
                ? "Previous output is restored. Start a new shell to continue."
                : "Start a new shell to continue. Terminal output is not persisted."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={startNewShell}>
                <Play className="mr-2 h-4 w-4" />
                Continue / Start shell
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  clearTerminalHistory(session.id);
                  setTerminalClearToken((value) => value + 1);
                }}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                Clear history
              </Button>
              <Button size="sm" variant="outline" onClick={() => duplicateSession(session.id)}>
                <Copy className="mr-2 h-4 w-4" />
                Duplicate session
              </Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function NotesPane({
  paneId,
  template,
  workspaceId,
}: {
  paneId: string;
  template: TemplateInstance;
  workspaceId: string;
}) {
  const { setActivePaneTab, updateTemplateInstanceContent } = useCortexStore();
  const [draft, setDraft] = useState(template.content);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setDraft(template.content);
    setSaved(true);
  }, [template.content, template.id]);

  useEffect(() => {
    if (draft === template.content) {
      return;
    }

    setSaved(false);
    const timer = window.setTimeout(() => {
      updateTemplateInstanceContent(template.id, draft);
      setSaved(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [draft, template.content, template.id, updateTemplateInstanceContent]);

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/50 px-4">
        <button
          className="flex min-w-0 items-center gap-2"
          onClick={() => setActivePaneTab(workspaceId, paneId, template.id)}
          type="button"
        >
          <FileText className="h-4 w-4 text-primary" />
          <span className="truncate text-sm font-medium">{template.title}</span>
        </button>
        <span className="text-xs text-muted-foreground">
          {saved ? `Saved ${new Date(template.updatedAt).toLocaleTimeString()}` : "Saving..."}
        </span>
      </div>
      <textarea
        className="min-h-0 flex-1 resize-none bg-cortex-graphite p-5 font-mono text-sm leading-6 text-foreground outline-none"
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        spellCheck
      />
    </div>
  );
}

function CommandHistoryPane({
  paneId,
  template,
  workspaceId,
}: {
  paneId: string;
  template: TemplateInstance;
  workspaceId: string;
}) {
  const {
    clearCommandHistory,
    commandHistory,
    deleteCommandHistoryEntry,
    layouts,
    sessions,
    setActivePaneTab,
  } = useCortexStore();
  const [query, setQuery] = useState("");
  const layout = layouts.find((item) => item.workspaceId === workspaceId);
  const activeTerminal = sessions.find(
    (session) =>
      session.workspaceId === workspaceId &&
      (session.id === layout?.activeSessionId || session.id === layout?.activeItemId),
  );
  const filteredCommands = commandHistory
    .filter((entry) => entry.workspaceId === workspaceId)
    .filter((entry) => {
      const cleanQuery = query.trim().toLowerCase();
      if (!cleanQuery) {
        return true;
      }
      return (
        entry.command.toLowerCase().includes(cleanQuery) ||
        entry.cwd?.toLowerCase().includes(cleanQuery)
      );
    })
    .slice()
    .reverse();

  const sendCommand = (command: string, runImmediately: boolean) => {
    if (!activeTerminal) {
      return;
    }
    void writeTerminal(activeTerminal.id, commandForShell(command, runImmediately)).then(() => {
      focusTerminal(activeTerminal.id);
    });
  };

  const copyCommand = (command: string) => {
    void writeClipboardText(command);
    if (activeTerminal) {
      focusTerminal(activeTerminal.id);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-cortex-graphite">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/50 px-4">
        <button
          className="flex min-w-0 items-center gap-2"
          onClick={() => setActivePaneTab(workspaceId, paneId, template.id)}
          type="button"
        >
          <History className="h-4 w-4 text-primary" />
          <span className="truncate text-sm font-medium">{template.title}</span>
        </button>
        <Button
          disabled={filteredCommands.length === 0}
          onClick={() => clearCommandHistory(workspaceId)}
          size="sm"
          variant="ghost"
        >
          Clear
        </Button>
      </div>

      <div className="border-b border-border p-3">
        <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-background/60 px-3 text-xs text-muted-foreground">
          <Clock3 className="h-3.5 w-3.5" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search commands"
            value={query}
          />
        </label>
        {!activeTerminal && (
          <p className="mt-3 rounded-md border border-border bg-card/50 px-3 py-2 text-xs text-muted-foreground">
            Open or select a terminal to reuse commands.
          </p>
        )}
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-3">
        {filteredCommands.length === 0 ? (
          <div className="grid h-full place-items-center text-center text-sm text-muted-foreground">
            <div>No commands captured yet.</div>
          </div>
        ) : (
          <div className="space-y-2">
            {filteredCommands.map((entry) => (
              <div className="rounded-md border border-border bg-card/55 p-3" key={entry.id}>
                <pre className="max-h-28 overflow-auto whitespace-pre-wrap break-words font-mono text-xs leading-5 text-foreground">
                  {entry.command}
                </pre>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                  <span>{profileLabel(entry.profileId)}</span>
                  <span>{new Date(entry.createdAt).toLocaleString()}</span>
                  {entry.cwd && <span className="max-w-full truncate">{entry.cwd}</span>}
                </div>
                <div className="mt-3 flex flex-wrap gap-1.5">
                  <Button
                    disabled={!activeTerminal}
                    onClick={() => sendCommand(entry.command, false)}
                    size="sm"
                    variant="outline"
                  >
                    Paste
                  </Button>
                  <Button
                    disabled={!activeTerminal}
                    onClick={() => sendCommand(entry.command, true)}
                    size="sm"
                  >
                    <Play className="mr-2 h-3.5 w-3.5" />
                    Run
                  </Button>
                  <Button onClick={() => copyCommand(entry.command)} size="sm" variant="ghost">
                    <Clipboard className="mr-2 h-3.5 w-3.5" />
                    Copy
                  </Button>
                  <Button
                    onClick={() => deleteCommandHistoryEntry(entry.id)}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="mr-2 h-3.5 w-3.5" />
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function WorkspaceTools({ workspaceId }: { workspaceId: string }) {
  const {
    createSnippet,
    deleteSnippet,
    sessions,
    updateSnippet,
    workspaces,
  } = useCortexStore();
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const activeTerminal = sessions.find(
    (session) =>
      session.workspaceId === workspaceId &&
      session.id === useCortexStore.getState().layouts.find((layout) => layout.workspaceId === workspaceId)?.activeItemId,
  );

  const sendSnippet = (snippet: CommandSnippet, runImmediately: boolean) => {
    if (!activeTerminal) {
      window.alert("Select a running terminal pane before sending a snippet.");
      return;
    }
    void writeTerminal(activeTerminal.id, commandForShell(snippet.command, runImmediately));
  };

  const addSnippet = () => {
    const command = window.prompt("Command snippet");
    if (!command) {
      return;
    }
    const name = window.prompt("Snippet name", command.split(/\s+/)[0] || "Command");
    if (!name) {
      return;
    }
    const profileId = window.prompt(
      "Optional profile target: powershell, cmd, or wsl-ubuntu",
      "",
    ) as TerminalProfileId | "";
    createSnippet(workspaceId, { name, command, profileId: profileId || undefined });
  };

  const editSnippet = (snippet: CommandSnippet) => {
    const name = window.prompt("Snippet name", snippet.name);
    if (!name) {
      return;
    }
    const command = window.prompt("Command", snippet.command);
    if (!command) {
      return;
    }
    const description = window.prompt("Description", snippet.description ?? "") ?? "";
    const profileId = window.prompt(
      "Optional profile target: powershell, cmd, or wsl-ubuntu",
      snippet.profileId ?? "",
    ) as TerminalProfileId | "";
    updateSnippet(workspaceId, snippet.id, {
      ...snippet,
      name,
      command,
      description,
      profileId: profileId || undefined,
    });
  };

  return (
    <div className="flex min-h-12 shrink-0 items-center gap-2 overflow-x-auto border-b border-border bg-background/40 px-3 py-2">
      <Button size="sm" variant="outline" onClick={addSnippet}>
        <Plus className="mr-2 h-4 w-4" />
        Snippet
      </Button>
      {(workspace?.snippets ?? []).map((snippet) => (
        <div
          className="flex shrink-0 items-center gap-1 rounded-md border border-border bg-card/60 px-2 py-1"
          key={snippet.id}
          title={snippet.description ?? snippet.command}
        >
          <span className="max-w-36 truncate text-xs">{snippet.name}</span>
          <Button size="sm" variant="ghost" onClick={() => sendSnippet(snippet, false)}>
            Paste
          </Button>
          <Button size="sm" variant="ghost" onClick={() => sendSnippet(snippet, true)}>
            Run
          </Button>
          <button className="text-xs text-muted-foreground hover:text-foreground" onClick={() => editSnippet(snippet)} type="button">
            Edit
          </button>
          <button className="text-xs text-cortex-red" onClick={() => deleteSnippet(workspaceId, snippet.id)} type="button">
            Delete
          </button>
        </div>
      ))}
    </div>
  );
}

function NewTabChooser({
  onCommandHistory,
  onGitMap,
  onNote,
  onTerminal,
}: {
  onCommandHistory: () => void;
  onGitMap: () => void;
  onNote: () => void;
  onTerminal: (profileId?: TerminalProfileId) => void;
}) {
  return (
    <div className="grid h-full place-items-center p-5">
      <div className="w-full max-w-xl">
        <div className="mb-4 text-center text-sm font-medium text-muted-foreground">New tab</div>
        <div className="grid gap-2 sm:grid-cols-2">
          <Button
            className="h-16 justify-start gap-3 px-4"
            onClick={() => onTerminal("powershell")}
            variant="outline"
          >
            <TerminalSquare className="h-5 w-5 text-primary" />
            <span className="text-left">
              <span className="block text-sm font-medium">PowerShell</span>
              <span className="block text-xs text-muted-foreground">powershell.exe</span>
            </span>
          </Button>
          <Button
            className="h-16 justify-start gap-3 px-4"
            onClick={() => onTerminal("cmd")}
            variant="outline"
          >
            <TerminalSquare className="h-5 w-5 text-primary" />
            <span className="text-left">
              <span className="block text-sm font-medium">CMD</span>
              <span className="block text-xs text-muted-foreground">cmd.exe</span>
            </span>
          </Button>
          <Button
            className="h-16 justify-start gap-3 px-4"
            onClick={() => onTerminal("wsl-ubuntu")}
            variant="outline"
          >
            <TerminalSquare className="h-5 w-5 text-primary" />
            <span className="text-left">
              <span className="block text-sm font-medium">WSL Ubuntu</span>
              <span className="block text-xs text-muted-foreground">wsl.exe</span>
            </span>
          </Button>
          <Button className="h-16 justify-start gap-3 px-4" onClick={onNote} variant="outline">
            <FileText className="h-5 w-5 text-primary" />
            <span className="text-left">
              <span className="block text-sm font-medium">Bloco de notas</span>
              <span className="block text-xs text-muted-foreground">Notas locais</span>
            </span>
          </Button>
          <Button
            className="h-16 justify-start gap-3 px-4 sm:col-span-2"
            onClick={onGitMap}
            variant="outline"
          >
            <GitBranch className="h-5 w-5 text-primary" />
            <span className="text-left">
              <span className="block text-sm font-medium">Git Map</span>
              <span className="block text-xs text-muted-foreground">Branch, status e mapa de commits</span>
            </span>
          </Button>
          <Button
            className="h-16 justify-start gap-3 px-4 sm:col-span-2"
            onClick={onCommandHistory}
            variant="outline"
          >
            <History className="h-5 w-5 text-primary" />
            <span className="text-left">
              <span className="block text-sm font-medium">Command History</span>
              <span className="block text-xs text-muted-foreground">Comandos capturados no workspace</span>
            </span>
          </Button>
        </div>
      </div>
    </div>
  );
}

type EmptyPanelProps = {
  icon: ReactNode;
  title: string;
  description: string;
  actionLabel: string;
  onAction: () => void;
  framed?: boolean;
};

function EmptyPanel({ icon, title, description, actionLabel, onAction, framed = true }: EmptyPanelProps) {
  return (
    <section
      className={
        framed
          ? "flex min-h-0 flex-1 items-center justify-center border-l border-border bg-cortex-graphite p-6"
          : "flex min-h-0 flex-1 items-center justify-center p-6"
      }
    >
      <div className="max-w-sm rounded-md border border-dashed border-border bg-card/50 p-6 text-center">
        <div className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-md border border-primary/20 bg-primary/10">
          {icon}
        </div>
        <h2 className="text-base font-semibold">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
        <Button className="mt-5" onClick={onAction}>
          <Plus className="mr-2 h-4 w-4" />
          {actionLabel}
        </Button>
      </div>
    </section>
  );
}

function TerminalOverlay({ icon, message }: { icon: ReactNode; message: string }) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 flex max-w-[min(28rem,calc(100%-1.5rem))] items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-glow">
      {icon}
      <span className="truncate">{message}</span>
    </div>
  );
}
