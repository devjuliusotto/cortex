# Cortex

Cortex is a Windows-first desktop terminal manager built with Tauri v2, React, TypeScript, Rust, xterm.js, TailwindCSS, and Zustand.

It is a downloadable desktop app, not a website or SaaS product. The v0.1 goal is to organize local terminal sessions into workspaces with real Windows terminal support for PowerShell, CMD, and WSL Ubuntu.

## Privacy And Local-First Model

Cortex v0.1 is fully local-first:

- No telemetry.
- No analytics.
- No tracking.
- No cloud sync.
- No background external API calls. Manual update checks contact GitHub Releases only when the user chooses `Check`.
- No API keys or credentials required.

Workspace, session, tab, layout, profile, terminal history, note, and window metadata are saved only on the user's machine under the operating system app data directory. Cortex does not store user state in the Git repository.

Live terminal processes are not restored after restart. Cortex restores session tabs, metadata, and visual terminal history only, and restored sessions are marked inactive until started again.

Terminal history persistence stores the visible terminal output locally. Terminal output can contain commands, paths, environment values, tokens, or other sensitive text if those values were printed in the shell. Keep this in mind when using shared Windows accounts or backing up the app data directory.

## Requirements

- Windows 10 or newer with ConPTY support.
- Node.js 20 LTS recommended.
- Rust stable through `rustup`.
- WSL Ubuntu installed if you want to use the WSL Ubuntu profile.

Install Rust on Windows:

```powershell
winget install Rustlang.Rustup
```

## Development Setup

```powershell
npm install
npm run tauri:dev
```

Frontend-only Vite development is available, but the production target is the Tauri desktop app:

```powershell
npm run dev
```

## Build

Run the frontend production build:

```powershell
npm run build
```

Build the Windows desktop app and installer bundles:

```powershell
npm run tauri:build
```

Tauri writes release artifacts under:

```text
src-tauri/target/release/bundle/
```

Windows installer outputs are typically generated below `msi/` and `nsis/` inside that bundle directory, depending on the configured Tauri targets and installed tooling.

Unsigned Windows builds may trigger Microsoft SmartScreen warnings. Code signing is intentionally not configured for v0.1.

## GitHub Releases

Release builds are prepared through the Windows GitHub Actions workflow in `.github/workflows/release.yml`.

To publish a release:

1. Update the version in `package.json`, `package-lock.json`, `src-tauri/Cargo.toml`, and `src-tauri/tauri.conf.json`.
2. Commit the release changes.
3. Create and push a version tag:

```powershell
git tag v0.1.0
git push origin v0.1.0
```

The workflow builds Cortex on Windows and uploads installer artifacts to the matching GitHub Release.

## In-App Updates

Cortex uses Tauri's official updater plugin for manual in-app update checks. Open `Settings`, choose `Check`, then confirm before downloading or installing an available release. Cortex does not perform background update checks.

The updater is configured to read release metadata from:

```text
https://github.com/devjuliusotto/cortex/releases/latest/download/latest.json
```

Production updater support requires signed updater artifacts:

1. Generate a Tauri updater signing key with the Tauri CLI.
2. Put only the public key in `src-tauri/tauri.conf.json` under `plugins.updater.pubkey`.
3. Keep the private key outside the repository, for example in GitHub Actions secrets.
4. Set `bundle.createUpdaterArtifacts` to `true` for release builds that have `TAURI_SIGNING_PRIVATE_KEY` available.
5. Ensure releases upload the generated updater artifacts and `latest.json`.

The current `pubkey` value is a placeholder and `createUpdaterArtifacts` is disabled so local builds do not require private keys. Replace the public key and enable updater artifact generation before publishing update-enabled production builds. Never commit private signing keys.

## Local Persistence

The frontend persists app state automatically through `src/lib/storage`.

In the Tauri desktop runtime, the adapter calls Rust commands that read and write `cortex-state.json` in the app data directory. Writes are debounced and automatic. In frontend-only browser development, the adapter falls back to `localStorage` so UI work can continue without the Tauri shell.

Persisted state includes:

- workspaces and folders
- per-workspace default working directory
- terminal session metadata
- session names
- terminal scrollback/history, capped at the last 10,000 lines or about 1 MB per session
- local note titles and content
- shell profile per session
- active workspace
- active tabs
- layout state
- window size, position, and maximized state when available

Terminal process handles and live PTY state are never persisted.

## Terminal History

Cortex captures PTY output as it arrives and appends it to the terminal session's local persisted history. The frontend writes restored history back into xterm when a stopped terminal tab is opened after app restart.

History is bounded by `MAX_TERMINAL_HISTORY_LINES` and `MAX_TERMINAL_HISTORY_BYTES` in `src/stores/cortexStore.ts` to avoid unbounded app data growth. Restarting a stopped terminal keeps the previous visual history and appends:

```text
--- New terminal session started ---
```

Then Cortex starts a fresh PTY process for the same terminal tab. The old process is not resumed after a full app shutdown.

## Notes

Use the `New Note` button in the workspace tab controls to create a note beside terminal tabs. Notes have a title, editable Markdown/plain-text content, `createdAt`, and `updatedAt`. They auto-save through the same local persistence adapter as terminal and workspace metadata, and they are restored after app restart.

Notes can be renamed or deleted from the tab row. They are local app state only and are not written into the Git repository.

## Default Working Directory

Open `Settings` with a workspace selected and set `Default working directory`. New PowerShell and CMD terminals in that workspace start there when the path exists.

If the configured path is missing or invalid, Cortex shows a friendly warning in the terminal area and starts the terminal in the user's home directory. WSL currently falls back to the WSL home directory when a Windows path such as `C:\Projects\App` is configured; Windows-to-WSL path conversion is intentionally deferred until it can be handled safely.

Manual verification:

- Set a valid workspace default path, create a new PowerShell terminal, and run `pwd`.
- Set an invalid path, create a terminal, and confirm the warning plus home-directory fallback.
- Restart Cortex and confirm the workspace path and notes are restored.

## App Icon

The app icon is generated from `src/assets/cortex-logo.svg`, the same logo asset used in the Cortex sidebar and top bar. Tauri bundle icons live under `src-tauri/icons/` and are referenced from `src-tauri/tauri.conf.json`, including `icon.ico` for Windows executable and installer branding.

## Architecture

- `src/layouts` contains the desktop shell, top bar, and sidebar.
- `src/features/workspace` contains workspace navigation UI.
- `src/features/terminal` contains terminal tabs, xterm rendering, and the Tauri terminal bridge.
- `src/features/settings` contains update controls and workspace settings.
- `src/stores/cortexStore.ts` owns workspace/session/layout state with Zustand.
- `src/lib/storage` isolates persistence behind an adapter interface.
- `src-tauri/src/pty` contains the PTY abstraction and Windows ConPTY implementation.
- `src-tauri/src/db` prepares the app data directory for local persistence.

## License

Cortex is licensed under the Apache License, Version 2.0. See `LICENSE`.
