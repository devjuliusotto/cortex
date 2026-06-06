import { useCallback } from "react";
import type { Graphics } from "pixi.js";
import type { OfficeGitSummary } from "../officeTypes";

export function OfficeGitWall({ summary }: { summary: OfficeGitSummary }) {
  const draw = useCallback((g: Graphics) => { g.clear(); g.roundRect(38, 490, 235, 82, 5).fill(0x202a38).stroke({ color: 0x5e8e72, width: 4 }); g.circle(58, 518, 7).fill(0x6fd49b); g.moveTo(58, 525).lineTo(58, 548).lineTo(76, 548).stroke({ color: 0x6fd49b, width: 3 }); }, []);
  return <><pixiGraphics draw={draw} />
    <pixiText text="GIT WALL" x={155} y={500} anchor={0.5} style={{ fill: 0x8bd9aa, fontFamily: "monospace", fontSize: 10, fontWeight: "bold" }} />
    <pixiText text={`BRANCH ${summary.branch ?? "activity only"}`} x={82} y={522} style={lineStyle} />
    <pixiText text={summary.changedFiles === undefined ? "CHANGES --" : `CHANGES ${summary.changedFiles}`} x={82} y={537} style={lineStyle} />
    <pixiText text={summary.lastActivity.slice(0, 28)} x={48} y={555} style={{ ...lineStyle, fill: 0xb9c5d7 }} />
  </>;
}
const lineStyle = { fill: 0xd8e4dd, fontFamily: "monospace", fontSize: 8 } as const;
