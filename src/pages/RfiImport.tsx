import { useCallback, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { Navigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Upload, ChevronLeft, FileSpreadsheet, Loader2, CheckCircle2, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { importRfiFile, type RfiImportResult } from "@/lib/rfi/importRunner";
import { toast } from "sonner";

interface Job {
  id: string;
  file: File;
  status: "ready" | "processing" | "done" | "failed";
  result?: RfiImportResult;
  error?: string;
}

let uid = 0;
const newId = () => `r${Date.now()}-${++uid}`;

export default function RfiImport() {
  const { isAdminOrPm, loading, user } = useAuth();
  const nav = useNavigate();
  const qc = useQueryClient();
  const inputRef = useRef<HTMLInputElement>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [running, setRunning] = useState(false);

  const addFiles = useCallback((files: File[]) => {
    setJobs((prev) => [
      ...prev,
      ...files.map<Job>((f) => ({ id: newId(), file: f, status: "ready" as const })),
    ]);
  }, []);

  const runAll = useCallback(async () => {
    if (running) return;
    setRunning(true);
    try {
      for (const j of jobs) {
        if (j.status !== "ready") continue;
        setJobs((prev) => prev.map((x) => (x.id === j.id ? { ...x, status: "processing" } : x)));
        try {
          const res = await importRfiFile(j.file, user?.id ?? null);
          setJobs((prev) => prev.map((x) => (x.id === j.id ? { ...x, status: "done", result: res } : x)));
        } catch (e: any) {
          setJobs((prev) => prev.map((x) => (x.id === j.id ? { ...x, status: "failed", error: e?.message ?? String(e) } : x)));
        }
      }
      qc.invalidateQueries({ queryKey: ["rfi_masters"] });
      qc.invalidateQueries({ queryKey: ["rfi_import_logs"] });
      toast.success("RFI 임포트 완료");
    } finally {
      setRunning(false);
    }
  }, [jobs, running, user?.id, qc]);

  if (loading) return <div className="p-8 text-muted-foreground">로딩 중...</div>;
  if (!isAdminOrPm) return <Navigate to="/" replace />;

  const readyCount = jobs.filter((j) => j.status === "ready").length;

  return (
    <div className="space-y-4 p-2">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="icon" onClick={() => nav("/design/rfi")}>
          <ChevronLeft className="h-4 w-4" />
        </Button>
        <h1 className="text-xl font-semibold tracking-tight">RFI Import</h1>
      </div>

      <Card
        className="p-6 border-dashed cursor-pointer"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => e.preventDefault()}
        onDrop={(e) => {
          e.preventDefault();
          const files = Array.from(e.dataTransfer.files).filter((f) => /\.xlsx?$/i.test(f.name));
          if (files.length) addFiles(files);
        }}
      >
        <div className="flex flex-col items-center gap-2 text-muted-foreground">
          <Upload className="h-8 w-8" />
          <div className="font-medium">엑셀 파일을 드래그하거나 클릭해서 선택</div>
          <div className="text-xs">최근 업로드 파일 1개만 보관됩니다.</div>
        </div>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls"
          multiple
          className="hidden"
          onChange={(e) => {
            const files = Array.from(e.target.files ?? []);
            if (files.length) addFiles(files);
            e.target.value = "";
          }}
        />
      </Card>

      {jobs.length > 0 && (
        <div className="space-y-2">
          {jobs.map((j) => (
            <Card key={j.id} className="p-3 flex items-center gap-3">
              <FileSpreadsheet className="h-4 w-4 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <div className="truncate font-medium">{j.file.name}</div>
                {j.result && (
                  <div className="text-xs text-muted-foreground">
                    총 {j.result.total} · 신규 {j.result.inserted} · 중복 {j.result.skipped} · 스레드 {j.result.affectedRfiNos.length}
                  </div>
                )}
                {j.error && <div className="text-xs text-destructive">{j.error}</div>}
              </div>
              {j.status === "ready" && <Badge variant="outline">Ready</Badge>}
              {j.status === "processing" && <Loader2 className="h-4 w-4 animate-spin" />}
              {j.status === "done" && <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
              {j.status === "failed" && <AlertCircle className="h-4 w-4 text-destructive" />}
            </Card>
          ))}
          <div className="flex justify-end gap-2">
            <Button variant="outline" onClick={() => setJobs([])} disabled={running}>Clear</Button>
            <Button onClick={runAll} disabled={running || readyCount === 0}>
              {running ? <Loader2 className="h-4 w-4 animate-spin mr-1" /> : <Upload className="h-4 w-4 mr-1" />}
              임포트 실행 ({readyCount})
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
