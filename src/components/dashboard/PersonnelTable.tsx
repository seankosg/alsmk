import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";

export function PersonnelTable() {
  const { data: teams = [], isLoading: lt } = useQuery({
    queryKey: ["teams"],
    queryFn: async () => {
      const { data, error } = await supabase.from("teams").select("*").order("name");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const { data: members = [], isLoading: lm } = useQuery({
    queryKey: ["members"],
    queryFn: async () => {
      const { data, error } = await supabase.from("members").select("id, team_id");
      if (error) throw error;
      return data;
    },
    staleTime: 30_000,
  });

  const isLoading = lt || lm;

  // PM row: always plan=1, current=1
  const pmRow = { id: "pm", name: "Project Manager", code: "PM", target: 1, current: 1 };

  const teamRows = teams.map(team => {
    const current = members.filter(m => m.team_id === team.id).length;
    return { id: team.id, name: team.name, code: team.code, target: team.target_headcount, current };
  });

  const rows = [pmRow, ...teamRows];

  const totalTarget = rows.reduce((s, r) => s + r.target, 0);
  const totalCurrent = rows.reduce((s, r) => s + r.current, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Personnel Overview</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <Skeleton className="h-40 w-full" />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Team</TableHead>
                <TableHead className="text-right">TO (계획)</TableHead>
                <TableHead className="text-right">현원</TableHead>
                <TableHead className="text-right">부족</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((r) => {
                const vacancy = r.target - r.current;
                return (
                  <TableRow key={r.id}>
                    <TableCell className="text-xs">{r.name}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.target}</TableCell>
                    <TableCell className="text-right font-mono text-xs">{r.current}</TableCell>
                    <TableCell className={`text-right font-mono text-xs font-medium ${vacancy > 0 ? 'text-warning' : 'text-success'}`}>
                      {vacancy > 0 ? vacancy : '—'}
                    </TableCell>
                  </TableRow>
                );
              })}
              <TableRow className="font-medium">
                <TableCell className="text-xs">Total</TableCell>
                <TableCell className="text-right font-mono text-xs">{totalTarget}</TableCell>
                <TableCell className="text-right font-mono text-xs">{totalCurrent}</TableCell>
                <TableCell className={`text-right font-mono text-xs ${totalTarget - totalCurrent > 0 ? 'text-warning' : 'text-success'}`}>
                  {totalTarget - totalCurrent > 0 ? totalTarget - totalCurrent : '—'}
                </TableCell>
              </TableRow>
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
