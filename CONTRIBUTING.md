# Contributing

Thanks for contributing to Cortex.

## Project Principles

- Keep Cortex local-first.
- Do not add telemetry, analytics, tracking, cloud sync, or external services.
- Do not add AI features unless the project explicitly changes scope.
- Make future integrations opt-in, configurable, documented, and disabled by default.
- Do not commit secrets, local databases, private paths, logs, credentials, or personal information.
- Keep changes small, maintainable, and aligned with the Windows desktop app goal.

## Development

Install dependencies:

```powershell
npm install
```

Run the Tauri desktop app in development:

```powershell
npm run tauri:dev
```

Run the frontend build:

```powershell
npm run build
```

Run Rust checks from `src-tauri`:

```powershell
cargo check
```

Build desktop installer artifacts:

```powershell
npm run tauri:build
```

Artifacts are written under `src-tauri/target/release/bundle/`.

## Pull Requests

Include:

- What changed.
- How it was tested.
- Any privacy or local-data implications.
- Any persistence format changes.
- Any new configuration values, documented with placeholders in `.env.example`.

## Release Notes

Call out user-visible terminal, persistence, installer, and privacy changes. Do not include machine-specific paths or local testing data.
