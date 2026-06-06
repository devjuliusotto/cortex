import { useTick } from "@pixi/react";
import { useCallback, useEffect, useRef } from "react";
import type { Container, FederatedPointerEvent, Graphics } from "pixi.js";
import { ENTRANCE_POSITION } from "../officeLayout";
import type { OfficeAgentModel, OfficeSignal } from "../officeTypes";

const colors: Record<OfficeSignal, number> = { active: 0x63d9d4, idle: 0x8991a5, success: 0x68d398, warning: 0xed667d };

export function OfficeAgent({ agent, showWorkspaceLabel, onSelect, onOpen }: { agent: OfficeAgentModel; showWorkspaceLabel: boolean; onSelect: (id: string) => void; onOpen: (id: string) => void }) {
  const ref = useRef<Container | null>(null);
  const workerRef = useRef<Graphics | null>(null);
  const time = useRef(0);
  const exitTime = useRef(0);
  const initialized = useRef(false);

  useEffect(() => {
    if (agent.phase === "exiting") exitTime.current = 0;
  }, [agent.phase]);

  const tick = useCallback(() => {
    const node = ref.current;
    if (!node) return;
    if (!initialized.current) {
      node.x = ENTRANCE_POSITION.x;
      node.y = ENTRANCE_POSITION.y;
      node.alpha = 0;
      initialized.current = true;
    }

    time.current += 0.09;
    const dx = agent.target.x - node.x;
    const dy = agent.target.y - node.y;
    const distance = Math.hypot(dx, dy);
    const walking = distance > 3;
    node.x += dx * 0.055;
    node.y += dy * 0.055;
    node.alpha = Math.min(1, node.alpha + 0.08);
    node.rotation = walking ? Math.sin(time.current * 1.8) * 0.025 : 0;
    node.scale.x = walking ? 1 + Math.sin(time.current * 2) * 0.025 : 1;
    node.scale.y = 1 + Math.sin(time.current) * (walking ? 0.045 : agent.pose === "typing" ? 0.025 : 0.012);
    if (workerRef.current) workerRef.current.y = !walking && agent.pose === "typing" ? Math.sin(time.current * 3) * 1.2 : 0;

    if (agent.phase === "exiting") {
      exitTime.current += 1 / 60;
      if (distance < 35) node.alpha = Math.max(0, 1 - exitTime.current / 1.8);
    }
  }, [agent.phase, agent.pose, agent.target.x, agent.target.y]);
  useTick(tick);

  const drawWorker = useCallback((g: Graphics) => {
    const signal = colors[agent.signal];
    const shirt = agent.zone === "debugCorner" ? 0x783a4c : agent.zone === "researchLibrary" ? 0x5e527e : agent.zone === "buildLab" ? 0x8a6238 : agent.zone === "gitBoard" ? 0x3d6d54 : agent.identity.color;
    const armLift = agent.pose === "reading" ? -8 : agent.pose === "observing" ? -3 : 0;
    g.clear();
    g.ellipse(0, 27, 25, 8).fill({ color: 0x11131b, alpha: 0.3 });
    g.rect(-18, -13, 36, 35).fill(shirt);
    g.rect(-13, -39, 26, 27).fill(0xdcae88);
    g.rect(-16, -44, 32, 10).fill(0x303448);
    g.rect(-9, -30, 4, 4).fill(0x1b1d28); g.rect(6, -30, 4, 4).fill(0x1b1d28);
    g.rect(-25, -8 + armLift, 8, 24).fill(0xdcae88); g.rect(17, -8 + armLift, 8, 22).fill(0xdcae88);
    g.rect(-15, 21, 11, 17).fill(0x252b3b); g.rect(4, 21, 11, 17).fill(0x252b3b);

    if (agent.pose === "reading") {
      g.rect(-23, 5, 46, 25).fill(0xddd0a7).stroke({ color: 0x6e5c4e, width: 2 });
      g.moveTo(0, 6).lineTo(0, 29).stroke({ color: 0x8f7a63, width: 2 });
    } else if (agent.pose === "typing") {
      g.rect(-23, 12, 46, 8).fill(0x293245); g.rect(-16, 14, 30, 2).fill(signal);
    } else if (agent.pose === "debugging") {
      g.rect(-26, 7, 52, 20).fill(0x25151d).stroke({ color: 0xb94d66, width: 2 });
      g.rect(-20, 12, 34, 3).fill(0xe06579);
    }

    g.circle(21, -42, 8).fill(signal).stroke({ color: 0x171923, width: 2 });
    if (agent.signal === "warning") { g.rect(20, -47, 3, 7).fill(0x351016); g.rect(20, -37, 3, 3).fill(0x351016); }
    if (agent.signal === "success") g.moveTo(16, -42).lineTo(20, -38).lineTo(26, -46).stroke({ color: 0x123522, width: 3 });
    if (agent.identity.accessory === "spark") g.star(-22, -43, 4, 6, 3).fill(0xb994f4).stroke({ color: 0x272033, width: 2 });
    if (agent.identity.accessory === "brackets") { g.moveTo(-27, -47).lineTo(-32, -42).lineTo(-27, -37).stroke({ color: 0x9de8e3, width: 2 }); g.moveTo(-18, -47).lineTo(-13, -42).lineTo(-18, -37).stroke({ color: 0x9de8e3, width: 2 }); }
    if (agent.identity.accessory === "lens") g.circle(-22, -43, 6).stroke({ color: 0x9bb7ed, width: 2 });
  }, [agent.identity.accessory, agent.identity.color, agent.pose, agent.signal, agent.zone]);

  const drawBubble = useCallback((g: Graphics) => {
    const y = agent.zone === "codingDesks" ? -160 : -86;
    g.clear();
    g.roundRect(-82, y, 164, 27, 2).fill({ color: 0x111622, alpha: 0.94 }).stroke({ color: colors[agent.signal], alpha: 0.65, width: 2 });
    g.moveTo(-8, y + 27).lineTo(0, y + 35).lineTo(8, y + 27).fill(0x111622);
  }, [agent.signal, agent.zone]);

  return (
    <pixiContainer ref={ref} eventMode="static" cursor="pointer" onPointerTap={(event: FederatedPointerEvent) => event.detail >= 2 ? onOpen(agent.id) : onSelect(agent.id)}>
      <pixiGraphics draw={drawBubble} />
      <pixiText text={agent.phase === "exiting" ? "Wrapping up..." : agent.meetingLabel ?? agent.activity} x={0} y={agent.zone === "codingDesks" ? -152 : -78} anchor={0.5} style={{ fill: 0xdde3ef, fontFamily: "monospace", fontSize: 9 }} />
      <pixiGraphics ref={workerRef} draw={drawWorker} />
      <pixiText text={showWorkspaceLabel ? `${agent.terminalName} · ${agent.workspaceShortName}` : agent.terminalName} x={0} y={44} anchor={0.5} style={{ fill: 0xf3f4f8, fontFamily: "monospace", fontSize: showWorkspaceLabel ? 8 : 10, fontWeight: "bold" }} />
      <pixiText text={agent.identity.role} x={0} y={57} anchor={0.5} style={{ fill: 0xaeb6c8, fontFamily: "monospace", fontSize: 7 }} />
    </pixiContainer>
  );
}
