import { useEffect, useState } from "react";
import { Navigate, useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { ChevronLeft, Loader2, Trash2 } from "lucide-react";

interface RfiLog {
  id: string;
  filename: string | null;
  status: string;
  rows_total: number;
  rows_inserted: number;
  rows_skipped: number;
  error_summary: string | null;
  uploaded_by: string | null;
  storage_path: string | null;
  created_at: string;
}

const STATUS_COLOR: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  rolled_back: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
};

function fmtDate(iso: string) {
  try { return new Date(iso).toLocaleString(); } catch { return iso; }
}

export default function RfiImportLogs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdminOrPm, isAdmin, loading } = useAuth();

  const [logs, setLogs] = useState<RfiLog[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [actionBusyId, setActionBusyId] = useState<string | null>(null);

  const fetchLogs = async () => {
    setBusy(true);
    const { data, error } = await (supabase as any)
      .from("rfi_import_logs")
      .select("id, filename, status, rows_total, rows_inserted, rows_skipped, error_summary, uploaded_by, storage_path, created_at")
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      toast({ title: "로그 조회 실패", description: error.message, variant: "destructive" });
      setBusy(false);
      return;
    }
    const list = (data as RfiLog[]) ?? [];
    setLogs(list);

    const ids = Array.from(new Set(list.map((l) => l.uploaded_by).filter(Boolean))) as string[];
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

  const purge = async (log: RfiLog) => {
    setActionBusyId(log.id);
    try {
      // 이 batch가 만든 이벤트에 연관된 rfi_no 파악 후, 삭제 → 마스터 재계산
      const { data: evs } = await (supabase as any)
        .from("rfi_events")
        .select("rfi_no")
        .eq("import_log_id", log.id);
      const affected = Array.from(new Set(((evs as any[]) ?? []).map((e) => e.rfi_no)));

      const { error: dErr } = await (supabase as any)
        .from("rfi_events")
        .delete()
        .eq("import_log_id", log.id);
      if (dErr) throw dErr;

      await (supabase as any).from("rfi_import_logs").delete().eq("id", log.id);

      for (const no of affected) {
        await (supabase as any).rpc("recompute_rfi_master", { _rfi_no: no });
      }

      toast({
        title: "데이터 삭제 완료",
        description: `이벤트 삭제 · 스레드 ${affected.length}개 재계산`,
      });
      await fetchLogs();
    } catch (e: any) {
      toast({ title: "삭제 실패", description: e?.message ?? String(e), variant: "destructive" });
    } finally {
      setActionBusyId(null);
    }
  };

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/design/rfi/import")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">RFI Import History</h1>
      </div>

      <Card>
        <CardContent className="pt-4">
          <div className="rounded-md border overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">File</TableHead>
                  <TableHead className="text-xs">Date</TableHead>
                  <TableHead className="text-xs">Uploader</TableHead>
                  <TableHead className="text-xs">Status</TableHead>
                  <TableHead className="text-xs text-right">Total</TableHead>
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
                    const uploader = l.uploaded_by ? (uploaderNames[l.uploaded_by] || "—") : "—";
                    const isBusy = actionBusyId === l.id;
                    return (
                      <TableRow key={l.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs font-medium">{l.filename ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(l.created_at)}</TableCell>
                        <TableCell className="text-xs">{uploader}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLOR[l.status] || ""}`}>
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{l.rows_total ?? 0}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{l.rows_inserted ?? 0}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{l.rows_skipped ?? 0}</TableCell>
                        <TableCell className="text-xs text-destructive max-w-[280px] truncate" title={l.error_summary ?? ""}>
                          {l.error_summary ?? ""}
                        </TableCell>
                        {isAdmin && (
                          <TableCell className="text-right">
                            <AlertDialog>
                              <AlertDialogTrigger asChild>
                                <Button variant="outline" size="sm" className="h-7 px-2 text-xs" disabled={isBusy}>
                                  {isBusy ? <Loader2 className="h-3 w-3 animate-spin" /> : <><Trash2 className="h-3 w-3 mr-1" />Delete</>}
                                </Button>
                              </AlertDialogTrigger>
                              <AlertDialogContent>
                                <AlertDialogHeader>
                                  <AlertDialogTitle>이 배치의 이벤트를 삭제할까요?</AlertDialogTitle>
                                  <AlertDialogDescription>
                                    이 임포트가 생성한 rfi_events 를 모두 삭제하고 영향받은 RFI 스레드의 마스터를 재계산합니다. 이 동작은 되돌릴 수 없습니다.
                                  </AlertDialogDescription>
                                </AlertDialogHeader>
                                <AlertDialogFooter>
                                  <AlertDialogCancel>취소</AlertDialogCancel>
                                  <AlertDialogAction onClick={() => purge(l)}>삭제</AlertDialogAction>
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
    </div>
  );
}
