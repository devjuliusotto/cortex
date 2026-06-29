import { Tag } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { gitService } from "@/features/git/gitService";
import type { GitReleaseInfo, GitReleaseOptions } from "@/features/git/gitTypes";

type Props = {
  actionLoading: boolean;
  info: GitReleaseInfo | null;
  repoPath: string | null;
  onAction: (action: () => Promise<unknown>, success: string) => void;
};

const defaultOptions: GitReleaseOptions = {
  updatePackageJson: true,
  updateTauriConf: true,
  updateCargoToml: true,
  commitChanges: true,
  createGitTag: true,
  pushBranch: false,
  pushTag: false,
};

export function GitReleasesTab({ actionLoading, info, onAction, repoPath }: Props) {
  const [version, setVersion] = useState("");
  const [notes, setNotes] = useState("");
  const [options, setOptions] = useState<GitReleaseOptions>(defaultOptions);
  const tag = version.trim() ? `v${version.trim()}` : "v0.0.0";
  const supportsTauriConf = Boolean(info?.tauriVersion);
  const supportsCargoToml = Boolean(info?.cargoVersion);

  useEffect(() => {
    setOptions((current) => ({
      ...current,
      updateTauriConf: supportsTauriConf ? current.updateTauriConf : false,
      updateCargoToml: supportsCargoToml ? current.updateCargoToml : false,
    }));
  }, [supportsCargoToml, supportsTauriConf]);

  const preview = useMemo(() => {
    const items = [];
    if (options.updatePackageJson) items.push("Update package.json");
    if (options.updateTauriConf) items.push("Update src-tauri/tauri.conf.json");
    if (options.updateCargoToml) items.push("Update src-tauri/Cargo.toml");
    if (options.commitChanges) items.push(`Commit release changes as Release ${tag}`);
    if (options.createGitTag) items.push(`Create annotated tag ${tag}`);
    if (options.pushBranch) items.push("Push current branch");
    if (options.pushTag) items.push(`Push tag ${tag}`);
    return items;
  }, [options, tag]);

  if (!repoPath) {
    return <div className="rounded-md border border-border bg-card/55 p-4 text-sm text-muted-foreground">No workspace folder selected.</div>;
  }

  const createRelease = () => {
    if (!version.trim()) {
      return;
    }
    if (!window.confirm(`Create release ${tag}?\n\n${preview.join("\n")}`)) {
      return;
    }
    onAction(() => gitService.createRelease(repoPath, version.trim(), notes, options), `Release ${tag} created.`);
  };

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
      <section className="grid gap-3 md:grid-cols-2">
        <VersionTile label="package.json" value={info?.packageVersion} />
        <VersionTile label="tauri.conf.json" value={info?.tauriVersion} />
        <VersionTile label="Cargo.toml" value={info?.cargoVersion} />
        <VersionTile label="Latest Git tag" value={info?.latestTag} />
        <VersionTile label="Current branch" value={info?.currentBranch} />
        <VersionTile label="Working tree" value={info?.clean ? "Clean" : "Has local changes"} />
      </section>

      <aside className="rounded-md border border-border bg-card/55 p-4">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <Tag className="h-4 w-4 text-primary" />
          Create release
        </div>
        {!info?.clean && (
          <div className="mt-3 rounded-md border border-cortex-amber/40 bg-cortex-amber/10 p-3 text-xs text-cortex-amber">
            Working tree has changes. Review them before release.
          </div>
        )}
        <label className="mt-4 block text-xs font-medium text-muted-foreground">New version</label>
        <input
          className="mt-2 min-h-9 w-full rounded-md border border-input bg-background px-3 text-sm outline-none focus:border-primary"
          onChange={(event) => setVersion(event.target.value)}
          placeholder="0.1.10"
          value={version}
        />
        <label className="mt-4 block text-xs font-medium text-muted-foreground">Release notes</label>
        <textarea
          className="mt-2 min-h-24 w-full resize-y rounded-md border border-input bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          onChange={(event) => setNotes(event.target.value)}
          value={notes}
        />
        <div className="mt-4 grid gap-2">
          {releaseOptionKeys.map((key) => {
            const disabled = (key === "updateTauriConf" && !supportsTauriConf) || (key === "updateCargoToml" && !supportsCargoToml);
            return (
            <label className="flex items-center gap-2 text-sm" key={key}>
              <input
                checked={options[key]}
                disabled={disabled}
                onChange={(event) => setOptions((current) => ({ ...current, [key]: event.target.checked }))}
                type="checkbox"
              />
              <span className={disabled ? "text-muted-foreground" : undefined}>{optionLabel(key)}</span>
            </label>
            );
          })}
        </div>
        <div className="mt-4 rounded-md border border-border bg-background/35 p-3">
          <div className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Preview</div>
          <ul className="mt-2 list-inside list-disc text-xs text-muted-foreground">
            {preview.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </div>
        <Button className="mt-4 w-full" disabled={actionLoading || !version.trim()} onClick={createRelease} size="sm">
          Create release
        </Button>
      </aside>
    </div>
  );
}

const releaseOptionKeys: Array<keyof GitReleaseOptions> = [
  "updatePackageJson",
  "updateTauriConf",
  "updateCargoToml",
  "commitChanges",
  "createGitTag",
  "pushBranch",
  "pushTag",
];

function VersionTile({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="rounded-md border border-border bg-card/55 p-4">
      <div className="text-xs uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-2 truncate font-mono text-sm font-semibold">{value ?? "-"}</div>
    </div>
  );
}

function optionLabel(option: keyof GitReleaseOptions) {
  const labels: Record<keyof GitReleaseOptions, string> = {
    updatePackageJson: "Update package.json",
    updateTauriConf: "Update tauri.conf.json",
    updateCargoToml: "Update Cargo.toml",
    commitChanges: "Commit changes",
    createGitTag: "Create Git tag",
    pushBranch: "Push branch",
    pushTag: "Push tag",
  };
  return labels[option];
}
