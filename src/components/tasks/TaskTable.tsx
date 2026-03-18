import { useState, useCallback, useRef, useMemo } from "react";
import { differenceInCalendarDays } from "date-fns";
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
}

export function TaskTable({ filterMine }: TaskTableProps) {
  const { isAdmin, memberId } = useAuthContext();
  const queryClient = useQueryClient();
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [memberFilter, setMemberFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [editingProgressId, setEditingProgressId] = useState<string | null>(null);
  const [editingProgressValue, setEditingProgressValue] = useState("");
  const [colWidths, setColWidths] = useState<Record<string, number>>(() => {
    try {
      const saved = localStorage.getItem("task-table-col-widths");
      if (saved) return { ...DEFAULT_COL_WIDTHS, ...JSON.parse(saved) };
    } catch {}
    return { ...DEFAULT_COL_WIDTHS };
  });

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
    filtered = filtered.filter(t => t.assignee_id === memberId || t.team_id === myTeamId);
  }
  if (filterMine && (isAdmin || isPm) && memberFilter !== "all") {
    filtered = filtered.filter(t => t.assignee_id === memberFilter);
  }
  if (teamFilter !== "all") filtered = filtered.filter(t => t.team_id === teamFilter);
  if (flagFilter !== "all") filtered = filtered.filter(t => t.issue_flag === flagFilter);

  const selectedTask = filtered.find(t => t.id === selectedTaskId) ?? null;

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
            <div className="flex gap-2 flex-wrap">
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
                        className={`relative select-none ${col.align}`}
                        style={{ width: colWidths[col.key], minWidth: 40 }}
                      >
                        {col.label}
                        <ResizeHandle onResize={handleColResize(col.key)} />
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={11} className="text-center text-muted-foreground">No tasks found</TableCell></TableRow>
                  ) : filtered.map((task) => {
                    const planned = calcPlannedProgress(task.start_date, task.end_date);
                    const gap = task.current_progress - planned;
                    const isEditingThis = editingProgressId === task.id;
                    return (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedTaskId(task.id)}>
                        <TableCell className="font-mono text-xs truncate" style={{ width: colWidths.taskCode }}>{task.task_code}</TableCell>
                        <TableCell className="text-xs truncate" style={{ width: colWidths.category }}>{task.category ?? "—"}</TableCell>
                        <TableCell className="text-sm font-medium truncate" style={{ width: colWidths.subject }}>{task.title}</TableCell>
                        <TableCell className="text-xs truncate" style={{ width: colWidths.actionPlan }}>
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
                        <TableCell className="font-mono text-xs" style={{ width: colWidths.start }}>{task.start_date}</TableCell>
                        <TableCell className="font-mono text-xs" style={{ width: colWidths.finish }}>{task.end_date}</TableCell>
                        {(() => {
                          const remaining = task.actual_finish
                            ? 0
                            : differenceInCalendarDays(new Date(task.end_date), new Date());
                          return (
                            <TableCell
                              className={`text-right font-mono text-xs font-bold ${task.actual_finish ? 'text-muted-foreground' : remaining < 0 ? 'text-destructive' : remaining <= 7 ? 'text-warning' : 'text-primary'}`}
                              style={{ width: colWidths.dday }}
                            >
                              {task.actual_finish ? "Done" : remaining === 0 ? "0" : remaining > 0 ? `${remaining}` : `+${Math.abs(remaining)}`}
                            </TableCell>
                          );
                        })()}
                        <TableCell className="text-right font-mono text-xs" style={{ width: colWidths.plan }}>{planned}%</TableCell>
                        <TableCell
                          className="text-right font-mono text-xs"
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
                        <TableCell className={`text-right font-mono text-xs font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`} style={{ width: colWidths.gap }}>
                          {gap >= 0 ? '+' : ''}{gap}%
                        </TableCell>
                        <TableCell className="font-mono text-xs" style={{ width: colWidths.actualFinish }}>{task.actual_finish ?? "—"}</TableCell>
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
        readOnly={!isAdmin && selectedTask?.assignee_id !== memberId}
      />
    </>
  );
}
