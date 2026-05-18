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
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { format } from "date-fns";
import { ArrowRightLeft, Trash2, Search, Sparkles } from "lucide-react";
import { useAuthContext } from "@/components/layout/AppLayout";
import { recommendFor, type CandidateActivity, type OrphanLike } from "@/components/cpm/OrphanRecommender";

interface OrphanRow extends OrphanLike {
  mpp_uid: string | null;
  mpp_task_id: string | null;
  semantic_key: string | null;
  mappedTaskCount: number;
  mappedTaskIds: string[];
}

interface DeletedLogRow {
  id: string;
  created_at: string;
  user_name: string;
  details: any;
}

export default function CpmOrphanCenter() {
  const { isAdminOrPm, memberName } = useAuthContext();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!isAdminOrPm) navigate("/", { replace: true });
  }, [isAdminOrPm, navigate]);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pickedTarget, setPickedTarget] = useState<Record<string, string>>({});
  const [processing, setProcessing] = useState(false);
  const [confirmBulk, setConfirmBulk] = useState<null | "auto" | "delete">(null);

  // 1) 최신 스냅샷에서 활성 mpp_uid set 추출
  const { data: activeMppUids } = useQuery({
    queryKey: ["cpm_active_mpp_uids"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_snapshots")
        .select("data, created_at")
        .order("created_at", { ascending: false })
        .limit(20);
      // auto_pre_upload_ 으로 시작하는 백업은 건너뛴다
      const latest = (data || []).find((s) => {
        const n = (s.data as any)?.name as string | undefined;
        return !n || !n.startsWith("auto_pre_upload_");
      });
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

  // 2) DB의 모든 활성 Activity (후보 + 오펀 판별 원본)
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

  // 3) 매핑 수
  const { data: mappingsByActivity = {} } = useQuery({
    queryKey: ["cpm_mappings_grouped"],
    queryFn: async () => {
      const { data } = await supabase
        .from("cpm_task_mappings")
        .select("activity_id, task_id")
        .limit(10000);
      const map: Record<string, string[]> = {};
      (data || []).forEach((m) => {
        (map[m.activity_id] ||= []).push(m.task_id);
      });
      return map;
    },
    staleTime: 10_000,
  });

  // 4) 자동 삭제 이력
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

  // 오펀 = 활성 mpp_uid set에 없는 DB 행
  const orphans = useMemo<OrphanRow[]>(() => {
    if (!activeMppUids) return [];
    return dbActivities
      .filter((a) => a.mpp_uid && !activeMppUids.has(String(a.mpp_uid)))
      .map((a) => {
        const mapped = mappingsByActivity[a.id] || [];
        return {
          id: a.id,
          name: a.name,
          wbs_full: a.wbs_full,
          mpp_uid: a.mpp_uid,
          mpp_task_id: a.mpp_task_id,
          semantic_key: a.semantic_key,
          custom_fields: a.custom_fields as Record<string, string> | null,
          mappedTaskCount: mapped.length,
          mappedTaskIds: mapped,
        };
      });
  }, [dbActivities, mappingsByActivity, activeMppUids]);

  const candidates = useMemo<CandidateActivity[]>(() => {
    if (!activeMppUids) return [];
    return dbActivities
      .filter((a) => a.mpp_uid && activeMppUids.has(String(a.mpp_uid)))
      .map((a) => ({
        id: a.id, name: a.name, wbs_full: a.wbs_full,
        custom_fields: a.custom_fields as Record<string, string> | null,
      }));
  }, [dbActivities, activeMppUids]);

  // 각 오펀별 추천
  const recommendations = useMemo(() => {
    const m = new Map<string, ReturnType<typeof recommendFor>>();
    orphans.forEach((o) => m.set(o.id, recommendFor(o, candidates)));
    return m;
  }, [orphans, candidates]);

  const summary = useMemo(() => {
    const totalMappings = orphans.reduce((s, o) => s + o.mappedTaskCount, 0);
    const autoApplicable = orphans.filter((o) => (recommendations.get(o.id)?.score ?? 0) === 100).length;
    return { unresolved: orphans.length, totalMappings, autoApplicable, autoDeleted: autoDeleted.length };
  }, [orphans, recommendations, autoDeleted]);

  const refreshAll = () => {
    queryClient.invalidateQueries({ queryKey: ["cpm_activities_all"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_mappings_grouped"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_orphan_auto_deleted"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_active_mpp_uids"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_task_mappings"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_existing_mappings"] });
    queryClient.invalidateQueries({ queryKey: ["cpm_activity_by_mpp"] });
  };

  const migrateOrphan = async (orphan: OrphanRow, targetId: string) => {
    const { data: existing } = await supabase
      .from("cpm_task_mappings")
      .select("task_id")
      .eq("activity_id", targetId);
    const existingIds = (existing || []).map((m) => m.task_id);
    const merged = [...new Set([...existingIds, ...orphan.mappedTaskIds])];

    await supabase.rpc("upsert_activity_mappings", {
      _activity_id: targetId,
      _task_ids: merged,
    });
    await supabase.from("cpm_task_mappings").delete().eq("activity_id", orphan.id);
    await supabase.from("cpm_activities").delete().eq("id", orphan.id);
    await supabase.from("activity_log").insert({
      action: "cpm_activity_deleted",
      entity_type: "cpm_activity",
      entity_id: orphan.id,
      user_name: memberName || "System",
      details: {
        name: orphan.name, wbs_full: orphan.wbs_full,
        mpp_task_id: orphan.mpp_task_id, semantic_key: orphan.semantic_key,
        migrated_to: targetId, migrated_task_ids: orphan.mappedTaskIds,
        resolution: "manual_migrated_via_orphan_center",
      },
    });
  };

  const deleteOrphan = async (orphan: OrphanRow) => {
    await supabase.from("cpm_task_mappings").delete().eq("activity_id", orphan.id);
    await supabase.from("cpm_activities").delete().eq("id", orphan.id);
    await supabase.from("activity_log").insert({
      action: "cpm_activity_deleted",
      entity_type: "cpm_activity",
      entity_id: orphan.id,
      user_name: memberName || "System",
      details: {
        name: orphan.name, wbs_full: orphan.wbs_full,
        mpp_task_id: orphan.mpp_task_id,
        unmapped_task_ids: orphan.mappedTaskIds,
        resolution: "manual_deleted_via_orphan_center",
      },
    });
  };

  const handleBulkAutoApply = async () => {
    setProcessing(true);
    let ok = 0, fail = 0;
    for (const o of orphans) {
      const rec = recommendations.get(o.id);
      if (!rec || rec.score !== 100 || !rec.candidate) continue;
      try {
        await migrateOrphan(o, rec.candidate.id);
        ok++;
      } catch (e) {
        console.error(e); fail++;
      }
    }
    setProcessing(false);
    if (ok) toast.success(`${ok}건 자동 매핑 이전 완료`);
    if (fail) toast.error(`${fail}건 실패`);
    refreshAll();
  };

  const handleBulkDelete = async () => {
    setProcessing(true);
    let ok = 0, fail = 0;
    for (const id of selected) {
      const o = orphans.find((x) => x.id === id);
      if (!o) continue;
      try { await deleteOrphan(o); ok++; } catch (e) { console.error(e); fail++; }
    }
    setSelected(new Set());
    setProcessing(false);
    if (ok) toast.success(`${ok}건 삭제 완료`);
    if (fail) toast.error(`${fail}건 실패`);
    refreshAll();
  };

  const handleSingleMigrate = async (o: OrphanRow) => {
    const targetId = pickedTarget[o.id];
    if (!targetId) return;
    setProcessing(true);
    try {
      await migrateOrphan(o, targetId);
      toast.success(`"${o.name}" 매핑 이전 완료`);
      refreshAll();
    } catch (e: any) {
      toast.error("이전 실패: " + e.message);
    } finally {
      setProcessing(false);
    }
  };

  const handleFindInGraph = async (log: DeletedLogRow) => {
    const sk = log.details?.semantic_key;
    let mppTaskId: string | null = null;
    if (sk) {
      const { data } = await supabase
        .from("cpm_activities")
        .select("mpp_task_id")
        .eq("semantic_key", sk)
        .limit(1)
        .maybeSingle();
      mppTaskId = (data as any)?.mpp_task_id ?? null;
    }
    if (!mppTaskId) {
      // name fallback
      const { data } = await supabase
        .from("cpm_activities")
        .select("mpp_task_id")
        .eq("name", log.details?.name || "")
        .limit(1)
        .maybeSingle();
      mppTaskId = (data as any)?.mpp_task_id ?? null;
    }
    if (mppTaskId) {
      navigate(`/cpm?highlight=${encodeURIComponent(mppTaskId)}`);
    } else {
      toast.info("현재 그래프에서 동일 Activity를 찾지 못했습니다");
    }
  };

  if (!isAdminOrPm) return null;

  return (
    <div className="container mx-auto py-6 space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Orphan 매핑 복구 센터</h1>
        <p className="text-sm text-muted-foreground mt-1">
          새 XML에 없는 Activity의 매핑을 검토·이전·삭제하고 자동 삭제 이력을 감사합니다.
        </p>
      </div>

      {/* 요약 카드 */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">미해결 Orphan</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.unresolved}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">누적 매핑 수</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.totalMappings}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">100점 자동 적용 가능</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold text-primary">{summary.autoApplicable}</div></CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">최근 자동 삭제</CardTitle></CardHeader>
          <CardContent><div className="text-2xl font-bold">{summary.autoDeleted}</div></CardContent>
        </Card>
      </div>

      <Tabs defaultValue="unresolved" className="space-y-4">
        <TabsList>
          <TabsTrigger value="unresolved">미해결 Orphan ({orphans.length})</TabsTrigger>
          <TabsTrigger value="auto-deleted">자동 삭제 이력 ({autoDeleted.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="unresolved" className="space-y-3">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              onClick={() => setConfirmBulk("auto")}
              disabled={processing || summary.autoApplicable === 0}
            >
              <Sparkles className="h-3.5 w-3.5 mr-1" />
              추천 자동 적용 (100점, {summary.autoApplicable}건)
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={() => setConfirmBulk("delete")}
              disabled={processing || selected.size === 0}
            >
              <Trash2 className="h-3.5 w-3.5 mr-1" />
              선택 삭제 ({selected.size})
            </Button>
          </div>

          <Card>
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-10">
                      <Checkbox
                        checked={orphans.length > 0 && selected.size === orphans.length}
                        onCheckedChange={(v) => {
                          if (v) setSelected(new Set(orphans.map((o) => o.id)));
                          else setSelected(new Set());
                        }}
                      />
                    </TableHead>
                    <TableHead>Orphan 이름</TableHead>
                    <TableHead>BLDG</TableHead>
                    <TableHead>WBS</TableHead>
                    <TableHead className="text-center">매핑</TableHead>
                    <TableHead>추천 대상</TableHead>
                    <TableHead className="text-center">점수</TableHead>
                    <TableHead className="text-right">액션</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {orphans.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
                        미해결 Orphan이 없습니다
                      </TableCell>
                    </TableRow>
                  )}
                  {orphans.map((o) => {
                    const rec = recommendations.get(o.id);
                    const cf = o.custom_fields || {};
                    const bldg = cf.BLDG || cf.Text2 || cf["텍스트2"] || "-";
                    const targetId = pickedTarget[o.id] || rec?.candidate?.id || "";
                    return (
                      <TableRow key={o.id}>
                        <TableCell>
                          <Checkbox
                            checked={selected.has(o.id)}
                            onCheckedChange={(v) => {
                              const next = new Set(selected);
                              if (v) next.add(o.id); else next.delete(o.id);
                              setSelected(next);
                            }}
                          />
                        </TableCell>
                        <TableCell className="font-medium truncate max-w-[280px]">{o.name}</TableCell>
                        <TableCell><Badge variant="secondary">{bldg}</Badge></TableCell>
                        <TableCell className="text-xs text-muted-foreground truncate max-w-[160px]">{o.wbs_full || "-"}</TableCell>
                        <TableCell className="text-center">{o.mappedTaskCount}</TableCell>
                        <TableCell>
                          <Select
                            value={targetId}
                            onValueChange={(v) => setPickedTarget((p) => ({ ...p, [o.id]: v }))}
                          >
                            <SelectTrigger className="h-8 text-xs w-[280px]">
                              <SelectValue placeholder="대상 선택" />
                            </SelectTrigger>
                            <SelectContent>
                              {candidates.map((c) => {
                                const ccf = c.custom_fields || {};
                                const cbldg = ccf.BLDG || ccf.Text2 || ccf["텍스트2"] || "";
                                const parts = (c.wbs_full || "").split(".");
                                const wbsL2 = parts.length >= 2 ? `${parts[0]}.${parts[1]}` : "";
                                const label = [cbldg, wbsL2, c.name].filter(Boolean).join(" · ");
                                return (
                                  <SelectItem key={c.id} value={c.id} className="text-xs">{label}</SelectItem>
                                );
                              })}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-center">
                          {rec && rec.score > 0 ? (
                            <Badge variant={rec.score === 100 ? "default" : "outline"}>{rec.score}</Badge>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSingleMigrate(o)}
                            disabled={!targetId || processing}
                          >
                            <ArrowRightLeft className="h-3.5 w-3.5 mr-1" />
                            이전
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
              {confirmBulk === "auto" ? "추천 자동 적용" : "선택 항목 삭제"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmBulk === "auto"
                ? `${summary.autoApplicable}건의 100점 추천을 일괄 적용합니다. 매핑이 이전되고 Orphan 행은 삭제됩니다.`
                : `${selected.size}건의 Orphan을 삭제합니다. 연결된 매핑이 함께 해제됩니다.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>취소</AlertDialogCancel>
            <AlertDialogAction
              onClick={async () => {
                const mode = confirmBulk;
                setConfirmBulk(null);
                if (mode === "auto") await handleBulkAutoApply();
                else if (mode === "delete") await handleBulkDelete();
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
