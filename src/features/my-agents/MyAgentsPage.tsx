import { invoke } from "@tauri-apps/api/core";
import {
  AlertCircle,
  AlertTriangle,
  Bot,
  CheckCircle2,
  ExternalLink,
  FolderOpen,
  KeyRound,
  Loader2,
  PackagePlus,
  Play,
  Plus,
  RefreshCw,
  Search,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { detectAgentsCached, getCachedAgentStatuses, type AgentDetectionStatus } from "@/features/my-agents/agentDetection";
import { agentsCatalog, type Agent } from "@/features/my-agents/agentsCatalog";
import {
  curatedSkillCategories,
  curatedSkillsCatalog,
  extensionsCatalog,
  skillDirectoryUrl,
  skillGitHubUrl,
  skillInstallCommand,
  skillPaths,
  skillsExplanation,
  type CuratedSkill,
  type SkillPath,
} from "@/features/my-agents/skillsCatalog";
import { queueVisibleTerminalCommand } from "@/features/terminal/terminalBridge";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/stores/cortexStore";

type Section = "installed" | "available" | "skills" | "extensions";
type SkillDirectoryInfo = { path: string; exists: boolean };
type InstallNotificationStatus = "running" | "success" | "error";
type InstallNotification = {
  id: string;
  title: string;
  command: string;
  status: InstallNotificationStatus;
  detail: string;
};
type BackgroundInstallResult = { code: number | null; output: string };

const sectionLabels: Array<{ id: Section; label: string }> = [
  { id: "installed", label: "Installed" },
  { id: "available", label: "Available" },
  { id: "skills", label: "Skills" },
  { id: "extensions", label: "Extensions" },
];

type MyAgentsPageProps = {
  onTerminalOpen?: (sessionId: string) => void;
};

export function MyAgentsPage({ onTerminalOpen }: MyAgentsPageProps) {
  const [section, setSection] = useState<Section>("installed");
  const [statuses, setStatuses] = useState<Record<string, AgentDetectionStatus>>(() =>
    getCachedAgentStatuses() ?? Object.fromEntries(agentsCatalog.map((agent) => [agent.id, "checking"])),
  );
  const [checking, setChecking] = useState(false);
  const [extensionUrl, setExtensionUrl] = useState("");
  const [installNotifications, setInstallNotifications] = useState<InstallNotification[]>([]);
  const installSequence = useRef(0);
  const { activeWorkspaceId, createSession, workspaces } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  const refreshDetection = async (force = false) => {
    setChecking(true);
    if (!getCachedAgentStatuses()) {
      setStatuses(Object.fromEntries(agentsCatalog.map((agent) => [agent.id, "checking"])));
    }
    setStatuses(await detectAgentsCached(agentsCatalog, force));
    setChecking(false);
  };

  useEffect(() => { void refreshDetection(false); }, []);

  const installed = useMemo(() => agentsCatalog.filter((agent) => statuses[agent.id] === "installed"), [statuses]);
  const available = useMemo(() => agentsCatalog.filter((agent) => statuses[agent.id] !== "installed"), [statuses]);

  const updateInstallNotification = (id: string, patch: Partial<InstallNotification>) => {
    setInstallNotifications((items) => items.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  };

  const dismissInstallNotification = (id: string) => {
    setInstallNotifications((items) => items.filter((item) => item.id !== id));
  };

  const openCommand = (command: string) => {
    if (!activeWorkspace) {
      window.alert("Create or select a workspace before opening a command in the terminal.");
      return;
    }
    const sessionId = createSession(activeWorkspace.id, "powershell");
    queueVisibleTerminalCommand(sessionId, command);
    onTerminalOpen?.(sessionId);
  };

  const runBackgroundInstall = async (command: string, title: string) => {
    if (!activeWorkspace) {
      window.alert("Create or select a workspace before installing.");
      return;
    }

    const id = `install-${Date.now()}-${installSequence.current++}`;
    setInstallNotifications((items) => [
      {
        id,
        title,
        command,
        status: "running" as const,
        detail: "Downloading and installing in the background.",
      },
      ...items,
    ].slice(0, 4));

    try {
      const result = await invoke<BackgroundInstallResult>("run_agent_install_command", {
        command,
        cwd: activeWorkspace.defaultWorkingDirectory ?? null,
      });
      updateInstallNotification(id, {
        status: "success",
        detail: result.output || "Finished successfully.",
      });
      void refreshDetection(true);
    } catch (error) {
      updateInstallNotification(id, {
        status: "error",
        detail: formatInstallError(error),
      });
    }
  };

  const installCustomExtension = () => {
    const normalized = normalizeGitHubUrl(extensionUrl);
    if (!normalized) {
      window.alert("Enter a valid public GitHub repository URL, for example https://github.com/owner/repository.");
      return;
    }
    void runBackgroundInstall(`gemini extensions install ${normalized}`, "Install Gemini extension");
  };

  return (
    <section className="relative flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border bg-cortex-graphite">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card/55 px-6 py-5">
        <div>
          <div className="flex items-center gap-2 text-lg font-semibold"><Bot className="h-5 w-5 text-primary" />My Agents</div>
          <p className="mt-1 text-sm text-muted-foreground">Discover, verify and launch local coding agents. Installs run as background downloads.</p>
        </div>
        <Button size="sm" variant="outline" disabled={checking} onClick={() => void refreshDetection(true)}>
          <RefreshCw className={cn("mr-2 h-4 w-4", checking && "animate-spin")} />Refresh
        </Button>
      </header>

      <nav className="flex shrink-0 gap-1 border-b border-border bg-background/35 px-6 py-2">
        {sectionLabels.map((item) => (
          <button className={cn("rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground", section === item.id && "bg-secondary text-foreground shadow-glow")} key={item.id} onClick={() => setSection(item.id)} type="button">
            {item.label}
            {item.id === "installed" && <span className="ml-2 text-xs text-muted-foreground">{installed.length}</span>}
            {item.id === "available" && <span className="ml-2 text-xs text-muted-foreground">{available.length}</span>}
          </button>
        ))}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {section === "installed" && <AgentGrid agents={installed} empty="No detected agents yet. Refresh after installing one." onInstall={runBackgroundInstall} onRunCommand={openCommand} statuses={statuses} />}
        {section === "available" && <AgentGrid agents={available} empty="All catalogued agents are installed." onInstall={runBackgroundInstall} onRunCommand={openCommand} statuses={statuses} />}
        {section === "skills" && <SkillsSection onInstall={runBackgroundInstall} workspacePath={activeWorkspace?.defaultWorkingDirectory} />}
        {section === "extensions" && (
          <div className="mx-auto max-w-5xl space-y-5">
            <SectionHeading icon={<Sparkles className="h-5 w-5 text-primary" />} title="Gemini CLI Extensions" text="Install commands run in the background and report back here without opening a terminal window." />
            <div className="rounded-lg border border-border bg-card/65 p-4">
              <label className="text-sm font-medium" htmlFor="extension-url">Install from GitHub</label>
              <div className="mt-2 flex gap-2">
                <input className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" id="extension-url" onChange={(event) => setExtensionUrl(event.target.value)} placeholder="https://github.com/owner/repository" value={extensionUrl} />
                <Button onClick={installCustomExtension}><PackagePlus className="mr-2 h-4 w-4" />Install</Button>
              </div>
              <CommandPreview command={`gemini extensions install ${extensionUrl || "<github-url>"}`} />
            </div>
            <div className="grid gap-3 md:grid-cols-2">
              {extensionsCatalog.map((extension) => (
                <article className="rounded-lg border border-border bg-card/65 p-4" key={extension.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold">{extension.name}</div>
                      <div className="mt-1 text-xs text-primary">{extension.category} · {extension.provider}</div>
                    </div>
                    <a className="text-muted-foreground hover:text-foreground" href={extension.githubUrl} rel="noreferrer" target="_blank" title="Open GitHub"><ExternalLink className="h-4 w-4" /></a>
                  </div>
                  <p className="mt-3 text-xs leading-5 text-muted-foreground">{extension.description}</p>
                  <CommandPreview command={extension.installCommand} />
                  <Button className="mt-3" size="sm" variant="outline" onClick={() => void runBackgroundInstall(extension.installCommand, `Install ${extension.name}`)}>
                    <PackagePlus className="mr-2 h-4 w-4" />Install
                  </Button>
                </article>
              ))}
            </div>
          </div>
        )}
      </div>

      <InstallNotificationStack notifications={installNotifications} onDismiss={dismissInstallNotification} />
    </section>
  );
}

function AgentGrid({ agents, empty, onInstall, onRunCommand, statuses }: { agents: Agent[]; empty: string; onInstall: (command: string, title: string) => void; onRunCommand: (command: string) => void; statuses: Record<string, AgentDetectionStatus> }) {
  if (agents.length === 0) return <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{empty}</div>;
  return <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">{agents.map((agent) => <AgentCard agent={agent} key={agent.id} onInstall={onInstall} onRunCommand={onRunCommand} status={statuses[agent.id] ?? "checking"} />)}</div>;
}

function AgentCard({ agent, onInstall, onRunCommand, status }: { agent: Agent; onInstall: (command: string, title: string) => void; onRunCommand: (command: string) => void; status: AgentDetectionStatus }) {
  const installed = status === "installed";
  const installCommand = platformInstallCommand(agent);
  return (
    <article className="flex flex-col rounded-lg border border-border bg-card/65 p-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-base font-semibold">{agent.name}</div>
          <div className="mt-2 flex flex-wrap gap-1.5">{agent.tags.map((tag) => <span className="rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground" key={tag}>{tag}</span>)}</div>
        </div>
        <StatusBadge status={status} />
      </div>
      <p className="mt-4 text-sm leading-6 text-muted-foreground">{agent.description}</p>
      <div className="mt-4"><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Terminal command</div><CommandPreview command={agent.runCommand} /></div>
      {agent.requiresLogin || agent.loginHint ? <div className="mt-3 flex gap-2 rounded-md border border-cortex-amber/25 bg-cortex-amber/5 p-3 text-xs text-muted-foreground"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cortex-amber" /><div><div className="font-medium text-foreground">Login or API key may be required</div><div className="mt-1 leading-5">{agent.loginHint}</div></div></div> : null}
      {agent.needsVerification && <div className="mt-3 flex gap-2 rounded-md border border-cortex-red/30 bg-cortex-red/5 p-3 text-xs text-cortex-red"><ShieldAlert className="h-4 w-4 shrink-0" />Verify the official installation instructions before continuing.</div>}
      {agent.postInstallTutorial && <div className="mt-3 rounded-md border border-border bg-background/50 p-3 text-xs"><div className="font-medium">After installation</div><p className="mt-1 leading-5 text-muted-foreground">{agent.postInstallTutorial}</p></div>}
      <div className="mt-auto flex flex-wrap gap-2 pt-4">
        <Button size="sm" onClick={() => onRunCommand(agent.runCommand)}><Play className="mr-2 h-4 w-4" />Open in terminal</Button>
        {!installed && <Button size="sm" variant="outline" onClick={() => onInstall(installCommand, `Install ${agent.name}`)}><PackagePlus className="mr-2 h-4 w-4" />Install</Button>}
        <a className="inline-flex h-9 items-center rounded-md px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" href={agent.officialUrl} rel="noreferrer" target="_blank"><ExternalLink className="mr-2 h-3.5 w-3.5" />Official site</a>
      </div>
      {!installed && <CommandPreview command={installCommand} warning={isRemoteScriptCommand(installCommand)} />}
    </article>
  );
}

function SkillsSection({ onInstall, workspacePath }: { onInstall: (command: string, title: string) => void; workspacePath?: string }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof curatedSkillCategories)[number]>("All");
  const [directories, setDirectories] = useState<Record<string, SkillDirectoryInfo | null>>({});
  const filteredSkills = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return curatedSkillsCatalog.filter((skill) => {
      const matchesCategory = category === "All" || skill.category === category;
      const matchesQuery = !normalizedQuery || `${skill.name} ${skill.repository} ${skill.description} ${skill.tags.join(" ")}`.toLowerCase().includes(normalizedQuery);
      return matchesCategory && matchesQuery;
    });
  }, [category, query]);
  const refresh = async () => {
    const entries = await Promise.all(skillPaths.map(async (skill) => {
      try { return [skill.path, await invoke<SkillDirectoryInfo>("get_skill_directory_info", { path: skill.path, workspacePath })] as const; }
      catch { return [skill.path, null] as const; }
    }));
    setDirectories(Object.fromEntries(entries));
  };
  useEffect(() => { void refresh(); }, [workspacePath]);
  const createDirectory = async (skill: SkillPath) => { await invoke("create_skill_directory", { path: skill.path, workspacePath }); await refresh(); };
  return (
    <div className="mx-auto max-w-6xl space-y-5">
      <SectionHeading icon={<Sparkles className="h-5 w-5 text-primary" />} title="Agent Skills" text={skillsExplanation.trim()} />
      {!workspacePath && <div className="flex gap-2 rounded-md border border-cortex-amber/30 bg-cortex-amber/5 p-3 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0 text-cortex-amber" />Set a default terminal path on the active workspace before installing skills from the catalog.</div>}
      <section className="rounded-lg border border-border bg-card/65 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-sm font-semibold">Curated GitHub skills</h3>
            <p className="mt-1 text-xs leading-5 text-muted-foreground">30 popular skills from the public skills.sh leaderboard. Installs run in the background, with the command preview kept here for review.</p>
          </div>
          <label className="flex h-10 min-w-0 items-center gap-2 rounded-md border border-border bg-background px-3 text-xs text-muted-foreground lg:w-80">
            <Search className="h-4 w-4 shrink-0" />
            <input className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none" onChange={(event) => setQuery(event.target.value)} placeholder="Search skills" value={query} />
          </label>
        </div>
        <div className="mt-4 flex gap-1 overflow-x-auto pb-1">{curatedSkillCategories.map((item) => <button className={cn("shrink-0 rounded-md px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground", category === item && "bg-secondary text-foreground")} key={item} onClick={() => setCategory(item)} type="button">{item}</button>)}</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">{filteredSkills.map((skill) => <CuratedSkillCard key={`${skill.repository}:${skill.id}`} onInstall={() => onInstall(skillInstallCommand(skill), `Install ${skill.name}`)} skill={skill} />)}</div>
        {filteredSkills.length === 0 && <div className="rounded-md border border-dashed border-border p-6 text-center text-sm text-muted-foreground">No skills match this search.</div>}
      </section>
      <section>
        <h3 className="mb-3 text-sm font-semibold">Skill folders</h3>
        <div className="grid gap-3 md:grid-cols-2">{skillPaths.map((skill) => { const info = directories[skill.path]; const localUnavailable = skill.type === "local" && !workspacePath; return <article className="rounded-lg border border-border bg-card/65 p-4" key={skill.path}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{skill.type === "global" ? "Global" : "Workspace"} skill path</div><code className="mt-1 block text-xs text-primary">{skill.path}</code></div>{info?.exists ? <CheckCircle2 className="h-5 w-5 text-cortex-green" /> : <Plus className="h-5 w-5 text-muted-foreground" />}</div><p className="mt-3 text-xs leading-5 text-muted-foreground">{skill.description}</p>{info && <div className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{info.path}</div>}<div className="mt-4 flex gap-2"><Button size="sm" variant="outline" disabled={localUnavailable || !info?.exists} onClick={() => void invoke("open_skill_directory", { path: skill.path, workspacePath })}><FolderOpen className="mr-2 h-4 w-4" />Open folder</Button>{!info?.exists && <Button size="sm" disabled={localUnavailable} onClick={() => void createDirectory(skill)}><Plus className="mr-2 h-4 w-4" />Create folder</Button>}</div></article>; })}</div>
      </section>
    </div>
  );
}

function InstallNotificationStack({ notifications, onDismiss }: { notifications: InstallNotification[]; onDismiss: (id: string) => void }) {
  if (notifications.length === 0) return null;
  return (
    <div aria-live="polite" className="pointer-events-none fixed bottom-4 right-4 z-50 flex w-[min(380px,calc(100vw-2rem))] flex-col gap-2">
      {notifications.map((notification) => (
        <article className="pointer-events-auto rounded-md border border-border bg-card/95 p-3 shadow-xl backdrop-blur" key={notification.id}>
          <div className="flex items-start gap-3">
            <NotificationIcon status={notification.status} />
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold">{notification.title}</p>
                  <p className="mt-0.5 text-[11px] uppercase tracking-wide text-muted-foreground">{notificationLabel(notification.status)}</p>
                </div>
                <Button aria-label="Dismiss download notification" className="h-7 w-7 shrink-0" size="icon" variant="ghost" onClick={() => onDismiss(notification.id)}><X className="h-3.5 w-3.5" /></Button>
              </div>
              <p className="mt-2 max-h-20 overflow-y-auto text-xs leading-5 text-muted-foreground">{notification.detail}</p>
              <code className="mt-2 block truncate rounded border border-border bg-background px-2 py-1 text-[10px] text-muted-foreground">{notification.command}</code>
            </div>
          </div>
        </article>
      ))}
    </div>
  );
}

function NotificationIcon({ status }: { status: InstallNotificationStatus }) {
  if (status === "running") return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />;
  if (status === "success") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-cortex-green" />;
  return <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-cortex-red" />;
}

function notificationLabel(status: InstallNotificationStatus) {
  if (status === "running") return "Downloading";
  if (status === "success") return "Completed";
  return "Needs attention";
}

function SectionHeading({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="flex gap-3">{icon}<div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{text}</p></div></div>; }
function CuratedSkillCard({ onInstall, skill }: { onInstall: () => void; skill: CuratedSkill }) { return <article className="flex min-h-64 flex-col rounded-md border border-border bg-background/45 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><div className="truncate text-sm font-semibold">{skill.name}</div><div className="mt-1 truncate text-[11px] text-primary">{skill.category} · {skill.installs} installs</div></div><a className="shrink-0 text-muted-foreground hover:text-foreground" href={skillGitHubUrl(skill)} rel="noreferrer" target="_blank" title="Open GitHub repository"><ExternalLink className="h-4 w-4" /></a></div><p className="mt-3 flex-1 text-xs leading-5 text-muted-foreground">{skill.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{skill.tags.map((tag) => <span className="rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground" key={tag}>{tag}</span>)}</div><CommandPreview command={skillInstallCommand(skill)} /><div className="mt-3 flex flex-wrap gap-2"><Button size="sm" onClick={onInstall}><PackagePlus className="mr-2 h-3.5 w-3.5" />Install</Button><a className="inline-flex h-8 items-center rounded-md px-2 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" href={skillDirectoryUrl(skill)} rel="noreferrer" target="_blank"><ExternalLink className="mr-1.5 h-3.5 w-3.5" />Details</a></div></article>; }
function CommandPreview({ command, warning = false }: { command: string; warning?: boolean }) { return <div className={cn("mt-2 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground", warning && "border-cortex-amber/35 bg-cortex-amber/5 text-cortex-amber")}><span className="mr-2 select-none text-primary">$</span>{command}{warning && <div className="mt-1 font-sans text-[10px]">Remote script pipeline: review the command and official source before installing.</div>}</div>; }
function StatusBadge({ status }: { status: AgentDetectionStatus }) { if (status === "checking") return <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Checking</span>; if (status === "installed") return <span className="flex items-center gap-1.5 rounded-full bg-cortex-green/10 px-2.5 py-1 text-[11px] text-cortex-green"><CheckCircle2 className="h-3 w-3" />Installed</span>; return <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">Not installed</span>; }
function platformInstallCommand(agent: Agent) { const platform = navigator.platform.toLowerCase(); if (platform.includes("mac")) return agent.installCommandMac; if (platform.includes("linux")) return agent.installCommandLinux; return agent.installCommandWindows; }
function isRemoteScriptCommand(command: string) { return /(?:curl|wget|irm|invoke-restmethod|invoke-webrequest).*(?:\||iex|bash|sh)/i.test(command); }
function normalizeGitHubUrl(value: string) { const trimmed = value.trim().replace(/\.git$/, ""); return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(trimmed) ? trimmed : null; }
function formatInstallError(error: unknown) { const message = String(error || "Install failed."); return message.length > 1_200 ? `${message.slice(0, 1_200)}...` : message; }
