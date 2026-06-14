import type { OfficePoint, OfficeZone } from "./officeTypes";

export const OFFICE_SCENE_WIDTH = 2520;
export const OFFICE_SCENE_HEIGHT = 920;
export const AGENT_EXIT_DELAY_MS = 4200;
export const OFFICE_CORRIDOR_Y = 474;

export const RESEARCH_LIBRARY_LAYOUT = {
  bookshelf: { x: 120, y: 130, width: 430, height: 110 },
  shelfCount: 3,
  booksPerShelf: 6,
  label: { x: 330, y: 104 },
} as const;

export type OfficeAnchor = {
  id: string;
  deskRect: { x: number; y: number; width: number; height: number };
  chairPoint: OfficePoint;
  monitorPoint: OfficePoint;
  standingPoint: OfficePoint;
  agentWorkPoint: OfficePoint;
  zIndexHint: number;
};

const anchor = (id: string, x: number, y: number, workX = x, workY = y): OfficeAnchor => ({
  id,
  deskRect: { x: x - 34, y: y - 34, width: 68, height: 42 },
  chairPoint: { x: workX, y: workY + 8 },
  monitorPoint: { x, y: y - 28 },
  standingPoint: { x: workX + 28, y: workY + 6 },
  agentWorkPoint: { x: workX, y: workY },
  zIndexHint: Math.round(workY),
});

// These anchors are shared by live agents, replay, and the DOM map renderer.
export const OFFICE_ZONE_ANCHORS: Record<OfficeZone, OfficeAnchor[]> = {
  bossDesk: [anchor("missionControl", 1715, 220, 1715, 292)],
  codingDesks: [
    anchor("codingDesk1", 730, 650, 730, 742),
    anchor("codingDesk2", 1068, 650, 1068, 742),
    anchor("codingDesk3", 730, 790, 730, 866),
    anchor("codingDesk4", 1068, 790, 1068, 866),
  ],
  researchLibrary: [
    anchor("research1", 250, 280, 250, 326),
    anchor("research2", 430, 280, 430, 326),
    anchor("research3", 525, 350, 525, 364),
  ],
  buildLab: [anchor("build1", 1480, 690, 1480, 744), anchor("build2", 1700, 690, 1700, 744)],
  testBoard: [anchor("test1", 1840, 690, 1840, 744), anchor("test2", 1840, 810, 1840, 842)],
  debugCorner: [anchor("debug1", 2110, 222, 2110, 300), anchor("debug2", 2210, 222, 2210, 300)],
  gitBoard: [anchor("git1", 1580, 820, 1580, 842), anchor("git2", 1740, 820, 1740, 842)],
  lounge: [anchor("lounge1", 760, 280, 760, 342), anchor("lounge2", 950, 280, 950, 342)],
  meetingRoom: [anchor("meeting1", 1210, 250), anchor("meeting2", 1320, 250), anchor("meeting3", 1425, 250)],
  entrance: [anchor("entrance1", 110, OFFICE_CORRIDOR_Y), anchor("entrance2", 150, OFFICE_CORRIDOR_Y)],
};

export const BOSS_POSITION = OFFICE_ZONE_ANCHORS.bossDesk[0].agentWorkPoint;
export const ENTRANCE_POSITION = OFFICE_ZONE_ANCHORS.entrance[0].agentWorkPoint;

export function officeTarget(zone: OfficeZone, id: string): OfficePoint {
  const anchors = OFFICE_ZONE_ANCHORS[zone];
  const hash = Array.from(id).reduce((value, char) => value + char.charCodeAt(0), 0);
  const point = anchors[hash % anchors.length].agentWorkPoint;
  const jitter = zone === "entrance" || zone === "bossDesk" || zone === "codingDesks" ? 0 : (hash % 9) - 4;
  return { x: point.x + jitter, y: point.y + Math.round(jitter / 3) };
}

export function officeRoute(from: OfficePoint, to: OfficePoint): OfficePoint[] {
  const nearCorridor = (point: OfficePoint) => Math.abs(point.y - OFFICE_CORRIDOR_Y) < 36;
  if (nearCorridor(from) && nearCorridor(to)) return [to];
  const route: OfficePoint[] = [];
  if (!nearCorridor(from)) route.push({ x: from.x, y: OFFICE_CORRIDOR_Y });
  route.push({ x: to.x, y: OFFICE_CORRIDOR_Y });
  if (!nearCorridor(to)) route.push(to);
  return route;
}
