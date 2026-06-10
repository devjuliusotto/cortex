import type { OfficeActivityCategory, OfficeEventType, OfficeZoneId } from "./officeTypes";

const ansiPattern = /\u001b(?:\[[0-?]*[ -/]*[@-~]|\][^\u0007]*(?:\u0007|\u001b\\))/g;
const patterns: Array<[OfficeActivityCategory, RegExp]> = [
  ["error", /\b(error|failed|failure|exception|panic|stack\s*trace|cannot|missing|not found|fatal)\b/i],
  ["git", /\b(git|commit|stage|staged|diff|branch|release|merge|pull|push|rebase)\b/i],
  ["success", /\b(done|success|completed|passed|built|finished|succeeded|0 errors?)\b/i],
  ["test", /\b(test|tests|lint|check|typecheck|vitest|jest|tsc)\b/i],
  ["build", /\b(npm|cargo|vite|build|built|compile|bundle|webpack|pnpm|yarn)\b/i],
  ["research", /\b(search|docs|read|fetch|web|research|documentation|lookup|browse)\b/i],
  ["coding", /\b(edit|write|file|component|refactor|implement|create|update|patch|code|function)\b/i],
  ["idle", /\b(waiting|idle|stopped|exited)\b/i],
];

export const categoryZones: Record<OfficeActivityCategory, OfficeZoneId> = {
  coding: "codingDesks", research: "researchLibrary", build: "buildLab", test: "testBoard",
  git: "gitBoard", error: "debugCorner", success: "lounge", idle: "lounge",
};

export function providerFromText(value: string) {
  const text = value.toLowerCase();
  if (/\bclaude(?:\s+code)?\b/.test(text)) return "claude" as const;
  if (/\bcodex\b/.test(text)) return "codex" as const;
  if (/\b(?:chat)?gpt\b/.test(text)) return "gpt" as const;
  if (/\bgemini\b/.test(text)) return "gemini" as const;
  if (/\bcursor\b/.test(text)) return "cursor" as const;
  if (/\baider\b/.test(text)) return "aider" as const;
  if (/\bcline\b/.test(text)) return "cline" as const;
  return null;
}

export function compactOfficeText(value: string, limit = 58) {
  const clean = value.replace(ansiPattern, "").replace(/[\u0000-\u001f\u007f]/g, " ").replace(/\s+/g, " ").trim();
  if (!clean) return "Working";
  return clean.length <= limit ? clean : `${clean.slice(0, limit - 3).trimEnd()}...`;
}

export function detectOfficeActivity(value: string) {
  const detail = compactOfficeText(value);
  const category = patterns.find(([, pattern]) => pattern.test(detail))?.[0] ?? "coding";
  return { category, detail, zone: categoryZones[category] };
}

export function eventTypeForCategory(category: OfficeActivityCategory): OfficeEventType {
  if (category === "build" || category === "test" || category === "git" || category === "error" || category === "success" || category === "idle") return category;
  return "activity";
}

export function detectBranch(value: string) {
  const clean = compactOfficeText(value, 120);
  return clean.match(/(?:on branch|branch[:\s]+|##\s*)([\w./-]+)/i)?.[1];
}

export function detectChangedFiles(value: string) {
  const clean = compactOfficeText(value, 160);
  const explicit = clean.match(/(\d+)\s+(?:files? changed|changed files?)/i)?.[1];
  return explicit ? Number(explicit) : undefined;
}
