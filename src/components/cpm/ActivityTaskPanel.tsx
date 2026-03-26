import { useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronRight, ChevronDown, AlertTriangle, Link2, Calendar, Clock, ArrowRight, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { HoverCard, HoverCardTrigger, HoverCardContent } from "@/components/ui/hover-card";
import { useNavigate } from "react-router-dom";
import { calcPlannedProgress } from "@/lib/mockData";
import { MapTasksDialog } from "./MapTasksDialog";
import { useAuthContext } from "@/components/layout/AppLayout";

export interface CpmActivity {
  id: string;
  mppTaskId: string | null;
  mppUid: string | null;
  name: string;
  duration: number;
  progress: number | null;
  wbsFull: string;
  isCritical: boolean;
  isMilestone: boolean;
  startDate: string | null;
  finishDate: string | null;
  es: number; ef: number; ls: number; lf: number; tf: number;
  // Extended fields from dblclick
  showDetail?: boolean;
  isPassThrough?: boolean;
  predecessors?: Array<{ id: string; mppTaskId: string | null; name: string; wbs: string }>;
  customFields?: Record<string, string>;
}

interface Props {
  activity: CpmActivity;
  onClose: () => void;
  onStatusChanged?: () => void;
}

interface TaskWithMember {
  id: string;
  title: string;
  task_code: string | null;
  current_progress: number;
  start_date: string;
  end_date: string;
  team_id: string;
  assignee_id: string | null;
  assignee_name: string;
  team_name: string;
  issue_flag: string;
  issue_description: string | null;
  action_plan: string | null;
  parent_id: string | null;
  parent_title: string;
}

export function ActivityTaskPanel({ activity, onClose, onStatusChanged }: Props) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { isAdmin, isAdminOrPm, memberId } = useAuthContext();
  const [expandedTeams, setExpandedTeams] = useState<Set<string>>(new Set());
  const [expandedAssignees, setExpandedAssignees] = useState<Set<string>>(new Set());

  // Get DB activity ID
  const { data: dbActivity } = useQuery({
    queryKey: ["cpm_activity_by_mpp", activity.id],
    queryFn: async () => {
      let query = supabase.from("cpm_activities").select("id");
      if (activity.mppTaskId) {
        query = query.eq("mpp_task_id", activity.mppTaskId);
      }
      if (activity.wbsFull) {
        query = query.eq("wbs_full", activity.wbsFull);
      }
      if (!activity.mppTaskId && !activity.wbsFull) {
        query = query.eq("name", activity.name);
      }
      const { data } = await query.maybeSingle();
      return data;
    },
  });

  // Get mapped tasks
  const { data: mappedTasks = [], refetch: refetchMappings } = useQuery({
    queryKey: ["cpm_task_mappings", dbActivity?.id],
    queryFn: async () => {
      if (!dbActivity?.id) return [];
      const { data: mappings } = await supabase
        .from("cpm_task_mappings")
        .select("task_id")
        .eq("activity_id", dbActivity.id);
      if (!mappings?.length) return [];

      const taskIds = mappings.map(m => m.task_id);
      const { data: tasks } = await supabase
        .from("tasks")
        .select("id, title, task_code, current_progress, start_date, end_date, team_id, assignee_id, issue_flag, issue_description, action_plan, parent_id")
        .in("id", taskIds)
        .is("deleted_at", null);

      if (!tasks?.length) return [];

      // Get parent summary task titles
      const parentIds = [...new Set(tasks.map(t => t.parent_id).filter(Boolean))] as string[];
      const { data: parents } = parentIds.length
        ? await supabase.from("tasks").select("id, title").in("id", parentIds)
        : { data: [] };
      const parentMap = Object.fromEntries((parents || []).map(p => [p.id, p.title]));

      // Get team names
      const teamIds = [...new Set(tasks.map(t => t.team_id))];
      const { data: teams } = await supabase.from("teams").select("id, name").in("id", teamIds);
      const teamMap = Object.fromEntries((teams || []).map(t => [t.id, t.name]));

      // Get assignee names
      const assigneeIds = [...new Set(tasks.map(t => t.assignee_id).filter(Boolean))] as string[];
      const { data: members } = assigneeIds.length
        ? await supabase.from("members").select("id, name").in("id", assigneeIds)
        : { data: [] };
      const memberMap = Object.fromEntries((members || []).map(m => [m.id, m.name]));

      return tasks.map(t => ({
        ...t,
        assignee_name: t.assignee_id ? (memberMap[t.assignee_id] || "미배정") : "미배정",
        team_name: teamMap[t.team_id] || "Unknown",
        parent_title: t.parent_id ? (parentMap[t.parent_id] || t.title) : t.title,
      })) as TaskWithMember[];
    },
    enabled: !!dbActivity?.id,
  });

  // Group by Subject (title) and sort by task_code
  const subjectGroups = useMemo(() => {
    const groups = new Map<string, { subjectName: string; tasks: TaskWithMember[] }>();
    mappedTasks.forEach(t => {
      const key = t.parent_title || "미분류";
      if (!groups.has(key)) {
        groups.set(key, { subjectName: key, tasks: [] });
      }
      groups.get(key)!.tasks.push(t);
    });
    // Sort tasks within each group by task_code
    groups.forEach(g => {
      g.tasks.sort((a, b) => (a.task_code || '').localeCompare(b.task_code || ''));
    });
    return groups;
  }, [mappedTasks]);

  // Weighted progress calculation
  const calcWeightedProgress = (tasks: TaskWithMember[]) => {
    if (!tasks.length) return { actual: 0, planned: 0, gap: 0 };
    let totalDur = 0, weightedActual = 0, weightedPlanned = 0;
    tasks.forEach(t => {
      const dur = Math.max(1, Math.round((new Date(t.end_date).getTime() - new Date(t.start_date).getTime()) / 86400000) + 1);
      totalDur += dur;
      weightedActual += t.current_progress * dur;
      weightedPlanned += calcPlannedProgress(t.start_date, t.end_date) * dur;
    });
    const actual = totalDur ? Math.round(weightedActual / totalDur) : 0;
    const planned = totalDur ? Math.round(weightedPlanned / totalDur) : 0;
    return { actual, planned, gap: actual - planned };
  };

  const overallStats = calcWeightedProgress(mappedTasks);
  const delayedCount = mappedTasks.filter(t => {
    const planned = calcPlannedProgress(t.start_date, t.end_date);
    return t.current_progress < planned - 5;
  }).length;

  const toggleTeam = (teamId: string) => {
    setExpandedTeams(prev => {
      const next = new Set(prev);
      next.has(teamId) ? next.delete(teamId) : next.add(teamId);
      return next;
    });
  };

  const toggleAssignee = (key: string) => {
    setExpandedAssignees(prev => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const GapBadge = ({ gap }: { gap: number }) => {
    if (gap >= 0) return <span className="text-xs font-mono font-semibold text-success">✓</span>;
    if (gap > -10) return <span className="text-xs font-mono font-semibold text-warning">⚠ {gap}%</span>;
    return <span className="text-xs font-mono font-semibold text-destructive">🔴 {gap}%</span>;
  };

  return (
    <div className="flex flex-col h-full bg-card border-l border-border">
      {/* Activity Header — Detail Mode */}
      <div className="p-4 border-b border-border space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 flex-wrap">
            {activity.mppTaskId && (
              <Badge variant="outline" className="font-mono text-xs">
                #{activity.mppTaskId}
              </Badge>
            )}
            {activity.wbsFull && (
              <Badge variant="outline" className="font-mono text-xs text-muted-foreground">
                {activity.wbsFull}
              </Badge>
            )}
            {(activity.customFields?.BLDG || activity.customFields?.Text2 || activity.customFields?.['텍스트2']) && (
              <Badge variant="outline" className="font-mono text-xs text-amber-500 border-amber-500/30">
                {activity.customFields.BLDG || activity.customFields.Text2 || activity.customFields['텍스트2']}
              </Badge>
            )}
            {activity.isCritical && (
              <Badge variant="destructive" className="text-xs">★ CP</Badge>
            )}
            {activity.isPassThrough && (
              <Badge className="text-xs bg-warning/20 text-warning border-warning/30">통과</Badge>
            )}
            {activity.isMilestone && (
              <Badge className="text-xs bg-accent/20 text-accent border-accent/30">◆ MS</Badge>
            )}
          </div>
          <Button variant="ghost" size="sm" onClick={onClose}>✕</Button>
        </div>
        <h3 className="text-sm font-semibold text-foreground">{activity.name}</h3>

        {/* Detailed info grid — always shown on dblclick, collapsible otherwise */}
        {activity.showDetail && (
          <div className="space-y-2">
            {/* Schedule info */}
            <div className="grid grid-cols-2 gap-1.5 text-xs">
              <div className="bg-muted/50 rounded px-2 py-1.5 flex items-center gap-1.5">
                <Clock className="h-3 w-3 text-muted-foreground" />
                <span className="text-muted-foreground">기간</span>
                <span className="ml-auto font-mono font-semibold text-foreground">{activity.duration}일</span>
              </div>
              <div className="bg-muted/50 rounded px-2 py-1.5 flex items-center gap-1.5">
                <span className={`font-mono font-semibold ${activity.tf === 0 ? 'text-destructive' : 'text-success'}`}>
                  TF: {activity.tf}일
                </span>
              </div>
            </div>

            {/* Dates */}
            {activity.startDate && (
              <div className="bg-muted/50 rounded px-2 py-1.5 flex items-center gap-1.5 text-xs">
                <Calendar className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-foreground">{activity.startDate}</span>
                <ArrowRight className="h-3 w-3 text-muted-foreground" />
                <span className="font-mono text-foreground">{activity.finishDate}</span>
              </div>
            )}

            {/* ES/EF/LS/LF */}
            <div className="grid grid-cols-4 gap-1 text-xs">
              {[
                { label: 'ES', value: activity.es },
                { label: 'EF', value: activity.ef },
                { label: 'LS', value: activity.ls },
                { label: 'LF', value: activity.lf },
              ].map(({ label, value }) => (
                <div key={label} className="bg-muted/50 rounded px-1.5 py-1 text-center">
                  <div className="text-[10px] text-muted-foreground">{label}</div>
                  <div className="font-mono font-semibold text-foreground">{value ?? '-'}</div>
                </div>
              ))}
            </div>

            {/* Progress */}
            {activity.progress !== null && activity.progress !== undefined && (
              <div className="bg-muted/50 rounded px-2 py-1.5 flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">MPP 진행률</span>
                <Progress value={activity.progress} className="flex-1 h-1.5" />
                <span className="font-mono font-semibold text-foreground">{activity.progress}%</span>
              </div>
            )}

            {/* Predecessors */}
            {activity.predecessors && activity.predecessors.length > 0 && (
              <div className="bg-muted/50 rounded px-2 py-1.5 text-xs space-y-1">
                <div className="text-[10px] text-muted-foreground font-semibold">선행 Activity ({activity.predecessors.length})</div>
                {activity.predecessors.map((p, i) => (
                  <div key={i} className="flex items-center gap-1.5 text-foreground">
                    {p.mppTaskId && <span className="font-mono text-primary">#{p.mppTaskId}</span>}
                    <span className="truncate">{p.name}</span>
                    {p.wbs && <span className="text-muted-foreground font-mono ml-auto">{p.wbs}</span>}
                  </div>
                ))}
              </div>
            )}
            {activity.predecessors && activity.predecessors.length === 0 && (
              <div className="bg-muted/50 rounded px-2 py-1.5 text-xs text-muted-foreground">
                선행 Activity 없음 (시작 노드)
              </div>
            )}

            {/* Custom Fields */}
            {activity.customFields && Object.keys(activity.customFields).length > 0 && (
              <div className="bg-muted/50 rounded px-2 py-1.5 text-xs space-y-1">
                <div className="text-[10px] text-muted-foreground font-semibold">Custom Fields</div>
                {Object.entries(activity.customFields).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-1.5 text-foreground">
                    <span className="text-muted-foreground font-mono">{key}</span>
                    <span className="ml-auto font-semibold">{val}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Key metrics */}
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-muted rounded p-2">
            <div className="text-xs text-muted-foreground">GAP</div>
            <div className={`text-sm font-mono font-bold ${overallStats.gap >= 0 ? 'text-success' : overallStats.gap > -10 ? 'text-warning' : 'text-destructive'}`}>
              {mappedTasks.length ? `${overallStats.gap > 0 ? '+' : ''}${overallStats.gap}%` : '-'}
            </div>
          </div>
          <div className="bg-muted rounded p-2">
            <div className="text-xs text-muted-foreground">Tasks</div>
            <div className="text-sm font-mono font-bold text-foreground">{mappedTasks.length}</div>
          </div>
          <div className="bg-muted rounded p-2">
            <div className="text-xs text-muted-foreground">지연</div>
            <div className={`text-sm font-mono font-bold ${delayedCount > 0 ? 'text-destructive' : 'text-success'}`}>
              {delayedCount}
            </div>
          </div>
        </div>

        {/* Map tasks button — all authenticated users */}
        {dbActivity?.id && (
          <MapTasksDialog activityId={dbActivity.id} activityName={activity.name} onMapped={() => { refetchMappings(); onStatusChanged?.(); }} />
        )}
      </div>

      {/* Team → Assignee → Task hierarchy */}
      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {mappedTasks.length === 0 && (
            <div className="text-center text-muted-foreground text-sm py-8">
              <Link2 className="mx-auto h-8 w-8 mb-2 opacity-40" />
              매핑된 Task가 없습니다<br />
              <span className="text-xs">위 버튼으로 Task를 매핑하세요</span>
            </div>
          )}

          {[...subjectGroups.entries()].map(([subject, { subjectName, tasks }]) => {
            const groupStats = calcWeightedProgress(tasks);
            const groupDelayed = tasks.filter(t => t.current_progress < calcPlannedProgress(t.start_date, t.end_date) - 5).length;
            const isExpanded = expandedTeams.has(subject);

            return (
              <div key={subject}>
                <button
                  onClick={() => toggleTeam(subject)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded hover:bg-muted/50 transition-colors"
                >
                  {isExpanded ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" /> : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />}
                  <span className="text-sm font-medium text-foreground flex-1 text-left truncate">{subjectName}</span>
                  <span className="text-xs font-mono text-muted-foreground">
                    {tasks.length - groupDelayed}/{tasks.length}
                  </span>
                  <Progress value={groupStats.actual} className="w-16 h-1.5" />
                  <span className="text-xs font-mono w-8 text-right">{groupStats.actual}%</span>
                  <GapBadge gap={groupStats.gap} />
                </button>

                {isExpanded && tasks.map(task => {
                  const planned = calcPlannedProgress(task.start_date, task.end_date);
                  const tGap = task.current_progress - planned;
                  const canUnmap = isAdmin || (memberId && task.assignee_id === memberId);

                  return (
                    <HoverCard key={task.id} openDelay={300} closeDelay={100}>
                      <HoverCardTrigger asChild>
                        <div
                          className="ml-4 flex items-center gap-1.5 px-3 py-1.5 rounded hover:bg-muted/30 transition-colors cursor-pointer"
                          onClick={() => navigate(`/workspace?task=${task.id}`)}
                        >
                          {canUnmap && (
                            <button
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (!dbActivity?.id) return;
                                await supabase
                                  .from("cpm_task_mappings")
                                  .delete()
                                  .eq("activity_id", dbActivity.id)
                                  .eq("task_id", task.id);
                                refetchMappings();
                              }}
                              className="text-destructive/60 hover:text-destructive transition-colors shrink-0"
                              title="매핑 해제"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                          <span className="text-[10px] font-mono text-primary truncate max-w-[80px] shrink-0">
                            {task.task_code || '-'}
                          </span>
                          <span className="text-xs text-foreground flex-1 truncate">{task.action_plan || '-'}</span>
                          <span className="text-[10px] font-mono text-muted-foreground shrink-0">
                            {task.current_progress}/{planned}%
                          </span>
                          <GapBadge gap={tGap} />
                        </div>
                      </HoverCardTrigger>
                      <HoverCardContent side="left" align="start" className="w-72 p-3 space-y-2">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {task.task_code && (
                              <Badge variant="outline" className="font-mono text-[10px]">{task.task_code}</Badge>
                            )}
                            {task.issue_flag !== 'normal' && (
                              <Badge variant={task.issue_flag === 'critical' ? 'destructive' : 'secondary'} className="text-[10px]">
                                <AlertTriangle className="h-2.5 w-2.5 mr-0.5" />
                                {task.issue_flag}
                              </Badge>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground">Subject: {task.parent_title}</p>
                          <p className="text-sm font-medium text-foreground">{task.title}</p>
                          {task.action_plan && (
                            <p className="text-xs text-muted-foreground">{task.action_plan}</p>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-1 text-xs">
                          <div className="bg-muted/50 rounded px-2 py-1">
                            <span className="text-muted-foreground">팀</span>
                            <span className="ml-1 text-foreground">{task.team_name}</span>
                          </div>
                          <div className="bg-muted/50 rounded px-2 py-1">
                            <span className="text-muted-foreground">담당</span>
                            <span className="ml-1 text-foreground">{task.assignee_name}</span>
                          </div>
                        </div>
                        <div className="bg-muted/50 rounded px-2 py-1 flex items-center gap-1.5 text-xs">
                          <Calendar className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-foreground">{task.start_date}</span>
                          <ArrowRight className="h-3 w-3 text-muted-foreground" />
                          <span className="font-mono text-foreground">{task.end_date}</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">실적</span>
                          <Progress value={task.current_progress} className="flex-1 h-1.5" />
                          <span className="font-mono font-semibold">{task.current_progress}%</span>
                        </div>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-muted-foreground">계획</span>
                          <Progress value={planned} className="flex-1 h-1.5" />
                          <span className="font-mono font-semibold">{planned}%</span>
                        </div>
                        <div className="flex items-center gap-1 text-xs">
                          <span className="text-muted-foreground">GAP</span>
                          <span className={`font-mono font-semibold ${tGap >= 0 ? 'text-success' : tGap > -10 ? 'text-warning' : 'text-destructive'}`}>
                            {tGap > 0 ? '+' : ''}{tGap}%
                          </span>
                        </div>
                        {task.issue_description && (
                          <div className="bg-destructive/10 rounded px-2 py-1 text-xs text-destructive">
                            {task.issue_description}
                          </div>
                        )}
                        <p className="text-[10px] text-muted-foreground">클릭하여 Workspace로 이동</p>
                      </HoverCardContent>
                    </HoverCard>
                  );
                })}
              </div>
            );
          })}
        </div>
      </ScrollArea>
    </div>
  );
}
