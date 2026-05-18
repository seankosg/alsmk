import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowRightLeft, Trash2, Search, Sparkles, AlertTriangle, Flag } from "lucide-react";
import { useAuthContext } from "@/components/layout/AppLayout";
import {
  scoreCandidates, type CandidateActivity, type OrphanLike, type ScoredCandidate,
} from "@/components/cpm/OrphanRecommender";
import { NewActivityCombobox } from "@/components/cpm/NewActivityCombobox";

interface OrphanActivity extends OrphanLike {
  mpp_uid: string | null;
  mpp_task_id: string | null;
  semantic_key: string | null;
}

interface OrphanTaskRow {
  rowKey: string;          // `${orphanActivityId}::${taskId}`
  orphan: OrphanActivity;
  task: {
    id: string;
    task_code: string | null;
    title: string;
    current_progress: number;
    issue_flag: string;
    end_date: string | null;
    assignee_name: string | null;
  };
}

interface DeletedLogRow {
  id: string;
  created_at: string;
  user_name: string;
  details: any;
}

function formatLabel(c: CandidateActivity): string {
  const cf = c.custom_fields || {};
  const bldg = cf.BLDG || cf.Text2 || cf["텍스트2"] || "";
  const parts = (c.wbs_full || "").split(".");
  const wbsL2 = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : parts[0] || "";
  return [bldg, wbsL2, c.name].filter(Boolean).join(" · ");
}

export default function CpmOrphanCenter() {
  const { isAdminOrPm, memberName } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdminOrPm) navigate("/", { replace: true });
  }, [isAdminOrPm, navigate]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickedTarget, setPickedTarget] = useState<Record<string, string | null>>({});
  // null = "매핑 해제", undefined = 미선택(추천 1순위 사용), string = 명시적 선택
  const [processing, setProcessing] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<null | "auto" | "selected" | "unmap">(null);

  // 1) 최신 활성 mpp_uid set (auto_pre_upload 제외)
  const { data: activeMppUids } = useQuery({
    queryKey: ["cpm_active_mpp_uids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_snapshots")
        .select("data, created_at, name")
        .order("created_at", { ascending: false })
        .limit(20);
      const latest = (data || []).find((s) => !s.name?.startsWith("auto_pre_upload_"));
      const acts = (latest?.data as any)?.activities ?? [];
      const set = new Set<string>();
      acts.forEach((a: any) => {
        const u = a?.mppUid || a?.mpp_uid || a?._uid;
        if (u) set.add(String(u));
      });
      return set;
    },
    staleTime: 10_000,
  });

  // 2) 모든 활성 Activity
  const { data: dbActivities = [] } = useQuery({
    queryKey: ["cpm_activities_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_activities")
        .select("id, name, wbs_full, mpp_uid, mpp_task_id, semantic_key, custom_fields")
        .limit(5000);
      return (data || []) as any[];
    },
    staleTime: 10_000,
  });

  // 3) 모든 매핑
  const { data: allMappings = [] } = useQuery({
    queryKey: ["cpm_mappings_all"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_task_mappings")
        .select("activity_id, task_id")
        .limit(20000);
      return (data || []) as { activity_id: string; task_id: string }[];
    },
    staleTime: 10_000,
  });

  // 4) Task 메타
  const orphanActivities = useMemo<OrphanActivity[]>(() => {
    if (!activeMppUids) return [];
    return dbActivities
      .filter((a) => a.mpp_uid && !activeMppUids.has(String(a.mpp_uid)))
      .map((a) => ({
        id: a.id, name: a.name, wbs_full: a.wbs_full,
        mpp_uid: a.mpp_uid, mpp_task_id: a.mpp_task_id, semantic_key: a.semantic_key,
        custom_fields: a.custom_fields as Record<string, string> | null,
      }));
  }, [dbActivities, activeMppUids]);

  const orphanActivityIds = useMemo(
    () => new Set(orphanActivities.map((o) => o.id)),
    [orphanActivities],
  );

  const orphanTaskIds = useMemo(() => {
    const ids = new Set<string>();
    allMappings.forEach((m) => {
      if (orphanActivityIds.has(m.activity_id)) ids.add(m.task_id);
    });
    return Array.from(ids);
  }, [allMappings, orphanActivityIds]);

  const { data: tasksById = {} } = useQuery({
    queryKey: ["orphan_tasks_meta", orphanTaskIds.sort().join(",")],
    enabled: orphanTaskIds.length > 0,
    queryFn: async () => {
      const { data } = await supabase
        .from("tasks")
        .select("id, task_code, title, current_progress, issue_flag, end_date, assignee_id")
        .in("id", orphanTaskIds);
      const assigneeIds = Array.from(
        new Set((data || []).map((t: any) => t.assignee_id).filter(Boolean)),
      );
      const { data: members } = assigneeIds.length
        ? await supabase.from("members").select("id, name").in("id", assigneeIds)
        : { data: [] as any[] };
      const nameById = Object.fromEntries((members || []).map((m: any) => [m.id, m.name]));
      const map: Record<string, OrphanTaskRow["task"]> = {};
      (data || []).forEach((t: any) => {
        map[t.id] = {
          id: t.id,
          task_code: t.task_code,
          title: t.title,
          current_progress: t.current_progress,
          issue_flag: t.issue_flag,
          end_date: t.end_date,
          assignee_name: t.assignee_id ? nameById[t.assignee_id] || null : null,
        };
      });
      return map;
    },
    staleTime: 10_000,
  });

  // 5) Task 행 평탄화
  const orphanTaskRows = useMemo<OrphanTaskRow[]>(() => {
    const orphanById = new Map(orphanActivities.map((o) => [o.id, o]));
    const rows: OrphanTaskRow[] = [];
    allMappings.forEach((m) => {
      const orphan = orphanById.get(m.activity_id);
      if (!orphan) return;
      const task = tasksById[m.task_id];
      if (!task) return;
      rows.push({
        rowKey: `${m.activity_id}::${m.task_id}`,
        orphan,
        task,
      });
    });
    return rows.sort((a, b) =>
      (a.orphan.wbs_full || "").localeCompare(b.orphan.wbs_full || "") ||
      a.orphan.name.localeCompare(b.orphan.name),
    );
  }, [allMappings, orphanActivities, tasksById]);

  // 6) 신규 Activity 후보
  const candidates = useMemo<CandidateActivity[]>(() => {
    if (!activeMppUids) return [];
    return dbActivities
      .filter((a) => a.mpp_uid && activeMppUids.has(String(a.mpp_uid)))
      .map((a) => ({
        id: a.id, name: a.name, wbs_full: a.wbs_full,
        custom_fields: a.custom_fields as Record<string, string> | null,
      }));
  }, [dbActivities, activeMppUids]);

  // 7) 추천 (Orphan Activity 단위로 캐시)
  const recommendationsByOrphan = useMemo(() => {
    const m = new Map<string, ScoredCandidate[]>();
    orphanActivities.forEach((o) => m.set(o.id, scoreCandidates(o, candidates, 3)));
    return m;
  }, [orphanActivities, candidates]);

  // 8) 자동 삭제 이력
  const { data: autoDeleted = [] } = useQuery({
    queryKey: ["cpm_orphan_auto_deleted"],
    queryFn: async () => {
      const { data } = await supabase
        .from("activity_log")
        .select("id, created_at, user_name, details")
        .eq("action", "cpm_activity_deleted")
        .order("created_at", { ascending: false })
        .limit(200);
      return (data || []).filter(
        (r: any) => r.details?.resolution === "auto_deleted_no_mappings",
      ).slice(0, 50) as DeletedLogRow[];
    },
    staleTime: 10_000,
  });

  const summary = useMemo(() => {
    const orphanIds = new Set(orphanTaskRows.map((r) => r.orphan.id));
    return {
      taskCount: orphanTaskRows.length,
      orphanCount: orphanIds.size,
      autoDeleted: autoDeleted.length,
    };
  }, [orphanTaskRows, autoDeleted]);

  const getEffectiveTarget = (row: OrphanTaskRow): { id: string | null; auto: boolean } => {
    if (row.rowKey in pickedTarget) {
      return { id: pickedTarget[row.rowKey], auto: false };
    }
    const rec = recommendationsByOrphan.get(row.orphan.id)?.[0];
    return { id: rec?.candidate.id ?? null, auto: true };
  };

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["cpm_activities_all"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_mappings_all"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_orphan_auto_deleted"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_active_mpp_uids"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_task_mappings"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_existing_mappings"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
    queryClient.invalidateQueries({ queryKey: ["orphan_tasks_meta"] });
  };

  /** Task 단위 재매핑:
   *  - targetId: 신규 Activity id로 매핑 이전
   *  - null: 매핑만 해제
   *  - 처리 후 orphan_activity에 매핑이 0개 남으면 cpm_activities 삭제 */
  const remapTask = async (row: OrphanTaskRow, targetId: string | null) => {
    // 1) orphan에서 이 task 매핑 제거
    await supabase
      .from("cpm_task_mappings")
      .delete()
      .eq("activity_id", row.orphan.id)
      .eq("task_id", row.task.id);

    // 2) targetId가 있으면 새 활성 Activity에 매핑 추가 (중복 방지)
    if (targetId) {
      const { data: existing } = await supabase
        .from("cpm_task_mappings")
        .select("task_id")
        .eq("activity_id", targetId);
      const existingIds = (existing || []).map((m) => m.task_id);
      if (!existingIds.includes(row.task.id)) {
        await supabase.rpc("upsert_activity_mappings", {
          _activity_id: targetId,
          _task_ids: [...existingIds, row.task.id],
        });
      }
    }

    // 3) activity_log
    await supabase.from("activity_log").insert({
      action: "cpm_task_remapped",
      entity_type: "cpm_activity",
      entity_id: row.orphan.id,
      user_name: memberName || "System",
      details: {
        from_activity: row.orphan.id,
        from_name: row.orphan.name,
        from_wbs: row.orphan.wbs_full,
        to_activity: targetId,
        task_id: row.task.id,
        task_code: row.task.task_code,
        resolution: targetId ? "task_remapped" : "task_unmapped",
      },
    });

    // 4) Orphan 매핑 0개면 Activity 자동 삭제
    const { data: remaining } = await supabase
      .from("cpm_task_mappings")
      .select("id")
      .eq("activity_id", row.orphan.id)
      .limit(1);
    if (!remaining || remaining.length === 0) {
      await supabase.from("cpm_activities").delete().eq("id", row.orphan.id);
      await supabase.from("activity_log").insert({
        action: "cpm_activity_deleted",
        entity_type: "cpm_activity",
        entity_id: row.orphan.id,
        user_name: memberName || "System",
        details: {
          name: row.orphan.name,
          wbs_full: row.orphan.wbs_full,
          mpp_task_id: row.orphan.mpp_task_id,
          semantic_key: row.orphan.semantic_key,
          resolution: "auto_deleted_after_remap",
        },
      });
    }
  };

  const handleRowApply = async (row: OrphanTaskRow) => {
    const { id: targetId } = getEffectiveTarget(row);
    setProcessing(true);
    try {
      await remapTask(row, targetId);
      toast.success(
        targetId
          ? `"${row.task.task_code || row.task.title}" 재매핑 완료`
          : `"${row.task.task_code || row.task.title}" 매핑 해제`,
      );
      refreshAll();
    } catch (e: any) {
      toast.error("처리 실패: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const runBulk = async (filter: (r: OrphanTaskRow) => boolean, mode: "remap" | "unmap") => {
    setProcessing(true);
    let ok = 0, fail = 0;
    for (const row of orphanTaskRows.filter(filter)) {
      try {
        const target = mode === "unmap" ? null : getEffectiveTarget(row).id;
        if (mode === "remap" && !target) continue;
        await remapTask(row, target);
        ok++;
      } catch (e) { console.error(e); fail++; }
    }
    setSelected(new Set());
    setProcessing(false);
    if (ok) toast.success(`${ok}건 처리 완료`);
    if (fail) toast.error(`${fail}건 실패`);
    refreshAll();
  };

  const handleFindInGraph = async (log: DeletedLogRow) => {
    const sk = log.details?.semantic_key;
    let mppTaskId: string | null = null;
    if (sk) {
      const { data } = await supabase
        .from("cpm_activities").select("mpp_task_id")
        .eq("semantic_key", sk).limit(1).maybeSingle();
      mppTaskId = (data as any)?.mpp_task_id ?? null;
    }
    if (!mppTaskId) {
      const { data } = await supabase
        .from("cpm_activities").select("mpp_task_id")
        .eq("name", log.details?.name || "").limit(1).maybeSingle();
      mppTaskId = (data as any)?.mpp_task_id ?? null;
    }
    if (mppTaskId) navigate(`/cpm?highlight=${encodeURIComponent(mppTaskId)}`);
    else toast.info("현재 그래프에서 동일 Activity를 찾지 못했습니다");
  };

  if (!isAdminOrPm) return null;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orphan 매핑 복구 센터</h1>
        <p className="text-sm text-muted-foreground mt-1">
          새 XML에서 사라진 Activity에 매핑되어 있던 Task들을 신규 Activity로 재연결합니다.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">갈 곳 잃은 Task</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{summary.taskCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">영향 Orphan Activity</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.orphanCount}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">최근 자동 삭제</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.autoDeleted}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="unresolved" className="space-y-4">
        <TabsList>
          <TabsTrigger value="unresolved">미해결 Task ({orphanTaskRows.length})</TabsTrigger>
          <TabsTrigger value="auto-deleted">자동 삭제 이력 ({autoDeleted.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="unresolved" className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              onClick={() => setConfirmBulk("auto")}
              disabled={processing || orphanTaskRows.length === 0}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              추천 95점 이상 일괄 적용
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setConfirmBulk("selected")}
              disabled={processing || selected.size === 0}
            >
              <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
              선택 일괄 적용 ({selected.size})
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmBulk("unmap")}
              disabled={processing || selected.size === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              선택 매핑 해제
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={orphanTaskRows.length > 0 && selected.size === orphanTaskRows.length}
                        onCheckedChange={(v) => {
                          if (v) setSelected(new Set(orphanTaskRows.map((r) => r.rowKey)));
                          else setSelected(new Set());
                        }}
                      />
                    </TableHead>
                    <TableHead className="w-[260px]">Orphan Activity (WBS · 이름)</TableHead>
                    <TableHead className="w-[240px]">기존 매핑 Task</TableHead>
                    <TableHead>신규 Activity 선택</TableHead>
                    <TableHead className="text-right w-[90px]">적용</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphanTaskRows.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={5} className="text-center text-muted-foreground py-8">
                        갈 곳 잃은 Task가 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {orphanTaskRows.map((row) => {
                    const recs = recommendationsByOrphan.get(row.orphan.id) || [];
                    const { id: effectiveId, auto } = getEffectiveTarget(row);
                    const cf = row.orphan.custom_fields || {};
                    const bldg = cf.BLDG || cf.Text2 || cf["텍스트2"] || "";
                    const issue = row.task.issue_flag !== "normal";
                    return (
                      <TableRow key={row.rowKey}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(row.rowKey)}
                            onCheckedChange={(v) => {
                              const next = new Set(selected);
                              if (v) next.add(row.rowKey); else next.delete(row.rowKey);
                              setSelected(next);
                            }}
                          />
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-medium truncate">{row.orphan.name}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 truncate">
                            {bldg && <Badge variant="secondary" className="mr-1 text-[10px] px-1 py-0">{bldg}</Badge>}
                            {row.orphan.wbs_full || "-"}
                          </div>
                          <div className="text-[10px] text-muted-foreground mt-0.5 font-mono">
                            uid {row.orphan.mpp_uid}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="text-xs font-mono text-primary">
                            {row.task.task_code || "-"}
                          </div>
                          <div className="text-xs truncate flex items-center gap-1">
                            {issue && <Flag className="h-3 w-3 text-destructive shrink-0" />}
                            {row.task.title}
                          </div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 flex items-center gap-1.5">
                            {row.task.assignee_name && <span>{row.task.assignee_name}</span>}
                            <span>·</span>
                            <span>{row.task.current_progress}%</span>
                            {row.task.end_date && <><span>·</span><span>~{row.task.end_date}</span></>}
                          </div>
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <NewActivityCombobox
                              value={effectiveId}
                              onChange={(id) =>
                                setPickedTarget((p) => ({ ...p, [row.rowKey]: id }))
                              }
                              candidates={candidates}
                              recommendations={recs}
                              disabled={processing}
                              className="max-w-[340px]"
                            />
                            {auto && recs[0] && (
                              <Badge
                                variant={recs[0].score >= 95 ? "default" : "outline"}
                                className="text-[10px] px-1.5 py-0 shrink-0"
                                title="추천 1순위 (자동 선택)"
                              >
                                추천 {recs[0].score}
                              </Badge>
                            )}
                            {!auto && effectiveId === null && (
                              <Badge variant="destructive" className="text-[10px] px-1.5 py-0">해제</Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRowApply(row)}
                            disabled={processing || (effectiveId === undefined as any)}
                          >
                            적용
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {orphanTaskRows.length > 0 && (
            <div className="text-xs text-muted-foreground flex items-center gap-1">
              <AlertTriangle className="h-3 w-3" />
              Orphan Activity의 마지막 Task까지 재매핑/해제되면 해당 Activity는 자동 삭제됩니다.
            </div>
          )}
        </TabsContent>

        <TabsContent value="auto-deleted">
          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>이름</TableHead>
                    <TableHead>BLDG</TableHead>
                    <TableHead>WBS</TableHead>
                    <TableHead>삭제 시각</TableHead>
                    <TableHead>처리자</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {autoDeleted.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                        자동 삭제 이력이 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {autoDeleted.map((log) => {
                    const d = log.details || {};
                    return (
                      <TableRow key={log.id}>
                        <TableCell className="font-medium">{d.name || "-"}</TableCell>
                        <TableCell><Badge variant="secondary">{d.bldg || "-"}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[200px]">{d.wbs_full || "-"}</TableCell>
                        <TableCell className="text-xs">{format(new Date(log.created_at), "yyyy-MM-dd HH:mm")}</TableCell>
                        <TableCell className="text-xs">{log.user_name}</TableCell>
                        <TableCell className="text-right">
                          <Button size="sm" variant="ghost" onClick={() => handleFindInGraph(log)}>
                            <Search className="h-3.5 w-3.5 mr-1" />
                            현재 그래프에서 찾기
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <AlertDialog open={confirmBulk !== null} onOpenChange={(o) => !o && setConfirmBulk(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmBulk === "auto" && "추천 95점 이상 일괄 적용"}
              {confirmBulk === "selected" && "선택한 Task 일괄 재매핑"}
              {confirmBulk === "unmap" && "선택한 Task 매핑 해제"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBulk === "auto" &&
                "추천 점수 95점 이상인 Task들을 추천 1순위 Activity로 일괄 이전합니다. 각 Orphan Activity는 매핑이 모두 빠지면 자동 삭제됩니다."}
              {confirmBulk === "selected" &&
                `선택한 ${selected.size}건의 Task를 현재 콤보박스에 표시된 신규 Activity로 이전합니다.`}
              {confirmBulk === "unmap" &&
                `선택한 ${selected.size}건의 Task에서 Orphan Activity 매핑을 제거합니다. (Task 자체는 삭제되지 않습니다)`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const mode = confirmBulk;
                setConfirmBulk(null);
                if (mode === "auto") {
                  await runBulk(
                    (r) => {
                      const recs = recommendationsByOrphan.get(r.orphan.id) || [];
                      return (recs[0]?.score ?? 0) >= 95;
                    },
                    "remap",
                  );
                } else if (mode === "selected") {
                  await runBulk((r) => selected.has(r.rowKey), "remap");
                } else if (mode === "unmap") {
                  await runBulk((r) => selected.has(r.rowKey), "unmap");
                }
              }}
            >
              실행
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
