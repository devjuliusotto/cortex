import {
  Building2,
  ClipboardList,
  FileText,
  GitBranch,
  History,
  Layers3,
  Play,
  Plus,
  Search,
  Sparkles,
  TerminalSquare,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { focusTerminal, writeTerminal } from "@/features/terminal/terminalBridge";
import { cn } from "@/lib/utils";
import { useCortexStore, type SavedCommand, type TerminalSession } from "@/stores/cortexStore";

type CommandPaletteProps = {
  open: boolean;
  onClose: () => void;
  onOfficeOpen: () => void;
  onSavedCommandsOpen: () => void;
};

type PaletteAction = {
  id: string;
  title: string;
  subtitle?: string;
  section: string;
  keywords: string;
  icon: ReactNode;
  disabled?: boolean;
  run: () => void;
};

const workflowTemplates: Array<
  Pick<SavedCommand, "title" | "description" | "command" | "category" | "privateLocal">
> = [
  {
    title: "Git Auto Commit",
    description: "Stage changes, ask for a commit message, commit, and push main.",
    command:
      '& { git status; git add .; $changes = git diff --cached --name-only; if (-not $changes) { Write-Host "No changes to commit."; return }; $msg = Read-Host "Commit message"; git commit -m $msg; if ($LASTEXITCODE -ne 0) { return }; git push origin main }',
    category: "Private / Git",
    privateLocal: true,
  },
  {
    title: "Release Version",
    description: "Bump npm/Tauri/Cargo versions, build, commit, push, tag, and push the tag.",
    command:
      '& { $version = Read-Host "New version, example 0.1.10"; npm version $version --no-git-tag-version; if ($LASTEXITCODE -ne 0) { return }; $tauriConfig = "src-tauri/tauri.conf.json"; (Get-Content $tauriConfig -Raw) -replace \'"version":\\s*"[^"]+"\', (\'"version": "\' + $version + \'"\') | Set-Content $tauriConfig; $cargoToml = "src-tauri/Cargo.toml"; if (Test-Path $cargoToml) { (Get-Content $cargoToml -Raw) -replace \'(?m)^version\\s*=\\s*"[^"]+"\', (\'version = "\' + $version + \'"\') | Set-Content $cargoToml }; npm run build; if ($LASTEXITCODE -ne 0) { return }; cargo check --manifest-path .\\src-tauri\\Cargo.toml; if ($LASTEXITCODE -ne 0) { return }; git add .; git commit -m "Release v$version"; if ($LASTEXITCODE -ne 0) { return }; git push origin main; if ($LASTEXITCODE -ne 0) { return }; git tag "v$version"; git push origin "v$version" }',
    category: "Private / Release",
    privateLocal: true,
  },
  {
    title: "Run Dev Server",
    description: "Start the local Vite development server.",
    command: "npm run dev -- --host 127.0.0.1",
    category: "Private / Dev",
    privateLocal: true,
  },
];

function commandForShell(command: string, runImmediately: boolean) {
  const normalized = command.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  return runImmediately ? `${normalized.replace(/\n/g, "\r")}\r` : normalized.replace(/\n/g, "\r");
}

function actionMatches(action: PaletteAction, query: string) {
  const cleanQuery = query.trim().toLowerCase();
  if (!cleanQuery) {
    return true;
  }

  return `${action.title} ${action.subtitle ?? ""} ${action.section} ${action.keywords}`
    .toLowerCase()
    .includes(cleanQuery);
}

function activeTerminalForWorkspace(
  activeWorkspaceId: string | null,
  sessions: TerminalSession[],
  layouts: ReturnType<typeof useCortexStore.getState>["layouts"],
) {
  const layout = layouts.find((item) => item.workspaceId === activeWorkspaceId);
  return sessions.find(
    (session) =>
      session.workspaceId === activeWorkspaceId &&
      (session.id === layout?.activeItemId || session.id === layout?.activeSessionId),
  );
}

export function CommandPalette({ open, onClose, onOfficeOpen, onSavedCommandsOpen }: CommandPaletteProps) {
  const {
    activeWorkspaceId,
    commandHistory,
    createMarketingModeDemo,
    createSavedCommand,
    createSession,
    createTemplateInstance,
    layouts,
    savedCommands,
    sessions,
    setActiveItem,
    templateInstances,
    workspaces,
  } = useCortexStore();
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const activeTerminal = activeTerminalForWorkspace(activeWorkspaceId, sessions, layouts);

  const sendCommand = (command: string, runImmediately: boolean) => {
    if (!activeTerminal) {
      return;
    }
    void writeTerminal(activeTerminal.id, commandForShell(command, runImmediately)).then(() => {
      focusTerminal(activeTerminal.id);
    });
  };

  const ensureTemplate = (
    kind: "command-history" | "git-map" | "note",
    templateId: string,
    title: string,
  ) => {
    if (!activeWorkspaceId) {
      return;
    }
    const existing = templateInstances.find(
      (item) => item.workspaceId === activeWorkspaceId && item.kind === kind,
    );
    if (existing) {
      setActiveItem(activeWorkspaceId, existing.id);
      return;
    }
    createTemplateInstance(activeWorkspaceId, {
      templateId,
      kind,
      title,
      content: kind === "note" ? "# Notes\n\n" : "",
    });
  };

  const installWorkflowTemplates = () => {
    for (const template of workflowTemplates) {
      const exists = savedCommands.some(
        (command) => command.title === template.title && command.command === template.command,
      );
      if (!exists) {
        createSavedCommand(template);
      }
    }
  };

  const actions = useMemo<PaletteAction[]>(() => {
    const baseActions: PaletteAction[] = [
      {
        id: "workspace:office",
        title: "Open Office View",
        subtitle: "Pixel overview of workspace terminals",
        section: "Workspace",
        keywords: "office desks agents workers pixel view",
        icon: <Building2 className="h-4 w-4 text-primary" />,
        disabled: !activeWorkspaceId,
        run: onOfficeOpen,
      },
      {
        id: "workspace:new-terminal",
        title: "Novo terminal",
        subtitle: activeWorkspace?.name,
        section: "Workspace",
        keywords: "terminal shell powershell cmd wsl",
        icon: <TerminalSquare className="h-4 w-4 text-primary" />,
        disabled: !activeWorkspaceId,
        run: () => activeWorkspaceId && createSession(activeWorkspaceId),
      },
      {
        id: "workspace:history",
        title: "Abrir Command History",
        subtitle: "Histórico pesquisável do workspace",
        section: "Workspace",
        keywords: "history comandos recentes recentes inteligente",
        icon: <History className="h-4 w-4 text-primary" />,
        disabled: !activeWorkspaceId,
        run: () => ensureTemplate("command-history", "command-history", "Command History"),
      },
      {
        id: "workspace:git-map",
        title: "Abrir Git Map",
        subtitle: "Branch, status e commits",
        section: "Workspace",
        keywords: "git branch status commits mapa",
        icon: <GitBranch className="h-4 w-4 text-primary" />,
        disabled: !activeWorkspaceId,
        run: () => ensureTemplate("git-map", "git-map", "Git Map"),
      },
      {
        id: "workspace:note",
        title: "Nova nota",
        subtitle: "Contexto local do projeto",
        section: "Workspace",
        keywords: "notes notas contexto projeto",
        icon: <FileText className="h-4 w-4 text-primary" />,
        disabled: !activeWorkspaceId,
        run: () => ensureTemplate("note", "workspace-note", "Notes"),
      },
      {
        id: "workflows:install",
        title: "Instalar workflows essenciais",
        subtitle: "Git Auto Commit, Release Version e Dev Server",
        section: "Workflows",
        keywords: "templates workflows comandos salvos release git dev",
        icon: <Sparkles className="h-4 w-4 text-cortex-amber" />,
        run: installWorkflowTemplates,
      },
      {
        id: "marketing:demo",
        title: "Create Marketing Mode",
        subtitle: "Generate demo workspaces for screenshots",
        section: "Marketing",
        keywords: "marketing demo screenshots landing page fake terminal git notes history",
        icon: <Sparkles className="h-4 w-4 text-cortex-amber" />,
        run: createMarketingModeDemo,
      },
      {
        id: "commands:manage",
        title: "Gerenciar comandos salvos",
        subtitle: "Criar, editar, importar e executar",
        section: "Workflows",
        keywords: "saved commands comandos salvos biblioteca",
        icon: <ClipboardList className="h-4 w-4 text-primary" />,
        run: onSavedCommandsOpen,
      },
    ];

    const workspaceItemActions = [
      ...sessions
        .filter((session) => session.workspaceId === activeWorkspaceId)
        .map<PaletteAction>((session) => ({
          id: `session:${session.id}`,
          title: session.name,
          subtitle: `Terminal · ${session.profileId}`,
          section: "Abrir",
          keywords: "terminal sessão session",
          icon: <TerminalSquare className="h-4 w-4 text-primary" />,
          run: () => activeWorkspaceId && setActiveItem(activeWorkspaceId, session.id),
        })),
      ...templateInstances
        .filter((template) => template.workspaceId === activeWorkspaceId)
        .map<PaletteAction>((template) => ({
          id: `template:${template.id}`,
          title: template.title,
          subtitle: template.kind,
          section: "Abrir",
          keywords: `template tab ${template.kind}`,
          icon: <Layers3 className="h-4 w-4 text-primary" />,
          run: () => activeWorkspaceId && setActiveItem(activeWorkspaceId, template.id),
        })),
    ];

    const savedCommandActions = savedCommands
      .slice()
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt))
      .map<PaletteAction>((command) => ({
        id: `saved-command:${command.id}`,
        title: command.title,
        subtitle: command.category ? `${command.category} · Run saved command` : "Run saved command",
        section: "Comandos Salvos",
        keywords: `${command.description ?? ""} ${command.command}`,
        icon: <Play className="h-4 w-4 text-cortex-green" />,
        disabled: !activeTerminal,
        run: () => sendCommand(command.command, true),
      }));

    const recentCommandActions = commandHistory
      .filter((entry) => entry.workspaceId === activeWorkspaceId)
      .slice()
      .reverse()
      .slice(0, 24)
      .map<PaletteAction>((entry) => ({
        id: `history:${entry.id}`,
        title: entry.command,
        subtitle: entry.cwd ? `Recent command · ${entry.cwd}` : "Recent command",
        section: "Histórico Inteligente",
        keywords: `${entry.profileId} ${entry.cwd ?? ""}`,
        icon: <History className="h-4 w-4 text-primary" />,
        disabled: !activeTerminal,
        run: () => sendCommand(entry.command, true),
      }));

    return [
      ...baseActions,
      ...workspaceItemActions,
      ...savedCommandActions,
      ...recentCommandActions,
    ];
  }, [
    activeTerminal,
    activeWorkspace?.name,
    activeWorkspaceId,
    commandHistory,
    createMarketingModeDemo,
    createSession,
    onSavedCommandsOpen,
    onOfficeOpen,
    savedCommands,
    sessions,
    setActiveItem,
    templateInstances,
  ]);

  const filteredActions = useMemo(
    () => actions.filter((action) => actionMatches(action, query)).slice(0, 64),
    [actions, query],
  );
  const selectedAction = filteredActions[selectedIndex];

  useEffect(() => {
    if (!open) {
      return;
    }
    setQuery("");
    setSelectedIndex(0);
    window.setTimeout(() => inputRef.current?.focus(), 0);
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  useEffect(() => {
    if (selectedIndex <= filteredActions.length - 1) {
      return;
    }
    setSelectedIndex(Math.max(filteredActions.length - 1, 0));
  }, [filteredActions.length, selectedIndex]);

  if (!open) {
    return null;
  }

  const runSelected = () => {
    if (!selectedAction || selectedAction.disabled) {
      return;
    }
    selectedAction.run();
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/55 px-4 pt-[12vh]">
      <section
        className="flex max-h-[min(720px,76vh)] w-full max-w-3xl flex-col overflow-hidden rounded-md border border-border bg-background shadow-2xl"
        onKeyDown={(event) => {
          if (event.key === "Escape") {
            event.preventDefault();
            onClose();
          }
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setSelectedIndex((value) => Math.min(value + 1, filteredActions.length - 1));
          }
          if (event.key === "ArrowUp") {
            event.preventDefault();
            setSelectedIndex((value) => Math.max(value - 1, 0));
          }
          if (event.key === "Enter") {
            event.preventDefault();
            runSelected();
          }
        }}
      >
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border bg-card/80 px-4">
          <Search className="h-4 w-4 text-primary" />
          <input
            className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Buscar ações, comandos, workflows e histórico"
            ref={inputRef}
            value={query}
          />
          <kbd className="hidden rounded border border-border bg-secondary px-2 py-1 text-[11px] text-muted-foreground sm:inline">
            Ctrl K
          </kbd>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close command palette">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="min-h-0 flex-1 overflow-auto p-2">
          {filteredActions.length === 0 ? (
            <div className="grid h-44 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
              Nenhuma ação encontrada.
            </div>
          ) : (
            <div className="grid gap-1">
              {filteredActions.map((action, index) => (
                <button
                  className={cn(
                    "flex min-h-14 w-full items-center gap-3 rounded-md px-3 text-left transition-colors",
                    index === selectedIndex && "bg-secondary text-foreground",
                    action.disabled
                      ? "cursor-not-allowed opacity-45"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground",
                  )}
                  disabled={action.disabled}
                  key={action.id}
                  onClick={() => {
                    action.run();
                    onClose();
                  }}
                  onMouseEnter={() => setSelectedIndex(index)}
                  type="button"
                >
                  <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-border bg-background">
                    {action.icon}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{action.title}</span>
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                      {action.subtitle ?? action.section}
                    </span>
                  </span>
                  <span className="shrink-0 rounded border border-border bg-card px-2 py-1 text-[11px] text-muted-foreground">
                    {action.section}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <footer className="flex h-10 shrink-0 items-center justify-between border-t border-border bg-card/60 px-4 text-[11px] text-muted-foreground">
          <span>{activeWorkspace?.name ?? "Nenhum workspace ativo"}</span>
          <span>
            <Plus className="mr-1 inline h-3 w-3" />
            Enter executa
          </span>
        </footer>
      </section>
    </div>
  );
}
