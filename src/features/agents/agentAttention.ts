import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from "@tauri-apps/plugin-notification";
import { getCurrentWindow, UserAttentionType } from "@tauri-apps/api/window";

export type AgentAttentionTarget = {
  workspaceId: string;
  paneId: string;
  sessionId: string;
  sessionName: string;
  message?: string;
};

let pendingTarget: AgentAttentionTarget | null = null;
const listeners = new Set<(target: AgentAttentionTarget) => void>();

export function getPendingAgentAttention() {
  return pendingTarget;
}

export function clearPendingAgentAttention(sessionId?: string) {
  if (!sessionId || pendingTarget?.sessionId === sessionId) pendingTarget = null;
}

export function subscribeAgentAttention(listener: (target: AgentAttentionTarget) => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export async function requestAgentAttention(target: AgentAttentionTarget) {
  pendingTarget = target;
  for (const listener of listeners) listener(target);

  if (!("__TAURI_INTERNALS__" in window)) return;
  const appWindow = getCurrentWindow();
  await appWindow.requestUserAttention(UserAttentionType.Critical).catch(() => undefined);

  try {
    let granted = await isPermissionGranted();
    if (!granted) granted = (await requestPermission()) === "granted";
    if (granted) {
      sendNotification({
        title: `${target.sessionName} needs authorization`,
        body: target.message?.slice(0, 160) || "Open Cortex to review and authorize the pending action.",
        autoCancel: true,
        extra: {
          workspaceId: target.workspaceId,
          paneId: target.paneId,
          sessionId: target.sessionId,
        },
      });
    }
  } catch {
    // Taskbar attention remains available if native notifications are unavailable.
  }
}
