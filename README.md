# Cortex

Cortex is a Windows-first desktop terminal manager built with Tauri v2, React, TypeScript, Rust, xterm.js, TailwindCSS, and Zustand.

It is a downloadable desktop app, not a website or SaaS product. The v0.1 goal is to organize local terminal sessions into workspaces with real Windows terminal support for PowerShell, CMD, and WSL Ubuntu.

## Privacy And Local-First Model

Cortex v0.1 is fully local-first:

- No telemetry.
- No analytics.
- No tracking.
- No cloud sync.
- No external API calls.
- No API keys or credentials required.

Workspace, session, tab, layout, profile, and window metadata are saved only on the user's machine under the operating system app data directory. Cortex does not store user state in the Git repository.

Live terminal processes are not restored after restart. Cortex restores session tabs and metadata only, and restored sessions are marked inactive until started again.

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

## Local Persistence

The frontend persists app state automatically through `src/lib/storage`.

In the Tauri desktop runtime, the adapter calls Rust commands that read and write `cortex-state.json` in the app data directory. Writes are debounced and automatic. In frontend-only browser development, the adapter falls back to `localStorage` so UI work can continue without the Tauri shell.

Persisted state includes:

- workspaces and folders
- terminal session metadata
- session names
- shell profile per session
- active workspace
- active tabs
- layout state
- window size, position, and maximized state when available

Terminal process handles and live PTY state are never persisted.

## Architecture

- `src/layouts` contains the desktop shell, top bar, and sidebar.
- `src/features/workspace` contains workspace navigation UI.
- `src/features/terminal` contains terminal tabs, xterm rendering, and the Tauri terminal bridge.
- `src/stores/cortexStore.ts` owns workspace/session/layout state with Zustand.
- `src/lib/storage` isolates persistence behind an adapter interface.
- `src-tauri/src/pty` contains the PTY abstraction and Windows ConPTY implementation.
- `src-tauri/src/db` prepares the app data directory for local persistence.

## License

Cortex is licensed under the Apache License, Version 2.0. See `LICENSE`.
