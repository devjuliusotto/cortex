import type { OfficeAgentModel, OfficeGitSummary, OfficeKanbanCard, OfficeSummary } from "../officeTypes";
import { OfficeViewport } from "./OfficeViewport";
import { OfficeWorld } from "./OfficeWorld";
import "../office-map.css";

type Props = {
  agents: OfficeAgentModel[];
  workspaceName: string;
  showWorkspaceLabels: boolean;
  summary: OfficeSummary;
  cards: OfficeKanbanCard[];
  git: OfficeGitSummary;
  onAgentSelect: (id: string) => void;
  onTerminalOpen: (id: string) => void;
  onBossSelect: () => void;
};

export function OfficeStage(props: Props) {
  return (
    <OfficeViewport>
      <OfficeWorld {...props} />
    </OfficeViewport>
  );
}
