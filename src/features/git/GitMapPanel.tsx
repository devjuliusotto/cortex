import { GitBranch, Loader2, RefreshCw } from "lucide-react";
import { listen } from "@tauri-apps/api/event";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { GitBranchesTab } from "@/features/git/GitBranchesTab";
import { GitBlameTab } from "@/features/git/GitBlameTab";
import { GitChangesTab } from "@/features/git/GitChangesTab";
import { GitHistoryTab } from "@/features/git/GitHistoryTab";
import { GitMergeTab } from "@/features/git/GitMergeTab";
import { GitOverviewTab } from "@/features/git/GitOverviewTab";
import { GitReleasesTab } from "@/features/git/GitReleasesTab";
import { GitStashesTab } from "@/features/git/GitStashesTab";
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

type MarketingGitDemo = {
  marketingDemo: true;
  overview: GitOverview;
  status: GitStatusSnapshot;
  history: GitCommitInfo[];
  branches: GitBranchesSnapshot;
  releaseInfo: GitReleaseInfo;
};

const tabs: Array<{ id: GitMapTab; label: string }> = [
  { id: "overview", label: "Overview" },
  { id: "changes", label: "Changes" },
  { id: "history", label: "History" },
  { id: "branches", label: "Branches" },
  { id: "merge", label: "Merge" },
  { id: "stashes", label: "Stashes" },
  { id: "blame", label: "Blame" },
  { id: "releases", label: "Releases" },
];

function parseMarketingGitDemo(content: string): MarketingGitDemo | null {
  if (!content.trim()) {
    return null;
  }
  try {
    const parsed = JSON.parse(content) as Partial<MarketingGitDemo>;
    if (parsed.marketingDemo && parsed.overview && parsed.status && parsed.history && parsed.branches && parsed.releaseInfo) {
      return parsed as MarketingGitDemo;
    }
  } catch {
    return null;
  }
  return null;
}

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
  const refreshStatusRef = useRef<(() => Promise<void>) | null>(null);
  const marketingDemo = useMemo(() => parseMarketingGitDemo(template.content), [template.content]);
  const displayOverview = marketingDemo?.overview ?? overview;
  const displayStatus = marketingDemo?.status ?? status;
  const displayHistory = marketingDemo?.history ?? history;
  const displayBranches = marketingDemo?.branches ?? branches;
  const displayReleaseInfo = marketingDemo?.releaseInfo ?? releaseInfo;
  const displayRepoPath = marketingDemo?.overview.root ?? repoPath;

  const repoReady = useMemo(() => Boolean(displayRepoPath && displayOverview?.isRepo), [displayOverview?.isRepo, displayRepoPath]);

  const refreshStatus = useCallback(async () => {
    if (marketingDemo) {
      setStatus(marketingDemo.status);
      return;
    }
    if (!repoPath) {
      setStatus(null);
      return;
    }

    try {
      const nextStatus = await gitService.getStatus(repoPath);
      setStatus(nextStatus);
    } catch (reason) {
      setError(String(reason));
    }
  }, [marketingDemo, repoPath]);

  useEffect(() => {
    refreshStatusRef.current = refreshStatus;
  }, [refreshStatus]);

  const refresh = useCallback(async () => {
    if (marketingDemo) {
      setOverview(marketingDemo.overview);
      setStatus(marketingDemo.status);
      setHistory(marketingDemo.history);
      setBranches(marketingDemo.branches);
      setReleaseInfo(marketingDemo.releaseInfo);
      setError(null);
      return;
    }
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
  }, [marketingDemo, repoPath]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    if (marketingDemo || activeTab !== "changes" || !repoPath || !overview?.isRepo) {
      return;
    }

    let disposed = false;
    let watchedRoot: string | null = null;
    let debounceId: ReturnType<typeof setTimeout> | null = null;
    let unlisten: (() => void) | null = null;

    const dispose = () => {
      disposed = true;
      if (debounceId) {
        clearTimeout(debounceId);
      }
      unlisten?.();
      if (watchedRoot) {
        void gitService.watchStop(watchedRoot);
      }
    };

    void (async () => {
      try {
        watchedRoot = await gitService.watchStart(repoPath);
        if (disposed) {
          if (watchedRoot) {
            void gitService.watchStop(watchedRoot);
          }
          return;
        }

        const nextUnlisten = await listen<{ root: string }>("git-working-tree-changed", (event) => {
          if (event.payload.root !== watchedRoot) {
            return;
          }
          if (debounceId) {
            clearTimeout(debounceId);
          }
          debounceId = setTimeout(() => {
            void refreshStatusRef.current?.();
          }, 700);
        });
        if (disposed) {
          nextUnlisten();
          return;
        }
        unlisten = nextUnlisten;
      } catch (reason) {
        if (!disposed) {
          setError(String(reason));
        }
      }
    })();

    return dispose;
  }, [activeTab, marketingDemo, overview?.isRepo, repoPath]);

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
              <div className="truncate text-xs text-muted-foreground" title={displayRepoPath ?? ""}>{displayRepoPath ?? "No default working directory"}</div>
            </div>
            <div className={cn("rounded px-2 py-1 text-xs", repoReady ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
              {repoReady ? displayOverview?.currentBranch ?? "Git repository" : "No repository loaded"}
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
              actionLoading={actionLoading || Boolean(marketingDemo)}
              onAction={runAction}
              onRefresh={() => void refresh()}
              overview={displayOverview}
              repoPath={displayRepoPath}
            />
          )}
          {activeTab === "changes" && (
            <GitChangesTab
              actionLoading={actionLoading || Boolean(marketingDemo)}
              onAction={runAction}
              onRefresh={() => void refresh()}
              repoPath={displayRepoPath}
              status={displayStatus}
            />
          )}
          {activeTab === "history" && (
            <GitHistoryTab
              actionLoading={actionLoading || Boolean(marketingDemo)}
              commits={displayHistory}
              onError={setError}
              onRefresh={() => void refresh()}
              repoPath={marketingDemo ? null : repoPath}
            />
          )}
          {activeTab === "branches" && (
            <GitBranchesTab
              actionLoading={actionLoading || Boolean(marketingDemo)}
              branches={displayBranches}
              onAction={runAction}
              onRefresh={() => void refresh()}
              repoPath={displayRepoPath}
            />
          )}
          {activeTab === "merge" && (
            <GitMergeTab
              actionLoading={actionLoading || Boolean(marketingDemo)}
              branches={displayBranches}
              onAction={runAction}
              onError={setError}
              repoPath={marketingDemo ? null : repoPath}
            />
          )}
          {activeTab === "stashes" && (
            <GitStashesTab
              actionLoading={actionLoading || Boolean(marketingDemo)}
              onAction={runAction}
              onError={setError}
              repoPath={marketingDemo ? null : repoPath}
            />
          )}
          {activeTab === "blame" && (
            <GitBlameTab
              actionLoading={actionLoading || Boolean(marketingDemo)}
              onError={setError}
              repoPath={marketingDemo ? null : repoPath}
            />
          )}
          {activeTab === "releases" && (
            <GitReleasesTab
              actionLoading={actionLoading || Boolean(marketingDemo)}
              info={displayReleaseInfo}
              onAction={runAction}
              repoPath={displayRepoPath}
            />
          )}
        </div>
      </div>
    </div>
  );
}
