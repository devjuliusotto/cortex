import { open as openDialog } from "@tauri-apps/plugin-dialog";
import { Check, Copy, Folder, FolderOpen, Palette, Play, Plus, Puzzle, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/features/terminal/components/StatusIndicator";
import { terminateTerminals } from "@/features/terminal/terminalBridge";
import { SkillManagerModal } from "@/features/skills/components/SkillManagerModal";
import { cn } from "@/lib/utils";
import { useCortexStore, type SessionStatus, type Workspace } from "@/stores/cortexStore";

const workspaceColors = [
  { label: "Cyan", value: "#56f0ff" },
  { label: "Green", value: "#7af7a6" },
  { label: "Amber", value: "#ffcb6b" },
  { label: "Red", value: "#ff6b81" },
  { label: "Violet", value: "#c792ea" },
  { label: "Blue", value: "#82aaff" },
];

type ContextMenuState = {
  workspaceId: string;
  x: number;
  y: number;
} | null;

export function WorkspaceList() {
  const [contextMenu, setContextMenu] = useState<ContextMenuState>(null);
  const [skillsWorkspace, setSkillsWorkspace] = useState<Workspace | null>(null);
  const {
    workspaces,
    activeWorkspaceId,
    createWorkspace,
    deleteWorkspace,
    duplicateWorkspace,
    renameWorkspace,
    sessions,
    setActiveWorkspace,
    setWorkspaceAutoStartTerminalsOnOpen,
    setWorkspaceColor,
    setWorkspaceDefaultWorkingDirectory,
  } = useCortexStore();
  const contextWorkspace = contextMenu
    ? workspaces.find((workspace) => workspace.id === contextMenu.workspaceId)
    : undefined;

  useEffect(() => {
    if (!contextMenu) {
      return;
    }

    const close = () => setContextMenu(null);
    window.addEventListener("click", close);
    window.addEventListener("keydown", close);
    window.addEventListener("blur", close);
    return () => {
      window.removeEventListener("click", close);
      window.removeEventListener("keydown", close);
      window.removeEventListener("blur", close);
    };
  }, [contextMenu]);

  function rename(workspace: Workspace) {
    const name = window.prompt("Rename workspace", workspace.name);
    if (name !== null) {
      renameWorkspace(workspace.id, name);
    }
  }

  async function setDefaultTerminalPath(workspace: Workspace) {
    const selected = await openDialog({
      directory: true,
      multiple: false,
      title: `Choose default terminal path for ${workspace.name}`,
    });

    if (typeof selected === "string") {
      setWorkspaceDefaultWorkingDirectory(workspace.id, selected);
    }
  }

  function removeWorkspace(workspace: Workspace) {
    if (!window.confirm(`Delete "${workspace.name}" and its sessions?`)) {
      return;
    }

    const sessionIds = sessions
      .filter((session) => session.workspaceId === workspace.id)
      .map((session) => session.id);
    void terminateTerminals(sessionIds);
    deleteWorkspace(workspace.id);
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex items-center justify-between border-b border-border p-3">
        <div className="flex items-center gap-2 text-[11px] uppercase tracking-wide text-muted-foreground">
          <Folder className="h-3.5 w-3.5" />
          Folders / Workspaces
        </div>
        <Button size="icon" variant="ghost" onClick={createWorkspace} title="Create workspace">
          <Plus className="h-4 w-4" />
        </Button>
      </div>

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-[var(--cortex-workspace-list-padding)]">
        {workspaces.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            Create a workspace to start organizing terminal sessions.
          </div>
        ) : (
          workspaces.map((workspace) => {
            const active = workspace.id === activeWorkspaceId;
            const activeTerminalSessions = sessions.filter(
              (session) =>
                session.workspaceId === workspace.id &&
                (session.status === "running" || session.status === "waiting"),
            );
            const workspaceStatus: SessionStatus | null = activeTerminalSessions.some(
              (session) => session.status === "waiting",
            )
              ? "waiting"
              : activeTerminalSessions.length > 0
                ? "running"
                : null;

            return (
              <div
                className={cn(
                  "group rounded-md border border-transparent px-2 py-2 transition-colors",
                  active && "border-primary/20 bg-secondary shadow-glow",
                  !active && "hover:bg-secondary/70",
                )}
                key={workspace.id}
                onContextMenu={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  setContextMenu({
                    workspaceId: workspace.id,
                    x: event.clientX,
                    y: event.clientY,
                  });
                }}
              >
                <button
                  className="flex min-w-0 w-full items-center gap-[var(--cortex-workspace-item-gap)] text-left"
                  onClick={() => setActiveWorkspace(workspace.id)}
                  type="button"
                  title={
                    workspace.defaultWorkingDirectory
                      ? `${workspace.name}\n${workspace.defaultWorkingDirectory}`
                      : workspace.name
                  }
                >
                  <span className="relative grid h-5 w-5 shrink-0 place-items-center">
                    <Folder
                      className={cn(
                        "h-4 w-4 text-muted-foreground",
                        active && "text-primary",
                      )}
                    />
                    {workspace.color && (
                      <span
                        className="absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-sm border border-background"
                        style={{ backgroundColor: workspace.color }}
                      />
                    )}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="flex min-w-0 items-center gap-2">
                      <span className="min-w-0 flex-1 truncate text-sm text-foreground">{workspace.name}</span>
                      {workspaceStatus && (
                        <span
                          className="flex shrink-0 items-center gap-1.5 rounded border border-border bg-background/50 px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground"
                          title={`${activeTerminalSessions.length} terminal${activeTerminalSessions.length === 1 ? "" : "s"} running or loading`}
                        >
                          <StatusIndicator status={workspaceStatus} />
                          {activeTerminalSessions.length}
                        </span>
                      )}
                    </span>
                    {workspace.defaultWorkingDirectory && (
                      <span className="mt-0.5 block truncate text-[11px] text-muted-foreground">
                        {workspace.defaultWorkingDirectory}
                      </span>
                    )}
                  </span>
                </button>
              </div>
            );
          })
        )}
      </div>

      {contextMenu && contextWorkspace && (
        <div
          className="fixed z-50 min-w-64 rounded-md border border-border bg-card p-1 text-sm shadow-glow"
          onClick={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
          style={{ left: contextMenu.x, top: contextMenu.y }}
        >
          <ContextMenuButton
            icon={<Play className="h-4 w-4" />}
            label="Open / Select workspace"
            onClick={() => {
              setActiveWorkspace(contextWorkspace.id);
              setContextMenu(null);
            }}
          />
          <ContextMenuButton
            icon={<FolderOpen className="h-4 w-4" />}
            label="Rename workspace"
            onClick={() => {
              rename(contextWorkspace);
              setContextMenu(null);
            }}
          />
          <div className="my-1 h-px bg-border" />
          <div className="px-2 py-1.5 text-xs text-muted-foreground">Set workspace color</div>
          <div className="grid grid-cols-6 gap-1 px-2 pb-2">
            {workspaceColors.map((color) => (
              <button
                aria-label={color.label}
                className="grid h-7 w-7 place-items-center rounded-md border border-border"
                key={color.value}
                onClick={() => {
                  setWorkspaceColor(contextWorkspace.id, color.value);
                  setContextMenu(null);
                }}
                style={{ backgroundColor: color.value }}
                title={color.label}
                type="button"
              >
                {contextWorkspace.color === color.value && <Check className="h-4 w-4 text-background" />}
              </button>
            ))}
          </div>
          <ContextMenuButton
            icon={<Palette className="h-4 w-4" />}
            label="Clear workspace color"
            onClick={() => {
              setWorkspaceColor(contextWorkspace.id, undefined);
              setContextMenu(null);
            }}
          />
          <div className="my-1 h-px bg-border" />
          <ContextMenuButton
            icon={<FolderOpen className="h-4 w-4" />}
            label="Set default terminal path"
            onClick={() => {
              void setDefaultTerminalPath(contextWorkspace);
              setContextMenu(null);
            }}
          />
          <ContextMenuButton
            icon={<Puzzle className="h-4 w-4" />}
            label="Project skills..."
            onClick={() => {
              setSkillsWorkspace(contextWorkspace);
              setContextMenu(null);
            }}
          />
          <ContextMenuButton
            disabled={!contextWorkspace.defaultWorkingDirectory}
            icon={<Trash2 className="h-4 w-4" />}
            label="Clear default terminal path"
            onClick={() => {
              setWorkspaceDefaultWorkingDirectory(contextWorkspace.id, "");
              setContextMenu(null);
            }}
          />
          <ContextMenuButton
            checked={contextWorkspace.autoStartTerminalsOnOpen}
            label="Auto-start terminals for this workspace"
            onClick={() => {
              setWorkspaceAutoStartTerminalsOnOpen(
                contextWorkspace.id,
                !contextWorkspace.autoStartTerminalsOnOpen,
              );
              setContextMenu(null);
            }}
          />
          <div className="my-1 h-px bg-border" />
          <ContextMenuButton
            icon={<Copy className="h-4 w-4" />}
            label="Duplicate workspace"
            onClick={() => {
              duplicateWorkspace(contextWorkspace.id);
              setContextMenu(null);
            }}
          />
          <ContextMenuButton
            destructive
            icon={<Trash2 className="h-4 w-4" />}
            label="Delete workspace"
            onClick={() => {
              removeWorkspace(contextWorkspace);
              setContextMenu(null);
            }}
          />
        </div>
      )}
      <SkillManagerModal
        open={Boolean(skillsWorkspace)}
        workspace={skillsWorkspace}
        onClose={() => setSkillsWorkspace(null)}
      />
    </div>
  );
}

type ContextMenuButtonProps = {
  checked?: boolean;
  destructive?: boolean;
  disabled?: boolean;
  icon?: ReactNode;
  label: string;
  onClick: () => void;
};

function ContextMenuButton({
  checked,
  destructive,
  disabled,
  icon,
  label,
  onClick,
}: ContextMenuButtonProps) {
  return (
    <button
      className={cn(
        "flex h-8 w-full items-center gap-2 rounded px-2 text-left text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
        destructive && "text-cortex-red hover:text-cortex-red",
        disabled && "pointer-events-none opacity-40",
      )}
      disabled={disabled}
      onClick={onClick}
      type="button"
    >
      <span className="grid h-4 w-4 place-items-center">{checked ? <Check className="h-4 w-4" /> : icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </button>
  );
}
