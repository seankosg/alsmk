import { useState, useCallback, useRef, useMemo, useEffect } from "react";
import { ArrowUp, ArrowDown, ArrowUpDown, Search, ChevronRight, ChevronDown } from "lucide-react";
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
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";

const DEFAULT_COL_WIDTHS: Record<string, number> = {
  taskCode: 140,
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
  /** "mine" = only my assigned tasks, "team" = my team's tasks, undefined = all (legacy behavior) */
  filterMode?: "mine" | "team";
  /** When toggled, collapse or expand all summary tasks */
  allCollapsed?: boolean;
}

export function TaskTable({ filterMine, filterMode, allCollapsed }: TaskTableProps) {
  const { isAdmin, memberId } = useAuthContext();
  const queryClient = useQueryClient();
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [editingProgressValue, setEditingProgressValue] = useState("");
  const [sortKey, setSortKey] = useState<string | null>("taskCode");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
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
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("task-table-col-widths");
      if (saved) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_COL_WIDTHS };
  });

  const handleSort = useCallback((key: string) => {
    setSortKey(prev => {
      if (prev === key) {
        setSortDir(d => d === "asc" ? "desc" : "asc");
        return key;
      }
      setSortDir("asc");
      return key;
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
      const { data, error } = await supabase.from("tasks").select("*").order("title", { ascending: true }).order("start_date", { ascending: true }).order("end_date", { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

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

  let filtered = [...tasks];

  if (filterMine && !isAdmin && !isPm) {
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
  const compareFn = useCallback((a: typeof filtered[0], b: typeof filtered[0]) => {
    if (!sortKey) return 0;
    let valA: any, valB: any;
    switch (sortKey) {
      case "taskCode": valA = a.task_code ?? ""; valB = b.task_code ?? ""; break;
      case "category": valA = a.category ?? ""; valB = b.category ?? ""; break;
      case "subject": valA = a.title; valB = b.title; break;
      case "actionPlan": valA = a.action_plan ?? ""; valB = b.action_plan ?? ""; break;
      case "start": valA = a.start_date; valB = b.start_date; break;
      case "finish": valA = a.end_date; valB = b.end_date; break;
      case "dday": {
        valA = a.actual_finish ? Infinity : differenceInCalendarDays(parseLocalDate(a.end_date), startOfDay(new Date()));
        valB = b.actual_finish ? Infinity : differenceInCalendarDays(parseLocalDate(b.end_date), startOfDay(new Date()));
        break;
      }
      case "plan": valA = calcPlannedProgress(a.start_date, a.end_date); valB = calcPlannedProgress(b.start_date, b.end_date); break;
      case "actual": valA = a.current_progress; valB = b.current_progress; break;
      case "gap": valA = a.current_progress - calcPlannedProgress(a.start_date, a.end_date); valB = b.current_progress - calcPlannedProgress(b.start_date, b.end_date); break;
      case "actualFinish": valA = a.actual_finish ?? "zzz"; valB = b.actual_finish ?? "zzz"; break;
      default: return 0;
    }
    const cmp = typeof valA === "number" ? valA - valB : String(valA).localeCompare(String(valB));
    return sortDir === "asc" ? cmp : -cmp;
  }, [sortKey, sortDir]);

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
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">
              Tasks ({filtered.length})
              {filterMine && (isAdmin || isPm) && (
                <Badge variant="outline" className="ml-2 text-[10px] border-primary text-primary">{isAdmin ? "Admin View" : "PM View"}</Badge>
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
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">
              {Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} className="h-10 w-full" />)}
            </div>
          ) : (
            <div className="overflow-x-auto scrollbar-thin">
              <Table className="table-fixed" style={{ minWidth: Object.values(colWidths).reduce((a, b) => a + b, 0) }}>
                <TableHeader>
                  <TableRow>
                    {[
                      { key: "taskCode", label: "Task Code", align: "" },
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
                        onClick={() => handleSort(col.key)}
                      >
                        <span className="inline-flex items-center gap-1">
                          {col.label}
                          {sortKey === col.key ? (
                            sortDir === "asc" ? <ArrowUp className="h-3 w-3" /> : <ArrowDown className="h-3 w-3" />
                          ) : (
                            <ArrowUpDown className="h-3 w-3 opacity-30" />
                          )}
                        </span>
                        <ResizeHandle onResize={handleColResize(col.key)} />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {grouped.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">No tasks found</TableCell></TableRow>
                  ) : grouped.map((task) => {
                    const isSummary = (task as any).is_summary === true;
                    const hasParent = !!(task as any).parent_id;
                    const hasChildren = isSummary && tasks.some(t => t.parent_id === task.id);
                    const isCollapsed = collapsedSummaries.has(task.id);
                    const planned = calcPlannedProgress(task.start_date, task.end_date);
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
                      <TableRow key={task.id} className={`cursor-pointer hover:bg-accent/50 ${isSummary ? "bg-primary/10 border-l-2 border-l-primary" : ""}`} onClick={() => setSelectedTaskId(task.id)}>
                        <TableCell className={`font-mono truncate ${statusTextColor} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.taskCode }}>{task.task_code}</TableCell>
                        <TableCell className={`truncate ${statusTextColor} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.category }}>{task.category ?? "—"}</TableCell>
                        <TableCell className={`truncate ${statusTextColor} ${isSummary ? "font-semibold text-sm" : "text-sm font-medium"}`} style={{ width: colWidths.subject }}>
                          <span className={`flex items-center gap-1.5 ${hasParent ? "pl-6" : ""}`}>
                            {hasChildren && (
                              <button
                                onClick={(e) => toggleCollapse(task.id, e)}
                                className="shrink-0 p-0.5 rounded hover:bg-accent transition-colors -ml-[22px]"
                              >
                                {isCollapsed ? <ChevronRight className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                              </button>
                            )}
                            <span className="truncate">{task.title}</span>
                            {isCollapsed && hasChildren && (
                              <span className="shrink-0 text-[10px] text-muted-foreground">({tasks.filter(t => t.parent_id === task.id).length})</span>
                            )}
                            {task.issue_flag === "warning" && (
                              <Badge variant="outline" className="shrink-0 border-warning text-warning text-[10px] px-1.5 py-0">Warning</Badge>
                            )}
                            {task.issue_flag === "critical" && (
                              <Badge variant="destructive" className="shrink-0 text-[10px] px-1.5 py-0">Critical</Badge>
                            )}
                          </span>
                        </TableCell>
                        <TableCell className={`truncate ${statusTextColor} ${isSummary ? "text-sm font-semibold" : "text-xs"}`} style={{ width: colWidths.actionPlan }}>
                          {task.action_plan ? (
                            <TooltipProvider delayDuration={200}>
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="block truncate cursor-default">{task.action_plan}</span>
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
                            e.stopPropagation();
                            setEditingProgressId(task.id);
                            setEditingProgressValue(String(task.current_progress));
                          }}
                        >
                          {isEditingThis ? (
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
                            <span className="cursor-text hover:underline">{task.current_progress}%</span>
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
              </Table>
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
        readOnly={((selectedTask as any)?.is_summary === true) || (!isAdmin && selectedTask?.assignee_id !== memberId)}
        isSummary={(selectedTask as any)?.is_summary === true}
        allTasks={tasks}
      />
    </>
  );
}
