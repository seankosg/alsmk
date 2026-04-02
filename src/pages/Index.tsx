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
import { useAuthContext } from "@/components/layout/AppLayout";
import { useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

const Index = () => {
  const { isAdmin } = useAuthContext();
  const queryClient = useQueryClient();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const debouncedInvalidate = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
    }, 300);
  }, [queryClient]);

  useEffect(() => {
    const channelName = `dashboard-kuku-rt-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cpm_activities' }, debouncedInvalidate)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'cpm_task_mappings' }, debouncedInvalidate)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'tasks' }, debouncedInvalidate)
      .subscribe();
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      supabase.removeChannel(channel);
    };
  }, [debouncedInvalidate]);
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
        <div data-export-id="category-progress" className="h-full">
          <CategoryProgressChart />
        </div>
        <div data-export-id="team-progress" className="h-full">
          <TeamProgressChart />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-export-id="overdue-tasks" className="h-full">
          <OverdueTasksBoard />
        </div>
        <div data-export-id="critical-issues" className="h-full">
          <CriticalIssueBoard />
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-export-id="behind-schedule" className="h-full">
          <BehindScheduleBoard />
        </div>
        <div data-export-id="upcoming-deadlines" className="h-full">
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

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div data-export-id="team-heatmap" className="h-full">
          <TeamHeatmap />
        </div>
        <div data-export-id="part-status" className="h-full">
          <PartStatusBoard />
        </div>
      </div>

      {isAdmin && <ActivityStream />}
      <PersonnelTable />
    </div>
  );
};

export default Index;
