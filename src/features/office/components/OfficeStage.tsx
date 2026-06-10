import { Application, extend } from "@pixi/react";
import { useEffect, useRef, useState } from "react";
import { Container, Graphics, Text } from "pixi.js";
import { OFFICE_SCENE_HEIGHT, OFFICE_SCENE_WIDTH } from "../officeLayout";
import type { OfficeAgentModel, OfficeGitSummary, OfficeKanbanCard, OfficeSummary } from "../officeTypes";
import { OfficeAgent } from "./OfficeAgent";
import { OfficeBackground } from "./OfficeBackground";
import { OfficeBoss } from "./OfficeBoss";
import { OfficeFurnitureFront } from "./OfficeFurnitureFront";
import { OfficeGitWall } from "./OfficeGitWall";
import { OfficeKanbanWall } from "./OfficeKanbanWall";

extend({ Container, Graphics, Text });

type Props = { agents: OfficeAgentModel[]; workspaceName: string; showWorkspaceLabels: boolean; summary: OfficeSummary; cards: OfficeKanbanCard[]; git: OfficeGitSummary; onAgentSelect: (id: string) => void; onTerminalOpen: (id: string) => void; onBossSelect: () => void };

export function OfficeStage({ agents, workspaceName, showWorkspaceLabels, summary, cards, git, onAgentSelect, onTerminalOpen, onBossSelect }: Props) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });
  useEffect(() => { if (!hostRef.current) return; const observer = new ResizeObserver(([entry]) => setSize({ width: Math.max(1, Math.floor(entry.contentRect.width)), height: Math.max(1, Math.floor(entry.contentRect.height)) })); observer.observe(hostRef.current); return () => observer.disconnect(); }, []);
  const scale = Math.min(size.width / OFFICE_SCENE_WIDTH, size.height / OFFICE_SCENE_HEIGHT);
  const sceneX = Math.round((size.width - OFFICE_SCENE_WIDTH * scale) / 2);
  const sceneY = Math.round((size.height - OFFICE_SCENE_HEIGHT * scale) / 2);
  const bossLines = [`${summary.total} AGENTS · ${summary.errors} ERR · ${summary.buildsTests} B/T`, workspaceName, summary.lastActivity];
  return <div ref={hostRef} className="h-full min-h-[420px] w-full overflow-hidden rounded-md border border-border bg-[#080b12] shadow-inner"><Application resizeTo={hostRef} backgroundAlpha={0} antialias={false} resolution={1}><pixiContainer x={sceneX} y={sceneY} scale={scale}>
    <OfficeBackground workspaceName={workspaceName} waiting={agents.length === 0} />
    <OfficeKanbanWall cards={cards} /><OfficeGitWall summary={git} />
    <OfficeBoss onSelect={onBossSelect} lines={bossLines} />
    {agents.map((agent) => <OfficeAgent key={agent.id} agent={agent} showWorkspaceLabel={showWorkspaceLabels} onSelect={onAgentSelect} onOpen={() => agent.terminalId && onTerminalOpen(agent.terminalId)} />)}
    <OfficeFurnitureFront agents={agents} />
  </pixiContainer></Application></div>;
}
