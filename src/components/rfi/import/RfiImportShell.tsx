import { useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2,
} from "lucide-react";
import { useRfiImporter, type RfiImportFileStatus } from "./useRfiImporter";

const STATUS_BADGE: Record<RfiImportFileStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  parsing: { label: "Parsing", cls: "bg-muted text-muted-foreground" },
  ready: { label: "Ready", cls: "bg-primary/10 text-primary" },
  processing: { label: "Processing", cls: "bg-muted text-muted-foreground" },
  done: { label: "Done", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  failed: { label: "Failed", cls: "bg-destructive/10 text-destructive" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function RfiImportShell({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    files, isRunning, addFiles, removeFile, clearAll, startImport, readyCount,
  } = useRfiImporter(onImported);

  const blocked = isRunning;

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    if (blocked) return;
    addFiles(Array.from(e.dataTransfer.files));
  }, [addFiles, blocked]);

  const onSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    addFiles(e.target.files ? Array.from(e.target.files) : []);
    if (inputRef.current) inputRef.current.value = "";
  }, [addFiles]);

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-xl font-semibold tracking-tight">RFI Import</h2>
          <p className="text-sm text-muted-foreground">
            RFI(Request for Information) Excel(.xlsx, .xls)을 업로드하세요. 동일 행은 자동 중복 제거되며, 최근 원본 파일 1개만 보관됩니다.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/design/rfi/import/logs">View Import Logs</Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">1. Upload Files</CardTitle>
          <CardDescription>드래그-드롭 또는 클릭으로 .xlsx / .xls 파일을 선택하세요.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={onDrop}
            className={`flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-10 text-center transition ${
              blocked ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary hover:bg-accent/30"
            }`}
            onClick={() => !blocked && inputRef.current?.click()}
          >
            <Upload className="h-8 w-8 text-muted-foreground" />
            <p className="text-sm font-medium">Excel 파일을 여기로 드롭하거나 클릭하여 선택</p>
            <p className="text-xs text-muted-foreground">.xlsx, .xls — 다중 파일 지원</p>
            <input
              ref={inputRef} type="file" multiple accept=".xlsx,.xls" className="hidden"
              onChange={onSelect} disabled={blocked}
            />
          </div>
        </CardContent>
      </Card>

      {files.length > 0 && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base">2. Files ({files.length})</CardTitle>
              <CardDescription>{readyCount} ready to import</CardDescription>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={clearAll} disabled={isRunning}>
                Clear all
              </Button>
              <Button size="sm" onClick={startImport} disabled={isRunning || readyCount === 0}>
                {isRunning ? (
                  <><Loader2 className="mr-2 h-3 w-3 animate-spin" />Importing…</>
                ) : (
                  `Start import (${readyCount})`
                )}
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {files.map((f) => {
              const badge = STATUS_BADGE[f.status];
              return (
                <div key={f.id} className="rounded border p-3">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <FileSpreadsheet className="mt-0.5 h-5 w-5 shrink-0 text-muted-foreground" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{f.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {formatSize(f.size)}
                          {f.parsedCount != null && ` · ${f.parsedCount} rows parsed`}
                        </p>
                        {f.error && (
                          <div className="mt-2 rounded border border-destructive/30 bg-destructive/5 p-2 text-xs text-destructive">
                            <p className="font-medium">⚠ {f.error}</p>
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge className={badge.cls}>{badge.label}</Badge>
                      <Button
                        variant="ghost" size="icon" className="h-7 w-7"
                        onClick={() => removeFile(f.id)} disabled={isRunning}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {f.status === "processing" && <Progress value={50} className="mt-2 h-1.5" />}
                  {f.result && (
                    <div className="mt-2 flex flex-wrap gap-2 text-xs">
                      <Badge variant="outline" className="border-emerald-300 text-emerald-700">
                        <CheckCircle2 className="mr-1 h-3 w-3" />Inserted: {f.result.inserted}
                      </Badge>
                      {f.result.skipped > 0 && (
                        <Badge variant="outline" className="border-amber-400 text-amber-700">
                          Skipped: {f.result.skipped}
                        </Badge>
                      )}
                      <Badge variant="outline">
                        Total: {f.result.total}
                      </Badge>
                      <Badge variant="outline">
                        Threads: {f.result.affectedRfiNos.length}
                      </Badge>
                    </div>
                  )}
                  {f.status === "failed" && !f.error && (
                    <div className="mt-2 text-xs text-destructive flex items-center gap-1">
                      <AlertCircle className="h-3 w-3" /> Import failed
                    </div>
                  )}
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
