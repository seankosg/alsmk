import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { TeamHeatmap } from "@/components/dashboard/TeamHeatmap";
import { ProjectHUD } from "@/components/dashboard/ProjectHUD";
import { TeamProgressChart } from "@/components/dashboard/TeamProgressChart";
import { CriticalIssueBoard } from "@/components/dashboard/CriticalIssueBoard";
import { BehindScheduleBoard } from "@/components/dashboard/BehindScheduleBoard";
import { TaskDistributionChart } from "@/components/dashboard/TaskDistributionChart";
import { UpcomingDeadlines } from "@/components/dashboard/UpcomingDeadlines";
import { IssueTrendChart } from "@/components/dashboard/IssueTrendChart";
import { ActivityStream } from "@/components/dashboard/ActivityStream";
import { PersonnelTable } from "@/components/dashboard/PersonnelTable";
import { PartStatusBoard } from "@/components/dashboard/PartStatusBoard";

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Project Dashboard</h1>
        <p className="text-sm text-muted-foreground">ALSMK US Electric Steel Mill — Project Overview</p>
      </div>

      <MilestoneTimeline />

      <ProjectHUD />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamProgressChart />
        <BehindScheduleBoard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <CriticalIssueBoard />
        <UpcomingDeadlines />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TaskDistributionChart />
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
