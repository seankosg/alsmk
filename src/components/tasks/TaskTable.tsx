import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { calcPlannedProgress } from "@/lib/mockData";
import { TaskDetailDialog } from "./TaskDetailDialog";

interface TaskTableProps {
  filterMine?: boolean;
}

export function TaskTable({ filterMine }: TaskTableProps) {
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

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
      const { data, error } = await supabase.from("tasks").select("*").order("created_at", { ascending: false });
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

  const getMemberName = (id: string | null) => {
    if (!id) return "Unassigned";
    return members.find(m => m.id === id)?.name ?? "Unknown";
  };

  const getMilestoneName = (id: string | null) => {
    if (!id) return "—";
    return milestones.find(m => m.id === id)?.name ?? "Unknown";
  };

  let filtered = [...tasks];
  if (teamFilter !== "all") filtered = filtered.filter(t => t.team_id === teamFilter);
  if (flagFilter !== "all") filtered = filtered.filter(t => t.issue_flag === flagFilter);

  const selectedTask = filtered.find(t => t.id === selectedTaskId) ?? null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Tasks ({filtered.length})</CardTitle>
            <div className="flex gap-2">
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
                    <TableHead>Title</TableHead>
                    <TableHead>Milestone</TableHead>
                    <TableHead>Assignee</TableHead>
                    <TableHead className="text-right">Planned</TableHead>
                    <TableHead className="text-right">Current</TableHead>
                    <TableHead className="text-right">Gap</TableHead>
                    <TableHead>Flag</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">No tasks found</TableCell></TableRow>
                  ) : filtered.map((task) => {
                    const planned = calcPlannedProgress(task.start_date, task.end_date);
                    const gap = task.current_progress - planned;
                    return (
                      <TableRow key={task.id} className="cursor-pointer hover:bg-accent/50" onClick={() => setSelectedTaskId(task.id)}>
                        <TableCell className="font-mono text-xs">{task.task_code}</TableCell>
                        <TableCell className="text-sm font-medium">{task.title}</TableCell>
                        <TableCell className="text-xs text-muted-foreground">{getMilestoneName(task.milestone_id)}</TableCell>
                        <TableCell className="text-xs">{getMemberName(task.assignee_id)}</TableCell>
                        <TableCell className="text-right font-mono text-xs">{planned}%</TableCell>
                        <TableCell className="text-right font-mono text-xs">{task.current_progress}%</TableCell>
                        <TableCell className={`text-right font-mono text-xs font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                          {gap >= 0 ? '+' : ''}{gap}%
                        </TableCell>
                        <TableCell>
                          {task.issue_flag !== "normal" && (
                            <Badge variant={task.issue_flag === "critical" ? "destructive" : "outline"} className={task.issue_flag === "warning" ? "border-warning text-warning text-[10px]" : "text-[10px]"}>
                              {task.issue_flag}
                            </Badge>
                          )}
                        </TableCell>
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
