import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useMdrSummary, STAGE_MILESTONE_PCTS } from "@/lib/mdr/summaryEngine";
import type { BlockSummary, StageCell, MilestoneCell, TeamCell } from "@/lib/mdr/summaryEngine";
import { TEAM_LABEL, type StageCode } from "@/lib/mdr/weights";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Settings2, ChevronDown, ChevronRight } from "lucide-react";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
function pct0(n: number): string {
  return `${Math.round(n * 100)}%`;
}

function CountCell({ count, ratio, total }: { count: number; ratio: number; total: number }) {
  if (total === 0) return <span className="text-muted-foreground">-</span>;
  return (
    <span className="tabular-nums">
      <span className="font-medium">{count}</span>
      <span className="text-[9px] text-muted-foreground ml-0.5">({pct0(ratio)})</span>
    </span>
  );
}

function MilestoneCellView({ mc, total }: { mc: MilestoneCell; total: number }) {
  if (total === 0) return <td className="text-center px-1 py-0.5 text-muted-foreground">-</td>;
  const ahead = mc.actualCount >= mc.planCount && mc.planCount > 0;
  const behind = mc.actualCount < mc.planCount;
  return (
    <td className="text-center px-1 py-0.5 tabular-nums">
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={
                mc.actualCount > 0
                  ? ahead
                    ? "text-primary font-medium"
                    : behind
                      ? "text-orange-500"
                      : ""
                  : "text-muted-foreground"
              }
            >
              {pct0(mc.actualRatio)}
            </span>
          </TooltipTrigger>
          <TooltipContent className="text-[10px]">
            Plan: {mc.planCount}/{total} ({pct0(mc.planRatio)})<br />
            Actual: {mc.actualCount}/{total} ({pct0(mc.actualRatio)})
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </td>
  );
}

function StageGroup({
  stage,
  cell,
  expanded,
}: {
  stage: StageCode;
  cell: StageCell;
  expanded: boolean;
}) {
  return (
    <>
      <td className="text-center px-2 py-0.5 border-l">
        <CountCell count={cell.planCount} ratio={cell.plan} total={cell.drawingCount} />
      </td>
      <td className="text-center px-2 py-0.5">
        <CountCell count={cell.actualCount} ratio={cell.actual} total={cell.drawingCount} />
      </td>
      <td className="text-center px-2 py-0.5 tabular-nums text-primary">
        {cell.drawingCount > 0 ? pct(cell.progress) : "-"}
      </td>
      {expanded &&
        cell.milestones.map((mc) => (
          <MilestoneCellView key={`${stage}-${mc.pct}`} mc={mc} total={cell.drawingCount} />
        ))}
    </>
  );
}

function BlockRows({
  block,
  expanded,
}: {
  block: BlockSummary;
  expanded: Record<StageCode, boolean>;
}) {
  const dim = !block.contributesToOverall;
  let badge: { label: string; className: string } | null = null;
  if (!block.inMaster) {
    badge = { label: "마스터 미등록", className: "text-[10px] w-fit border-destructive text-destructive" };
  } else if (!block.hasDrawings) {
    badge = { label: "도면 없음", className: "text-[10px] w-fit text-muted-foreground" };
  } else if (dim) {
    badge = { label: "합산 제외", className: "text-[10px] w-fit" };
  }

  // 행 수 계산: 각 팀의 discipline 개수 합 + 팀 소계 행 1개씩 + Block Sub-total 1
  const blockRowSpan =
    block.teams.reduce((a, t) => a + t.disciplines.length + 1, 0) + 1;

  const out: JSX.Element[] = [];
  let isFirstRow = true;

  for (const team of block.teams) {
    const teamRowSpan = team.disciplines.length + 1; // disciplines + team sub-total

    team.disciplines.forEach((c, dIdx) => {
      out.push(
        <tr
          key={`${block.building}-${team.team}-${c.discipline}`}
          className={`border-b hover:bg-muted/30 ${dim ? "opacity-50" : ""}`}
        >
          {isFirstRow && (
            <td
              rowSpan={blockRowSpan}
              className="px-2 py-0.5 sticky left-0 bg-background font-semibold align-top border-r"
            >
              <div className="flex flex-col gap-0.5">
                <span>{block.building}</span>
                {badge ? (
                  <Badge variant="outline" className={badge.className}>{badge.label}</Badge>
                ) : (
                  <span className="text-[10px] text-muted-foreground">WF {pct(block.buildingWf)}</span>
                )}
              </div>
            </td>
          )}
          {dIdx === 0 && (
            <td
              rowSpan={teamRowSpan}
              className="px-2 py-0.5 font-medium align-top border-r bg-muted/10"
            >
              {TEAM_LABEL[team.team]}
            </td>
          )}
          <td className="px-2 py-0.5">
            <span className="inline-flex items-center gap-1">
              {c.discipline}
              {(c.discipline === "FP" || c.discipline === "FA") && (
                <TooltipProvider delayDuration={150}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Badge variant="outline" className="text-[9px] py-0 px-1 h-4">FAFP WF</Badge>
                    </TooltipTrigger>
                    <TooltipContent className="text-[10px]">
                      소방 전용 Stage WF: SD 0% / DD 50% / CD 50%
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </span>
          </td>
          <td className="text-center px-2 py-0.5 tabular-nums">
            {c.drawingCount > 0 ? c.drawingCount : "-"}
          </td>
          <StageGroup stage="SD" cell={c.sd} expanded={expanded.SD} />
          <StageGroup stage="DD" cell={c.dd} expanded={expanded.DD} />
          <StageGroup stage="CD" cell={c.cd} expanded={expanded.CD} />
          <td className="text-center px-2 py-0.5 border-l font-medium tabular-nums">
            {c.drawingCount > 0 ? pct(c.discProgress) : "-"}
          </td>
        </tr>,
      );
      isFirstRow = false;
    });

    // Team sub-total row
    out.push(
      <tr key={`${block.building}-${team.team}-subtotal`} className={`border-b bg-muted/20 ${dim ? "opacity-50" : ""}`}>
        <td className="px-2 py-0.5 text-[11px] font-semibold text-muted-foreground">
          {TEAM_LABEL[team.team]} 소계
        </td>
        <td className="text-center px-2 py-0.5 tabular-nums">
          {team.drawingCount > 0 ? team.drawingCount : "-"}
        </td>
        <StageGroup stage="SD" cell={team.sd} expanded={expanded.SD} />
        <StageGroup stage="DD" cell={team.dd} expanded={expanded.DD} />
        <StageGroup stage="CD" cell={team.cd} expanded={expanded.CD} />
        <td className="text-center px-2 py-0.5 border-l font-semibold tabular-nums text-primary">
          {team.drawingCount > 0 ? pct(team.teamProgress) : "-"}
        </td>
      </tr>,
    );
  }

  // 팀이 비어있으면 빈 행 1개 (Block 셀 + placeholder)
  if (block.teams.length === 0) {
    out.push(
      <tr key={`${block.building}-empty`} className="border-b opacity-50">
        <td className="px-2 py-0.5 sticky left-0 bg-background font-semibold border-r">{block.building}</td>
        <td className="px-2 py-0.5 text-muted-foreground" colSpan={3 + 9 + 1}>도면 없음</td>
      </tr>,
    );
    return out;
  }

  // Block Sub-total
  out.push(
    <tr key={`${block.building}-blocksubtotal`} className={`border-b-2 bg-muted/40 ${dim ? "opacity-50" : ""}`}>
      <td className="px-2 py-0.5 text-[11px] font-bold" colSpan={2}>Block 합계</td>
      <td className="text-center px-2 py-0.5 tabular-nums">
        {block.drawingCount > 0 ? block.drawingCount : "-"}
      </td>
      <StageGroup stage="SD" cell={block.totals.sd} expanded={expanded.SD} />
      <StageGroup stage="DD" cell={block.totals.dd} expanded={expanded.DD} />
      <StageGroup stage="CD" cell={block.totals.cd} expanded={expanded.CD} />
      <td className="text-center px-2 py-0.5 border-l font-bold tabular-nums text-primary">
        {block.drawingCount > 0 ? pct(block.blockProgress) : "-"}
      </td>
    </tr>,
  );

  return out;
}

function StageHeader({
  stage,
  expanded,
  onToggle,
}: {
  stage: StageCode;
  expanded: boolean;
  onToggle: () => void;
}) {
  const cols = 3 + (expanded ? STAGE_MILESTONE_PCTS[stage].length : 0);
  const Icon = expanded ? ChevronDown : ChevronRight;
  return (
    <th colSpan={cols} className="text-center px-2 py-0.5 border-l">
      <button
        type="button"
        onClick={onToggle}
        className="inline-flex items-center gap-1 hover:text-primary"
        title={expanded ? "마일스톤 접기" : "마일스톤 펼치기"}
      >
        {stage}
        <Icon className="h-3 w-3" />
      </button>
    </th>
  );
}

export function MdrSummaryPanel() {
  const { data: rawSummary, isLoading } = useMdrSummary();
  const [expanded, setExpanded] = useState<Record<StageCode, boolean>>({
    SD: false,
    DD: false,
    CD: false,
  });
  const toggle = (s: StageCode) => setExpanded((p) => ({ ...p, [s]: !p[s] }));

  const summary = rawSummary;

  if (isLoading) return <div className="text-muted-foreground p-6">SUMMARY 계산 중...</div>;
  if (!rawSummary || rawSummary.blocks.length === 0) {
    return (
      <Card className="p-8 text-center text-muted-foreground">
        Raw Data가 없습니다. 먼저 MDR 엑셀을 임포트하세요.
      </Card>
    );
  }

  const renderStageSubHeaders = (stage: StageCode) => {
    return (
      <>
        <th key={`${stage}-p`} className="text-center px-2 py-0.5 border-l font-normal">Plan</th>
        <th key={`${stage}-a`} className="text-center px-2 py-0.5 font-normal">Actual</th>
        <th key={`${stage}-pct`} className="text-center px-2 py-0.5 font-normal">%</th>
        {expanded[stage] &&
          STAGE_MILESTONE_PCTS[stage].map((m) => (
            <th key={`${stage}-m${m}`} className="text-center px-1 py-0.5 font-normal text-[10px]">
              {stage}{m}%
            </th>
          ))}
      </>
    );
  };

  return (
    <div className="space-y-3">

      <Card className="p-3">
        <div className="flex items-center justify-between mb-2">
          <h3 className="font-semibold text-sm">Block × Team × Discipline × Stage 매트릭스</h3>
          <div className="text-[10px] text-muted-foreground">
            기준일: <span className="tabular-nums">{rawSummary.dataDate}</span> · Plan/Actual은 도면 수(비율)
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[11px] border-collapse">
            <thead>
              <tr className="border-b">
                <th rowSpan={2} className="text-left px-2 py-0.5 sticky left-0 bg-background border-r">Block</th>
                <th rowSpan={2} className="text-left px-2 py-0.5 border-r">Team</th>
                <th rowSpan={2} className="text-left px-2 py-0.5">Disc.</th>
                <th rowSpan={2} className="text-center px-2 py-0.5">DWG</th>
                <StageHeader stage="SD" expanded={expanded.SD} onToggle={() => toggle("SD")} />
                <StageHeader stage="DD" expanded={expanded.DD} onToggle={() => toggle("DD")} />
                <StageHeader stage="CD" expanded={expanded.CD} onToggle={() => toggle("CD")} />
                <th rowSpan={2} className="text-center px-2 py-0.5 border-l">Progress</th>
              </tr>
              <tr className="border-b text-muted-foreground">
                {renderStageSubHeaders("SD")}
                {renderStageSubHeaders("DD")}
                {renderStageSubHeaders("CD")}
              </tr>
            </thead>
            <tbody>
              {(summary?.blocks ?? []).map((b) => (
                <BlockRows key={b.building} block={b} expanded={expanded} />
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {/* WF 참조 — 컴팩트 (접이식) */}
      <Collapsible>
        <Card className="px-3 py-2">
          <div className="flex items-center justify-between gap-2">
            <CollapsibleTrigger className="flex items-center gap-2 text-xs text-muted-foreground hover:text-foreground">
              <ChevronDown className="h-3 w-3 transition-transform data-[state=open]:rotate-180" />
              <span>Weight Factor 참조</span>
              <span className="hidden sm:inline tabular-nums">
                · Stage SD/DD/CD {pct(rawSummary.wf.stage.SD)}/{pct(rawSummary.wf.stage.DD)}/{pct(rawSummary.wf.stage.CD)} · FAFP(FP/FA) 전용 0%/50%/50%
              </span>
            </CollapsibleTrigger>
            <Button variant="ghost" size="sm" asChild className="h-7 text-xs">
              <Link to="/admin"><Settings2 className="h-3 w-3 mr-1" />수정</Link>
            </Button>
          </div>
          <CollapsibleContent>
            <div className="grid gap-3 md:grid-cols-3 mt-3 text-xs">
              <div>
                <div className="font-medium text-muted-foreground mb-1">Stage WF</div>
                {(["SD", "DD", "CD"] as const).map((s) => (
                  <div key={s} className="flex justify-between border-b py-0.5">
                    <span>{s}</span>
                    <span className="tabular-nums">{pct(rawSummary.wf.stage[s])}</span>
                  </div>
                ))}
                <div className="flex justify-between border-b py-0.5 text-[10px] text-muted-foreground italic">
                  <span>FAFP(FP/FA) 전용</span>
                  <span className="tabular-nums">0% / 50% / 50%</span>
                </div>
              </div>
              <div>
                <div className="font-medium text-muted-foreground mb-1">Team WF</div>
                {(["ARCH", "CIVIL", "STR", "MECH", "ELEC"] as const).map((t) => (
                  <div key={t} className="flex justify-between border-b py-0.5">
                    <span>{TEAM_LABEL[t]}</span>
                    <span className="tabular-nums">{pct(rawSummary.wf.discipline[t] ?? 0)}</span>
                  </div>
                ))}
              </div>
              <div>
                <div className="font-medium text-muted-foreground mb-1">Building WF</div>
                {Object.entries(rawSummary.wf.building).map(([b, w]) => (
                  <div key={b} className="flex justify-between border-b py-0.5">
                    <span>{b}</span>
                    <span className="tabular-nums">{pct(w)}</span>
                  </div>
                ))}
              </div>
            </div>
          </CollapsibleContent>
        </Card>
      </Collapsible>
    </div>
  );
}
