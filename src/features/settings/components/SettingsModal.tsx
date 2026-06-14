import { invoke } from "@tauri-apps/api/core";
import { open, save } from "@tauri-apps/plugin-dialog";
import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import {
  AlertCircle, CheckCircle2, Database, Download, FolderOpen, Info, Keyboard,
  Loader2, Monitor, Palette, RefreshCw, RotateCcw, Search, Settings2, TerminalSquare,
  Trash2, Upload, X,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import packageJson from "../../../../package.json";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCortexStore, type CortexPersistedState } from "@/stores/cortexStore";

type SectionId = "general" | "appearance" | "terminal" | "shortcuts" | "data" | "updates" | "about";
type UpdateState = "idle" | "checking" | "up-to-date" | "available" | "downloading" | "ready" | "error";
type AppDataInfo = { directory: string; stateFile: string };

const sections: Array<{ id: SectionId; label: string; icon: typeof Settings2 }> = [
  { id: "general", label: "Geral", icon: Settings2 },
  { id: "appearance", label: "Aparência", icon: Palette },
  { id: "terminal", label: "Terminal", icon: TerminalSquare },
  { id: "shortcuts", label: "Atalhos", icon: Keyboard },
  { id: "data", label: "Dados e privacidade", icon: Database },
  { id: "updates", label: "Atualizações", icon: RefreshCw },
  { id: "about", label: "Sobre", icon: Info },
];

const shortcuts = [
  ["Ctrl+Shift+`", "Nova aba de terminal"],
  ["Ctrl+\\", "Dividir painel"],
  ["Ctrl+W", "Fechar aba ativa"],
  ["Ctrl+Tab / Ctrl+Shift+Tab", "Alternar entre abas"],
  ["Ctrl+,", "Abrir configurações"],
  ["Ctrl+1 … Ctrl+9", "Alternar foco entre painéis"],
] as const;

export function SettingsModal({ open: modalOpen, onClose }: { open: boolean; onClose: () => void }) {
  const store = useCortexStore();
  const [section, setSection] = useState<SectionId>("general");
  const [query, setQuery] = useState("");
  const [dataInfo, setDataInfo] = useState<AppDataInfo | null>(null);
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [message, setMessage] = useState("Verificações automáticas são feitas ao iniciar o Cortex.");
  const [downloadProgress, setDownloadProgress] = useState("");

  useEffect(() => {
    if (!modalOpen || !("__TAURI_INTERNALS__" in window)) return;
    void invoke<AppDataInfo>("get_app_data_info").then(setDataInfo).catch(() => setDataInfo(null));
  }, [modalOpen]);

  useEffect(() => {
    if (!modalOpen) return;
    const close = (event: KeyboardEvent) => event.key === "Escape" && onClose();
    window.addEventListener("keydown", close);
    return () => window.removeEventListener("keydown", close);
  }, [modalOpen, onClose]);

  const filteredShortcuts = useMemo(() => shortcuts.filter(([keys, description]) =>
    `${keys} ${description}`.toLowerCase().includes(query.toLowerCase())), [query]);

  if (!modalOpen) return null;

  async function checkForUpdates() {
    setUpdateState("checking");
    setMessage("Consultando a versão assinada mais recente...");
    try {
      const nextUpdate = await check();
      if (!nextUpdate) {
        setUpdateState("up-to-date");
        setMessage(`Cortex v${packageJson.version} está atualizado.`);
        return;
      }
      setUpdate(nextUpdate);
      setUpdateState("available");
      setMessage(`Cortex ${nextUpdate.version} está disponível.`);
    } catch (error) {
      setUpdateState("error");
      setMessage(`Falha ao verificar atualizações: ${String(error)}`);
    }
  }

  async function downloadUpdate() {
    if (!update) return;
    setUpdateState("downloading");
    let downloaded = 0;
    let total = 0;
    try {
      await update.download((event) => {
        if (event.event === "Started") total = event.data.contentLength ?? 0;
        if (event.event === "Progress") downloaded += event.data.chunkLength;
        setDownloadProgress(total ? `${formatBytes(downloaded)} / ${formatBytes(total)}` : formatBytes(downloaded));
      });
      setUpdateState("ready");
      setMessage("Atualização pronta para instalar.");
    } catch (error) {
      setUpdateState("error");
      setMessage(`Falha no download: ${String(error)}`);
    }
  }

  async function exportConfiguration() {
    if (!("__TAURI_INTERNALS__" in window)) return window.alert("Exportação está disponível no app desktop.");
    await store.saveNow();
    const path = await save({ title: "Exportar configuração do Cortex", defaultPath: `cortex-config-v${packageJson.version}.json`, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (!path) return;
    const state = await invoke<CortexPersistedState | null>("load_persisted_state");
    if (state) await invoke("export_persisted_state", { path, state });
  }

  async function importConfiguration() {
    if (!("__TAURI_INTERNALS__" in window)) return window.alert("Importação está disponível no app desktop.");
    const path = await open({ title: "Importar configuração do Cortex", multiple: false, filters: [{ name: "JSON", extensions: ["json"] }] });
    if (typeof path !== "string") return;
    const state = await invoke<CortexPersistedState>("import_persisted_state", { path });
    if (window.confirm("Substituir o estado local pela configuração importada?")) store.importPersistedState(state);
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/75 p-4 backdrop-blur-sm">
      <section className="flex h-[min(780px,92vh)] w-[min(1120px,95vw)] overflow-hidden rounded-xl border border-border bg-card shadow-2xl">
        <aside className="flex w-64 shrink-0 flex-col border-r border-border bg-background/45 p-3">
          <div className="px-3 py-3">
            <div className="text-base font-semibold">Configurações</div>
            <div className="mt-1 text-xs text-muted-foreground">Cortex v{packageJson.version}</div>
          </div>
          <nav className="mt-2 space-y-1">
            {sections.map((item) => {
              const Icon = item.icon;
              return <button className={cn("flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground", section === item.id && "bg-secondary text-foreground shadow-glow")} key={item.id} onClick={() => setSection(item.id)} type="button"><Icon className="h-4 w-4" />{item.label}</button>;
            })}
          </nav>
          <div className="mt-auto rounded-md border border-border bg-card/60 p-3 text-xs leading-5 text-muted-foreground">Preferências são salvas localmente. O Cortex não envia telemetria.</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <header className="flex h-14 shrink-0 items-center justify-between border-b border-border px-6">
            <div className="font-medium">{sections.find((item) => item.id === section)?.label}</div>
            <Button size="icon" variant="ghost" onClick={onClose} title="Fechar configurações"><X className="h-4 w-4" /></Button>
          </header>
          <div className="min-h-0 flex-1 overflow-y-auto p-6">
            {section === "general" && <SettingsPage title="Geral" description="Recursos principais e navegação do Cortex.">
              <ToggleRow checked={store.settings.officeViewEnabled} label="Office View" text="Exibe a visão de agentes e o atalho no canto inferior esquerdo." onChange={(value) => store.setFeatureFlag("officeViewEnabled", value)} />
              <ToggleRow checked={store.settings.showWorkspaceMetadata} label="Metadados do workspace" text="Branch Git, alterações, portas e contagens locais na sidebar." onChange={(value) => store.setFeatureFlag("showWorkspaceMetadata", value)} />
            </SettingsPage>}

            {section === "appearance" && <SettingsPage title="Aparência" description="Opções visuais coerentes com o tema atual.">
              <InfoCard icon={<Monitor className="h-5 w-5 text-primary" />} title="Tema Cortex Dark" text="O tema escuro de alto contraste acompanha a interface atual. A estrutura desta seção permite novos temas sem alterar o estado legado." />
              <ToggleRow checked={store.settings.browserPaneEnabled} label="Browser Pane experimental" text="Permite abas de browser dentro dos painéis divididos." onChange={(value) => store.setFeatureFlag("browserPaneEnabled", value)} />
            </SettingsPage>}

            {section === "terminal" && <SettingsPage title="Terminal" description="Inicialização e retenção local das sessões.">
              <ToggleRow checked={store.settings.autoStartTerminals} label="Iniciar terminais automaticamente" text="Inicia shells novos para as sessões configuradas ao abrir um workspace marcado para auto-start." onChange={(value) => store.setFeatureFlag("autoStartTerminals", value)} />
              <ToggleRow checked={store.settings.terminalHistoryEnabled} label="Persistir histórico dos terminais" text="Desativado por padrão. Quando desligado, a saída antiga não é restaurada entre execuções." onChange={(value) => store.setFeatureFlag("terminalHistoryEnabled", value)} />
              <InfoCard icon={<TerminalSquare className="h-5 w-5 text-primary" />} title="Histórico de comandos" text="A lista de comandos digitados é separada da saída completa do terminal e pode ser limpa em Dados e privacidade." />
            </SettingsPage>}

            {section === "shortcuts" && <SettingsPage title="Atalhos" description="Mapa pesquisável inspirado no fluxo de desenvolvedores do VS Code.">
              <label className="relative block"><Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" /><input autoFocus className="h-10 w-full rounded-md border border-border bg-background pl-10 pr-3 text-sm outline-none focus:ring-1 focus:ring-ring" onChange={(event) => setQuery(event.target.value)} placeholder="Pesquisar atalhos" value={query} /></label>
              <div className="overflow-hidden rounded-md border border-border">{filteredShortcuts.map(([keys, description]) => <div className="grid grid-cols-[220px_1fr] gap-4 border-b border-border px-4 py-3 text-sm last:border-0" key={keys}><div><kbd className="rounded border border-border bg-secondary px-2 py-1 font-mono text-xs">{keys}</kbd></div><div className="text-muted-foreground">{description}</div></div>)}</div>
              <p className="text-xs text-muted-foreground">A lista usa uma estrutura de dados independente, pronta para receber bindings personalizados no futuro.</p>
            </SettingsPage>}

            {section === "data" && <SettingsPage title="Dados e privacidade" description="Controle do estado local do Cortex.">
              <div className="rounded-md border border-border bg-background/50 p-4"><div className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Arquivo de estado</div><div className="mt-2 break-all font-mono text-xs">{dataInfo?.stateFile ?? ("__TAURI_INTERNALS__" in window ? "Carregando..." : "localStorage do navegador")}</div><div className="mt-4 flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => void invoke("open_app_data_dir")} disabled={!dataInfo}><FolderOpen className="mr-2 h-4 w-4" />Abrir pasta</Button><Button size="sm" variant="outline" onClick={() => void exportConfiguration()}><Download className="mr-2 h-4 w-4" />Exportar configuração</Button><Button size="sm" variant="outline" onClick={() => void importConfiguration()}><Upload className="mr-2 h-4 w-4" />Importar configuração</Button></div></div>
              <DangerAction icon={<Trash2 className="h-4 w-4" />} title="Limpar histórico dos terminais" text="Remove saída persistida e o histórico de comandos de todos os workspaces." action="Limpar histórico" onClick={() => window.confirm("Limpar todo o histórico local dos terminais?") && store.clearAllTerminalHistory()} />
              <DangerAction icon={<RotateCcw className="h-4 w-4" />} title="Resetar configurações" text="Restaura preferências padrão sem apagar workspaces, abas ou notas." action="Resetar" onClick={() => window.confirm("Restaurar as configurações padrão do Cortex?") && store.resetSettings()} />
            </SettingsPage>}

            {section === "updates" && <SettingsPage title="Atualizações" description="Versão instalada e releases assinadas.">
              <div className="grid gap-3 sm:grid-cols-2"><Metric label="Versão instalada" value={`v${packageJson.version}`} /><Metric label="Canal" value="Stable / GitHub Releases" /></div>
              <div className="rounded-md border border-border bg-background/50 p-4"><div className="flex items-start justify-between gap-4"><div><div className="flex items-center gap-2 text-sm font-medium"><UpdateIcon state={updateState} />{updateLabel(updateState)}</div><p className="mt-2 text-xs leading-5 text-muted-foreground">{message}</p>{downloadProgress && <p className="mt-1 text-xs text-muted-foreground">{downloadProgress}</p>}</div><div className="flex gap-2">{updateState === "available" && <Button size="sm" onClick={() => void downloadUpdate()}><Download className="mr-2 h-4 w-4" />Baixar</Button>}{updateState === "ready" && <Button size="sm" onClick={() => update && void update.install().then(() => relaunch())}>Instalar</Button>}<Button size="sm" variant="outline" disabled={["checking", "downloading"].includes(updateState)} onClick={() => void checkForUpdates()}><RefreshCw className="mr-2 h-4 w-4" />Verificar</Button></div></div></div>
            </SettingsPage>}

            {section === "about" && <SettingsPage title="Sobre o Cortex" description="Workspace local para terminais e agentes."><InfoCard icon={<Info className="h-5 w-5 text-primary" />} title={`Cortex v${packageJson.version}`} text="Gerenciador local-first de terminais para Windows, com workspaces, painéis e acompanhamento de agentes. Nenhum token ou histórico é enviado pelo Cortex." /></SettingsPage>}
          </div>
        </div>
      </section>
    </div>
  );
}

function SettingsPage({ title, description, children }: { title: string; description: string; children: ReactNode }) { return <div className="mx-auto max-w-3xl space-y-4"><div className="mb-6"><h2 className="text-xl font-semibold">{title}</h2><p className="mt-1 text-sm text-muted-foreground">{description}</p></div>{children}</div>; }
function ToggleRow({ checked, label, text, onChange }: { checked: boolean; label: string; text: string; onChange: (value: boolean) => void }) { return <label className="flex items-start justify-between gap-5 rounded-md border border-border bg-background/50 p-4"><span><span className="block text-sm font-medium">{label}</span><span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span></span><button aria-checked={checked} className={cn("relative mt-1 h-5 w-9 shrink-0 rounded-full bg-muted transition-colors", checked && "bg-primary")} onClick={() => onChange(!checked)} role="switch" type="button"><span className={cn("absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-background transition-transform", checked && "translate-x-4")} /></button></label>; }
function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="flex gap-3 rounded-md border border-border bg-background/50 p-4">{icon}<div><div className="text-sm font-medium">{title}</div><p className="mt-1 text-xs leading-5 text-muted-foreground">{text}</p></div></div>; }
function DangerAction({ icon, title, text, action, onClick }: { icon: ReactNode; title: string; text: string; action: string; onClick: () => void }) { return <div className="flex items-center justify-between gap-4 rounded-md border border-cortex-red/25 bg-cortex-red/5 p-4"><div><div className="text-sm font-medium">{title}</div><p className="mt-1 text-xs text-muted-foreground">{text}</p></div><Button size="sm" variant="outline" className="text-cortex-red" onClick={onClick}>{icon}<span className="ml-2">{action}</span></Button></div>; }
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-md border border-border bg-background/50 p-4"><div className="text-xs text-muted-foreground">{label}</div><div className="mt-2 text-lg font-semibold">{value}</div></div>; }
function UpdateIcon({ state }: { state: UpdateState }) { if (["checking", "downloading"].includes(state)) return <Loader2 className="h-4 w-4 animate-spin text-primary" />; if (["up-to-date", "ready"].includes(state)) return <CheckCircle2 className="h-4 w-4 text-cortex-green" />; if (state === "error") return <AlertCircle className="h-4 w-4 text-cortex-red" />; return <RefreshCw className="h-4 w-4 text-primary" />; }
function updateLabel(state: UpdateState) { return ({ idle: "Verificação automática", checking: "Verificando", "up-to-date": "Atualizado", available: "Atualização disponível", downloading: "Baixando", ready: "Pronto para instalar", error: "Erro" } satisfies Record<UpdateState, string>)[state]; }
function formatBytes(bytes: number) { if (bytes < 1024) return `${bytes} B`; if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`; return `${(bytes / 1024 / 1024).toFixed(1)} MB`; }
