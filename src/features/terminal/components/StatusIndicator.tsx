import { cn } from "@/lib/utils";
import type { SessionStatus } from "@/stores/cortexStore";

const statusStyles: Record<SessionStatus, string> = {
  inactive: "bg-muted-foreground/45",
  running: "bg-cortex-green shadow-[0_0_12px_rgb(122_247_166_/_0.55)]",
  waiting: "bg-cortex-amber shadow-[0_0_12px_rgb(255_203_107_/_0.45)]",
  completed: "bg-cortex-cyan shadow-[0_0_12px_rgb(86_240_255_/_0.45)]",
  error: "bg-cortex-red shadow-[0_0_12px_rgb(255_107_129_/_0.55)]",
};

type StatusIndicatorProps = {
  status: SessionStatus;
  className?: string;
};

export function StatusIndicator({ status, className }: StatusIndicatorProps) {
  return (
    <span
      aria-label={status}
      className={cn("h-2 w-2 rounded-full", statusStyles[status], className)}
      title={status}
    />
  );
}
