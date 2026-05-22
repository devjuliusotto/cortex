import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { invoke } from "@tauri-apps/api/core";
import { FitAddon } from "@xterm/addon-fit";
import { Terminal } from "@xterm/xterm";
import { motion } from "framer-motion";
import { AlertCircle, Columns3, FilePlus2, FileText, Loader2, Plus, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TerminalTabs } from "@/features/terminal/components/TerminalTabs";
import {
  ensureTerminalSession,
  resizeTerminal,
  subscribeTerminalSession,
  writeTerminal,
} from "@/features/terminal/terminalBridge";
import { useCortexStore, type TerminalProfileId } from "@/stores/cortexStore";

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

async function pasteFromClipboard(
  sessionId: string,
  terminal: Terminal,
  event?: ClipboardEvent,
) {
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

export function TerminalPanel({ workspaceId }: TerminalPanelProps) {
  const terminalRef = useRef<HTMLDivElement | null>(null);
  const [terminalStartToken, setTerminalStartToken] = useState(0);
  const [connectionState, setConnectionState] = useState<{
    status: "idle" | "loading" | "connected" | "exited" | "error";
    error: string | null;
  }>({ status: "idle", error: null });
  const {
    createSession,
    createTemplateInstance,
    createWorkspace,
    appendTerminalHistory,
    layouts,
    profiles,
    sessions,
    setSessionProfile,
    setSessionStatus,
    templateInstances,
    updateTemplateInstanceContent,
    workspaces,
  } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === workspaceId);
  const layout = layouts.find((item) => item.workspaceId === workspaceId);
  const activeItemId = layout?.activeItemId ?? layout?.activeSessionId;
  const activeSession = sessions.find((session) => session.id === activeItemId);
  const activeTemplate = templateInstances.find((template) => template.id === activeItemId);
  const activeProfile = profiles.find((profile) => profile.id === activeSession?.profileId);
  const activeSessionId = activeSession?.id;
  const activeSessionProfileId = activeSession?.profileId;
  const activeSessionStatus = activeSession?.status;
  const activeSessionHistory = activeSession?.terminalHistory ?? "";
  const terminalStopped =
    activeSessionStatus === "inactive" ||
    activeSessionStatus === "completed" ||
    activeSessionStatus === "error";
  const startNewShell = () => {
    if (!activeSession) {
      return;
    }

    appendTerminalHistory(activeSession.id, "\r\n--- New terminal session started ---\r\n");
    setSessionStatus(activeSession.id, "running");
    setTerminalStartToken((value) => value + 1);
  };

  useEffect(() => {
    if (!terminalRef.current || !activeSessionId || !activeSessionProfileId || !activeProfile) {
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
        black: "#0b0d10",
        blue: "#82aaff",
        cyan: "#56f0ff",
        green: "#7af7a6",
        magenta: "#c792ea",
        red: "#ff6b81",
        white: "#dce7ef",
        yellow: "#ffcb6b",
      },
    });
    const fitAddon = new FitAddon();

    terminal.loadAddon(fitAddon);
    terminal.open(terminalRef.current);
    if (activeSessionHistory) {
      terminal.write(activeSessionHistory);
    }
    fitAddon.fit();

    const unsubscribe = subscribeTerminalSession(activeSessionId, {
      onData: (data) => terminal.write(data),
      onStatus: (status, error) => {
        if (!disposed) {
          setConnectionState({ status, error });
          if (status === "connected") {
            setSessionStatus(activeSessionId, "running");
          } else if (status === "loading") {
            setSessionStatus(activeSessionId, "waiting");
          } else if (status === "exited") {
            setSessionStatus(activeSessionId, "completed");
          } else if (status === "error") {
            setSessionStatus(activeSessionId, "error");
          }
        }
      },
    });

    const syncSize = () => {
      fitAddon.fit();
      void resizeTerminal(activeSessionId, terminal.rows, terminal.cols);
    };

    const dataDisposable = terminal.onData((data) => {
      void writeTerminal(activeSessionId, data);
    });

    const pasteClipboard = (event?: ClipboardEvent) => {
      event?.preventDefault();
      event?.stopPropagation();
      void pasteFromClipboard(activeSessionId, terminal, event).catch((error) => {
        if (!disposed) {
          setConnectionState({ status: "error", error: `Paste failed: ${String(error)}` });
        }
      });
    };

    const pasteListener = (event: ClipboardEvent) => {
      pasteClipboard(event);
    };

    const keydownListener = (event: KeyboardEvent) => {
      const isPasteShortcut =
        (event.ctrlKey || event.metaKey) &&
        !event.altKey &&
        event.key.toLowerCase() === "v";

      if (!isPasteShortcut) {
        return;
      }

      pasteClipboard();
      event.preventDefault();
      event.stopPropagation();
    };

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
    terminalElement.addEventListener("keydown", keydownListener, true);
    terminalElement.addEventListener("contextmenu", contextMenuListener, true);

    if (activeSessionStatus === "running" || activeSessionStatus === "waiting") {
      setConnectionState({ status: "loading", error: null });
      void ensureTerminalSession(
        activeSessionId,
        activeSessionProfileId,
        terminal.rows,
        terminal.cols,
        activeWorkspace?.defaultWorkingDirectory,
      ).catch((error) => {
        if (!disposed) {
          setConnectionState({ status: "error", error: String(error) });
          setSessionStatus(activeSessionId, "error");
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
      terminalElement.removeEventListener("keydown", keydownListener, true);
      terminalElement.removeEventListener("contextmenu", contextMenuListener, true);
      resizeObserver.disconnect();
      terminal.dispose();
    };
  }, [
    activeProfile,
    activeSessionId,
    activeSessionProfileId,
    activeWorkspace?.defaultWorkingDirectory,
    setSessionStatus,
    terminalStartToken,
  ]);

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

  if (!activeSession && !activeTemplate) {
    return (
      <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border bg-cortex-graphite">
        <div className="flex h-11 items-center justify-between border-b border-border bg-card/80 px-3">
          <span className="text-sm text-muted-foreground">No workspace tabs</span>
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() =>
                createTemplateInstance(activeWorkspace.id, {
                  templateId: "workspace-note",
                  kind: "note",
                  title: "Untitled note",
                  content: "",
                })
              }
            >
              <FilePlus2 className="mr-2 h-4 w-4" />
              New Note
            </Button>
            <Button size="sm" onClick={() => createSession(activeWorkspace.id)}>
              <Plus className="mr-2 h-4 w-4" />
              New Terminal
            </Button>
          </div>
        </div>
        <EmptyPanel
          icon={<TerminalSquare className="h-6 w-6 text-primary" />}
          title="This workspace is empty"
          description="Create a terminal session or note to add a tab to this workspace."
          actionLabel="Create terminal"
          onAction={() => createSession(activeWorkspace.id)}
          framed={false}
        />
      </section>
    );
  }

  return (
    <motion.section
      animate={{ opacity: 1, y: 0 }}
      className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border bg-cortex-graphite"
      initial={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.18, ease: "easeOut" }}
    >
      <TerminalTabs workspaceId={activeWorkspace.id} />
      {activeTemplate && (
        <NotesTemplatePanel
          title={activeTemplate.title}
          content={activeTemplate.content}
          updatedAt={activeTemplate.updatedAt}
          onChange={(content) => updateTemplateInstanceContent(activeTemplate.id, content)}
        />
      )}
      {activeSession && (
      <div
        className={
          layout?.splitPanePreview
            ? "grid min-h-0 flex-1 grid-cols-[minmax(0,1fr)_320px]"
            : "grid min-h-0 flex-1 grid-cols-1"
        }
      >
        <div className="flex min-h-0 flex-col">
          <div className="flex h-10 items-center justify-between border-b border-border bg-background/50 px-4">
            <div className="min-w-0">
              <span className="truncate text-sm font-medium">{activeSession.name}</span>
              <span className="ml-2 text-xs text-muted-foreground">{activeProfile?.name}</span>
            </div>
            <select
              className="h-7 rounded-md border border-border bg-secondary px-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              onChange={(event) =>
                setSessionProfile(activeSession.id, event.target.value as TerminalProfileId)
              }
              value={activeSession.profileId}
            >
              {profiles.map((profile) => (
                <option key={profile.id} value={profile.id}>
                  {profile.name}
                </option>
              ))}
            </select>
            {terminalStopped && (
              <Button size="sm" variant="outline" onClick={startNewShell}>
                Start new shell
              </Button>
            )}
          </div>
          <div className="relative min-h-0 flex-1 overflow-hidden">
            <div ref={terminalRef} className="h-full min-h-0" />
            {connectionState.status === "loading" && (
              <TerminalOverlay
                icon={<Loader2 className="h-4 w-4 animate-spin text-primary" />}
                message="Starting terminal"
              />
            )}
            {connectionState.status === "error" && (
              <TerminalOverlay
                icon={<AlertCircle className="h-4 w-4 text-cortex-red" />}
                message={connectionState.error ?? "Terminal failed"}
              />
            )}
            {connectionState.status === "connected" && connectionState.error && (
              <TerminalOverlay
                icon={<AlertCircle className="h-4 w-4 text-yellow-400" />}
                message={connectionState.error}
              />
            )}
            {connectionState.status === "exited" && (
              <TerminalOverlay
                icon={<TerminalSquare className="h-4 w-4 text-muted-foreground" />}
                message="Terminal exited"
              />
            )}
            {activeSession.status === "inactive" && (
              <div className="absolute inset-0 grid place-items-center bg-cortex-graphite/80">
                <div className="rounded-md border border-border bg-card/95 p-5 text-center shadow-glow">
                  <TerminalSquare className="mx-auto mb-3 h-5 w-5 text-primary" />
                  <div className="text-sm font-medium">Terminal not running</div>
                  <Button
                    className="mt-4"
                    size="sm"
                    onClick={startNewShell}
                  >
                    Start new shell
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>

        {layout?.splitPanePreview && (
          <aside className="hidden border-l border-border bg-card/45 p-4 xl:block">
            <div className="mb-4 flex items-center gap-2">
              <Columns3 className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-medium text-foreground">Split Pane Placeholder</h2>
            </div>
            <p className="text-xs leading-5 text-muted-foreground">
              Advanced splitting is intentionally deferred. This space reserves the layout
              model for a future pane tree without adding unnecessary behavior to v0.1.
            </p>
          </aside>
        )}
      </div>
      )}
    </motion.section>
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

function EmptyPanel({
  icon,
  title,
  description,
  actionLabel,
  onAction,
  framed = true,
}: EmptyPanelProps) {
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

type TerminalOverlayProps = {
  icon: ReactNode;
  message: string;
};

function TerminalOverlay({ icon, message }: TerminalOverlayProps) {
  return (
    <div className="pointer-events-none absolute right-3 top-3 flex max-w-[min(28rem,calc(100%-1.5rem))] items-center gap-2 rounded-md border border-border bg-card/95 px-3 py-2 text-xs text-muted-foreground shadow-glow">
      {icon}
      <span className="truncate">{message}</span>
    </div>
  );
}

type NotesTemplatePanelProps = {
  title: string;
  content: string;
  updatedAt: string;
  onChange: (content: string) => void;
};

function NotesTemplatePanel({ title, content, updatedAt, onChange }: NotesTemplatePanelProps) {
  const [draft, setDraft] = useState(content);
  const [saved, setSaved] = useState(true);

  useEffect(() => {
    setDraft(content);
    setSaved(true);
  }, [content]);

  useEffect(() => {
    if (draft === content) {
      return;
    }

    setSaved(false);
    const timer = window.setTimeout(() => {
      onChange(draft);
      setSaved(true);
    }, 250);

    return () => window.clearTimeout(timer);
  }, [content, draft, onChange]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex h-10 items-center justify-between border-b border-border bg-background/50 px-4">
        <div className="flex min-w-0 items-center gap-2">
          <FileText className="h-4 w-4 text-primary" />
          <span className="truncate text-sm font-medium">{title}</span>
        </div>
        <span className="text-xs text-muted-foreground">
          {saved ? `Saved ${new Date(updatedAt).toLocaleTimeString()}` : "Saving..."}
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
