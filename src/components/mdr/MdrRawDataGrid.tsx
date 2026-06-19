import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { drawingStagePct } from "@/lib/mdr/progressEngine";
import type { MdrStage } from "@/lib/mdr/parser";

interface Props {
  buildingCode: string;
  asOf: string;
  threshold: number;
  sheetName?: string;
}

const DD_PCTS = [30, 60, 90, 100];
const CD_PCTS = [30, 60, 100];

export function MdrRawDataGrid({ buildingCode, asOf, threshold, sheetName }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["mdr_drawings", buildingCode, sheetName ?? null],
    queryFn: async () => {
      let q = supabase
        .from("mdr_drawings" as never)
        .select("*, mdr_milestones(*), mdr_progress(*)")
        .eq("building_code", buildingCode)
        .order("discipline")
        .order("source_no");
      if (sheetName) q = q.eq("source_sheet", sheetName);
      const { data: drawings, error } = await q;
      if (error) throw error;
      return (drawings as any[]) ?? [];
    },
  });

  const rows = useMemo(() => {
    return (data ?? []).map((d: any) => {
      const ms = d.mdr_milestones ?? [];
      const pg = d.mdr_progress ?? [];
      const sd = drawingStagePct(ms, pg, "SD", asOf);
      const dd = drawingStagePct(ms, pg, "DD", asOf);
      const cd = drawingStagePct(ms, pg, "CD", asOf);
      const overall = (sd.actual + dd.actual + cd.actual) / 3;
      // 단계별 P/A/Δ per pct
      const stageCell = (stage: MdrStage, pct: number) => {
        const m = ms.find((x: any) => x.stage === stage && x.pct === pct);
        const p = pg.find((x: any) => x.stage === stage && x.pct === pct);
        if (!m) return null;
        // 누계 계획률 비율 = 해당 pct까지의 incrementPct 합
        const stageMs = ms.filter((x: any) => x.stage === stage).sort((a: any, b: any) => a.pct - b.pct);
        let planned = 0;
        for (const sm of stageMs) {
          if (sm.pct > pct) break;
          if (!sm.plan_date) continue;
          if (new Date(sm.plan_date) <= new Date(asOf)) planned += Number(sm.increment_pct);
          else {
            // 일일 보간 (직전 마일스톤 plan_date 또는 −7일)
            const prev = stageMs.filter((x: any) => x.pct < sm.pct).pop();
            const prevDate = prev?.plan_date ? new Date(prev.plan_date).getTime() : new Date(sm.plan_date).getTime() - 7 * 86400000;
            const cur = new Date(sm.plan_date).getTime();
            const now = new Date(asOf).getTime();
            const ratio = Math.max(0, Math.min(1, (now - prevDate) / (cur - prevDate)));
            planned += Number(sm.increment_pct) * ratio;
            break;
          }
        }
        const actual = stage === "SD" ? 100 : (p?.is_done ? planned : 0); // 누계 단위로는 정확하지 않으나 셀 단위 표시용
        // 셀 단위 P/A/Δ — 표시 단순화: planned는 해당 pct 누계, actual은 done 여부
        const aShow = p?.is_done ? Number(m.increment_pct) : 0;
        const pShow = Number(m.increment_pct);
        return { p: pShow, a: aShow, delta: pShow - aShow, done: p?.is_done };
      };
      return { d, sd, dd, cd, overall, stageCell };
    });
  }, [data, asOf]);

  const deltaCls = (delta: number) => {
    if (delta <= 0) return "text-green-600";
    if (delta < threshold) return "text-yellow-500";
    return "text-destructive font-semibold";
  };

  if (isLoading) return <Card className="p-6 text-muted-foreground">로딩 중...</Card>;
  if (!rows.length) return <Card className="p-6 text-muted-foreground">데이터 없음</Card>;

  return (
    <Card className="overflow-auto">
      <table className="w-full text-xs">
        <thead className="bg-muted sticky top-0">
          <tr>
            <th className="px-2 py-1 text-left">No.</th>
            <th className="px-2 py-1 text-left">Building</th>
            <th className="px-2 py-1 text-left">Item No.</th>
            <th className="px-2 py-1 text-left">Discipline</th>
            <th className="px-2 py-1 text-left">Title</th>
            <th className="px-2 py-1 text-center">SD</th>
            <th className="px-2 py-1 text-center">DD</th>
            <th className="px-2 py-1 text-center">CD</th>
            {DD_PCTS.map((p) => (
              <th key={`dd${p}`} className="px-1 py-1 text-center border-l">DD{p} P/A/Δ</th>
            ))}
            {CD_PCTS.map((p) => (
              <th key={`cd${p}`} className="px-1 py-1 text-center border-l">CD{p} P/A/Δ</th>
            ))}
            <th className="px-2 py-1 text-right">DD%</th>
            <th className="px-2 py-1 text-right">CD%</th>
            <th className="px-2 py-1 text-right">Overall%</th>
            <th className="px-2 py-1 text-left">Plan</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(({ d, sd, dd, cd, overall, stageCell }: any) => (
            <tr key={d.id} className="border-t hover:bg-muted/30">
              <td className="px-2 py-1">{d.source_no}</td>
              <td className="px-2 py-1">{d.building_code}</td>
              <td className="px-2 py-1 font-mono">{d.item_no}</td>
              <td className="px-2 py-1">{d.discipline}</td>
              <td className="px-2 py-1 truncate max-w-[280px]" title={d.drawing_title}>{d.drawing_title}</td>
              <td className="px-2 py-1 text-center">O</td>
              <td className="px-2 py-1 text-center">{dd.planned + dd.actual > 0 ? "O" : "-"}</td>
              <td className="px-2 py-1 text-center">{cd.planned + cd.actual > 0 ? "O" : "-"}</td>
              {DD_PCTS.map((p) => {
                const c = stageCell("DD", p);
                if (!c) return <td key={`dd${p}`} className="px-1 py-1 text-center border-l text-muted-foreground">-</td>;
                return (
                  <td key={`dd${p}`} className="px-1 py-1 text-center border-l">
                    <span className="text-muted-foreground">{c.p.toFixed(0)}</span>/
                    <span>{c.a.toFixed(0)}</span>/
                    <span className={deltaCls(c.delta)}>{c.delta.toFixed(0)}</span>
                  </td>
                );
              })}
              {CD_PCTS.map((p) => {
                const c = stageCell("CD", p);
                if (!c) return <td key={`cd${p}`} className="px-1 py-1 text-center border-l text-muted-foreground">-</td>;
                return (
                  <td key={`cd${p}`} className="px-1 py-1 text-center border-l">
                    <span className="text-muted-foreground">{c.p.toFixed(0)}</span>/
                    <span>{c.a.toFixed(0)}</span>/
                    <span className={deltaCls(c.delta)}>{c.delta.toFixed(0)}</span>
                  </td>
                );
              })}
              <td className="px-2 py-1 text-right">{dd.actual.toFixed(0)}</td>
              <td className="px-2 py-1 text-right">{cd.actual.toFixed(0)}</td>
              <td className="px-2 py-1 text-right font-semibold">{overall.toFixed(0)}</td>
              <td className="px-2 py-1">{d.plan_finish ?? "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}
