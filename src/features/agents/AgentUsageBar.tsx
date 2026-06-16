import { Bot, Gauge } from "lucide-react";
import { useAgentInsights } from "@/features/agents/agentInsightsStore";
import { cn } from "@/lib/utils";
import { useCortexStore, type TerminalSession } from "@/stores/cortexStore";

type AgentProvider = "Codex" | "Claude" | "Gemini" | "Agente IA";

type AgentUsage = {
  provider: AgentProvider;
  remainingPercent: number | null;
  totalTokens?: number;
  hourlyRemainingPercent?: number | null;
  weeklyRemainingPercent?: number | null;
  hourlyReset?: string;
  weeklyReset?: string;
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
  const sessionIds = new Set(sessions.map((session) => session.id));
  const liveInsights = useAgentInsights().filter((insight) => sessionIds.has(insight.sessionId));
  const liveInsight = liveInsights
    .sort((first, second) => second.updatedAt - first.updatedAt)
    .find((insight) => insight.provider || Object.keys(insight.usage).length > 0);
  const totalTokens = liveInsights.reduce((sum, insight) => sum + (insight.usage.totalTokens ?? 0), 0);
  const hourlyRemaining = minDefined(liveInsights.map((insight) => insight.usage.hourlyRemainingPercent));
  const weeklyRemaining = minDefined(liveInsights.map((insight) => insight.usage.weeklyRemainingPercent));
  const historyUsage = usageFromSessions(sessions);
  const usage: AgentUsage | null = liveInsight
    ? {
        provider: liveInsight.provider === "Agent" ? "Agente IA" : liveInsight.provider ?? historyUsage?.provider ?? "Agente IA",
        remainingPercent: liveInsight.usage.remainingPercent ?? historyUsage?.remainingPercent ?? null,
        totalTokens: totalTokens || liveInsight.usage.totalTokens,
        hourlyRemainingPercent: hourlyRemaining ?? liveInsight.usage.hourlyRemainingPercent ?? null,
        weeklyRemainingPercent: weeklyRemaining ?? liveInsight.usage.weeklyRemainingPercent ?? null,
        hourlyReset: liveInsight.usage.hourlyReset,
        weeklyReset: liveInsight.usage.weeklyReset,
      }
    : historyUsage;
  const remaining = usage?.remainingPercent ?? null;
  const title = usage
    ? remaining === null
      ? usage.totalTokens !== undefined
        ? `${usage.provider}: ${new Intl.NumberFormat().format(usage.totalTokens)} tokens reportados pelo CLI`
        : `${usage.provider}: o CLI não informou créditos ou contexto no terminal`
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
          {remaining !== null ? `${remaining}% livre` : usage?.totalTokens !== undefined ? `${formatTokens(usage.totalTokens)} tokens` : "sem dados"}
        </span>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-background">
        <div
          className={cn("h-full rounded-full transition-[width]", remaining === null ? "bg-muted-foreground/35" : remaining < 20 ? "bg-cortex-red" : remaining < 45 ? "bg-cortex-amber" : "bg-cortex-green")}
          style={{ width: `${remaining ?? 0}%` }}
        />
      </div>
      <p className="mt-1.5 truncate text-[10px] text-muted-foreground">
        {usage ? (remaining === null && usage.totalTokens === undefined ? "Aguardando métricas do CLI" : "Leitura local em tempo real") : "Nenhum agente detectado"}
      </p>
      {usage && (usage.hourlyRemainingPercent != null || usage.weeklyRemainingPercent != null) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[10px] text-muted-foreground">
          <LimitBadge label="Hora" reset={usage.hourlyReset} value={usage.hourlyRemainingPercent} />
          <LimitBadge label="Semana" reset={usage.weeklyReset} value={usage.weeklyRemainingPercent} />
        </div>
      )}
    </div>
  );
}

function formatTokens(value: number) {
  return value >= 1_000 ? `${(value / 1_000).toFixed(value >= 10_000 ? 0 : 1)}k` : String(value);
}

function minDefined(values: Array<number | undefined>) {
  const defined = values.filter((value): value is number => value !== undefined);
  return defined.length > 0 ? Math.min(...defined) : undefined;
}

function LimitBadge({ label, reset, value }: { label: string; reset?: string; value?: number | null }) {
  return (
    <div className="rounded border border-border bg-background/50 px-2 py-1" title={reset ? `${label}: reset ${reset}` : undefined}>
      <span className="text-muted-foreground/80">{label}</span>{" "}
      <span className={cn(value === undefined || value === null ? "text-muted-foreground" : value < 20 ? "text-cortex-red" : value < 45 ? "text-cortex-amber" : "text-cortex-green")}>
        {value === undefined || value === null ? "--" : `${value}%`}
      </span>
    </div>
  );
}
