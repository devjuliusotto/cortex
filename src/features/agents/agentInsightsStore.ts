import { useSyncExternalStore } from "react";

export type AgentUsage = {
  inputTokens?: number;
  outputTokens?: number;
  totalTokens?: number;
  credits?: string;
  contextRemaining?: string;
  remainingPercent?: number;
};

export type AgentInsight = {
  sessionId: string;
  provider?: "Codex" | "Claude" | "Gemini" | "Agent";
  waitingForAuthorization: boolean;
  waitingMessage?: string;
  usage: AgentUsage;
  updatedAt: number;
};

const insights = new Map<string, AgentInsight>();
const listeners = new Set<() => void>();
let insightsSnapshot: AgentInsight[] = [];

export function inspectAgentOutput(sessionId: string, rawOutput: string) {
  const output = stripAnsi(rawOutput);
  if (!output.trim()) return;

  const existing = insights.get(sessionId) ?? {
    sessionId,
    waitingForAuthorization: false,
    usage: {},
    updatedAt: Date.now(),
  };
  const waitingMessage = detectWaitingMessage(output);
  const hasProgress = /(?:working|thinking|running|executing|completed|done|finished)/i.test(output);
  insights.set(sessionId, {
    ...existing,
    provider: detectProvider(output) ?? existing.provider,
    usage: { ...existing.usage, ...detectUsage(output) },
    waitingForAuthorization: waitingMessage ? true : hasProgress ? false : existing.waitingForAuthorization,
    waitingMessage: waitingMessage ?? (hasProgress ? undefined : existing.waitingMessage),
    updatedAt: Date.now(),
  });
  notify();
}

export function markAgentInput(sessionId: string) {
  const existing = insights.get(sessionId);
  if (!existing?.waitingForAuthorization) return;
  insights.set(sessionId, { ...existing, waitingForAuthorization: false, waitingMessage: undefined, updatedAt: Date.now() });
  notify();
}

export function useAgentInsight(sessionId: string | null) {
  return useSyncExternalStore(subscribe, () => (sessionId ? insights.get(sessionId) : undefined));
}

export function useAgentInsights() {
  return useSyncExternalStore(subscribe, () => insightsSnapshot);
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify() {
  insightsSnapshot = Array.from(insights.values());
  for (const listener of listeners) listener();
}

function stripAnsi(value: string) {
  return value.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replace(/\r/g, "\n");
}

function detectProvider(output: string): AgentInsight["provider"] | undefined {
  if (/\bcodex\b/i.test(output)) return "Codex";
  if (/\bclaude\b/i.test(output)) return "Claude";
  if (/\bgemini\b/i.test(output)) return "Gemini";
  if (/\bagent\b/i.test(output)) return "Agent";
  return undefined;
}

function detectWaitingMessage(output: string) {
  return output.split("\n").map((line) => line.trim()).filter(Boolean).slice(-8).reverse().find((line) =>
    /(?:approval|authorization|permission|confirm|allow|proceed|manual input|waiting for (?:input|you)|press enter|\[(?:y\/n|Y\/n|y\/N)\]|yes\/no)/i.test(line),
  )?.slice(0, 180);
}

function detectUsage(output: string): AgentUsage {
  const usage: AgentUsage = {};
  const input = lastNumber(output, /(?:input|prompt)\s+tokens?\s*[:=]\s*([\d,.]+)/gi);
  const outputTokens = lastNumber(output, /(?:output|completion)\s+tokens?\s*[:=]\s*([\d,.]+)/gi);
  const total = lastNumber(output, /(?:total|tokens?\s+used)\s*(?:tokens?)?\s*[:=]\s*([\d,.]+)/gi);
  const credits = lastText(output, /(?:credits?|quota|balance)\s*(?:remaining|left)?\s*[:=]\s*([^\n]+)/gi);
  const contextRemaining = lastText(output, /(?:context|tokens?)\s+(?:remaining|left)\s*[:=]\s*([^\n]+)/gi);
  const remainingPercent = lastPercent(output, [
    /(?:context|tokens?|quota|usage)\s*(?:remaining|left|available)?\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/gi,
    /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:context|tokens?|quota|usage)?\s*(?:remaining|left|available)/gi,
  ]);
  const usedPercent = lastPercent(output, [
    /(?:context|tokens?|quota|usage)\s*(?:used|consumed)\s*[:=]?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/gi,
    /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:context|tokens?|quota|usage)?\s*(?:used|consumed)/gi,
  ]);
  if (input !== undefined) usage.inputTokens = input;
  if (outputTokens !== undefined) usage.outputTokens = outputTokens;
  if (total !== undefined) usage.totalTokens = total;
  if (credits) usage.credits = credits.trim().slice(0, 80);
  if (contextRemaining) usage.contextRemaining = contextRemaining.trim().slice(0, 80);
  if (remainingPercent !== undefined) usage.remainingPercent = remainingPercent;
  else if (usedPercent !== undefined) usage.remainingPercent = Math.max(0, 100 - usedPercent);
  return usage;
}

function lastPercent(output: string, patterns: RegExp[]) {
  let latest: { index: number; value: number } | undefined;
  for (const pattern of patterns) {
    for (const match of output.matchAll(pattern)) {
      const value = Number(match[1].replace(",", "."));
      if (Number.isFinite(value) && (!latest || (match.index ?? 0) > latest.index)) {
        latest = { index: match.index ?? 0, value: Math.max(0, Math.min(100, Math.round(value))) };
      }
    }
  }
  return latest?.value;
}

function lastNumber(output: string, pattern: RegExp) {
  const value = lastText(output, pattern);
  if (!value) return undefined;
  const parsed = Number(value.replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : undefined;
}

function lastText(output: string, pattern: RegExp) {
  let match: RegExpExecArray | null;
  let value: string | undefined;
  while ((match = pattern.exec(output))) value = match[1];
  return value;
}
