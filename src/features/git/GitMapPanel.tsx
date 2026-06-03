import { GitBranch, Loader2, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { GitBranchesTab } from "@/features/git/GitBranchesTab";
import { GitChangesTab } from "@/features/git/GitChangesTab";
import { GitHistoryTab } from "@/features/git/GitHistoryTab";
import { GitOverviewTab } from "@/features/git/GitOverviewTab";
import { GitReleasesTab } from "@/features/git/GitReleasesTab";
import { gitService } from "@/features/git/gitService";
import type {
  GitBranchesSnapshot,
  GitCommitInfo,
  GitMapTab,
  GitOverview,
  GitReleaseInfo,
  GitStatusSnapshot,
} from "@/features/git/gitTypes";
import { cn } from "@/lib/utils";
import { useCortexStore, type TemplateInstance } from "@/stores/cortexStore";

type Props = {
  paneId: string;
  template: TemplateInstance;
  workspaceId: string;
};

const tabs: Array<{ id: GitMapTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "changes", label: "Changes" },
  { id: "history", label: "History" },
  { id: "branches", label: "Branches" },
  { id: "releases", label: "Releases" },
];

export function GitMapPanel({ paneId, template, workspaceId }: Props) {
  const { setActivePaneTab, workspaces } = useCortexStore();
  const workspace = workspaces.find((item) => item.id === workspaceId);
  const repoPath = workspace?.defaultWorkingDirectory ?? null;
  const [activeTab, setActiveTab] = useState<GitMapTab>("overview");
  const [overview, setOverview] = useState<GitOverview | null>(null);
  const [status, setStatus] = useState<GitStatusSnapshot | null>(null);
  const [history, setHistory] = useState<GitCommitInfo[]>([]);
  const [branches, setBranches] = useState<GitBranchesSnapshot | null>(null);
  const [releaseInfo, setReleaseInfo] = useState<GitReleaseInfo | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const repoReady = useMemo(() => Boolean(repoPath && overview?.isRepo), [overview?.isRepo, repoPath]);

  const refresh = async () => {
    if (!repoPath) {
      setOverview(null);
      setStatus(null);
      setHistory([]);
      setBranches(null);
      setReleaseInfo(null);
      setError("Set a default working directory for this workspace before using Git Map.");
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const nextOverview = await gitService.getOverview(repoPath);
      setOverview(nextOverview);
      if (!nextOverview.isRepo) {
        setStatus(null);
        setHistory([]);
        setBranches(null);
        setReleaseInfo(null);
        return;
      }

      const [nextStatus, nextHistory, nextBranches, nextReleaseInfo] = await Promise.all([
        gitService.getStatus(repoPath),
        gitService.getHistory(repoPath, 50),
        gitService.getBranches(repoPath),
        gitService.getReleaseInfo(repoPath),
      ]);
      setStatus(nextStatus);
      setHistory(nextHistory);
      setBranches(nextBranches);
      setReleaseInfo(nextReleaseInfo);
    } catch (reason) {
      setError(String(reason));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, [repoPath]);

  const runAction = async (action: () => Promise<unknown>, success: string) => {
    setActionLoading(true);
    setError(null);
    setMessage(null);
    try {
      await action();
      setMessage(success);
      await refresh();
    } catch (reason) {
      setError(String(reason));
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="flex h-full min-h-0 flex-col bg-cortex-graphite">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-border bg-background/50 px-4">
        <button
          className="flex min-w-0 items-center gap-2"
          onClick={() => setActivePaneTab(workspaceId, paneId, template.id)}
          type="button"
        >
          <GitBranch className="h-4 w-4 text-primary" />
          <span className="truncate text-sm font-medium">{template.title}</span>
        </button>
        <Button disabled={loading || actionLoading} onClick={() => void refresh()} size="sm" variant="ghost">
          {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
          Refresh
        </Button>
      </div>

      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border bg-background/30 px-4 py-3">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold">{workspace?.name ?? "Workspace"}</div>
              <div className="truncate text-xs text-muted-foreground" title={repoPath ?? ""}>{repoPath ?? "No default working directory"}</div>
            </div>
            <div className={cn("rounded px-2 py-1 text-xs", repoReady ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
              {repoReady ? overview?.currentBranch ?? "Git repository" : "No repository loaded"}
            </div>
          </div>
          <div className="mt-3 flex gap-1 overflow-x-auto rounded-md border border-border bg-card/35 p-1">
            {tabs.map((tab) => (
              <button
                className={cn(
                  "shrink-0 rounded px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors",
                  activeTab === tab.id && "bg-secondary text-foreground",
                )}
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                type="button"
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <div className="min-h-0 flex-1 overflow-auto p-4">
          {error && <div className="mb-4 rounded-md border border-cortex-red/40 bg-cortex-red/10 p-3 text-sm text-cortex-red">{error}</div>}
          {message && <div className="mb-4 rounded-md border border-cortex-green/40 bg-cortex-green/10 p-3 text-sm text-cortex-green">{message}</div>}

          {activeTab === "overview" && (
            <GitOverviewTab
              actionLoading={actionLoading}
              onAction={runAction}
              onRefresh={() => void refresh()}
              overview={overview}
              repoPath={repoPath}
            />
          )}
          {activeTab === "changes" && (
            <GitChangesTab
              actionLoading={actionLoading}
              onAction={runAction}
              onRefresh={() => void refresh()}
              repoPath={repoPath}
              status={status}
            />
          )}
          {activeTab === "history" && (
            <GitHistoryTab
              actionLoading={actionLoading}
              commits={history}
              onError={setError}
              onRefresh={() => void refresh()}
              repoPath={repoPath}
            />
          )}
          {activeTab === "branches" && (
            <GitBranchesTab
              actionLoading={actionLoading}
              branches={branches}
              onAction={runAction}
              onRefresh={() => void refresh()}
              repoPath={repoPath}
            />
          )}
          {activeTab === "releases" && (
            <GitReleasesTab
              actionLoading={actionLoading}
              info={releaseInfo}
              onAction={runAction}
              repoPath={repoPath}
            />
          )}
        </div>
      </div>
    </div>
  );
}
