import { useCallback } from "react";
import type { Graphics } from "pixi.js";
import type { OfficeKanbanCard } from "../officeTypes";

export function OfficeKanbanWall({ cards }: { cards: OfficeKanbanCard[] }) {
  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.roundRect(300, 548, 270, 130, 5).fill(0xeee4cd).stroke({ color: 0x765c4c, width: 4 });
    g.moveTo(390, 574).lineTo(390, 670).stroke({ color: 0xb9aa90, width: 2 });
    g.moveTo(480, 574).lineTo(480, 670).stroke({ color: 0xb9aa90, width: 2 });
  }, []);
  const progress = cards.filter((card) => card.column === "progress");
  const done = cards.filter((card) => card.column === "done");
  return <>
    <pixiGraphics draw={draw} />
    <pixiText text="TODO" x={345} y={558} anchor={0.5} style={heading} />
    <pixiText text="IN PROGRESS" x={435} y={558} anchor={0.5} style={heading} />
    <pixiText text="DONE" x={525} y={558} anchor={0.5} style={heading} />
    {progress.slice(0, 4).map((card, index) => <Card key={card.id} card={card} x={398} y={584 + index * 20} />)}
    {done.slice(0, 4).map((card, index) => <Card key={card.id} card={card} x={488} y={584 + index * 20} />)}
  </>;
}

function Card({ card, x, y }: { card: OfficeKanbanCard; x: number; y: number }) {
  const draw = useCallback((g: Graphics) => { g.clear(); g.roundRect(x, y, 74, 16, 2).fill(card.warning ? 0xe78a78 : card.column === "done" ? 0x83b58b : 0xd7b766); }, [card.column, card.warning, x, y]);
  return <><pixiGraphics draw={draw} /><pixiText text={`${card.warning ? "! " : ""}${card.title.slice(0, 12)}`} x={x + 4} y={y + 3} style={{ fill: 0x30291f, fontFamily: "monospace", fontSize: 7 }} /></>;
}
const heading = { fill: 0x56493c, fontFamily: "monospace", fontSize: 8, fontWeight: "bold" } as const;
