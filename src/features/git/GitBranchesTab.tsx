import { GitBranch, MousePointerClick, Plus, RefreshCw, Trash2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitBranchInfo, GitBranchesSnapshot } from "@/features/git/gitTypes";
import { cn } from "@/lib/utils";

type Props = {
  branches: GitBranchesSnapshot | null;
  repoPath: string | null;
  actionLoading: boolean;
  onAction: (action: () => Promise<unknown>, success: string) => void;
  onRefresh: () => void;
};

export function GitBranchesTab({ actionLoading, branches, onAction, onRefresh, repoPath }: Props) {
  const [name, setName] = useState("");

  if (!repoPath) {
    return <div className="rounded-md border border-border bg-card/55 p-4 text-sm text-muted-foreground">No workspace folder selected.</div>;
  }

  const switchBranch = (branch: GitBranchInfo) => {
    if (branches?.dirty && !window.confirm("There are uncommitted changes. Switch branches anyway?")) {
      return;
    }
    onAction(() => gitService.switchBranch(repoPath, branch.name), `Switched to ${branch.name}.`);
  };

  const createBranch = () => {
    const branch = name.trim();
    if (!branch) {
      return;
    }
    onAction(() => gitService.createBranch(repoPath, branch), `Created and switched to ${branch}.`);
    setName("");
  };

  return (
    <div className="grid gap-4">
      <section className="rounded-md border border-border bg-card/55 p-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-semibold">Current branch</div>
            <div className="mt-1 font-mono text-sm text-primary">{branches?.currentBranch ?? "-"}</div>
            <div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground">
              <MousePointerClick className="h-3.5 w-3.5" />
              Click a branch card to switch the project working tree used by Cortex and VS Code.
            </div>
          </div>
          <Button disabled={actionLoading} onClick={onRefresh} size="sm" variant="ghost">
            <RefreshCw className="mr-2 h-4 w-4" />
            Refresh
          </Button>
        </div>
        <div className="mt-4 flex flex-col gap-2 md:flex-row">
          <input
            className="min-h-9 min-w-0 flex-1 rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
            onChange={(event) => setName(event.target.value)}
            placeholder="feature/new-branch"
            value={name}
          />
          <Button disabled={actionLoading || !name.trim()} onClick={createBranch} size="sm">
            <Plus className="mr-2 h-4 w-4" />
            Create branch
          </Button>
        </div>
      </section>

      <BranchGrid
        actionLoading={actionLoading}
        currentBranch={branches?.currentBranch ?? null}
        items={branches?.local ?? []}
        onDelete={(branch) => {
          if (window.confirm(`Delete branch ${branch.name}?`)) {
            onAction(() => gitService.deleteBranch(repoPath, branch.name), `Deleted ${branch.name}.`);
          }
        }}
        onSwitch={switchBranch}
        title="Local branches"
      />

      <BranchGrid
        actionLoading={actionLoading}
        currentBranch={branches?.currentBranch ?? null}
        items={branches?.remote ?? []}
        onSwitch={switchBranch}
        title="Remote branches"
      />
    </div>
  );
}

function BranchGrid({
  actionLoading,
  currentBranch,
  items,
  onDelete,
  onSwitch,
  title,
}: {
  actionLoading: boolean;
  currentBranch: string | null;
  items: GitBranchInfo[];
  onDelete?: (branch: GitBranchInfo) => void;
  onSwitch: (branch: GitBranchInfo) => void;
  title: string;
}) {
  return (
    <section className="grid gap-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="text-xs text-muted-foreground">{items.length} branches</span>
      </div>
      <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {items.map((branch) => {
          const current = branch.name === currentBranch || branch.isCurrent;
          return (
            <article
              aria-current={current ? "true" : undefined}
              className={cn(
                "group relative rounded-md border bg-card/55 p-3 transition-colors",
                current ? "border-primary/70 shadow-glow" : "border-border hover:border-primary/60 hover:bg-card",
                actionLoading && "cursor-wait opacity-60",
              )}
              key={branch.name}
            >
              <button
                aria-label={current ? `${branch.name}, current branch` : `Switch project to branch ${branch.name}`}
                className="absolute inset-0 rounded-md focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-default"
                disabled={actionLoading || current}
                onClick={() => onSwitch(branch)}
                type="button"
              />
              <div className="pointer-events-none relative flex min-w-0 items-start gap-2">
                <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-semibold" title={branch.name}>{branch.name}</div>
                  <div className="mt-1 truncate font-mono text-xs text-muted-foreground" title={branch.lastCommit}>{branch.lastCommit || "No commit"}</div>
                  {branch.upstream && <div className="mt-2 truncate text-xs text-muted-foreground">tracking {branch.upstream}</div>}
                </div>
              </div>
              <div className="relative z-10 mt-3 flex flex-wrap gap-2">
                <Button
                  disabled={actionLoading || current}
                  onClick={(event) => {
                    event.stopPropagation();
                    onSwitch(branch);
                  }}
                  size="sm"
                  variant="outline"
                >
                  Switch
                </Button>
                {onDelete && (
                  <Button
                    disabled={actionLoading || current}
                    onClick={(event) => {
                      event.stopPropagation();
                      onDelete(branch);
                    }}
                    size="sm"
                    variant="ghost"
                  >
                    <Trash2 className="mr-2 h-4 w-4" />
                    Delete
                  </Button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}
