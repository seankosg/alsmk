import { useEffect, useMemo, useState } from "react";
import { Navigate, useNavigate, useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Loader2, Trash2, Undo2, Download } from "lucide-react";
import { exportImportIssues } from "@/lib/mdr/exportIssues";

interface MdrLog {
  id: string;
  filename: string;
  building_code: string | null;
  status: string;
  rows_inserted: number | null;
  rows_skipped: number | null;
  error_summary: string | null;
  imported_by: string | null;
  imported_at: string;
}

type RowAction = "inserted" | "skipped_duplicate" | "skipped_existing" | "rev_updated";

interface RowLog {
  id: string;
  source_sheet: string | null;
  raw_row_no: number | null;
  item_no: string | null;
  source_no: string | null;
  drawing_title: string | null;
  doc_base: string | null;
  rev: string | null;
  action: RowAction;
  reason: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  rolled_back: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

const ACTION_COLOR: Record<string, string> = {
  inserted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  skipped_duplicate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  skipped_existing: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
  rev_updated: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
};

const ACTION_LABEL: Record<string, string> = {
  inserted: "Inserted",
  skipped_duplicate: "Skipped (중복)",
  skipped_existing: "Skipped (기존)",
  rev_updated: "Rev 갱신",
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function DesignImportLogs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdminOrPm, isAdmin, loading } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  const [logs, setLogs] = useState<MdrLog[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const [selectedBatch, setSelectedBatch] = useState<string | null>(searchParams.get("batch"));
  const [rowLogs, setRowLogs] = useState<RowLog[]>([]);
  const [rowsBusy, setRowsBusy] = useState(false);
  const [actionFilter, setActionFilter] = useState<string>("all");
  const [sheetFilter, setSheetFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [renderLimit, setRenderLimit] = useState<number>(500);

  const fetchLogs = async () => {
    setBusy(true);
    const { data, error } = await supabase
      .from("mdr_import_logs" as never)
      .select("id, filename, building_code, status, rows_inserted, rows_skipped, error_summary, imported_by, imported_at")
      .order("imported_at", { ascending: false })
      .limit(100);
    if (error) {
      toast({ title: "로그 조회 실패", description: error.message, variant: "destructive" });
      setBusy(false);
      return;
    }
    const list = (data as MdrLog[]) ?? [];
    setLogs(list);

    const ids = Array.from(new Set(list.map((l) => l.imported_by).filter(Boolean))) as string[];
    if (ids.length) {
      const { data: members } = await supabase
        .from("members")
        .select("user_id, name")
        .in("user_id", ids);
      const map: Record<string, string> = {};
      (members ?? []).forEach((m: any) => { map[m.user_id] = m.name ?? ""; });
      setUploaderNames(map);
    } else {
      setUploaderNames({});
    }
    setBusy(false);
  };

  useEffect(() => { void fetchLogs(); }, []);

  useEffect(() => {
    if (selectedBatch) void loadRowLogs(selectedBatch);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedBatch]);

  useEffect(() => {
    const next = new URLSearchParams(searchParams);
    if (selectedBatch) next.set("batch", selectedBatch);
    else next.delete("batch");
    if (next.toString() !== searchParams.toString()) setSearchParams(next, { replace: true });
  }, [selectedBatch, searchParams, setSearchParams]);

  const loadRowLogs = async (batchId: string) => {
    setRowsBusy(true);
    setActionFilter("all");
    setSheetFilter("all");
    setSearch("");
    setRenderLimit(500);

    // PostgREST 응답 최대 행수(기본 1000) 제한을 우회하기 위해 .range() 페이지네이션
    const PAGE = 1000;
    const all: RowLog[] = [];
    let from = 0;
    let failed = false;
    try {
      while (true) {
        const callPage = () =>
          (supabase as any)
            .rpc("get_mdr_import_row_logs", { _import_log_id: batchId })
            .range(from, from + PAGE - 1);
        let { data, error } = await callPage();
        if (error) {
          console.warn("get_mdr_import_row_logs page 실패, 재시도:", error.message);
          ({ data, error } = await callPage());
        }
        if (error) throw error;
        const chunk = (data as RowLog[]) ?? [];
        all.push(...chunk);
        if (chunk.length < PAGE) break;
        from += PAGE;
        if (from > 500_000) break; // 안전 가드
      }
    } catch (e: any) {
      failed = true;
      console.error(e);
      toast({ title: "행 로그 조회 실패", description: e?.message ?? String(e), variant: "destructive" });
    }
    if (!failed) setRowLogs(all);
    setRowsBusy(false);
  };

  /** 이 batch의 row logs에서 inserted/rev_updated doc_base 목록 추출 */
  const fetchBatchScope = async (batchId: string, buildingCode: string | null) => {
    // PostgREST 응답 제한 우회: .range() 페이지네이션
    const PAGE = 1000;
    const inserted: string[] = [];
    const revUpdated: string[] = [];
    let from = 0;
    while (true) {
      const { data, error } = await supabase
        .from("mdr_import_row_logs" as never)
        .select("doc_base, action")
        .eq("import_log_id", batchId)
        .in("action", ["inserted", "rev_updated"])
        .order("id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) throw error;
      const rows = (data as any[]) ?? [];
      for (const r of rows) {
        if (!r.doc_base) continue;
        if (r.action === "inserted") inserted.push(r.doc_base);
        else if (r.action === "rev_updated") revUpdated.push(r.doc_base);
      }
      if (rows.length < PAGE) break;
      from += PAGE;
      if (from > 500_000) break;
    }
    return { inserted, revUpdated, buildingCode };
  };


  const rollback = async (log: MdrLog) => {
    setActionBusyId(log.id);
    try {
      const { inserted, revUpdated, buildingCode } = await fetchBatchScope(log.id, log.building_code);

      // 1) inserted 도면 삭제 (CASCADE로 milestones/progress/revisions 정리)
      if (inserted.length && buildingCode) {
        for (let i = 0; i < inserted.length; i += 500) {
          const chunk = inserted.slice(i, i + 500);
          const { error } = await (supabase.from("mdr_drawings" as never) as any)
            .delete()
            .eq("building_code", buildingCode)
            .in("doc_base", chunk);
          if (error) throw error;
        }
      }

      // 2) rev_updated 도면 복원: 이 batch가 만든 이력 스냅샷으로 되돌리기
      let restored = 0;
      if (revUpdated.length) {
        const { data: revs, error: revErr } = await supabase
          .from("mdr_drawing_revisions" as never)
          .select("*")
          .eq("import_log_id", log.id);
        if (revErr) throw revErr;
        const list = (revs as any[]) ?? [];
        for (const snap of list) {
          // 도면 본체 복원
          const { error: uErr } = await (supabase.from("mdr_drawings" as never) as any)
            .update({
              rev: snap.rev,
              doc_no: snap.doc_no,
              drawing_title: snap.drawing_title,
              plan_finish: snap.plan_finish,
              out_of_scope: snap.out_of_scope ?? false,
              source_sheet: snap.source_sheet,
            })
            .eq("id", snap.drawing_id);
          if (uErr) throw uErr;
          // 마일스톤/진행률 재주입
          await (supabase.from("mdr_milestones" as never) as any).delete().eq("drawing_id", snap.drawing_id);
          await (supabase.from("mdr_progress" as never) as any).delete().eq("drawing_id", snap.drawing_id);
          const ms = (snap.progress_snapshot?.milestones ?? []).map((m: any) => ({
            drawing_id: snap.drawing_id, stage: m.stage, pct: m.pct,
            increment_pct: m.increment_pct, plan_date: m.plan_date,
          }));
          const pg = (snap.progress_snapshot?.progress ?? []).map((p: any) => ({
            drawing_id: snap.drawing_id, stage: p.stage, pct: p.pct,
            is_done: p.is_done, actual_date: p.actual_date ?? null,
          }));
          if (ms.length) await supabase.from("mdr_milestones" as never).insert(ms as any);
          if (pg.length) await supabase.from("mdr_progress" as never).insert(pg as any);
          restored++;
        }
        // 사용한 스냅샷 삭제
        await (supabase.from("mdr_drawing_revisions" as never) as any).delete().eq("import_log_id", log.id);
      }

      // 3) 로그 상태 갱신
      await (supabase.from("mdr_import_logs" as never) as any)
        .update({ status: "rolled_back" })
        .eq("id", log.id);

      toast({
        title: "롤백 완료",
        description: `신규 ${inserted.length}건 삭제, Rev 갱신 ${restored}건 복원`,
      });
      await fetchLogs();
    } catch (e: any) {
      toast({ title: "롤백 실패", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const purge = async (log: MdrLog) => {
    setActionBusyId(log.id);
    try {
      // 표시용 카운트 (row_logs가 남아 있을 때만 의미)
      const { inserted } = await fetchBatchScope(log.id, log.building_code);

      // 1) 이 batch가 만들었거나 마지막으로 갱신한 도면 직접 삭제 (CASCADE → milestones/progress)
      const { error: dErr, count } = await (supabase.from("mdr_drawings" as never) as any)
        .delete({ count: "exact" })
        .eq("import_log_id", log.id);
      if (dErr) throw dErr;
      // 2) 이 batch가 만든 rev 스냅샷 정리
      await (supabase.from("mdr_drawing_revisions" as never) as any).delete().eq("import_log_id", log.id);
      // 3) 행 로그 + 로그 본체 삭제
      await (supabase.from("mdr_import_row_logs" as never) as any).delete().eq("import_log_id", log.id);
      await (supabase.from("mdr_import_logs" as never) as any).delete().eq("id", log.id);

      toast({
        title: "데이터 삭제 완료",
        description: `도면 ${count ?? inserted.length}건 + 로그 영구 삭제`,
      });
      if (selectedBatch === log.id) setSelectedBatch(null);
      await fetchLogs();
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  const sheets = useMemo(
    () => Array.from(new Set(rowLogs.map((r) => r.source_sheet).filter(Boolean))) as string[],
    [rowLogs],
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rowLogs.filter((r) => {
      if (actionFilter !== "all" && r.action !== actionFilter) return false;
      if (sheetFilter !== "all" && r.source_sheet !== sheetFilter) return false;
      if (q) {
        const hay = `${r.item_no ?? ""} ${r.source_no ?? ""} ${r.doc_base ?? ""} ${r.drawing_title ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rowLogs, actionFilter, sheetFilter, search]);

  const counts = useMemo(() => {
    const c = { inserted: 0, skipped_existing: 0, skipped_duplicate: 0, rev_updated: 0 };
    rowLogs.forEach((r) => { (c as any)[r.action] = ((c as any)[r.action] ?? 0) + 1; });
    return c;
  }, [rowLogs]);

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  const selectedLog = logs.find((l) => l.id === selectedBatch);

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          onClick={() => (selectedBatch ? setSelectedBatch(null) : navigate("/design/import"))}
        >
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">
          {selectedBatch ? "Import Row Details" : "MDR Import History"}
        </h1>
      </div>

      {!selectedBatch ? (
        <Card>
          <CardContent className="pt-4">
            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs">File</TableHead>
                    <TableHead className="text-xs">Building</TableHead>
                    <TableHead className="text-xs">Date</TableHead>
                    <TableHead className="text-xs">Uploader</TableHead>
                    <TableHead className="text-xs">Status</TableHead>
                    <TableHead className="text-xs text-right">Inserted</TableHead>
                    <TableHead className="text-xs text-right">Skipped</TableHead>
                    <TableHead className="text-xs">Error</TableHead>
                    {isAdmin && <TableHead className="text-xs text-right">Actions</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {busy ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">
                        Loading...
                      </TableCell>
                    </TableRow>
                  ) : logs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={isAdmin ? 9 : 8} className="text-center py-8 text-muted-foreground">
                        임포트 이력이 없습니다.
                      </TableCell>
                    </TableRow>
                  ) : (
                    logs.map((l) => {
                      const uploader = l.imported_by ? (uploaderNames[l.imported_by] || "—") : "—";
                      const click = () => setSelectedBatch(l.id);
                      const isBusy = actionBusyId === l.id;
                      const isRolledBack = l.status === "rolled_back";
                      return (
                        <TableRow key={l.id} className="hover:bg-muted/50">
                          <TableCell className="text-xs font-medium cursor-pointer" onClick={click}>{l.filename}</TableCell>
                          <TableCell className="text-xs cursor-pointer" onClick={click}>{l.building_code ?? "—"}</TableCell>
                          <TableCell className="text-xs whitespace-nowrap cursor-pointer" onClick={click}>{fmtDate(l.imported_at)}</TableCell>
                          <TableCell className="text-xs cursor-pointer" onClick={click}>{uploader}</TableCell>
                          <TableCell className="cursor-pointer" onClick={click}>
                            <Badge variant="outline" className={`text-xs ${STATUS_COLOR[l.status] || ""}`}>
                              {l.status}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-xs text-right tabular-nums cursor-pointer" onClick={click}>{l.rows_inserted ?? 0}</TableCell>
                          <TableCell className="text-xs text-right tabular-nums cursor-pointer" onClick={click}>{l.rows_skipped ?? 0}</TableCell>
                          <TableCell className="text-xs text-destructive max-w-[280px] truncate cursor-pointer" onClick={click} title={l.error_summary ?? ""}>
                            {l.error_summary ?? ""}
                          </TableCell>
                          {isAdmin && (
                            <TableCell className="text-right">
                              <div className="flex items-center justify-end gap-1">
                                {/* Rollback */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="outline" size="sm"
                                      className="h-7 px-2 text-xs"
                                      disabled={isBusy || isRolledBack}
                                      title={isRolledBack ? "이미 롤백됨" : "이 임포트의 변경을 되돌리기"}
                                    >
                                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Undo2 className="h-3.5 w-3.5 mr-1" />}
                                      Rollback
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>이 임포트를 롤백할까요?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        이 배치로 신규 추가된 도면은 삭제되고, Rev가 갱신된 도면은 이전 Rev 상태(진행률 포함)로 복원됩니다.
                                        로그는 <code>rolled_back</code> 상태로 보존됩니다.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction onClick={() => rollback(l)}>롤백 실행</AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>

                                {/* Purge */}
                                <AlertDialog>
                                  <AlertDialogTrigger asChild>
                                    <Button
                                      variant="ghost" size="sm"
                                      className="h-7 px-2 text-xs text-destructive hover:text-destructive"
                                      disabled={isBusy}
                                      title="이 임포트로 추가된 도면과 로그를 영구 삭제"
                                    >
                                      {isBusy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5 mr-1" />}
                                      Purge
                                    </Button>
                                  </AlertDialogTrigger>
                                  <AlertDialogContent>
                                    <AlertDialogHeader>
                                      <AlertDialogTitle>데이터를 영구 삭제할까요?</AlertDialogTitle>
                                      <AlertDialogDescription>
                                        이 임포트로 <strong>신규 추가된 도면</strong>과 관련 마일스톤/진행률, 그리고 임포트 로그가 영구 삭제됩니다.
                                        Rev 갱신된 도면은 이미 새 Rev로 운용 중이므로 건드리지 않습니다. 이 작업은 되돌릴 수 없습니다.
                                      </AlertDialogDescription>
                                    </AlertDialogHeader>
                                    <AlertDialogFooter>
                                      <AlertDialogCancel>Cancel</AlertDialogCancel>
                                      <AlertDialogAction
                                        onClick={() => purge(l)}
                                        className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      >
                                        영구 삭제
                                      </AlertDialogAction>
                                    </AlertDialogFooter>
                                  </AlertDialogContent>
                                </AlertDialog>
                              </div>
                            </TableCell>
                          )}
                        </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex flex-wrap items-center gap-2">
              <span>{selectedLog?.filename ?? "—"}</span>
              <Badge variant="outline" className={`text-xs ${ACTION_COLOR.inserted}`}>Inserted {counts.inserted}</Badge>
              <Badge variant="outline" className={`text-xs ${ACTION_COLOR.rev_updated}`}>Rev 갱신 {counts.rev_updated}</Badge>
              <Badge variant="outline" className={`text-xs ${ACTION_COLOR.skipped_existing}`}>Existing {counts.skipped_existing}</Badge>
              <Badge variant="outline" className={`text-xs ${ACTION_COLOR.skipped_duplicate}`}>Duplicate {counts.skipped_duplicate}</Badge>
              <Button
                variant="outline"
                size="sm"
                className="ml-auto h-8 text-xs gap-1.5"
                disabled={!selectedLog || rowsBusy}
                onClick={() => {
                  if (!selectedLog) return;
                  exportImportIssues(
                    {
                      filename: selectedLog.filename,
                      building_code: selectedLog.building_code,
                      status: selectedLog.status,
                      imported_at: selectedLog.imported_at,
                      error_summary: selectedLog.error_summary,
                    },
                    rowLogs,
                  );
                }}
              >
                <Download className="h-3.5 w-3.5" />
                Excel 다운로드
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="inserted">Inserted</SelectItem>
                  <SelectItem value="rev_updated">Rev 갱신</SelectItem>
                  <SelectItem value="skipped_existing">Skipped (기존)</SelectItem>
                  <SelectItem value="skipped_duplicate">Skipped (중복)</SelectItem>
                </SelectContent>
              </Select>
              <Select value={sheetFilter} onValueChange={setSheetFilter}>
                <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sheets</SelectItem>
                  {sheets.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                </SelectContent>
              </Select>
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Item No · Source No · Title 검색"
                className="h-8 text-xs w-[260px]"
              />
              <span className="text-xs text-muted-foreground ml-auto">
                {filtered.length.toLocaleString()} / {rowLogs.length.toLocaleString()}건
              </span>
            </div>

            <div className="rounded-md border overflow-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-16">Row#</TableHead>
                    <TableHead className="text-xs w-20">Sheet</TableHead>
                    <TableHead className="text-xs">Doc No (base)</TableHead>
                    <TableHead className="text-xs">Item No</TableHead>
                    <TableHead className="text-xs">Source No</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs w-36">Action</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsBusy ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : rowLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center py-8 text-muted-foreground">
                        이 배치는 행 단위 상세 정보가 기록되지 않았습니다. (신규 import부터 적용됩니다)
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center py-8 text-muted-foreground">조건에 맞는 행이 없습니다.</TableCell></TableRow>
                  ) : (
                    filtered.slice(0, renderLimit).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs tabular-nums">{r.raw_row_no ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.source_sheet ?? "—"}</TableCell>
                        <TableCell className="text-xs font-mono">{r.doc_base ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.item_no ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.source_no ?? "—"}</TableCell>
                        <TableCell className="text-xs max-w-[360px] truncate" title={r.drawing_title ?? ""}>{r.drawing_title ?? "—"}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${ACTION_COLOR[r.action] || ""}`}>
                            {ACTION_LABEL[r.action] ?? r.action}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-muted-foreground">{r.reason ?? ""}</TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </div>

            {filtered.length > renderLimit && (
              <div className="flex justify-center">
                <Button variant="outline" size="sm" onClick={() => setRenderLimit((n) => n + 500)}>
                  Show more ({filtered.length - renderLimit}건 남음)
                </Button>
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
