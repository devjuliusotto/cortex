import { useEffect, useRef, useState } from "react";
import type { DragEvent, ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { motion } from "framer-motion";
import {
  AlertCircle,
  Copy,
  FilePlus2,
  FileText,
  Loader2,
  PanelBottom,
  PanelRight,
  Play,
  Plus,
  RotateCcw,
  TerminalSquare,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ensureTerminalSession,
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

async function pasteFromClipboard(sessionId: string, terminal: Terminal, event?: ClipboardEvent) {
  terminal.focus();
  const text = await readClipboardText(event);
  if (!text) {
    return;
  }

  const normalizedText = normalizePastedText(text);
  if ("paste" in terminal && typeof terminal.paste === "function") {
    terminal.paste(normalizedText);
    return;
  }

  await writeTerminal(sessionId, normalizedText.replace(/\n/g, "\r"));
}

function commandForShell(command: string, runImmediately: boolean) {
  const normalized = command.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return runImmediately ? `${normalized}\r` : normalized;
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
      className={cn("grid h-full min-h-0", node.direction === "horizontal" ? "grid-rows-1" : "grid-cols-1")}
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
    sessions,
    setActivePane,
    setActivePaneTab,
    splitActivePane,
    templateInstances,
  } = useCortexStore();
  const layout = layouts.find((item) => item.workspaceId === workspaceId);
  const active = layout?.activePaneId === node.id;
  const activeTabId = node.activeTabId && node.tabIds.includes(node.activeTabId)
    ? node.activeTabId
    : node.tabIds[0] ?? null;
  const session = sessions.find((item) => item.id === activeTabId);
  const template = templateInstances.find((item) => item.id === activeTabId);
  const workspaceItems = [
    ...sessions
      .filter((item) => item.workspaceId === workspaceId)
      .map((item) => ({ id: item.id, label: item.name, kind: "terminal" as const, item })),
    ...templateInstances
      .filter((item) => item.workspaceId === workspaceId)
      .map((item) => ({ id: item.id, label: item.title, kind: "note" as const, item })),
  ];
  const paneTabs = node.tabIds
    .map((tabId) => workspaceItems.find((item) => item.id === tabId))
    .filter(Boolean);

  const createTerminalInPane = () => {
    setActivePane(workspaceId, node.id);
    createSession(workspaceId);
  };

  const createNoteInPane = () => {
    setActivePane(workspaceId, node.id);
    createTemplateInstance(workspaceId, {
      templateId: "workspace-note",
      kind: "note",
      title: "Untitled note",
      content: "",
    });
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    const tabId = event.dataTransfer.getData("application/x-cortex-tab");
    if (!tabId) {
      return;
    }
    moveTabToPane(workspaceId, tabId, node.id);
  };

  const split = (direction: "horizontal" | "vertical", move = false) => {
    setActivePane(workspaceId, node.id);
    splitActivePane(workspaceId, direction, move);
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

  return (
    <div
      className={cn("flex h-full min-h-0 flex-col border border-transparent", active && "border-primary/35")}
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
                onClick={() => setActivePaneTab(workspaceId, node.id, entry.id)}
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
                {entry.kind === "terminal" ? (
                  <TerminalSquare className="h-3.5 w-3.5 text-primary" />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-primary" />
                )}
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
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <Button size="icon" variant="ghost" onClick={() => split("horizontal")} title="Split right">
            <PanelRight className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => split("vertical")} title="Split down">
            <PanelBottom className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => split("horizontal", true)} title="Split and move tab right">
            <PanelRight className="h-4 w-4 text-cortex-amber" />
          </Button>
          <Button size="icon" variant="ghost" onClick={() => split("vertical", true)} title="Split and move tab down">
            <PanelBottom className="h-4 w-4 text-cortex-amber" />
          </Button>
          <Button size="icon" variant="ghost" onClick={createNoteInPane} title="New note in pane">
            <FilePlus2 className="h-4 w-4" />
          </Button>
          <Button size="icon" variant="ghost" onClick={createTerminalInPane} title="New terminal in pane">
            <TerminalSquare className="h-4 w-4" />
          </Button>
          {node.tabIds.length === 0 && (
            <Button size="icon" variant="ghost" onClick={() => closePane(workspaceId, node.id)} title="Close empty pane">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1">
        {!session && !template && (
          <div className="grid h-full place-items-center p-5 text-center">
            <div>
              <div className="text-sm font-medium">Drag a tab here or create a new terminal/note.</div>
              <div className="mt-4 flex items-center justify-center gap-2">
                <Button size="sm" onClick={createTerminalInPane}>
                  <TerminalSquare className="mr-2 h-4 w-4" />
                  New terminal
                </Button>
                <Button size="sm" variant="outline" onClick={createNoteInPane}>
                  <FilePlus2 className="mr-2 h-4 w-4" />
                  New note
                </Button>
              </div>
            </div>
          </div>
        )}
        {session && <TerminalPane paneId={node.id} session={session} workspaceId={workspaceId} />}
        {template && <NotesPane paneId={node.id} template={template} workspaceId={workspaceId} />}
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
  const [terminalStartToken, setTerminalStartToken] = useState(0);
  const [terminalClearToken, setTerminalClearToken] = useState(0);
  const [connectionState, setConnectionState] = useState<{
    status: "idle" | "loading" | "connected" | "exited" | "error";
    error: string | null;
  }>({ status: "idle", error: null });
  const {
    appendTerminalHistory,
    clearTerminalHistory,
    duplicateSession,
    profiles,
    setActivePaneTab,
    setSessionProfile,
    setSessionStatus,
  } = useCortexStore();
  const activeProfile = profiles.find((profile) => profile.id === session.profileId);
  const terminalStopped =
    session.status === "inactive" || session.status === "completed" || session.status === "error";

  const startNewShell = () => {
    appendTerminalHistory(session.id, "\r\n--- New terminal session started ---\r\n");
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
    if (session.terminalHistory) {
      terminal.write(session.terminalHistory);
    }
    fitAddon.fit();

    const unsubscribe = subscribeTerminalSession(session.id, {
      onData: (data) => terminal.write(data),
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

    const syncSize = () => {
      fitAddon.fit();
      void resizeTerminal(session.id, terminal.rows, terminal.cols);
    };

    const dataDisposable = terminal.onData((data) => {
      void writeTerminal(session.id, data);
    });

    const pasteClipboard = (event?: ClipboardEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      void pasteFromClipboard(session.id, terminal, event).catch((error) => {
        if (!disposed) {
          setConnectionState({ status: "error", error: `Paste failed: ${String(error)}` });
        }
      });
    };

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
        session.cwd,
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
      terminalElement.removeEventListener("paste", pasteListener, true);
      terminalElement.removeEventListener("contextmenu", contextMenuListener, true);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [
    activeProfile,
    session.cwd,
    session.id,
    session.profileId,
    setSessionStatus,
    terminalClearToken,
    terminalStartToken,
  ]);

  return (
    <div className="flex h-full min-h-0 flex-col">
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
              Restart
            </Button>
          )}
        </div>
      </div>
      <div className="relative min-h-0 flex-1 overflow-hidden">
        <div ref={terminalRef} className="h-full min-h-0" />
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
              Shell is stopped
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              Scrollback is preserved locally. Restarting opens a fresh shell for this tab.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Button size="sm" onClick={startNewShell}>
                <Play className="mr-2 h-4 w-4" />
                Restart shell
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
