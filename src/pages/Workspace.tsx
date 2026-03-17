import { TaskTable } from "@/components/tasks/TaskTable";

const Workspace = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">My Workspace</h1>
        <p className="text-sm text-muted-foreground">Your assigned tasks and progress</p>
      </div>
      <TaskTable filterMine />
    </div>
  );
};

export default Workspace;
