import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Users, User, Crown, RefreshCw } from "lucide-react";
import { useMemo, useState } from "react";

const Organization = () => {
  const queryClient = useQueryClient();
  const [refreshing, setRefreshing] = useState(false);

  const handleRefresh = async () => {
    setRefreshing(true);
    await queryClient.invalidateQueries({ queryKey: ["teams"] });
    await queryClient.invalidateQueries({ queryKey: ["parts"] });
    await queryClient.invalidateQueries({ queryKey: ["members"] });
    await queryClient.invalidateQueries({ queryKey: ["project_settings", "pm_name"] });
    setRefreshing(false);
  };

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

  const { data: teams = [], isLoading } = useQuery({
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
      const { data, error } = await supabase.from("members").select("*").is("deleted_at", null).order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: userRoles = [] } = useQuery({
    queryKey: ["user_roles_all"],
    queryFn: async () => {
      const { data, error } = await supabase.from("user_roles").select("*");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  // Identify guest user_ids
  const guestUserIds = useMemo(() => {
    const ids = new Set<string>();
    userRoles.forEach(r => {
      if (r.role === "guest" || r.role === "super_guest") ids.add(r.user_id);
    });
    return ids;
  }, [userRoles]);

  const guestMembers = members.filter(m => m.user_id && guestUserIds.has(m.user_id));
  const nonGuestMembers = members.filter(m => !m.user_id || !guestUserIds.has(m.user_id));

  // Filter out system admin accounts (no team) from org chart, but keep PM
  const pmMembers = nonGuestMembers.filter(m => m.is_pm);
  const orgMembers = nonGuestMembers.filter(m => m.team_id !== null && !m.is_pm);
  const totalTO = teams.reduce((s, t) => s + t.target_headcount, 0) + 1; // +1 for PM
  const totalMembers = orgMembers.length + pmMembers.length;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Organization</h1>
          <p className="text-sm text-muted-foreground">Project organization chart</p>
        </div>
        <div className="flex gap-3 items-center">
          <Button variant="outline" size="sm" onClick={handleRefresh} disabled={refreshing}>
            <RefreshCw className={`mr-2 h-4 w-4 ${refreshing ? "animate-spin" : ""}`} />
            {refreshing ? "Refreshing..." : "Refresh"}
          </Button>
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-border">
            <Users className="h-4 w-4 text-primary" />
            <span className="text-sm font-mono font-medium">{totalMembers}<span className="text-muted-foreground">/{totalTO}</span></span>
            <span className="text-xs text-muted-foreground">현원/TO</span>
          </div>
          {totalTO - totalMembers > 0 && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card border border-warning/30">
              <span className="text-sm font-mono font-medium text-warning">-{totalTO - totalMembers}</span>
              <span className="text-xs text-muted-foreground">부족</span>
            </div>
          )}
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center"><Skeleton className="h-64 w-96" /></div>
      ) : (
        <div className="overflow-x-auto pb-8">
          <div className="org-tree flex flex-col items-center min-w-fit">
            {/* PM Root Node */}
            <OrgNode
              label="Project Manager"
              name={pmName ?? "TBD"}
              variant="pm"
              count={`${pmMembers.length}/1`}
            />
            {/* PM Members */}
            {pmMembers.length > 0 && (
              <>
                <VerticalLine short />
                <MemberGroup members={pmMembers} />
              </>
            )}

            {/* Connector: PM → Teams */}
            {teams.length > 0 && (
              <>
                <VerticalLine />
                <HorizontalBranch count={teams.length} />

                {/* Teams Row */}
                <div className="flex gap-0 items-start">
                  {teams.map((team, idx) => {
                    const teamParts = parts.filter(p => p.team_id === team.id);
                    const teamMembers = orgMembers.filter(m => m.team_id === team.id);
                    const currentCount = teamMembers.length;

                    return (
                      <div key={team.id} className="flex flex-col items-center px-4 min-w-[180px]">
                        <VerticalLine />
                        <OrgNode
                          label={team.name}
                          sublabel={team.code}
                          count={`${currentCount}/${team.target_headcount}`}
                          variant="team"
                          warning={currentCount < team.target_headcount}
                        />

                        {/* Parts under this team */}
                        {teamParts.length > 0 && (
                          <>
                            <VerticalLine />
                            <HorizontalBranch count={teamParts.length} />
                            <div className="flex gap-0 items-start">
                              {teamParts.map((part) => {
                                const partMembers = teamMembers.filter(m => m.part_id === part.id);
                                return (
                                  <div key={part.id} className="flex flex-col items-center px-2 min-w-[140px]">
                                    <VerticalLine />
                                    <OrgNode
                                      label={part.name}
                                      sublabel={part.code}
                                      count={`${partMembers.length}명`}
                                      variant="part"
                                    />
                                    {/* Members */}
                                    {partMembers.length > 0 && (
                                      <>
                                        <VerticalLine short />
                                        <MemberGroup members={partMembers} />
                                      </>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                            {/* Unassigned members */}
                            {(() => {
                              const partIds = new Set(teamParts.map(p => p.id));
                              const unassigned = teamMembers.filter(m => !m.part_id || !partIds.has(m.part_id));
                              if (unassigned.length === 0) return null;
                              return (
                                <div className="mt-2">
                                  <MemberGroup members={unassigned} label="미배정" />
                                </div>
                              );
                            })()}
                          </>
                        )}

                        {/* Members directly under team (no parts) */}
                        {teamParts.length === 0 && teamMembers.length > 0 && (
                          <>
                            <VerticalLine short />
                            <MemberGroup members={teamMembers} />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* Guest Members Section */}
      {guestMembers.length > 0 && (
        <div className="mt-4 border-t border-border pt-6">
          <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
            <User className="h-5 w-5 text-muted-foreground" />
            Guest Members
            <Badge variant="secondary" className="font-mono text-xs">{guestMembers.length}</Badge>
          </h2>
          <div className="flex flex-wrap gap-3">
            {guestMembers.map((m) => {
              const role = userRoles.find(r => r.user_id === m.user_id && (r.role === "guest" || r.role === "super_guest"));
              return (
                <div
                  key={m.id}
                  className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/40 border border-border/50"
                >
                  <div className="h-6 w-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <User className="h-3 w-3 text-muted-foreground" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-xs font-medium leading-tight truncate">{m.name}</p>
                    {m.duty_title && (
                      <p className="text-[9px] text-muted-foreground leading-tight truncate">{m.duty_title}</p>
                    )}
                  </div>
                  <Badge variant="outline" className="text-[9px] px-1.5 py-0 ml-1">
                    {role?.role === "super_guest" ? "Super Guest" : "Guest"}
                  </Badge>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

/* ─── Tree connector components ─── */

function VerticalLine({ short }: { short?: boolean }) {
  return (
    <div
      className="w-px bg-border"
      style={{ height: short ? 12 : 20 }}
    />
  );
}

function HorizontalBranch({ count }: { count: number }) {
  if (count <= 1) return null;
  return (
    <div
      className="h-px bg-border"
      style={{ width: `calc(${count - 1} * 180px)` }}
    />
  );
}

/* ─── Node components ─── */

interface OrgNodeProps {
  label: string;
  name?: string;
  sublabel?: string;
  count?: string;
  variant: "pm" | "team" | "part";
  warning?: boolean;
}

function OrgNode({ label, name, sublabel, count, variant, warning }: OrgNodeProps) {
  const base = "rounded-lg border text-center transition-colors";

  if (variant === "pm") {
    return (
      <div className={`${base} border-primary/40 bg-primary/10 px-6 py-3 min-w-[200px]`}>
        <div className="flex items-center justify-center gap-2 mb-1">
          <Crown className="h-4 w-4 text-primary" />
          <span className="text-xs font-medium text-primary">{label}</span>
        </div>
        <p className="text-base font-bold">{name}</p>
      </div>
    );
  }

  if (variant === "team") {
    return (
      <div className={`${base} border-border bg-card px-4 py-2.5 min-w-[160px] shadow-sm`}>
        <p className="text-sm font-semibold">{label}</p>
        <div className="flex items-center justify-center gap-2 mt-1">
          {sublabel && <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0">{sublabel}</Badge>}
          {count && (
            <span className={`text-xs font-mono ${warning ? "text-warning" : "text-muted-foreground"}`}>
              {count}
            </span>
          )}
        </div>
      </div>
    );
  }

  // part
  return (
    <div className={`${base} border-border/60 bg-muted/50 px-3 py-2 min-w-[120px]`}>
      <p className="text-xs font-medium">{label}</p>
      <div className="flex items-center justify-center gap-1.5 mt-0.5">
        {sublabel && <span className="text-[10px] font-mono text-muted-foreground">{sublabel}</span>}
        {count && <span className="text-[10px] text-muted-foreground">{count}</span>}
      </div>
    </div>
  );
}

function MemberGroup({ members, label }: {
  members: { id: string; name: string; duty_title: string | null }[];
  label?: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1 py-1">
      {label && <span className="text-[10px] text-muted-foreground mb-0.5">{label}</span>}
      {members.map((m) => (
        <div
          key={m.id}
          className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border/50 w-full"
        >
          <div className="h-5 w-5 rounded-full bg-primary/15 flex items-center justify-center shrink-0">
            <User className="h-2.5 w-2.5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-medium leading-tight truncate">{m.name}</p>
            {m.duty_title && (
              <p className="text-[9px] text-muted-foreground leading-tight truncate">{m.duty_title}</p>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

export default Organization;
