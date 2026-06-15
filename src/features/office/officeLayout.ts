import type { OfficePoint, OfficeZone } from "./officeTypes";

export const OFFICE_SCENE_WIDTH = 1680;
export const OFFICE_SCENE_HEIGHT = 1200;
export const AGENT_EXIT_DELAY_MS = 4200;
export const OFFICE_CORRIDOR_Y = 540;

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
  bossDesk: [anchor("missionControl", 970, 700, 970, 820)],
  codingDesks: [
    anchor("codingDesk1", 250, 750, 250, 845),
    anchor("codingDesk2", 570, 750, 570, 845),
    anchor("codingDesk3", 250, 960, 250, 1055),
    anchor("codingDesk4", 570, 960, 570, 1055),
  ],
  researchLibrary: [
    anchor("research1", 190, 300, 190, 370),
    anchor("research2", 370, 300, 370, 370),
    anchor("research3", 500, 390, 500, 420),
  ],
  buildLab: [anchor("build1", 940, 1040, 940, 1090), anchor("build2", 1150, 1040, 1150, 1090)],
  testBoard: [anchor("test1", 1380, 1040, 1380, 1090), anchor("test2", 1530, 1040, 1530, 1090)],
  debugCorner: [anchor("debug1", 1320, 700, 1320, 820), anchor("debug2", 1510, 700, 1510, 820)],
  gitBoard: [anchor("git1", 1260, 1110, 1260, 1135), anchor("git2", 1460, 1110, 1460, 1135)],
  lounge: [anchor("lounge1", 710, 300, 710, 410), anchor("lounge2", 920, 300, 920, 410)],
  meetingRoom: [anchor("meeting1", 1190, 290), anchor("meeting2", 1350, 290), anchor("meeting3", 1510, 290)],
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
