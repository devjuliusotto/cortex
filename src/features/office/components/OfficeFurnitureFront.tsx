import { useTick } from "@pixi/react";
import { useCallback, useRef } from "react";
import type { Container, Graphics } from "pixi.js";
import type { OfficeAgentModel } from "../officeTypes";

export function OfficeFurnitureFront({ agents }: { agents: OfficeAgentModel[] }) {
  const lightsRef = useRef<Container | null>(null);
  const time = useRef(0);
  useTick(() => {
    time.current += 0.08;
    if (lightsRef.current) lightsRef.current.alpha = 0.55 + Math.sin(time.current) * 0.35;
  });

  const drawLights = useCallback((g: Graphics) => {
    g.clear();
    const activeZones = new Set(agents.filter((agent) => agent.signal === "active").map((agent) => agent.zone));
    if (activeZones.has("codingDesks")) for (const x of [431, 571, 711, 851]) g.rect(x - 18, 462, 36, 3).fill(0x65d9d4);
    if (activeZones.has("buildLab")) g.circle(1012, 363, 6).fill(0xf0b65c);
    if (activeZones.has("testBoard")) g.circle(1196, 491, 6).fill(0x68d398);
  }, [agents]);

  return <pixiContainer ref={lightsRef}><pixiGraphics draw={drawLights} /></pixiContainer>;
}
