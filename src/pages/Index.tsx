import { useState } from "react";
import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { TeamHeatmap } from "@/components/dashboard/TeamHeatmap";
import { ProjectHUD } from "@/components/dashboard/ProjectHUD";
import { TeamProgressChart } from "@/components/dashboard/TeamProgressChart";
import { CategoryProgressChart } from "@/components/dashboard/CategoryProgressChart";
import { CriticalIssueBoard } from "@/components/dashboard/CriticalIssueBoard";
import { BehindScheduleBoard } from "@/components/dashboard/BehindScheduleBoard";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { IssueTrendChart } from "@/components/dashboard/IssueTrendChart";
import { ActivityStream } from "@/components/dashboard/ActivityStream";
import { PersonnelTable } from "@/components/dashboard/PersonnelTable";
import { PartStatusBoard } from "@/components/dashboard/PartStatusBoard";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Download, FileSpreadsheet, Presentation, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { exportDashboardExcel, exportDashboardPptx } from "@/lib/dashboardExport";

const Index = () => {
  const [exporting, setExporting] = useState<"excel" | "pptx" | null>(null);

  const handleExport = async (type: "excel" | "pptx") => {
    setExporting(type);
    toast.info(type === "excel" ? "Excel 보고서 생성 중..." : "PPT 슬라이드 생성 중...");
    try {
      if (type === "excel") {
        await exportDashboardExcel();
      } else {
        await exportDashboardPptx();
      }
      toast.success("보고서가 다운로드되었습니다.");
    } catch (err) {
      console.error(err);
      toast.error("보고서 생성에 실패했습니다.");
    } finally {
      setExporting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Dashboard</h1>
          <p className="text-sm text-muted-foreground">ALSMK US Electric Steel Mill — Project Overview</p>
        </div>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" disabled={!!exporting}>
              {exporting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              Export Report
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => handleExport("excel")} disabled={!!exporting}>
              <FileSpreadsheet className="h-4 w-4 mr-2" />
              Excel (.xlsx)
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => handleExport("pptx")} disabled={!!exporting}>
              <Presentation className="h-4 w-4 mr-2" />
              PowerPoint (.pptx)
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <MilestoneTimeline />
      <ProjectHUD />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamProgressChart />
        <CategoryProgressChart />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <BehindScheduleBoard />
        <CriticalIssueBoard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <UpcomingDeadlines />
        <IssueTrendChart />
      </div>

      <TeamHeatmap />
      <PartStatusBoard />
      <ActivityStream />
      <PersonnelTable />
    </div>
  );
};

export default Index;
