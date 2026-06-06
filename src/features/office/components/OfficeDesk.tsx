import { useCallback } from "react";
import type { Graphics } from "pixi.js";
import type { OfficeDeskModel, OfficeSignal } from "../officeTypes";

type OfficeDeskProps = {
  desk: OfficeDeskModel;
  onSelect: (terminalId: string) => void;
};

const signalColors: Record<OfficeSignal, number> = {
  active: 0x63f4f0,
  idle: 0x7b849d,
  success: 0x78f0b3,
  warning: 0xff6f87,
};

export function OfficeDesk({ desk, onSelect }: OfficeDeskProps) {
  const drawDesk = useCallback(
    (graphics: Graphics) => {
      const signal = signalColors[desk.signal];
      graphics.clear();

      graphics.roundRect(-112, -58, 224, 124, 8).fill({ color: 0x111522, alpha: 0.45 });
      graphics.roundRect(-106, 8, 212, 46, 5).fill(0x5a3f35).stroke({ color: 0x8a6858, width: 3 });
      graphics.rect(-94, 52, 10, 30).fill(0x392a2a);
      graphics.rect(84, 52, 10, 30).fill(0x392a2a);

      graphics.roundRect(-66, -37, 104, 60, 5).fill(0x151b29).stroke({ color: 0x44506a, width: 3 });
      graphics.rect(-57, -28, 86, 42).fill(0x081018);
      graphics.rect(-53, -24, 78, 4).fill(signal);
      graphics.rect(-53, -15, desk.signal === "active" ? 58 : 34, 3).fill({ color: signal, alpha: 0.55 });
      graphics.rect(-53, -7, desk.signal === "warning" ? 68 : 48, 3).fill({ color: signal, alpha: 0.35 });
      graphics.rect(-19, 23, 10, 10).fill(0x343d52);
      graphics.rect(-34, 33, 40, 5).fill(0x343d52);

      graphics.roundRect(24, 20, 54, 16, 3).fill(0x242a39).stroke({ color: 0x414a61, width: 2 });
      for (let key = 0; key < 5; key += 1) {
        graphics.rect(29 + key * 9, 24, 5, 3).fill(desk.signal === "active" ? signal : 0x6d7488);
      }

      graphics.roundRect(47, -33, 36, 34, 5).fill(0x273149);
      graphics.rect(53, -45, 24, 20).fill(0xe2b38f);
      graphics.rect(50, -50, 30, 9).fill(0x30364b);
      graphics.rect(54, -42, 4, 4).fill(0x151821);
      graphics.rect(70, -42, 4, 4).fill(0x151821);
      graphics.rect(40, -6, 50, 35).fill(desk.signal === "active" ? 0x286f7a : 0x3b4359);
      graphics.rect(34, 5, 10, desk.signal === "active" ? 27 : 22).fill(0xe2b38f);
      graphics.rect(86, 5, 10, desk.signal === "active" ? 22 : 27).fill(0xe2b38f);

      graphics.circle(97, -44, 9).fill(signal).stroke({ color: 0x0c1019, width: 3 });
      if (desk.signal === "success") {
        graphics.moveTo(92, -44).lineTo(96, -40).lineTo(103, -48).stroke({ color: 0x092119, width: 3 });
      } else if (desk.signal === "warning") {
        graphics.rect(96, -50, 3, 8).fill(0x2a0b10);
        graphics.rect(96, -39, 3, 3).fill(0x2a0b10);
      }
    },
    [desk.signal],
  );

  const drawBubble = useCallback((graphics: Graphics) => {
    graphics.clear();
    graphics.roundRect(-108, -106, 216, 38, 7).fill({ color: 0x151b29, alpha: 0.96 }).stroke({ color: 0x39445d, width: 2 });
    graphics.moveTo(63, -68).lineTo(73, -58).lineTo(78, -68).fill(0x151b29);
  }, []);

  return (
    <pixiContainer
      x={desk.x}
      y={desk.y}
      scale={desk.scale}
      eventMode="static"
      cursor="pointer"
      onPointerTap={() => onSelect(desk.id)}
    >
      <pixiGraphics draw={drawBubble} />
      <pixiText
        text={desk.activity}
        x={-98}
        y={-96}
        style={{ fill: 0xcbd3e7, fontFamily: "monospace", fontSize: 11 }}
      />
      <pixiGraphics draw={drawDesk} />
      <pixiText
        text={desk.terminalName}
        x={-104}
        y={88}
        style={{ fill: 0xf1f5ff, fontFamily: "monospace", fontSize: 13, fontWeight: "bold" }}
      />
      <pixiText
        text={`${desk.profileLabel} · ${desk.sessionStatus}`}
        x={-104}
        y={107}
        style={{ fill: signalColors[desk.signal], fontFamily: "monospace", fontSize: 10 }}
      />
    </pixiContainer>
  );
}

