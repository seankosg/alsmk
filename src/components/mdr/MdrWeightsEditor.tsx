import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { useEffect, useState } from "react";
import {
  DEFAULT_BUILDING_WF,
  DEFAULT_TEAM_WF,
  DEFAULT_STAGE_WF,
  TEAMS,
  loadMdrWeights,
  type StageCode,
} from "@/lib/mdr/weights";
import { RotateCcw, Save } from "lucide-react";

type Scope = "stage" | "discipline" | "building";

interface DraftRow {
  scope: Scope;
  key: string;        // 'SD' | 'ARCH' | 'SMP&CCM'
  value: number;
}

export function MdrWeightsEditor() {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<DraftRow[]>([]);

  const { data: wf, isLoading } = useQuery({
    queryKey: ["mdr_wf_bundle"],
    queryFn: loadMdrWeights,
  });

  // wf 로드되면 draft 초기화
  useEffect(() => {
    if (!wf) return;
    const rows: DraftRow[] = [];
    for (const s of ["SD", "DD", "CD"] as StageCode[]) {
      rows.push({ scope: "stage", key: s, value: wf.stage[s] });
    }
    // Team WF만 노출 (DB는 discipline 컬럼에 TEAMS 키로 저장)
    for (const t of TEAMS) {
      rows.push({ scope: "discipline", key: t, value: wf.discipline[t] ?? 0 });
    }
    const bldKeys = new Set([...Object.keys(DEFAULT_BUILDING_WF), ...Object.keys(wf.building)]);
    for (const b of bldKeys) {
      rows.push({ scope: "building", key: b, value: wf.building[b] ?? 0 });
    }
    setDraft(rows);
  }, [wf]);

  const save = useMutation({
    mutationFn: async (rows: DraftRow[]) => {
      // 기존 non-reference WF 모두 삭제 후 재삽입 (NULL unique 회피)
      await (supabase.from("mdr_weights" as never) as any)
        .delete()
        .eq("is_reference_only", false);

      const payload = rows
        .filter((r) => isFinite(r.value))
        .map((r) => {
          if (r.scope === "stage") {
            return { building_code: null, discipline: null, stage: r.key, weight: r.value, is_reference_only: false };
          }
          if (r.scope === "discipline") {
            return { building_code: null, discipline: r.key, stage: null, weight: r.value, is_reference_only: false };
          }
          return { building_code: r.key, discipline: null, stage: null, weight: r.value, is_reference_only: false };
        });
      if (payload.length === 0) return;
      const { error } = await supabase.from("mdr_weights" as never).insert(payload as any);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("가중치 저장됨");
      qc.invalidateQueries({ queryKey: ["mdr_wf_bundle"] });
      qc.invalidateQueries({ queryKey: ["mdr_summary_engine"] });
    },
    onError: (e: any) => toast.error(e.message ?? "저장 실패"),
  });

  const updateValue = (scope: Scope, key: string, v: number) => {
    setDraft((d) => d.map((r) => (r.scope === scope && r.key === key ? { ...r, value: v } : r)));
  };

  const resetDefaults = () => {
    const rows: DraftRow[] = [];
    for (const s of ["SD", "DD", "CD"] as StageCode[]) rows.push({ scope: "stage", key: s, value: DEFAULT_STAGE_WF[s] });
    for (const t of TEAMS) rows.push({ scope: "discipline", key: t, value: DEFAULT_TEAM_WF[t] });
    for (const [b, v] of Object.entries(DEFAULT_BUILDING_WF)) rows.push({ scope: "building", key: b, value: v });
    setDraft(rows);
    toast.info("기본값으로 되돌렸습니다. 저장 버튼을 눌러 반영하세요.");
  };

  if (isLoading) return <Card className="p-6 text-muted-foreground">로딩 중...</Card>;

  const stageRows = draft.filter((r) => r.scope === "stage");
  const discRows = draft.filter((r) => r.scope === "discipline");
  const bldRows = draft.filter((r) => r.scope === "building");

  const sum = (rows: DraftRow[]) => rows.reduce((a, r) => a + (isFinite(r.value) ? r.value : 0), 0);
  const stageSum = sum(stageRows);
  const discSum = sum(discRows);
  const bldSum = sum(bldRows);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold">SUMMARY 가중치 (WF) 편집</h3>
          <p className="text-xs text-muted-foreground">합계가 1.0이 되도록 조정하세요. 변경은 SUMMARY 진척률에 즉시 반영됩니다.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" onClick={resetDefaults}>
            <RotateCcw className="h-3.5 w-3.5 mr-1" />기본값
          </Button>
          <Button size="sm" onClick={() => save.mutate(draft)} disabled={save.isPending}>
            <Save className="h-3.5 w-3.5 mr-1" />저장
          </Button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <WfCard
          title="Stage WF"
          sumLabel={stageSum}
          rows={stageRows}
          onChange={(k, v) => updateValue("stage", k, v)}
        />
        <WfCard
          title="Team WF (Arch/Civil/STR/Mech/Elec)"
          sumLabel={discSum}
          rows={discRows}
          onChange={(k, v) => updateValue("discipline", k, v)}
        />
        <WfCard
          title="Building WF (공사비)"
          sumLabel={bldSum}
          rows={bldRows}
          onChange={(k, v) => updateValue("building", k, v)}
          note="WF=0인 건물은 Overall 합산에서 제외됩니다 (예: GEN 플랜트 업역)"
        />
      </div>
    </div>
  );
}

function WfCard({
  title, sumLabel, rows, onChange, note,
}: {
  title: string;
  sumLabel: number;
  rows: DraftRow[];
  onChange: (key: string, v: number) => void;
  note?: string;
}) {
  const ok = Math.abs(sumLabel - 1) < 0.001;
  return (
    <Card className="p-4">
      <div className="flex items-center justify-between mb-2">
        <h4 className="font-medium text-sm">{title}</h4>
        <Badge variant={ok ? "default" : "destructive"} className="text-[10px]">
          Σ = {(sumLabel * 100).toFixed(1)}%
        </Badge>
      </div>
      {note && <p className="text-[10px] text-muted-foreground mb-2">{note}</p>}
      <table className="w-full text-sm">
        <tbody>
          {rows.map((r) => (
            <tr key={r.key} className="border-b">
              <td className="py-1 font-medium">{r.key}</td>
              <td className="py-1">
                <Input
                  type="number"
                  step={0.01}
                  min={0}
                  max={1}
                  value={r.value}
                  onChange={(e) => onChange(r.key, parseFloat(e.target.value) || 0)}
                  className="h-8 w-24 ml-auto text-right tabular-nums"
                />
              </td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td className="text-muted-foreground text-xs py-2">없음</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}
