import { useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import {
  Upload, FileSpreadsheet, X, CheckCircle2, AlertCircle, Loader2, Info,
} from "lucide-react";
import { useMdrImporter, type ImportFileStatus } from "./useMdrImporter";

const STATUS_BADGE: Record<ImportFileStatus, { label: string; cls: string }> = {
  pending: { label: "Pending", cls: "bg-muted text-muted-foreground" },
  parsing: { label: "Parsing", cls: "bg-muted text-muted-foreground" },
  ready: { label: "Ready", cls: "bg-primary/10 text-primary" },
  skipped: { label: "Skipped", cls: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200" },
  processing: { label: "Processing", cls: "bg-muted text-muted-foreground" },
  done: { label: "Done", cls: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-200" },
  failed: { label: "Failed", cls: "bg-destructive/10 text-destructive" },
};

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function ImportShell({ onImported }: { onImported?: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const {
    files, isRunning, addFiles, removeFile, clearAll, startImport, readyCount,
  } = useMdrImporter(onImported);

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
          <h2 className="text-xl font-semibold tracking-tight">MDR Import</h2>
          <p className="text-sm text-muted-foreground">
            건물·분야별 MDR Excel(.xlsx, .xls)을 업로드하세요. SUMMARY(00_...) 파일은 자동으로 건너뜁니다.
          </p>
        </div>
        <Button variant="outline" size="sm" asChild>
          <Link to="/design/import/logs">View Import Logs</Link>
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
            <p className="text-xs text-muted-foreground">.xlsx, .xls — multi-sheet supported</p>
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
              <CardDescription>
                {readyCount} ready to import
                {files.some((f) => f.status === "skipped") && (
                  <span className="ml-2 text-amber-600">
                    · {files.filter((f) => f.status === "skipped").length} skipped
                  </span>
                )}
              </CardDescription>
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
                          {f.building && ` · 건물 ${f.building}`}
                          {f.sheetNames && ` · ${f.sheetNames.length} sheet(s)`}
                          {f.parsedCount != null && ` · ${f.parsedCount} rows parsed`}
                        </p>
                        {f.skipReason && (
                          <div className="mt-2 flex items-start gap-2 rounded border border-amber-400/40 bg-amber-50/60 dark:bg-amber-900/20 p-2 text-xs text-amber-700 dark:text-amber-300">
                            <Info className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                            <span>{f.skipReason}</span>
                          </div>
                        )}
                        {f.validationWarnings && f.validationWarnings.length > 0 && (
                          <details className="mt-1 text-xs">
                            <summary className="cursor-pointer text-amber-600">
                              Validation 경고 {f.validationWarnings.length}건
                            </summary>
                            <ul className="mt-1 space-y-0.5 pl-4">
                              {f.validationWarnings.map((w, i) => (
                                <li key={i} className="font-mono text-[11px]">{w}</li>
                              ))}
                            </ul>
                          </details>
                        )}
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
