import { FolderPlus, HardDrive, Plus, ShieldCheck, TerminalSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { MarketplaceModal } from "@/features/marketplace/components/MarketplaceModal";
import { TerminalPanel } from "@/features/terminal/components/TerminalPanel";
import { terminateTerminals } from "@/features/terminal/terminalBridge";
import { Sidebar } from "@/layouts/Sidebar";
import { useCortexStore } from "@/stores/cortexStore";
import { useEffect, useState } from "react";

export function AppShell() {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [marketplaceOpen, setMarketplaceOpen] = useState(false);
  const {
    activeWorkspaceId,
    createSession,
    createWorkspace,
    hydrate,
    saveNow,
    sessions,
    templateInstances,
    workspaces,
  } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const itemCount = activeWorkspace
    ? sessions.filter((session) => session.workspaceId === activeWorkspace.id).length
      + templateInstances.filter((template) => template.workspaceId === activeWorkspace.id).length
    : 0;

  useEffect(() => {
    void hydrate();
  }, [hydrate]);

  useEffect(() => {
    const handleBeforeUnload = () => {
      const sessionIds = useCortexStore.getState().sessions.map((session) => session.id);
      void terminateTerminals(sessionIds);
      void saveNow();
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [saveNow]);

  return (
    <div className="flex h-full overflow-hidden bg-background text-foreground">
      <Sidebar
        collapsed={sidebarCollapsed}
        onMarketplaceOpen={() => setMarketplaceOpen(true)}
        onToggle={() => setSidebarCollapsed((value) => !value)}
      />
      <main className="flex min-w-0 flex-1 flex-col">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/70 px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="grid h-6 w-6 place-items-center rounded-md border border-primary/20 bg-primary/10">
                <TerminalSquare className="h-3.5 w-3.5 text-primary" />
              </span>
              <h1 className="truncate text-sm font-semibold">
                {activeWorkspace?.name ?? "Cortex"}
              </h1>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              {activeWorkspace
                ? `${itemCount} workspace item${itemCount === 1 ? "" : "s"}`
                : "Local-first Windows terminal manager"}
            </p>
          </div>

          <div className="flex items-center gap-2">
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
      <MarketplaceModal open={marketplaceOpen} onClose={() => setMarketplaceOpen(false)} />
    </div>
  );
}
