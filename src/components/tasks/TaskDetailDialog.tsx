import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import { calcPlannedProgress, getMemberName, getMilestoneName, getTeamName, getPartName } from "@/lib/mockData";

interface Task {
  id: string;
  task_code: string;
  title: string;
  milestone_id: string | null;
  team_id: string;
  part_id: string | null;
  assignee_id: string | null;
  start_date: string;
  end_date: string;
  current_progress: number;
  issue_flag: "normal" | "warning" | "critical";
  issue_type: string | null;
  issue_description: string | null;
}

interface TaskDetailDialogProps {
  task: Task | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function TaskDetailDialog({ task, open, onOpenChange }: TaskDetailDialogProps) {
  if (!task) return null;

  const planned = calcPlannedProgress(task.start_date, task.end_date);
  const gap = task.current_progress - planned;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <code className="text-sm text-muted-foreground">{task.task_code}</code>
            {task.issue_flag !== "normal" && (
              <Badge variant={task.issue_flag === "critical" ? "destructive" : "outline"} className={task.issue_flag === "warning" ? "border-warning text-warning" : ""}>
                {task.issue_flag}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold">{task.title}</h3>
          </div>

          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-xs text-muted-foreground">Team</p>
              <p className="font-medium">{getTeamName(task.team_id)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Part</p>
              <p className="font-medium">{getPartName(task.part_id)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Assignee</p>
              <p className="font-medium">{getMemberName(task.assignee_id)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Milestone</p>
              <p className="font-medium">{getMilestoneName(task.milestone_id)}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Start</p>
              <p className="font-mono text-xs">{task.start_date}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">End</p>
              <p className="font-mono text-xs">{task.end_date}</p>
            </div>
          </div>

          <Separator />

          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span>Progress</span>
              <span className="font-mono font-bold">{task.current_progress}%</span>
            </div>
            <Progress value={task.current_progress} className="h-2" />
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>Planned: {planned}%</span>
              <span className={`font-mono font-bold ${gap >= 0 ? 'text-primary' : 'text-destructive'}`}>
                Gap: {gap >= 0 ? '+' : ''}{gap}%
              </span>
            </div>
          </div>

          {task.issue_flag !== "normal" && (
            <>
              <Separator />
              <div className="space-y-1">
                <p className="text-xs font-medium text-muted-foreground">Issue Details</p>
                {task.issue_type && <p className="text-sm"><span className="text-muted-foreground">Type:</span> {task.issue_type}</p>}
                {task.issue_description && <p className="text-sm text-muted-foreground italic">{task.issue_description}</p>}
              </div>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
