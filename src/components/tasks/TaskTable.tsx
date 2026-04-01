import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, ChevronRight, ChevronDown, X, MessageSquare, Network } from "lucide-react";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { calcPlannedProgress, weightedAvg } from "@/lib/mockData";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  taskCode: 140,
  assignee: 100,
  category: 100,
  subject: 260,
  actionPlan: 200,
  start: 100,
  finish: 100,
  dday: 70,
  plan: 70,
  actual: 70,
  gap: 70,
  actualFinish: 110,
};

function ResizeHandle({ onResize }: { onResize: (delta: number) => void }) {
  const startX = useRef(0);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    startX.current = e.clientX;

    const onMouseMove = (ev: MouseEvent) => {
      onResize(ev.clientX - startX.current);
      startX.current = ev.clientX;
    };
    const onMouseUp = () => {
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
    };
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);
  }, [onResize]);

  return (
    <div
      onMouseDown={onMouseDown}
      className="absolute right-0 top-0 bottom-0 w-1.5 cursor-col-resize hover:bg-primary/40 active:bg-primary/60 z-10"
    />
  );
}

interface TaskTableProps {
  filterMine?: boolean;
  /** "mine" = only my assigned tasks, "team" = my team's tasks, "project" = all tasks read-only */
  filterMode?: "mine" | "team" | "project";
  /** When toggled, collapse or expand all summary tasks */
  allCollapsed?: boolean;
}

export function TaskTable({ filterMine, filterMode, allCollapsed }: TaskTableProps) {
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const queryClient = useQueryClient();
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [editingProgressValue, setEditingProgressValue] = useState("");
  const [sortColumns, setSortColumns] = useState<Array<{ key: string; dir: "asc" | "desc" }>>([{ key: "taskCode", dir: "asc" }]);
  const [collapsedSummaries, setCollapsedSummaries] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem("task-table-collapsed");
      if (saved) return new Set(JSON.parse(saved));
    } catch {}
    return new Set();
  });

  const toggleCollapse = useCallback((summaryId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setCollapsedSummaries(prev => {
      const next = new Set(prev);
      if (next.has(summaryId)) next.delete(summaryId);
      else next.add(summaryId);
      localStorage.setItem("task-table-collapsed", JSON.stringify([...next]));
      return next;
    });
  }, []);

  // allCollapsed toggle ref to detect changes
  const prevAllCollapsedRef = useRef(allCollapsed);

  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("task-table-col-widths");
      if (saved) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_COL_WIDTHS };
  });

  const handleSort = useCallback((key: string, shiftKey: boolean) => {
    setSortColumns(prev => {
      if (shiftKey) {
        const idx = prev.findIndex(s => s.key === key);
        if (idx === -1) return [...prev, { key, dir: "asc" }];
        const current = prev[idx];
        if (current.dir === "asc") return prev.map((s, i) => i === idx ? { ...s, dir: "desc" } : s);
        // 3rd click: remove
        return prev.filter((_, i) => i !== idx);
      }
      // Normal click: single sort
      if (prev.length === 1 && prev[0].key === key) {
        return [{ key, dir: prev[0].dir === "asc" ? "desc" : "asc" }];
      }
      return [{ key, dir: "asc" }];
    });
  }, []);

  const handleColResize = useCallback((col: string) => (delta: number) => {
    setColWidths(prev => {
      const next = { ...prev, [col]: Math.max(40, (prev[col] ?? 80) + delta) };
      localStorage.setItem("task-table-col-widths", JSON.stringify(next));
      return next;
    });
  }, []);

  const { data: teams = [] } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: tasks = [], isLoading } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").is("deleted_at", null).order("title", { ascending: true }).order("start_date", { ascending: true }).order("end_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: cpmMappedTaskIds } = useQuery({
    queryKey: ["cpm_mapped_task_ids"],
    queryFn: async () => {
      const { data } = await supabase.from("cpm_task_mappings").select("task_id");
      return new Set(data?.map(d => d.task_id) ?? []);
    },
    staleTime: 30_000,
  });

  // Expand mapped IDs to include parent Summary IDs
  const cpmDisplayIds = useMemo(() => {
    if (!cpmMappedTaskIds || !tasks.length) return new Set<string>();
    const ids = new Set(cpmMappedTaskIds);
    tasks.forEach((task: any) => {
      if (task.parent_id && ids.has(task.id)) {
        ids.add(task.parent_id);
      }
    });
    return ids;
  }, [cpmMappedTaskIds, tasks]);
  useEffect(() => {
    if (allCollapsed === prevAllCollapsedRef.current) return;
    prevAllCollapsedRef.current = allCollapsed;
    if (allCollapsed) {
      const summaryIds = tasks.filter((t: any) => t.is_summary).map((t: any) => t.id);
      const next = new Set(summaryIds);
      localStorage.setItem("task-table-collapsed", JSON.stringify([...next]));
      setCollapsedSummaries(next);
    } else {
      localStorage.setItem("task-table-collapsed", JSON.stringify([]));
      setCollapsedSummaries(new Set());
    }
  }, [allCollapsed, tasks]);

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, name, team_id, is_pm");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const myMember = useMemo(() => {
    if (!memberId) return null;
    return members.find(m => m.id === memberId) ?? null;
  }, [members, memberId]);

  const myTeamId = myMember?.team_id ?? null;
  const isPm = myMember?.is_pm ?? false;

  const { data: milestones = [] } = useQuery({
    queryKey: ["milestones"],
    queryFn: async () => {
      const { data, error } = await supabase.from("milestones").select("id, name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Fetch comment counts per task (total + instruction count)
  const { data: commentCounts = {} } = useQuery({
    queryKey: ["task_comment_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("task_comments")
        .select("task_id, type");
      if (error) throw error;
      const counts: Record<string, { total: number; instructions: number }> = {};
      for (const row of data) {
        if (!counts[row.task_id]) counts[row.task_id] = { total: 0, instructions: 0 };
        counts[row.task_id].total++;
        if (row.type === "instruction") counts[row.task_id].instructions++;
      }
      return counts;
    },
    staleTime: 30_000,
  });

  // Realtime: refresh comment counts on INSERT/DELETE/UPDATE
  useEffect(() => {
    const channel = supabase
      .channel("task_comment_counts_rt")
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "task_comments",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["task_comment_counts"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  // Realtime: refresh tasks on any change (e.g. summary rollup recalculation)
  useEffect(() => {
    const channel = supabase
      .channel(`tasks_rt_${Math.random()}`)
      .on("postgres_changes", {
        event: "*",
        schema: "public",
        table: "tasks",
      }, () => {
        queryClient.invalidateQueries({ queryKey: ["tasks"] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [queryClient]);

  const readOnly = filterMode === "project";

  let filtered = [...tasks];

  if (filterMine && !isAdmin && !isPm && filterMode !== "project") {
    if (filterMode === "mine") {
      filtered = filtered.filter(t => t.assignee_id === memberId);
    } else if (filterMode === "team") {
      filtered = filtered.filter(t => t.team_id === myTeamId);
    } else {
      filtered = filtered.filter(t => t.assignee_id === memberId || t.team_id === myTeamId);
    }
    // Include parent summaries for visible subtasks
    const visibleParentIds = new Set(filtered.filter(t => t.parent_id).map(t => t.parent_id!));
    const missingParents = tasks.filter(t => visibleParentIds.has(t.id) && !filtered.some(f => f.id === t.id));
    filtered = [...filtered, ...missingParents];
  }
  if (filterMine && (isAdmin || isPm) && memberFilter !== "all") {
    filtered = filtered.filter(t => t.assignee_id === memberFilter);
  }
  if (teamFilter !== "all") filtered = filtered.filter(t => t.team_id === teamFilter);
  if (flagFilter !== "all") filtered = filtered.filter(t => t.issue_flag === flagFilter);
  if (searchQuery.trim()) {
    const q = searchQuery.trim().toLowerCase();
    filtered = filtered.filter(t =>
      (t.task_code?.toLowerCase().includes(q)) ||
      t.title.toLowerCase().includes(q) ||
      (t.action_plan?.toLowerCase().includes(q)) ||
      (t.category?.toLowerCase().includes(q))
    );
  }

  // Group-aware sorting: summaries+independents sorted together, subtasks inserted after their parent
  const getVal = useCallback((t: typeof filtered[0], key: string): any => {
    switch (key) {
      case "taskCode": return t.task_code ?? "";
      case "assignee": return members.find(m => m.id === t.assignee_id)?.name ?? "";
      case "category": return t.category ?? "";
      case "subject": return t.title;
      case "actionPlan": return t.action_plan ?? "";
      case "start": return t.start_date;
      case "finish": return t.end_date;
      case "dday": return t.actual_finish ? Infinity : differenceInCalendarDays(parseLocalDate(t.end_date), startOfDay(new Date()));
      case "plan": {
        const isSum = (t as any).is_summary === true;
        return isSum
          ? weightedAvg(tasks.filter(c => c.parent_id === t.id && !c.deleted_at), c => calcPlannedProgress(c.start_date, c.end_date))
          : calcPlannedProgress(t.start_date, t.end_date);
      }
      case "actual": return t.current_progress;
      case "gap": {
        const isSum2 = (t as any).is_summary === true;
        const p = isSum2
          ? weightedAvg(tasks.filter(c => c.parent_id === t.id && !c.deleted_at), c => calcPlannedProgress(c.start_date, c.end_date))
          : calcPlannedProgress(t.start_date, t.end_date);
        return t.current_progress - p;
      }
      case "actualFinish": return t.actual_finish ?? "zzz";
      default: return "";
    }
  }, []);

  const compareFn = useCallback((a: typeof filtered[0], b: typeof filtered[0]) => {
    for (const { key, dir } of sortColumns) {
      const valA = getVal(a, key);
      const valB = getVal(b, key);
      const cmp = typeof valA === "number" ? valA - valB : String(valA).localeCompare(String(valB));
      if (cmp !== 0) return dir === "asc" ? cmp : -cmp;
    }
    return 0;
  }, [sortColumns, getVal]);

  // Separate into groups, sort, then flatten with hierarchy
  const grouped = useMemo(() => {
    const subtasksMap = new Map<string, typeof filtered>();
    const mainTasks: typeof filtered = [];

    for (const t of filtered) {
      if (t.parent_id && filtered.some(p => p.id === t.parent_id)) {
        if (!subtasksMap.has(t.parent_id)) subtasksMap.set(t.parent_id, []);
        subtasksMap.get(t.parent_id)!.push(t);
      } else {
        mainTasks.push(t);
      }
    }

    mainTasks.sort(compareFn);

    const result: typeof filtered = [];
    for (const item of mainTasks) {
      result.push(item);
      const children = subtasksMap.get(item.id);
      if (children) {
        children.sort(compareFn);
        if (!collapsedSummaries.has(item.id)) {
          result.push(...children);
        }
      }
    }
    return result;
  }, [filtered, compareFn, collapsedSummaries]);

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;

  const handleInlineProgressSave = async (taskId: string) => {
    const val = parseInt(editingProgressValue, 10);
    if (isNaN(val) || val < 0 || val > 100) {
      toast.error("0~100 사이 값을 입력하세요.");
      setEditingProgressId(null);
      return;
    }
    try {
      const { error } = await supabase.from("tasks").update({ current_progress: val }).eq("id", taskId);
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["tasks"] });
    } catch (err: any) {
      toast.error(err.message || "Failed to update progress.");
    }
    setEditingProgressId(null);
  };

  return (
    <>
      <Card className="flex flex-col h-full">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base flex items-center gap-2">
              Tasks ({filtered.length})
              {filterMine && (isAdmin || isPm) && (
                <Badge variant="outline" className="text-[10px] border-primary text-primary">{isAdmin ? "Admin View" : "PM View"}</Badge>
              )}
              {sortColumns.length > 1 && (
                <button onClick={() => setSortColumns([{ key: "taskCode", dir: "asc" }])} className="inline-flex items-center gap-1 text-[10px] text-muted-foreground hover:text-foreground transition-colors">
                  <X className="h-3 w-3" /> Clear Sort
                </button>
              )}
            </CardTitle>
            <div className="flex gap-2 flex-wrap items-center">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  placeholder="Search tasks..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-[180px] h-8 text-xs pl-8"
                />
              </div>
              {filterMine && (isAdmin || isPm) && (
                <Select value={memberFilter} onValueChange={setMemberFilter}>
                  <SelectTrigger className="w-[140px] h-8 text-xs">
                    <SelectValue placeholder="All Members" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Members</SelectItem>
                    {members.map(m => <SelectItem key={m.id} value={m.id}>{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {teams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
                </SelectContent>
              </Select>
              <Select value={flagFilter} onValueChange={setFlagFilter}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue placeholder="All Flags" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Flags</SelectItem>
                  <SelectItem value="normal">Normal</SelectItem>
                  <SelectItem value="warning">Warning</SelectItem>
                  <SelectItem value="critical">Critical</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent className="flex-1 min-h-0 overflow-hidden flex flex-col">
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-auto scrollbar-thin flex-1 min-h-0">
              <table className="w-full caption-bottom text-sm table-fixed" style={{ minWidth: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
                <TableHeader className="sticky top-0 z-10 bg-card">
                  <TableRow>
                    {[
                      { key: "taskCode", label: "Task Code", align: "" },
                      { key: "assignee", label: "Assignee", align: "" },
                      { key: "category", label: "Category", align: "" },
                      { key: "subject", label: "Subject", align: "" },
                      { key: "actionPlan", label: "Action Plan", align: "" },
                      { key: "start", label: "Start", align: "" },
                      { key: "finish", label: "Finish", align: "" },
                      { key: "dday", label: "D-Day", align: "text-right" },
                      { key: "plan", label: "Plan %", align: "text-right" },
                      { key: "actual", label: "Actual %", align: "text-right" },
                      { key: "gap", label: "차이 %", align: "text-right" },
                      { key: "actualFinish", label: "Actual Finish", align: "" },
                    ].map(col => (
                      <TableHead
                        key={col.key}
                        className={`relative select-none cursor-pointer hover:bg-accent/50 ${col.align}`}
                        style={{ width: colWidths[col.key], minWidth: 40 }}
                        onClick={(e) => handleSort(col.key, e.shiftKey)}
                      >
                        {(() => {
                          const sortIdx = sortColumns.findIndex(s => s.key === col.key);
                          const sortInfo = sortIdx !== -1 ? sortColumns[sortIdx] : null;
                          const priorityLabels = ["①", "②", "③", "④", "⑤"];
                          return (
                            <span className="inline-flex items-center gap-1">
                              {col.label}
                              {sortInfo ? (
                                <>
                                  {sortInfo.dir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />}
                                  {sortColumns.length > 1 && <span className="text-[10px] text-primary font-bold">{priorityLabels[sortIdx] ?? sortIdx + 1}</span>}
                                </>
                              ) : (
                                <ArrowUpDown className="h-3 w-3 opacity-30" />
                              )}
                            </span>
                          );
                        })()}
                        <ResizeHandle onResize={handleColResize(col.key)} />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.length === 0 ? (
                    <TableRow><TableCell colSpan={12} className="text-center text-muted-foreground">No tasks found</TableCell></TableRow>
                  ) : grouped.map((task) => {
                    const isSummary = (task as any).is_summary === true;
                    const hasParent = !!(task as any).parent_id;
                    const hasChildren = isSummary && tasks.some(t => t.parent_id === task.id);
                    const isCollapsed = collapsedSummaries.has(task.id);
                    const planned = isSummary
                      ? weightedAvg(
                          tasks.filter(t => t.parent_id === task.id && !t.deleted_at),
                          t => calcPlannedProgress(t.start_date, t.end_date)
                        )
                      : calcPlannedProgress(task.start_date, task.end_date);
                    const gap = task.current_progress - planned;
                    const isEditingThis = editingProgressId === task.id;
                    const isCompleted = task.current_progress >= 100 || !!task.actual_finish;
                    const isNotStarted = task.current_progress === 0 && !task.actual_finish;
                    const statusTextColor = isCompleted
                      ? "text-muted-foreground/50"
                      : isNotStarted
                        ? ""
                        : gap >= 0
                          ? "text-success"
                          : "text-destructive";
                    const completedMuted = isCompleted ? "text-muted-foreground/50" : "";
                    return (
                      <TableRow key={task.id} data-task-id={task.id} className={`cursor-pointer hover:bg-accent/50 ${isSummary ? "bg-primary/10 border-l-2 border-l-primary" : ""}`} onClick={() => setSelectedTaskId(task.id)}>
                        <TableCell className={`font-mono truncate ${statusTextColor} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.taskCode }}>
                          <span className="flex items-center gap-1">
                            {task.task_code}
                            {cpmDisplayIds.has(task.id) && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <Network className="h-3 w-3 text-info shrink-0" />
                                </TooltipTrigger>
                                <TooltipContent>CPM Activity에 매핑됨</TooltipContent>
                              </Tooltip>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className={`truncate ${statusTextColor} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.assignee }}>{members.find(m => m.id === task.assignee_id)?.name ?? "—"}</TableCell>
                        <TableCell className={`break-words whitespace-normal ${statusTextColor} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.category }}>{task.category ?? "—"}</TableCell>
                        <TableCell className={`break-words whitespace-normal ${statusTextColor} ${isSummary ? "font-semibold text-sm" : "text-sm font-medium"}`} style={{ width: colWidths.subject }}>
                          <span className={`flex items-center gap-1.5 ${hasParent ? "pl-6" : ""}`}>
                            {hasChildren && (
                              <button
                                onClick={(e) => toggleCollapse(task.id, e)}
                                className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors -ml-[22px]"
                              >
                                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            )}
                            <span className="break-words whitespace-normal">{task.title}</span>
                            {isCollapsed && hasChildren && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">({tasks.filter(t => t.parent_id === task.id).length})</span>
                            )}
                            {(() => {
                              const cc = commentCounts[task.id];
                              if (!cc || cc.total === 0) return null;
                              const hasInstr = cc.instructions > 0;
                              return (
                                <TooltipProvider delayDuration={200}>
                                  <Tooltip>
                                    <TooltipTrigger asChild>
                                      <span className={`shrink-0 inline-flex items-center gap-0.5 ${hasInstr ? "text-info" : "text-muted-foreground"}`}>
                                        <MessageSquare className="h-3.5 w-3.5" />
                                        <span className="text-[10px] font-semibold">{cc.total}</span>
                                      </span>
                                    </TooltipTrigger>
                                    <TooltipContent side="top" className="text-xs">
                                      {cc.total} comment{cc.total > 1 ? "s" : ""}{cc.instructions > 0 ? ` (${cc.instructions} instruction${cc.instructions > 1 ? "s" : ""})` : ""}
                                    </TooltipContent>
                                  </Tooltip>
                                </TooltipProvider>
                              );
                            })()}
                            {task.issue_flag === "warning" && (
                              <Badge variant="outline" className="shrink-0 border-warning text-warning text-[10px] px-1.5 py-0">Warning</Badge>
                            )}
                            {task.issue_flag === "critical" && (
                              <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">Critical</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className={`break-words whitespace-normal ${statusTextColor} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.actionPlan }}>
                          {task.action_plan ? (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block break-words whitespace-normal cursor-default">{task.action_plan}</span>
                                </TooltipTrigger>
                                <TooltipContent side="bottom" className="max-w-sm whitespace-pre-wrap text-xs">
                                  {task.action_plan}
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          ) : "—"}
                        </TableCell>
                        <TableCell className={`font-mono ${completedMuted} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.start }}>{task.start_date}</TableCell>
                        <TableCell className={`font-mono ${completedMuted} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.finish }}>{task.end_date}</TableCell>
                        {(() => {
                          const remaining = task.actual_finish
                            ? 0
                            : differenceInCalendarDays(parseLocalDate(task.end_date), startOfDay(new Date()));
                          return (
                            <TableCell
                              className={`text-right font-mono font-bold ${isSummary ? "text-sm" : "text-xs"} ${isCompleted ? 'text-muted-foreground/50' : remaining < 0 ? 'text-destructive' : remaining <= 7 ? 'text-warning' : 'text-primary'}`}
                              style={{ width: colWidths.dday }}
                            >
                              {task.actual_finish ? "Done" : remaining === 0 ? "0" : remaining > 0 ? `${remaining}` : `+${Math.abs(remaining)}`}
                            </TableCell>
                          );
                        })()}
                        <TableCell className={`text-right font-mono ${completedMuted} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.plan }}>{planned}%</TableCell>
                        <TableCell
                          className={`text-right font-mono ${completedMuted} ${isSummary ? "text-sm font-semibold" : "text-xs"}`}
                          style={{ width: colWidths.actual }}
                          onClick={(e) => {
                            if (readOnly) return;
                            e.stopPropagation();
                            setEditingProgressId(task.id);
                            setEditingProgressValue(String(task.current_progress));
                          }}
                        >
                          {isEditingThis && !readOnly ? (
                            <Input
                              type="number"
                              min={0}
                              max={100}
                              value={editingProgressValue}
                              onChange={e => setEditingProgressValue(e.target.value)}
                              onBlur={() => handleInlineProgressSave(task.id)}
                              onKeyDown={e => {
                                if (e.key === "Enter") handleInlineProgressSave(task.id);
                                if (e.key === "Escape") setEditingProgressId(null);
                              }}
                              className="h-7 w-16 text-right text-xs p-1"
                              autoFocus
                              onClick={e => e.stopPropagation()}
                            />
                          ) : (
                            <span className={readOnly ? "" : "cursor-text hover:underline"}>{task.current_progress}%</span>
                          )}
                        </TableCell>
                        <TableCell className={`text-right font-mono font-bold ${isSummary ? "text-sm" : "text-xs"} ${isCompleted ? 'text-muted-foreground/50' : gap >= 0 ? 'text-primary' : 'text-destructive'}`} style={{ width: colWidths.gap }}>
                          {gap >= 0 ? '+' : ''}{gap}%
                        </TableCell>
                        <TableCell className={`font-mono ${completedMuted} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.actualFinish }}>{task.actual_finish ?? "—"}</TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
      <TaskDetailDialog
        task={selectedTask}
        open={!!selectedTaskId}
        onOpenChange={(o) => !o && setSelectedTaskId(null)}
        teams={teams}
        members={members}
        milestones={milestones}
        readOnly={readOnly || (!isAdminOrPm && (selectedTask as any)?.is_summary === true) || (!isAdminOrPm && selectedTask?.assignee_id !== memberId)}
        isSummary={(selectedTask as any)?.is_summary === true}
        allTasks={tasks}
      />
    </>
  );
}
