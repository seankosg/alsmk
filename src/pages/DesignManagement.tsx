import { useState, useCallback } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Upload, Download, History, Settings, LayoutDashboard, Database } from "lucide-react";
import { MdrImportDialog } from "@/components/mdr/MdrImportDialog";
import { MdrRawDataGrid } from "@/components/mdr/MdrRawDataGrid";
import { MdrSummaryPanel } from "@/components/mdr/MdrSummaryPanel";
import { MdrWeightsEditor } from "@/components/mdr/MdrWeightsEditor";
import { Navigate } from "react-router-dom";

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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <Database className="h-6 w-6" />
            Design Management
          </h1>
          <p className="text-sm text-muted-foreground">MDR 도면 진척 관리 — 건물·분야별 SD / DD / CD</p>
        </div>
        <Button onClick={() => setImportOpen(true)}>
          <Upload className="h-4 w-4 mr-1" /> Import
        </Button>
      </div>

      <Tabs defaultValue="raw" className="space-y-4">
        <TabsList>
          <TabsTrigger value="dashboard"><LayoutDashboard className="h-4 w-4 mr-1" />Dashboard</TabsTrigger>
          <TabsTrigger value="summary"><History className="h-4 w-4 mr-1" />Summary</TabsTrigger>
          <TabsTrigger value="raw"><Database className="h-4 w-4 mr-1" />Raw Data</TabsTrigger>
          <TabsTrigger value="admin"><Settings className="h-4 w-4 mr-1" />Admin</TabsTrigger>
        </TabsList>

        <TabsContent value="dashboard">
          <Card className="p-8 text-center text-muted-foreground">
            Phase 2 예정: S-curve, 지연 분포, 가중치 롤업 차트
          </Card>
        </TabsContent>

        <TabsContent value="summary">
          <MdrSummaryPanel />
        </TabsContent>

        <TabsContent value="raw" className="space-y-3">
          <div className="flex flex-wrap items-end gap-3">
            <div>
              <label className="text-xs text-muted-foreground">기준일 (asOf)</label>
              <Input
                type="date"
                value={asOf}
                onChange={(e) => setAsOf(e.target.value)}
                className="w-44"
              />
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
            <Badge variant="outline" className="ml-auto">
              건물 {buildings?.length ?? 0}개
            </Badge>
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
                <TabsContent key={b.code} value={b.code}>
                  <MdrRawDataGrid buildingCode={b.code} asOf={asOf} threshold={threshold} />
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
          qc.invalidateQueries({ queryKey: ["mdr_snapshots"] });
        }}
      />
    </div>
  );
}
