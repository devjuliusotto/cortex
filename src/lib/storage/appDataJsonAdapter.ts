import { invoke } from "@tauri-apps/api/core";
import type { StorageAdapter } from "@/lib/storage/types";

export function createAppDataJsonAdapter<T>(fallbackKey: string): StorageAdapter<T> {
  return {
    load: async () => {
      if (isTauriRuntime()) {
        return invoke<T | null>("load_persisted_state");
      }

      return loadFromLocalStorage<T>(fallbackKey);
    },
    save: async (value) => {
      if (isTauriRuntime()) {
        await invoke("save_persisted_state", { state: value });
        return;
      }

      window.localStorage.setItem(fallbackKey, JSON.stringify(value));
    },
    clear: async () => {
      if (typeof window !== "undefined") {
        window.localStorage.removeItem(fallbackKey);
      }
    },
  };
}

function isTauriRuntime() {
  return typeof window !== "undefined" && "__TAURI_INTERNALS__" in window;
}

function loadFromLocalStorage<T>(key: string) {
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
}
