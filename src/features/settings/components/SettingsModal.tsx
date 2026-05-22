import { check, type Update } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { AlertCircle, CheckCircle2, Download, Loader2, RefreshCw, X } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { useCortexStore, type Workspace } from "@/stores/cortexStore";

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
  workspace: Workspace | undefined;
  onClose: () => void;
};

export function SettingsModal({ open, workspace, onClose }: SettingsModalProps) {
  const { settings, setWorkspaceDefaultWorkingDirectory } = useCortexStore();
  const [workingDirectory, setWorkingDirectory] = useState("");
  const [updateState, setUpdateState] = useState<UpdateState>("idle");
  const [update, setUpdate] = useState<Update | null>(null);
  const [message, setMessage] = useState("Manual update checks only");
  const [downloadProgress, setDownloadProgress] = useState("");

  useEffect(() => {
    setWorkingDirectory(workspace?.defaultWorkingDirectory ?? "");
  }, [workspace?.defaultWorkingDirectory, workspace?.id]);

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
          <h2 className="text-sm font-semibold">Settings</h2>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close settings">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="space-y-6 overflow-auto p-5">
          <section>
            <h3 className="text-sm font-medium">Workspace</h3>
            <label className="mt-4 block text-xs text-muted-foreground" htmlFor="default-cwd">
              Default working directory
            </label>
            <div className="mt-2 flex gap-2">
              <input
                id="default-cwd"
                className="h-9 min-w-0 flex-1 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
                disabled={!workspace}
                onChange={(event) => setWorkingDirectory(event.target.value)}
                placeholder="Example: C:\Projects\Cortex"
                value={workingDirectory}
              />
              <Button
                disabled={!workspace}
                onClick={() => workspace && setWorkspaceDefaultWorkingDirectory(workspace.id, workingDirectory)}
                size="sm"
              >
                Save
              </Button>
            </div>
            <p className="mt-2 text-xs leading-5 text-muted-foreground">
              New PowerShell, CMD, and WSL Ubuntu terminals use this path when it exists.
              Windows paths are converted for WSL; WSL-only paths outside /mnt cannot be validated yet.
            </p>
          </section>

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
              Update checks are {settings.updateCheckMode}. Background checking is intentionally not enabled.
            </p>
          </section>
        </div>
      </section>
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
    idle: "Manual only",
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
