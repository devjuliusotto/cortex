# cortex.json Commands

Future versions may import workspace commands from a local `cortex.json` file when the user explicitly clicks an import action.

Cortex must never auto-run imported commands.

Example schema:

```json
{
  "commands": [
    {
      "name": "Dev server",
      "description": "Start the local development server",
      "command": "npm run dev",
      "profileId": "powershell",
      "cwdBehavior": "workspace",
      "runBehavior": "new-terminal-run"
    },
    {
      "name": "Build",
      "command": "npm run build",
      "profileId": "powershell",
      "cwdBehavior": "workspace",
      "runBehavior": "run"
    }
  ]
}
```

Supported values:

- `profileId`: `powershell`, `cmd`, or `wsl-ubuntu`
- `cwdBehavior`: `workspace`, `session`, or `custom`
- `customCwd`: required only when `cwdBehavior` is `custom`
- `runBehavior`: `paste`, `run`, or `new-terminal-run`

Import rules:

- User-initiated only.
- Validate all fields.
- Show a preview before saving.
- Store imported commands locally.
- Never execute during import.
