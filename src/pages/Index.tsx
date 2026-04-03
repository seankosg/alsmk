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
import { CpmSummaryBanner } from "@/components/dashboard/CpmSummaryBanner";
import { KukuCoverageRate } from "@/components/dashboard/KukuCoverageRate";
import { KukuPredecessorWatch } from "@/components/dashboard/KukuPredecessorWatch";
import { KukuDelayRiskBoard } from "@/components/dashboard/KukuDelayRiskBoard";
import { useAuthContext } from "@/components/layout/AppLayout";
import { useEffect, useRef, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
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

  // On mount: request current CPM data from hidden iframe for runtime cache sync
  useEffect(() => {
    let attempts = 0;
    const maxAttempts = 8;

    const requestRuntimeData = () => {
      const iframe = document.querySelector<HTMLIFrameElement>('iframe[src*="cpm_network"]');
      if (iframe?.contentWindow) {
        iframe.contentWindow.postMessage({ type: "request-cpm-data" }, "*");
      }

      attempts += 1;
      if (attempts >= maxAttempts) {
        window.clearInterval(intervalId);
      }
    };

    requestRuntimeData();
    const intervalId = window.setInterval(requestRuntimeData, 350);

    return () => {
      window.clearInterval(intervalId);
    };
  }, []);

  // Realtime: watch task mappings and task progress changes (not cpm_activities — that comes from runtime cache)
  useEffect(() => {
    const channelName = `dashboard-kuku-rt-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
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

      {/* KUKU (건축사업본부) CPM Widgets */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-foreground">KUKU CPM 위젯</h2>
        <Button
          variant="outline"
          size="sm"
          onClick={() => {
            const iframe = document.querySelector<HTMLIFrameElement>('iframe[src*="cpm_network"]');
            if (iframe?.contentWindow) {
              iframe.contentWindow.postMessage({ type: "request-cpm-data" }, "*");
              queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
              toast.success("KUKU 위젯을 새로고침합니다.");
            } else {
              queryClient.invalidateQueries({ queryKey: ["kuku-dashboard"] });
              toast.info("CPM iframe이 아직 로드되지 않았습니다. DB 데이터로 갱신합니다.");
            }
          }}
        >
          <RefreshCw className="h-4 w-4 mr-1" />
          새로고침
        </Button>
      </div>
      <CpmSummaryBanner />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KukuProgressOverview />
        <KukuCoverageRate />
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <KukuPredecessorWatch />
        <KukuDelayRiskBoard />
      </div>

      <h2 className="text-lg font-semibold text-foreground">Task Status HUD</h2>
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
