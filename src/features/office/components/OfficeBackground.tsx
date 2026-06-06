import { useCallback } from "react";
import type { Graphics } from "pixi.js";

export function OfficeBackground({ workspaceName, waiting }: { workspaceName: string; waiting: boolean }) {
  const draw = useCallback((g: Graphics) => {
    g.clear();
    g.rect(0, 0, 1280, 760).fill(0x090d16);
    g.rect(28, 24, 1224, 708).fill(0x242233).stroke({ color: 0x46506a, width: 5 });
    g.rect(33, 29, 1214, 196).fill(0x34374c);
    g.rect(33, 225, 1214, 502).fill(0x5b493f);

    for (let y = 225; y < 727; y += 42) g.moveTo(33, y).lineTo(1247, y).stroke({ color: 0x665247, width: 2 });
    for (let x = 33; x < 1247; x += 84) g.moveTo(x, 225).lineTo(x, 727).stroke({ color: 0x514138, width: 1 });

    // Warm center rug and entrance.
    g.roundRect(355, 286, 570, 88, 12).fill(0x493f52).stroke({ color: 0x6c5a70, width: 4 });
    g.rect(590, 680, 105, 47).fill(0x272536).stroke({ color: 0x766b79, width: 4 });
    g.rect(635, 688, 8, 39).fill(0xb68a58); g.circle(678, 705, 4).fill(0xe4c27b);

    // Windows and skyline.
    for (const x of [70, 260, 1010]) {
      g.rect(x, 52, 150, 92).fill(0x171d2b).stroke({ color: 0x8791a9, width: 4 });
      g.rect(x + 8, 60, 64, 76).fill(0x29465b);
      g.rect(x + 78, 60, 64, 76).fill(0x29465b);
      g.rect(x + 18, 105, 18, 31).fill(0x1c2d3d);
      g.rect(x + 104, 88, 25, 48).fill(0x203447);
    }

    // Main boss desk.
    g.roundRect(520, 205, 240, 64, 6).fill(0x8c6048).stroke({ color: 0xc08a62, width: 4 });
    g.rect(535, 266, 18, 48).fill(0x51372f); g.rect(727, 266, 18, 48).fill(0x51372f);
    g.roundRect(587, 166, 106, 61, 5).fill(0x151b28).stroke({ color: 0x65718c, width: 4 });
    g.rect(596, 175, 88, 42).fill(0x0b1c25); g.rect(604, 183, 55, 4).fill(0x61d8d0);
    g.rect(700, 229, 17, 18).fill(0xe9e2cf).stroke({ color: 0x756356, width: 2 });
    g.rect(704, 222, 9, 8).fill(0xe9e2cf); g.rect(716, 232, 7, 9).stroke({ color: 0xe9e2cf, width: 2 });

    // Shared coding bench.
    g.roundRect(345, 470, 590, 48, 5).fill(0x76503f).stroke({ color: 0xac7959, width: 4 });
    for (const x of [390, 530, 670, 810]) {
      g.rect(x, 416, 82, 55).fill(0x171d2a).stroke({ color: 0x56627c, width: 3 });
      g.rect(x + 8, 424, 66, 36).fill(0x102b35); g.rect(x + 15, 431, 46, 3).fill(0x65d9d4);
      g.rect(x + 34, 471, 12, 12).fill(0x4a3c3b);
    }
    for (const x of [431, 571, 711, 851]) g.roundRect(x - 24, 520, 48, 13, 4).fill(0x39465a).stroke({ color: 0x637089, width: 2 });
    for (const x of [365, 895]) g.rect(x, 516, 16, 50).fill(0x49332c);

    // Library / research corner.
    g.rect(63, 178, 226, 302).fill(0x352d37).stroke({ color: 0x786054, width: 4 });
    for (const y of [225, 287, 349, 411]) g.rect(74, y, 204, 9).fill(0x815c46);
    const books = [0xc86b69, 0x6ba6b8, 0xd8ae68, 0x7e8bc4, 0x73a37d];
    for (let row = 0; row < 4; row += 1) for (let i = 0; i < 8; i += 1) g.rect(82 + i * 23, 190 + row * 62, 15, 34 + (i % 3) * 5).fill(books[(row + i) % books.length]);

    // Build rack.
    g.roundRect(978, 236, 232, 214, 6).fill(0x252937).stroke({ color: 0x606b82, width: 4 });
    for (let i = 0; i < 4; i += 1) {
      g.roundRect(995, 254 + i * 46, 198, 35, 3).fill(0x141925);
      g.circle(1012, 271 + i * 46, 5).fill(i === 2 ? 0xf0b65c : 0x65d696);
      g.rect(1028, 264 + i * 46, 82, 5).fill(0x3b465c); g.rect(1028, 275 + i * 46, 120, 4).fill(0x30394c);
    }

    // Test board and repository kanban.
    g.roundRect(968, 478, 250, 114, 5).fill(0xe8dfc5).stroke({ color: 0x795d4d, width: 5 });
    for (let i = 0; i < 5; i += 1) { g.rect(987 + i * 43, 501, 28, 28).fill(i === 3 ? 0xe47771 : 0x70aa83); g.rect(987 + i * 43, 541, 28, 20).fill(0xd2aa62); }
    g.roundRect(310, 570, 236, 104, 5).fill(0x293043).stroke({ color: 0x69758d, width: 4 });
    for (const [x, y, color] of [[328, 591, 0x68a8c4], [388, 591, 0xdbb162], [448, 591, 0x78b584], [358, 629, 0xc87575], [418, 629, 0x8b82c4]] as const) g.rect(x, y, 44, 27).fill(color);

    // Debug console.
    g.roundRect(765, 580, 214, 105, 5).fill(0x241b25).stroke({ color: 0x9c4e61, width: 4 });
    g.rect(783, 598, 178, 55).fill(0x130e17); g.rect(795, 610, 92, 4).fill(0xdf647a); g.rect(795, 624, 134, 4).fill(0x74404e); g.rect(795, 638, 67, 4).fill(0x74404e);

    // Meeting room table and chairs.
    g.roundRect(586, 574, 145, 90, 9).fill(0x4b3c46).stroke({ color: 0x8d7182, width: 4 });
    g.ellipse(658, 619, 54, 25).fill(0x8b644f).stroke({ color: 0xb78564, width: 3 });
    for (const [x, y] of [[600, 590], [716, 590], [600, 650], [716, 650]] as const) g.roundRect(x - 10, y - 8, 20, 16, 4).fill(0x394b5e);

    // Lounge and plants.
    g.roundRect(66, 584, 196, 72, 18).fill(0x455a70).stroke({ color: 0x71869a, width: 4 });
    g.roundRect(91, 641, 146, 28, 10).fill(0x334659);
    g.circle(274, 647, 25).fill(0x76513e).stroke({ color: 0xa77755, width: 3 });
    g.rect(263, 626, 19, 14).fill(0xd8c7a3); g.rect(267, 619, 11, 8).fill(0xd8c7a3);
    for (const x of [297, 1190]) {
      g.rect(x, 190, 40, 36).fill(0x895b43); g.rect(x + 8, 154, 8, 37).fill(0x426f50); g.rect(x + 23, 143, 8, 48).fill(0x4f825d); g.circle(x + 12, 154, 15).fill(0x568f65); g.circle(x + 29, 143, 14).fill(0x65a473);
    }
  }, []);

  return (
    <>
      <pixiGraphics draw={draw} />
      <pixiText text={workspaceName.toUpperCase()} x={640} y={78} anchor={0.5} style={{ fill: 0xf0e8d5, fontFamily: "monospace", fontSize: 24, fontWeight: "bold", letterSpacing: 4 }} />
      <pixiText text={waiting ? "NO ACTIVE AI AGENTS DETECTED" : "OFFICE ONLINE"} x={640} y={121} anchor={0.5} style={{ fill: waiting ? 0xc6bda9 : 0x6fd8a0, fontFamily: "monospace", fontSize: 11, letterSpacing: 2 }} />
      {waiting && <pixiText text="Start Claude, Codex, GPT, or Gemini in a terminal" x={640} y={140} anchor={0.5} style={{ fill: 0x8f96a8, fontFamily: "monospace", fontSize: 8 }} />}
      <pixiText text="RESEARCH" x={176} y={158} anchor={0.5} style={zoneStyle} />
      <pixiText text="BUILD LAB" x={1094} y={210} anchor={0.5} style={zoneStyle} />
      <pixiText text="TEST BOARD" x={1093} y={460} anchor={0.5} style={zoneStyle} />
      <pixiText text="REPOSITORY" x={428} y={551} anchor={0.5} style={zoneStyle} />
      <pixiText text="DEBUG" x={872} y={561} anchor={0.5} style={{ ...zoneStyle, fill: 0xe67b8e }} />
      <pixiText text="PLANNING" x={658} y={554} anchor={0.5} style={zoneStyle} />
      <pixiText text="ENTRANCE" x={643} y={698} anchor={0.5} style={{ fill: 0x9f95a7, fontFamily: "monospace", fontSize: 8, letterSpacing: 1 }} />
    </>
  );
}

const zoneStyle = { fill: 0xaeb6c8, fontFamily: "monospace", fontSize: 11, fontWeight: "bold", letterSpacing: 2 } as const;
