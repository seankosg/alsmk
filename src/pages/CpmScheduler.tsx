import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActivityTaskPanel, CpmActivity } from "@/components/cpm/ActivityTaskPanel";
import { calcPlannedProgress } from "@/lib/mockData";

interface ActivityStatus {
  activityKey: string;
  totalTasks: number;
  onTrack: number;
  delayed: number;
  actualPct: number;
  plannedPct: number;
}

const getActivityStatusKey = (activity: {
  name: string;
  wbs_full?: string | null;
  mpp_task_id?: string | null;
}) => `${activity.mpp_task_id ?? "no-mpp"}::${activity.wbs_full ?? "no-wbs"}::${activity.name}`;

const CpmScheduler = () => {
  const [selectedActivity, setSelectedActivity] = useState<CpmActivity | null>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const queryClient = useQueryClient();

  // Send activity status data to iframe
  const sendStatusToIframe = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) return;

    const { data: activities } = await supabase
      .from("cpm_activities")
      .select("id, name, wbs_full, mpp_task_id");
    if (!activities?.length) return;

    const { data: mappings } = await supabase
      .from("cpm_task_mappings")
      .select("activity_id, task_id");

    const taskIds = [...new Set((mappings || []).map((m) => m.task_id))];
    let taskMap: Record<string, any> = {};
    if (taskIds.length) {
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, current_progress, start_date, end_date")
        .in("id", taskIds)
        .is("deleted_at", null);
      taskMap = Object.fromEntries((tasks || []).map((t) => [t.id, t]));
    }

    const activityMappings = new Map<string, string[]>();
    (mappings || []).forEach((m) => {
      if (!activityMappings.has(m.activity_id)) activityMappings.set(m.activity_id, []);
      activityMappings.get(m.activity_id)!.push(m.task_id);
    });

    const statuses: ActivityStatus[] = activities.map((act) => {
      const tIds = activityMappings.get(act.id) || [];
      const validTasks = tIds.map((id) => taskMap[id]).filter(Boolean);

      let totalDur = 0;
      let weightedActual = 0;
      let weightedPlanned = 0;
      let onTrack = 0;
      let delayed = 0;

      validTasks.forEach((t) => {
        const dur = Math.max(1, Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1);
        const planned = calcPlannedProgress(t.start_date, t.end_date);
        totalDur += dur;
        weightedActual += t.current_progress * dur;
        weightedPlanned += planned * dur;

        if (t.current_progress < planned - 5) {
          delayed++;
        } else {
          onTrack++;
        }
      });

      return {
        activityKey: getActivityStatusKey(act),
        totalTasks: validTasks.length,
        onTrack,
        delayed,
        actualPct: totalDur ? Math.round(weightedActual / totalDur) : 0,
        plannedPct: totalDur ? Math.round(weightedPlanned / totalDur) : 0,
      };
    });

    iframeRef.current.contentWindow.postMessage(
      {
        type: "activity-status-update",
        statuses,
      },
      "*",
    );
  }, []);

  // Save snapshot to DB
  const saveSnapshotToDb = useCallback(async (snapshotData: any) => {
    const name = snapshotData.name || "default";
    
    // Check if snapshot with this name exists
    const { data: existing } = await supabase
      .from("cpm_snapshots")
      .select("id")
      .eq("name", name)
      .maybeSingle();

    const { data: { user } } = await supabase.auth.getUser();

    if (existing) {
      await supabase
        .from("cpm_snapshots")
        .update({ data: snapshotData, updated_at: new Date().toISOString() })
        .eq("id", existing.id);
    } else {
      await supabase
        .from("cpm_snapshots")
        .insert({ name, data: snapshotData, created_by: user?.id || null });
    }
    
    console.log(`[CPM Snapshot] Saved to DB: "${name}"`);
  }, []);

  // Load latest snapshot from DB and send to iframe
  const loadSnapshotFromDb = useCallback(async () => {
    if (!iframeRef.current?.contentWindow) return;

    const { data: snapshot } = await supabase
      .from("cpm_snapshots")
      .select("data, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (snapshot?.data) {
      console.log(`[CPM Snapshot] Loaded from DB (updated: ${snapshot.updated_at})`);
      iframeRef.current.contentWindow.postMessage(
        {
          type: "snapshot-restore",
          snapshot: snapshot.data,
          dbUpdatedAt: snapshot.updated_at,
        },
        "*",
      );
    }
  }, []);

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

      const { data: existing } = await supabase
        .from("cpm_activities")
        .select("id")
        .eq("mpp_task_id", a.mppTaskId || '')
        .eq("wbs_full", a.wbsFull || '')
        .maybeSingle();

      if (existing) {
        await supabase.from("cpm_activities").update(row).eq("id", existing.id);
      } else {
        await supabase.from("cpm_activities").insert(row);
      }
    }
    
    queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });

    // Send status data to iframe after upsert
    setTimeout(() => sendStatusToIframe(), 500);
  }, [queryClient, sendStatusToIframe]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;

      if (e.data.type === "cpm-calculated") {
        upsertActivities(e.data.activities);
      }

      if (e.data.type === "activity-click") {
        setSelectedActivity({ ...e.data.activity, showDetail: true });
      }

      if (e.data.type === "activity-detail-click") {
        setSelectedActivity({ ...e.data.activity, showDetail: true });
      }

      // Snapshot save request from iframe
      if (e.data.type === "snapshot-save") {
        saveSnapshotToDb(e.data.snapshot);
      }

      // iframe requests DB snapshot (localStorage was empty)
      if (e.data.type === "request-db-snapshot") {
        loadSnapshotFromDb();
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [upsertActivities, saveSnapshotToDb, loadSnapshotFromDb]);

  return (
    <div className="h-[calc(100vh-48px)] -m-3 sm:-m-4 md:-m-6 flex">
      <div className={`${selectedActivity ? 'flex-1' : 'w-full'} transition-all`}>
        <iframe
          ref={iframeRef}
          src="/cpm_network.html"
          className="w-full h-full border-0"
          title="CPM Network Scheduler"
          sandbox="allow-scripts allow-same-origin allow-popups"
          onLoad={() => {
            iframeRef.current?.contentWindow?.postMessage({ type: "request-cpm-data" }, "*");
            setTimeout(() => sendStatusToIframe(), 300);
          }}
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
