import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { calcPlannedProgress } from "@/lib/mockData";

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

export function useKukuDashboard() {
  return useQuery<KukuDashboardData>({
    queryKey: ["kuku-dashboard"],
    staleTime: 30_000,
    queryFn: async () => {
      // 1. Load all activities
      const { data: activities } = await supabase
        .from("cpm_activities")
        .select("id, name, wbs_full, mpp_task_id, mpp_uid, duration, progress, is_critical, is_milestone, start_date, finish_date, custom_fields")
        .limit(5000);
      if (!activities?.length) return { kukuActivities: [], predecessors: [], allActivitiesCount: 0 };

      // 2. Load mappings
      const { data: mappings } = await supabase
        .from("cpm_task_mappings")
        .select("activity_id, task_id");

      const activityMappings = new Map<string, string[]>();
      (mappings || []).forEach((m) => {
        if (!activityMappings.has(m.activity_id)) activityMappings.set(m.activity_id, []);
        activityMappings.get(m.activity_id)!.push(m.task_id);
      });

      // 3. Load mapped tasks
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

      // 4. Load latest snapshot for predecessor info
      const { data: snapshot } = await supabase
        .from("cpm_snapshots")
        .select("data")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      // Build predecessor map from snapshot
      const predMap = new Map<string, string[]>(); // mppTaskId -> predecessor mppTaskIds
      if (snapshot?.data) {
        const snapshotData = snapshot.data as any;
        const snapshotActivities = snapshotData.activities || snapshotData.nodes || [];

        // Build snapshot internal ID → mppTaskId mapping
        const snapshotIdToMpp = new Map<string, string>();
        snapshotActivities.forEach((a: any) => {
          if (a.id && a.mppTaskId) snapshotIdToMpp.set(a.id, a.mppTaskId);
        });

        snapshotActivities.forEach((a: any) => {
          const rawPreds: string[] = [];

          // predecessors (string or array)
          if (a.predecessors) {
            if (typeof a.predecessors === "string" && a.predecessors.length > 0) {
              rawPreds.push(...a.predecessors.split(",").map((s: string) => s.trim()));
            } else if (Array.isArray(a.predecessors)) {
              rawPreds.push(...a.predecessors.map((p: any) => typeof p === "string" ? p : p.id || p.from));
            }
          }

          // predLinks (comma-separated string like "A244:0:56,A250:1:0" or array)
          if (a.predLinks) {
            if (typeof a.predLinks === "string" && a.predLinks.length > 0) {
              rawPreds.push(...a.predLinks.split(",").map((s: string) => s.split(":")[0].trim()));
            } else if (Array.isArray(a.predLinks)) {
              rawPreds.push(...a.predLinks.map((p: any) => typeof p === "string" ? p.split(":")[0] : p.from || p.id));
            }
          }

          if (rawPreds.length) {
            // Convert snapshot IDs (A244) to mppTaskId (292)
            const mppPreds = rawPreds
              .map((id) => snapshotIdToMpp.get(id) || id)
              .filter(Boolean);
            const key = a.mppTaskId || a.id;
            predMap.set(key, [...new Set(mppPreds)]);
          }
        });
      }

      // Build activity lookup by mppTaskId
      const actByMpp = new Map<string, typeof activities[0]>();
      activities.forEach((a) => {
        if (a.mpp_task_id) actByMpp.set(a.mpp_task_id, a);
      });

      const getText1 = (a: typeof activities[0]) => {
        const cf = a.custom_fields as Record<string, string> | null;
        return cf?.Text1 || cf?.text1 || "";
      };

      // 5. Build KUKU activities
      const kukuActivities: KukuActivity[] = activities
        .filter((a) => getText1(a) === "KUKU")
        .map((a) => {
          const tIds = activityMappings.get(a.id) || [];
          const validTasks = tIds.map((id) => taskMap[id]).filter(Boolean);
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
            progress: a.progress,
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
          if (getText1(predAct) === "KUKU") return; // skip KUKU-to-KUKU
          const key = `${predAct.id}::${ka.id}`;
          if (predecessorSet.has(key)) return;
          predecessorSet.add(key);

          const pp = predAct.start_date && predAct.finish_date
            ? calcPlannedProgress(predAct.start_date, predAct.finish_date)
            : 0;
          const actual = predAct.progress ?? 0;

          predInfos.push({
            id: predAct.id,
            name: predAct.name,
            wbs_full: predAct.wbs_full,
            text1: getText1(predAct),
            progress: predAct.progress,
            plannedProgress: pp,
            gap: actual - pp,
            is_critical: predAct.is_critical,
            kukuSuccessorName: ka.name,
          });
        });
      });

      return {
        kukuActivities,
        predecessors: predInfos.sort((a, b) => a.gap - b.gap),
        allActivitiesCount: activities.length,
      };
    },
  });
}
