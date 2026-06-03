import { Check, GitCommitHorizontal, Plus, RefreshCw, RotateCcw, Trash2 } from "lucide-react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitFileChange, GitStatusSnapshot } from "@/features/git/gitTypes";
import { cn } from "@/lib/utils";

type Props = {
  actionLoading: boolean;
  repoPath: string | null;
  status: GitStatusSnapshot | null;
  onAction: (action: () => Promise<unknown>, success: string) => void;
  onRefresh: () => void;
};

const groups = ["Staged", "Modified", "Added", "Deleted", "Renamed", "Untracked"] as const;

function groupFor(file: GitFileChange) {
  return file.staged ? "Staged" : file.status;
}

export function GitChangesTab({ actionLoading, onAction, onRefresh, repoPath, status }: Props) {
  const [message, setMessage] = useState("");
  const grouped = useMemo(() => {
    const result = new Map<string, GitFileChange[]>();
    for (const group of groups) {
      result.set(group, []);
    }
    for (const file of status?.files ?? []) {
      const group = groupFor(file);
      result.set(group, [...(result.get(group) ?? []), file]);
    }
    return result;
  }, [status]);

  const canCommit = Boolean(repoPath && message.trim() && (status?.stagedCount ?? 0) > 0);

  if (!repoPath) {
    return <div className="rounded-md border border-border bg-card/55 p-4 text-sm text-muted-foreground">No workspace folder selected.</div>;
  }

  if (status && !status.isRepo) {
    return <div className="rounded-md border border-border bg-card/55 p-6 text-sm text-muted-foreground">This workspace is not a Git repository.</div>;
  }

  const commit = async (pushAfter: boolean) => {
    await gitService.commit(repoPath, message.trim());
    if (pushAfter) {
      await gitService.push(repoPath);
    }
    setMessage("");
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_340px]">
      <section className="min-w-0 rounded-md border border-border bg-card/45">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Changed files</div>
            <div className="text-xs text-muted-foreground">
              {status?.stagedCount ?? 0} staged, {status?.modifiedCount ?? 0} modified, {status?.untrackedCount ?? 0} untracked
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button disabled={actionLoading || !status?.files.length} onClick={() => onAction(() => gitService.stageAll(repoPath), "All files staged.")} size="sm" variant="outline">
              <Plus className="mr-2 h-4 w-4" />
              Stage all
            </Button>
            <Button disabled={actionLoading || !status?.stagedCount} onClick={() => onAction(() => gitService.unstageAll(repoPath), "All files unstaged.")} size="sm" variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Unstage all
            </Button>
            <Button disabled={actionLoading} onClick={onRefresh} size="sm" variant="ghost">
              <RefreshCw className="mr-2 h-4 w-4" />
              Refresh
            </Button>
          </div>
        </div>

        <div className="grid gap-3 p-4">
          {status?.files.length === 0 && <div className="rounded-md border border-border bg-background/35 p-4 text-sm text-muted-foreground">Working tree is clean.</div>}
          {groups.map((group) => {
            const files = grouped.get(group) ?? [];
            if (files.length === 0) {
              return null;
            }
            return (
              <div className="grid gap-2" key={group}>
                <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group}</div>
                {files.map((file) => (
                  <FileRow
                    actionLoading={actionLoading}
                    file={file}
                    key={`${file.path}-${file.status}-${file.staged}`}
                    onDiscard={() => {
                      if (window.confirm(`Discard changes in ${file.path}? This cannot be undone.`)) {
                        onAction(() => gitService.discardFile(repoPath, file.path), "File changes discarded.");
                      }
                    }}
                    onStage={() => onAction(() => gitService.stageFile(repoPath, file.path), "File staged.")}
                    onUnstage={() => onAction(() => gitService.unstageFile(repoPath, file.path), "File unstaged.")}
                  />
                ))}
              </div>
            );
          })}
        </div>
      </section>

      <aside className="grid content-start gap-4">
        <section className="rounded-md border border-border bg-card/55 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <GitCommitHorizontal className="h-4 w-4 text-primary" />
            Commit
          </div>
          <textarea
            className="mt-3 min-h-28 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
            onChange={(event) => setMessage(event.target.value)}
            placeholder="Describe your change"
            value={message}
          />
          <div className="mt-3 grid gap-2">
            <Button disabled={actionLoading || !canCommit} onClick={() => onAction(() => commit(false), "Commit created.")} size="sm">
              <Check className="mr-2 h-4 w-4" />
              Commit
            </Button>
            <Button disabled={actionLoading || !canCommit} onClick={() => onAction(() => commit(true), "Commit created and pushed.")} size="sm" variant="outline">
              Commit & Push
            </Button>
          </div>
          <div className="mt-3 text-xs text-muted-foreground">Commit requires staged files and a message.</div>
        </section>

        <section className="rounded-md border border-border bg-card/55 p-4">
          <div className="text-sm font-semibold">Diff viewer coming later.</div>
          <div className="mt-2 text-xs text-muted-foreground">This first version focuses on safe staging and commits.</div>
        </section>
      </aside>
    </div>
  );
}

function FileRow({
  actionLoading,
  file,
  onDiscard,
  onStage,
  onUnstage,
}: {
  actionLoading: boolean;
  file: GitFileChange;
  onDiscard: () => void;
  onStage: () => void;
  onUnstage: () => void;
}) {
  return (
    <div className="flex min-w-0 flex-wrap items-center gap-2 rounded-md border border-border bg-background/35 px-3 py-2">
      <span className={cn("rounded px-2 py-1 text-[11px] font-semibold", file.staged ? "bg-primary/15 text-primary" : "bg-secondary text-muted-foreground")}>
        {file.staged ? "staged" : file.status}
      </span>
      <div className="min-w-0 flex-1 truncate font-mono text-xs" title={file.path}>
        {file.originalPath ? `${file.originalPath} -> ${file.path}` : file.path}
      </div>
      {file.staged ? (
        <Button disabled={actionLoading} onClick={onUnstage} size="sm" variant="outline">
          Unstage
        </Button>
      ) : (
        <Button disabled={actionLoading} onClick={onStage} size="sm" variant="outline">
          Stage
        </Button>
      )}
      <Button disabled={actionLoading} onClick={onDiscard} size="sm" variant="ghost">
        <Trash2 className="h-4 w-4" />
      </Button>
    </div>
  );
}
