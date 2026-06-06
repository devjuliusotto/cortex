import { Activity, AlertTriangle, ArrowLeft, CheckCircle2, Monitor } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCortexStore } from "@/stores/cortexStore";
import { createOfficeDesks, summarizeOffice } from "./officeModel";
import { OfficeStage } from "./components/OfficeStage";
import type { OfficeDeskModel } from "./officeTypes";

type OfficeViewProps = {
  onClose: () => void;
  onTerminalSelect: (terminalId: string) => void;
};

export function OfficeView({ onClose, onTerminalSelect }: OfficeViewProps) {
  const activeWorkspaceId = useCortexStore((state) => state.activeWorkspaceId);
  const workspace = useCortexStore((state) =>
    state.workspaces.find((item) => item.id === state.activeWorkspaceId),
  );
  const desks = useOfficeDesks(activeWorkspaceId);
  const summary = useMemo(() => summarizeOffice(desks), [desks]);

  if (!activeWorkspaceId || !workspace) {
    return (
      <div className="grid flex-1 place-items-center p-6 text-center">
        <div>
          <Monitor className="mx-auto h-8 w-8 text-muted-foreground" />
          <h2 className="mt-3 text-sm font-semibold">No office to open</h2>
          <p className="mt-1 text-xs text-muted-foreground">Select or create a workspace first.</p>
          <Button className="mt-4" size="sm" variant="outline" onClick={onClose}>Back to workspace</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between border-b border-border bg-card/35 px-4 py-2">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Monitor className="h-4 w-4 text-primary" />
            Office View
            <span className="rounded border border-primary/20 bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">MVP</span>
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">A live, lightweight map of {workspace.name}</p>
        </div>
        <Button size="sm" variant="outline" onClick={onClose}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Workspace
        </Button>
      </div>

      <div className="grid min-h-0 flex-1 gap-3 p-3 xl:grid-cols-[minmax(0,1fr)_260px]">
        <OfficeStage desks={desks} workspaceName={workspace.name} onDeskSelect={onTerminalSelect} />

        <aside className="grid content-start gap-3 overflow-y-auto rounded-md border border-border bg-card/55 p-3">
          <div className="grid grid-cols-3 gap-2 xl:grid-cols-1">
            <Stat icon={<Activity className="h-4 w-4 text-primary" />} label="Active agents" value={summary.active} />
            <Stat icon={<AlertTriangle className="h-4 w-4 text-cortex-red" />} label="Errors" value={summary.errors} />
            <Stat icon={<Monitor className="h-4 w-4 text-cortex-amber" />} label="Desks" value={summary.total} />
          </div>

          <section className="rounded-md border border-border bg-background/60 p-3">
            <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
              <CheckCircle2 className="h-3.5 w-3.5 text-cortex-green" />
              Last activity
            </div>
            <p className="mt-2 break-words font-mono text-xs leading-5 text-foreground">{summary.lastActivity}</p>
          </section>

          <section>
            <h3 className="mb-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">Floor roster</h3>
            <div className="grid gap-1.5">
              {desks.map((desk) => (
                <button
                  key={desk.id}
                  className="flex items-center justify-between rounded-md border border-transparent bg-background/45 px-2.5 py-2 text-left text-xs transition-colors hover:border-primary/30 hover:bg-secondary"
                  onClick={() => onTerminalSelect(desk.id)}
                  type="button"
                >
                  <span className="min-w-0 truncate">{desk.terminalName}</span>
                  <span className={desk.signal === "warning" ? "text-cortex-red" : desk.signal === "success" ? "text-cortex-green" : desk.signal === "active" ? "text-primary" : "text-muted-foreground"}>
                    {desk.sessionStatus}
                  </span>
                </button>
              ))}
            </div>
          </section>
        </aside>
      </div>
    </div>
  );
}

function readOfficeDesks(workspaceId: string | null) {
  if (!workspaceId) {
    return [];
  }
  const state = useCortexStore.getState();
  return createOfficeDesks(
    state.sessions.filter((session) => session.workspaceId === workspaceId),
    state.commandHistory.filter((entry) => entry.workspaceId === workspaceId),
  );
}

function useOfficeDesks(workspaceId: string | null) {
  const [desks, setDesks] = useState<OfficeDeskModel[]>(() => readOfficeDesks(workspaceId));

  useEffect(() => {
    let timer: number | null = null;
    let currentSignature = "";

    const refresh = () => {
      timer = null;
      const next = readOfficeDesks(workspaceId);
      const signature = next.map((desk) => `${desk.id}:${desk.signal}:${desk.sessionStatus}:${desk.activity}`).join("|");
      if (signature !== currentSignature) {
        currentSignature = signature;
        setDesks(next);
      }
    };

    refresh();
    const unsubscribe = useCortexStore.subscribe(() => {
      if (timer === null) {
        timer = window.setTimeout(refresh, 400);
      }
    });

    return () => {
      unsubscribe();
      if (timer !== null) {
        window.clearTimeout(timer);
      }
    };
  }, [workspaceId]);

  return desks;
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: number }) {
  return (
    <div className="rounded-md border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">{icon}{label}</div>
      <div className="mt-1 font-mono text-xl font-semibold">{value}</div>
    </div>
  );
}
