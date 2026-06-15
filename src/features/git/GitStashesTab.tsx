import { Archive, Eye, Plus, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitStashDetails, GitStashInfo } from "@/features/git/gitTypes";
import { cn } from "@/lib/utils";

type Props = {
  actionLoading: boolean;
  repoPath: string | null;
  onAction: (action: () => Promise<unknown>, success: string) => void;
  onError: (message: string) => void;
};

export function GitStashesTab({ actionLoading, onAction, onError, repoPath }: Props) {
  const [stashes, setStashes] = useState<GitStashInfo[]>([]);
  const [selected, setSelected] = useState<GitStashDetails | null>(null);
  const [message, setMessage] = useState("");
  const [includeUntracked, setIncludeUntracked] = useState(true);
  const [loading, setLoading] = useState(false);

  const refresh = useCallback(async () => {
    if (!repoPath) return;
    setLoading(true);
    try {
      const next = await gitService.getStashes(repoPath);
      setStashes(next);
      setSelected((current) => current && next.some((stash) => stash.index === current.stash.index) ? current : null);
    } catch (reason) {
      onError(String(reason));
    } finally {
      setLoading(false);
    }
  }, [onError, repoPath]);

  useEffect(() => { void refresh(); }, [refresh]);

  const inspect = async (stash: GitStashInfo) => {
    if (!repoPath) return;
    setLoading(true);
    try { setSelected(await gitService.getStashDetails(repoPath, stash.index)); }
    catch (reason) { onError(String(reason)); }
    finally { setLoading(false); }
  };

  if (!repoPath) return <div className="rounded-md border border-border bg-card/55 p-4 text-sm text-muted-foreground">No workspace folder selected.</div>;

  return (
    <div className="grid gap-4 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="grid content-start gap-4">
        <section className="rounded-md border border-border bg-card/55 p-4">
          <div className="flex items-center gap-2 text-sm font-semibold"><Archive className="h-4 w-4 text-primary" />Create stash</div>
          <input className="mt-3 h-10 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary" onChange={(event) => setMessage(event.target.value)} placeholder="Optional description" value={message} />
          <label className="mt-3 flex items-center gap-2 text-xs text-muted-foreground"><input checked={includeUntracked} onChange={(event) => setIncludeUntracked(event.target.checked)} type="checkbox" />Include untracked files</label>
          <Button className="mt-3 w-full" disabled={actionLoading} onClick={() => {
            onAction(async () => { await gitService.createStash(repoPath, message, includeUntracked); setMessage(""); await refresh(); }, "Changes saved to stash.");
          }} size="sm"><Plus className="mr-2 h-4 w-4" />Create stash</Button>
        </section>

        <section className="rounded-md border border-border bg-card/45">
          <div className="flex items-center justify-between border-b border-border px-4 py-3"><div><div className="text-sm font-semibold">Saved stashes</div><div className="text-xs text-muted-foreground">{stashes.length} entries</div></div><Button disabled={loading || actionLoading} onClick={() => void refresh()} size="sm" variant="ghost"><RefreshCw className="h-4 w-4" /></Button></div>
          <div className="max-h-[480px] overflow-auto p-2">
            {stashes.length === 0 && <div className="p-4 text-sm text-muted-foreground">No stashes found.</div>}
            {stashes.map((stash) => <button className={cn("w-full rounded-md px-3 py-2 text-left hover:bg-secondary", selected?.stash.index === stash.index && "bg-secondary")} key={stash.reference} onClick={() => void inspect(stash)} type="button"><span className="block font-mono text-xs text-primary">{stash.reference}</span><span className="mt-1 block truncate text-sm">{stash.message}</span><span className="mt-1 block text-xs text-muted-foreground">{new Date(stash.date).toLocaleString()}</span></button>)}
          </div>
        </section>
      </div>

      <section className="min-w-0 rounded-md border border-border bg-card/45">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div><div className="text-sm font-semibold">Stash contents</div><div className="text-xs text-muted-foreground">{selected ? `${selected.stash.reference} · ${selected.files.length} files` : "Select a stash to inspect."}</div></div>{selected && <div className="flex gap-2"><Button disabled={actionLoading} onClick={() => { if (window.confirm(`Apply ${selected.stash.reference} to the working tree?`)) onAction(async () => { await gitService.applyStash(repoPath, selected.stash.index); await refresh(); }, "Stash applied."); }} size="sm" variant="outline"><Undo2 className="mr-2 h-4 w-4" />Apply</Button><Button disabled={actionLoading} onClick={() => { if (window.confirm(`Delete ${selected.stash.reference}? This cannot be undone.`)) onAction(async () => { await gitService.dropStash(repoPath, selected.stash.index); setSelected(null); await refresh(); }, "Stash removed."); }} size="sm" variant="ghost"><Trash2 className="mr-2 h-4 w-4" />Delete</Button></div>}</div>
        {!selected ? <div className="p-6 text-sm text-muted-foreground"><Eye className="mb-2 h-5 w-5" />Select a stash to visualize its patch.</div> : <div className="grid gap-4 p-4"><div className="flex flex-wrap gap-2">{selected.files.map((file) => <span className="rounded bg-secondary px-2 py-1 font-mono text-xs" key={file}>{file}</span>)}</div><pre className="max-h-[620px] overflow-auto whitespace-pre rounded-md border border-border bg-background/60 p-4 font-mono text-xs leading-5 text-muted-foreground">{selected.patch || "No patch content."}</pre></div>}
      </section>
    </div>
  );
}
