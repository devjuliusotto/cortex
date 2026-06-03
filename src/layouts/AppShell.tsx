import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ClipboardList, FolderPlus, HardDrive, Plus, Search, ShieldCheck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CortexLogo } from "@/components/CortexLogo";
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { SavedCommandsModal } from "@/features/commands/components/SavedCommandsModal";
import { MarketplaceModal } from "@/features/marketplace/components/MarketplaceModal";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { TerminalPanel } from "@/features/terminal/components/TerminalPanel";
import { focusTerminal, terminateTerminals, writeTerminal } from "@/features/terminal/terminalBridge";
import { Sidebar } from "@/layouts/Sidebar";
import { useCortexStore } from "@/stores/cortexStore";
import { useEffect, useRef, useState } from "react";

function commandForShell(command: string) {
  return `${command.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r")}\r`;
}

export function AppShell() {
  const autoStartedWorkspaceIds = useRef(new Set<string>());
  const autoUpdateChecked = useRef(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [savedCommandsOpen, setSavedCommandsOpen] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const {
    activeWorkspaceId,
    createSession,
    createWorkspace,
    hydrated,
    hydrate,
    layouts,
    saveNow,
    savedCommands,
    sessions,
    settings,
    appendTerminalHistory,
    setSessionStatus,
    templateInstances,
    workspaces,
  } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const activeLayout = layouts.find((layout) => layout.workspaceId === activeWorkspaceId);
  const activeItemTerminal = sessions.find(
    (session) => session.workspaceId === activeWorkspaceId && session.id === activeLayout?.activeItemId,
  );
  const activeTerminal = activeItemTerminal ?? sessions.find(
    (session) => session.workspaceId === activeWorkspaceId && session.id === activeLayout?.activeSessionId,
  );
  const sortedSavedCommands = savedCommands
    .slice()
    .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  const itemCount = activeWorkspace
    ? sessions.filter((session) => session.workspaceId === activeWorkspace.id).length
      + templateInstances.filter((template) => template.workspaceId === activeWorkspace.id).length
    : 0;

  const runSavedCommand = (commandId: string) => {
    const command = savedCommands.find((item) => item.id === commandId);
    if (!command || !activeTerminal) {
      return;
    }

    void writeTerminal(activeTerminal.id, commandForShell(command.command)).then(() => {
      focusTerminal(activeTerminal.id);
    });
  };

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (
      !hydrated ||
      settings.updateCheckMode !== "automatic" ||
      autoUpdateChecked.current ||
      !("__TAURI_INTERNALS__" in window)
    ) {
      return;
    }

    autoUpdateChecked.current = true;
    void (async () => {
      try {
        const update = await check();
        if (!update) {
          return;
        }

        const shouldInstall = window.confirm(
          `Cortex ${update.version} is available. Download, install, and restart now?`,
        );
        if (!shouldInstall) {
          return;
        }

        await update.downloadAndInstall();
        await relaunch();
      } catch (error) {
        console.warn("Automatic update check failed", error);
      }
    })();
  }, [hydrated, settings.updateCheckMode]);

  useEffect(() => {
    if (!activeWorkspace?.autoStartTerminalsOnOpen) {
      return;
    }
    if (autoStartedWorkspaceIds.current.has(activeWorkspace.id)) {
      return;
    }

    autoStartedWorkspaceIds.current.add(activeWorkspace.id);
    sessions
      .filter(
        (session) =>
          session.workspaceId === activeWorkspace.id &&
          ["inactive", "completed", "error"].includes(session.status),
      )
      .forEach((session) => {
        appendTerminalHistory(session.id, "\r\n--- New shell started ---\r\n");
        setSessionStatus(session.id, "running");
      });
  }, [activeWorkspace, appendTerminalHistory, sessions, setSessionStatus]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionIds = useCortexStore.getState().sessions.map((session) => session.id);
      void terminateTerminals(sessionIds);
      void saveNow();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveNow]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      const paletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (!paletteShortcut) {
        return;
      }

      event.preventDefault();
      if (isTyping && !commandPaletteOpen) {
        target?.blur();
      }
      setCommandPaletteOpen((value) => !value);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [commandPaletteOpen]);

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      <Sidebar
        collapsed={sidebarCollapsed}
        onMarketplaceOpen={() => setMarketplaceOpen(true)}
        onSavedCommandsOpen={() => setSavedCommandsOpen(true)}
        onSettingsOpen={() => setSettingsOpen(true)}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/70 px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <CortexLogo className="h-6 w-6 shrink-0 rounded-md" />
              <h1 className="truncate text-sm font-semibold">
                {activeWorkspace?.name ?? "Cortex"}
              </h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {activeWorkspace
                ? `${itemCount} workspace item${itemCount === 1 ? "" : "s"} · Workspace path: ${
                    activeWorkspace.defaultWorkingDirectory ?? "not set"
                  }`
                : "Local-first Windows terminal manager"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Button
              className="hidden gap-2 border-border bg-secondary/70 text-muted-foreground hover:text-foreground md:inline-flex"
              size="sm"
              variant="outline"
              onClick={() => setCommandPaletteOpen(true)}
              title="Open command palette"
            >
              <Search className="h-4 w-4" />
              <span>Palette</span>
              <kbd className="rounded border border-border bg-background px-1.5 py-0.5 text-[10px] text-muted-foreground">
                Ctrl K
              </kbd>
            </Button>
            <div className="hidden items-center gap-3 rounded-md border border-border bg-secondary/60 px-3 py-2 text-xs text-muted-foreground lg:flex">
              <span className="flex items-center gap-1.5">
                <HardDrive className="h-3.5 w-3.5 text-cortex-amber" />
                app data
              </span>
              <span className="flex items-center gap-1.5">
                <ShieldCheck className="h-3.5 w-3.5 text-cortex-green" />
                no telemetry
              </span>
            </div>
            <Button size="sm" variant="outline" onClick={createWorkspace}>
              <FolderPlus className="mr-2 h-4 w-4" />
              Workspace
            </Button>
            <label
              className="flex h-9 items-center gap-2 rounded-md border border-border bg-secondary px-3 text-xs text-muted-foreground"
              title={
                activeTerminal
                  ? "Run a saved command in the active terminal"
                  : "Select an active terminal before running a saved command"
              }
            >
              <ClipboardList className="h-4 w-4 text-primary" />
              <select
                className="max-w-48 bg-transparent text-xs text-foreground outline-none disabled:cursor-not-allowed disabled:text-muted-foreground"
                disabled={!activeTerminal || sortedSavedCommands.length === 0}
                onChange={(event) => {
                  runSavedCommand(event.target.value);
                  event.currentTarget.value = "";
                }}
                value=""
              >
                <option value="">Chamar comando</option>
                {sortedSavedCommands.map((command) => (
                  <option key={command.id} value={command.id}>
                    {command.category ? `${command.category} / ${command.title}` : command.title}
                  </option>
                ))}
              </select>
            </label>
            <Button
              size="sm"
              onClick={() => activeWorkspace && createSession(activeWorkspace.id)}
              disabled={!activeWorkspace}
            >
              <Plus className="mr-2 h-4 w-4" />
              Terminal
            </Button>
          </div>
        </header>

        <TerminalPanel workspaceId={activeWorkspaceId} />
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        onSavedCommandsOpen={() => {
          setCommandPaletteOpen(false);
          setSavedCommandsOpen(true);
        }}
      />
      <SavedCommandsModal open={savedCommandsOpen} onClose={() => setSavedCommandsOpen(false)} />
      <MarketplaceModal open={marketplaceOpen} onClose={() => setMarketplaceOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
    </div>
  );
}
