import type { CommandHistoryEntry } from "@/features/terminal/commandHistory";
import type { TerminalSession, Workspace } from "@/stores/cortexStore";

const CHANNEL_NAME = "cortex-office-window-v1";

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

export function openOfficeWindow() {
  const url = new URL(window.location.href);
  url.hash = "/office?mode=window";
  window.open(url.toString(), "cortex-office", "noopener,noreferrer");
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
