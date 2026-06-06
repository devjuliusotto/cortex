import { Application, extend } from "@pixi/react";
import { useCallback, useEffect, useRef, useState } from "react";
import { Container, Graphics, Text } from "pixi.js";
import { OFFICE_SCENE_HEIGHT, OFFICE_SCENE_WIDTH } from "../officeModel";
import type { OfficeDeskModel } from "../officeTypes";
import { OfficeDesk } from "./OfficeDesk";

extend({ Container, Graphics, Text });

type OfficeStageProps = {
  desks: OfficeDeskModel[];
  workspaceName: string;
  onDeskSelect: (terminalId: string) => void;
};

export function OfficeStage({ desks, workspaceName, onDeskSelect }: OfficeStageProps) {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [size, setSize] = useState({ width: 1, height: 1 });

  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    const observer = new ResizeObserver(([entry]) => {
      setSize({
        width: Math.max(1, Math.floor(entry.contentRect.width)),
        height: Math.max(1, Math.floor(entry.contentRect.height)),
      });
    });
    observer.observe(hostRef.current);
    return () => observer.disconnect();
  }, []);

  const drawRoom = useCallback((graphics: Graphics) => {
    graphics.clear();
    graphics.rect(0, 0, OFFICE_SCENE_WIDTH, OFFICE_SCENE_HEIGHT).fill(0x0b1019);
    graphics.rect(35, 32, 1130, 650).fill(0x171c29).stroke({ color: 0x364058, width: 5 });
    graphics.rect(40, 37, 1120, 110).fill(0x20283a);
    graphics.rect(40, 147, 1120, 530).fill(0x302a32);

    for (let y = 147; y < 677; y += 44) {
      graphics.moveTo(40, y).lineTo(1160, y).stroke({ color: 0x39313a, width: 2 });
    }
    for (let x = 40; x < 1160; x += 56) {
      graphics.moveTo(x, 147).lineTo(x, 677).stroke({ color: 0x352e37, width: 1 });
    }

    graphics.roundRect(78, 60, 210, 66, 6).fill(0x101722).stroke({ color: 0x4a5872, width: 3 });
    graphics.rect(91, 72, 54, 41).fill(0x274d5d);
    graphics.rect(154, 72, 54, 41).fill(0x274d5d);
    graphics.rect(217, 72, 54, 41).fill(0x274d5d);
    graphics.circle(1090, 91, 23).fill(0xf4c96b);
    graphics.circle(1090, 91, 15).fill(0x263047);
    graphics.rect(1010, 111, 90, 10).fill(0x6b4d3d);
    graphics.rect(1022, 75, 18, 36).fill(0x416b52);
    graphics.rect(1045, 65, 17, 46).fill(0x4b7d5f);
  }, []);

  const scale = Math.min(size.width / OFFICE_SCENE_WIDTH, size.height / OFFICE_SCENE_HEIGHT);
  const sceneX = Math.round((size.width - OFFICE_SCENE_WIDTH * scale) / 2);
  const sceneY = Math.round((size.height - OFFICE_SCENE_HEIGHT * scale) / 2);

  return (
    <div ref={hostRef} className="h-full min-h-[360px] w-full overflow-hidden rounded-md bg-[#080c13]">
      <Application resizeTo={hostRef} backgroundAlpha={0} antialias={false} resolution={1}>
        <pixiContainer x={sceneX} y={sceneY} scale={scale}>
          <pixiGraphics draw={drawRoom} />
          <pixiText
            text={workspaceName.toUpperCase()}
            x={322}
            y={72}
            style={{ fill: 0xeef5ff, fontFamily: "monospace", fontSize: 25, fontWeight: "bold", letterSpacing: 3 }}
          />
          <pixiText
            text="CORTEX OFFICE · CLICK A DESK TO OPEN ITS TERMINAL"
            x={323}
            y={106}
            style={{ fill: 0x77839e, fontFamily: "monospace", fontSize: 11, letterSpacing: 1 }}
          />
          {desks.map((desk) => (
            <OfficeDesk key={desk.id} desk={desk} onSelect={onDeskSelect} />
          ))}
          {desks.length === 0 && (
            <pixiText
              text="No desks yet · create a terminal to move someone in"
              x={OFFICE_SCENE_WIDTH / 2}
              y={OFFICE_SCENE_HEIGHT / 2}
              anchor={0.5}
              style={{ fill: 0x8b96ad, fontFamily: "monospace", fontSize: 18 }}
            />
          )}
        </pixiContainer>
      </Application>
    </div>
  );
}
