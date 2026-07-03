import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Upload, MessageSquare } from "lucide-react";
import { STATUS_META, type RfiStatus } from "@/lib/rfi/statusEngine";
import { RfiThreadDrawer } from "@/components/rfi/RfiThreadDrawer";
import { RfiReminderDialog } from "@/components/rfi/RfiReminderDialog";
import { RfiAdvancedGrid } from "@/components/rfi/grid/RfiAdvancedGrid";
import type { RfiMasterRow } from "@/components/rfi/grid/rfiColumns";

export default function RfiRawData() {
  const { user, isAdminOrPm, loading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<RfiStatus | null>(null);
  const [drawerRfi, setDrawerRfi] = useState<string | null>(null);
  const [reminderRow, setReminderRow] = useState<RfiMasterRow | null>(null);

  const { data: masters = [], isLoading } = useQuery({
    queryKey: ["rfi_masters"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rfi_masters")
        .select("*")
        .order("issue_date", { ascending: false, nullsFirst: false })
        .limit(5000);
      if (error) throw error;
      return (data as RfiMasterRow[]) ?? [];
    },
    enabled: isAdminOrPm,
  });

  const filtered = useMemo(
    () => (statusFilter ? masters.filter((m) => m.status === statusFilter) : masters),
    [masters, statusFilter],
  );

  const kpi = useMemo(() => {
    const counts: Record<string, number> = { Overdue: 0, DueSoon: 0, OnTrack: 0, Closed: 0, LateClosed: 0, Info: 0 };
    for (const m of masters) counts[m.status] = (counts[m.status] ?? 0) + 1;
    return counts;
  }, [masters]);

  const persistKey = user ? `rfi-grid-state:${user.id}` : null;

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <MessageSquare className="h-6 w-6" />
            RFI Raw Data
          </h1>
          <p className="text-sm text-muted-foreground">RFI/TQ 로그 — 문서번호별 최신 상태 및 스레드</p>
        </div>
        <div className="flex items-center gap-2">
          <Button asChild>
            <Link to="/design/rfi/import"><Upload className="h-4 w-4 mr-1" /> Import</Link>
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {(["Overdue","DueSoon","OnTrack","LateClosed","Closed","Info"] as RfiStatus[]).map((k) => {
          const meta = STATUS_META[k];
          const active = statusFilter === k;
          return (
            <Card
              key={k}
              className={`p-3 cursor-pointer transition-colors ${active ? "border-primary bg-primary/5" : "hover:bg-muted/50"}`}
              onClick={() => setStatusFilter(active ? null : k)}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{meta.label}</span>
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              </div>
              <div className="text-2xl font-semibold">{kpi[k] ?? 0}</div>
            </Card>
          );
        })}
      </div>

      <RfiAdvancedGrid
        rows={filtered}
        isLoading={isLoading}
        persistKey={persistKey}
        onRowClick={(r) => setDrawerRfi(r.rfi_no)}
        onRemind={(r) => setReminderRow(r)}
      />

      <RfiThreadDrawer rfiNo={drawerRfi} onOpenChange={(o) => !o && setDrawerRfi(null)} />
      <RfiReminderDialog
        master={reminderRow}
        onOpenChange={(o) => !o && setReminderRow(null)}
      />
    </div>
  );
}
