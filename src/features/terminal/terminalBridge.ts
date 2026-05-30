import { invoke } from "@tauri-apps/api/core";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import { useCortexStore, type TerminalProfileId } from "@/stores/cortexStore";

type PtySessionId = string;
type TerminalStatus = "idle" | "loading" | "connected" | "exited" | "error";

type TerminalProcess = {
  appSessionId: string;
  profileId: TerminalProfileId;
  ptySessionId: PtySessionId;
  buffer: string;
  status: TerminalStatus;
  error: string | null;
};

type PtyOutputEvent = {
  sessionId: PtySessionId;
  data: string;
};

type PtyExitEvent = {
  sessionId: PtySessionId;
  code: number | null;
};

type PtyErrorEvent = {
  sessionId: PtySessionId;
  error: string;
};

type ValidatedWorkingDirectory = {
  cwd: string | null;
  warning: string | null;
};

type SessionSubscriber = {
  onData: (data: string) => void;
  onStatus?: (status: TerminalStatus, error: string | null) => void;
};

const processesByAppSession = new Map<string, TerminalProcess>();
const appSessionByPtySession = new Map<PtySessionId, string>();
const subscribers = new Map<string, Set<SessionSubscriber>>();
const terminalFocusHandlers = new Map<string, () => void>();
let eventListeners: Promise<UnlistenFn[]> | null = null;

export function subscribeTerminalSession(
  appSessionId: string,
  subscriber: SessionSubscriber,
) {
  ensureEventListeners();
  const sessionSubscribers = subscribers.get(appSessionId) ?? new Set<SessionSubscriber>();
  sessionSubscribers.add(subscriber);
  subscribers.set(appSessionId, sessionSubscribers);

  const process = processesByAppSession.get(appSessionId);
  if (process?.buffer) {
    subscriber.onData(process.buffer);
  }
  if (process) {
    subscriber.onStatus?.(process.status, process.error);
  }

  return () => {
    const current = subscribers.get(appSessionId);
    current?.delete(subscriber);
    if (current?.size === 0) {
      subscribers.delete(appSessionId);
    }
  };
}

export async function ensureTerminalSession(
  appSessionId: string,
  profileId: TerminalProfileId,
  rows: number,
  cols: number,
  cwd?: string,
) {
  ensureEventListeners();
  const existing = processesByAppSession.get(appSessionId);
  if (existing?.profileId === profileId && existing.status !== "error") {
    await resizeTerminal(appSessionId, rows, cols);
    return existing.ptySessionId;
  }

  if (existing) {
    await terminateTerminal(appSessionId);
  }

  notifyStatus(appSessionId, "loading", null);
  try {
    const workingDirectory = await validateWorkingDirectory(profileId, cwd);
    const ptySessionId = await invoke<PtySessionId>("spawn_terminal", {
      profileId,
      cwd: workingDirectory.cwd,
      rows,
      cols,
    });
    const process: TerminalProcess = {
      appSessionId,
      profileId,
      ptySessionId,
      buffer: "",
      status: "connected",
      error: null,
    };
    processesByAppSession.set(appSessionId, process);
    appSessionByPtySession.set(ptySessionId, appSessionId);
    notifyStatus(appSessionId, "connected", workingDirectory.warning);
    return ptySessionId;
  } catch (error) {
    const message = String(error);
    processesByAppSession.set(appSessionId, {
      appSessionId,
      profileId,
      ptySessionId: "",
      buffer: "",
      status: "error",
      error: message,
    });
    notifyStatus(appSessionId, "error", message);
    throw error;
  }
}

async function validateWorkingDirectory(profileId: TerminalProfileId, cwd?: string) {
  return invoke<ValidatedWorkingDirectory>("validate_working_directory", {
    profileId,
    cwd,
  });
}

export async function writeTerminal(appSessionId: string, data: string) {
  const process = processesByAppSession.get(appSessionId);
  if (!process?.ptySessionId || process.status !== "connected") {
    return;
  }

  await invoke("write_terminal", {
    sessionId: process.ptySessionId,
    data,
  });
}

export function registerTerminalFocus(appSessionId: string, focus: () => void) {
  terminalFocusHandlers.set(appSessionId, focus);
  return () => {
    if (terminalFocusHandlers.get(appSessionId) === focus) {
      terminalFocusHandlers.delete(appSessionId);
    }
  };
}

export function focusTerminal(appSessionId: string) {
  terminalFocusHandlers.get(appSessionId)?.();
}

export async function resizeTerminal(appSessionId: string, rows: number, cols: number) {
  const process = processesByAppSession.get(appSessionId);
  if (!process?.ptySessionId || process.status !== "connected") {
    return;
  }

  await invoke("resize_terminal", {
    sessionId: process.ptySessionId,
    rows,
    cols,
  });
}

export async function terminateTerminal(appSessionId: string) {
  const process = processesByAppSession.get(appSessionId);
  if (!process?.ptySessionId) {
    processesByAppSession.delete(appSessionId);
    notifyStatus(appSessionId, "idle", null);
    return;
  }

  processesByAppSession.delete(appSessionId);
  appSessionByPtySession.delete(process.ptySessionId);
  notifyStatus(appSessionId, "idle", null);
  await invoke("terminate_terminal", {
    sessionId: process.ptySessionId,
  }).catch(() => undefined);
}

export async function terminateTerminals(appSessionIds: string[]) {
  await Promise.all(appSessionIds.map((sessionId) => terminateTerminal(sessionId)));
}

function ensureEventListeners() {
  if (eventListeners) {
    return eventListeners;
  }

  eventListeners = Promise.all([
    listen<PtyOutputEvent>("pty-output", (event) => {
      const appSessionId = appSessionByPtySession.get(event.payload.sessionId);
      if (!appSessionId) {
        return;
      }

      const process = processesByAppSession.get(appSessionId);
      if (process) {
        process.buffer += event.payload.data;
      }
      useCortexStore.getState().appendTerminalHistory(appSessionId, event.payload.data);

      for (const subscriber of subscribers.get(appSessionId) ?? []) {
        subscriber.onData(event.payload.data);
      }
    }),
    listen<PtyExitEvent>("pty-exit", (event) => {
      const appSessionId = appSessionByPtySession.get(event.payload.sessionId);
      if (!appSessionId) {
        return;
      }

      const process = processesByAppSession.get(appSessionId);
      if (process) {
        process.status = "exited";
      }
      notifyStatus(appSessionId, "exited", null);
    }),
    listen<PtyErrorEvent>("pty-error", (event) => {
      const appSessionId = appSessionByPtySession.get(event.payload.sessionId);
      if (!appSessionId) {
        return;
      }

      const process = processesByAppSession.get(appSessionId);
      if (process) {
        process.status = "error";
        process.error = event.payload.error;
      }
      notifyStatus(appSessionId, "error", event.payload.error);
    }),
  ]);

  return eventListeners;
}

function notifyStatus(appSessionId: string, status: TerminalStatus, error: string | null) {
  for (const subscriber of subscribers.get(appSessionId) ?? []) {
    subscriber.onStatus?.(status, error);
  }
}
