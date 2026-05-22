import { Edit3, FilePlus2, FileText, SplitSquareHorizontal, TerminalSquare, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { StatusIndicator } from "@/features/terminal/components/StatusIndicator";
import { terminateTerminal } from "@/features/terminal/terminalBridge";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/stores/cortexStore";

type TerminalTabsProps = {
  workspaceId: string;
};

export function TerminalTabs({ workspaceId }: TerminalTabsProps) {
  const {
    createSession,
    createTemplateInstance,
    deleteSession,
    deleteTemplateInstance,
    layouts,
    profiles,
    renameSession,
    renameTemplateInstance,
    sessions,
    setActiveItem,
    setSplitPanePreview,
    templateInstances,
  } = useCortexStore();
  const layout = layouts.find((item) => item.workspaceId === workspaceId);
  const workspaceSessions = sessions.filter((session) => session.workspaceId === workspaceId);
  const workspaceTemplates = templateInstances.filter((template) => template.workspaceId === workspaceId);
  const items = [
    ...workspaceSessions.map((session) => ({ kind: "terminal" as const, item: session })),
    ...workspaceTemplates.map((template) => ({ kind: "template" as const, item: template })),
  ];
  const orderedSessions = [
    ...(layout?.tabOrder ?? [])
      .map((id) => items.find((entry) => entry.item.id === id))
      .filter(Boolean),
    ...items.filter((entry) => !layout?.tabOrder.includes(entry.item.id)),
  ];
  const activeItemId = layout?.activeItemId ?? layout?.activeSessionId;

  return (
    <div className="flex h-11 items-center justify-between border-b border-border bg-card/80 px-2">
      <div className="flex min-w-0 items-center gap-1">
        {orderedSessions.map((entry) => {
          if (!entry) {
            return null;
          }

          const active = entry.item.id === activeItemId;
          const terminal = entry.kind === "terminal" ? entry.item : null;
          const template = entry.kind === "template" ? entry.item : null;
          const profile =
            terminal && profiles.find((item) => item.id === terminal.profileId);

          return (
            <div
              className={cn(
                "group flex h-8 min-w-36 items-center gap-1 rounded-md px-2 text-left text-xs text-muted-foreground transition-colors",
                active && "bg-secondary text-foreground shadow-glow",
              )}
              key={entry.item.id}
            >
              <button
                className="flex min-w-0 flex-1 items-center gap-2"
                onClick={() => setActiveItem(workspaceId, entry.item.id)}
                type="button"
              >
                {terminal ? (
                  <StatusIndicator status={terminal.status} />
                ) : (
                  <FileText className="h-3.5 w-3.5 text-primary" />
                )}
                <span className="truncate">{terminal?.name ?? template?.title}</span>
                <span className="rounded border border-border px-1.5 py-0.5 text-[10px] uppercase tracking-wide text-muted-foreground">
                  {terminal ? profile?.name ?? terminal.profileId : "note"}
                </span>
              </button>
              <button
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => {
                  const currentName = terminal?.name ?? template?.title ?? "";
                  const name = window.prompt("Rename tab", currentName);
                  if (name !== null && terminal) {
                    renameSession(terminal.id, name);
                  }
                  if (name !== null && template) {
                    renameTemplateInstance(template.id, name);
                  }
                }}
                title="Rename tab"
                type="button"
              >
                <Edit3 className="h-3 w-3" />
              </button>
              <button
                className="grid h-6 w-6 place-items-center rounded text-muted-foreground hover:bg-background hover:text-foreground"
                onClick={() => {
                  const currentName = terminal?.name ?? template?.title ?? "tab";
                  if (window.confirm(`Delete "${currentName}"?`)) {
                    if (terminal) {
                      void terminateTerminal(terminal.id);
                      deleteSession(terminal.id);
                    }
                    if (template) {
                      deleteTemplateInstance(template.id);
                    }
                  }
                }}
                title="Delete tab"
                type="button"
              >
                <Trash2 className="h-3 w-3" />
              </button>
            </div>
          );
        })}
      </div>
      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => setSplitPanePreview(workspaceId, !(layout?.splitPanePreview ?? true))}
          title="Toggle split pane placeholder"
        >
          <SplitSquareHorizontal className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() =>
            createTemplateInstance(workspaceId, {
              templateId: "workspace-note",
              kind: "note",
              title: "Untitled note",
              content: "",
            })
          }
          title="New note"
        >
          <FilePlus2 className="h-4 w-4" />
        </Button>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => createSession(workspaceId)}
          title="New terminal"
        >
          <TerminalSquare className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
