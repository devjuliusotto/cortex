import { invoke } from "@tauri-apps/api/core";
import { open as openDialog } from "@tauri-apps/plugin-dialog";
import {
  ChevronDown,
  ChevronRight,
  FolderOpen,
  GitBranch,
  LoaderCircle,
  Plus,
  Puzzle,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/stores/cortexStore";

type ProjectSetupModalProps = {
  open: boolean;
  onClose: () => void;
  onWorkspaceOpen?: (workspaceId: string) => void;
};

type ProjectMode = "existing" | "create" | "clone";

type ProjectSkillInfo = {
  name: string;
  description?: string;
  installedPath?: string;
  compatibleAgents: string[];
};

export function ProjectSetupModal({ open, onClose, onWorkspaceOpen }: ProjectSetupModalProps) {
  const createWorkspaceFromProject = useCortexStore((state) => state.createWorkspaceFromProject);
  const [mode, setMode] = useState<ProjectMode>("create");
  const [projectName, setProjectName] = useState("");
  const [existingPath, setExistingPath] = useState("");
  const [parentPath, setParentPath] = useState("");
  const [folderName, setFolderName] = useState("");
  const [gitUrl, setGitUrl] = useState("");
  const [skillsOpen, setSkillsOpen] = useState(false);
  const [localSkillPaths, setLocalSkillPaths] = useState<string[]>([]);
  const [installedSkills, setInstalledSkills] = useState<ProjectSkillInfo[]>([]);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");

  const draftProjectPath = useMemo(() => {
    if (mode === "existing") return existingPath.trim();
    if (!parentPath.trim() || !folderName.trim()) return "";
    return joinPath(parentPath.trim(), folderName.trim());
  }, [existingPath, folderName, mode, parentPath]);

  useEffect(() => {
    if (!open) return;
    setError("");
    setStatus("");
    setInstalledSkills([]);
  }, [open]);

  useEffect(() => {
    if (!open || !draftProjectPath || busy) {
      setInstalledSkills([]);
      return;
    }
    void invoke<ProjectSkillInfo[]>("list_project_skills", { projectPath: draftProjectPath })
      .then(setInstalledSkills)
      .catch(() => setInstalledSkills([]));
  }, [busy, draftProjectPath, open]);

  if (!open) return null;

  const canSubmit =
    !busy &&
    projectName.trim() &&
    ((mode === "existing" && existingPath.trim()) ||
      (mode === "create" && parentPath.trim() && folderName.trim()) ||
      (mode === "clone" && parentPath.trim() && gitUrl.trim()));

  async function chooseExistingPath() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose project folder",
    });
    if (typeof selected === "string") {
      setExistingPath(selected);
      fillNamesFromPath(selected);
    }
  }

  async function chooseParentPath() {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: "Choose where the project folder should live",
    });
    if (typeof selected === "string") {
      setParentPath(selected);
    }
  }

  async function chooseLocalSkills() {
    const selected = await openDialog({
      directory: true,
      multiple: true,
      title: "Choose local skill folders containing SKILL.md",
    });
    const paths = Array.isArray(selected) ? selected : typeof selected === "string" ? [selected] : [];
    if (paths.length > 0) {
      setLocalSkillPaths((current) => Array.from(new Set([...current, ...paths])));
      setSkillsOpen(true);
    }
  }

  function fillNamesFromPath(path: string) {
    const name = baseName(path);
    if (!projectName.trim()) setProjectName(name);
    if (!folderName.trim()) setFolderName(name);
  }

  function applyMode(nextMode: ProjectMode) {
    setMode(nextMode);
    setError("");
    setStatus("");
  }

  async function submitProject() {
    if (!canSubmit) return;
    setBusy(true);
    setError("");
    setStatus("Preparing project...");
    try {
      let finalPath = existingPath.trim();
      if (mode === "create") {
        finalPath = await invoke<string>("create_project_directory", {
          path: joinPath(parentPath.trim(), folderName.trim()),
        });
        setStatus(`Created folder: ${finalPath}`);
      } else if (mode === "clone") {
        finalPath = await invoke<string>("clone_project_repository", {
          parentPath: parentPath.trim(),
          gitUrl: gitUrl.trim(),
          folderName: folderName.trim() || projectName.trim(),
        });
        setStatus(`Cloned repository: ${finalPath}`);
      }

      for (const skillPath of localSkillPaths) {
        setStatus((current) => `${current}\nInstalling skill: ${skillPath}`);
        await invoke<ProjectSkillInfo>("install_local_skill", {
          projectPath: finalPath,
          sourcePath: skillPath,
        });
      }

      const workspaceId = createWorkspaceFromProject({
        name: projectName.trim(),
        directory: finalPath,
      });
      if (workspaceId) onWorkspaceOpen?.(workspaceId);
      onClose();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4">
      <section className="flex max-h-[min(860px,calc(100vh-2rem))] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-background shadow-2xl">
        <header className="flex items-center justify-between border-b border-border bg-card/80 px-4 py-3">
          <div>
            <div className="flex items-center gap-2 text-sm font-semibold">
              <FolderOpen className="h-4 w-4 text-primary" />
              New Project
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Create a Cortex workspace from a folder, a new directory, or a Git repository.
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-y-auto p-5">
          <div className="grid gap-4">
            <div className="grid grid-cols-3 gap-2 rounded-md border border-border bg-card/50 p-1">
              <ModeButton active={mode === "existing"} label="Existing" onClick={() => applyMode("existing")} />
              <ModeButton active={mode === "create"} label="Create" onClick={() => applyMode("create")} />
              <ModeButton active={mode === "clone"} label="Git clone" onClick={() => applyMode("clone")} />
            </div>

            <label className="grid gap-2">
              <span className="text-xs font-medium text-muted-foreground">Project name</span>
              <input
                className="h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                onChange={(event) => setProjectName(event.target.value)}
                placeholder="cortex-app"
                value={projectName}
              />
            </label>

            {mode === "existing" ? (
              <PathPicker
                label="Project folder"
                onBrowse={() => void chooseExistingPath()}
                onChange={(value) => {
                  setExistingPath(value);
                  fillNamesFromPath(value);
                }}
                placeholder="C:\\Projects\\cortex-app"
                value={existingPath}
              />
            ) : (
              <>
                <PathPicker
                  label="Where to put it"
                  onBrowse={() => void chooseParentPath()}
                  onChange={setParentPath}
                  placeholder="C:\\Projects"
                  value={parentPath}
                />
                <label className="grid gap-2">
                  <span className="text-xs font-medium text-muted-foreground">
                    Folder name {mode === "clone" && <span className="font-normal">(optional)</span>}
                  </span>
                  <input
                    className="h-10 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                    onChange={(event) => setFolderName(event.target.value)}
                    placeholder={mode === "clone" ? "Defaults to project name" : "cortex-app"}
                    value={folderName}
                  />
                </label>
              </>
            )}

            {mode === "clone" && (
              <label className="grid gap-2">
                <span className="text-xs font-medium text-muted-foreground">Git repository URL</span>
                <div className="flex items-center gap-2">
                  <span className="grid h-10 w-10 place-items-center rounded-md border border-border bg-card text-muted-foreground">
                    <GitBranch className="h-4 w-4" />
                  </span>
                  <input
                    className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                    onChange={(event) => setGitUrl(event.target.value)}
                    placeholder="https://github.com/owner/repo.git"
                    value={gitUrl}
                  />
                </div>
              </label>
            )}

            <div className="rounded-md border border-border bg-card/40">
              <button
                className="flex h-11 w-full items-center justify-between px-3 text-left text-sm"
                onClick={() => setSkillsOpen((value) => !value)}
                type="button"
              >
                <span className="flex items-center gap-2">
                  {skillsOpen ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  <Puzzle className="h-4 w-4 text-primary" />
                  Project skills
                </span>
                <span className="text-xs text-muted-foreground">
                  {localSkillPaths.length + installedSkills.length}
                </span>
              </button>
              {skillsOpen && (
                <div className="border-t border-border p-3">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-xs leading-5 text-muted-foreground">
                      Add local skills from this PC. They will be copied into the project's .agents/skills folder.
                    </p>
                    <Button size="sm" variant="outline" onClick={() => void chooseLocalSkills()}>
                      <Plus className="mr-2 h-4 w-4" />
                      Add
                    </Button>
                  </div>
                  <div className="mt-3 space-y-2">
                    {installedSkills.map((skill) => (
                      <SkillRow key={skill.installedPath ?? skill.name} name={skill.name} detail="Already installed" />
                    ))}
                    {localSkillPaths.map((path) => (
                      <SkillRow
                        key={path}
                        name={baseName(path)}
                        detail={path}
                        onRemove={() => setLocalSkillPaths((current) => current.filter((item) => item !== path))}
                      />
                    ))}
                    {installedSkills.length === 0 && localSkillPaths.length === 0 && (
                      <div className="rounded-md border border-dashed border-border p-3 text-xs text-muted-foreground">
                        No skills selected.
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {(status || error) && (
              <div className="rounded-md border border-border bg-[#090d12] p-3">
                <pre className="whitespace-pre-wrap font-mono text-xs leading-5 text-cortex-green">
                  {status || "[ready]"}
                </pre>
                {error && <div className="mt-2 text-sm text-cortex-red">{error}</div>}
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-end gap-2 border-t border-border bg-card/60 px-4 py-3">
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button onClick={() => void submitProject()} disabled={!canSubmit}>
            {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Plus className="mr-2 h-4 w-4" />}
            Open project
          </Button>
        </footer>
      </section>
    </div>
  );
}

function ModeButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      className={cn(
        "h-9 rounded text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        active && "bg-background text-foreground shadow-sm",
      )}
      onClick={onClick}
      type="button"
    >
      {label}
    </button>
  );
}

function PathPicker({
  label,
  onBrowse,
  onChange,
  placeholder,
  value,
}: {
  label: string;
  onBrowse: () => void;
  onChange: (value: string) => void;
  placeholder: string;
  value: string;
}) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <div className="flex gap-2">
        <input
          className="h-10 min-w-0 flex-1 rounded-md border border-border bg-card px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          value={value}
        />
        <Button variant="outline" onClick={onBrowse}>
          Browse
        </Button>
      </div>
    </label>
  );
}

function SkillRow({
  detail,
  name,
  onRemove,
}: {
  detail: string;
  name: string;
  onRemove?: () => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-md border border-border bg-background/60 px-3 py-2">
      <Puzzle className="h-4 w-4 shrink-0 text-primary" />
      <div className="min-w-0 flex-1">
        <div className="truncate text-sm">{name}</div>
        <div className="truncate text-xs text-muted-foreground">{detail}</div>
      </div>
      {onRemove && (
        <Button size="icon" variant="ghost" onClick={onRemove} title="Remove skill">
          <Trash2 className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}

function baseName(path: string) {
  return path.replace(/[\\/]+$/, "").split(/[\\/]/).filter(Boolean).pop() ?? "";
}

function joinPath(parent: string, child: string) {
  if (!parent) return child;
  if (!child) return parent;
  return `${parent.replace(/[\\/]+$/, "")}\\${child.replace(/^[\\/]+/, "")}`;
}
