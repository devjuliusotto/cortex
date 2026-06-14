import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { onAction } from "@tauri-apps/plugin-notification";
import { Building2, Code2, Download, ExternalLink, Plus, Search, TerminalSquare, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CortexLogo } from "@/components/CortexLogo";
import { clearPendingAgentAttention, getPendingAgentAttention, type AgentAttentionTarget } from "@/features/agents/agentAttention";
import { OFFICE_VIEW_ADDON_ENABLED } from "@/config/marketplace";
import { CommandPalette } from "@/features/command-palette/components/CommandPalette";
import { MyAgentsPage } from "@/features/my-agents/MyAgentsPage";
import { MarketplaceModal } from "@/features/marketplace/components/MarketplaceModal";
import { createOfficeWindowChannel, openOfficeWindow, publishOfficeSnapshot, requestOfficeSnapshot, requestTerminalFocus, type OfficeWindowSnapshot } from "@/features/office/officeWindow";
import { SettingsModal } from "@/features/settings/components/SettingsModal";
import { TerminalPanel } from "@/features/terminal/components/TerminalPanel";
import { focusTerminal, terminateTerminals } from "@/features/terminal/terminalBridge";
import { Sidebar } from "@/layouts/Sidebar";
import { useCortexStore } from "@/stores/cortexStore";
import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router";

const OfficeView = lazy(() =>
  import("@/features/office/OfficeView").then((module) => ({ default: module.OfficeView })),
);

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
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [availableUpdate, setAvailableUpdate] = useState<Update | null>(null);
  const [installingUpdate, setInstallingUpdate] = useState(false);
  const [activeView, setActiveView] = useState<"workspace" | "office" | "my-agents">("workspace");
  const {
    activeWorkspaceId,
    createSession,
    hydrated,
    hydrate,
    layouts,
    saveNow,
    sessions,
    setActiveItem,
    setActivePaneTab,
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
  const officeAvailable = OFFICE_VIEW_ADDON_ENABLED && settings.officeViewEnabled;
  const officeViewEnabled = officeAvailable && (activeLayout?.officeViewEnabled ?? officeDeepLink);
  const itemCount = activeWorkspace
    ? sessions.filter((session) => session.workspaceId === activeWorkspace.id).length
      + templateInstances.filter((template) => template.workspaceId === activeWorkspace.id).length
    : 0;

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

  const openAttentionTarget = useCallback((target: AgentAttentionTarget) => {
    setActiveWorkspace(target.workspaceId);
    setOfficeViewEnabled(target.workspaceId, false);
    setActivePaneTab(target.workspaceId, target.paneId, target.sessionId);
    setActiveView("workspace");
    navigate("/");
    clearPendingAgentAttention(target.sessionId);
    window.setTimeout(() => focusTerminal(target.sessionId), 120);
  }, [navigate, setActivePaneTab, setActiveWorkspace, setOfficeViewEnabled]);

  const setWorkspaceView = useCallback((officeEnabled: boolean) => {
    if (!activeWorkspaceId || (officeEnabled && !officeAvailable)) {
      return;
    }
    setOfficeViewEnabled(activeWorkspaceId, officeEnabled);
    if (!officeEnabled || officeDeepLink) {
      navigate("/");
    }
  }, [activeWorkspaceId, navigate, officeAvailable, officeDeepLink, setOfficeViewEnabled]);

  const toggleOfficeView = useCallback(
    () => setWorkspaceView(!officeViewEnabled),
    [officeViewEnabled, setWorkspaceView],
  );

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    if (officeWindowMode || !("__TAURI_INTERNALS__" in window)) return;
    const appWindow = getCurrentWindow();
    let unlistenFocus: (() => void) | undefined;
    let notificationListener: { unregister: () => Promise<void> } | undefined;

    void appWindow.onFocusChanged(({ payload: focused }) => {
      if (!focused) return;
      void appWindow.requestUserAttention(null).catch(() => undefined);
      const target = getPendingAgentAttention();
      if (target) openAttentionTarget(target);
    }).then((unlisten) => { unlistenFocus = unlisten; });

    void onAction((notification) => {
      const extra = notification.extra;
      const pending = getPendingAgentAttention();
      const target = extra?.workspaceId && extra?.paneId && extra?.sessionId
        ? {
            workspaceId: String(extra.workspaceId),
            paneId: String(extra.paneId),
            sessionId: String(extra.sessionId),
            sessionName: pending?.sessionName ?? "Agent terminal",
          }
        : pending;
      if (target) openAttentionTarget(target);
    }).then((listener) => { notificationListener = listener; });

    return () => {
      unlistenFocus?.();
      void notificationListener?.unregister();
    };
  }, [officeWindowMode, openAttentionTarget]);

  useEffect(() => {
    if (!hydrated || !officeDeepLink || officeWindowMode || !activeWorkspaceId || !officeAvailable) {
      return;
    }
    setOfficeViewEnabled(activeWorkspaceId, true);
  }, [activeWorkspaceId, hydrated, officeAvailable, officeDeepLink, officeWindowMode, setOfficeViewEnabled]);

  useEffect(() => {
    if (officeAvailable || !activeWorkspaceId || !activeLayout?.officeViewEnabled) return;
    setOfficeViewEnabled(activeWorkspaceId, false);
    if (officeDeepLink) navigate("/");
  }, [activeLayout?.officeViewEnabled, activeWorkspaceId, navigate, officeAvailable, officeDeepLink, setOfficeViewEnabled]);

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
        if (update) setAvailableUpdate(update);
      } catch (error) {
        console.warn("Automatic update check failed", error);
      }
    })();
  }, [hydrated, officeWindowMode, settings.updateCheckMode]);

  const installAvailableUpdate = async () => {
    if (!availableUpdate || installingUpdate) return;
    setInstallingUpdate(true);
    try {
      await availableUpdate.downloadAndInstall();
      await relaunch();
    } catch (error) {
      console.warn("Update installation failed", error);
      setInstallingUpdate(false);
    }
  };

  useEffect(() => {
    if (officeWindowMode || !settings.autoStartTerminals || !activeWorkspace?.autoStartTerminalsOnOpen) {
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
  }, [activeWorkspace, appendTerminalHistory, officeWindowMode, sessions, setSessionStatus, settings.autoStartTerminals]);

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

      if ((event.ctrlKey || event.metaKey) && event.key === ",") {
        event.preventDefault();
        setSettingsOpen(true);
        return;
      }

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
        activeView={activeView}
        collapsed={sidebarCollapsed}
        officeActive={officeViewEnabled}
        officeAvailable={officeAvailable}
        onOfficeOpen={() => {
          setActiveView("workspace");
          toggleOfficeView();
        }}
        onMarketplaceOpen={() => setMarketplaceOpen(true)}
        onMyAgentsOpen={() => {
          setWorkspaceView(false);
          setActiveView("my-agents");
        }}
        onSettingsOpen={() => setSettingsOpen(true)}
        onToggle={() => setSidebarCollapsed((value) => !value)}
        onWorkspaceOpen={(workspaceId) => {
          if (workspaceId) {
            setOfficeViewEnabled(workspaceId, false);
          } else {
            setWorkspaceView(false);
          }
          navigate("/");
          setActiveView("workspace");
        }}
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
            {officeAvailable && activeWorkspace && (
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
            {officeAvailable && activeWorkspace && <Button className="hidden gap-2 sm:inline-flex" size="sm" variant="outline" onClick={() => void openOfficeWindow()} title="Open Office in a separate window"><ExternalLink className="h-4 w-4" /><span className="hidden xl:inline">Open Office Window</span></Button>}
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

        {activeView === "my-agents" ? (
          <MyAgentsPage />
        ) : (
          <>
            <div className={officeViewEnabled ? "hidden" : "contents"}>
              <TerminalPanel workspaceId={activeWorkspaceId} />
            </div>
            {officeViewEnabled && (
              <Suspense fallback={<div className="grid flex-1 place-items-center text-sm text-muted-foreground">Loading Office View…</div>}>
                <OfficeView onClose={() => setWorkspaceView(false)} onTerminalSelect={openTerminalFromOffice} />
              </Suspense>
            )}
          </>
        )}
      </main>
      <CommandPalette
        open={commandPaletteOpen}
        onClose={() => setCommandPaletteOpen(false)}
        officeAvailable={officeAvailable}
        officeViewEnabled={officeViewEnabled}
        onOfficeOpen={() => setWorkspaceView(true)}
        onOfficeToggle={toggleOfficeView}
        onTerminalViewOpen={() => setWorkspaceView(false)}
      />
      <MarketplaceModal open={marketplaceOpen} onClose={() => setMarketplaceOpen(false)} />
      <SettingsModal open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      {availableUpdate && <aside className="fixed bottom-4 left-4 z-[70] w-[min(360px,calc(100vw-2rem))] rounded-lg border border-primary/30 bg-card/95 p-4 shadow-2xl backdrop-blur"><div className="flex items-start gap-3"><span className="grid h-9 w-9 shrink-0 place-items-center rounded-md bg-primary/10 text-primary"><Download className="h-4 w-4" /></span><div className="min-w-0 flex-1"><div className="text-sm font-semibold">Cortex {availableUpdate.version} is available</div><p className="mt-1 text-xs leading-5 text-muted-foreground">Update automatically and restart Cortex when the download is complete.</p></div><Button size="icon" variant="ghost" onClick={() => setAvailableUpdate(null)} title="Remind me later"><X className="h-4 w-4" /></Button></div><div className="mt-4 flex justify-end gap-2"><Button size="sm" variant="ghost" onClick={() => setAvailableUpdate(null)}>Later</Button><Button size="sm" disabled={installingUpdate} onClick={() => void installAvailableUpdate()}><Download className="mr-2 h-4 w-4" />{installingUpdate ? "Updating..." : "Update now"}</Button></div></aside>}
    </div>
  );
}
