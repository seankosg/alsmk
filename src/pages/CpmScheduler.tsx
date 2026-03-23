import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActivityTaskPanel, CpmActivity } from "@/components/cpm/ActivityTaskPanel";

const CpmScheduler = () => {
  const [selectedActivity, setSelectedActivity] = useState<CpmActivity | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const queryClient = useQueryClient();

  // Upsert activities to DB when CPM calculates
  const upsertActivities = useCallback(async (activities: CpmActivity[]) => {
    if (!activities.length) return;
    
    for (const a of activities) {
      const row = {
        mpp_uid: a.mppUid,
        mpp_task_id: a.mppTaskId,
        name: a.name,
        duration: a.duration,
        progress: a.progress,
        wbs_full: a.wbsFull,
        is_critical: a.isCritical,
        is_milestone: a.isMilestone,
        start_date: a.startDate,
        finish_date: a.finishDate,
        es: a.es, ef: a.ef, ls: a.ls, lf: a.lf, tf: a.tf,
        updated_at: new Date().toISOString(),
      };

      // Upsert by name (since mpp_uid may not be unique across uploads)
      const { data: existing } = await supabase
        .from("cpm_activities")
        .select("id")
        .eq("name", a.name)
        .maybeSingle();

      if (existing) {
        await supabase.from("cpm_activities").update(row).eq("id", existing.id);
      } else {
        await supabase.from("cpm_activities").insert(row);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
  }, [queryClient]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;

      if (e.data.type === "cpm-calculated") {
        upsertActivities(e.data.activities);
      }

      if (e.data.type === "activity-click") {
        setSelectedActivity(e.data.activity);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [upsertActivities]);

  return (
    <div className="h-[calc(100vh-48px)] -m-3 sm:-m-4 md:-m-6 flex">
      <div className={`${selectedActivity ? 'flex-1' : 'w-full'} transition-all`}>
        <iframe
          ref={iframeRef}
          src="/cpm_network.html"
          className="w-full h-full border-0"
          title="CPM Network Scheduler"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
      {selectedActivity && (
        <div className="w-[360px] flex-shrink-0 h-full">
          <ActivityTaskPanel
            activity={selectedActivity}
            onClose={() => setSelectedActivity(null)}
          />
        </div>
      )}
    </div>
  );
};

export default CpmScheduler;
