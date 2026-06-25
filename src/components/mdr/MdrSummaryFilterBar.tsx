import { Card } from "@/components/ui/card";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { RotateCcw } from "lucide-react";
import { TEAMS, TEAM_LABEL, DISCIPLINES_BY_TEAM, type TeamCode } from "@/lib/mdr/weights";

export interface SummaryFilterState {
  building: string;   // 'all' or code
  team: string;       // 'all' or TeamCode
  discipline: string; // 'all' or discipline code
}

const ALL_DISCIPLINES: { code: string; team: TeamCode }[] = TEAMS.flatMap((t) =>
  DISCIPLINES_BY_TEAM[t].map((d) => ({ code: d, team: t })),
);

interface Props {
  buildings: string[];
  value: SummaryFilterState;
  onChange: (next: SummaryFilterState) => void;
}

export function MdrSummaryFilterBar({ buildings, value, onChange }: Props) {
  const reset = () => onChange({ building: "all", team: "all", discipline: "all" });

  // 활성 Discipline 목록: Team 선택 시 해당 팀 소속만 노출
  const discList = value.team === "all"
    ? ALL_DISCIPLINES
    : ALL_DISCIPLINES.filter((d) => d.team === (value.team as TeamCode));

  const handleTeam = (next: string) => {
    // Team이 바뀌면 호환되지 않는 Discipline은 reset
    const stillValid = value.discipline === "all"
      || next === "all"
      || (TEAMS.includes(next as TeamCode) &&
          DISCIPLINES_BY_TEAM[next as TeamCode].includes(value.discipline));
    onChange({
      ...value,
      team: next,
      discipline: stillValid ? value.discipline : "all",
    });
  };

  const handleDiscipline = (next: string) => {
    // Discipline 선택 시 Team도 자동 동기화
    if (next === "all") {
      onChange({ ...value, discipline: "all" });
      return;
    }
    const team = ALL_DISCIPLINES.find((d) => d.code === next)?.team ?? "all";
    onChange({ ...value, discipline: next, team });
  };

  return (
    <Card className="p-3">
      <div className="flex flex-col gap-2">
        <ToolbarGroup label="Building">
          <Tabs value={value.building} onValueChange={(v) => onChange({ ...value, building: v })}>
            <TabsList className="h-8 flex-wrap">
              <TabsTrigger value="all" className="h-6 px-2 text-xs">All</TabsTrigger>
              {buildings.map((b) => (
                <TabsTrigger key={b} value={b} className="h-6 px-2 text-xs">{b === "GEN" ? "GENERAL" : b}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </ToolbarGroup>

        <ToolbarGroup label="Team">
          <Tabs value={value.team} onValueChange={handleTeam}>
            <TabsList className="h-8 flex-wrap">
              <TabsTrigger value="all" className="h-6 px-2 text-xs">All</TabsTrigger>
              {TEAMS.map((t) => (
                <TabsTrigger key={t} value={t} className="h-6 px-2 text-xs">{TEAM_LABEL[t]}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </ToolbarGroup>

        <ToolbarGroup label="Discipline">
          <Tabs value={value.discipline} onValueChange={handleDiscipline}>
            <TabsList className="h-8 flex-wrap">
              <TabsTrigger value="all" className="h-6 px-2 text-xs">All</TabsTrigger>
              {discList.map((d) => (
                <TabsTrigger key={d.code} value={d.code} className="h-6 px-2 text-xs">{d.code}</TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Button variant="ghost" size="sm" onClick={reset} className="h-7 text-xs ml-auto">
            <RotateCcw className="h-3 w-3 mr-1" />초기화
          </Button>
        </ToolbarGroup>
      </div>
    </Card>
  );
}

function ToolbarGroup({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex w-full items-center gap-2">
      <span className="text-[11px] font-medium text-muted-foreground min-w-[72px]">{label}</span>
      <div className="flex flex-1 items-center gap-2 flex-wrap">{children}</div>
    </div>
  );
}
