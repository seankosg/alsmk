import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "./TaskDetailDialog";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";

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
      const { data, error } = await supabase.from("members").select("id, name");
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

  let filtered = [...tasks];

  if (filterMine && !isAdmin) {
    filtered = filtered.filter(t => t.assignee_id === memberId);
  }
  if (filterMine && isAdmin && memberFilter !== "all") {
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
              {filterMine && isAdmin && (
                <Badge variant="outline" className="ml-2 text-[10px] border-primary text-primary">Admin View</Badge>
              )}
            </CardTitle>
            <div className="flex gap-2 flex-wrap">
              {filterMine && isAdmin && (
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-[140px]">Task Code</TableHead>
                    <TableHead>Category</TableHead>
                    <TableHead>Subject</TableHead>
                    <TableHead className="w-[90px]">Start</TableHead>
                    <TableHead className="w-[90px]">Finish</TableHead>
                    <TableHead className="text-right w-[70px]">Plan %</TableHead>
                    <TableHead className="text-right w-[70px]">Actual %</TableHead>
                    <TableHead className="text-right w-[70px]">차이 %</TableHead>
                    <TableHead className="w-[100px]">Actual Finish</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">No tasks found</TableCell></TableRow>
                  ) : filtered.map((task) => {
                    const planned = calcPlannedProgress(task.start_date, task.end_date);
                    const gap = task.current_progress - planned;
                    const isEditingThis = editingProgressId === task.id;
                    return (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedTaskId(task.id)}>
                        <TableCell className="font-mono text-xs">{task.task_code}</TableCell>
                        <TableCell className="text-xs">{task.category ?? "—"}</TableCell>
                        <TableCell className="text-sm font-medium">{task.title}</TableCell>
                        <TableCell className="font-mono text-xs">{task.start_date}</TableCell>
                        <TableCell className="font-mono text-xs">{task.end_date}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{planned}%</TableCell>
                        <TableCell
                          className="text-right font-mono text-xs"
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
                        <TableCell className={`text-right font-mono text-xs font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {gap >= 0 ? '+' : ''}{gap}%
                        </TableCell>
                        <TableCell className="font-mono text-xs">{task.actual_finish ?? "—"}</TableCell>
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
      />
    </>
  );
}
