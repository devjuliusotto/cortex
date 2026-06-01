import { invoke } from "@tauri-apps/api/core";
import { Check, Clipboard, FileUp, Pencil, Play, Plus, Search, ShieldCheck, Trash2, X } from "lucide-react";
import type { ChangeEvent, ReactNode } from "react";
import { useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { writeTerminal } from "@/features/terminal/terminalBridge";
import { useCortexStore, type SavedCommand } from "@/stores/cortexStore";

type SavedCommandsModalProps = {
  open: boolean;
  onClose: () => void;
};

type CommandDraft = {
  title: string;
  description: string;
  command: string;
  category: string;
  privateLocal: boolean;
};

const emptyDraft: CommandDraft = {
  title: "",
  description: "",
  command: "",
  category: "",
  privateLocal: true,
};

type ImportableCommand = Partial<Pick<SavedCommand, "title" | "description" | "command" | "category" | "privateLocal">> & {
  name?: string;
  content?: string;
};

const categorySuggestions = [
  "Private / Git",
  "Private / Release",
  "Git",
  "PowerShell",
  "NPM",
  "Tauri",
  "Projeto",
  "Deploy",
];

function isPrivateCommand(command: Pick<SavedCommand, "category" | "privateLocal">) {
  return command.privateLocal === true || command.category?.toLowerCase().startsWith("private");
}

export function SavedCommandsModal({ open, onClose }: SavedCommandsModalProps) {
  const {
    activeWorkspaceId,
    createSavedCommand,
    deleteSavedCommand,
    layouts,
    savedCommands,
    sessions,
    updateSavedCommand,
  } = useCortexStore();
  const [query, setQuery] = useState("");
  const [draft, setDraft] = useState<CommandDraft>(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [importError, setImportError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const activeTerminal = useMemo(() => {
    const activeItemId = layouts.find((layout) => layout.workspaceId === activeWorkspaceId)?.activeItemId;
    return activeItemId ? sessions.find((session) => session.id === activeItemId) : undefined;
  }, [activeWorkspaceId, layouts, sessions]);

  const filteredCommands = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    return savedCommands
      .filter((command) => {
        if (!cleanQuery) {
          return true;
        }
        return (
          command.title.toLowerCase().includes(cleanQuery) ||
          command.description?.toLowerCase().includes(cleanQuery) ||
          command.category?.toLowerCase().includes(cleanQuery) ||
          command.command.toLowerCase().includes(cleanQuery)
        );
      })
      .slice()
      .sort((first, second) => second.updatedAt.localeCompare(first.updatedAt));
  }, [query, savedCommands]);
  const privateCommands = filteredCommands.filter(isPrivateCommand);
  const sharedCommands = filteredCommands.filter((command) => !isPrivateCommand(command));

  if (!open) {
    return null;
  }

  function resetForm() {
    setDraft(emptyDraft);
    setEditingId(null);
  }

  function editCommand(command: SavedCommand) {
    setEditingId(command.id);
    setDraft({
      title: command.title,
      description: command.description ?? "",
      command: command.command,
      category: command.category ?? "",
      privateLocal: command.privateLocal ?? command.category?.toLowerCase().startsWith("private") ?? true,
    });
  }

  function saveCommand() {
    if (!draft.title.trim() || !draft.command.trim()) {
      return;
    }

    if (editingId) {
      updateSavedCommand(editingId, draft);
    } else {
      createSavedCommand(draft);
    }
    resetForm();
  }

  async function importCommands(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    setImportError(null);
    if (!file) {
      return;
    }

    try {
      const raw = await file.text();
      const parsed = JSON.parse(raw) as ImportableCommand | ImportableCommand[] | { commands?: ImportableCommand[] };
      const entries: ImportableCommand[] = Array.isArray(parsed)
        ? parsed
        : "commands" in parsed && Array.isArray(parsed.commands)
          ? parsed.commands
          : [parsed as ImportableCommand];
      let imported = 0;
      for (const item of entries) {
        const title = (item.title ?? item.name ?? "").trim();
        const command = (item.command ?? item.content ?? "").trim();
        if (!title || !command) {
          continue;
        }
        createSavedCommand({
          title,
          description: item.description?.trim() || undefined,
          command,
          category: item.category?.trim() || "Private Commands",
          privateLocal: true,
        });
        imported += 1;
      }
      if (imported === 0) {
        setImportError("No valid commands found in the selected JSON file.");
      }
    } catch (error) {
      setImportError(`Import failed: ${String(error)}`);
    }
  }

  async function copyCommand(command: SavedCommand) {
    await writeClipboardText(command.command);
    setCopiedId(command.id);
    window.setTimeout(() => setCopiedId((current) => (current === command.id ? null : current)), 1200);
  }

  function insertCommand(command: SavedCommand) {
    if (!activeTerminal) {
      return;
    }

    const normalized = command.command.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
    const hasMultipleLines = normalized.includes("\n");
    const payload = hasMultipleLines ? `\x1b[200~${normalized}\x1b[201~` : normalized;
    void writeTerminal(activeTerminal.id, payload);
  }

  function removeCommand(command: SavedCommand) {
    if (window.confirm(`Delete "${command.title}"?`)) {
      deleteSavedCommand(command.id);
      if (editingId === command.id) {
        resetForm();
      }
    }
  }

  const canSave = draft.title.trim().length > 0 && draft.command.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <section className="flex max-h-[min(780px,calc(100vh-2rem))] w-full max-w-6xl flex-col overflow-hidden rounded-md border border-border bg-background shadow-2xl">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Clipboard className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Comandos salvos</h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Biblioteca local para comandos e blocos reutilizáveis
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close saved commands">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="flex min-h-0 min-w-0 flex-col border-r border-border">
            <div className="border-b border-border p-3">
              <label className="flex h-9 items-center gap-2 rounded-md border border-border bg-card/60 px-3 text-xs text-muted-foreground">
                <Search className="h-3.5 w-3.5" />
                <input
                  className="min-w-0 flex-1 bg-transparent text-sm text-foreground outline-none"
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Buscar por título, categoria ou conteúdo"
                  value={query}
                />
              </label>
            </div>

            <div className="min-h-0 flex-1 overflow-auto p-3">
              {filteredCommands.length === 0 ? (
                <div className="grid h-full place-items-center rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">
                  Nenhum comando salvo encontrado.
                </div>
              ) : (
                <div className="grid gap-2">
                  {privateCommands.length > 0 && (
                    <CommandSection
                      activeTerminal={Boolean(activeTerminal)}
                      commands={privateCommands}
                      copiedId={copiedId}
                      onCopy={copyCommand}
                      onEdit={editCommand}
                      onInsert={insertCommand}
                      onRemove={removeCommand}
                      title="Private Commands"
                    />
                  )}
                  {sharedCommands.length > 0 && (
                    <CommandSection
                      activeTerminal={Boolean(activeTerminal)}
                      commands={sharedCommands}
                      copiedId={copiedId}
                      onCopy={copyCommand}
                      onEdit={editCommand}
                      onInsert={insertCommand}
                      onRemove={removeCommand}
                      title={privateCommands.length > 0 ? "Saved Commands" : undefined}
                    />
                  )}
                </div>
              )}
            </div>
          </div>

          <aside className="min-h-0 overflow-auto bg-card/35 p-4">
            <div className="mb-4 flex items-center justify-between gap-2">
              <h3 className="text-sm font-semibold">{editingId ? "Editar comando" : "Novo comando"}</h3>
              {editingId && (
                <Button size="sm" variant="ghost" onClick={resetForm}>
                  Cancelar
                </Button>
              )}
            </div>
            <div className="mb-4 rounded-md border border-border bg-background/50 p-3 text-xs leading-5 text-muted-foreground">
              <div className="flex items-center gap-2 font-medium text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-cortex-green" />
                Private local command
              </div>
              <p className="mt-1">
                Saved commands are user state. They are stored in local app data and only copy or insert text until you explicitly run it.
              </p>
            </div>

            <div className="grid gap-3">
              <FieldLabel label="Título">
                <input
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                  onChange={(event) => setDraft((value) => ({ ...value, title: event.target.value }))}
                  placeholder="Setup do projeto"
                  value={draft.title}
                />
              </FieldLabel>

              <FieldLabel label="Categoria">
                <input
                  className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                  list="saved-command-categories"
                  onChange={(event) => setDraft((value) => ({ ...value, category: event.target.value }))}
                  placeholder="Private / Git"
                  value={draft.category}
                />
                <datalist id="saved-command-categories">
                  {categorySuggestions.map((category) => (
                    <option key={category} value={category} />
                  ))}
                </datalist>
              </FieldLabel>

              <label className="flex items-center gap-2 rounded-md border border-border bg-background px-3 py-2 text-xs text-muted-foreground">
                <input
                  checked={draft.privateLocal}
                  className="h-4 w-4"
                  onChange={(event) => setDraft((value) => ({ ...value, privateLocal: event.target.checked }))}
                  type="checkbox"
                />
                <span>Private local command</span>
              </label>

              <FieldLabel label="Descrição">
                <textarea
                  className="min-h-20 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus:ring-1 focus:ring-ring"
                  onChange={(event) => setDraft((value) => ({ ...value, description: event.target.value }))}
                  placeholder="Quando usar este comando"
                  value={draft.description}
                />
              </FieldLabel>

              <FieldLabel label="Comando">
                <textarea
                  className="min-h-56 resize-y rounded-md border border-border bg-background p-3 font-mono text-xs leading-5 outline-none focus:ring-1 focus:ring-ring"
                  onChange={(event) => setDraft((value) => ({ ...value, command: event.target.value }))}
                  placeholder={"npm install\nnpm run dev"}
                  spellCheck={false}
                  value={draft.command}
                />
              </FieldLabel>

              <div className="flex items-center gap-2 pt-1">
                <Button disabled={!canSave} onClick={saveCommand}>
                  {!editingId && <Plus className="mr-2 h-4 w-4" />}
                  {editingId ? "Salvar alterações" : "Salvar comando"}
                </Button>
                <Button variant="outline" onClick={resetForm}>
                  Limpar
                </Button>
              </div>
              <div className="border-t border-border pt-3">
                <input
                  accept="application/json,.json"
                  className="hidden"
                  onChange={importCommands}
                  ref={fileInputRef}
                  type="file"
                />
                <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}>
                  <FileUp className="mr-2 h-4 w-4" />
                  Import private JSON
                </Button>
                {importError && <p className="mt-2 text-xs text-cortex-red">{importError}</p>}
              </div>
            </div>
          </aside>
        </div>
      </section>
    </div>
  );
}

function CommandSection({
  activeTerminal,
  commands,
  copiedId,
  onCopy,
  onEdit,
  onInsert,
  onRemove,
  title,
}: {
  activeTerminal: boolean;
  commands: SavedCommand[];
  copiedId: string | null;
  onCopy: (command: SavedCommand) => void;
  onEdit: (command: SavedCommand) => void;
  onInsert: (command: SavedCommand) => void;
  onRemove: (command: SavedCommand) => void;
  title?: string;
}) {
  return (
    <section className="grid gap-2">
      {title && <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h3>}
      {commands.map((command) => (
        <article className="rounded-md border border-border bg-card/55 p-3" key={command.id}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="flex min-w-0 flex-wrap items-center gap-2">
                <h3 className="truncate text-sm font-medium">{command.title}</h3>
                {isPrivateCommand(command) && (
                  <span className="inline-flex items-center gap-1 rounded border border-cortex-green/40 bg-cortex-green/10 px-1.5 py-0.5 text-[11px] text-cortex-green">
                    <ShieldCheck className="h-3 w-3" />
                    Private local command
                  </span>
                )}
                {command.category && (
                  <span className="rounded border border-border bg-secondary px-1.5 py-0.5 text-[11px] text-muted-foreground">
                    {command.category}
                  </span>
                )}
              </div>
              {command.description && (
                <p className="mt-1 max-h-10 overflow-hidden text-xs leading-5 text-muted-foreground">
                  {command.description}
                </p>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1">
              <Button size="icon" variant="ghost" onClick={() => onCopy(command)} title="Copy command">
                {copiedId === command.id ? <Check className="h-4 w-4" /> : <Clipboard className="h-4 w-4" />}
              </Button>
              <Button
                disabled={!activeTerminal}
                size="icon"
                variant="ghost"
                onClick={() => onInsert(command)}
                title="Insert into active terminal"
              >
                <Play className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onEdit(command)} title="Edit command">
                <Pencil className="h-4 w-4" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => onRemove(command)} title="Delete command">
                <Trash2 className="h-4 w-4 text-cortex-red" />
              </Button>
            </div>
          </div>
          <pre className="mt-3 max-h-28 overflow-auto whitespace-pre-wrap break-words rounded border border-border bg-background/65 p-3 font-mono text-xs leading-5 text-foreground">
            {command.command}
          </pre>
        </article>
      ))}
    </section>
  );
}

function FieldLabel({ children, label }: { children: ReactNode; label: string }) {
  return (
    <label className="grid gap-2">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

async function writeClipboardText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch {
      // Desktop webviews can block the web clipboard API.
    }
  }

  await invoke("write_clipboard_text", { text });
}
