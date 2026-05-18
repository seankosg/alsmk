import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Sparkles, X, Check, Flag } from "lucide-react";
import { NewActivityCombobox } from "@/components/cpm/NewActivityCombobox";
import {
  scoreCandidates, type CandidateActivity, type ScoredCandidate,
} from "@/components/cpm/OrphanRecommender";

export interface OrphanActivity {
  id: string;
  name: string;
  wbs_full: string | null;
  mpp_task_id: string | null;
  mappedTaskCount: number;
  mappedTaskIds: string[];
  semantic_key?: string | null;
  custom_fields?: Record<string, string> | null;
}

interface NewActivity {
  id: string;
  name: string;
  wbs_full: string | null;
  semantic_key?: string | null;
  custom_fields?: Record<string, string> | null;
}

interface Props {
  orphans: OrphanActivity[];
  newActivities: NewActivity[];
  userName: string;
  onComplete: () => void;
}

interface TaskMeta {
  id: string;
  task_code: string | null;
  title: string;
  current_progress: number;
  issue_flag: string;
  assignee_name: string | null;
}

interface TaskRow {
  rowKey: string; // orphanId::taskId
  orphan: OrphanActivity;
  task: TaskMeta;
  recommendations: ScoredCandidate[];
}

function formatLabel(c: CandidateActivity): string {
  const cf = c.custom_fields || {};
  const bldg = cf.BLDG || cf.Text2 || cf["텍스트2"] || "";
  const parts = (c.wbs_full || "").split(".");
  const wbsL2 = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] || "";
  return [bldg, wbsL2, c.name].filter(Boolean).join(" · ");
}

function orphanBadges(o: OrphanActivity) {
  const cf = o.custom_fields || {};
  const bldg = cf.BLDG || cf.Text2 || cf["텍스트2"];
  const parts = (o.wbs_full || "").split(".");
  const wbsL2 = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : null;
  return { bldg, wbsL2 };
}

export function OrphanResolutionDialog({
  orphans, newActivities, userName, onComplete,
}: Props) {
  const [tasksById, setTasksById] = useState<Record<string, TaskMeta>>({});
  const [pickedTarget, setPickedTarget] = useState<Record<string, string | null>>({});
  // null = 매핑 해제, undefined = 추천 1순위 사용, string = 명시 선택
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [processedKeys, setProcessedKeys] = useState<Set<string>>(new Set());
  const [removedOrphans, setRemovedOrphans] = useState<Set<string>>(new Set());
  const [processing, setProcessing] = useState(false);
  const [loading, setLoading] = useState(true);

  // 1) Task 메타 로드
  useEffect(() => {
    const ids = Array.from(new Set(orphans.flatMap((o) => o.mappedTaskIds)));
    if (ids.length === 0) { setLoading(false); return; }
    (async () => {
      setLoading(true);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, task_code, title, current_progress, issue_flag, assignee_id")
        .in("id", ids);
      const assigneeIds = Array.from(
        new Set((tasks || []).map((t: any) => t.assignee_id).filter(Boolean)),
      );
      const { data: members } = assigneeIds.length
        ? await supabase.from("members").select("id, name").in("id", assigneeIds)
        : { data: [] as any[] };
      const nameById = Object.fromEntries((members || []).map((m: any) => [m.id, m.name]));
      const map: Record<string, TaskMeta> = {};
      (tasks || []).forEach((t: any) => {
        map[t.id] = {
          id: t.id,
          task_code: t.task_code,
          title: t.title,
          current_progress: t.current_progress,
          issue_flag: t.issue_flag,
          assignee_name: t.assignee_id ? nameById[t.assignee_id] || null : null,
        };
      });
      setTasksById(map);
      setLoading(false);
    })();
  }, [orphans]);

  // 2) Task 행 평탄화 + 추천
  const allRows = useMemo<TaskRow[]>(() => {
    const rows: TaskRow[] = [];
    const candCache = new Map<string, ScoredCandidate[]>();
    orphans.forEach((o) => {
      if (!candCache.has(o.id)) {
        candCache.set(o.id, scoreCandidates(o, newActivities as CandidateActivity[], 3));
      }
      o.mappedTaskIds.forEach((tid) => {
        const t = tasksById[tid];
        if (!t) return;
        rows.push({
          rowKey: `${o.id}::${tid}`,
          orphan: o,
          task: t,
          recommendations: candCache.get(o.id) || [],
        });
      });
    });
    return rows.sort((a, b) =>
      (a.orphan.wbs_full || "").localeCompare(b.orphan.wbs_full || "") ||
      a.orphan.name.localeCompare(b.orphan.name),
    );
  }, [orphans, newActivities, tasksById]);

  const visibleRows = useMemo(
    () => allRows.filter((r) => !processedKeys.has(r.rowKey)),
    [allRows, processedKeys],
  );

  const getEffectiveTarget = (r: TaskRow): { id: string | null; auto: boolean } => {
    if (r.rowKey in pickedTarget) return { id: pickedTarget[r.rowKey], auto: false };
    const rec = r.recommendations[0];
    return { id: rec?.candidate.id ?? null, auto: true };
  };

  const remapTask = async (r: TaskRow, targetId: string | null) => {
    await supabase
      .from("cpm_task_mappings")
      .delete()
      .eq("activity_id", r.orphan.id)
      .eq("task_id", r.task.id);

    if (targetId) {
      const { data: existing } = await supabase
        .from("cpm_task_mappings")
        .select("task_id")
        .eq("activity_id", targetId);
      const existingIds = (existing || []).map((m) => m.task_id);
      if (!existingIds.includes(r.task.id)) {
        await supabase.rpc("upsert_activity_mappings", {
          _activity_id: targetId,
          _task_ids: [...existingIds, r.task.id],
        });
      }
    }

    await supabase.from("activity_log").insert({
      action: "cpm_task_remapped",
      entity_type: "cpm_activity",
      entity_id: r.orphan.id,
      user_name: userName,
      details: {
        from_activity: r.orphan.id,
        from_name: r.orphan.name,
        from_wbs: r.orphan.wbs_full,
        to_activity: targetId,
        task_id: r.task.id,
        task_code: r.task.task_code,
        resolution: targetId ? "task_remapped" : "task_unmapped",
        source: "upload_dialog",
      },
    });

    // orphan 매핑 0개 → cpm_activities 삭제
    const { data: rem } = await supabase
      .from("cpm_task_mappings")
      .select("id")
      .eq("activity_id", r.orphan.id)
      .limit(1);
    if (!rem || rem.length === 0) {
      await supabase.from("cpm_activities").delete().eq("id", r.orphan.id);
      await supabase.from("activity_log").insert({
        action: "cpm_activity_deleted",
        entity_type: "cpm_activity",
        entity_id: r.orphan.id,
        user_name: userName,
        details: {
          name: r.orphan.name,
          wbs_full: r.orphan.wbs_full,
          mpp_task_id: r.orphan.mpp_task_id,
          semantic_key: r.orphan.semantic_key,
          resolution: "auto_deleted_after_remap",
          source: "upload_dialog",
        },
      });
      setRemovedOrphans((prev) => new Set(prev).add(r.orphan.id));
    }
  };

  const handleRowApply = async (r: TaskRow) => {
    const { id: targetId } = getEffectiveTarget(r);
    setProcessing(true);
    try {
      await remapTask(r, targetId);
      setProcessedKeys((prev) => new Set(prev).add(r.rowKey));
      toast.success(
        targetId
          ? `"${r.task.task_code || r.task.title}" 재매핑 완료`
          : `"${r.task.task_code || r.task.title}" 매핑 해제`,
      );
    } catch (e: any) {
      toast.error("처리 실패: " + (e?.message ?? ""));
    } finally {
      setProcessing(false);
    }
  };

  const runBulk = async (rows: TaskRow[], mode: "remap" | "unmap") => {
    setProcessing(true);
    let ok = 0, fail = 0;
    for (const r of rows) {
      try {
        const target = mode === "unmap" ? null : getEffectiveTarget(r).id;
        if (mode === "remap" && !target) continue;
        await remapTask(r, target);
        setProcessedKeys((prev) => new Set(prev).add(r.rowKey));
        ok++;
      } catch (e) {
        console.error(e); fail++;
      }
    }
    setSelected(new Set());
    setProcessing(false);
    toast[fail > 0 ? "warning" : "success"](`처리 ${ok}건${fail ? ` / 실패 ${fail}건` : ""}`);
  };

  const handleAutoApplyHigh = () => {
    const targets = visibleRows.filter((r) => (r.recommendations[0]?.score ?? 0) >= 95);
    if (targets.length === 0) {
      toast.info("95점 이상 추천이 있는 행이 없습니다");
      return;
    }
    runBulk(targets, "remap");
  };

  const handleBulkUnmap = () => {
    const rows = visibleRows.filter((r) => selected.has(r.rowKey));
    if (rows.length === 0) { toast.info("선택된 행이 없습니다"); return; }
    runBulk(rows, "unmap");
  };

  const handleDone = async () => {
    // 남은 미처리 Orphan Activity (이미 처리/삭제된 것 제외)
    const remainingOrphanIds = Array.from(
      new Set(visibleRows.map((r) => r.orphan.id)),
    ).filter((id) => !removedOrphans.has(id));

    if (visibleRows.length > 0) {
      toast.warning(`미해결 Task ${visibleRows.length}건은 그대로 남습니다. CPM Orphan Center에서 계속 처리하세요.`);
    }

    // 빈 orphan(매핑이 0개로 남은 Activity)은 정리
    for (const oid of remainingOrphanIds) {
      const { data: rem } = await supabase
        .from("cpm_task_mappings")
        .select("id")
        .eq("activity_id", oid)
        .limit(1);
      if (!rem || rem.length === 0) {
        await supabase.from("cpm_activities").delete().eq("id", oid);
      }
    }
    onComplete();
  };

  const open = orphans.length > 0;
  const allChecked = visibleRows.length > 0 && visibleRows.every((r) => selected.has(r.rowKey));

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) handleDone(); }}>
      <DialogContent className="max-w-5xl max-h-[85vh] flex flex-col" aria-describedby={undefined}>
        <DialogHeader>
          <DialogTitle>CPM Activity 매핑 확인 — Task 재매핑</DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          새 XML에 없는 Activity의 매핑 Task <b>{visibleRows.length}</b>건이 있습니다.
          각 Task를 신규 Activity로 이전하거나 매핑을 해제하세요.
        </p>

        <div className="flex-1 overflow-auto min-h-0 border border-border rounded-md">
          <table className="w-full text-xs">
            <thead className="bg-muted/50 sticky top-0 z-10">
              <tr>
                <th className="w-8 p-2">
                  <Checkbox
                    checked={allChecked}
                    onCheckedChange={(c) => {
                      if (c) setSelected(new Set(visibleRows.map((r) => r.rowKey)));
                      else setSelected(new Set());
                    }}
                  />
                </th>
                <th className="text-left p-2 font-medium">Orphan Activity</th>
                <th className="text-left p-2 font-medium">기존 매핑 Task</th>
                <th className="text-left p-2 font-medium w-[340px]">신규 Activity</th>
                <th className="w-16 p-2"></th>
              </tr>
            </thead>
            <tbody>
              {loading && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">로딩 중...</td></tr>
              )}
              {!loading && visibleRows.length === 0 && (
                <tr><td colSpan={5} className="p-6 text-center text-muted-foreground">
                  모든 Task가 처리되었습니다. 완료를 눌러주세요.
                </td></tr>
              )}
              {visibleRows.map((r) => {
                const { bldg, wbsL2 } = orphanBadges(r.orphan);
                const eff = getEffectiveTarget(r);
                const topRec = r.recommendations[0];
                const isHighRec = (topRec?.score ?? 0) >= 95;
                return (
                  <tr key={r.rowKey} className="border-t border-border align-top hover:bg-muted/20">
                    <td className="p-2">
                      <Checkbox
                        checked={selected.has(r.rowKey)}
                        onCheckedChange={(c) => {
                          const next = new Set(selected);
                          if (c) next.add(r.rowKey); else next.delete(r.rowKey);
                          setSelected(next);
                        }}
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1 flex-wrap mb-0.5">
                        {bldg && <Badge variant="outline" className="text-[10px] px-1 py-0">{bldg}</Badge>}
                        {wbsL2 && <span className="text-muted-foreground">L2 {wbsL2}</span>}
                      </div>
                      <div className="font-medium truncate max-w-[260px]">{r.orphan.name}</div>
                      <div className="text-[10px] text-muted-foreground">
                        WBS {r.orphan.wbs_full || "-"} · uid {r.orphan.mpp_uid ?? "-"}
                      </div>
                    </td>
                    <td className="p-2">
                      <div className="flex items-center gap-1 mb-0.5">
                        <span className="font-mono text-[11px]">{r.task.task_code || "-"}</span>
                        {r.task.issue_flag !== "normal" && (
                          <Flag className="h-3 w-3 text-destructive" />
                        )}
                      </div>
                      <div className="truncate max-w-[260px]">{r.task.title}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {r.task.assignee_name || "미지정"} · 진척 {r.task.current_progress}%
                      </div>
                    </td>
                    <td className="p-2">
                      <NewActivityCombobox
                        value={eff.id}
                        onChange={(id) =>
                          setPickedTarget((prev) => ({ ...prev, [r.rowKey]: id }))
                        }
                        candidates={newActivities as CandidateActivity[]}
                        recommendations={r.recommendations}
                        disabled={processing}
                      />
                      {eff.auto && topRec && (
                        <div className="mt-1 flex items-center gap-1 text-[10px] text-muted-foreground">
                          <Sparkles className="h-3 w-3" />
                          추천 {topRec.score}점
                          {isHighRec && <Badge className="text-[9px] px-1 py-0">자동 적용 대상</Badge>}
                        </div>
                      )}
                    </td>
                    <td className="p-2">
                      <Button
                        size="sm"
                        variant={eff.id ? "default" : "outline"}
                        disabled={processing}
                        onClick={() => handleRowApply(r)}
                        className="h-7 px-2"
                      >
                        {eff.id ? <Check className="h-3.5 w-3.5" /> : <X className="h-3.5 w-3.5" />}
                      </Button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <DialogFooter className="gap-2 flex-wrap">
          <Button
            variant="outline"
            onClick={handleAutoApplyHigh}
            disabled={processing || visibleRows.length === 0}
          >
            <Sparkles className="h-3.5 w-3.5 mr-1" />
            추천 95점↑ 일괄 적용
          </Button>
          <Button
            variant="outline"
            onClick={handleBulkUnmap}
            disabled={processing || selected.size === 0}
          >
            <X className="h-3.5 w-3.5 mr-1" />
            선택 매핑 해제 ({selected.size})
          </Button>
          <Button onClick={handleDone} disabled={processing}>완료</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
