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

const STATUS_COLOR: Record<string, string> = {
  success: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200",
  processing: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  failed: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function fmtDate(iso: string) {
  try {
    return new Date(iso).toLocaleString();
  } catch {
    return iso;
  }
}

export default function DesignImportLogs() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { isAdminOrPm, isAdmin, loading } = useAuth();
  const [logs, setLogs] = useState<MdrLog[]>([]);
  const [uploaderNames, setUploaderNames] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(true);
  const [deletingId, setDeletingId] = useState<string | null>(null);

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

  const deleteLog = async (id: string) => {
    setDeletingId(id);
    const { error } = await supabase.from("mdr_import_logs" as never).delete().eq("id", id);
    setDeletingId(null);
    if (error) {
      toast({ title: "삭제 실패", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "삭제됨", description: "임포트 로그가 삭제되었습니다." });
    await fetchLogs();
  };

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/design/import")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">MDR Import History</h1>
      </div>

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
                    return (
                      <TableRow key={l.id} className="hover:bg-muted/50">
                        <TableCell className="text-xs font-medium">{l.filename}</TableCell>
                        <TableCell className="text-xs">{l.building_code ?? "—"}</TableCell>
                        <TableCell className="text-xs whitespace-nowrap">{fmtDate(l.imported_at)}</TableCell>
                        <TableCell className="text-xs">{uploader}</TableCell>
                        <TableCell>
                          <Badge variant="outline" className={`text-xs ${STATUS_COLOR[l.status] || ""}`}>
                            {l.status}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{l.rows_inserted ?? 0}</TableCell>
                        <TableCell className="text-xs text-right tabular-nums">{l.rows_skipped ?? 0}</TableCell>
                        <TableCell className="text-xs text-destructive max-w-[280px] truncate" title={l.error_summary ?? ""}>
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
                                    이 로그만 삭제됩니다. 임포트된 도면 데이터는 보존됩니다.
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
    </div>
  );
}
