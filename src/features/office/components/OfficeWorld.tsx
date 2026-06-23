import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { ENTRANCE_POSITION, officeRoute } from "../officeLayout";
import { officeAgentCaption } from "../officeAgentCaption";
import type { OfficeAgentModel, OfficeGitSummary, OfficeKanbanCard, OfficePoint, OfficeSignal, OfficeSummary } from "../officeTypes";

type Props = {
  agents: OfficeAgentModel[];
  workspaceName: string;
  showWorkspaceLabels: boolean;
  summary: OfficeSummary;
  cards: OfficeKanbanCard[];
  git: OfficeGitSummary;
  onAgentSelect: (id: string) => void;
  onTerminalOpen: (id: string) => void;
  onBossSelect: () => void;
};

export function OfficeWorld({ agents, workspaceName, showWorkspaceLabels, summary, cards, git, onAgentSelect, onTerminalOpen, onBossSelect }: Props) {
  return (
    <div className="officeWorld" aria-label={`${workspaceName} office map`}>
      <div className="officeMapTitle"><span>{workspaceName}</span><small>live agent office</small></div>
      <ContinueSign side="left" />
      <ContinueSign side="right" />
      <div className="officeCorridor"><span>MAIN CORRIDOR</span></div>

      <OfficeRoom id="library" title="LIBRARY" className="roomLibrary">
        <PixelFurniture kind="bookshelves" />
        <PixelFurniture kind="reading-table" />
        <PixelFurniture kind="plant-left" />
        <PixelFurniture kind="plant-right" />
        <div className="roomNote">quiet research nook</div>
      </OfficeRoom>

      <OfficeRoom id="pause-area" title="PAUSE AREA" className="roomLounge">
        <PixelFurniture kind="sofa" />
        <PixelFurniture kind="armchair" />
        <PixelFurniture kind="coffee-table" />
        <PixelFurniture kind="coffee-machine" />
        <PixelFurniture kind="vending-machine" />
      </OfficeRoom>

      <OfficeRoom id="meeting" title="MEETING" className="roomMeeting">
        <PixelFurniture kind="whiteboard" />
        <PixelFurniture kind="meeting-table" />
      </OfficeRoom>

      <OfficeRoom id="mission-control" title="MISSION CONTROL" className="roomMission">
        <button className="bossStation" type="button" data-office-interactive onClick={onBossSelect}>
          <span className="bossMonitor">{summary.total}<small>AGENTS</small></span>
          <span className="bossDesk" />
          <span className="bossChair" />
          <span className="bossLabel">YOU / BOSS</span>
        </button>
      </OfficeRoom>

      <OfficeRoom id="debug" title="DEBUG" className="roomDebug">
        <PixelFurniture kind="debug-monitors" />
        <div className="debugReadout">ERR {summary.errors}</div>
      </OfficeRoom>

      <OfficeRoom id="work-area" title="WORK AREA" className="roomWork">
        <div className="workDeskGrid">
          {[0, 1, 2, 3].map((index) => <WorkDesk key={index} index={index} agent={agents.filter((agent) => agent.zone === "codingDesks")[index]} />)}
        </div>
      </OfficeRoom>

      <OfficeRoom id="build-test" title="BUILD / TEST" className="roomBuild">
        <div className="buildPanels">
          <StatusPanel title="BUILD" value={summary.buildsTests ? "RUNNING" : "READY"} active={summary.buildsTests > 0} />
          <StatusPanel title="TESTS" value={cards.filter((card) => card.column === "done").length ? "PASS" : "IDLE"} active={cards.some((card) => card.column === "done")} />
          <StatusPanel title="GIT" value={git.branch ?? "LOCAL"} active={Boolean(git.changedFiles)} />
        </div>
        <PixelFurniture kind="servers" />
      </OfficeRoom>

      {agents.map((agent) => (
        <AgentSprite
          key={agent.id}
          agent={agent}
          showWorkspaceLabel={showWorkspaceLabels}
          onSelect={() => onAgentSelect(agent.id)}
          onOpen={() => agent.terminalId && onTerminalOpen(agent.terminalId)}
        />
      ))}
    </div>
  );
}

export function OfficeRoom({ id, title, className, children }: { id: string; title: string; className: string; children: ReactNode }) {
  return <section id={id} className={`officeRoom ${className}`}><RoomLabel>{title}</RoomLabel>{children}</section>;
}

export function RoomLabel({ children }: { children: ReactNode }) {
  return <div className="roomLabel">{children}</div>;
}

export function WorkDesk({ index, agent }: { index: number; agent?: OfficeAgentModel }) {
  return (
    <div className={`workDesk desk${index + 1}`}>
      <div className="deskMonitor"><span /></div>
      <div className="deskTop"><span className="deskMug" /><span className="deskPlant" /></div>
      <div className="deskChair" />
      <StatusDot signal={agent?.signal ?? "idle"} />
      <span className="deskNumber">0{index + 1}</span>
    </div>
  );
}

export function StatusDot({ signal }: { signal: OfficeSignal }) {
  return <span className={`statusDot status-${signal}`} />;
}

export function PixelFurniture({ kind }: { kind: string }) {
  return <div className={`pixelFurniture furniture-${kind}`} aria-hidden="true" />;
}

function StatusPanel({ title, value, active }: { title: string; value: string; active: boolean }) {
  return <div className={`statusPanel ${active ? "isActive" : ""}`}><span>{title}</span><strong>{value}</strong><i /></div>;
}

function ContinueSign({ side }: { side: "left" | "right" }) {
  return <div className={`continueSign continue-${side}`}><span>{side === "left" ? "←" : "→"}</span> OFFICE CONTINUES THIS WAY</div>;
}

export function AgentSprite({ agent, showWorkspaceLabel, onSelect, onOpen }: { agent: OfficeAgentModel; showWorkspaceLabel: boolean; onSelect: () => void; onOpen: () => void }) {
  const movement = useAgentMovement(agent);
  const color = `#${agent.identity.color.toString(16).padStart(6, "0")}`;
  const label = officeAgentCaption(agent, movement.moving);
  const style = {
    left: movement.point.x,
    top: movement.point.y,
    transitionDuration: `${movement.duration}ms`,
    "--agent-color": color,
    "--agent-skin": `#${agent.identity.skinColor.toString(16).padStart(6, "0")}`,
    "--agent-hair": `#${agent.identity.hairColor.toString(16).padStart(6, "0")}`,
    "--agent-pants": `#${agent.identity.pantsColor.toString(16).padStart(6, "0")}`,
  } as CSSProperties;

  return (
    <button
      className={`agentSprite facing-${movement.facing} ${movement.moving ? "isMoving" : ""} signal-${agent.signal}`}
      style={style}
      type="button"
      data-office-interactive
      onClick={onSelect}
      onDoubleClick={onOpen}
      title={`${agent.terminalName}: ${label}`}
    >
      <span className="agentBubble">{shortText(label, 30)}</span>
      <span className="agentShadow" />
      <span className="agentBody" data-hair={agent.identity.hairStyle}><i className="agentHair" /><i className="agentFace" /><i className="agentShirt" /><i className="agentLegs" /><i className={`agentAccessory accessory-${agent.identity.accessory}`} /></span>
      <StatusDot signal={agent.signal} />
      <span className="agentName">{showWorkspaceLabel ? `${agent.identity.name} · ${agent.workspaceShortName}` : agent.identity.name}</span>
    </button>
  );
}

function useAgentMovement(agent: OfficeAgentModel) {
  const current = useRef<OfficePoint>(ENTRANCE_POSITION);
  const [state, setState] = useState({ point: ENTRANCE_POSITION, duration: 0, moving: true, facing: "right" as Facing });

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    const route = officeRoute(current.current, agent.target);
    const walk = (index: number) => {
      if (cancelled || index >= route.length) {
        if (!cancelled) setState((value) => ({ ...value, moving: false, duration: 180 }));
        return;
      }
      const next = route[index];
      const distance = Math.hypot(next.x - current.current.x, next.y - current.current.y);
      const duration = Math.max(280, Math.min(1250, Math.round(distance * 2.2)));
      const facing = getFacing(current.current, next);
      current.current = next;
      setState({ point: next, duration, moving: true, facing });
      timer = window.setTimeout(() => walk(index + 1), duration + 35);
    };
    const frame = window.requestAnimationFrame(() => walk(0));
    return () => { cancelled = true; window.cancelAnimationFrame(frame); window.clearTimeout(timer); };
  }, [agent.target.x, agent.target.y]);

  return state;
}

type Facing = "up" | "down" | "left" | "right";
function getFacing(from: OfficePoint, to: OfficePoint): Facing {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  return Math.abs(dx) > Math.abs(dy) ? (dx < 0 ? "left" : "right") : (dy < 0 ? "up" : "down");
}

function shortText(value: string, max: number) {
  return value.length <= max ? value : `${value.slice(0, max - 1)}…`;
}
