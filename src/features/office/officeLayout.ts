import type { OfficePoint, OfficeZone } from "./officeTypes";

export const OFFICE_SCENE_WIDTH = 1280;
export const OFFICE_SCENE_HEIGHT = 760;
export const AGENT_EXIT_DELAY_MS = 4200;

export const OFFICE_ZONES: Record<OfficeZone, OfficePoint[]> = {
  bossDesk: [{ x: 640, y: 258 }],
  codingDesks: [{ x: 414, y: 442 }, { x: 554, y: 442 }, { x: 694, y: 442 }, { x: 834, y: 442 }],
  researchLibrary: [{ x: 146, y: 354 }, { x: 238, y: 382 }, { x: 155, y: 438 }],
  buildLab: [{ x: 1024, y: 348 }, { x: 1140, y: 392 }],
  testBoard: [{ x: 1015, y: 548 }, { x: 1120, y: 548 }],
  debugCorner: [{ x: 820, y: 655 }, { x: 935, y: 655 }],
  gitBoard: [{ x: 350, y: 650 }, { x: 485, y: 650 }],
  lounge: [{ x: 130, y: 650 }, { x: 235, y: 650 }],
  entrance: [{ x: 633, y: 710 }, { x: 674, y: 710 }],
};

export const BOSS_POSITION = OFFICE_ZONES.bossDesk[0];
export const ENTRANCE_POSITION = OFFICE_ZONES.entrance[0];

export function officeTarget(zone: OfficeZone, id: string): OfficePoint {
  const points = OFFICE_ZONES[zone];
  const hash = Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0);
  const point = points[hash % points.length];
  const jitter = zone === "entrance" || zone === "bossDesk" ? 0 : (hash % 15) - 7;
  return { x: point.x + jitter, y: point.y + Math.round(jitter / 3) };
}
