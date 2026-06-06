import type { OfficePoint, OfficeZone } from "./officeTypes";

export const OFFICE_SCENE_WIDTH = 1280;
export const OFFICE_SCENE_HEIGHT = 760;
export const AGENT_EXIT_DELAY_MS = 4200;

// Adjust these values together to resize or reposition the compact research corner.
export const RESEARCH_LIBRARY_LAYOUT = {
  bookshelf: { x: 66, y: 246, width: 174, height: 184 },
  shelfCount: 3,
  booksPerShelf: 6,
  label: { x: 153, y: 226 },
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

export const OFFICE_ZONE_ANCHORS: Record<OfficeZone, OfficeAnchor[]> = {
  bossDesk: [anchor("bossDesk", 640, 222, 640, 258)],
  codingDesks: [
    anchor("codingDesk1", 431, 455, 431, 548),
    anchor("codingDesk2", 571, 455, 571, 548),
    anchor("codingDesk3", 711, 455, 711, 548),
    anchor("codingDesk4", 851, 455, 851, 548),
  ],
  // Research agents stay beside the shelf, clear of its furniture footprint.
  researchLibrary: [
    anchor("research1", 270, 292, 278, 302),
    anchor("research2", 270, 350, 282, 362),
    anchor("research3", 270, 408, 278, 420),
  ],
  buildLab: [anchor("build1", 1024, 348, 946, 350), anchor("build2", 1140, 392, 946, 410)],
  testBoard: [anchor("test1", 1015, 548, 930, 548), anchor("test2", 1120, 548, 1230, 548)],
  debugCorner: [anchor("debug1", 820, 625, 744, 652), anchor("debug2", 935, 625, 1004, 652)],
  gitBoard: [anchor("git1", 350, 620, 286, 650), anchor("git2", 485, 620, 570, 650)],
  lounge: [anchor("lounge1", 130, 620, 130, 690), anchor("lounge2", 235, 620, 235, 690)],
  meetingRoom: [anchor("meeting1", 620, 625), anchor("meeting2", 690, 625), anchor("meeting3", 655, 670)],
  entrance: [anchor("entrance1", 633, 710), anchor("entrance2", 674, 710)],
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
