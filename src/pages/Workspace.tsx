import { TaskTable } from "@/components/tasks/TaskTable";
import { AddTaskDialog } from "@/components/tasks/AddTaskDialog";
import { Button } from "@/components/ui/button";
import { Upload, FileDown } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress } from "@/lib/mockData";
import { differenceInCalendarDays, startOfDay } from "date-fns";
import { parseLocalDate } from "@/lib/utils";
import * as XLSX from "xlsx";

const Workspace = () => {
  const navigate = useNavigate();

  const { data: tasks = [] } = useQuery({
    queryKey: ["tasks"],
    queryFn: async () => {
      const { data, error } = await supabase.from("tasks").select("*").order("title").order("start_date").order("end_date");
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

  const handleExport = () => {
    const getMemberName = (id: string | null) => !id ? "" : members.find(m => m.id === id)?.name ?? "";

    const rows = tasks.map(t => {
      const planned = calcPlannedProgress(t.start_date, t.end_date);
      const gap = t.current_progress - planned;
      const remaining = t.actual_finish ? 0 : differenceInCalendarDays(parseLocalDate(t.end_date), startOfDay(new Date()));
      const dDay = t.actual_finish ? "Done" : remaining === 0 ? "0" : remaining > 0 ? `${remaining}` : `+${Math.abs(remaining)}`;

      return {
        "assignee": getMemberName(t.assignee_id),
        "Category": t.category ?? "",
        "Subject": t.title,
        "Action Plan": t.action_plan ?? "",
        "Start": t.start_date,
        "Finish": t.end_date,
        "D-Day": dDay,
        "Plan %": planned,
        "Actual %": t.current_progress,
        "차이 %": gap,
        "Actual Finish": t.actual_finish ?? "",
      };
    });

    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Action Plan");
    XLSX.writeFile(wb, `ALSMK_Tasks_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

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
          <Button variant="outline" onClick={handleExport}>
            <FileDown className="mr-2 h-4 w-4" /> Export
          </Button>
          <AddTaskDialog />
        </div>
      </div>
      <TaskTable filterMine />
    </div>
  );
};

export default Workspace;
