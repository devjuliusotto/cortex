import { Activity, AlertTriangle, ArrowLeft, Monitor } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCortexStore } from "@/stores/cortexStore";
import { OfficeStage } from "./components/OfficeStage";
import { AGENT_EXIT_DELAY_MS, officeTarget } from "./officeLayout";
import { createOfficeAgents, summarizeOffice } from "./officeModel";
import type { OfficeAgentModel } from "./officeTypes";

type OfficeViewProps = { onClose: () => void; onTerminalSelect: (terminalId: string) => void };

export function OfficeView({ onClose, onTerminalSelect }: OfficeViewProps) {
  const activeWorkspaceId = useCortexStore((state) => state.activeWorkspaceId);
  const workspace = useCortexStore((state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId));
  const agents = useOfficeAgents(activeWorkspaceId);
  const summary = useMemo(() => summarizeOffice(agents), [agents]);

  if (!activeWorkspaceId || !workspace) {
    return <div className="grid flex-1 place-items-center p-6 text-center"><div><Monitor className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">No office to open</h2><Button className="mt-4" size="sm" variant="outline" onClick={onClose}>Back to workspace</Button></div></div>;
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col bg-background">
      <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/35 px-4 py-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-semibold"><Monitor className="h-4 w-4 text-primary" />Office View <span className="truncate text-xs font-normal text-muted-foreground">{workspace.name}</span></div>
          <p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{summary.lastActivity}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <a className="hidden text-[10px] text-muted-foreground underline-offset-2 hover:text-foreground hover:underline lg:inline" href="https://github.com/pixel-agents-hq/pixel-agents" target="_blank" rel="noreferrer">Inspired by Pixel Agents</a>
          <span className="flex items-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1 text-xs"><Activity className="h-3.5 w-3.5 text-cortex-green" />{summary.active} active</span>
          <span className="flex items-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1 text-xs"><AlertTriangle className="h-3.5 w-3.5 text-cortex-red" />{summary.errors}</span>
          <Button size="sm" variant="outline" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Open Terminals</Button>
        </div>
      </div>
      <div className="min-h-0 flex-1 p-3">
        <OfficeStage agents={agents} workspaceName={workspace.name} onAgentSelect={onTerminalSelect} onBossSelect={onClose} />
      </div>
    </div>
  );
}

function readOfficeAgents(workspaceId: string | null) {
  if (!workspaceId) return [];
  const state = useCortexStore.getState();
  return createOfficeAgents(state.sessions.filter((session) => session.workspaceId === workspaceId), state.commandHistory.filter((entry) => entry.workspaceId === workspaceId));
}

function useOfficeAgents(workspaceId: string | null) {
  const [agents, setAgents] = useState<OfficeAgentModel[]>(() => readOfficeAgents(workspaceId));
  const exitTimers = useRef(new Map<string, number>());
  useEffect(() => {
    let timer: number | null = null;
    setAgents(readOfficeAgents(workspaceId));
    const refresh = () => {
      timer = null;
      const next = readOfficeAgents(workspaceId);
      const nextIds = new Set(next.map((agent) => agent.id));

      for (const agent of next) {
        const exitTimer = exitTimers.current.get(agent.id);
        if (exitTimer !== undefined) {
          window.clearTimeout(exitTimer);
          exitTimers.current.delete(agent.id);
        }
      }

      setAgents((current) => {
        const exiting = current
          .filter((agent) => !nextIds.has(agent.id))
          .map((agent) => ({
            ...agent,
            phase: "exiting" as const,
            pose: "idle" as const,
            signal: "success" as const,
            activity: "Wrapping up",
            zone: "lounge" as const,
            target: officeTarget("lounge", agent.id),
          }));

        for (const agent of exiting) {
          if (exitTimers.current.has(agent.id)) continue;
          const exitTimer = window.setTimeout(() => {
            exitTimers.current.delete(agent.id);
            setAgents((visible) => visible.filter((item) => item.id !== agent.id || item.phase !== "exiting"));
          }, AGENT_EXIT_DELAY_MS);
          exitTimers.current.set(agent.id, exitTimer);
        }

        const merged = [...next, ...exiting];
        const currentSignature = current.map(agentSignature).join("|");
        const nextSignature = merged.map(agentSignature).join("|");
        return currentSignature === nextSignature ? current : merged;
      });
    };
    refresh();
    const unsubscribe = useCortexStore.subscribe(() => { if (timer === null) timer = window.setTimeout(refresh, 500); });
    return () => {
      unsubscribe();
      if (timer !== null) window.clearTimeout(timer);
      for (const exitTimer of exitTimers.current.values()) window.clearTimeout(exitTimer);
      exitTimers.current.clear();
    };
  }, [workspaceId]);
  return agents;
}

function agentSignature(agent: OfficeAgentModel) {
  return `${agent.id}:${agent.phase}:${agent.signal}:${agent.zone}:${agent.activity}`;
}
