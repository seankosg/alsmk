import { MilestoneTimeline } from "@/components/dashboard/MilestoneTimeline";
import { ProjectHUD } from "@/components/dashboard/ProjectHUD";
import { TeamHeatmap } from "@/components/dashboard/TeamHeatmap";
import { CriticalIssueBoard } from "@/components/dashboard/CriticalIssueBoard";
import { ActivityStream } from "@/components/dashboard/ActivityStream";
import { PersonnelTable } from "@/components/dashboard/PersonnelTable";

const Index = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-sm text-muted-foreground">ALSMK US Electric Steel Mill — Project Overview</p>
      </div>

      <MilestoneTimeline />

      <ProjectHUD />

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <TeamHeatmap />
        <CriticalIssueBoard />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ActivityStream />
        <PersonnelTable />
      </div>
    </div>
  );
};

export default Index;
