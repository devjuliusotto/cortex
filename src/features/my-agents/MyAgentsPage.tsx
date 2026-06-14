import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle, Bot, CheckCircle2, ExternalLink, FolderOpen, KeyRound, Loader2,
  PackagePlus, Play, Plus, RefreshCw, ShieldAlert, Sparkles, TerminalSquare,
} from "lucide-react";
import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { detectAgents, type AgentDetectionStatus } from "@/features/my-agents/agentDetection";
import { agentsCatalog, type Agent } from "@/features/my-agents/agentsCatalog";
import { extensionsCatalog, skillPaths, skillsExplanation, type SkillPath } from "@/features/my-agents/skillsCatalog";
import { queueVisibleTerminalCommand } from "@/features/terminal/terminalBridge";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/stores/cortexStore";

type Section = "installed" | "available" | "skills" | "extensions";
type SkillDirectoryInfo = { path: string; exists: boolean };

const sectionLabels: Array<{ id: Section; label: string }> = [
  { id: "installed", label: "Installed" },
  { id: "available", label: "Available" },
  { id: "skills", label: "Skills" },
  { id: "extensions", label: "Extensions" },
];

export function MyAgentsPage() {
  const [section, setSection] = useState<Section>("installed");
  const [statuses, setStatuses] = useState<Record<string, AgentDetectionStatus>>(() =>
    Object.fromEntries(agentsCatalog.map((agent) => [agent.id, "checking"])),
  );
  const [checking, setChecking] = useState(false);
  const [extensionUrl, setExtensionUrl] = useState("");
  const { activeWorkspaceId, createSession, workspaces } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  const refreshDetection = async () => {
    setChecking(true);
    setStatuses(Object.fromEntries(agentsCatalog.map((agent) => [agent.id, "checking"])));
    setStatuses(await detectAgents(agentsCatalog));
    setChecking(false);
  };

  useEffect(() => { void refreshDetection(); }, []);

  const installed = useMemo(() => agentsCatalog.filter((agent) => statuses[agent.id] === "installed"), [statuses]);
  const available = useMemo(() => agentsCatalog.filter((agent) => statuses[agent.id] !== "installed"), [statuses]);

  const openCommand = (command: string) => {
    if (!activeWorkspace) {
      window.alert("Create or select a workspace before opening a command in the terminal.");
      return;
    }
    const sessionId = createSession(activeWorkspace.id, "powershell");
    queueVisibleTerminalCommand(sessionId, command);
  };

  const installCustomExtension = () => {
    const normalized = normalizeGitHubUrl(extensionUrl);
    if (!normalized) {
      window.alert("Enter a valid public GitHub repository URL, for example https://github.com/owner/repository.");
      return;
    }
    openCommand(`gemini extensions install ${normalized}`);
  };

  return (
    <section className="flex min-h-0 flex-1 flex-col overflow-hidden border-l border-border bg-cortex-graphite">
      <header className="flex shrink-0 items-start justify-between gap-4 border-b border-border bg-card/55 px-6 py-5">
        <div><div className="flex items-center gap-2 text-lg font-semibold"><Bot className="h-5 w-5 text-primary" />My Agents</div><p className="mt-1 text-sm text-muted-foreground">Discover, verify and launch local coding agents through visible Cortex terminals.</p></div>
        <Button size="sm" variant="outline" disabled={checking} onClick={() => void refreshDetection()}><RefreshCw className={cn("mr-2 h-4 w-4", checking && "animate-spin")} />Refresh</Button>
      </header>

      <nav className="flex shrink-0 gap-1 border-b border-border bg-background/35 px-6 py-2">
        {sectionLabels.map((item) => <button className={cn("rounded-md px-3 py-2 text-sm text-muted-foreground hover:bg-secondary hover:text-foreground", section === item.id && "bg-secondary text-foreground shadow-glow")} key={item.id} onClick={() => setSection(item.id)} type="button">{item.label}{item.id === "installed" && <span className="ml-2 text-xs text-muted-foreground">{installed.length}</span>}{item.id === "available" && <span className="ml-2 text-xs text-muted-foreground">{available.length}</span>}</button>)}
      </nav>

      <div className="min-h-0 flex-1 overflow-y-auto p-6">
        {section === "installed" && <AgentGrid agents={installed} empty="No detected agents yet. Refresh after installing one." onCommand={openCommand} statuses={statuses} />}
        {section === "available" && <AgentGrid agents={available} empty="All catalogued agents are installed." onCommand={openCommand} statuses={statuses} />}
        {section === "skills" && <SkillsSection workspacePath={activeWorkspace?.defaultWorkingDirectory} />}
        {section === "extensions" && <div className="mx-auto max-w-5xl space-y-5">
          <SectionHeading icon={<Sparkles className="h-5 w-5 text-primary" />} title="Gemini CLI Extensions" text="Every install command opens in a visible integrated terminal." />
          <div className="rounded-lg border border-border bg-card/65 p-4"><label className="text-sm font-medium" htmlFor="extension-url">Install from GitHub</label><div className="mt-2 flex gap-2"><input className="h-10 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring" id="extension-url" onChange={(event) => setExtensionUrl(event.target.value)} placeholder="https://github.com/owner/repository" value={extensionUrl} /><Button onClick={installCustomExtension}><TerminalSquare className="mr-2 h-4 w-4" />Open install terminal</Button></div><CommandPreview command={`gemini extensions install ${extensionUrl || "<github-url>"}`} /></div>
          <div className="grid gap-3 md:grid-cols-2">{extensionsCatalog.map((extension) => <article className="rounded-lg border border-border bg-card/65 p-4" key={extension.id}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{extension.name}</div><div className="mt-1 text-xs text-primary">{extension.category} · {extension.provider}</div></div><a className="text-muted-foreground hover:text-foreground" href={extension.githubUrl} rel="noreferrer" target="_blank" title="Open GitHub"><ExternalLink className="h-4 w-4" /></a></div><p className="mt-3 text-xs leading-5 text-muted-foreground">{extension.description}</p><CommandPreview command={extension.installCommand} /><Button className="mt-3" size="sm" variant="outline" onClick={() => openCommand(extension.installCommand)}><TerminalSquare className="mr-2 h-4 w-4" />Install in terminal</Button></article>)}</div>
        </div>}
      </div>
    </section>
  );
}

function AgentGrid({ agents, empty, onCommand, statuses }: { agents: Agent[]; empty: string; onCommand: (command: string) => void; statuses: Record<string, AgentDetectionStatus> }) {
  if (agents.length === 0) return <div className="mx-auto max-w-3xl rounded-lg border border-dashed border-border p-10 text-center text-sm text-muted-foreground">{empty}</div>;
  return <div className="mx-auto grid max-w-6xl gap-4 lg:grid-cols-2">{agents.map((agent) => <AgentCard agent={agent} key={agent.id} onCommand={onCommand} status={statuses[agent.id] ?? "checking"} />)}</div>;
}

function AgentCard({ agent, onCommand, status }: { agent: Agent; onCommand: (command: string) => void; status: AgentDetectionStatus }) {
  const installed = status === "installed";
  const installCommand = platformInstallCommand(agent);
  return <article className="flex flex-col rounded-lg border border-border bg-card/65 p-5"><div className="flex items-start justify-between gap-3"><div><div className="text-base font-semibold">{agent.name}</div><div className="mt-2 flex flex-wrap gap-1.5">{agent.tags.map((tag) => <span className="rounded bg-secondary px-2 py-0.5 text-[10px] text-muted-foreground" key={tag}>{tag}</span>)}</div></div><StatusBadge status={status} /></div><p className="mt-4 text-sm leading-6 text-muted-foreground">{agent.description}</p><div className="mt-4"><div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Terminal command</div><CommandPreview command={agent.runCommand} /></div>{agent.requiresLogin || agent.loginHint ? <div className="mt-3 flex gap-2 rounded-md border border-cortex-amber/25 bg-cortex-amber/5 p-3 text-xs text-muted-foreground"><KeyRound className="mt-0.5 h-4 w-4 shrink-0 text-cortex-amber" /><div><div className="font-medium text-foreground">Login or API key may be required</div><div className="mt-1 leading-5">{agent.loginHint}</div></div></div> : null}{agent.needsVerification && <div className="mt-3 flex gap-2 rounded-md border border-cortex-red/30 bg-cortex-red/5 p-3 text-xs text-cortex-red"><ShieldAlert className="h-4 w-4 shrink-0" />Verify the official installation instructions before continuing.</div>}{agent.postInstallTutorial && <div className="mt-3 rounded-md border border-border bg-background/50 p-3 text-xs"><div className="font-medium">After installation</div><p className="mt-1 leading-5 text-muted-foreground">{agent.postInstallTutorial}</p></div>}<div className="mt-auto flex flex-wrap gap-2 pt-4"><Button size="sm" onClick={() => onCommand(agent.runCommand)}><Play className="mr-2 h-4 w-4" />Open in terminal</Button>{!installed && <Button size="sm" variant="outline" onClick={() => onCommand(installCommand)}><PackagePlus className="mr-2 h-4 w-4" />Install</Button>}<a className="inline-flex h-9 items-center rounded-md px-3 text-xs text-muted-foreground hover:bg-secondary hover:text-foreground" href={agent.officialUrl} rel="noreferrer" target="_blank"><ExternalLink className="mr-2 h-3.5 w-3.5" />Official site</a></div>{!installed && <CommandPreview command={installCommand} warning={isRemoteScriptCommand(installCommand)} />}</article>;
}

function SkillsSection({ workspacePath }: { workspacePath?: string }) {
  const [directories, setDirectories] = useState<Record<string, SkillDirectoryInfo | null>>({});
  const refresh = async () => {
    const entries = await Promise.all(skillPaths.map(async (skill) => {
      try { return [skill.path, await invoke<SkillDirectoryInfo>("get_skill_directory_info", { path: skill.path, workspacePath })] as const; }
      catch { return [skill.path, null] as const; }
    }));
    setDirectories(Object.fromEntries(entries));
  };
  useEffect(() => { void refresh(); }, [workspacePath]);
  const createDirectory = async (skill: SkillPath) => { await invoke("create_skill_directory", { path: skill.path, workspacePath }); await refresh(); };
  return <div className="mx-auto max-w-5xl space-y-5"><SectionHeading icon={<Sparkles className="h-5 w-5 text-primary" />} title="Agent Skills" text={skillsExplanation.trim()} />{!workspacePath && <div className="flex gap-2 rounded-md border border-cortex-amber/30 bg-cortex-amber/5 p-3 text-xs text-muted-foreground"><AlertTriangle className="h-4 w-4 shrink-0 text-cortex-amber" />Set a default terminal path on the active workspace to manage local skill folders.</div>}<div className="grid gap-3 md:grid-cols-2">{skillPaths.map((skill) => { const info = directories[skill.path]; const localUnavailable = skill.type === "local" && !workspacePath; return <article className="rounded-lg border border-border bg-card/65 p-4" key={skill.path}><div className="flex items-start justify-between gap-3"><div><div className="text-sm font-semibold">{skill.type === "global" ? "Global" : "Workspace"} skill path</div><code className="mt-1 block text-xs text-primary">{skill.path}</code></div>{info?.exists ? <CheckCircle2 className="h-5 w-5 text-cortex-green" /> : <Plus className="h-5 w-5 text-muted-foreground" />}</div><p className="mt-3 text-xs leading-5 text-muted-foreground">{skill.description}</p>{info && <div className="mt-2 break-all font-mono text-[10px] text-muted-foreground">{info.path}</div>}<div className="mt-4 flex gap-2"><Button size="sm" variant="outline" disabled={localUnavailable || !info?.exists} onClick={() => void invoke("open_skill_directory", { path: skill.path, workspacePath })}><FolderOpen className="mr-2 h-4 w-4" />Open folder</Button>{!info?.exists && <Button size="sm" disabled={localUnavailable} onClick={() => void createDirectory(skill)}><Plus className="mr-2 h-4 w-4" />Create folder</Button>}</div></article>; })}</div></div>;
}

function SectionHeading({ icon, title, text }: { icon: ReactNode; title: string; text: string }) { return <div className="flex gap-3">{icon}<div><h2 className="text-lg font-semibold">{title}</h2><p className="mt-1 max-w-3xl text-sm leading-6 text-muted-foreground">{text}</p></div></div>; }
function CommandPreview({ command, warning = false }: { command: string; warning?: boolean }) { return <div className={cn("mt-2 break-all rounded-md border border-border bg-background px-3 py-2 font-mono text-xs text-muted-foreground", warning && "border-cortex-amber/35 bg-cortex-amber/5 text-cortex-amber")}><span className="mr-2 select-none text-primary">$</span>{command}{warning && <div className="mt-1 font-sans text-[10px]">Remote script pipeline: review the command and official source before approving it.</div>}</div>; }
function StatusBadge({ status }: { status: AgentDetectionStatus }) { if (status === "checking") return <span className="flex items-center gap-1.5 rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground"><Loader2 className="h-3 w-3 animate-spin" />Checking</span>; if (status === "installed") return <span className="flex items-center gap-1.5 rounded-full bg-cortex-green/10 px-2.5 py-1 text-[11px] text-cortex-green"><CheckCircle2 className="h-3 w-3" />Installed</span>; return <span className="rounded-full bg-secondary px-2.5 py-1 text-[11px] text-muted-foreground">Not installed</span>; }
function platformInstallCommand(agent: Agent) { const platform = navigator.platform.toLowerCase(); if (platform.includes("mac")) return agent.installCommandMac; if (platform.includes("linux")) return agent.installCommandLinux; return agent.installCommandWindows; }
function isRemoteScriptCommand(command: string) { return /(?:curl|wget|irm|invoke-restmethod|invoke-webrequest).*(?:\||iex|bash|sh)/i.test(command); }
function normalizeGitHubUrl(value: string) { const trimmed = value.trim().replace(/\.git$/, ""); return /^https:\/\/github\.com\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+\/?$/.test(trimmed) ? trimmed : null; }
