import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { mockTasks, getMemberName, calcPlannedProgress } from "@/lib/mockData";

export function CriticalIssueBoard() {
  const issues = mockTasks.filter(t => t.issue_flag !== "normal")
    .sort((a, b) => (a.issue_flag === "critical" ? -1 : 1));

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Critical Issues ({issues.length})</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-3">
          {issues.length === 0 && (
            <p className="text-sm text-muted-foreground">No active issues</p>
          )}
          {issues.map((task) => {
            const planned = calcPlannedProgress(task.start_date, task.end_date);
            const gap = task.current_progress - planned;
            return (
              <div key={task.id} className="flex items-start justify-between gap-3 p-3 rounded-lg bg-muted/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <code className="text-xs text-muted-foreground">{task.task_code}</code>
                    <Badge variant={task.issue_flag === "critical" ? "destructive" : "outline"} className={task.issue_flag === "warning" ? "border-warning text-warning" : ""}>
                      {task.issue_flag}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium truncate">{task.title}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{getMemberName(task.assignee_id)}</p>
                  {task.issue_description && (
                    <p className="text-xs text-muted-foreground mt-1 italic">{task.issue_description}</p>
                  )}
                </div>
                <div className="text-right shrink-0">
                  <span className={`text-sm font-mono font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                    {gap >= 0 ? '+' : ''}{gap}%
                  </span>
                  <p className="text-[10px] text-muted-foreground">Gap</p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
