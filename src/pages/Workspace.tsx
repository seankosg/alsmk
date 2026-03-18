import { TaskTable } from "@/components/tasks/TaskTable";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";

const Workspace = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Workspace</h1>
          <p className="text-sm text-muted-foreground">Your assigned tasks and progress</p>
        </div>
        <AddTaskDialog />
      </div>
      <TaskTable filterMine />
    </div>
  );
};

export default Workspace;
