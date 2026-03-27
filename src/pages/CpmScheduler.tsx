import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ActivityTaskPanel, CpmActivity } from "@/components/cpm/ActivityTaskPanel";
import { SnapshotManager } from "@/components/cpm/SnapshotManager";
import { OrphanResolutionDialog, OrphanActivity } from "@/components/cpm/OrphanResolutionDialog";
import { useCpmViewModel } from "@/hooks/useCpmViewModel";
import { useAuthContext } from "@/components/layout/AppLayout";
import { toast } from "sonner";

const CpmScheduler = () => {
  const [selectedActivity, setSelectedActivity] = useState<CpmActivity | null>(null);
  const [pendingSnapshot, setPendingSnapshot] = useState<any>(null);
  const [orphansToResolve, setOrphansToResolve] = useState<OrphanActivity[]>([]);
  const [newActivityList, setNewActivityList] = useState<{ id: string; name: string; wbs_full: string | null }[]>([]);
  const [panelWidth, setPanelWidth] = useState(360);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const resizingRef = useRef(false);
  const queryClient = useQueryClient();
  const { isAdminOrPm, memberName } = useAuthContext();
  const { hydrateIframe, refreshStatus } = useCpmViewModel();

  // Save snapshot to DB (auto-save from iframe calculate)
  const saveSnapshotToDb = useCallback(async (snapshotData: any) => {
    const name = snapshotData.name || "default";
    
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

  // Send specific snapshot to iframe (from SnapshotManager)
  const handleLoadSnapshot = useCallback((snapshotData: any) => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage(
      { type: "snapshot-restore", snapshot: snapshotData, forceRestore: true },
      "*",
    );
    // After snapshot restore, send fresh status + customFields
    setTimeout(() => refreshStatus(iframeRef.current?.contentWindow || null), 500);
  }, [refreshStatus]);

  // Request current snapshot from iframe (for manual save)
  const handleRequestCurrentSnapshot = useCallback(() => {
    if (!iframeRef.current?.contentWindow) return;
    iframeRef.current.contentWindow.postMessage({ type: "request-snapshot" }, "*");
  }, []);

  // Upsert activities to DB when CPM calculates — with auto-migration + orphan resolution
  const upsertActivities = useCallback(async (activities: CpmActivity[]) => {
    if (!activities.length) return;
    const currentUserName = memberName || "System";
    
    const rows = activities.map((a) => ({
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
      custom_fields: (a as any).customFields || {},
      updated_at: new Date().toISOString(),
    }));

    await supabase
      .from("cpm_activities")
      .upsert(rows, { onConflict: "mpp_task_id,wbs_full" });

    // Identify orphans
    const validKeys = new Set(
      activities
        .filter((a) => a.mppTaskId && a.wbsFull)
        .map((a) => `${a.mppTaskId}::${a.wbsFull}`)
    );

    const { data: allDbActivities } = await supabase
      .from("cpm_activities")
      .select("id, name, mpp_task_id, wbs_full");

    if (!allDbActivities?.length) {
      queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
      // Refresh status after upsert
      setTimeout(() => refreshStatus(iframeRef.current?.contentWindow || null), 500);
      return;
    }

    const orphanDbActivities = allDbActivities.filter((db) => {
      if (!db.mpp_task_id || !db.wbs_full) return false;
      return !validKeys.has(`${db.mpp_task_id}::${db.wbs_full}`);
    });

    if (!orphanDbActivities.length) {
      queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
      setTimeout(() => refreshStatus(iframeRef.current?.contentWindow || null), 500);
      return;
    }

    // Get mappings for orphans
    const orphanIds = orphanDbActivities.map((o) => o.id);
    const { data: orphanMappings } = await supabase
      .from("cpm_task_mappings")
      .select("activity_id, task_id")
      .in("activity_id", orphanIds);

    const orphanMappingMap = new Map<string, string[]>();
    (orphanMappings || []).forEach((m) => {
      if (!orphanMappingMap.has(m.activity_id)) orphanMappingMap.set(m.activity_id, []);
      orphanMappingMap.get(m.activity_id)!.push(m.task_id);
    });

    const orphanIdSet = new Set(orphanIds);
    const newActivitiesDb = allDbActivities.filter((a) => !orphanIdSet.has(a.id));
    const nameToNewActivity = new Map<string, { id: string; name: string; wbs_full: string | null }>();
    newActivitiesDb.forEach((a) => {
      if (!nameToNewActivity.has(a.name)) {
        nameToNewActivity.set(a.name, { id: a.id, name: a.name, wbs_full: a.wbs_full });
      }
    });

    const unmatchedOrphans: OrphanActivity[] = [];
    let autoMigratedCount = 0;

    for (const orphan of orphanDbActivities) {
      const taskIds = orphanMappingMap.get(orphan.id) || [];

      if (taskIds.length === 0) {
        await supabase.from("cpm_activities").delete().eq("id", orphan.id);
        await supabase.from("activity_log").insert({
          action: "cpm_activity_deleted",
          entity_type: "cpm_activity",
          entity_id: orphan.id,
          user_name: currentUserName,
          details: { name: orphan.name, wbs_full: orphan.wbs_full, mpp_task_id: orphan.mpp_task_id, resolution: "auto_deleted_no_mappings" },
        });
        continue;
      }

      const match = nameToNewActivity.get(orphan.name);
      if (match) {
        await supabase
          .from("cpm_task_mappings")
          .update({ activity_id: match.id })
          .eq("activity_id", orphan.id);
        await supabase.from("cpm_activities").delete().eq("id", orphan.id);
        await supabase.from("activity_log").insert({
          action: "cpm_activity_deleted",
          entity_type: "cpm_activity",
          entity_id: orphan.id,
          user_name: currentUserName,
          details: {
            name: orphan.name, wbs_full: orphan.wbs_full, mpp_task_id: orphan.mpp_task_id,
            migrated_to: match.id, migrated_task_ids: taskIds, resolution: "auto_migrated",
          },
        });
        autoMigratedCount++;
      } else {
        unmatchedOrphans.push({
          id: orphan.id, name: orphan.name, wbs_full: orphan.wbs_full,
          mpp_task_id: orphan.mpp_task_id, mappedTaskCount: taskIds.length, mappedTaskIds: taskIds,
        });
      }
    }

    if (autoMigratedCount > 0) {
      toast.success(`${autoMigratedCount}개 Activity 매핑이 자동 이전되었습니다`);
    }

    if (unmatchedOrphans.length > 0) {
      toast.info(`${unmatchedOrphans.length}개 Activity의 매핑을 확인해주세요`);
      setNewActivityList(newActivitiesDb.map((a) => ({ id: a.id, name: a.name, wbs_full: a.wbs_full })));
      setOrphansToResolve(unmatchedOrphans);
    }

    queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
    setTimeout(() => refreshStatus(iframeRef.current?.contentWindow || null), 500);
  }, [queryClient, refreshStatus, memberName]);

  // Listen for messages from iframe
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (!e.data?.type) return;

      if (e.data.type === "cpm-calculated") {
        if (isAdminOrPm) upsertActivities(e.data.activities);
        // For all users, refresh status after calculation
        setTimeout(() => refreshStatus(iframeRef.current?.contentWindow || null), 500);
      }
      if (e.data.type === "activity-click") {
        setSelectedActivity({ ...e.data.activity, showDetail: true });
      }
      if (e.data.type === "activity-detail-click") {
        setSelectedActivity({ ...e.data.activity, showDetail: true });
      }
      if (e.data.type === "snapshot-save") {
        if (isAdminOrPm) saveSnapshotToDb(e.data.snapshot);
      }
      if (e.data.type === "request-db-snapshot") {
        // Legacy: iframe still requests DB snapshot on init
        // We handle this via hydrateIframe on onLoad, but handle for safety
        hydrateIframe(iframeRef.current?.contentWindow || null);
      }
      if (e.data.type === "snapshot-current") {
        setPendingSnapshot(e.data.snapshot);
      }
    };

    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [upsertActivities, saveSnapshotToDb, hydrateIframe, refreshStatus, isAdminOrPm]);

  // Realtime subscription for cpm_task_mappings changes
  useEffect(() => {
    const channel = supabase
      .channel("cpm-mappings-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "cpm_task_mappings" },
        () => {
          // Debounce: refresh status after mapping changes
          setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: ["cpm_task_mappings"] });
            queryClient.invalidateQueries({ queryKey: ["cpm_existing_mappings"] });
            queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
            refreshStatus(iframeRef.current?.contentWindow || null);
          }, 300);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [queryClient, refreshStatus]);

  const handleOrphanResolutionComplete = useCallback(() => {
    setOrphansToResolve([]);
    setNewActivityList([]);
    queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
    refreshStatus(iframeRef.current?.contentWindow || null);
  }, [queryClient, refreshStatus]);

  return (
    <div className="h-full w-full flex flex-col relative">
      {/* Floating toolbar — Admin/PM only */}
      {isAdminOrPm && (
        <div className={`absolute top-2 z-10 transition-all ${selectedActivity ? `right-[${panelWidth + 10}px]` : 'right-2'}`} style={selectedActivity ? { right: panelWidth + 10 } : undefined}>
          <SnapshotManager
            onLoadSnapshot={handleLoadSnapshot}
            onRequestCurrentSnapshot={handleRequestCurrentSnapshot}
            pendingSnapshot={pendingSnapshot}
            onSnapshotHandled={() => setPendingSnapshot(null)}
          />
        </div>
      )}

      <div className="flex flex-1 min-h-0">
        <div className={`${selectedActivity ? 'flex-1' : 'w-full'} transition-all`}>
          <iframe
            ref={iframeRef}
            src="/cpm_network.html"
            className="w-full h-full border-0"
            title="CPM Network Scheduler"
            sandbox="allow-scripts allow-same-origin allow-popups"
            onLoad={() => {
              iframeRef.current?.contentWindow?.postMessage({ type: "set-read-only", readOnly: !isAdminOrPm }, "*");
              // Primary hydration: send snapshot + statuses + customFields in one shot
              hydrateIframe(iframeRef.current?.contentWindow || null);
            }}
          />
        </div>
        {selectedActivity && (
          <div className="flex-shrink-0 h-full flex" style={{ width: panelWidth }}>
            {/* Resize handle */}
            <div
              className="w-1.5 h-full cursor-col-resize hover:bg-primary/30 active:bg-primary/50 transition-colors flex-shrink-0 group relative"
              onMouseDown={(e) => {
                e.preventDefault();
                resizingRef.current = true;
                const startX = e.clientX;
                const startW = panelWidth;
                if (iframeRef.current) iframeRef.current.style.pointerEvents = 'none';
                const onMove = (ev: MouseEvent) => {
                  if (!resizingRef.current) return;
                  const newW = Math.max(280, Math.min(800, startW + (startX - ev.clientX)));
                  setPanelWidth(newW);
                };
                const onUp = () => {
                  resizingRef.current = false;
                  if (iframeRef.current) iframeRef.current.style.pointerEvents = '';
                  window.removeEventListener('mousemove', onMove);
                  window.removeEventListener('mouseup', onUp);
                };
                window.addEventListener('mousemove', onMove);
                window.addEventListener('mouseup', onUp);
              }}
            >
              <div className="absolute inset-y-0 left-0 w-1 rounded-full bg-border group-hover:bg-primary/50" />
            </div>
            <div className="flex-1 min-w-0">
              <ActivityTaskPanel
                activity={selectedActivity}
                onClose={() => setSelectedActivity(null)}
                onStatusChanged={() => refreshStatus(iframeRef.current?.contentWindow || null)}
              />
            </div>
          </div>
        )}
      </div>

      {/* Orphan Resolution Dialog */}
      {orphansToResolve.length > 0 && (
        <OrphanResolutionDialog
          orphans={orphansToResolve}
          newActivities={newActivityList}
          userName={memberName || "System"}
          onComplete={handleOrphanResolutionComplete}
        />
      )}
    </div>
  );
};

export default CpmScheduler;
