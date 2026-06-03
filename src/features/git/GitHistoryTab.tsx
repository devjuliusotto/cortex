import { Clipboard, RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitCommitInfo } from "@/features/git/gitTypes";
import { cn } from "@/lib/utils";

type Props = {
  commits: GitCommitInfo[];
  repoPath: string | null;
  actionLoading: boolean;
  onError: (message: string) => void;
  onRefresh: () => void;
};

export function GitHistoryTab({ actionLoading, commits, onError, onRefresh, repoPath }: Props) {
  const [selectedHash, setSelectedHash] = useState<string | null>(commits[0]?.hash ?? null);
  const [details, setDetails] = useState<GitCommitInfo | null>(null);
  const selected = details?.hash === selectedHash ? details : commits.find((commit) => commit.hash === selectedHash) ?? commits[0] ?? null;

  const selectCommit = (commit: GitCommitInfo) => {
    setSelectedHash(commit.hash);
    setDetails(null);
    if (!repoPath) {
      return;
    }
    void gitService.getCommitDetails(repoPath, commit.hash).then(setDetails).catch((reason) => onError(String(reason)));
  };

  const copyHash = () => {
    if (!selected) {
      return;
    }
    void navigator.clipboard?.writeText(selected.hash).catch(() => onError("Could not copy commit hash."));
  };

  return (
    <div className="grid min-h-[420px] gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <section className="min-w-0 rounded-md border border-border bg-card/45">
        <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
          <div>
            <div className="text-sm font-semibold">Recent commits</div>
            <div className="text-xs text-muted-foreground">Last 50 commits</div>
          </div>
          <Button disabled={actionLoading} onClick={onRefresh} size="sm" variant="ghost">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="max-h-[640px] overflow-auto p-2">
          {commits.length === 0 && <div className="p-4 text-sm text-muted-foreground">No commits found.</div>}
          {commits.map((commit) => (
            <button
              className={cn(
                "grid w-full grid-cols-[82px_minmax(0,1fr)] gap-3 rounded-md px-3 py-2 text-left transition-colors hover:bg-secondary",
                selected?.hash === commit.hash && "bg-secondary text-foreground",
              )}
              key={commit.hash}
              onClick={() => selectCommit(commit)}
              type="button"
            >
              <span className="font-mono text-xs text-primary">{commit.shortHash}</span>
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium">{commit.message}</span>
                <span className="block truncate text-xs text-muted-foreground">
                  {commit.author} · {new Date(commit.date).toLocaleString()}
                </span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <aside className="rounded-md border border-border bg-card/55 p-4">
        <div className="text-sm font-semibold">Commit details</div>
        {selected ? (
          <div className="mt-3 grid gap-3">
            <div>
              <div className="text-xs text-muted-foreground">Hash</div>
              <div className="mt-1 break-all font-mono text-xs">{selected.hash}</div>
            </div>
            <div>
              <div className="text-xs text-muted-foreground">Message</div>
              <div className="mt-1 text-sm font-medium">{selected.message}</div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <div className="text-xs text-muted-foreground">Author</div>
                <div className="mt-1 truncate">{selected.author}</div>
              </div>
              <div>
                <div className="text-xs text-muted-foreground">Date</div>
                <div className="mt-1 truncate">{new Date(selected.date).toLocaleString()}</div>
              </div>
            </div>
            <Button onClick={copyHash} size="sm" variant="outline">
              <Clipboard className="mr-2 h-4 w-4" />
              Copy hash
            </Button>
            <div>
              <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Changed files</div>
              <div className="mt-2 max-h-64 overflow-auto rounded-md border border-border bg-background/35 p-2">
                {(selected.files ?? []).length === 0 ? (
                  <div className="text-xs text-muted-foreground">Select a commit to load changed files.</div>
                ) : (
                  selected.files.map((file) => (
                    <div className="truncate font-mono text-xs leading-6" key={file} title={file}>
                      {file}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        ) : (
          <div className="mt-3 text-sm text-muted-foreground">Select a commit.</div>
        )}
      </aside>
    </div>
  );
}
