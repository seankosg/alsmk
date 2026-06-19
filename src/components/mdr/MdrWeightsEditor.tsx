import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { useState } from "react";

const STAGES = ["SD", "DD", "CD"] as const;

export function MdrWeightsEditor() {
  const qc = useQueryClient();
  const { data: buildings } = useQuery({
    queryKey: ["mdr_buildings"],
    queryFn: async () => {
      const { data } = await supabase.from("mdr_buildings" as never).select("*").order("sort_order");
      return (data as any[]) ?? [];
    },
  });
  const { data: weights } = useQuery({
    queryKey: ["mdr_weights"],
    queryFn: async () => {
      const { data } = await supabase.from("mdr_weights" as never).select("*").eq("is_reference_only", false);
      return (data as any[]) ?? [];
    },
  });

  const upsert = useMutation({
    mutationFn: async (payload: { building: string; stage: string; weight: number }) => {
      const { error } = await supabase.from("mdr_weights" as never).upsert(
        {
          building_code: payload.building,
          discipline: null,
          stage: payload.stage,
          weight: payload.weight,
          is_reference_only: false,
        } as any,
        { onConflict: "building_code,discipline,stage,is_reference_only" },
      );
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["mdr_weights"] });
      toast.success("저장됨");
    },
    onError: (e: any) => toast.error(e.message),
  });

  const getWeight = (building: string, stage: string) => {
    const w = weights?.find((x: any) => x.building_code === building && x.stage === stage);
    return w?.weight ?? 1;
  };

  return (
    <Card className="p-4 overflow-auto">
      <h3 className="font-semibold mb-3">가중치 매트릭스 (Building × Stage)</h3>
      <p className="text-xs text-muted-foreground mb-3">기본값 1.0 (균등). 셀을 수정하면 즉시 저장됩니다.</p>
      <table className="text-sm">
        <thead>
          <tr className="border-b">
            <th className="px-3 py-2 text-left">Building</th>
            {STAGES.map((s) => <th key={s} className="px-3 py-2">{s}</th>)}
          </tr>
        </thead>
        <tbody>
          {(buildings ?? []).map((b: any) => (
            <tr key={b.code} className="border-b">
              <td className="px-3 py-1 font-medium">{b.code}</td>
              {STAGES.map((s) => (
                <td key={s} className="px-1 py-1">
                  <WeightInput
                    value={getWeight(b.code, s)}
                    onSave={(v) => upsert.mutate({ building: b.code, stage: s, weight: v })}
                  />
                </td>
              ))}
            </tr>
          ))}
          {(buildings ?? []).length === 0 && (
            <tr><td colSpan={STAGES.length + 1} className="text-center text-muted-foreground py-6">건물 없음</td></tr>
          )}
        </tbody>
      </table>
    </Card>
  );
}

function WeightInput({ value, onSave }: { value: number; onSave: (v: number) => void }) {
  const [v, setV] = useState(String(value));
  return (
    <Input
      type="number"
      step={0.1}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => {
        const n = parseFloat(v);
        if (!isNaN(n) && n !== value) onSave(n);
      }}
      className="w-20 h-8 text-center"
    />
  );
}
