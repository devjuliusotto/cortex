import { Edit3, Folder, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { terminateTerminals } from "@/features/terminal/terminalBridge";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/stores/cortexStore";

export function WorkspaceList() {
  const {
    workspaces,
    activeWorkspaceId,
    createWorkspace,
    deleteWorkspace,
    renameWorkspace,
    sessions,
    setActiveWorkspace,
  } = useCortexStore();

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

      <div className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
        {workspaces.length === 0 ? (
          <div className="rounded-md border border-dashed border-border p-3 text-xs leading-5 text-muted-foreground">
            Create a workspace to start organizing terminal sessions.
          </div>
        ) : (
          workspaces.map((workspace) => {
            const active = workspace.id === activeWorkspaceId;

            return (
              <div
                className={cn(
                  "group flex items-center gap-2 rounded-md border border-transparent px-2 py-2 transition-colors",
                  active && "border-primary/20 bg-secondary shadow-glow",
                  !active && "hover:bg-secondary/70",
                )}
                key={workspace.id}
              >
                <button
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                  onClick={() => setActiveWorkspace(workspace.id)}
                  type="button"
                >
                  <Folder
                    className={cn("h-4 w-4 shrink-0 text-muted-foreground", active && "text-primary")}
                  />
                  <span className="truncate text-sm text-foreground">{workspace.name}</span>
                </button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    const name = window.prompt("Rename workspace", workspace.name);
                    if (name !== null) {
                      renameWorkspace(workspace.id, name);
                    }
                  }}
                  title="Rename workspace"
                >
                  <Edit3 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  size="icon"
                  variant="ghost"
                  onClick={() => {
                    if (window.confirm(`Delete "${workspace.name}" and its sessions?`)) {
                      const sessionIds = sessions
                        .filter((session) => session.workspaceId === workspace.id)
                        .map((session) => session.id);
                      void terminateTerminals(sessionIds);
                      deleteWorkspace(workspace.id);
                    }
                  }}
                  title="Delete workspace"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
