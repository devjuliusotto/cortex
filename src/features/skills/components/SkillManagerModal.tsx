import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  CheckCircle2,
  FolderOpen,
  Github,
  LoaderCircle,
  Lock,
  Puzzle,
  Search,
  TerminalSquare,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import type { Workspace } from "@/stores/cortexStore";

type ProjectSkillInfo = {
  name: string;
  description?: string;
  source: string;
  installedPath?: string;
  compatibleAgents: string[];
  compatibilityNote: string;
  privateToProject: boolean;
};

type CortexSkillSource = {
  name: string;
  description?: string;
  path: string;
  origin: string;
  compatibleAgents: string[];
  compatibilityNote: string;
};

type SkillManagerModalProps = {
  open: boolean;
  workspace: Workspace | null;
  onClose: () => void;
};

export function SkillManagerModal({ open, workspace, onClose }: SkillManagerModalProps) {
  const [sourceType, setSourceType] = useState<"github" | "local" | "cortex">("github");
  const [githubUrl, setGithubUrl] = useState("");
  const [localPath, setLocalPath] = useState("");
  const [selectedCortexPath, setSelectedCortexPath] = useState("");
  const [cortexSkills, setCortexSkills] = useState<CortexSkillSource[]>([]);
  const [preview, setPreview] = useState<ProjectSkillInfo | null>(null);
  const [installedSkills, setInstalledSkills] = useState<ProjectSkillInfo[]>([]);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const projectPath = workspace?.defaultWorkingDirectory?.trim() ?? "";
  const source = sourceType === "github" ? githubUrl.trim() : sourceType === "local" ? localPath.trim() : selectedCortexPath.trim();

  async function refreshInstalled() {
    if (!projectPath) {
      setInstalledSkills([]);
      return;
    }
    try {
      setInstalledSkills(
        await invoke<ProjectSkillInfo[]>("list_project_skills", { projectPath }),
      );
    } catch (reason) {
      setError(String(reason));
    }
  }

  async function refreshCortexSkills() {
    try {
      setCortexSkills(await invoke<CortexSkillSource[]>("list_cortex_skills"));
    } catch (reason) {
      setError(String(reason));
      setCortexSkills([]);
    }
  }

  useEffect(() => {
    if (!open) {
      return;
    }
    setPreview(null);
    setError("");
    setStatus("");
    void refreshInstalled();
    void refreshCortexSkills();
  }, [open, projectPath]);

  if (!open || !workspace) {
    return null;
  }

  async function inspectSource() {
    if (!source) {
      return;
    }
    setBusy(true);
    setError("");
    setStatus(
      sourceType === "github"
        ? `[inspect] Cloning ${source} with git --depth 1...`
        : `[inspect] Reading "${source}"...`,
    );
    try {
      const result = await invoke<ProjectSkillInfo>(
        sourceType === "github" ? "inspect_github_skill" : "inspect_local_skill",
        sourceType === "github" ? { url: source } : { path: source },
      );
      setPreview(result);
      setStatus((current) => `${current}\nFound SKILL.md: ${result.name}`);
    } catch (reason) {
      setPreview(null);
      setError(String(reason));
      setStatus((current) => `${current}\nInspection failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function installSkill() {
    if (!projectPath || !source) {
      return;
    }
    setBusy(true);
    setError("");
    setStatus((current) =>
      [
        current,
        `[install] Project: ${projectPath}`,
        `[install] Source: ${source}`,
        "[install] Copying into .agents/skills...",
      ]
        .filter(Boolean)
        .join("\n"),
    );
    try {
      const result = await invoke<ProjectSkillInfo>(
        sourceType === "github" ? "install_github_skill" : "install_local_skill",
        sourceType === "github"
          ? { projectPath, url: source }
          : { projectPath, sourcePath: source },
      );
      setPreview(result);
      setStatus((current) =>
        `${current}\nInstalled: ${result.installedPath}\nAdded to .git/info/exclude (project-private).`,
      );
      await refreshInstalled();
    } catch (reason) {
      setError(String(reason));
      setStatus((current) => `${current}\nInstallation failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function deleteSkill(skill: ProjectSkillInfo) {
    if (!projectPath || !skill.installedPath) return;
    if (!window.confirm(`Delete project skill "${skill.name}"?`)) return;
    setBusy(true);
    setError("");
    setStatus((current) => [current, `[delete] ${skill.name}`].filter(Boolean).join("\n"));
    try {
      await invoke("delete_project_skill", {
        projectPath,
        installedPath: skill.installedPath,
      });
      setStatus((current) => `${current}\nDeleted: ${skill.name}`);
      await refreshInstalled();
    } catch (reason) {
      setError(String(reason));
      setStatus((current) => `${current}\nDelete failed.`);
    } finally {
      setBusy(false);
    }
  }

  async function chooseLocalSkill() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose a folder containing SKILL.md",
    });
    if (typeof selected === "string") {
      setLocalPath(selected);
      setPreview(null);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <section className="flex max-h-[min(820px,calc(100vh-2rem))] w-full max-w-4xl flex-col overflow-hidden rounded-md border border-border bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Puzzle className="h-4 w-4 text-primary" />
              Project Skills
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {workspace.name} · {projectPath || "No project folder configured"}
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close skills">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          {!projectPath ? (
            <div className="rounded-md border border-cortex-amber/30 bg-cortex-amber/10 p-4 text-sm leading-6">
              Set the workspace default terminal path first. That folder is used as the project root
              for <code>.agents/skills</code>.
            </div>
          ) : (
            <div className="grid gap-5 lg:grid-cols-[1.15fr_0.85fr]">
              <div className="space-y-4">
                <div className="flex gap-2">
                  <SourceButton
                    active={sourceType === "github"}
                    icon={<Github className="h-4 w-4" />}
                    label="GitHub"
                    onClick={() => {
                      setSourceType("github");
                      setPreview(null);
                    }}
                  />
                  <SourceButton
                    active={sourceType === "local"}
                    icon={<FolderOpen className="h-4 w-4" />}
                    label="My local skill"
                    onClick={() => {
                      setSourceType("local");
                      setPreview(null);
                    }}
                  />
                  <SourceButton
                    active={sourceType === "cortex"}
                    icon={<Puzzle className="h-4 w-4" />}
                    label="Cortex skills"
                    onClick={() => {
                      setSourceType("cortex");
                      setPreview(null);
                    }}
                  />
                </div>

                {sourceType === "github" ? (
                  <label className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      GitHub repository or skill folder URL
                    </span>
                    <input
                      className="h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                      onChange={(event) => {
                        setGithubUrl(event.target.value);
                        setPreview(null);
                      }}
                      placeholder="https://github.com/owner/repo or /tree/main/path"
                      value={githubUrl}
                    />
                  </label>
                ) : sourceType === "local" ? (
                  <div className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Folder containing SKILL.md
                    </span>
                    <div className="flex gap-2">
                      <input
                        className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                        onChange={(event) => {
                          setLocalPath(event.target.value);
                          setPreview(null);
                        }}
                        placeholder="C:\\path\\to\\my-skill"
                        value={localPath}
                      />
                      <Button variant="outline" onClick={() => void chooseLocalSkill()}>
                        Browse
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="grid gap-2">
                    <span className="text-xs font-medium text-muted-foreground">
                      Skills already available in Cortex
                    </span>
                    <div className="max-h-60 space-y-2 overflow-y-auto rounded-md border border-border bg-card/45 p-2">
                      {cortexSkills.length === 0 ? (
                        <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                          No Cortex skills found.
                        </div>
                      ) : (
                        cortexSkills.map((skill) => (
                          <button
                            className={`w-full rounded-md border p-3 text-left transition-colors ${selectedCortexPath === skill.path ? "border-primary/40 bg-primary/10" : "border-border bg-background/50 hover:bg-secondary"}`}
                            key={skill.path}
                            onClick={() => {
                              setSelectedCortexPath(skill.path);
                              setPreview(null);
                            }}
                            type="button"
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="truncate text-sm font-medium">{skill.name}</div>
                                <div className="mt-1 truncate text-[11px] text-primary">{skill.origin}</div>
                              </div>
                              <span className="shrink-0 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
                                {skill.compatibleAgents.length}
                              </span>
                            </div>
                            {skill.description && <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">{skill.description}</p>}
                            <code className="mt-2 block truncate text-[10px] text-muted-foreground">{skill.path}</code>
                          </button>
                        ))
                      )}
                    </div>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button variant="outline" disabled={!source || busy} onClick={() => void inspectSource()}>
                    {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Search className="mr-2 h-4 w-4" />}
                    Inspect compatibility
                  </Button>
                  <Button disabled={!preview || busy || Boolean(preview.installedPath)} onClick={() => void installSkill()}>
                    <TerminalSquare className="mr-2 h-4 w-4" />
                    Run installer
                  </Button>
                </div>

                {preview && <SkillCard skill={preview} />}
                {error && (
                  <div className="rounded-md border border-cortex-red/30 bg-cortex-red/10 p-3 text-sm text-cortex-red">
                    {error}
                  </div>
                )}

                <div className="overflow-hidden rounded-md border border-border bg-[#090d12]">
                  <div className="flex items-center gap-2 border-b border-white/10 px-3 py-2 text-[11px] uppercase tracking-wide text-muted-foreground">
                    <TerminalSquare className="h-3.5 w-3.5" /> Installer terminal
                  </div>
                  <pre className="min-h-28 whitespace-pre-wrap p-3 font-mono text-xs leading-5 text-cortex-green">
                    {status || "[ready] Waiting for a skill source..."}
                  </pre>
                </div>
              </div>

              <aside>
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold">Installed for this project</h3>
                  <span className="text-xs text-muted-foreground">{installedSkills.length}</span>
                </div>
                <div className="space-y-2">
                  {installedSkills.length === 0 ? (
                    <div className="rounded-md border border-dashed border-border p-4 text-sm leading-6 text-muted-foreground">
                      No project skills found in <code>.agents/skills</code>.
                    </div>
                  ) : (
                    installedSkills.map((skill) => (
                      <SkillCard
                        key={skill.installedPath ?? skill.name}
                        skill={skill}
                        compact
                        onDelete={skill.installedPath ? () => void deleteSkill(skill) : undefined}
                      />
                    ))
                  )}
                </div>
              </aside>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function SourceButton({ active, icon, label, onClick }: { active: boolean; icon: ReactNode; label: string; onClick: () => void }) {
  return (
    <button
      className={`flex h-9 items-center gap-2 rounded-md border px-3 text-sm transition-colors ${active ? "border-primary/30 bg-primary/10 text-primary" : "border-border text-muted-foreground hover:bg-secondary"}`}
      onClick={onClick}
      type="button"
    >
      {icon}
      {label}
    </button>
  );
}

function SkillCard({ skill, compact = false, onDelete }: { skill: ProjectSkillInfo; compact?: boolean; onDelete?: () => void }) {
  return (
    <article className="rounded-md border border-border bg-card/60 p-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-sm font-medium">
            <CheckCircle2 className="h-4 w-4 shrink-0 text-cortex-green" />
            <span className="truncate">{skill.name}</span>
          </div>
          {skill.description && !compact && (
            <p className="mt-2 text-xs leading-5 text-muted-foreground">{skill.description}</p>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <span className="flex items-center gap-1 rounded border border-border px-1.5 py-0.5 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" /> private
          </span>
          {onDelete && (
            <Button size="icon" variant="ghost" onClick={onDelete} title="Delete skill">
              <Trash2 className="h-4 w-4 text-cortex-red" />
            </Button>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {skill.compatibleAgents.map((agent) => (
          <span className="rounded-full border border-primary/20 bg-primary/10 px-2 py-0.5 text-[10px] text-primary" key={agent}>
            {agent}
          </span>
        ))}
      </div>
      {!compact && (
        <p className="mt-3 text-xs leading-5 text-muted-foreground">{skill.compatibilityNote}</p>
      )}
    </article>
  );
}
