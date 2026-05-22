# Persistent Terminal Runtime

Cortex currently owns live PTY processes inside the Tauri desktop app process. That keeps the v0.1 architecture simple and local-first, but it means a full app shutdown ends PowerShell, CMD, and WSL sessions. Restored tabs can show saved scrollback and metadata, but they cannot reconnect to the original shell process.

This document describes a safe path toward persistent terminal sessions without adding a risky background service before the lifecycle, security, and quit semantics are explicit.

## Option 1: Current Model, UI-Owned PTYs

The Tauri app process creates and owns each PTY. The React UI sends input through Tauri commands, receives output through Tauri events, and persists terminal scrollback in local app data.

Pros:

- Simple process model.
- No extra local daemon, service installer, socket, or privilege boundary.
- Easy to fully quit: closing the app tears down PTYs.
- Lower risk of orphaned shells.

Cons:

- Live shells cannot survive full app shutdown.
- A renderer or app-process crash ends all PTYs.
- Restored tabs are stopped shells with saved history, not live process attachments.

Security implications:

- Shell processes inherit the desktop app user's permissions.
- Terminal output is persisted locally and may contain sensitive text.
- There is no local IPC listener exposed beyond the Tauri app.

## Option 2: Cortex Local Daemon Owns PTYs

A separate per-user `cortexd` process owns PTYs and session state. The Tauri UI becomes a client that attaches, detaches, writes input, resizes PTYs, and streams output over a local IPC channel.

The daemon should run as the current user, not elevated. It should bind only to a local transport such as a named pipe with user-only ACLs. It should not expose network sockets, cloud sync, telemetry, or remote-control APIs.

Pros:

- Closing the main window can detach the UI while PTYs keep running.
- Reopening Cortex can reconnect to live sessions by daemon session id.
- The daemon can centralize PTY lifecycle, scrollback, status, and cleanup.
- Multiple UI windows could eventually attach to the same local runtime.

Cons:

- More code and more failure modes.
- Needs authenticated local IPC and versioned protocol messages.
- Must handle daemon upgrades, crashes, stale locks, and app restarts.
- Requires explicit user controls for detach, quit, and kill-all.

Security implications:

- The daemon can execute shell commands, so only the owning Windows user should be able to connect.
- IPC messages must be validated and scoped to known session ids.
- The daemon must not accept remote connections.
- Logs and scrollback remain local and should follow the same retention limits as the UI.

Surviving main-window close:

1. The UI asks the daemon to create a PTY session and receives a stable runtime id.
2. The daemon stores session metadata locally: workspace id, app session id, profile id, cwd, status, process id, and scrollback cursor.
3. Closing the main window detaches subscribers but does not kill PTYs unless the user chooses full quit.
4. The daemon keeps reading output and appending bounded local scrollback.

Reconnect after restart:

1. The UI loads persisted workspace/session metadata.
2. It connects to the local daemon and requests the current runtime session list.
3. Sessions are matched by persisted app session id and daemon runtime id.
4. Running sessions attach to live PTYs; missing sessions are shown as stopped with saved history.
5. The UI subscribes from the last known scrollback cursor to avoid replaying duplicate output.

Avoiding orphaned processes:

- Store a daemon lock file with process id and start time.
- On daemon startup, detect stale lock files and clean them.
- Track child process ids and kill them on daemon full quit.
- Use job objects on Windows so shell process trees can be terminated together when required.
- Periodically verify PTY child liveness and mark missing sessions as crashed.
- Keep a maximum detached lifetime setting before stopping idle detached sessions, if users opt in.

Full quit all sessions:

- Provide a visible `Quit Cortex and stop all shells` command.
- Confirm before terminating running sessions.
- Send graceful termination first where possible, then kill remaining process trees.
- Clear daemon runtime ids from persisted sessions and mark them stopped.
- Exit the daemon after all PTYs are closed.

Status model:

- `running`: PTY exists and at least one shell process is alive.
- `detached`: PTY exists, shell is alive, but no UI is attached.
- `stopped`: no live PTY exists; saved history and metadata remain.
- `crashed`: the daemon or shell process ended unexpectedly; saved history remains and restart is available.

## Option 3: Windows Service Or Tray Runtime

A future runtime could be a tray background process or a Windows service. For Cortex, a tray process is safer than a service because terminal sessions should run as the signed-in user and access that user's profile, WSL, PATH, and credentials.

Pros:

- Clear user-visible background presence.
- Can keep sessions alive after all windows close.
- Tray menu can expose reopen, stop all shells, and quit commands.

Cons:

- Adds installer and update complexity.
- A Windows service may run in the wrong session or privilege context for interactive shells.
- Requires careful UX so users understand shells are still running.

Security implications:

- Prefer per-user tray runtime over elevated service.
- Never run shells elevated unless the user explicitly starts an elevated profile.
- Keep all state local; no cloud sync and no telemetry.

## Recommended Path

1. Keep the current UI-owned PTY model for v0.1.
2. Improve stopped-shell UX with visible saved scrollback, `Shell is stopped`, `Restart shell`, `Clear history`, and `Duplicate session`.
3. Persist per-session cwd and profile so restarted shells resume from the intended directory.
4. Prototype a per-user local daemon behind an internal feature flag.
5. Add explicit detach, reconnect, and full-quit semantics before enabling daemon persistence by default.
