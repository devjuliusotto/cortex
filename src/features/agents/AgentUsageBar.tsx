import { Bot, Gauge } from "lucide-react";
import { cn } from "@/lib/utils";
import { useCortexStore, type TerminalSession } from "@/stores/cortexStore";

type AgentProvider = "Codex" | "Claude" | "Gemini" | "Agente IA";

type AgentUsage = {
  provider: AgentProvider;
  remainingPercent: number | null;
};

function plainText(text: string) {
  return text
    .replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "")
    .replace(/\x1b\][^\u0007]*(?:\u0007|\x1b\\)/g, "")
    .replace(/[\u0000-\u001f\u007f]/g, " ");
}

function detectProvider(text: string): AgentProvider {
  let latest: { provider: AgentProvider; index: number } | null = null;
  for (const [provider, pattern] of [
    ["Codex", /\bcodex\b/gi],
    ["Claude", /\bclaude\b/gi],
    ["Gemini", /\bgemini\b/gi],
  ] as const) {
    for (const match of text.matchAll(pattern)) {
      if (!latest || (match.index ?? 0) > latest.index) {
        latest = { provider, index: match.index ?? 0 };
      }
    }
  }
  return latest?.provider ?? "Agente IA";
}

function clampPercent(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

function detectRemainingPercent(text: string) {
  const remainingPatterns = [
    /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:of\s+)?(?:context|credits?|quota|usage|tokens?)?\s*(?:left|remaining|available)/gi,
    /(?:context|credits?|quota|usage|tokens?)\s*(?:left|remaining|available)\s*[:=-]?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/gi,
  ];
  const usedPatterns = [
    /(\d{1,3}(?:[.,]\d+)?)\s*%\s*(?:of\s+)?(?:context|credits?|quota|usage|tokens?)?\s*(?:used|consumed)/gi,
    /(?:context|credits?|quota|usage|tokens?)\s*(?:used|consumed)\s*[:=-]?\s*(\d{1,3}(?:[.,]\d+)?)\s*%/gi,
  ];

  let latest: { index: number; remaining: number } | null = null;
  for (const pattern of remainingPatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1].replace(",", "."));
      if (Number.isFinite(value) && (!latest || (match.index ?? 0) > latest.index)) {
        latest = { index: match.index ?? 0, remaining: clampPercent(value) };
      }
    }
  }
  for (const pattern of usedPatterns) {
    for (const match of text.matchAll(pattern)) {
      const value = Number(match[1].replace(",", "."));
      if (Number.isFinite(value) && (!latest || (match.index ?? 0) > latest.index)) {
        latest = { index: match.index ?? 0, remaining: clampPercent(100 - value) };
      }
    }
  }
  return latest?.remaining ?? null;
}

function usageFromSessions(sessions: TerminalSession[]): AgentUsage | null {
  const recentText = plainText(
    sessions
      .slice()
      .sort((a, b) => a.updatedAt.localeCompare(b.updatedAt))
      .map((session) => session.terminalHistory.slice(-20_000))
      .join("\n"),
  );
  const provider = detectProvider(recentText);
  if (provider === "Agente IA" && !/\b(?:agent|assistant|model|tokens?|context)\b/i.test(recentText)) {
    return null;
  }
  return { provider, remainingPercent: detectRemainingPercent(recentText) };
}

export function AgentUsageBar({ collapsed }: { collapsed: boolean }) {
  const activeWorkspaceId = useCortexStore((state) => state.activeWorkspaceId);
  const allSessions = useCortexStore((state) => state.sessions);
  const sessions = allSessions.filter((session) => session.workspaceId === activeWorkspaceId);
  const usage = usageFromSessions(sessions);
  const remaining = usage?.remainingPercent ?? null;
  const title = usage
    ? remaining === null
      ? `${usage.provider}: o CLI não informou créditos ou contexto no terminal`
      : `${usage.provider}: ${remaining}% disponível, lido localmente do terminal`
    : "Nenhum agente de IA detectado neste workspace";

  if (collapsed) {
    return (
      <div className="mb-2 grid h-10 w-full place-items-center rounded-md border border-border bg-secondary/50" title={title}>
        <Gauge className={cn("h-4 w-4", remaining === null ? "text-muted-foreground" : "text-primary")} />
      </div>
    );
  }

  return (
    <div className="mb-2 rounded-md border border-border bg-secondary/45 px-3 py-2.5" title={title}>
      <div className="flex items-center justify-between gap-2 text-[11px]">
        <span className="flex min-w-0 items-center gap-2 font-medium text-foreground">
          <Bot className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{usage?.provider ?? "Agente IA"}</span>
        </span>
        <span className="shrink-0 text-muted-foreground">
          {remaining === null ? "sem dados" : `${remaining}% livre`}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className={cn("h-full rounded-full transition-[width]", remaining === null ? "bg-muted-foreground/35" : remaining < 20 ? "bg-cortex-red" : remaining < 45 ? "bg-cortex-amber" : "bg-cortex-green")}
          style={{ width: `${remaining ?? 0}%` }}
        />
      </div>
      <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
        {usage ? (remaining === null ? "Não informado pelo CLI" : "Leitura local, sem consulta extra") : "Nenhum agente detectado"}
      </p>
    </div>
  );
}
