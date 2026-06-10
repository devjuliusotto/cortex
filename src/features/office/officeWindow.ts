import type { CommandHistoryEntry } from "@/features/terminal/commandHistory";
import type { TerminalSession, Workspace } from "@/stores/cortexStore";

const CHANNEL_NAME = "cortex-office-window-v1";
const OFFICE_WINDOW_PATH = "/office?mode=window";

export type OfficeWindowSnapshot = {
  activeWorkspaceId: string | null;
  workspaces: Workspace[];
  sessions: TerminalSession[];
  commandHistory: CommandHistoryEntry[];
};

type OfficeWindowMessage =
  | { type: "requestSnapshot" }
  | { type: "snapshot"; snapshot: OfficeWindowSnapshot }
  | { type: "focusTerminal"; terminalId: string };

function browserOfficeWindowUrl() {
  const url = new URL(window.location.href);
  url.hash = OFFICE_WINDOW_PATH;
  return url.toString();
}

function openBrowserOfficeWindow() {
  const officeWindow = window.open(browserOfficeWindowUrl(), "_blank", "noopener,noreferrer");
  if (!officeWindow) {
    console.warn("Office window popup was blocked by the browser");
    return false;
  }
  return true;
}

export async function openOfficeWindow() {
  if (!("__TAURI_INTERNALS__" in window)) {
    return openBrowserOfficeWindow();
  }

  try {
    const { WebviewWindow } = await import("@tauri-apps/api/webviewWindow");
    const label = `office-${Date.now()}`;
    const officeWindow = new WebviewWindow(label, {
      url: `/#${OFFICE_WINDOW_PATH}`,
      title: "Cortex Office View",
      width: 1280,
      height: 820,
      minWidth: 900,
      minHeight: 620,
      resizable: true,
      center: true,
    });

    await new Promise<void>((resolve, reject) => {
      void officeWindow.once("tauri://created", () => resolve());
      void officeWindow.once<string>("tauri://error", (event) => reject(new Error(event.payload)));
    });
    return true;
  } catch (error) {
    console.warn("Tauri Office window creation failed; trying browser fallback", error);
    return openBrowserOfficeWindow();
  }
}

export function createOfficeWindowChannel(onMessage: (message: OfficeWindowMessage) => void) {
  if (!("BroadcastChannel" in window)) {
    // TODO: Add a Tauri event fallback if a platform does not support BroadcastChannel across webviews.
    return null;
  }
  const channel = new BroadcastChannel(CHANNEL_NAME);
  channel.onmessage = (event: MessageEvent<OfficeWindowMessage>) => onMessage(event.data);
  return channel;
}

export function requestOfficeSnapshot(channel: BroadcastChannel | null) {
  channel?.postMessage({ type: "requestSnapshot" } satisfies OfficeWindowMessage);
}

export function publishOfficeSnapshot(channel: BroadcastChannel | null, snapshot: OfficeWindowSnapshot) {
  channel?.postMessage({ type: "snapshot", snapshot } satisfies OfficeWindowMessage);
}

export function requestTerminalFocus(channel: BroadcastChannel | null, terminalId: string) {
  channel?.postMessage({ type: "focusTerminal", terminalId } satisfies OfficeWindowMessage);
}
