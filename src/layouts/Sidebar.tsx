import {
  Building2,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  FolderTree,
  Package,
  Settings,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { CortexLogo } from "@/components/CortexLogo";
import { WorkspaceList } from "@/features/workspace/components/WorkspaceList";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  officeActive: boolean;
  officeAvailable: boolean;
  onOfficeOpen: () => void;
  onSavedCommandsOpen: () => void;
  onMarketplaceOpen: () => void;
  onSettingsOpen: () => void;
  onToggle: () => void;
};

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
            type="button"
            title="Workspaces"
          >
            <FolderTree className="h-4 w-4" />
          </button>
        </nav>
      ) : (
        <WorkspaceList />
      )}

      <div className="border-t border-border p-3">
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
