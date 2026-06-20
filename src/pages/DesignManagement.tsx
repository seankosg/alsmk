import { useState, useCallback } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Upload, Settings, Database } from "lucide-react";
import { MdrImportDialog } from "@/components/mdr/MdrImportDialog";
import { MdrRawDataGrid } from "@/components/mdr/MdrRawDataGrid";
import { MdrWeightsEditor } from "@/components/mdr/MdrWeightsEditor";
import { Navigate } from "react-router-dom";

function BuildingSheets({ buildingCode, asOf, threshold }: { buildingCode: string; asOf: string; threshold: number }) {
  const { data: sheets } = useQuery({
    queryKey: ["mdr_drawings_sheets", buildingCode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_drawings" as never)
        .select("source_sheet, created_at")
        .eq("building_code", buildingCode);
      if (error) throw error;
      const map = new Map<string, string>();
      for (const r of (data as any[]) ?? []) {
        const s = r.source_sheet ?? "Sheet";
        if (!map.has(s) || (r.created_at && r.created_at < map.get(s)!)) map.set(s, r.created_at);
      }
      return [...map.entries()].sort((a, b) => (a[1] ?? "").localeCompare(b[1] ?? "")).map(([s]) => s);
    },
  });

  if (!sheets || sheets.length === 0) {
    return <Card className="p-6 text-muted-foreground">시트 없음</Card>;
  }

  return (
    <Tabs defaultValue={sheets[0]}>
      <TabsList className="flex-wrap h-auto">
        {sheets.map((s) => (
          <TabsTrigger key={s} value={s}>{s}</TabsTrigger>
        ))}
      </TabsList>
      {sheets.map((s) => (
        <TabsContent key={s} value={s}>
          <MdrRawDataGrid buildingCode={buildingCode} sheetName={s} asOf={asOf} threshold={threshold} />
        </TabsContent>
      ))}
    </Tabs>
  );
}

export default function DesignManagement() {
  const { isAdminOrPm, loading } = useAuth();
  const [importOpen, setImportOpen] = useState(false);
  const [asOf, setAsOf] = useState(() => new Date().toISOString().slice(0, 10));
  const [threshold, setThreshold] = useState<number>(() => {
    const stored = typeof window !== "undefined" ? localStorage.getItem("mdr.deltaThreshold") : null;
    return stored ? parseFloat(stored) : 10;
  });
  const onThresholdChange = useCallback((v: number) => {
    setThreshold(v);
    localStorage.setItem("mdr.deltaThreshold", String(v));
  }, []);

  const qc = useQueryClient();
  const { data: buildings } = useQuery({
    queryKey: ["mdr_buildings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("mdr_buildings" as never)
        .select("*")
        .order("sort_order");
      if (error) throw error;
      return (data as any[]) ?? [];
    },
    enabled: isAdminOrPm,
  });

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="light-scope space-y-6 -m-3 sm:-m-4 md:-m-6 p-3 sm:p-4 md:p-6 min-h-full">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" />
            Design Raw Data
          </h1>
          <p className="text-sm text-muted-foreground">MDR 도면 진척 관리 — 건물·분야별 SD / DD / CD</p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
      </div>

      <Tabs defaultValue="raw" className="space-y-4">
        <TabsList>
          <TabsTrigger value="raw"><Database className="h-4 w-4 mr-1" />Raw Data</TabsTrigger>
          <TabsTrigger value="admin"><Settings className="h-4 w-4 mr-1" />Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="raw" className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">기준일 (asOf)</label>
              <Input type="date" value={asOf} onChange={(e) => setAsOf(e.target.value)} className="w-44" />
            </div>
            <div>
              <label className="text-xs text-muted-foreground">Δ 지연 임계 (%)</label>
              <Input
                type="number"
                min={0}
                max={100}
                value={threshold}
                onChange={(e) => onThresholdChange(parseFloat(e.target.value) || 0)}
                className="w-24"
              />
            </div>
            <Badge variant="outline" className="ml-auto">건물 {buildings?.length ?? 0}개</Badge>
          </div>

          {(!buildings || buildings.length === 0) ? (
            <Card className="p-8 text-center text-muted-foreground">
              임포트된 건물이 없습니다. 우측 상단의 Import를 통해 MDR 엑셀을 업로드하세요.
            </Card>
          ) : (
            <Tabs defaultValue={buildings[0].code}>
              <TabsList className="flex-wrap h-auto">
                {buildings.map((b: any) => (
                  <TabsTrigger key={b.code} value={b.code}>{b.code}</TabsTrigger>
                ))}
              </TabsList>
              {buildings.map((b: any) => (
                <TabsContent key={b.code} value={b.code} className="space-y-2">
                  <BuildingSheets buildingCode={b.code} asOf={asOf} threshold={threshold} />
                </TabsContent>
              ))}
            </Tabs>
          )}
        </TabsContent>

        <TabsContent value="admin">
          <MdrWeightsEditor />
        </TabsContent>
      </Tabs>

      <MdrImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        onImported={() => {
          qc.invalidateQueries({ queryKey: ["mdr_buildings"] });
          qc.invalidateQueries({ queryKey: ["mdr_drawings"] });
          qc.invalidateQueries({ queryKey: ["mdr_drawings_sheets"] });
          qc.invalidateQueries({ queryKey: ["mdr_snapshots"] });
        }}
      />
    </div>
  );
}
