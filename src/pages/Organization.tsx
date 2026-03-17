import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, User, ChevronDown, ChevronRight } from "lucide-react";
import { useState } from "react";

const Organization = () => {
  const { data: pmName } = useQuery({
    queryKey: ["project_settings", "pm_name"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_settings")
        .select("value")
        .eq("key", "pm_name")
        .maybeSingle();
      if (error) throw error;
      return data?.value ?? "TBD";
    },
    staleTime: 30_000,
  });

  const { data: teams = [], isLoading: lt } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: parts = [] } = useQuery({
    queryKey: ["parts"],
    queryFn: async () => {
      const { data, error } = await supabase.from("parts").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: members = [] } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const isLoading = lt;

  const totalTO = teams.reduce((s, t) => s + t.target_headcount, 0);
  const totalMembers = members.length;

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Organization</h1>
        <p className="text-sm text-muted-foreground">Project organization chart — Teams, Parts & Members</p>
      </div>

      {/* Summary bar */}
      <div className="flex gap-4 flex-wrap">
        <Card className="flex-1 min-w-[160px]">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-primary/10 flex items-center justify-center">
              <Users className="h-4 w-4 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono">{totalMembers} <span className="text-sm font-normal text-muted-foreground">/ {totalTO}</span></p>
              <p className="text-xs text-muted-foreground">현원 / TO</p>
            </div>
          </CardContent>
        </Card>
        <Card className="flex-1 min-w-[160px]">
          <CardContent className="pt-4 pb-3 flex items-center gap-3">
            <div className="h-9 w-9 rounded-lg bg-warning/10 flex items-center justify-center">
              <User className="h-4 w-4 text-warning" />
            </div>
            <div>
              <p className="text-2xl font-bold font-mono text-warning">{totalTO - totalMembers > 0 ? totalTO - totalMembers : 0}</p>
              <p className="text-xs text-muted-foreground">부족 인원</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Org Chart */}
      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-32 w-full" />)}
        </div>
      ) : (
        <div className="space-y-4">
          {teams.map((team) => {
            const teamParts = parts.filter(p => p.team_id === team.id);
            const teamMembers = members.filter(m => m.team_id === team.id);
            const currentCount = teamMembers.length;
            const vacancy = team.target_headcount - currentCount;

            return (
              <TeamCard
                key={team.id}
                team={team}
                parts={teamParts}
                members={teamMembers}
                currentCount={currentCount}
                vacancy={vacancy}
              />
            );
          })}
        </div>
      )}
    </div>
  );
};

interface TeamCardProps {
  team: { id: string; name: string; code: string; target_headcount: number };
  parts: { id: string; name: string; code: string }[];
  members: { id: string; name: string; part_id: string | null; duty_title: string | null }[];
  currentCount: number;
  vacancy: number;
}

function TeamCard({ team, parts, members, currentCount, vacancy }: TeamCardProps) {
  const [expanded, setExpanded] = useState(true);

  return (
    <Card>
      <CardHeader
        className="pb-3 cursor-pointer select-none"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {expanded ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
            <CardTitle className="text-base">{team.name}</CardTitle>
            <Badge variant="outline" className="font-mono text-xs">{team.code}</Badge>
          </div>
          <div className="flex items-center gap-3">
            <span className="text-sm font-mono">
              <span className={currentCount >= team.target_headcount ? "text-success" : "text-foreground"}>{currentCount}</span>
              <span className="text-muted-foreground"> / {team.target_headcount}</span>
            </span>
            {vacancy > 0 && (
              <Badge variant="outline" className="border-warning text-warning text-xs">
                -{vacancy}
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      {expanded && (
        <CardContent className="pt-0">
          {parts.length === 0 ? (
            <div className="pl-7">
              {/* Members without parts */}
              <MemberList members={members} />
            </div>
          ) : (
            <div className="space-y-3 pl-3">
              {parts.map((part) => {
                const partMembers = members.filter(m => m.part_id === part.id);
                return (
                  <div key={part.id} className="border-l-2 border-border pl-4 py-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium">{part.name}</span>
                      <Badge variant="secondary" className="text-[10px] font-mono">{part.code}</Badge>
                      <span className="text-xs text-muted-foreground">({partMembers.length}명)</span>
                    </div>
                    <MemberList members={partMembers} />
                  </div>
                );
              })}
              {/* Members without a part assignment */}
              {(() => {
                const partIds = new Set(parts.map(p => p.id));
                const unassigned = members.filter(m => !m.part_id || !partIds.has(m.part_id));
                if (unassigned.length === 0) return null;
                return (
                  <div className="border-l-2 border-dashed border-border pl-4 py-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-sm font-medium text-muted-foreground">미배정</span>
                      <span className="text-xs text-muted-foreground">({unassigned.length}명)</span>
                    </div>
                    <MemberList members={unassigned} />
                  </div>
                );
              })()}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}

function MemberList({ members }: { members: { id: string; name: string; duty_title: string | null }[] }) {
  if (members.length === 0) {
    return <p className="text-xs text-muted-foreground italic">No members assigned</p>;
  }

  return (
    <div className="flex flex-wrap gap-2">
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-2 px-3 py-1.5 rounded-md bg-muted/50 border border-border"
        >
          <div className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center">
            <User className="h-3 w-3 text-primary" />
          </div>
          <div>
            <p className="text-xs font-medium leading-tight">{m.name}</p>
            {m.duty_title && (
              <p className="text-[10px] text-muted-foreground leading-tight">{m.duty_title}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Organization;
