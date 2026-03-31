import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { TeamHeatmap } from "@/components/dashboard/TeamHeatmap";
import { ProjectHUD } from "@/components/dashboard/ProjectHUD";
import { TeamProgressChart } from "@/components/dashboard/TeamProgressChart";
import { CategoryProgressChart } from "@/components/dashboard/CategoryProgressChart";
import { CriticalIssueBoard } from "@/components/dashboard/CriticalIssueBoard";
import { BehindScheduleBoard } from "@/components/dashboard/BehindScheduleBoard";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { OverdueTasksBoard } from "@/components/dashboard/OverdueTasksBoard";
import { ActivityStream } from "@/components/dashboard/ActivityStream";
import { PersonnelTable } from "@/components/dashboard/PersonnelTable";
import { PartStatusBoard } from "@/components/dashboard/PartStatusBoard";
import { ExportReportDialog } from "@/components/dashboard/ExportReportDialog";
import { KukuProgressOverview } from "@/components/dashboard/KukuProgressOverview";
import { KukuCoverageRate } from "@/components/dashboard/KukuCoverageRate";
import { KukuPredecessorWatch } from "@/components/dashboard/KukuPredecessorWatch";
import { KukuDelayRiskBoard } from "@/components/dashboard/KukuDelayRiskBoard";

const Index = () => {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Project Dashboard</h1>
          <p className="text-sm text-muted-foreground">ALSMK US Electric Steel Mill — Project Overview</p>
        </div>
        <ExportReportDialog />
      </div>

      <div data-export-id="milestone-timeline">
        <MilestoneTimeline />
      </div>

      <div data-export-id="project-hud">
        <ProjectHUD />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-export-id="category-progress">
          <CategoryProgressChart />
        </div>
        <div data-export-id="team-progress">
          <TeamProgressChart />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-export-id="overdue-tasks">
          <OverdueTasksBoard />
        </div>
        <div data-export-id="critical-issues">
          <CriticalIssueBoard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-export-id="behind-schedule">
          <BehindScheduleBoard />
        </div>
        <div data-export-id="upcoming-deadlines">
          <UpcomingDeadlines />
        </div>
      </div>

      {/* KUKU (건축사업본부) CPM Widgets */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KukuProgressOverview />
        <KukuCoverageRate />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KukuPredecessorWatch />
        <KukuDelayRiskBoard />
      </div>

      <div data-export-id="team-heatmap">
        <TeamHeatmap />
      </div>

      <div data-export-id="part-status">
        <PartStatusBoard />
      </div>

      <ActivityStream />
      <PersonnelTable />
    </div>
  );
};

export default Index;
