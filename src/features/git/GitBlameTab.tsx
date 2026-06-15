import { FileCode2, Search } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitBlameSnapshot } from "@/features/git/gitTypes";

type Props = { actionLoading: boolean; repoPath: string | null; onError: (message: string) => void };

export function GitBlameTab({ actionLoading, onError, repoPath }: Props) {
  const [files, setFiles] = useState<string[]>([]);
  const [query, setQuery] = useState("");
  const [file, setFile] = useState("");
  const [blame, setBlame] = useState<GitBlameSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const filteredFiles = useMemo(() => files.filter((item) => item.toLowerCase().includes(query.toLowerCase())).slice(0, 300), [files, query]);

  const loadFiles = useCallback(async () => {
    if (!repoPath) return;
    try {
      const next = await gitService.getTrackedFiles(repoPath);
      setFiles(next);
      setFile((current) => current || next[0] || "");
    } catch (reason) { onError(String(reason)); }
  }, [onError, repoPath]);

  useEffect(() => { void loadFiles(); }, [loadFiles]);

  const loadBlame = async () => {
    if (!repoPath || !file) return;
    setLoading(true);
    try { setBlame(await gitService.getBlame(repoPath, file)); }
    catch (reason) { setBlame(null); onError(String(reason)); }
    finally { setLoading(false); }
  };

  if (!repoPath) return <div className="rounded-md border border-border bg-card/55 p-4 text-sm text-muted-foreground">No workspace folder selected.</div>;

  return (
    <div className="grid min-h-[520px] gap-4 xl:grid-cols-[320px_minmax(0,1fr)]">
      <section className="rounded-md border border-border bg-card/45">
        <div className="border-b border-border p-4"><div className="flex items-center gap-2 text-sm font-semibold"><FileCode2 className="h-4 w-4 text-primary" />Tracked files</div><div className="relative mt-3"><Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" /><input className="h-9 w-full rounded-md border border-input bg-background pl-9 pr-3 text-sm outline-none focus:border-primary" onChange={(event) => setQuery(event.target.value)} placeholder="Filter files" value={query} /></div></div>
        <div className="max-h-[620px] overflow-auto p-2">{filteredFiles.map((item) => <button className={`w-full truncate rounded px-3 py-2 text-left font-mono text-xs hover:bg-secondary ${file === item ? "bg-secondary text-primary" : ""}`} key={item} onClick={() => { setFile(item); setBlame(null); }} title={item} type="button">{item}</button>)}</div>
      </section>

      <section className="min-w-0 rounded-md border border-border bg-card/45">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border px-4 py-3"><div className="min-w-0"><div className="text-sm font-semibold">Visual blame</div><div className="truncate font-mono text-xs text-muted-foreground" title={file}>{file || "Select a tracked file"}</div></div><Button disabled={actionLoading || loading || !file} onClick={() => void loadBlame()} size="sm"><Search className="mr-2 h-4 w-4" />Load blame</Button></div>
        {!blame ? <div className="p-6 text-sm text-muted-foreground">Select a file and load blame to see the author, date and commit for each line.</div> : (
          <div className="max-h-[680px] overflow-auto bg-background/45 font-mono text-xs">
            {blame.lines.map((line) => <div className="grid min-w-[900px] grid-cols-[54px_92px_170px_150px_minmax(0,1fr)] border-b border-border/60 hover:bg-secondary/60" key={`${line.hash}-${line.lineNumber}`} title={line.summary}><span className="px-2 py-1.5 text-right text-muted-foreground">{line.lineNumber}</span><span className="truncate px-2 py-1.5 text-primary">{line.shortHash}</span><span className="truncate px-2 py-1.5">{line.author}</span><span className="truncate px-2 py-1.5 text-muted-foreground">{new Date(line.authorTime * 1000).toLocaleDateString()}</span><span className="whitespace-pre px-2 py-1.5">{line.content || " "}</span></div>)}
          </div>
        )}
      </section>
    </div>
  );
}
