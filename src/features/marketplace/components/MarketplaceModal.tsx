import { invoke } from "@tauri-apps/api/core";
import {
  AlertTriangle,
  Building2,
  Bug,
  CheckSquare,
  Download,
  ExternalLink,
  FileText,
  Lightbulb,
  Package,
  Puzzle,
  RefreshCw,
  Search,
  TerminalSquare,
  Wrench,
  X,
} from "lucide-react";
import type { ReactNode } from "react";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  FEEDBACK_TYPES,
  GITHUB_ISSUE_URL,
  GITHUB_REPOSITORY,
  OFFICE_VIEW_ADDON_ENABLED,
  type FeedbackType,
} from "@/config/marketplace";
import {
  ARCHIVED_MARKETPLACE_NOTE_TEMPLATES,
  WORKSPACE_TEMPLATES_MARKETPLACE_ENABLED,
} from "@/features/marketplace/templates";
import {
  checkDeveloperToolUpdatesCommand,
  developerToolCategories,
  developerToolsCatalog,
  installDeveloperToolCommand,
  updateAllDeveloperToolsCommand,
  updateDeveloperToolCommand,
} from "@/features/marketplace/developerToolsCatalog";
import { queueVisibleTerminalCommand } from "@/features/terminal/terminalBridge";
import { cn } from "@/lib/utils";
import { useCortexStore } from "@/stores/cortexStore";

type MarketplaceModalProps = {
  open: boolean;
  onClose: () => void;
  onTerminalOpen?: (sessionId: string) => void;
};

type MarketplaceTab = "tools" | "feedback" | "templates" | "addons";

const tabItems: Array<{ id: MarketplaceTab; label: string; icon: typeof FileText }> = [
  { id: "tools", label: "Developer Tools", icon: Wrench },
  { id: "feedback", label: "Feedback", icon: FileText },
  { id: "templates", label: "Templates", icon: CheckSquare },
  { id: "addons", label: "Add-ons", icon: Puzzle },
];

export function MarketplaceModal({ open, onClose, onTerminalOpen }: MarketplaceModalProps) {
  const [activeTab, setActiveTab] = useState<MarketplaceTab>("tools");

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4">
      <section className="flex max-h-[min(760px,calc(100vh-2rem))] w-full max-w-5xl flex-col overflow-hidden rounded-md border border-border bg-background shadow-2xl">
        <header className="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card/80 px-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-semibold">Marketplace</h2>
            </div>
            <p className="mt-0.5 truncate text-xs text-muted-foreground">
              Install and update developer tools from managed package sources
            </p>
          </div>
          <Button size="icon" variant="ghost" onClick={onClose} title="Close marketplace">
            <X className="h-4 w-4" />
          </Button>
        </header>

        <div className="flex min-h-0 flex-1">
          <nav className="w-44 shrink-0 border-r border-border bg-card/45 p-2">
            {tabItems.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  className={cn(
                    "mb-1 flex h-9 w-full items-center gap-2 rounded-md px-3 text-left text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                    activeTab === tab.id && "bg-secondary text-foreground shadow-glow",
                  )}
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  type="button"
                >
                  <Icon className="h-4 w-4" />
                  {tab.label}
                </button>
              );
            })}
          </nav>

          <div className="min-w-0 flex-1 overflow-y-auto p-5">
            {activeTab === "tools" && <DeveloperToolsTab onClose={onClose} onTerminalOpen={onTerminalOpen} />}
            {activeTab === "feedback" && <FeedbackTab />}
            {activeTab === "templates" && <TemplatesTab />}
            {activeTab === "addons" && <AddOnsTab />}
          </div>
        </div>
      </section>
    </div>
  );
}

function DeveloperToolsTab({ onClose, onTerminalOpen }: { onClose: () => void; onTerminalOpen?: (sessionId: string) => void }) {
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<(typeof developerToolCategories)[number]>("All");
  const { activeWorkspaceId, createSession, workspaces } = useCortexStore();
  const activeWorkspace = workspaces.find((workspace) => workspace.id === activeWorkspaceId);
  const filteredTools = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return developerToolsCatalog.filter((tool) => {
      const matchesCategory = category === "All" || tool.category === category;
      const searchable = `${tool.name} ${tool.id} ${tool.description} ${tool.tags.join(" ")}`.toLowerCase();
      return matchesCategory && (!normalizedQuery || searchable.includes(normalizedQuery));
    });
  }, [category, query]);

  const openCommand = (command: string) => {
    if (!activeWorkspace) {
      window.alert("Create or select a workspace before installing developer tools.");
      return;
    }
    const sessionId = createSession(activeWorkspace.id, "powershell", null);
    queueVisibleTerminalCommand(sessionId, command);
    onTerminalOpen?.(sessionId);
    onClose();
  };

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-2xl">
          <h3 className="text-base font-semibold">Developer Tools</h3>
          <p className="mt-1 text-sm leading-6 text-muted-foreground">
            Cortex stores package IDs only. WinGet resolves the current version, official download,
            architecture, installer options, and future updates.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="outline" onClick={() => openCommand(checkDeveloperToolUpdatesCommand)}>
            <RefreshCw className="mr-2 h-4 w-4" />Check updates
          </Button>
          <Button size="sm" onClick={() => openCommand(updateAllDeveloperToolsCommand)}>
            <Download className="mr-2 h-4 w-4" />Update all WinGet
          </Button>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 md:flex-row">
        <label className="flex h-10 min-w-0 flex-1 items-center gap-2 rounded-md border border-border bg-background px-3">
          <Search className="h-4 w-4 text-muted-foreground" />
          <input className="min-w-0 flex-1 bg-transparent text-sm outline-none" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search tools, package IDs, or tags" />
        </label>
        <select className="h-10 rounded-md border border-border bg-secondary px-3 text-sm outline-none" value={category} onChange={(event) => setCategory(event.target.value as (typeof developerToolCategories)[number])}>
          {developerToolCategories.map((item) => <option key={item} value={item}>{item}</option>)}
        </select>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {filteredTools.map((tool) => (
          <article className="flex flex-col rounded-md border border-border bg-card/55 p-4" key={tool.id}>
            <div className="flex items-start justify-between gap-3">
              <div><h4 className="text-sm font-medium">{tool.name}</h4><div className="mt-1 text-[11px] text-primary">{tool.category}</div></div>
              <Package className="h-4 w-4 shrink-0 text-muted-foreground" />
            </div>
            <p className="mt-3 text-xs leading-5 text-muted-foreground">{tool.description}</p>
            <code className="mt-3 break-all rounded bg-background/70 px-2 py-1.5 text-[10px] text-muted-foreground">{tool.id}</code>
            <div className="mt-auto flex flex-wrap gap-2 pt-4">
              <Button size="sm" onClick={() => openCommand(installDeveloperToolCommand(tool.id))}><TerminalSquare className="mr-2 h-3.5 w-3.5" />Install latest</Button>
              <Button size="sm" variant="outline" onClick={() => openCommand(updateDeveloperToolCommand(tool.id))}><RefreshCw className="mr-2 h-3.5 w-3.5" />Update</Button>
            </div>
          </article>
        ))}
      </div>
      {filteredTools.length === 0 && <div className="mt-5 rounded-md border border-dashed border-border p-8 text-center text-sm text-muted-foreground">No tools match this search.</div>}
    </div>
  );
}

function FeedbackTab() {
  const [type, setType] = useState<FeedbackType>("feature");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [steps, setSteps] = useState("");
  const selectedType = FEEDBACK_TYPES[type];
  const issueUrl = useMemo(() => {
    const issueTitle = `${selectedType.titlePrefix} ${title.trim()}`.trim();
    const body = [
      `## Type\n${selectedType.label}`,
      `## Description\n${description.trim() || "Describe the request here."}`,
      type === "bug"
        ? `## Reproduction Steps\n${steps.trim() || "1. \n2. \n3. "}`
        : null,
      "## Privacy\nSubmitted manually by the user from Cortex. No telemetry, tokens, or background upload are used.",
    ]
      .filter(Boolean)
      .join("\n\n");
    const params = new URLSearchParams({
      title: issueTitle || selectedType.titlePrefix,
      body,
      labels: selectedType.labels.join(","),
    });
    return `${GITHUB_ISSUE_URL}?${params.toString()}`;
  }, [description, selectedType, steps, title, type]);

  const openIssue = async () => {
    await invoke("open_external_url", { url: issueUrl }).catch(() => {
      window.open(issueUrl, "_blank", "noopener,noreferrer");
    });
  };

  return (
    <div className="max-w-3xl">
      <h3 className="text-base font-semibold">Open GitHub Issue</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Cortex opens a prefilled GitHub issue in your browser. You must be logged into GitHub
        there to submit it.
      </p>

      <div className="mt-5 grid gap-4">
        <label className="grid gap-2">
          <span className="text-xs font-medium text-muted-foreground">Type</span>
          <select
            className="h-9 rounded-md border border-border bg-secondary px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={type}
            onChange={(event) => setType(event.target.value as FeedbackType)}
          >
            {Object.entries(FEEDBACK_TYPES).map(([id, item]) => (
              <option key={id} value={id}>
                {item.label}
              </option>
            ))}
          </select>
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium text-muted-foreground">Title</span>
          <input
            className="h-9 rounded-md border border-border bg-background px-3 text-sm outline-none focus:ring-1 focus:ring-ring"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="Short summary"
          />
        </label>

        <label className="grid gap-2">
          <span className="text-xs font-medium text-muted-foreground">Description</span>
          <textarea
            className="min-h-36 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus:ring-1 focus:ring-ring"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="What should change, or what happened?"
          />
        </label>

        {type === "bug" && (
          <label className="grid gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Reproduction steps
            </span>
            <textarea
              className="min-h-28 resize-y rounded-md border border-border bg-background p-3 text-sm leading-6 outline-none focus:ring-1 focus:ring-ring"
              value={steps}
              onChange={(event) => setSteps(event.target.value)}
              placeholder={"1. Open Cortex\n2. ..."}
            />
          </label>
        )}

        <div className="rounded-md border border-border bg-card/55 p-3 text-xs leading-5 text-muted-foreground">
          <div className="mb-1 flex items-center gap-2 font-medium text-foreground">
            <AlertTriangle className="h-3.5 w-3.5 text-cortex-amber" />
            Manual submission only
          </div>
          No GitHub token is stored. Cortex does not upload this in the background.
        </div>

        <div>
          <Button onClick={openIssue} disabled={!title.trim()}>
            <ExternalLink className="mr-2 h-4 w-4" />
            Open GitHub Issue
          </Button>
        </div>
      </div>
    </div>
  );
}

function TemplatesTab() {
  if (!WORKSPACE_TEMPLATES_MARKETPLACE_ENABLED) {
    return (
      <div className="max-w-3xl">
        <h3 className="text-base font-semibold">Workspace Templates (Coming Soon)</h3>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">
          Project templates are being moved out of the core Cortex experience and into optional
          Marketplace add-ons. Cortex stays focused on terminals, workspaces, split layouts,
          persistence, notes, and snippets.
        </p>
        <div className="mt-5 rounded-md border border-border bg-card/55 p-4 text-sm leading-6 text-muted-foreground">
          Template definitions are archived behind a disabled Marketplace flag so the extension
          path can be reused later without pushing templates into the default UI.
        </div>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-base font-semibold">Local Templates</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Built-in templates create local workspace tabs. They do not download or execute code.
      </p>

      <div className="mt-5 grid gap-3 md:grid-cols-2">
        {ARCHIVED_MARKETPLACE_NOTE_TEMPLATES.map((template) => (
          <article
            className="rounded-md border border-border bg-card/55 p-4"
            key={template.templateId}
          >
            <div className="mb-3 flex items-start gap-3">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-md border border-primary/20 bg-primary/10">
                <FileText className="h-4 w-4 text-primary" />
              </div>
              <div className="min-w-0">
                <h4 className="text-sm font-medium">{template.title}</h4>
                <p className="mt-1 text-xs leading-5 text-muted-foreground">
                  {template.description}
                </p>
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              disabled
            >
              Disabled
            </Button>
          </article>
        ))}
      </div>
    </div>
  );
}

function AddOnsTab() {
  const officeEnabled = useCortexStore((state) => state.settings.officeViewEnabled);
  const setFeatureFlag = useCortexStore((state) => state.setFeatureFlag);
  return (
    <div className="max-w-3xl">
      <h3 className="text-base font-semibold">Add-ons</h3>
      <p className="mt-1 text-sm leading-6 text-muted-foreground">
        Add-ons are reserved for a future local extension model. Developer Tools use visible
        WinGet commands, but Cortex still does not load third-party plugin code or include paid marketplace logic.
      </p>
      <div className="mt-5 grid gap-3 md:grid-cols-2">
        <div className="rounded-md border border-border bg-card/55 p-4"><div className="mb-2 flex items-center gap-2 text-sm font-medium"><Building2 className={cn("h-4 w-4", officeEnabled ? "text-cortex-green" : "text-muted-foreground")} />Office View · {OFFICE_VIEW_ADDON_ENABLED && officeEnabled ? "Enabled" : "Disabled"}</div><p className="text-xs leading-5 text-muted-foreground">Built-in visualization for agents across all projects. Disabling it removes Office controls and closes the active Office view.</p><Button className="mt-4" size="sm" variant={officeEnabled ? "outline" : "default"} disabled={!OFFICE_VIEW_ADDON_ENABLED} onClick={() => setFeatureFlag("officeViewEnabled", !officeEnabled)}>{officeEnabled ? "Disable add-on" : "Enable add-on"}</Button></div>
        <InfoCard
          icon={<Puzzle className="h-4 w-4 text-primary" />}
          title="No plugin runtime"
          text="There is no execution path for marketplace code in this version."
        />
        <InfoCard
          icon={<Lightbulb className="h-4 w-4 text-primary" />}
          title="Request add-ons"
          text="Use the Feedback tab to suggest add-ons and templates for future versions."
        />
        <InfoCard
          icon={<Bug className="h-4 w-4 text-primary" />}
          title="No background upload"
          text="Feedback opens a browser page. Cortex does not submit issues automatically."
        />
      </div>
    </div>
  );
}

function InfoCard({ icon, title, text }: { icon: ReactNode; title: string; text: string }) {
  return (
    <div className="rounded-md border border-border bg-card/55 p-4">
      <div className="mb-2 flex items-center gap-2 text-sm font-medium">
        {icon}
        {title}
      </div>
      <p className="text-xs leading-5 text-muted-foreground">{text}</p>
    </div>
  );
}
