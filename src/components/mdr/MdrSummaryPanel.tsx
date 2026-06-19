import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Download } from "lucide-react";
import { toast } from "sonner";

export function MdrSummaryPanel() {
  const { data: snapshots } = useQuery({
    queryKey: ["mdr_snapshots"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_snapshots" as never)
        .select("*")
        .order("snapshot_date", { ascending: false })
        .limit(50);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  const { data: logs } = useQuery({
    queryKey: ["mdr_import_logs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_import_logs" as never)
        .select("*")
        .order("imported_at", { ascending: false })
        .limit(30);
      if (error) throw error;
      return (data as any[]) ?? [];
    },
  });

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <Card className="p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold">스냅샷 이력</h3>
          <Button variant="outline" size="sm" onClick={() => toast.info("Export는 원본 템플릿 보관 후 활성화됩니다")}>
            <Download className="h-4 w-4 mr-1" />Export
          </Button>
        </div>
        <div className="space-y-1 max-h-96 overflow-auto">
          {(snapshots ?? []).map((s: any) => (
            <div key={s.id} className="flex items-center justify-between text-sm border-b py-1">
              <div>
                <Badge variant="outline" className="mr-2">{s.building_code ?? "-"}</Badge>
                {s.source_filename}
              </div>
              <span className="text-xs text-muted-foreground">{s.snapshot_date}</span>
            </div>
          ))}
          {(snapshots ?? []).length === 0 && <div className="text-muted-foreground text-sm">없음</div>}
        </div>
      </Card>
      <Card className="p-4">
        <h3 className="font-semibold mb-3">임포트 로그</h3>
        <div className="space-y-1 max-h-96 overflow-auto">
          {(logs ?? []).map((l: any) => (
            <div key={l.id} className="text-sm border-b py-1">
              <div className="flex items-center gap-2">
                <Badge variant={l.status === "success" ? "default" : "destructive"}>{l.status}</Badge>
                <span className="truncate">{l.filename}</span>
              </div>
              <div className="text-xs text-muted-foreground">
                +{l.rows_inserted} / 보존 {l.rows_skipped} · {new Date(l.imported_at).toLocaleString()}
              </div>
            </div>
          ))}
          {(logs ?? []).length === 0 && <div className="text-muted-foreground text-sm">없음</div>}
        </div>
      </Card>
    </div>
  );
}
