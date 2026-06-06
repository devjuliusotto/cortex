import { useTick } from "@pixi/react";
import { useCallback, useRef } from "react";
import type { Container, Graphics } from "pixi.js";
import { BOSS_POSITION } from "../officeLayout";

export function OfficeBoss({ onSelect }: { onSelect: () => void }) {
  const ref = useRef<Container | null>(null);
  const monitorGlowRef = useRef<Graphics | null>(null);
  const time = useRef(0);
  const tick = useCallback(() => {
    time.current += 0.08;
    if (ref.current) ref.current.y = BOSS_POSITION.y + Math.sin(time.current) * 1.5;
    if (monitorGlowRef.current) monitorGlowRef.current.alpha = 0.55 + Math.sin(time.current * 0.7) * 0.18;
  }, []);
  useTick(tick);

  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.rect(-20, -18, 40, 34).fill(0x344f73);
    g.rect(-14, -45, 28, 28).fill(0xe5b78f);
    g.rect(-17, -50, 34, 10).fill(0x3a3040);
    g.rect(-10, -36, 4, 4).fill(0x20202a); g.rect(7, -36, 4, 4).fill(0x20202a);
    g.rect(-28, -12, 9, 25).fill(0xe5b78f); g.rect(19, -12, 9, 22).fill(0xe5b78f);
    g.rect(-17, 15, 13, 18).fill(0x222b3c); g.rect(4, 15, 13, 18).fill(0x222b3c);
    g.circle(22, -47, 7).fill(0x61d8d0).stroke({ color: 0x13242c, width: 2 });
  }, []);

  const drawMonitorGlow = useCallback((g: Graphics) => {
    g.clear();
    g.rect(-34, -83, 68, 6).fill(0x62e0d7);
    g.rect(-28, -72, 43, 3).fill(0x3d8d91);
  }, []);

  return (
    <pixiContainer ref={ref} x={BOSS_POSITION.x} y={BOSS_POSITION.y} eventMode="static" cursor="pointer" onPointerTap={onSelect}>
      <pixiGraphics ref={monitorGlowRef} draw={drawMonitorGlow} />
      <pixiGraphics draw={draw} />
      <pixiText text="YOU · BOSS AGENT" x={0} y={39} anchor={0.5} style={{ fill: 0xf2dfae, fontFamily: "monospace", fontSize: 11, fontWeight: "bold" }} />
    </pixiContainer>
  );
}
