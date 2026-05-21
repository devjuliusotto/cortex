import type { StorageAdapter } from "@/lib/storage/types";

export function createLocalStorageAdapter<T>(key: string): StorageAdapter<T> {
  return {
    load: async () => {
      if (typeof window === "undefined") {
        return null;
      }

      const raw = window.localStorage.getItem(key);
      if (!raw) {
        return null;
      }

      try {
        return JSON.parse(raw) as T;
      } catch {
        window.localStorage.removeItem(key);
        return null;
      }
    },
    save: async (value) => {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.setItem(key, JSON.stringify(value));
    },
    clear: async () => {
      if (typeof window === "undefined") {
        return;
      }

      window.localStorage.removeItem(key);
    },
  };
}
