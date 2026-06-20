import { ChevronDown, ChevronRight } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  MDR_PIP_CLASS,
  MDR_PIP_GLYPH,
  MDR_STATE_LABEL,
  getMdrProgressTooltipLines,
  summarizeGroupState,
  type MdrPipCell,
  type MdrProgressIconCells,
  type MdrMilestoneState,
} from "@/lib/mdr/progressIcon";

export type CollapsedGroups = { dd: boolean; cd: boolean };
export type ProgressGroup = "dd" | "cd";

function Pip({ state, glyph, title }: { state: MdrMilestoneState; glyph?: string; title?: string }) {
  return (
    <span
      title={title}
      className={cn(
        "inline-flex h-4 w-4 items-center justify-center rounded-full border text-[9px] leading-none font-medium select-none",
        MDR_PIP_CLASS[state],
      )}
    >
      {glyph ?? MDR_PIP_GLYPH[state]}
    </span>
  );
}

function Connector() {
  return <span className="inline-block h-px w-1.5 bg-border/70" aria-hidden />;
}

function GroupDivider() {
  return <span className="mx-1 inline-block h-3 w-px bg-border" aria-hidden />;
}

interface CellProps {
  cells: MdrProgressIconCells;
  asOf: string;
  collapsed: CollapsedGroups;
  onToggleGroup?: (g: ProgressGroup) => void;
}

export function MdrProgressIconCell({ cells, asOf, collapsed, onToggleGroup }: CellProps) {
  const tooltipLines = getMdrProgressTooltipLines(cells, asOf);

  const renderGroup = (group: ProgressGroup, list: MdrPipCell[]) => {
    if (collapsed[group]) {
      const state = summarizeGroupState(list);
      return (
        <button
          type="button"
          onClick={(e) => { e.stopPropagation(); onToggleGroup?.(group); }}
          className="inline-flex items-center gap-0.5 hover:opacity-80"
          title={`${group.toUpperCase()} (${MDR_STATE_LABEL[state]}) — 클릭하여 펼치기`}
        >
          <Pip state={state} />
          <span className="text-[9px] text-muted-foreground uppercase">{group}</span>
          <ChevronRight className="h-2.5 w-2.5 text-muted-foreground" />
        </button>
      );
    }
    return (
      <span className="inline-flex items-center">
        {list.map((c, i) => (
          <span key={c.label} className="inline-flex items-center">
            {i > 0 && <Connector />}
            <Pip state={c.state} title={c.label} />
          </span>
        ))}
      </span>
    );
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Tooltip>
        <TooltipTrigger asChild>
          <div
            className="inline-flex items-center select-none"
            onClick={(e) => e.stopPropagation()}
          >
            <Pip state={cells.sd.state} title="SD" />
            <GroupDivider />
            {renderGroup("dd", cells.dd)}
            <GroupDivider />
            {renderGroup("cd", cells.cd)}
          </div>
        </TooltipTrigger>
        <TooltipContent side="top" className="font-mono text-[10px] whitespace-pre">
          {tooltipLines.join("\n")}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/** 컬럼 헤더: 그룹별 접기/펼치기 토글 */
export function MdrProgressIconHeader({
  collapsed,
  onToggleGroup,
}: {
  collapsed: CollapsedGroups;
  onToggleGroup: (g: ProgressGroup) => void;
}) {
  const Toggle = ({ g }: { g: ProgressGroup }) => {
    const Icon = collapsed[g] ? ChevronRight : ChevronDown;
    return (
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); onToggleGroup(g); }}
        className="inline-flex items-center gap-0.5 rounded px-1 text-[10px] font-medium hover:bg-muted"
        title={`${g.toUpperCase()} ${collapsed[g] ? "펼치기" : "접기"}`}
      >
        {g.toUpperCase()}
        <Icon className="h-2.5 w-2.5" />
      </button>
    );
  };

  return (
    <span className="inline-flex items-center gap-0.5 text-[10px]">
      <span className="px-1 font-medium">Progress</span>
      <span className="text-muted-foreground">·</span>
      <span className="px-1">SD</span>
      <Toggle g="dd" />
      <Toggle g="cd" />
    </span>
  );
}

/** Legend */
export function MdrProgressIconLegend() {
  const items: MdrMilestoneState[] = ["done", "wip", "planned", "delay"];
  return (
    <div className="inline-flex items-center gap-2 text-[10px] text-muted-foreground">
      {items.map((s) => (
        <span key={s} className="inline-flex items-center gap-1">
          <Pip state={s} />
          {MDR_STATE_LABEL[s]}
        </span>
      ))}
    </div>
  );
}
