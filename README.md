# Cortex

### Stop managing terminals. Start managing projects.

Cortex is a local-first workspace manager for developers who live in the terminal.

Instead of juggling dozens of PowerShell windows, forgotten commands, scattered notes, and half-finished project setups, Cortex keeps everything related to a project together in a single workspace.

One project. One place.

---

## The Problem

A normal development workflow often looks like this:

* 6 PowerShell windows
* VS Code
* Notepad
* Browser tabs
* Random commands copied from old chats
* Notes scattered everywhere
* Constantly navigating back to the correct folder

And tomorrow?

You do it all again.

---

## Cortex

Open a workspace.

Everything is already there.

* Your terminals
* Your notes
* Your command history
* Your project path
* Your layout

No setup.

No searching.

No remembering.

Just continue where you left off.

---

## Why Cortex Exists

Most terminal applications manage terminals.

Cortex manages projects.

That difference changes everything.

A workspace is not just a terminal tab.

A workspace remembers:

* where your project lives
* which terminals belong to it
* how your screen is organized
* which commands you use repeatedly
* the notes that matter for that project

---

## Built For Real Projects

Imagine opening your project and immediately seeing:

```txt
┌──────────────────────┬──────────────────────┐
│ PowerShell           │ Notes                │
│                      │                      │
│ npm run dev          │ Deployment notes     │
│ cargo check          │ TODO list            │
│ git status           │ Documentation        │
└──────────────────────┴──────────────────────┘
```

Everything exactly where you left it.

---

## Website

The product landing page lives in `website/` so it can be deployed independently from the Tauri desktop app.

Run it locally:

```powershell
npm run website:dev
```

Build it:

```powershell
npm run website:build
```

Add website screenshots and videos under:

```text
website/public/media/
```

The page already looks for:

```text
website/public/media/video-geral.mp4
website/public/media/video-geral.webm
website/public/media/1.png
website/public/media/2.png
website/public/media/3.png
website/public/media/4.png
website/public/media/5.png
```

The numbered images may also use `.jpg`, `.jpeg`, or `.webp`.

For Vercel, import this repository and set the project root directory to `website`. Keep Windows installers and executable bundles in GitHub Releases instead of committing them into the repository. The website reads public releases from:

```text
https://api.github.com/repos/devjuliusotto/cortex/releases
```

Release assets ending in `.exe`, `.msi`, `.msix`, `.zip`, or `.7z` are listed automatically on the website, including current and older versions.

## Features

✔ PowerShell

✔ CMD

✔ WSL Ubuntu

✔ Workspace-specific terminal paths

✔ Notes beside terminals

✔ Command history

✔ Split panes

✔ Persistent layouts

✔ Local-first storage

✔ Open source

✔ Windows native

---

## What Cortex Is Not

✘ Cloud service

✘ Subscription

✘ Telemetry

✘ Analytics

✘ Data collection

✘ Vendor lock-in

✘ Electron bloat

Your data stays on your machine.

Always.

---

## Open Source

Cortex is released under GPL-3.0.

The goal is simple:

Build the terminal workspace manager Windows developers always wanted.

---

## Download

Get the latest release:

https://github.com/devjuliusotto/cortex/releases

---

## Support Cortex

If Cortex saves you time, consider supporting development.

[Buy Me a Coffee](https://www.buymeacoffee.com/juliusottode)

Every contribution helps keep Cortex independent, local-first and open source.
