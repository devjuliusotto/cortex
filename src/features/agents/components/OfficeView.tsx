import { AlertCircle, Bot, CircleCheck, Coins, Gauge, TerminalSquare } from "lucide-react";
import { useAgentInsights } from "@/features/agents/agentInsightsStore";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/stores/cortexStore";

export function OfficeView() {
  const insights = useAgentInsights();
  const { sessions, workspaces } = useCortexStore();
  const agentSessions = sessions.map((session) => ({
    session,
    workspace: workspaces.find((workspace) => workspace.id === session.workspaceId),
    insight: insights.find((item) => item.sessionId === session.id),
  }));
  const waiting = agentSessions.filter((item) => item.insight?.waitingForAuthorization).length;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto bg-cortex-graphite p-6">
      <div className="mx-auto max-w-6xl">
        <div className="flex items-start justify-between gap-4">
          <div><div className="flex items-center gap-2 text-xl font-semibold"><Bot className="h-5 w-5 text-primary" />Office View</div><p className="mt-1 text-sm text-muted-foreground">Estado dos terminais, agentes e métricas reportadas durante a sessão atual.</p></div>
          <div className={cn("rounded-md border px-3 py-2 text-xs", waiting ? "border-cortex-amber/40 bg-cortex-amber/10 text-cortex-amber" : "border-border bg-card text-muted-foreground")}>{waiting ? `${waiting} aguardando ação` : "Nenhuma autorização pendente"}</div>
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {agentSessions.map(({ session, workspace, insight }) => (
            <article className={cn("rounded-lg border bg-card/75 p-4", insight?.waitingForAuthorization ? "border-cortex-amber/50 shadow-[0_0_24px_rgba(255,203,107,0.08)]" : "border-border")} key={session.id}>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="flex items-center gap-2 text-sm font-medium"><TerminalSquare className="h-4 w-4 text-primary" /><span className="truncate">{session.name}</span></div><div className="mt-1 truncate text-xs text-muted-foreground">{workspace?.name ?? "Workspace"} · {insight?.provider ?? "Terminal"}</div></div>{insight?.waitingForAuthorization ? <AlertCircle className="h-5 w-5 animate-pulse text-cortex-amber" /> : <CircleCheck className="h-5 w-5 text-cortex-green" />}</div>
              <div className={cn("mt-4 rounded-md border p-3 text-xs", insight?.waitingForAuthorization ? "border-cortex-amber/30 bg-cortex-amber/10 text-cortex-amber" : "border-primary/20 bg-primary/5 text-primary")}>
                {agentCaption(session.id, session.status, Boolean(insight?.waitingForAuthorization))}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2"><UsageMetric icon={<Gauge className="h-3.5 w-3.5" />} label="Tokens" value={formatTokens(insight?.usage.totalTokens)} /><UsageMetric icon={<Coins className="h-3.5 w-3.5" />} label="Créditos / quota" value={insight?.usage.credits ?? "Não reportado"} /></div>
              {(insight?.usage.inputTokens !== undefined || insight?.usage.outputTokens !== undefined || insight?.usage.contextRemaining) && <div className="mt-3 text-[11px] leading-5 text-muted-foreground">{insight.usage.inputTokens !== undefined && <span className="mr-3">Entrada: {formatTokens(insight.usage.inputTokens)}</span>}{insight.usage.outputTokens !== undefined && <span className="mr-3">Saída: {formatTokens(insight.usage.outputTokens)}</span>}{insight.usage.contextRemaining && <span>Contexto restante: {insight.usage.contextRemaining}</span>}</div>}
            </article>
          ))}
        </div>
        {agentSessions.length === 0 && <div className="mt-6 rounded-lg border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Crie um terminal para começar a acompanhar agentes.</div>}
        <p className="mt-5 text-xs text-muted-foreground">Métricas aparecem quando Codex, Claude, Gemini ou outro CLI imprime tokens, créditos, quota ou contexto na saída. O Cortex não consulta contas externas.</p>
      </div>
    </div>
  );
}

function UsageMetric({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) { return <div className="rounded-md border border-border bg-background/50 p-3"><div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">{icon}{label}</div><div className="mt-1 truncate text-sm font-medium">{value}</div></div>; }
function formatTokens(value?: number) { return value === undefined ? "Não reportado" : new Intl.NumberFormat().format(value); }
const activeCaptions = ["Working", "Reviewing the workspace", "Building something useful", "Deep in the code", "Connecting the pieces", "Making steady progress"];
const idleCaptions = ["Ready for the next task", "Let's have a Coffee Break", "Enjoying a quiet moment", "Desk is clear", "Waiting by the terminal"];
function agentCaption(sessionId: string, status: string, waiting: boolean) {
  if (waiting) return "Waiting for your approval";
  const captions = status === "running" || status === "waiting" ? activeCaptions : idleCaptions;
  const index = [...sessionId].reduce((total, character) => total + character.charCodeAt(0), 0) % captions.length;
  return captions[index];
}
