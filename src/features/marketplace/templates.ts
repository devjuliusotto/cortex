import type { TemplateInstance } from "@/stores/cortexStore";

export type BuiltInTemplate = Pick<
  TemplateInstance,
  "templateId" | "kind" | "title" | "content"
> & {
  description: string;
};

export const BUILT_IN_TEMPLATES: BuiltInTemplate[] = [
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
