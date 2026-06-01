import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  FolderPlus,
  Globe,
  History,
  PanelRight,
  Power,
  Settings,
  TerminalSquare,
} from "lucide-react";
import { dispatchCommand, type CommandAction } from "@/features/commandSystem/commandDispatcher";
import { useCortexStore, type CustomCommand } from "@/stores/cortexStore";
import { cn } from "@/lib/utils";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onSettingsOpen: () => void;
};

type PaletteCommand = {
  id: string;
  title: string;
  subtitle: string;
  category: string;
  action: CommandAction;
};

export function CommandPalette({ open, onClose, onSettingsOpen }: CommandPaletteProps) {
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const { activeWorkspaceId, settings, workspaces } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  const commands = useMemo(
    () => buildPaletteCommands(
      activeWorkspace?.commands ?? [],
      settings.globalCommands,
      settings.browserPaneEnabled,
      settings.customCommandsEnabled,
    ),
    [activeWorkspace?.commands, settings.browserPaneEnabled, settings.customCommandsEnabled, settings.globalCommands],
  );
  const filtered = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    if (!cleanQuery) {
      return commands;
    }

    return commands.filter((command) =>
      `${command.title} ${command.subtitle} ${command.category}`.toLowerCase().includes(cleanQuery),
    );
  }, [commands, query]);

  useEffect(() => {
    if (open) {
      setQuery("");
      setActiveIndex(0);
    }
  }, [open]);

  useEffect(() => {
    setActiveIndex(0);
  }, [query]);

  if (!open) {
    return null;
  }

  const runActive = () => {
    const command = filtered[activeIndex];
    if (!command) {
      return;
    }
    void dispatchCommand(command.action, {
      workspaceId: activeWorkspaceId,
      openSettings: onSettingsOpen,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center bg-black/45 px-4 pt-[12vh]">
      <section className="w-full max-w-2xl overflow-hidden rounded-md border border-border bg-background shadow-2xl">
        <div className="border-b border-border bg-card/80 p-3">
          <input
            autoFocus
            className="h-11 w-full rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === "Escape") {
                onClose();
              }
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((index) => Math.min(index + 1, filtered.length - 1));
              }
              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((index) => Math.max(index - 1, 0));
              }
              if (event.key === "Enter") {
                event.preventDefault();
                runActive();
              }
            }}
            placeholder="Type a command..."
            value={query}
          />
        </div>
        <div className="max-h-[55vh] overflow-auto p-2">
          {filtered.length === 0 ? (
            <div className="p-8 text-center text-sm text-muted-foreground">No commands found.</div>
          ) : (
            filtered.map((command, index) => (
              <button
                className={cn(
                  "flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors",
                  index === activeIndex ? "bg-secondary text-foreground" : "text-muted-foreground hover:bg-secondary/70",
                )}
                key={command.id}
                onClick={() => {
                  void dispatchCommand(command.action, {
                    workspaceId: activeWorkspaceId,
                    openSettings: onSettingsOpen,
                  });
                  onClose();
                }}
                onMouseEnter={() => setActiveIndex(index)}
                type="button"
              >
                <CommandIcon category={command.category} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium">{command.title}</span>
                  <span className="block truncate text-xs text-muted-foreground">{command.subtitle}</span>
                </span>
                <span className="rounded bg-card px-2 py-1 text-[11px] text-muted-foreground">
                  {command.category}
                </span>
              </button>
            ))
          )}
        </div>
      </section>
    </div>
  );
}

function buildPaletteCommands(
  workspaceCommands: CustomCommand[],
  globalCommands: CustomCommand[],
  browserPaneEnabled: boolean,
  customCommandsEnabled: boolean,
): PaletteCommand[] {
  const builtIns: PaletteCommand[] = [
    { id: "terminal.powershell", title: "New PowerShell terminal", subtitle: "Create a PowerShell tab", category: "Terminal", action: { id: "terminal.new", profileId: "powershell" } },
    { id: "terminal.cmd", title: "New CMD terminal", subtitle: "Create a CMD tab", category: "Terminal", action: { id: "terminal.new", profileId: "cmd" } },
    { id: "terminal.wsl", title: "New WSL terminal", subtitle: "Create a WSL Ubuntu tab", category: "Terminal", action: { id: "terminal.new", profileId: "wsl-ubuntu" } },
    { id: "note.new", title: "New note", subtitle: "Create a local note tab", category: "Notes", action: { id: "note.new" } },
    ...(browserPaneEnabled
      ? [{ id: "browser.open", title: "New browser tab", subtitle: "Open localhost or a URL in a browser pane placeholder", category: "Browser", action: { id: "browser.open" } } satisfies PaletteCommand]
      : []),
    { id: "pane.right", title: "Split right", subtitle: "Create a pane to the right", category: "Pane", action: { id: "pane.splitRight" } },
    { id: "pane.down", title: "Split down", subtitle: "Create a pane below", category: "Pane", action: { id: "pane.splitDown" } },
    { id: "history.open", title: "Open command history", subtitle: "Show captured commands", category: "Terminal", action: { id: "commandHistory.open" } },
    { id: "workspace.open", title: "Open workspace", subtitle: "Create a new local workspace", category: "Workspace", action: { id: "workspace.open" } },
    { id: "workspace.rename", title: "Rename workspace", subtitle: "Rename the active workspace", category: "Workspace", action: { id: "workspace.rename" } },
    { id: "workspace.path", title: "Set workspace default terminal path", subtitle: "Configure workspace-specific cwd", category: "Workspace", action: { id: "workspace.setDefaultPath" } },
    { id: "updates.check", title: "Check for updates", subtitle: "Manual signed updater check", category: "Settings", action: { id: "updates.check" } },
    { id: "settings.open", title: "Open settings", subtitle: "Feature toggles and app settings", category: "Settings", action: { id: "settings.open" } },
    { id: "github.releases", title: "Open GitHub Releases", subtitle: "Open Cortex releases externally", category: "Settings", action: { id: "github.releases.open" } },
  ];

  if (!customCommandsEnabled) {
    return builtIns;
  }

  return [
    ...builtIns,
    ...workspaceCommands.map((command) => ({
      id: `workspace-command.${command.id}`,
      title: command.name,
      subtitle: command.description ?? command.command,
      category: "Commands",
      action: { id: "customCommand.run", command } satisfies CommandAction,
    })),
    ...globalCommands.map((command) => ({
      id: `global-command.${command.id}`,
      title: command.name,
      subtitle: command.description ?? command.command,
      category: "Commands",
      action: { id: "customCommand.run", command } satisfies CommandAction,
    })),
  ];
}

function CommandIcon({ category }: { category: string }) {
  const className = "h-4 w-4 shrink-0 text-primary";
  if (category === "Terminal") {
    return <TerminalSquare className={className} />;
  }
  if (category === "Pane") {
    return <PanelRight className={className} />;
  }
  if (category === "Notes") {
    return <BookOpen className={className} />;
  }
  if (category === "Browser") {
    return <Globe className={className} />;
  }
  if (category === "Workspace") {
    return <FolderPlus className={className} />;
  }
  if (category === "Settings") {
    return <Settings className={className} />;
  }
  if (category === "Commands") {
    return <Power className={className} />;
  }
  return <History className={className} />;
}
