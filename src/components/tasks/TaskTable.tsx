import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { mockTasks, mockTeams, calcPlannedProgress, getMemberName, getMilestoneName } from "@/lib/mockData";
import { TaskDetailDialog } from "./TaskDetailDialog";

interface TaskTableProps {
  filterMine?: boolean;
}

export function TaskTable({ filterMine }: TaskTableProps) {
  const [teamFilter, setTeamFilter] = useState<string>("all");
  const [flagFilter, setFlagFilter] = useState<string>("all");
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  let tasks = [...mockTasks];
  if (teamFilter !== "all") tasks = tasks.filter(t => t.team_id === teamFilter);
  if (flagFilter !== "all") tasks = tasks.filter(t => t.issue_flag === flagFilter);

  const selectedTask = tasks.find(t => t.id === selectedTaskId) ?? null;

  return (
    <>
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <CardTitle className="text-base">Tasks ({tasks.length})</CardTitle>
            <div className="flex gap-2">
              <Select value={teamFilter} onValueChange={setTeamFilter}>
                <SelectTrigger className="w-[130px] h-8 text-xs">
                  <SelectValue placeholder="All Teams" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Teams</SelectItem>
                  {mockTeams.map(t => <SelectItem key={t.id} value={t.id}>{t.name}</SelectItem>)}
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
                {tasks.map((task) => {
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
        </CardContent>
      </Card>
      <TaskDetailDialog task={selectedTask} open={!!selectedTaskId} onOpenChange={(o) => !o && setSelectedTaskId(null)} />
    </>
  );
}
