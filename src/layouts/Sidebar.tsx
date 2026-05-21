import {
  ChevronLeft,
  ChevronRight,
  FolderTree,
  Package,
  Settings,
  TerminalSquare,
} from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { WorkspaceList } from "@/features/workspace/components/WorkspaceList";
import { cn } from "@/lib/utils";

type SidebarProps = {
  collapsed: boolean;
  onMarketplaceOpen: () => void;
  onToggle: () => void;
};

export function Sidebar({ collapsed, onMarketplaceOpen, onToggle }: SidebarProps) {
  return (
    <motion.aside
      animate={{ width: collapsed ? 76 : 288 }}
      className="relative flex h-full shrink-0 flex-col border-r border-border bg-card/95"
      transition={{ duration: 0.2, ease: "easeOut" }}
    >
      <div className="flex h-14 items-center justify-between border-b border-border px-3">
        <div className={cn("flex items-center gap-3 overflow-hidden", collapsed && "justify-center")}>
          <div className="grid h-8 w-8 shrink-0 place-items-center rounded-md border border-primary/30 bg-primary/10 shadow-glow">
            <TerminalSquare className="h-4 w-4 text-primary" />
          </div>
          {!collapsed && (
              <div className="min-w-0">
                <div className="truncate text-sm font-semibold tracking-wide">Cortex</div>
              <div className="text-[11px] text-muted-foreground">Local terminal manager</div>
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
          type="button"
        >
          <Settings className="h-4 w-4 shrink-0" />
          {!collapsed && <span>Settings</span>}
        </button>
      </div>
    </motion.aside>
  );
}
