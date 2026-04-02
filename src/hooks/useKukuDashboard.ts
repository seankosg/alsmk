import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress } from "@/lib/mockData";
import { CPM_RUNTIME_KEY, CpmRuntimeData, CpmRuntimeActivity } from "@/lib/cpmRuntimeCache";

export interface KukuActivity {
  id: string;
  name: string;
  wbs_full: string | null;
  mpp_task_id: string | null;
  duration: number;
  progress: number | null;
  plannedProgress: number;
  is_critical: boolean;
  is_milestone: boolean;
  start_date: string | null;
  finish_date: string | null;
  text1: string;
  mappedTaskIds: string[];
  taskActualPct: number | null;
  taskPlannedPct: number | null;
}

export interface PredecessorInfo {
  id: string;
  name: string;
  wbs_full: string | null;
  text1: string;
  progress: number | null;
  plannedProgress: number;
  gap: number;
  is_critical: boolean;
  kukuSuccessorName: string;
}

export interface KukuDashboardData {
  kukuActivities: KukuActivity[];
  predecessors: PredecessorInfo[];
  allActivitiesCount: number;
}

/** Read a custom field by English key with Korean alias fallback */
function getCustomField(cf: Record<string, string> | null, englishKey: string, koreanAlias: string): string {
  if (!cf) return "";
  return cf[englishKey] || cf[englishKey.toLowerCase()] || cf[koreanAlias] || "";
}

const getText1 = (a: { custom_fields: Record<string, string> | null }) =>
  getCustomField(a.custom_fields, "Text1", "텍스트1");

const getText2 = (a: { custom_fields: Record<string, string> | null }) =>
  getCustomField(a.custom_fields, "Text2", "텍스트2");

/** Normalize a runtime activity to the common shape used for calculations */
function fromRuntime(a: CpmRuntimeActivity) {
  return {
    id: a.id,
    mpp_uid: a.mppUid || null,
    name: a.name,
    wbs_full: a.wbsFull || null,
    mpp_task_id: a.mppTaskId,
    duration: a.duration,
    progress: a.progress,
    is_critical: a.isCritical,
    is_milestone: a.isMilestone,
    start_date: a.startDate,
    finish_date: a.finishDate,
    custom_fields: a.customFields as Record<string, string> | null,
    pred_links: a.predLinks || null,
    progress_mode: "runtime" as string,
  };
}

export function useKukuDashboard() {
  const queryClient = useQueryClient();

  return useQuery<KukuDashboardData>({
    queryKey: ["kuku-dashboard"],
    staleTime: 0,
    refetchOnMount: "always",
    queryFn: async () => {
      // 1. Try runtime cache first
      const runtimeCache = queryClient.getQueryData<CpmRuntimeData>([CPM_RUNTIME_KEY]);
      let activities: ReturnType<typeof fromRuntime>[];
      let isRuntimeSource = false;

      if (runtimeCache?.activities?.length) {
        console.log(`[KUKU] Using runtime cache (${runtimeCache.activities.length} activities, source: ${runtimeCache.source})`);
        activities = runtimeCache.activities.map(fromRuntime);
        isRuntimeSource = true;
      } else {
        // Fallback: load from DB
        console.log("[KUKU] No runtime cache, falling back to DB");
        const { data: dbActivities } = await supabase
          .from("cpm_activities")
          .select("id, name, wbs_full, mpp_task_id, mpp_uid, duration, progress, progress_mode, is_critical, is_milestone, start_date, finish_date, custom_fields, pred_links")
          .limit(5000);
        if (!dbActivities?.length) return { kukuActivities: [], predecessors: [], allActivitiesCount: 0 };
        activities = dbActivities.map(a => ({
          ...a,
          mpp_uid: a.mpp_uid || null,
          custom_fields: a.custom_fields as Record<string, string> | null,
        }));
      }

      // 2. Runtime ID → DB UUID resolution
      // When using runtime cache, activity.id is an iframe-internal ID (e.g. "A244"),
      // but cpm_task_mappings.activity_id uses DB UUIDs. We resolve via mpp_uid.
      let resolveDbId: (a: ReturnType<typeof fromRuntime>) => string = (a) => a.id;

      if (isRuntimeSource) {
        const { data: idRows } = await supabase
          .from("cpm_activities")
          .select("id, mpp_uid")
          .limit(5000);
        const mppUidToDbId = new Map<string, string>();
        (idRows || []).forEach(r => { if (r.mpp_uid) mppUidToDbId.set(r.mpp_uid, r.id); });
        resolveDbId = (a) => (a.mpp_uid ? mppUidToDbId.get(a.mpp_uid) : null) || a.id;
        console.log(`[KUKU] Runtime→DB ID map: ${mppUidToDbId.size} entries`);
      }

      // 3. Load mappings + tasks from DB (always needed)
      const { data: mappings } = await supabase
        .from("cpm_task_mappings")
        .select("activity_id, task_id");

      const activityMappings = new Map<string, string[]>();
      (mappings || []).forEach((m) => {
        if (!activityMappings.has(m.activity_id)) activityMappings.set(m.activity_id, []);
        activityMappings.get(m.activity_id)!.push(m.task_id);
      });

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

      // 4. Helper functions
      const getEffectiveProgress = (a: { progress: number | null; progress_mode: string; start_date: string | null; finish_date: string | null }) => {
        if (a.progress_mode === "auto" && a.start_date && a.finish_date) {
          return calcPlannedProgress(a.start_date, a.finish_date);
        }
        return a.progress;
      };

      // 5. Build predecessor map from pred_links (already stored as mppTaskId)
      const predMap = new Map<string, string[]>();
      activities.forEach((a) => {
        if (!a.pred_links?.trim() || !a.mpp_task_id) return;
        const predMppIds = a.pred_links.split(",")
          .map((s: string) => s.trim().split(":")[0].trim())
          .filter(Boolean);
        if (predMppIds.length) {
          predMap.set(a.mpp_task_id, [...new Set(predMppIds)]);
        }
      });

      // Build activity lookup by mppTaskId
      const actByMpp = new Map<string, typeof activities[0]>();
      activities.forEach((a) => {
        if (a.mpp_task_id) actByMpp.set(a.mpp_task_id, a);
      });

      // 5. Build KUKU activities
      const kukuActivities: KukuActivity[] = activities
        .filter((a) => getText1(a) === "KUKU")
        .map((a) => {
          const dbId = resolveDbId(a);
          const tIds = activityMappings.get(dbId) || [];
          const validTasks = tIds.map((id) => taskMap[id]).filter(Boolean);
          const effectiveProgress = getEffectiveProgress(a);
          const plannedProgress = a.start_date && a.finish_date
            ? calcPlannedProgress(a.start_date, a.finish_date)
            : 0;

          let taskActualPct: number | null = null;
          let taskPlannedPct: number | null = null;
          if (validTasks.length > 0) {
            let totalDur = 0, wActual = 0, wPlanned = 0;
            validTasks.forEach((t: any) => {
              const dur = Math.max(1, Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1);
              totalDur += dur;
              wActual += t.current_progress * dur;
              wPlanned += calcPlannedProgress(t.start_date, t.end_date) * dur;
            });
            taskActualPct = totalDur ? Math.round(wActual / totalDur) : 0;
            taskPlannedPct = totalDur ? Math.round(wPlanned / totalDur) : 0;
          }

          return {
            id: a.id,
            name: a.name,
            wbs_full: a.wbs_full,
            mpp_task_id: a.mpp_task_id,
            duration: a.duration,
            progress: effectiveProgress,
            plannedProgress,
            is_critical: a.is_critical,
            is_milestone: a.is_milestone,
            start_date: a.start_date,
            finish_date: a.finish_date,
            text1: "KUKU",
            mappedTaskIds: tIds,
            taskActualPct,
            taskPlannedPct,
          };
        });

      // 6. Build predecessor watch list (non-KUKU predecessors of KUKU activities)
      const predecessorSet = new Set<string>();
      const predInfos: PredecessorInfo[] = [];

      kukuActivities.forEach((ka) => {
        if (!ka.mpp_task_id) return;
        const preds = predMap.get(ka.mpp_task_id) || [];
        preds.forEach((predMppId) => {
          const predAct = actByMpp.get(predMppId);
          if (!predAct) return;
          if (getText1(predAct) === "KUKU") return;
          const key = `${predAct.id}::${ka.id}`;
          if (predecessorSet.has(key)) return;
          predecessorSet.add(key);

          const pp = predAct.start_date && predAct.finish_date
            ? calcPlannedProgress(predAct.start_date, predAct.finish_date)
            : 0;
          const effectiveProgress = getEffectiveProgress(predAct);
          const actual = effectiveProgress ?? 0;

          predInfos.push({
            id: predAct.id,
            name: predAct.name,
            wbs_full: predAct.wbs_full,
            text1: getText1(predAct),
            progress: effectiveProgress,
            plannedProgress: pp,
            gap: actual - pp,
            is_critical: predAct.is_critical,
            kukuSuccessorName: ka.name,
          });
        });
      });

      console.log(`[KUKU] Result: ${kukuActivities.length} KUKU activities, ${predInfos.length} predecessors (total: ${activities.length})`);

      return {
        kukuActivities,
        predecessors: predInfos.sort((a, b) => a.gap - b.gap),
        allActivitiesCount: activities.length,
      };
    },
  });
}
