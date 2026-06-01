import { invoke } from "@tauri-apps/api/core";

export type GitMetadata = {
  branch: string | null;
  dirty: boolean;
  ahead: number | null;
  behind: number | null;
  latestCommit: string | null;
};

export type LocalPort = {
  port: number;
  protocol: string;
};

export type WorkspaceMetadata = {
  workspaceId: string;
  path: string | null;
  git: GitMetadata | null;
  ports: LocalPort[];
  refreshedAt: number;
  status: "idle" | "loading" | "ready" | "unavailable";
};

const cache = new Map<string, WorkspaceMetadata>();
const pending = new Map<string, Promise<WorkspaceMetadata>>();
const listeners = new Set<() => void>();
const REFRESH_INTERVAL_MS = 45_000;

export function subscribeWorkspaceMetadata(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getCachedWorkspaceMetadata(workspaceId: string) {
  return cache.get(workspaceId) ?? null;
}

export function refreshWorkspaceMetadata(workspaceId: string, path?: string, force = false) {
  const cleanPath = path?.trim();
  if (!cleanPath) {
    const metadata = emptyMetadata(workspaceId);
    cache.set(workspaceId, metadata);
    notify();
    return Promise.resolve(metadata);
  }

  const cached = cache.get(workspaceId);
  if (!force && cached && Date.now() - cached.refreshedAt < REFRESH_INTERVAL_MS) {
    return Promise.resolve(cached);
  }

  const existing = pending.get(workspaceId);
  if (existing) {
    return existing;
  }

  const loading = {
    ...(cached ?? emptyMetadata(workspaceId)),
    path: cleanPath,
    status: "loading" as const,
  };
  cache.set(workspaceId, loading);
  notify();

  const request = Promise.all([
    invoke<GitMetadata | null>("get_git_metadata", { path: cleanPath }).catch(() => null),
    invoke<LocalPort[]>("get_local_ports").catch(() => []),
  ])
    .then(([git, ports]) => {
      const metadata: WorkspaceMetadata = {
        workspaceId,
        path: cleanPath,
        git,
        ports,
        refreshedAt: Date.now(),
        status: "ready",
      };
      cache.set(workspaceId, metadata);
      notify();
      return metadata;
    })
    .catch(() => {
      const metadata = {
        ...emptyMetadata(workspaceId),
        path: cleanPath,
        status: "unavailable" as const,
      };
      cache.set(workspaceId, metadata);
      notify();
      return metadata;
    })
    .finally(() => {
      pending.delete(workspaceId);
    });

  pending.set(workspaceId, request);
  return request;
}

export function formatWorkspaceMetadataLine(
  metadata: WorkspaceMetadata | null,
  counts: { terminals: number; notes: number },
) {
  const parts: string[] = [];
  if (metadata?.path) {
    parts.push(shortenPath(metadata.path));
  }
  if (metadata?.git?.branch) {
    const dirty = metadata.git.dirty ? "*" : "";
    const sync =
      metadata.git.ahead || metadata.git.behind
        ? ` +${metadata.git.ahead ?? 0}/-${metadata.git.behind ?? 0}`
        : "";
    parts.push(`${metadata.git.branch}${dirty}${sync}`);
  }
  if (metadata?.git?.latestCommit) {
    parts.push(metadata.git.latestCommit);
  }
  if (metadata?.ports.length) {
    parts.push(metadata.ports.slice(0, 3).map((port) => `:${port.port}`).join(", "));
  }
  parts.push(`${counts.terminals} term`, `${counts.notes} note`);
  return parts.join(" · ");
}

function emptyMetadata(workspaceId: string): WorkspaceMetadata {
  return {
    workspaceId,
    path: null,
    git: null,
    ports: [],
    refreshedAt: 0,
    status: "idle",
  };
}

function shortenPath(path: string) {
  const normalized = path.replace(/\//g, "\\");
  const parts = normalized.split("\\").filter(Boolean);
  if (parts.length <= 2) {
    return normalized;
  }
  return `...\\${parts.slice(-2).join("\\")}`;
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}
