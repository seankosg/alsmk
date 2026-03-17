import { TaskImportComponent } from "@/components/tasks/TaskImport";

const TaskImport = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Import Tasks</h1>
        <p className="text-sm text-muted-foreground">Upload CSV or Excel file to bulk-create tasks</p>
      </div>
      <TaskImportComponent />
    </div>
  );
};

export default TaskImport;
