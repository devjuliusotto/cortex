import { GitMerge, RefreshCw } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitBranchesSnapshot, GitMergePreview } from "@/features/git/gitTypes";

type Props = {
  actionLoading: boolean;
  branches: GitBranchesSnapshot | null;
  repoPath: string | null;
  onAction: (action: () => Promise<unknown>, success: string) => void;
  onError: (message: string) => void;
};

export function GitMergeTab({ actionLoading, branches, onAction, onError, repoPath }: Props) {
  const options = useMemo(
    () => [...(branches?.local ?? []), ...(branches?.remote ?? [])].filter((branch) => !branch.isCurrent),
    [branches],
  );
  const [sourceBranch, setSourceBranch] = useState("");
  const [preview, setPreview] = useState<GitMergePreview | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!options.some((branch) => branch.name === sourceBranch)) {
      setSourceBranch(options[0]?.name ?? "");
      setPreview(null);
    }
  }, [options, sourceBranch]);

  const loadPreview = async () => {
    if (!repoPath || !sourceBranch) return;
    setLoading(true);
    try {
      setPreview(await gitService.previewMerge(repoPath, sourceBranch));
    } catch (reason) {
      setPreview(null);
      onError(String(reason));
    } finally {
      setLoading(false);
    }
  };

  const merge = () => {
    if (!repoPath || !preview) return;
    const kind = preview.canFastForward ? "fast-forward" : "merge commit";
    if (!window.confirm(`Merge ${preview.sourceBranch} into ${preview.currentBranch}? Git expects a ${kind}.`)) return;
    onAction(() => gitService.mergeBranch(repoPath, preview.sourceBranch), `Merged ${preview.sourceBranch} into ${preview.currentBranch}.`);
    setPreview(null);
  };

  if (!repoPath) return <Empty text="No workspace folder selected." />;

  return (
    <div className="grid gap-4 xl:grid-cols-[340px_minmax(0,1fr)]">
      <section className="rounded-md border border-border bg-card/55 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold"><GitMerge className="h-4 w-4 text-primary" />Guided merge</div>
        <div className="mt-2 text-xs text-muted-foreground">Current branch: <span className="font-mono text-primary">{branches?.currentBranch ?? "-"}</span></div>
        <label className="mt-4 block text-xs font-medium" htmlFor="merge-source">Source branch</label>
        <select
          className="mt-2 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          id="merge-source"
          onChange={(event) => { setSourceBranch(event.target.value); setPreview(null); }}
          value={sourceBranch}
        >
          {options.map((branch) => <option key={branch.name} value={branch.name}>{branch.name}</option>)}
        </select>
        <Button className="mt-3 w-full" disabled={actionLoading || loading || !sourceBranch} onClick={() => void loadPreview()} size="sm" variant="outline">
          <RefreshCw className="mr-2 h-4 w-4" />Preview merge
        </Button>
        <Button className="mt-2 w-full" disabled={actionLoading || !preview || preview.dirty} onClick={merge} size="sm">
          <GitMerge className="mr-2 h-4 w-4" />Confirm merge
        </Button>
        {preview?.dirty && <div className="mt-3 text-xs text-cortex-amber">Commit or stash local changes before merging.</div>}
      </section>

      <section className="min-w-0 rounded-md border border-border bg-card/45">
        <div className="border-b border-border px-4 py-3">
          <div className="text-sm font-semibold">Merge preview</div>
          <div className="text-xs text-muted-foreground">
            {preview ? `${preview.commits.length} commits and ${preview.files.length} files · ${preview.canFastForward ? "fast-forward" : "merge commit"}` : "Choose a branch and load its preview."}
          </div>
        </div>
        {!preview ? <div className="p-6 text-sm text-muted-foreground">No merge preview loaded.</div> : (
          <div className="grid gap-5 p-4 lg:grid-cols-2">
            <PreviewList title="Commits" empty="No new commits." items={preview.commits.map((commit) => `${commit.shortHash}  ${commit.message}`)} />
            <PreviewList title="Changed files" empty="No changed files." items={preview.files} />
          </div>
        )}
      </section>
    </div>
  );
}

function PreviewList({ empty, items, title }: { empty: string; items: string[]; title: string }) {
  return <div><div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</div><div className="mt-2 max-h-[520px] overflow-auto rounded-md border border-border bg-background/35 p-2">{items.length === 0 ? <div className="p-2 text-xs text-muted-foreground">{empty}</div> : items.map((item, index) => <div className="truncate font-mono text-xs leading-7" key={`${item}-${index}`} title={item}>{item}</div>)}</div></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-md border border-border bg-card/55 p-4 text-sm text-muted-foreground">{text}</div>;
}
