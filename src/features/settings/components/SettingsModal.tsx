import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw, X } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { useCortexStore, type CustomCommandDraft } from "@/stores/cortexStore";

type UpdateState =
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "ready"
  | "error";

type SettingsModalProps = {
  open: boolean;
  onClose: () => void;
};

export function SettingsModal({ open, onClose }: SettingsModalProps) {
  const {
    activeWorkspaceId,
    createGlobalCommand,
    createWorkspaceCommand,
    deleteGlobalCommand,
    deleteWorkspaceCommand,
    setFeatureFlag,
    settings,
    workspaces,
  } = useCortexStore();
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [message, setMessage] = useState("Automatic update checks run when Cortex starts.");
  const [downloadProgress, setDownloadProgress] = useState("");

  if (!open) {
    return null;
  }

  async function checkForUpdates() {
    setUpdateState("checking");
    setUpdate(null);
    setDownloadProgress("");
    setMessage("Checking GitHub Releases for a signed update...");

    try {
      const nextUpdate = await check();
      if (!nextUpdate) {
        setUpdateState("up-to-date");
        setMessage("Cortex is up to date.");
        return;
      }

      setUpdate(nextUpdate);
      setUpdateState("available");
      setMessage(`Version ${nextUpdate.version} is available.`);
    } catch (error) {
      setUpdateState("error");
      setMessage(`Update check failed: ${String(error)}`);
    }
  }

  async function downloadUpdate() {
    if (!update) {
      return;
    }

    if (!window.confirm(`Download Cortex ${update.version}?`)) {
      return;
    }

    setUpdateState("downloading");
    setMessage(`Downloading Cortex ${update.version}...`);
    try {
      let downloaded = 0;
      let total = 0;
      await update.download((event) => {
        if (event.event === "Started") {
          total = event.data.contentLength ?? 0;
          setDownloadProgress(total ? `0 / ${formatBytes(total)}` : "Starting");
        }
        if (event.event === "Progress") {
          downloaded += event.data.chunkLength;
          setDownloadProgress(total ? `${formatBytes(downloaded)} / ${formatBytes(total)}` : formatBytes(downloaded));
        }
        if (event.event === "Finished") {
          setDownloadProgress("Download complete");
        }
      });
      setUpdateState("ready");
      setMessage("Update is ready to install.");
    } catch (error) {
      setUpdateState("error");
      setMessage(`Update download failed: ${String(error)}`);
    }
  }

  async function installUpdate() {
    if (!update || !window.confirm("Install the update and restart Cortex?")) {
      return;
    }

    try {
      await update.install();
      await relaunch();
    } catch (error) {
      setUpdateState("error");
      setMessage(`Update install failed: ${String(error)}`);
    }
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-background/70 p-4 backdrop-blur-sm">
      <section className="flex max-h-[88vh] w-full max-w-2xl flex-col overflow-hidden rounded-md border border-border bg-card shadow-glow">
        <header className="flex h-12 items-center justify-between border-b border-border px-4">
          <h2 className="text-sm font-semibold">App settings</h2>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close settings">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="space-y-6 overflow-auto p-5">
          <section>
            <h3 className="text-sm font-medium">Optional features</h3>
            <div className="mt-4 grid gap-2">
              <ToggleRow
                checked={settings.showWorkspaceMetadata}
                label="Show workspace metadata"
                text="Local Git branch, dirty state, ports, and compact counts in the sidebar."
                onChange={(checked) => setFeatureFlag("showWorkspaceMetadata", checked)}
              />
              <ToggleRow
                checked={settings.browserPaneEnabled}
                label="Browser Pane"
                text="Persist browser tabs inside split panes. Embedded WebView is still experimental."
                onChange={(checked) => setFeatureFlag("browserPaneEnabled", checked)}
              />
              <ToggleRow
                checked={settings.commandPaletteEnabled}
                label="Command palette"
                text="Enable Ctrl+Shift+P and the command button."
                onChange={(checked) => setFeatureFlag("commandPaletteEnabled", checked)}
              />
              <ToggleRow
                checked={settings.customCommandsEnabled}
                label="Custom commands"
                text="Structured global and workspace commands, never auto-run."
                onChange={(checked) => setFeatureFlag("customCommandsEnabled", checked)}
              />
            </div>
          </section>

          {settings.customCommandsEnabled && (
            <CommandManager
              activeWorkspaceId={activeWorkspaceId}
              createGlobalCommand={createGlobalCommand}
              createWorkspaceCommand={createWorkspaceCommand}
              deleteGlobalCommand={deleteGlobalCommand}
              deleteWorkspaceCommand={deleteWorkspaceCommand}
              globalCommands={settings.globalCommands}
              workspaces={workspaces}
            />
          )}

          <section>
            <h3 className="text-sm font-medium">Updates</h3>
            <div className="mt-4 rounded-md border border-border bg-background/50 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-sm">
                    <UpdateStatusIcon state={updateState} />
                    <span>{updateLabel(updateState)}</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-muted-foreground">{message}</p>
                  {downloadProgress && (
                    <p className="mt-1 text-xs text-muted-foreground">{downloadProgress}</p>
                  )}
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  {updateState === "available" && (
                    <Button size="sm" onClick={downloadUpdate}>
                      <Download className="mr-2 h-4 w-4" />
                      Download
                    </Button>
                  )}
                  {updateState === "ready" && (
                    <Button size="sm" onClick={installUpdate}>
                      Install
                    </Button>
                  )}
                  <Button
                    disabled={updateState === "checking" || updateState === "downloading"}
                    onClick={checkForUpdates}
                    size="sm"
                    variant="outline"
                  >
                    <RefreshCw className="mr-2 h-4 w-4" />
                    Check for Updates
                  </Button>
                </div>
              </div>
            </div>
            <p className="mt-2 text-xs text-muted-foreground">
              Update checks are {settings.updateCheckMode}. Automatic install still requires a signed GitHub Release.
            </p>
          </section>
        </div>
      </section>
    </div>
  );
}

function ToggleRow({
  checked,
  label,
  onChange,
  text,
}: {
  checked: boolean;
  label: string;
  onChange: (checked: boolean) => void;
  text: string;
}) {
  return (
    <label className="flex items-start justify-between gap-4 rounded-md border border-border bg-background/50 p-3">
      <span>
        <span className="block text-sm font-medium">{label}</span>
        <span className="mt-1 block text-xs leading-5 text-muted-foreground">{text}</span>
      </span>
      <input
        checked={checked}
        className="mt-1 h-4 w-4 accent-primary"
        onChange={(event) => onChange(event.target.checked)}
        type="checkbox"
      />
    </label>
  );
}

function CommandManager({
  activeWorkspaceId,
  createGlobalCommand,
  createWorkspaceCommand,
  deleteGlobalCommand,
  deleteWorkspaceCommand,
  globalCommands,
  workspaces,
}: {
  activeWorkspaceId: string | null;
  createGlobalCommand: (command: CustomCommandDraft) => void;
  createWorkspaceCommand: (workspaceId: string, command: CustomCommandDraft) => void;
  deleteGlobalCommand: (commandId: string) => void;
  deleteWorkspaceCommand: (workspaceId: string, commandId: string) => void;
  globalCommands: Array<CustomCommandDraft & { id: string }>;
  workspaces: ReturnType<typeof useCortexStore.getState>["workspaces"];
}) {
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);

  const addCommand = (scope: "global" | "workspace") => {
    const name = window.prompt("Command name");
    if (!name) {
      return;
    }
    const command = window.prompt("Command text");
    if (!command) {
      return;
    }
    const draft: CustomCommandDraft = {
      name,
      command,
      description: window.prompt("Description", "") ?? "",
      profileId: undefined,
      cwdBehavior: "workspace",
      runBehavior: "run",
    };
    if (scope === "global") {
      createGlobalCommand(draft);
    } else if (activeWorkspace) {
      createWorkspaceCommand(activeWorkspace.id, draft);
    }
  };

  return (
    <section>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h3 className="text-sm font-medium">Command manager</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Built-ins live in the command palette. Custom commands run only after explicit user action.
          </p>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => addCommand("global")}>
            Global command
          </Button>
          <Button size="sm" onClick={() => addCommand("workspace")} disabled={!activeWorkspace}>
            Workspace command
          </Button>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2">
        <CommandList
          commands={globalCommands}
          empty="No global commands."
          onDelete={deleteGlobalCommand}
          title="Global commands"
        />
        <CommandList
          commands={activeWorkspace?.commands ?? []}
          empty="No workspace commands."
          onDelete={(commandId) => activeWorkspace && deleteWorkspaceCommand(activeWorkspace.id, commandId)}
          title={`Workspace commands${activeWorkspace ? `: ${activeWorkspace.name}` : ""}`}
        />
      </div>
    </section>
  );
}

function CommandList({
  commands,
  empty,
  onDelete,
  title,
}: {
  commands: Array<CustomCommandDraft & { id: string }>;
  empty: string;
  onDelete: (commandId: string) => void;
  title: string;
}) {
  return (
    <div className="rounded-md border border-border bg-background/50 p-3">
      <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">{title}</div>
      {commands.length === 0 ? (
        <div className="text-xs text-muted-foreground">{empty}</div>
      ) : (
        <div className="space-y-2">
          {commands.map((command) => (
            <div className="rounded-md border border-border bg-card/55 p-2" key={command.id}>
              <div className="truncate text-sm">{command.name}</div>
              <div className="mt-1 truncate font-mono text-xs text-muted-foreground">{command.command}</div>
              <Button className="mt-2" size="sm" variant="ghost" onClick={() => onDelete(command.id)}>
                Delete
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function UpdateStatusIcon({ state }: { state: UpdateState }) {
  if (state === "checking" || state === "downloading") {
    return <Loader2 className="h-4 w-4 animate-spin text-primary" />;
  }
  if (state === "up-to-date" || state === "ready") {
    return <CheckCircle2 className="h-4 w-4 text-cortex-green" />;
  }
  if (state === "error") {
    return <AlertCircle className="h-4 w-4 text-cortex-red" />;
  }
  return <RefreshCw className="h-4 w-4 text-primary" />;
}

function updateLabel(state: UpdateState) {
  const labels: Record<UpdateState, string> = {
    idle: "Automatic checks",
    checking: "Checking",
    "up-to-date": "Up to date",
    available: "Update available",
    downloading: "Downloading",
    ready: "Ready to install",
    error: "Error",
  };
  return labels[state];
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
