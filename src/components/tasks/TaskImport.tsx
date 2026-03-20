import { useState, useRef, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Upload, Download, FileSpreadsheet, CheckCircle, XCircle, AlertTriangle } from "lucide-react";
import { toast } from "sonner";
import { useAuthContext } from "@/components/layout/AppLayout";
import * as XLSX from "xlsx";

// Mapping of possible header names → canonical keys
const HEADER_ALIASES: Record<string, string> = {
  "title": "title",
  "subject": "title",
  "category": "category",
  "action plan": "actionPlan",
  "actionplan": "actionPlan",
  "milestone": "milestone",
  "team code": "teamCode",
  "teamcode": "teamCode",
  "team": "teamCode",
  "part code": "partCode",
  "partcode": "partCode",
  "part": "partCode",
  "assignee": "assignee",
  "start date": "startDate",
  "startdate": "startDate",
  "start": "startDate",
  "end date": "endDate",
  "enddate": "endDate",
  "finish": "endDate",
  "actual %": "actualProgress",
  "actual%": "actualProgress",
  "actual finish": "actualFinish",
  "actualfinish": "actualFinish",
};

// Columns that are computed / ignored on import
const IGNORED_HEADERS = ["d day", "d-day", "dday", "plan %", "plan%", "차이 %", "차이%", "gap", "gap %", "gap%"];

interface ParsedRow {
  title: string;
  category: string;
  actionPlan: string;
  milestoneName: string;
  teamCode: string;
  partCode: string;
  assigneeName: string;
  startDate: string;
  endDate: string;
  actualProgress: number;
  actualFinish: string;
  teamId: string | null;
  partId: string | null;
  assigneeId: string | null;
  milestoneId: string | null;
  errors: string[];
  isDuplicate: boolean;
}

const DISPLAY_COLUMNS = ["Subject", "Assignee", "Action Plan", "Team/Part", "Start", "Finish", "Actual %", "Actual Finish"];

export function TaskImportComponent() {
  const { memberId } = useAuthContext();
  const [parsedRows, setParsedRows] = useState<ParsedRow[]>([]);
  const [importing, setImporting] = useState(false);
  const [validated, setValidated] = useState(false);
  const [includeDuplicates, setIncludeDuplicates] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("id, code, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("id, code, team_id");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members-with-parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name, team_id, part_id");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: existingTasks = [] } = useQuery({
    queryKey: ["existing-tasks-for-import"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("title, assignee_id, start_date, end_date").is("deleted_at", null);
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const existingTaskKeys = useMemo(() => {
    const keys = new Set<string>();
    existingTasks.forEach(t => {
      keys.add(`${t.title}|${t.assignee_id}|${t.start_date}|${t.end_date}`);
    });
    return keys;
  }, [existingTasks]);

  const handleDownloadTemplate = () => {
    const link = document.createElement("a");
    link.href = "/templates/ALSMK_Temp.xlsx";
    link.download = "ALSMK_Temp.xlsx";
    link.click();
  };

  const isValidDate = (y: number, m: number, d: number): boolean => {
    const dt = new Date(y, m - 1, d);
    return dt.getFullYear() === y && dt.getMonth() === m - 1 && dt.getDate() === d;
  };

  const fmt = (y: number, m: number, d: number): string =>
    `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;

  const parseDate = (val: any): string => {
    if (!val) return "";

    // Excel serial date number
    if (typeof val === "number") {
      const d = XLSX.SSF.parse_date_code(val);
      if (d && isValidDate(d.y, d.m, d.d)) return fmt(d.y, d.m, d.d);
      return ""; // invalid serial date
    }

    // Already a Date object
    if (val instanceof Date && !isNaN(val.getTime())) {
      return fmt(val.getFullYear(), val.getMonth() + 1, val.getDate());
    }

    const s = String(val).trim();

    // YYYY-MM-DD
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
    if (isoMatch) {
      const [, ys, ms, ds] = isoMatch;
      const y = Number(ys), m = Number(ms), d = Number(ds);
      if (isValidDate(y, m, d)) return fmt(y, m, d);
      return ""; // e.g. 2026-09-31
    }

    // M/D/YY or M/D/YYYY
    const mdyMatch = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
    if (mdyMatch) {
      const [, ms, ds, ys] = mdyMatch;
      let y = Number(ys), m = Number(ms), d = Number(ds);
      if (y < 100) y += 2000; // 26 → 2026
      if (isValidDate(y, m, d)) return fmt(y, m, d);
      return "";
    }

    // Fallback: try native Date
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      return fmt(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
    }
    return "";
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setValidated(false);

    const reader = new FileReader();
    reader.onload = (evt) => {
      const data = new Uint8Array(evt.target?.result as ArrayBuffer);
      const wb = XLSX.read(data, { type: "array" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1 });

      if (rows.length < 2) {
        toast.error("파일에 데이터가 없습니다.");
        return;
      }

      // Build column index map from headers
      const headers = (rows[0] ?? []).map((h: any) => String(h ?? "").trim().toLowerCase());
      const colMap: Record<string, number> = {};
      headers.forEach((h, i) => {
        if (IGNORED_HEADERS.includes(h)) return;
        const key = HEADER_ALIASES[h];
        if (key) colMap[key] = i;
      });

      if (!colMap.title && !colMap.startDate) {
        toast.error("헤더를 인식할 수 없습니다. Subject/Title, Start 등의 컬럼명을 확인하세요.");
        return;
      }

      const dataRows = rows.slice(1).filter(r => r.some(c => c != null && String(c).trim()));

      const parsed: ParsedRow[] = dataRows.map(row => {
        const get = (key: string) => colMap[key] !== undefined ? String(row[colMap[key]] ?? "").trim() : "";
        const title = get("title");
        const category = get("category");
        const actionPlan = get("actionPlan");
        const milestoneName = get("milestone");
        const teamCode = get("teamCode").toUpperCase();
        const partCode = get("partCode").toUpperCase();
        const assigneeName = get("assignee");
        const startDate = parseDate(colMap.startDate !== undefined ? row[colMap.startDate] : "");
        const endDate = parseDate(colMap.endDate !== undefined ? row[colMap.endDate] : "");
        const actualProgressStr = get("actualProgress").replace("%", "");
        const actualProgress = actualProgressStr ? parseInt(actualProgressStr, 10) : 0;
        const actualFinish = parseDate(colMap.actualFinish !== undefined ? row[colMap.actualFinish] : "");

        const errors: string[] = [];

        if (!title) errors.push("Subject 필수");
        if (!assigneeName) errors.push("Assignee 필수");
        if (!startDate || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)) errors.push("Start 형식 오류");
        if (!endDate || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) errors.push("Finish 형식 오류");

        // Resolve assignee (required)
        const member = assigneeName ? members.find(m => m.name.toLowerCase() === assigneeName.toLowerCase()) : null;
        if (assigneeName && !member) errors.push(`Assignee '${assigneeName}' 없음`);

        // Team resolution: Excel teamCode → assignee's team (assignee is primary source)
        let resolvedTeamId: string | null = null;
        if (teamCode) {
          const team = teams.find(t => t.code.toUpperCase() === teamCode);
          if (team) resolvedTeamId = team.id;
          else errors.push(`Team '${teamCode}' 없음`);
        } else if (member?.team_id) {
          resolvedTeamId = member.team_id;
        } else if (member && !member.team_id) {
          errors.push(`Assignee '${assigneeName}' 소속팀 미지정`);
        }

        // Part resolution: Excel partCode → assignee's part
        let resolvedPartId: string | null = null;
        if (partCode) {
          const part = parts.find(p => p.code.toUpperCase() === partCode && p.team_id === resolvedTeamId);
          if (part) resolvedPartId = part.id;
          else errors.push(`Part '${partCode}' 없음`);
        } else if (member?.part_id) {
          resolvedPartId = member.part_id;
        }

        const milestone = milestoneName ? milestones.find(m => m.name.toLowerCase() === milestoneName.toLowerCase()) : null;
        if (milestoneName && !milestone) errors.push(`Milestone '${milestoneName}' 없음`);

        const isDuplicate = !!(member?.id && startDate && endDate &&
          existingTaskKeys.has(`${title}|${member.id}|${startDate}|${endDate}`));

        return {
          title, category, actionPlan, milestoneName, teamCode, partCode, assigneeName,
          startDate, endDate, actualProgress, actualFinish,
          teamId: resolvedTeamId,
          partId: resolvedPartId,
          assigneeId: member?.id ?? null,
          milestoneId: milestone?.id ?? null,
          errors,
          isDuplicate,
        };
      });

      setParsedRows(parsed);
      setValidated(true);
    };
    reader.readAsArrayBuffer(file);
  };

  const validRows = parsedRows.filter(r => r.errors.length === 0 && (includeDuplicates || !r.isDuplicate));
  const errorRows = parsedRows.filter(r => r.errors.length > 0);
  const duplicateRows = parsedRows.filter(r => r.errors.length === 0 && r.isDuplicate);

  const handleImport = async () => {
    if (validRows.length === 0) {
      toast.error("유효한 행이 없습니다.");
      return;
    }
    setImporting(true);
    try {
      const inserts = validRows.map(r => ({
        title: r.title,
        category: r.category || null,
        action_plan: r.actionPlan || null,
        team_id: r.teamId!,
        part_id: r.partId,
        assignee_id: r.assigneeId,
        milestone_id: r.milestoneId,
        start_date: r.startDate,
        end_date: r.endDate,
        current_progress: r.actualProgress,
        actual_finish: r.actualFinish || null,
        issue_flag: "normal" as const,
      }));

      const { error } = await supabase.from("tasks").insert(inserts);
      if (error) throw error;

      toast.success(`${validRows.length}건 import 완료${errorRows.length > 0 ? `, ${errorRows.length}건 실패` : ""}`);
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
      setParsedRows([]);
      setValidated(false);
      if (fileRef.current) fileRef.current.value = "";
    } catch (err: any) {
      toast.error(err.message || "Import 실패");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <Button variant="outline" onClick={handleDownloadTemplate}>
          <Download className="mr-2 h-4 w-4" /> Download Template
        </Button>
        <Button onClick={() => fileRef.current?.click()}>
          <Upload className="mr-2 h-4 w-4" /> Upload File
        </Button>
        <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileUpload} />
        <span className="text-xs text-muted-foreground">
          Assignee 기준으로 Team/Part가 자동 결정됩니다
        </span>
      </div>

      {validated && parsedRows.length > 0 && (
        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <CardTitle className="text-base flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4" /> Validation Result
              </CardTitle>
              <div className="flex items-center gap-2 text-xs">
                <Badge variant="default" className="gap-1">
                  <CheckCircle className="h-3 w-3" /> {validRows.length} valid
                </Badge>
                {duplicateRows.length > 0 && (
                  <Badge variant="outline" className="gap-1 border-yellow-500 text-yellow-500">
                    <AlertTriangle className="h-3 w-3" /> {duplicateRows.length} duplicates
                  </Badge>
                )}
                {errorRows.length > 0 && (
                  <Badge variant="destructive" className="gap-1">
                    <XCircle className="h-3 w-3" /> {errorRows.length} errors
                  </Badge>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto scrollbar-thin">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="text-xs w-12">#</TableHead>
                    {DISPLAY_COLUMNS.map((h, i) => (
                      <TableHead key={i} className="text-xs">{h}</TableHead>
                    ))}
                    <TableHead className="text-xs">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {parsedRows.map((row, ri) => {
                    const hasError = row.errors.length > 0;
                    const teamName = row.teamId ? teams.find(t => t.id === row.teamId)?.code ?? "—" : "—";
                    const partName = row.partId ? parts.find(p => p.id === row.partId)?.code ?? "" : "";
                    const teamPartLabel = partName ? `${teamName}/${partName}` : teamName;
                    const rowClass = hasError ? "bg-destructive/10" : row.isDuplicate ? "bg-yellow-500/10" : "";
                    return (
                      <TableRow key={ri} className={rowClass}>
                        <TableCell className="text-xs font-mono">{ri + 1}</TableCell>
                        <TableCell className="text-xs">{row.title || "—"}</TableCell>
                        <TableCell className="text-xs">{row.assigneeName || "—"}</TableCell>
                        <TableCell className="text-xs max-w-[200px] truncate">{row.actionPlan || "—"}</TableCell>
                        <TableCell className="text-xs font-mono text-muted-foreground">{teamPartLabel}</TableCell>
                        <TableCell className="text-xs font-mono">{row.startDate}</TableCell>
                        <TableCell className="text-xs font-mono">{row.endDate}</TableCell>
                        <TableCell className="text-xs font-mono text-right">{row.actualProgress}%</TableCell>
                        <TableCell className="text-xs font-mono">{row.actualFinish || "—"}</TableCell>
                        <TableCell className="text-xs">
                          {hasError ? (
                            <span className="text-destructive text-[10px]">{row.errors.join(", ")}</span>
                          ) : row.isDuplicate ? (
                            <span className="text-yellow-500 text-[10px] flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" /> Duplicate
                            </span>
                          ) : (
                            <CheckCircle className="h-3.5 w-3.5 text-primary" />
                          )}
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            <div className="mt-4 flex items-center justify-between gap-2">
              {duplicateRows.length > 0 && (
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer">
                  <Checkbox
                    checked={includeDuplicates}
                    onCheckedChange={(v) => setIncludeDuplicates(!!v)}
                  />
                  Include {duplicateRows.length} duplicate(s) in import
                </label>
              )}
              <div className="ml-auto">
                <Button
                  onClick={handleImport}
                  disabled={validRows.length === 0 || importing}
                >
                  {importing ? "Importing..." : `Import ${validRows.length} Tasks`}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
