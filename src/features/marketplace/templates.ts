import type { CommandSnippet, TemplateInstance, TerminalProfileId } from "@/stores/cortexStore";

export const WORKSPACE_TEMPLATES_MARKETPLACE_ENABLED = false;

export type BuiltInTemplate = Pick<
  TemplateInstance,
  "templateId" | "kind" | "title" | "content"
> & {
  description: string;
};

export const ARCHIVED_MARKETPLACE_NOTE_TEMPLATES: BuiltInTemplate[] = [
  {
    templateId: "notes-panel",
    kind: "note",
    title: "Notes panel",
    description: "A blank local note for project context, decisions, and reminders.",
    content: "# Notes\n\n",
  },
  {
    templateId: "project-checklist",
    kind: "note",
    title: "Project checklist",
    description: "A lightweight markdown checklist for current workspace tasks.",
    content: "# Project checklist\n\n- [ ] Review setup\n- [ ] Run checks\n- [ ] Package release\n",
  },
  {
    templateId: "command-snippets",
    kind: "note",
    title: "Command snippets",
    description: "Keep frequently used local commands next to terminal tabs.",
    content: "# Command snippets\n\n```powershell\nnpm run build\nnpm run tauri:build\n```\n",
  },
  {
    templateId: "environment-variables-note",
    kind: "note",
    title: "Environment variables note",
    description: "Document required environment keys without storing secret values.",
    content: "# Environment variables\n\nDo not paste secrets here.\n\n- KEY_NAME: purpose\n",
  },
  {
    templateId: "deployment-notes",
    kind: "note",
    title: "Deployment notes",
    description: "Capture release steps, artifact paths, and verification notes.",
    content: "# Deployment notes\n\n## Build\n\n## Verify\n\n## Release\n",
  },
];

export type BuiltInSessionTemplate = {
  id: string;
  name: string;
  description: string;
  terminalProfiles: TerminalProfileId[];
  notes: Array<Pick<TemplateInstance, "templateId" | "kind" | "title" | "content">>;
  snippets: Array<Pick<CommandSnippet, "name" | "command" | "description" | "profileId">>;
};

export const ARCHIVED_MARKETPLACE_SESSION_TEMPLATES: BuiltInSessionTemplate[] = [
  {
    id: "react-project",
    name: "React project",
    description: "Local notes and snippets for a React workspace.",
    terminalProfiles: ["powershell"],
    notes: [
      {
        templateId: "react-project-notes",
        kind: "note",
        title: "React project",
        content: "# React project\n\n## Scripts\n\n## Components\n\n## Checks\n",
      },
    ],
    snippets: [
      { name: "Install", command: "npm install", description: "Install dependencies", profileId: "powershell" },
      { name: "Dev", command: "npm run dev", description: "Start dev server", profileId: "powershell" },
      { name: "Build", command: "npm run build", description: "Production build", profileId: "powershell" },
    ],
  },
  {
    id: "rust-tauri-project",
    name: "Rust/Tauri",
    description: "Local notes and snippets for Rust and Tauri projects.",
    terminalProfiles: ["powershell", "wsl-ubuntu"],
    notes: [
      {
        templateId: "tauri-project-notes",
        kind: "note",
        title: "Rust/Tauri project",
        content: "# Rust/Tauri project\n\n## Frontend\n\n## Backend\n\n## Release\n",
      },
    ],
    snippets: [
      { name: "Cargo check", command: "cargo check", description: "Rust type/check pass", profileId: "powershell" },
      { name: "Tauri dev", command: "npm run tauri:dev", description: "Run Tauri dev app", profileId: "powershell" },
      { name: "Tauri build", command: "npm run tauri:build", description: "Build desktop app", profileId: "powershell" },
    ],
  },
  {
    id: "node-project",
    name: "Node project",
    description: "Local notes and snippets for Node.js projects.",
    terminalProfiles: ["powershell"],
    notes: [
      {
        templateId: "node-project-notes",
        kind: "note",
        title: "Node project",
        content: "# Node project\n\n## Scripts\n\n## Environment\n\n## Checks\n",
      },
    ],
    snippets: [
      { name: "Install", command: "npm install", description: "Install dependencies", profileId: "powershell" },
      { name: "Test", command: "npm test", description: "Run tests", profileId: "powershell" },
      { name: "Start", command: "npm start", description: "Start app", profileId: "powershell" },
    ],
  },
  {
    id: "git-workflow",
    name: "Git workflow",
    description: "Local git workflow snippets and release checklist.",
    terminalProfiles: [],
    notes: [
      {
        templateId: "git-workflow-notes",
        kind: "note",
        title: "Git workflow",
        content: "# Git workflow\n\n- [ ] Review changes\n- [ ] Run checks\n- [ ] Commit\n- [ ] Tag release\n",
      },
    ],
    snippets: [
      { name: "Status", command: "git status --short", description: "Compact status", profileId: "powershell" },
      { name: "Log", command: "git log --oneline -8", description: "Recent commits", profileId: "powershell" },
      { name: "Tags", command: "git tag --list \"v*\"", description: "List release tags", profileId: "powershell" },
    ],
  },
];
