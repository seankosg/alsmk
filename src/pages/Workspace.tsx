import { TaskTable } from "@/components/tasks/TaskTable";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { Button } from "@/components/ui/button";
import { Upload } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Workspace = () => {
  const navigate = useNavigate();
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">My Workspace</h1>
          <p className="text-sm text-muted-foreground">Your assigned tasks and progress</p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={() => navigate("/tasks/import")}>
            <Upload className="mr-2 h-4 w-4" /> Import
          </Button>
          <AddTaskDialog />
        </div>
      </div>
      <TaskTable filterMine />
    </div>
  );
};

export default Workspace;
