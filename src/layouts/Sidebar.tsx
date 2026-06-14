import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderTree,
  Bot,
  AlertCircle,
  Gauge,
  UsersRound,
  Package,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CortexLogo } from "@/components/CortexLogo";
import { AgentUsageBar } from "@/features/agents/AgentUsageBar";
import { WorkspaceList } from "@/features/workspace/components/WorkspaceList";
import { cn } from "@/lib/utils";
import { useAgentInsights } from "@/features/agents/agentInsightsStore";
import { useCortexStore } from "@/stores/cortexStore";

type SidebarProps = {
  activeView: "workspace" | "office" | "my-agents";
  collapsed: boolean;
  officeActive: boolean;
  officeAvailable: boolean;
  onOfficeOpen: () => void;
  onSavedCommandsOpen: () => void;
  onMarketplaceOpen: () => void;
  onMyAgentsOpen: () => void;
  onOfficeOpen: () => void;
  onSettingsOpen: () => void;
  onToggle: () => void;
  onWorkspaceOpen: () => void;
};

<<<<<<< HEAD
export function Sidebar({
  collapsed,
  officeActive,
  officeAvailable,
  onOfficeOpen,
  onMarketplaceOpen,
  onSavedCommandsOpen,
  onSettingsOpen,
  onToggle,
}: SidebarProps) {
=======
export function Sidebar({ activeView, collapsed, onMarketplaceOpen, onMyAgentsOpen, onOfficeOpen, onSettingsOpen, onToggle, onWorkspaceOpen }: SidebarProps) {
  const insights = useAgentInsights();
  const officeViewEnabled = useCortexStore((state) => state.settings.officeViewEnabled);
  const waitingCount = insights.filter((item) => item.waitingForAuthorization).length;
  const totalTokens = insights.reduce((sum, item) => sum + (item.usage.totalTokens ?? 0), 0);
>>>>>>> 9fb1c27 (add my-agents)
  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 288 }}
      className="relative flex h-full shrink-0 flex-col border-r border-border bg-card/95"
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        <div className={cn("flex items-center gap-[var(--cortex-brand-text-gap)] overflow-hidden", collapsed && "justify-center")}>
          <CortexLogo className="h-8 w-8 shrink-0 rounded-md shadow-glow" />
          {!collapsed && (
            <div className="min-w-0 leading-none">
              <div className="truncate text-sm font-semibold">Cortex</div>
              <div className="mt-1.5 text-[11px] text-muted-foreground">Workspaces locais</div>
            </div>
          )}
        </div>
        <Button size="icon" variant="ghost" onClick={onToggle} title="Toggle sidebar">
          {collapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronLeft className="h-4 w-4" />}
        </Button>
      </div>

      {collapsed ? (
        <nav className="flex-1 p-3">
          <button
            className="flex h-10 w-full items-center justify-center rounded-md bg-secondary text-foreground shadow-glow"
            onClick={onWorkspaceOpen}
            type="button"
            title="Workspaces"
          >
            <FolderTree className="h-4 w-4" />
          </button>
        </nav>
      ) : (
        <WorkspaceList onWorkspaceOpen={onWorkspaceOpen} />
      )}

      <div className="border-t border-border p-3">
<<<<<<< HEAD
        <AgentUsageBar collapsed={collapsed} />
        {officeAvailable && <button
          className={cn(
            "mb-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            officeActive && "bg-secondary text-foreground shadow-glow",
            collapsed && "justify-center px-0",
          )}
          onClick={onOfficeOpen}
          type="button"
          title={officeActive ? "Switch to Terminal View" : "Switch to Office View"}
        >
          <Building2 className="h-4 w-4 shrink-0" />
          {!collapsed && <span>{officeActive ? "Terminal View" : "Office View"}</span>}
        </button>}
        <button
          className={cn(
            "mb-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
          onClick={onSavedCommandsOpen}
          type="button"
          title="Comandos salvos"
        >
          <ClipboardList className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Comandos salvos</span>}
        </button>
=======
        <button className={cn("mb-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground", collapsed && "justify-center px-0", activeView === "my-agents" && "bg-secondary text-foreground shadow-glow")} onClick={onMyAgentsOpen} type="button" title="My Agents">
          <UsersRound className="h-4 w-4 shrink-0" />
          {!collapsed && <span>My Agents</span>}
        </button>
        {officeViewEnabled && (
          <button className={cn("mb-1 flex min-h-10 w-full items-center gap-3 rounded-md px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground", collapsed && "justify-center px-0", activeView === "office" && "bg-secondary text-foreground shadow-glow")} onClick={onOfficeOpen} type="button" title="Office View">
            <Bot className="h-4 w-4 shrink-0" />
            {!collapsed && <span className="flex min-w-0 flex-1 items-center justify-between"><span>Office View</span>{waitingCount > 0 && <span className="flex items-center gap-1 rounded bg-cortex-amber/15 px-1.5 py-0.5 text-[10px] text-cortex-amber"><AlertCircle className="h-3 w-3" />{waitingCount}</span>}</span>}
          </button>
        )}
        {!collapsed && insights.length > 0 && <div className="mb-2 rounded-md border border-border bg-background/45 p-2.5"><div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wide text-muted-foreground"><Gauge className="h-3 w-3" />Uso reportado</div><div className="mt-1.5 text-sm font-medium">{totalTokens ? `${new Intl.NumberFormat().format(totalTokens)} tokens` : "Tokens não reportados"}</div><div className="mt-1 truncate text-[10px] text-muted-foreground">{insights.find((item) => item.usage.credits)?.usage.credits ?? "Créditos/quota não reportados"}</div></div>}
>>>>>>> 9fb1c27 (add my-agents)
        <button
          className={cn(
            "mb-1 flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
          onClick={onMarketplaceOpen}
          type="button"
          title="Marketplace"
        >
          <Package className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Marketplace</span>}
        </button>
        <button
          className={cn(
            "flex h-10 w-full items-center gap-3 rounded-md px-3 text-sm text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
            collapsed && "justify-center px-0",
          )}
          onClick={onSettingsOpen}
          type="button"
          title="Settings"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </motion.aside>
  );
}
