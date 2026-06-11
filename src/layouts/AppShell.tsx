import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { Building2, ClipboardList, Code2, ExternalLink, FolderPlus, HardDrive, Plus, Search, ShieldCheck, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CortexLogo } from "@/components/CortexLogo";
import { OFFICE_VIEW_ADDON_ENABLED } from "@/config/marketplace";
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { SavedCommandsModal } from "@/features/commands/components/SavedCommandsModal";
import { MarketplaceModal } from "@/features/marketplace/components/MarketplaceModal";
import { createOfficeWindowChannel, openOfficeWindow, publishOfficeSnapshot, requestOfficeSnapshot, requestTerminalFocus, type OfficeWindowSnapshot } from "@/features/office/officeWindow";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { TerminalPanel } from "@/features/terminal/components/TerminalPanel";
import { focusTerminal, terminateTerminals, writeTerminal } from "@/features/terminal/terminalBridge";
import { Sidebar } from "@/layouts/Sidebar";
import { useCortexStore } from "@/stores/cortexStore";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const OfficeView = lazy(() =>
  import("@/features/office/OfficeView").then((module) => ({ default: module.OfficeView })),
);

function commandForShell(command: string) {
  return `${command.replace(/\r\n/g, "\n").replace(/\r/g, "\n").replace(/\n/g, "\r")}\r`;
}

function officeWindowSnapshot(): OfficeWindowSnapshot {
  const state = useCortexStore.getState();
  const visibleSessions = state.sessions.filter((session) => ["running", "waiting", "error"].includes(session.status));
  const visibleIds = new Set(visibleSessions.map((session) => session.id));
  return {
    activeWorkspaceId: state.activeWorkspaceId,
    workspaces: state.workspaces,
    sessions: visibleSessions.map((session) => ({ ...session, terminalHistory: session.terminalHistory.slice(-2_000) })),
    commandHistory: state.commandHistory.filter((entry) => visibleIds.has(entry.sessionId)).slice(-100),
  };
}

export function AppShell() {
  const location = useLocation();
  const navigate = useNavigate();
  const officeDeepLink = location.pathname === "/office";
  const officeWindowMode = officeDeepLink && new URLSearchParams(location.search).get("mode") === "window";
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
    setActiveItem,
    setActiveWorkspace,
    setOfficeViewEnabled,
    settings,
    appendTerminalHistory,
    setSessionStatus,
    templateInstances,
    workspaces,
  } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const activeLayout = layouts.find((layout) => layout.workspaceId === activeWorkspaceId);
  const officeViewEnabled = OFFICE_VIEW_ADDON_ENABLED && (activeLayout?.officeViewEnabled ?? officeDeepLink);
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

  const openProjectInVsCode = () => {
    if (!activeWorkspace?.defaultWorkingDirectory) return;
    void invoke("open_project_in_vscode", { path: activeWorkspace.defaultWorkingDirectory }).catch((error) => {
      console.warn("Could not open project in VS Code", error);
    });
  };

  const openTerminalFromOffice = useCallback((terminalId: string) => {
    const session = useCortexStore.getState().sessions.find((item) => item.id === terminalId);
    if (!session) {
      return;
    }
    if (session.workspaceId !== activeWorkspaceId) setActiveWorkspace(session.workspaceId);
    setActiveItem(session.workspaceId, terminalId);
    setOfficeViewEnabled(session.workspaceId, false);
    navigate("/");
    window.setTimeout(() => focusTerminal(terminalId), 100);
  }, [activeWorkspaceId, navigate, setActiveItem, setActiveWorkspace, setOfficeViewEnabled]);

  const setWorkspaceView = useCallback((officeEnabled: boolean) => {
    if (!activeWorkspaceId || (officeEnabled && !OFFICE_VIEW_ADDON_ENABLED)) {
      return;
    }
    setOfficeViewEnabled(activeWorkspaceId, officeEnabled);
    if (!officeEnabled || officeDeepLink) {
      navigate("/");
    }
  }, [activeWorkspaceId, navigate, officeDeepLink, setOfficeViewEnabled]);

  const toggleOfficeView = useCallback(
    () => setWorkspaceView(!officeViewEnabled),
    [officeViewEnabled, setWorkspaceView],
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (!hydrated || !officeDeepLink || officeWindowMode || !activeWorkspaceId || !OFFICE_VIEW_ADDON_ENABLED) {
      return;
    }
    setOfficeViewEnabled(activeWorkspaceId, true);
  }, [activeWorkspaceId, hydrated, officeDeepLink, officeWindowMode, setOfficeViewEnabled]);

  const officeChannelRef = useRef<BroadcastChannel | null>(null);
  useEffect(() => {
    if (!hydrated) return;
    let publishTimer: number | null = null;
    let channel: BroadcastChannel | null = null;
    channel = createOfficeWindowChannel((message) => {
      if (officeWindowMode && message.type === "snapshot") {
        useCortexStore.setState((state) => ({ ...state, ...message.snapshot }));
        return;
      }
      if (!officeWindowMode && message.type === "requestSnapshot") publishOfficeSnapshot(channel, officeWindowSnapshot());
      if (!officeWindowMode && message.type === "focusTerminal") openTerminalFromOffice(message.terminalId);
    });
    officeChannelRef.current = channel;
    if (officeWindowMode) {
      requestOfficeSnapshot(channel);
    } else {
      const unsubscribe = useCortexStore.subscribe(() => {
        if (publishTimer !== null) return;
        publishTimer = window.setTimeout(() => {
          publishTimer = null;
          publishOfficeSnapshot(channel, officeWindowSnapshot());
        }, 500);
      });
      return () => {
        unsubscribe();
        if (publishTimer !== null) window.clearTimeout(publishTimer);
        channel?.close();
        officeChannelRef.current = null;
      };
    }
    return () => { channel?.close(); officeChannelRef.current = null; };
  }, [hydrated, officeDeepLink, officeWindowMode, openTerminalFromOffice]);

  useEffect(() => {
    if (
      !hydrated ||
      officeWindowMode ||
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
  }, [hydrated, officeWindowMode, settings.updateCheckMode]);

  useEffect(() => {
    if (officeWindowMode || !activeWorkspace?.autoStartTerminalsOnOpen) {
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
  }, [activeWorkspace, appendTerminalHistory, officeWindowMode, sessions, setSessionStatus]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      if (officeWindowMode) return;
      const sessionIds = useCortexStore.getState().sessions.map((session) => session.id);
      void terminateTerminals(sessionIds);
      void saveNow();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [officeWindowMode, saveNow]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.tagName === "SELECT" ||
        target?.isContentEditable;
      const paletteShortcut = (event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k";

      if (event.key === "Escape" && officeViewEnabled && !officeWindowMode && !commandPaletteOpen) {
        event.preventDefault();
        setWorkspaceView(false);
        return;
      }

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
  }, [commandPaletteOpen, officeViewEnabled, officeWindowMode, setWorkspaceView]);

  if (officeWindowMode) {
    return <div className="flex h-full overflow-hidden bg-background text-foreground"><Suspense fallback={<div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading Office View…</div>}><OfficeView externalWindow onClose={() => undefined} onTerminalSelect={(terminalId) => requestTerminalFocus(officeChannelRef.current, terminalId)} /></Suspense></div>;
  }

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      <Sidebar
        collapsed={sidebarCollapsed}
        officeActive={officeViewEnabled}
        officeAvailable={OFFICE_VIEW_ADDON_ENABLED}
        onOfficeOpen={toggleOfficeView}
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
                : "Terminais, comandos e contexto local"}
            </p>
          </div>

          <div className="flex items-center gap-2">
            {OFFICE_VIEW_ADDON_ENABLED && activeWorkspace && (
              <div className="hidden h-9 items-center rounded-md border border-border bg-secondary/70 p-1 sm:flex" aria-label="Workspace view">
                <button
                  className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs transition-colors ${!officeViewEnabled ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setWorkspaceView(false)}
                  type="button"
                >
                  <TerminalSquare className="h-3.5 w-3.5" /> Terminal
                </button>
                <button
                  className={`flex h-7 items-center gap-1.5 rounded px-2 text-xs transition-colors ${officeViewEnabled ? "bg-primary/15 text-primary shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                  onClick={() => setWorkspaceView(true)}
                  type="button"
                >
                  <Building2 className="h-3.5 w-3.5" /> Office
                  {officeViewEnabled && <span className="h-1.5 w-1.5 rounded-full bg-cortex-green" />}
                </button>
              </div>
            )}
            {OFFICE_VIEW_ADDON_ENABLED && activeWorkspace && <Button className="hidden gap-2 sm:inline-flex" size="sm" variant="outline" onClick={() => void openOfficeWindow()} title="Open Office in a separate window"><ExternalLink className="h-4 w-4" /><span className="hidden xl:inline">Open Office Window</span></Button>}
            {!officeViewEnabled && <Button
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
            </Button>}
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
            <Button
              className="hidden gap-2 lg:inline-flex"
              disabled={!activeWorkspace?.defaultWorkingDirectory}
              onClick={openProjectInVsCode}
              size="sm"
              title={activeWorkspace?.defaultWorkingDirectory ? "Abrir projeto no VS Code" : "Defina a pasta do workspace primeiro"}
              variant="outline"
            >
              <Code2 className="h-4 w-4" />
              VS Code
            </Button>
            {!officeViewEnabled && !officeDeepLink && <label
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
            </label>}
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

        <div className={officeViewEnabled ? "hidden" : "contents"}>
          <TerminalPanel workspaceId={activeWorkspaceId} />
        </div>
        {officeViewEnabled && (
          <Suspense fallback={<div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading Office View…</div>}>
            <OfficeView onClose={() => setWorkspaceView(false)} onTerminalSelect={openTerminalFromOffice} />
          </Suspense>
        )}
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        officeAvailable={OFFICE_VIEW_ADDON_ENABLED}
        officeViewEnabled={officeViewEnabled}
        onOfficeOpen={() => setWorkspaceView(true)}
        onOfficeToggle={toggleOfficeView}
        onTerminalViewOpen={() => setWorkspaceView(false)}
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
