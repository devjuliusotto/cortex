import type { ReactNode } from "react";
import { GitBranch, GitCommitHorizontal, RadioTower, RefreshCw, Upload, Download, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitOverview } from "@/features/git/gitTypes";
import { cn } from "@/lib/utils";

type Props = {
  overview: GitOverview | null;
  repoPath: string | null;
  actionLoading: boolean;
  onAction: (action: () => Promise<unknown>, success: string) => void;
  onRefresh: () => void;
};

function formatRefresh(value?: string | null) {
  if (!value) {
    return "-";
  }
  const seconds = Number(value);
  if (!Number.isFinite(seconds)) {
    return value;
  }
  return new Date(seconds * 1000).toLocaleString();
}

export function GitOverviewTab({ actionLoading, onAction, onRefresh, overview, repoPath }: Props) {
  if (!repoPath) {
    return <div className="rounded-md border border-border bg-card/55 p-4 text-sm text-muted-foreground">No workspace folder selected.</div>;
  }

  if (overview && !overview.isRepo) {
    return (
      <div className="rounded-md border border-border bg-card/55 p-6">
        <div className="text-base font-semibold">This workspace is not a Git repository.</div>
        <div className="mt-2 text-sm text-muted-foreground">Open a folder that contains a `.git` directory, or initialize one from your terminal for now.</div>
      </div>
    );
  }

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
      <section className="grid gap-3 md:grid-cols-2">
        <InfoTile label="Repository root" value={overview?.root ?? "-"} wide />
        <InfoTile icon={<GitBranch className="h-4 w-4" />} label="Current branch" value={overview?.currentBranch ?? "-"} />
        <InfoTile label="Remote" value={overview?.remoteUrl ?? "No origin remote"} />
        <InfoTile
          label="Working tree"
          value={overview?.clean ? "Clean" : "Changes pending"}
          valueClassName={overview?.clean ? "text-cortex-green" : "text-cortex-amber"}
        />
        <InfoTile label="Staged files" value={String(overview?.stagedCount ?? 0)} />
        <InfoTile label="Modified files" value={String(overview?.modifiedCount ?? 0)} />
        <InfoTile label="Untracked files" value={String(overview?.untrackedCount ?? 0)} />
        <InfoTile label="Ahead / behind" value={`${overview?.ahead ?? 0} ahead, ${overview?.behind ?? 0} behind`} />
      </section>

      <aside className="grid content-start gap-4">
        <section className="rounded-md border border-border bg-card/55 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitCommitHorizontal className="h-4 w-4 text-primary" />
            Latest commit
          </div>
          {overview?.latestCommit ? (
            <div className="mt-3 space-y-2 text-sm">
              <div className="font-mono text-primary">{overview.latestCommit.shortHash}</div>
              <div className="break-words font-medium">{overview.latestCommit.message}</div>
              <div className="text-xs text-muted-foreground">{overview.latestCommit.author}</div>
              <div className="text-xs text-muted-foreground">{new Date(overview.latestCommit.date).toLocaleString()}</div>
            </div>
          ) : (
            <div className="mt-3 text-sm text-muted-foreground">No commits yet.</div>
          )}
        </section>

        <section className="rounded-md border border-border bg-card/55 p-4">
          <div className="text-sm font-semibold">Repository actions</div>
          <div className="mt-3 grid grid-cols-2 gap-2">
            <Button disabled={actionLoading} onClick={onRefresh} size="sm" variant="outline">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
            <Button disabled={actionLoading} onClick={() => onAction(() => gitService.fetch(repoPath), "Fetch completed.")} size="sm" variant="outline">
              <RadioTower className="mr-2 h-4 w-4" />
              Fetch
            </Button>
            <Button disabled={actionLoading} onClick={() => onAction(() => gitService.pull(repoPath), "Pull completed.")} size="sm" variant="outline">
              <Download className="mr-2 h-4 w-4" />
              Pull
            </Button>
            <Button disabled={actionLoading} onClick={() => onAction(() => gitService.push(repoPath), "Push completed.")} size="sm" variant="outline">
              <Upload className="mr-2 h-4 w-4" />
              Push
            </Button>
          </div>
          <div className="mt-3 flex items-center gap-2 text-xs text-muted-foreground">
            <RotateCcw className="h-3.5 w-3.5" />
            Last refresh: {formatRefresh(overview?.refreshedAt)}
          </div>
        </section>
      </aside>
    </div>
  );
}

function InfoTile({
  icon,
  label,
  value,
  valueClassName,
  wide,
}: {
  icon?: ReactNode;
  label: string;
  value: string;
  valueClassName?: string;
  wide?: boolean;
}) {
  return (
    <div className={cn("min-w-0 rounded-md border border-border bg-card/55 p-4", wide && "md:col-span-2")}>
      <div className="flex items-center gap-2 text-xs uppercase tracking-wide text-muted-foreground">
        {icon}
        {label}
      </div>
      <div className={cn("mt-2 truncate text-sm font-semibold", valueClassName)} title={value}>
        {value}
      </div>
    </div>
  );
}
