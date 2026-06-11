import { ExternalLink, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { AgentEventEnvelope, OfficeAgentModel } from "../officeTypes";

export function OfficeTimelinePanel({ agent, events, onClose, onOpenTerminal }: { agent: OfficeAgentModel; events: AgentEventEnvelope[]; onClose: () => void; onOpenTerminal?: () => void }) {
  return <aside className="absolute inset-y-3 right-3 z-10 flex w-[min(360px,calc(100%-1.5rem))] flex-col rounded-md border border-border bg-card/95 shadow-xl backdrop-blur">
    <div className="flex items-start justify-between border-b border-border p-4"><div className="min-w-0"><p className="text-sm font-semibold">{agent.identity.name}</p><p className="truncate text-xs text-muted-foreground">{agent.identity.role} · {agent.terminalName}</p></div><Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button></div>
    <div className="grid grid-cols-2 gap-2 border-b border-border p-4 text-xs">
      <Info label="Activity" value={agent.activity} />
      <Info label="Location" value={agent.location} />
      <Info label="Confidence" value={`${Math.round(agent.confidence * 100)}% · ${agent.confidenceLevel}`} />
      <Info label="Source" value={agent.source} />
      <div className="col-span-2"><Info label="Project" value={agent.workspaceName} /></div>
      <div className="col-span-2"><Info label="Current goal" value={agent.currentGoal ?? "Not reported"} /></div>
      <div className="col-span-2"><Info label="Latest event" value={agent.detail ?? eventLabel(agent.lastEvent)} /></div>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto p-4"><p className="mb-3 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Agent events</p><div className="space-y-3">{events.slice().reverse().map((item) => <div key={item.id} className="border-l-2 border-primary/35 pl-3"><div className="flex justify-between gap-2 text-xs"><span className="font-medium">{eventLabel(item.event)}</span><time className="shrink-0 text-[10px] text-muted-foreground">{new Date(item.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</time></div><p className="mt-1 line-clamp-2 font-mono text-[10px] text-muted-foreground">{item.detail ?? `${item.source} · ${Math.round(item.confidence * 100)}%`}</p></div>)}{events.length === 0 && <p className="text-xs text-muted-foreground">No recent events.</p>}</div></div>
    <div className="border-t border-border p-3">{onOpenTerminal && <Button className="w-full" size="sm" variant="outline" onClick={onOpenTerminal}><ExternalLink className="mr-2 h-3.5 w-3.5" />Open terminal</Button>}<a className="mt-2 block text-center text-[10px] text-muted-foreground hover:text-foreground" href="https://github.com/devjuliusotto/pixel-agents" target="_blank" rel="noreferrer">Inspired by Pixel Agents</a></div>
  </aside>;
}

function eventLabel(event: AgentEventEnvelope["event"]) {
  if (event.type === "tool.started") return `Tool started: ${event.tool}`;
  if (event.type === "tool.finished") return `Tool finished: ${event.tool}`;
  return event.type.replace(".", " ");
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase text-muted-foreground">{label}</p><p className="mt-0.5 truncate font-mono">{value}</p></div>;
}
