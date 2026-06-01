import { useSyncExternalStore } from "react";

type ActivityEntry = {
  activeUntil: number;
  loading: boolean;
};

const activityByItem = new Map<string, ActivityEntry>();
const listeners = new Set<() => void>();
let cleanupTimer: ReturnType<typeof setTimeout> | null = null;

const RECENT_ACTIVITY_MS = 8_000;

export function markItemActivity(itemId: string, options: { loading?: boolean } = {}) {
  activityByItem.set(itemId, {
    activeUntil: Date.now() + RECENT_ACTIVITY_MS,
    loading: options.loading ?? activityByItem.get(itemId)?.loading ?? false,
  });
  scheduleCleanup();
  notify();
}

export function setItemLoading(itemId: string, loading: boolean) {
  const existing = activityByItem.get(itemId);
  activityByItem.set(itemId, {
    activeUntil: loading ? Number.MAX_SAFE_INTEGER : Date.now() + RECENT_ACTIVITY_MS,
    loading,
  });
  if (!loading) {
    scheduleCleanup();
  }
  notify();
}

export function useItemActivity(itemId: string | null) {
  return useSyncExternalStore(subscribe, () => (itemId ? isItemActive(itemId) : false));
}

export function useWorkspaceActivity(itemIds: string[]) {
  return useSyncExternalStore(subscribe, () => itemIds.some(isItemActive));
}

function isItemActive(itemId: string) {
  const entry = activityByItem.get(itemId);
  return Boolean(entry && (entry.loading || entry.activeUntil > Date.now()));
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function scheduleCleanup() {
  if (cleanupTimer) {
    return;
  }

  cleanupTimer = setTimeout(() => {
    cleanupTimer = null;
    const now = Date.now();
    for (const [itemId, entry] of activityByItem) {
      if (!entry.loading && entry.activeUntil <= now) {
        activityByItem.delete(itemId);
      }
    }
    notify();
    if ([...activityByItem.values()].some((entry) => !entry.loading && entry.activeUntil <= Date.now() + RECENT_ACTIVITY_MS)) {
      scheduleCleanup();
    }
  }, RECENT_ACTIVITY_MS);
}

function notify() {
  for (const listener of listeners) {
    listener();
  }
}
