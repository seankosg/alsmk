import { useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Upload, MessageSquare, FileSpreadsheet, BellRing } from "lucide-react";
import { STATUS_META, type RfiStatus } from "@/lib/rfi/statusEngine";
import { RfiThreadDrawer } from "@/components/rfi/RfiThreadDrawer";
import { RfiReminderDialog } from "@/components/rfi/RfiReminderDialog";

interface MasterRow {
  id: string;
  rfi_no: string;
  direction: string | null;
  discipline: string | null;
  originator: string | null;
  title_clean: string | null;
  latest_from: string | null;
  latest_to: string | null;
  issue_date: string | null;
  due_date: string | null;
  response_date: string | null;
  closed_date: string | null;
  days_open: number | null;
  status: RfiStatus;
  event_count: number;
  latest_filename: string | null;
}

export default function RfiRawData() {
  const { isAdminOrPm, loading } = useAuth();
  const [q, setQ] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [dirFilter, setDirFilter] = useState<string>("all");
  const [drawerRfi, setDrawerRfi] = useState<string | null>(null);
  const [reminderRow, setReminderRow] = useState<MasterRow | null>(null);

  const { data: masters = [], isLoading } = useQuery({
    queryKey: ["rfi_masters"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("rfi_masters")
        .select("*")
        .order("issue_date", { ascending: false, nullsFirst: false })
        .limit(2000);
      if (error) throw error;
      return (data as MasterRow[]) ?? [];
    },
    enabled: isAdminOrPm,
  });

  const filtered = useMemo(() => {
    const ql = q.trim().toLowerCase();
    return masters.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (dirFilter !== "all" && r.direction !== dirFilter) return false;
      if (!ql) return true;
      return (
        r.rfi_no.toLowerCase().includes(ql) ||
        (r.title_clean ?? "").toLowerCase().includes(ql) ||
        (r.discipline ?? "").toLowerCase().includes(ql) ||
        (r.originator ?? "").toLowerCase().includes(ql)
      );
    });
  }, [masters, q, statusFilter, dirFilter]);

  const kpi = useMemo(() => {
    const counts: Record<string, number> = { Overdue: 0, DueSoon: 0, OnTrack: 0, Closed: 0, LateClosed: 0, Info: 0 };
    for (const m of masters) counts[m.status] = (counts[m.status] ?? 0) + 1;
    return counts;
  }, [masters]);

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

      {/* KPI */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-2">
        {(["Overdue","DueSoon","OnTrack","LateClosed","Closed","Info"] as RfiStatus[]).map((k) => {
          const meta = STATUS_META[k];
          return (
            <Card key={k} className="p-3 cursor-pointer hover:bg-muted/50" onClick={() => setStatusFilter(statusFilter === k ? "all" : k)}>
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground">{meta.label}</span>
                <span className={`h-2 w-2 rounded-full ${meta.dot}`} />
              </div>
              <div className="text-2xl font-semibold">{kpi[k] ?? 0}</div>
            </Card>
          );
        })}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <Input placeholder="RFI No · 제목 · 분야 · 기안자 검색" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 상태</SelectItem>
            {(Object.keys(STATUS_META) as RfiStatus[]).map((k) => (
              <SelectItem key={k} value={k}>{STATUS_META[k].label}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={dirFilter} onValueChange={setDirFilter}>
          <SelectTrigger className="w-36"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">모든 방향</SelectItem>
            <SelectItem value="Outgoing">Outgoing</SelectItem>
            <SelectItem value="Incoming">Incoming</SelectItem>
            <SelectItem value="Unknown">Unknown</SelectItem>
          </SelectContent>
        </Select>
        <Badge variant="outline" className="ml-auto">{filtered.length} / {masters.length}</Badge>
      </div>

      <Card className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-[130px]">RFI No</TableHead>
              <TableHead className="w-[90px]">Dir</TableHead>
              <TableHead className="w-[90px]">Disp</TableHead>
              <TableHead>Title</TableHead>
              <TableHead className="w-[100px]">Issue</TableHead>
              <TableHead className="w-[100px]">Due</TableHead>
              <TableHead className="w-[100px]">Response</TableHead>
              <TableHead className="w-[70px]">Days</TableHead>
              <TableHead className="w-[110px]">Status</TableHead>
              <TableHead className="w-[60px]">Ev</TableHead>
              <TableHead className="w-[220px]">Source</TableHead>
              <TableHead className="w-[110px] text-right">Action</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">로딩 중...</TableCell></TableRow>
            )}
            {!isLoading && filtered.length === 0 && (
              <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground py-8">데이터가 없습니다.</TableCell></TableRow>
            )}
            {filtered.map((r) => {
              const meta = STATUS_META[r.status] ?? STATUS_META.Info;
              return (
                <TableRow key={r.id} className="cursor-pointer" onClick={() => setDrawerRfi(r.rfi_no)}>
                  <TableCell className="font-mono text-xs">{r.rfi_no}</TableCell>
                  <TableCell><Badge variant="outline">{r.direction ?? "-"}</Badge></TableCell>
                  <TableCell className="text-xs">{r.discipline ?? "-"}</TableCell>
                  <TableCell className="max-w-md truncate">{r.title_clean ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.issue_date ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.due_date ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.response_date ?? "-"}</TableCell>
                  <TableCell className="text-xs">{r.days_open ?? "-"}</TableCell>
                  <TableCell><Badge className={meta.cls}>{meta.label}</Badge></TableCell>
                  <TableCell className="text-xs text-muted-foreground">{r.event_count}</TableCell>
                  <TableCell className="text-xs text-muted-foreground truncate max-w-[220px]">
                    {r.latest_filename ? (
                      <span className="inline-flex items-center gap-1"><FileSpreadsheet className="h-3 w-3" />{r.latest_filename}</span>
                    ) : "-"}
                  </TableCell>
                  <TableCell className="text-right">
                    {(r.status === "Overdue" || r.status === "DueSoon") && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => { e.stopPropagation(); setReminderRow(r); }}
                      >
                        <BellRing className="h-3 w-3 mr-1" /> Remind
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </Card>

      <RfiThreadDrawer rfiNo={drawerRfi} onOpenChange={(o) => !o && setDrawerRfi(null)} />
      <RfiReminderDialog
        master={reminderRow}
        onOpenChange={(o) => !o && setReminderRow(null)}
      />
    </div>
  );
}
