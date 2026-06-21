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
import { ChevronLeft, Loader2, Trash2 } from "lucide-react";

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

interface RowLog {
  id: string;
  source_sheet: string | null;
  raw_row_no: number | null;
  item_no: string | null;
  source_no: string | null;
  drawing_title: string | null;
  action: "inserted" | "skipped_duplicate" | "skipped_existing";
  reason: string | null;
}

const STATUS_COLOR: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const ACTION_COLOR: Record<string, string> = {
  inserted: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  skipped_duplicate: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  skipped_existing: "bg-slate-200 text-slate-800 dark:bg-slate-700 dark:text-slate-200",
};

const ACTION_LABEL: Record<string, string> = {
  inserted: "Inserted",
  skipped_duplicate: "Skipped (중복)",
  skipped_existing: "Skipped (기존)",
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
  const [deletingId, setDeletingId] = useState<string | null>(null);

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
    const { data, error } = await supabase
      .from("mdr_import_row_logs" as never)
      .select("id, source_sheet, raw_row_no, item_no, source_no, drawing_title, action, reason")
      .eq("import_log_id", batchId)
      .order("raw_row_no", { ascending: true })
      .limit(50000);
    if (error) {
      console.error(error);
      toast({ title: "행 로그 조회 실패", description: error.message, variant: "destructive" });
      setRowLogs([]);
    } else {
      setRowLogs((data as RowLog[]) ?? []);
    }
    setRowsBusy(false);
  };

  const deleteLog = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("mdr_import_logs" as never).delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "삭제됨", description: "임포트 로그가 삭제되었습니다." });
    if (selectedBatch === id) setSelectedBatch(null);
    await fetchLogs();
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
        const hay = `${r.item_no ?? ""} ${r.source_no ?? ""} ${r.drawing_title ?? ""}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [rowLogs, actionFilter, sheetFilter, search]);

  const counts = useMemo(() => {
    const c = { inserted: 0, skipped_existing: 0, skipped_duplicate: 0 };
    rowLogs.forEach((r) => { (c as any)[r.action] += 1; });
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
                    {isAdmin && <TableHead className="text-xs w-10"></TableHead>}
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
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost" size="icon"
                                    className="h-7 w-7 text-destructive hover:text-destructive"
                                    disabled={deletingId === l.id}
                                    title="로그 삭제 (도면 데이터는 보존됩니다)"
                                  >
                                    {deletingId === l.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>임포트 로그를 삭제할까요?</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      이 로그와 행별 상세 기록이 삭제됩니다. 임포트된 도면 데이터는 보존됩니다.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>Cancel</AlertDialogCancel>
                                    <AlertDialogAction onClick={() => deleteLog(l.id)}>삭제</AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
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
              <Badge variant="outline" className={`text-xs ${ACTION_COLOR.skipped_existing}`}>Existing {counts.skipped_existing}</Badge>
              <Badge variant="outline" className={`text-xs ${ACTION_COLOR.skipped_duplicate}`}>Duplicate {counts.skipped_duplicate}</Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              <Select value={actionFilter} onValueChange={setActionFilter}>
                <SelectTrigger className="w-[180px] h-8 text-xs"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All actions</SelectItem>
                  <SelectItem value="inserted">Inserted</SelectItem>
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
                    <TableHead className="text-xs">Item No</TableHead>
                    <TableHead className="text-xs">Source No</TableHead>
                    <TableHead className="text-xs">Title</TableHead>
                    <TableHead className="text-xs w-36">Action</TableHead>
                    <TableHead className="text-xs">Reason</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {rowsBusy ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">Loading...</TableCell></TableRow>
                  ) : rowLogs.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="text-center py-8 text-muted-foreground">
                        이 배치는 행 단위 상세 정보가 기록되지 않았습니다. (신규 import부터 적용됩니다)
                      </TableCell>
                    </TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={7} className="text-center py-8 text-muted-foreground">조건에 맞는 행이 없습니다.</TableCell></TableRow>
                  ) : (
                    filtered.slice(0, renderLimit).map((r) => (
                      <TableRow key={r.id}>
                        <TableCell className="text-xs tabular-nums">{r.raw_row_no ?? "—"}</TableCell>
                        <TableCell className="text-xs">{r.source_sheet ?? "—"}</TableCell>
                        <TableCell className="text-xs font-medium">{r.item_no ?? "—"}</TableCell>
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
