import { useCallback, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress } from "@/lib/mockData";

export interface ActivityStatus {
  activityKey: string;
  totalTasks: number;
  onTrack: number;
  delayed: number;
  actualPct: number;
  plannedPct: number;
}

export interface CpmViewModel {
  activities: {
    id: string;
    mpp_task_id: string | null;
    mpp_uid: string | null;
    name: string;
    wbs_full: string | null;
    custom_fields: Record<string, string> | null;
  }[];
  statuses: ActivityStatus[];
  version: { source: string; name: string; time: string };
}

const getActivityStatusKey = (a: { name: string; wbs_full?: string | null; mpp_task_id?: string | null }) =>
  `${a.mpp_task_id ?? "no-mpp"}::${a.wbs_full ?? "no-wbs"}::${a.name}`;

export function useCpmViewModel() {
  const lastHydrateRef = useRef<string>("");

  /**
   * Assembles the full CPM view model from normalized DB tables.
   * Returns statuses + customFields to be sent alongside the snapshot to the iframe.
   */
  const buildStatusAndCustomFields = useCallback(async () => {
    // 1. Load all activities
    const { data: activities } = await supabase
      .from("cpm_activities")
      .select("id, name, wbs_full, mpp_task_id, mpp_uid, custom_fields");
    if (!activities?.length) return null;

    // 2. Load all mappings
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

    // 3. Build activity → task mappings
    const activityMappings = new Map<string, string[]>();
    (mappings || []).forEach((m) => {
      if (!activityMappings.has(m.activity_id)) activityMappings.set(m.activity_id, []);
      activityMappings.get(m.activity_id)!.push(m.task_id);
    });

    // 4. Calculate statuses
    const statuses: ActivityStatus[] = activities.map((act) => {
      const tIds = activityMappings.get(act.id) || [];
      const validTasks = tIds.map((id) => taskMap[id]).filter(Boolean);

      let totalDur = 0;
      let weightedActual = 0;
      let weightedPlanned = 0;
      let onTrack = 0;
      let delayed = 0;

      validTasks.forEach((t: any) => {
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

    // 5. Build customFields map (mppTaskId::wbsFull → customFields)
    const customFieldsMap: Record<string, any> = {};
    activities.forEach((a) => {
      if (a.custom_fields && typeof a.custom_fields === "object" && Object.keys(a.custom_fields as Record<string, unknown>).length) {
        customFieldsMap[`${a.mpp_task_id}::${a.wbs_full}`] = a.custom_fields;
      }
    });

    // 6. Get version info from latest snapshot
    const { data: latestSnapshot } = await supabase
      .from("cpm_snapshots")
      .select("name, updated_at")
      .order("updated_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const version = {
      source: "db",
      name: latestSnapshot?.name || "DB",
      time: latestSnapshot?.updated_at
        ? new Date(latestSnapshot.updated_at).toLocaleString("ko-KR")
        : new Date().toLocaleString("ko-KR"),
    };

    return { statuses, customFieldsMap, version };
  }, []);

  /**
   * Sends a unified hydrate message to the iframe, containing:
   * - snapshot (graph structure from DB snapshot)
   * - customFields overlay from cpm_activities
   * - statuses from live task data
   * - version metadata
   */
  const hydrateIframe = useCallback(
    async (iframeWindow: Window | null) => {
      if (!iframeWindow) return;

      const result = await buildStatusAndCustomFields();
      if (!result) return;

      const { statuses, customFieldsMap, version } = result;

      // Load the latest snapshot for graph structure
      const { data: snapshot } = await supabase
        .from("cpm_snapshots")
        .select("data, updated_at, name")
        .order("updated_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      const hydrateId = Date.now().toString();
      lastHydrateRef.current = hydrateId;

      // Send unified hydrate message
      iframeWindow.postMessage(
        {
          type: "cpm-hydrate",
          hydrateId,
          snapshot: snapshot?.data || null,
          customFieldsMap,
          statuses,
          version,
        },
        "*",
      );

      console.log(`[CPM] Hydrate sent: ${statuses.length} statuses, ${Object.keys(customFieldsMap).length} customFields`);
    },
    [buildStatusAndCustomFields],
  );

  /**
   * Sends only status + customFields update (lightweight, no snapshot restore)
   */
  const refreshStatus = useCallback(
    async (iframeWindow: Window | null) => {
      if (!iframeWindow) return;

      const result = await buildStatusAndCustomFields();
      if (!result) return;

      iframeWindow.postMessage(
        {
          type: "cpm-status-refresh",
          statuses: result.statuses,
          customFieldsMap: result.customFieldsMap,
        },
        "*",
      );
    },
    [buildStatusAndCustomFields],
  );

  return { hydrateIframe, refreshStatus, buildStatusAndCustomFields };
}
