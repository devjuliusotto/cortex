import type { TerminalProfileId } from "@/stores/cortexStore";

export const MAX_COMMAND_HISTORY_PER_WORKSPACE = 500;

export type CommandHistoryEntry = {
  id: string;
  workspaceId: string;
  sessionId: string;
  command: string;
  profileId: TerminalProfileId;
  cwd?: string;
  createdAt: string;
};

export type CommandHistoryDraft = Omit<CommandHistoryEntry, "id" | "createdAt">;

type CommandRecorderOptions = {
  onCommand: (command: string) => void;
};

type CommandRecorder = {
  accept: (data: string) => void;
  reset: () => void;
};

const CONTROL_RESET_CHARS = new Set(["\u0003", "\u0004", "\u001a"]);

export function normalizeCommandForHistory(command: string) {
  return command.replace(/\r\n/g, "\n").replace(/\r/g, "\n").trim();
}

export function shouldStoreCommand(command: string, previousCommand?: string) {
  const normalized = normalizeCommandForHistory(command);
  if (!normalized) {
    return false;
  }

  return normalized !== previousCommand;
}

export function createCommandRecorder({ onCommand }: CommandRecorderOptions): CommandRecorder {
  let buffer = "";

  const commit = () => {
    const command = normalizeCommandForHistory(buffer);
    buffer = "";
    if (command) {
      onCommand(command);
    }
  };

  return {
    accept(data: string) {
      if (!data) {
        return;
      }

      if (data.includes("\u001b")) {
        return;
      }

      for (const char of data) {
        if (char === "\r" || char === "\n") {
          commit();
          continue;
        }

        if (char === "\u007f" || char === "\b") {
          buffer = buffer.slice(0, -1);
          continue;
        }

        if (char === "\u0015") {
          buffer = "";
          continue;
        }

        if (char === "\u0017") {
          buffer = buffer.replace(/\s*\S+\s*$/, "");
          continue;
        }

        if (CONTROL_RESET_CHARS.has(char)) {
          buffer = "";
          continue;
        }

        if (char >= " " || char === "\t") {
          buffer += char;
        }
      }
    },
    reset() {
      buffer = "";
    },
  };
}
