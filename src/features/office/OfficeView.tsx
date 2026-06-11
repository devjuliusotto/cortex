import { Activity, AlertTriangle, ArrowLeft, Building2, Layers3, Monitor, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { focusTerminal } from "@/features/terminal/terminalBridge";
import { useCortexStore } from "@/stores/cortexStore";
import { OfficeStage } from "./components/OfficeStage";
import { OfficeTimelinePanel } from "./components/OfficeTimelinePanel";
import { OfficeReplayControls } from "./components/OfficeReplayControls";
import { agentEventsForAgent, getAgentSnapshots, publishAgentEvents, subscribeAgentStates, tickAgentEventBus } from "./agentEventBus";
import { detectBranch, detectChangedFiles } from "./officeDetection";
import { addMoveEvent, addOfficeEvent, getOfficeEvents, subscribeOfficeEvents } from "./officeEvents";
import { AGENT_EXIT_DELAY_MS, officeTarget } from "./officeLayout";
import { collectOfficeAgentEvents } from "./adapters/officeAgentAdapters";
import { createKanbanCards, createOfficeActors, summarizeOffice } from "./officeModel";
import type { OfficeAgentModel, OfficeEvent, OfficeGitSummary, OfficeScope } from "./officeTypes";

type OfficeViewProps = { externalWindow?: boolean; onClose: () => void; onTerminalSelect: (terminalId: string) => void };

export function OfficeView({ externalWindow = false, onClose, onTerminalSelect }: OfficeViewProps) {
  const activeWorkspaceId = useCortexStore((state) => state.activeWorkspaceId);
  const workspace = useCortexStore((state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId));
  const [scope, setScope] = useState<OfficeScope>("currentWorkspace");
  const liveAgents = useOfficeAgents(activeWorkspaceId, scope);
  const events = useSyncExternalStore(subscribeOfficeEvents, getOfficeEvents, getOfficeEvents);
  const scopedEvents = useMemo(() => scope === "allWorkspaces" ? events : events.filter((event) => !event.workspaceId || event.workspaceId === activeWorkspaceId), [activeWorkspaceId, events, scope]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bossOpen, setBossOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const replayBase = useRef<OfficeAgentModel[]>([]);
  const replayEvents = useMemo(() => scopedEvents.filter((event) => event.timestamp >= Date.now() - 60 * 60_000 && event.agentId), [scopedEvents, replaying]);
  const lastEvent = scopedEvents.at(-1);
  const summary = useMemo(() => summarizeOffice(liveAgents, lastEvent?.label), [lastEvent?.label, liveAgents]);
  const cards = useMemo(() => createKanbanCards(liveAgents), [liveAgents]);
  const git = useMemo((): OfficeGitSummary => {
    // TODO: Merge repository branch/status data here when Git Map exposes a shared cached snapshot.
    const latest = scopedEvents.filter((event) => event.type === "git").at(-1);
    return { branch: latest?.detail ? detectBranch(latest.detail) : undefined, changedFiles: latest?.detail ? detectChangedFiles(latest.detail) : undefined, lastActivity: latest?.label ?? "No git activity" };
  }, [scopedEvents]);
  const visibleAgents = useMemo(() => replaying ? replayAgents(replayBase.current, replayEvents.slice(0, replayIndex + 1)) : liveAgents, [liveAgents, replayEvents, replayIndex, replaying]);
  const selected = visibleAgents.find((agent) => agent.id === selectedId) ?? liveAgents.find((agent) => agent.id === selectedId);

  useEffect(() => {
    if (!replaying) return;
    const timer = window.setInterval(() => setReplayIndex((index) => {
      if (index >= replayEvents.length - 1) { window.clearInterval(timer); return index; }
      return index + 1;
    }), 260);
    return () => window.clearInterval(timer);
  }, [replaying, replayEvents.length]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => { if (event.key !== "Escape") return; if (replaying) setReplaying(false); else { setSelectedId(null); setBossOpen(false); } };
    window.addEventListener("keydown", onKey); return () => window.removeEventListener("keydown", onKey);
  }, [replaying]);

  if (!activeWorkspaceId || !workspace) return <div className="grid flex-1 place-items-center p-6 text-center"><div><Monitor className="mx-auto h-8 w-8 text-muted-foreground" /><h2 className="mt-3 text-sm font-semibold">No office to open</h2><Button className="mt-4" size="sm" variant="outline" onClick={onClose}>Back to workspace</Button></div></div>;

  const openTerminal = (id: string) => { onTerminalSelect(id); if (!externalWindow) focusTerminal(id); };
  const playReplay = () => { replayBase.current = liveAgents.map((agent) => ({ ...agent })); setSelectedId(null); setBossOpen(false); setReplayIndex(0); setReplaying(true); };

  const allProjects = scope === "allWorkspaces";
  const officeName = allProjects ? "All Projects" : workspace.name;
  return <div className="flex min-h-0 flex-1 flex-col bg-background">
    <div className="flex shrink-0 flex-wrap items-center justify-between gap-3 border-b border-border bg-card/35 px-4 py-2"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><Monitor className="h-4 w-4 text-primary" />Office View <span className="truncate text-xs font-normal text-muted-foreground">{officeName}</span>{replaying && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">REPLAY</span>}</div><p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{replaying ? replayEvents[replayIndex]?.label ?? "Replay ready" : summary.lastActivity}</p></div>
      <div className="flex shrink-0 flex-wrap items-center gap-2"><div className="flex h-8 items-center rounded-md border border-border bg-background/60 p-0.5" aria-label="Office scope"><button className={`flex h-7 items-center gap-1 rounded px-2 text-[11px] ${!allProjects ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setScope("currentWorkspace")} type="button"><Building2 className="h-3.5 w-3.5" />Current Project</button><button className={`flex h-7 items-center gap-1 rounded px-2 text-[11px] ${allProjects ? "bg-primary/15 text-primary" : "text-muted-foreground hover:text-foreground"}`} onClick={() => setScope("allWorkspaces")} type="button"><Layers3 className="h-3.5 w-3.5" />All Projects</button></div><OfficeReplayControls replaying={replaying} onPlay={playReplay} onStop={() => setReplaying(false)} /><span className="hidden items-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1 text-xs sm:flex"><Activity className="h-3.5 w-3.5 text-cortex-green" />{summary.total}</span><span className="hidden items-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1 text-xs sm:flex"><AlertTriangle className="h-3.5 w-3.5 text-cortex-red" />{summary.errors}</span>{!externalWindow && <Button size="sm" variant="outline" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Open Terminals</Button>}</div></div>
    <div className="relative min-h-0 flex-1 p-3"><OfficeStage agents={visibleAgents} workspaceName={officeName} showWorkspaceLabels={allProjects} summary={summary} cards={cards} git={git} onAgentSelect={(id) => { setBossOpen(false); setSelectedId(id); }} onTerminalOpen={openTerminal} onBossSelect={() => { setSelectedId(null); setBossOpen((open) => !open); }} />
      {selected && <OfficeTimelinePanel agent={selected} events={agentEventsForAgent(selected.id)} onClose={() => setSelectedId(null)} onOpenTerminal={selected.terminalId ? () => openTerminal(selected.terminalId as string) : undefined} />}
      {bossOpen && <aside className="absolute inset-y-3 right-3 z-10 w-[min(340px,calc(100%-1.5rem))] rounded-md border border-border bg-card/95 p-4 shadow-xl backdrop-blur"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Office overview</p><p className="text-xs text-muted-foreground">{officeName}</p></div><Button size="icon" variant="ghost" onClick={() => setBossOpen(false)}><X className="h-4 w-4" /></Button></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><BossMetric label="Active agents" value={summary.total} /><BossMetric label="Errors" value={summary.errors} /><BossMetric label="Builds / tests" value={summary.buildsTests} /><BossMetric label="Office events" value={scopedEvents.length} /></div><div className="mt-4 rounded border border-border bg-background/50 p-3"><p className="text-[10px] uppercase text-muted-foreground">Last office event</p><p className="mt-1 font-mono text-xs">{lastEvent?.label ?? "No active AI agents detected"}</p></div><a className="mt-5 block text-center text-[10px] text-muted-foreground hover:text-foreground" href="https://github.com/devjuliusotto/pixel-agents" target="_blank" rel="noreferrer">Inspired by Pixel Agents</a></aside>}
      {replaying && <div className="pointer-events-none absolute bottom-6 left-6 max-w-[420px] rounded border border-primary/30 bg-card/90 px-3 py-2 font-mono text-xs shadow-lg"><span className="text-primary">{replayIndex + 1}/{Math.max(1, replayEvents.length)}</span> {replayEvents[replayIndex]?.label ?? "No events from the last hour"}</div>}
    </div>
  </div>;
}

function replayAgents(base: OfficeAgentModel[], events: OfficeEvent[]) {
  const latest = new Map<string, OfficeEvent>();
  for (const event of events) if (event.agentId) latest.set(event.agentId, event);
  return base.map((agent) => { const event = latest.get(agent.id); if (!event?.zone) return agent; return { ...agent, detail: event.label, zone: event.zone, target: officeTarget(event.zone, agent.id) }; });
}

async function refreshOfficeEvents(workspaceId: string | null, scope: OfficeScope) {
  if (!workspaceId) return;
  const state = useCortexStore.getState();
  const events = await collectOfficeAgentEvents({ scope, currentWorkspaceId: workspaceId, workspaces: state.workspaces, sessions: state.sessions, commandHistory: state.commandHistory });
  publishAgentEvents(events);
  tickAgentEventBus();
}

function useOfficeAgents(workspaceId: string | null, scope: OfficeScope) {
  const snapshots = useSyncExternalStore(subscribeAgentStates, getAgentSnapshots, getAgentSnapshots);
  const sessions = useCortexStore((state) => state.sessions);
  const [agents, setAgents] = useState<OfficeAgentModel[]>([]);
  const exitTimers = useRef(new Map<string, number>());
  const previousZones = useRef(new Map<string, string>());
  const previousActivity = useRef(new Map<string, string>());
  useEffect(() => {
    let timer: number | null = null;
    let disposed = false;
    const refresh = async () => {
      timer = null;
      await refreshOfficeEvents(workspaceId, scope);
      if (disposed) return;
    };
    void refresh();
    const schedule = () => { if (timer === null) timer = window.setTimeout(() => void refresh(), 500); };
    const unsubscribe = useCortexStore.subscribe(schedule);
    const poll = window.setInterval(schedule, 2_000);
    return () => { disposed = true; unsubscribe(); window.clearInterval(poll); if (timer !== null) window.clearTimeout(timer); for (const exitTimer of exitTimers.current.values()) window.clearTimeout(exitTimer); exitTimers.current.clear(); };
  }, [scope, workspaceId]);

  useEffect(() => {
    const visibleSnapshots = snapshots.filter((agent) =>
      scope === "allWorkspaces" || agent.workspaceId === workspaceId,
    );
    const next = createOfficeActors(visibleSnapshots, sessions);
    const nextIds = new Set(next.map((agent) => agent.id));
    for (const agent of next) {
      if (!previousZones.current.has(agent.id)) {
        addOfficeEvent({ agentId: agent.id, terminalId: agent.terminalId, workspaceId: agent.workspaceId, type: "spawn", label: `${agent.name} entered office`, zone: "entrance" });
      }
      const previousZone = previousZones.current.get(agent.id);
      if (previousZone && previousZone !== agent.zone) {
        addMoveEvent(agent.id, agent.workspaceId, agent.zone, `Moved to ${agent.location}`, agent.location === "meeting" ? "meeting" : "move");
      }
      previousZones.current.set(agent.id, agent.zone);
      if (previousActivity.current.get(agent.id) !== agent.activity) {
        addOfficeEvent({
          agentId: agent.id,
          terminalId: agent.terminalId,
          workspaceId: agent.workspaceId,
          type: agent.signal === "warning" ? "error" : agent.activity === "completed" ? "success" : "activity",
          label: agent.detail ?? agent.activity,
          detail: `${agent.source} · ${Math.round(agent.confidence * 100)}% confidence`,
          zone: agent.zone,
        });
        previousActivity.current.set(agent.id, agent.activity);
      }
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
          activity: "completed" as const,
          detail: "Wrapping up",
          category: "success" as const,
          location: "lounge" as const,
          zone: "lounge" as const,
          target: officeTarget("lounge", agent.id),
        }));
      for (const agent of exiting) {
        if (!exitTimers.current.has(agent.id)) {
          exitTimers.current.set(agent.id, window.setTimeout(() => {
            exitTimers.current.delete(agent.id);
            setAgents((visible) => visible.filter((item) => item.id !== agent.id || item.phase !== "exiting"));
          }, AGENT_EXIT_DELAY_MS));
        }
      }
      const merged = [...next, ...exiting];
      return current.map(agentSignature).join("|") === merged.map(agentSignature).join("|") ? current : merged;
    });
  }, [scope, sessions, snapshots, workspaceId]);

  return agents;
}
function agentSignature(agent: OfficeAgentModel) { return `${agent.id}:${agent.phase}:${agent.signal}:${agent.location}:${agent.activity}:${agent.confidence}:${agent.currentGoal ?? ""}`; }
function BossMetric({ label, value }: { label: string; value: number }) { return <div className="rounded border border-border bg-background/50 p-3"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg font-semibold">{value}</p></div>; }
