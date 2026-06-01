# CLI and Local API Groundwork

Cortex v0.2 adds an internal command dispatcher so UI actions and future local scripting can share one command surface.

Example future CLI calls:

```powershell
cortex open "C:\Projects\Cortex"
cortex split right
cortex send "npm run dev"
cortex browser http://localhost:1420
cortex note "Release checklist"
```

## Proposed architecture

1. `cortex` CLI parses arguments.
2. CLI connects to a local-only IPC endpoint, preferably a Windows named pipe.
3. Running Cortex app receives a structured command.
4. App validates the command and dispatches through `src/features/commandSystem/`.
5. App returns a small local response.

## Initial internal commands

- `workspace.open`
- `terminal.new`
- `terminal.sendText`
- `pane.splitRight`
- `pane.splitDown`
- `note.new`
- `browser.open`
- `settings.open`

The current command palette already uses this dispatcher. A future CLI should call the same command IDs instead of duplicating behavior.

## Security requirements

- Local-only IPC.
- No remote TCP socket.
- No unauthenticated remote control.
- No command execution without an explicit local command request.
- No background cloud relay.
- No telemetry, analytics, or command upload.

## Future risks

Terminal text injection is powerful. A local API must treat `terminal.sendText` and custom command execution as sensitive operations, even when the source is local. Consider opt-in enablement, a per-session secret, or visible prompts before enabling broad automation.
