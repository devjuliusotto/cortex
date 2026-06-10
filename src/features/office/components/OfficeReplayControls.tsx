import { Play, Square } from "lucide-react";
import { Button } from "@/components/ui/button";

export function OfficeReplayControls({ replaying, onPlay, onStop }: { replaying: boolean; onPlay: () => void; onStop: () => void }) {
  return replaying ? <Button className="border-cortex-red/50 text-cortex-red hover:bg-cortex-red/10" size="sm" variant="outline" onClick={onStop}><Square className="mr-2 h-3.5 w-3.5" />Return Live</Button> : <Button size="sm" variant="outline" onClick={onPlay}><Play className="mr-2 h-3.5 w-3.5" />Replay</Button>;
}
