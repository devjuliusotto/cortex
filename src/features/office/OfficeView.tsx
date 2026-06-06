import { Activity, AlertTriangle, ArrowLeft, Monitor, X } from "lucide-react";
import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Button } from "@/components/ui/button";
import { focusTerminal } from "@/features/terminal/terminalBridge";
import { useCortexStore } from "@/stores/cortexStore";
import { OfficeStage } from "./components/OfficeStage";
import { OfficeTimelinePanel } from "./components/OfficeTimelinePanel";
import { OfficeReplayControls } from "./components/OfficeReplayControls";
import { detectBranch, detectChangedFiles } from "./officeDetection";
import { addMoveEvent, ensureAgentSpawned, getOfficeEvents, officeEventsForAgent, subscribeOfficeEvents } from "./officeEvents";
import { AGENT_EXIT_DELAY_MS, officeTarget } from "./officeLayout";
import { createKanbanCards, createOfficeAgents, summarizeOffice } from "./officeModel";
import type { OfficeAgentModel, OfficeEvent, OfficeGitSummary } from "./officeTypes";

type OfficeViewProps = { onClose: () => void; onTerminalSelect: (terminalId: string) => void };

export function OfficeView({ onClose, onTerminalSelect }: OfficeViewProps) {
  const activeWorkspaceId = useCortexStore((state) => state.activeWorkspaceId);
  const workspace = useCortexStore((state) => state.workspaces.find((item) => item.id === state.activeWorkspaceId));
  const liveAgents = useOfficeAgents(activeWorkspaceId);
  const events = useSyncExternalStore(subscribeOfficeEvents, getOfficeEvents, getOfficeEvents);
  const workspaceEvents = useMemo(() => events.filter((event) => !event.workspaceId || event.workspaceId === activeWorkspaceId), [activeWorkspaceId, events]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [bossOpen, setBossOpen] = useState(false);
  const [replaying, setReplaying] = useState(false);
  const [replayIndex, setReplayIndex] = useState(0);
  const replayBase = useRef<OfficeAgentModel[]>([]);
  const replayEvents = useMemo(() => workspaceEvents.filter((event) => event.timestamp >= Date.now() - 60 * 60_000 && event.agentId), [workspaceEvents, replaying]);
  const lastEvent = workspaceEvents.at(-1);
  const summary = useMemo(() => summarizeOffice(liveAgents, lastEvent?.label), [lastEvent?.label, liveAgents]);
  const cards = useMemo(() => createKanbanCards(liveAgents), [liveAgents]);
  const git = useMemo((): OfficeGitSummary => {
    // TODO: Merge repository branch/status data here when Git Map exposes a shared cached snapshot.
    const latest = workspaceEvents.filter((event) => event.type === "git").at(-1);
    return { branch: latest?.detail ? detectBranch(latest.detail) : undefined, changedFiles: latest?.detail ? detectChangedFiles(latest.detail) : undefined, lastActivity: latest?.label ?? "No git activity" };
  }, [workspaceEvents]);
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

  const openTerminal = (id: string) => { onTerminalSelect(id); focusTerminal(id); };
  const playReplay = () => { replayBase.current = liveAgents.map((agent) => ({ ...agent })); setSelectedId(null); setBossOpen(false); setReplayIndex(0); setReplaying(true); };

  return <div className="flex min-h-0 flex-1 flex-col bg-background">
    <div className="flex shrink-0 items-center justify-between gap-3 border-b border-border bg-card/35 px-4 py-2"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-semibold"><Monitor className="h-4 w-4 text-primary" />Office View <span className="truncate text-xs font-normal text-muted-foreground">{workspace.name}</span>{replaying && <span className="rounded bg-primary/15 px-1.5 py-0.5 text-[10px] text-primary">REPLAY</span>}</div><p className="mt-0.5 truncate font-mono text-[10px] text-muted-foreground">{replaying ? replayEvents[replayIndex]?.label ?? "Replay ready" : summary.lastActivity}</p></div>
      <div className="flex shrink-0 items-center gap-2"><OfficeReplayControls replaying={replaying} onPlay={playReplay} onStop={() => setReplaying(false)} /><span className="hidden items-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1 text-xs sm:flex"><Activity className="h-3.5 w-3.5 text-cortex-green" />{summary.active}</span><span className="hidden items-center gap-1.5 rounded border border-border bg-background/60 px-2 py-1 text-xs sm:flex"><AlertTriangle className="h-3.5 w-3.5 text-cortex-red" />{summary.errors}</span><Button size="sm" variant="outline" onClick={onClose}><ArrowLeft className="mr-2 h-4 w-4" />Open Terminals</Button></div></div>
    <div className="relative min-h-0 flex-1 p-3"><OfficeStage agents={visibleAgents} workspaceName={workspace.name} summary={summary} cards={cards} git={git} onAgentSelect={(id) => { setBossOpen(false); setSelectedId(id); }} onTerminalOpen={openTerminal} onBossSelect={() => { setSelectedId(null); setBossOpen((open) => !open); }} />
      {selected && <OfficeTimelinePanel agent={selected} events={officeEventsForAgent(selected.id)} onClose={() => setSelectedId(null)} onOpenTerminal={() => openTerminal(selected.id)} />}
      {bossOpen && <aside className="absolute inset-y-3 right-3 z-10 w-[min(340px,calc(100%-1.5rem))] rounded-md border border-border bg-card/95 p-4 shadow-xl backdrop-blur"><div className="flex items-start justify-between"><div><p className="text-sm font-semibold">Workspace overview</p><p className="text-xs text-muted-foreground">{workspace.name}</p></div><Button size="icon" variant="ghost" onClick={() => setBossOpen(false)}><X className="h-4 w-4" /></Button></div><div className="mt-5 grid grid-cols-2 gap-3 text-xs"><BossMetric label="Active agents" value={summary.active} /><BossMetric label="Errors" value={summary.errors} /><BossMetric label="Builds / tests" value={summary.buildsTests} /><BossMetric label="Office events" value={workspaceEvents.length} /></div><div className="mt-4 rounded border border-border bg-background/50 p-3"><p className="text-[10px] uppercase text-muted-foreground">Last office event</p><p className="mt-1 font-mono text-xs">{lastEvent?.label ?? "Waiting for activity"}</p></div><a className="mt-5 block text-center text-[10px] text-muted-foreground hover:text-foreground" href="https://github.com/pixel-agents-hq/pixel-agents" target="_blank" rel="noreferrer">Inspired by Pixel Agents</a></aside>}
      {replaying && <div className="pointer-events-none absolute bottom-6 left-6 max-w-[420px] rounded border border-primary/30 bg-card/90 px-3 py-2 font-mono text-xs shadow-lg"><span className="text-primary">{replayIndex + 1}/{Math.max(1, replayEvents.length)}</span> {replayEvents[replayIndex]?.label ?? "No events from the last hour"}</div>}
    </div>
  </div>;
}

function replayAgents(base: OfficeAgentModel[], events: OfficeEvent[]) {
  const latest = new Map<string, OfficeEvent>();
  for (const event of events) if (event.agentId) latest.set(event.agentId, event);
  return base.map((agent) => { const event = latest.get(agent.id); if (!event?.zone) return agent; return { ...agent, activity: event.label, zone: event.zone, target: officeTarget(event.zone, agent.id) }; });
}

function readOfficeAgents(workspaceId: string | null) {
  if (!workspaceId) return [];
  const state = useCortexStore.getState();
  return createOfficeAgents(state.sessions.filter((session) => session.workspaceId === workspaceId), state.commandHistory.filter((entry) => entry.workspaceId === workspaceId));
}

function useOfficeAgents(workspaceId: string | null) {
  const [agents, setAgents] = useState<OfficeAgentModel[]>(() => readOfficeAgents(workspaceId));
  const exitTimers = useRef(new Map<string, number>());
  const previousZones = useRef(new Map<string, string>());
  useEffect(() => {
    let timer: number | null = null;
    setAgents(readOfficeAgents(workspaceId));
    const refresh = () => {
      timer = null;
      const next = readOfficeAgents(workspaceId);
      const nextIds = new Set(next.map((agent) => agent.id));
      for (const agent of next) {
        ensureAgentSpawned(agent.id, agent.terminalName, workspaceId ?? undefined);
        const previousZone = previousZones.current.get(agent.id);
        if (previousZone && previousZone !== agent.zone) addMoveEvent(agent.id, workspaceId ?? undefined, agent.zone, agent.zone === "meetingRoom" ? `Joined meeting: ${agent.meetingLabel ?? "Syncing task"}` : previousZone === "meetingRoom" ? `Left meeting for ${agent.zone}` : `Moved to ${agent.zone}`, agent.zone === "meetingRoom" || previousZone === "meetingRoom" ? "meeting" : "move");
        previousZones.current.set(agent.id, agent.zone);
        const exitTimer = exitTimers.current.get(agent.id); if (exitTimer !== undefined) { window.clearTimeout(exitTimer); exitTimers.current.delete(agent.id); }
      }
      setAgents((current) => {
        const exiting = current.filter((agent) => !nextIds.has(agent.id)).map((agent) => ({ ...agent, phase: "exiting" as const, pose: "idle" as const, signal: "success" as const, activity: "Wrapping up", category: "success" as const, zone: "lounge" as const, target: officeTarget("lounge", agent.id) }));
        for (const agent of exiting) if (!exitTimers.current.has(agent.id)) exitTimers.current.set(agent.id, window.setTimeout(() => { exitTimers.current.delete(agent.id); setAgents((visible) => visible.filter((item) => item.id !== agent.id || item.phase !== "exiting")); }, AGENT_EXIT_DELAY_MS));
        const merged = [...next, ...exiting]; return current.map(agentSignature).join("|") === merged.map(agentSignature).join("|") ? current : merged;
      });
    };
    refresh(); const unsubscribe = useCortexStore.subscribe(() => { if (timer === null) timer = window.setTimeout(refresh, 500); });
    return () => { unsubscribe(); if (timer !== null) window.clearTimeout(timer); for (const exitTimer of exitTimers.current.values()) window.clearTimeout(exitTimer); exitTimers.current.clear(); };
  }, [workspaceId]);
  return agents;
}
function agentSignature(agent: OfficeAgentModel) { return `${agent.id}:${agent.phase}:${agent.signal}:${agent.zone}:${agent.activity}`; }
function BossMetric({ label, value }: { label: string; value: number }) { return <div className="rounded border border-border bg-background/50 p-3"><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="mt-1 font-mono text-lg font-semibold">{value}</p></div>; }
