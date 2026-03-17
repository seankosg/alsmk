import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { mockPersonnelTargets, getTeamName, getPartName } from "@/lib/mockData";

export function PersonnelTable() {
  const totalTarget = mockPersonnelTargets.reduce((s, p) => s + p.target_headcount, 0);
  const totalCurrent = mockPersonnelTargets.reduce((s, p) => s + p.current_headcount, 0);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Personnel Overview</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Team</TableHead>
              <TableHead>Part</TableHead>
              <TableHead className="text-right">Target</TableHead>
              <TableHead className="text-right">Current</TableHead>
              <TableHead className="text-right">Vacancy</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockPersonnelTargets.map((pt) => {
              const vacancy = pt.target_headcount - pt.current_headcount;
              return (
                <TableRow key={pt.id}>
                  <TableCell className="text-xs">{getTeamName(pt.team_id)}</TableCell>
                  <TableCell className="text-xs">{getPartName(pt.part_id)}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{pt.target_headcount}</TableCell>
                  <TableCell className="text-right font-mono text-xs">{pt.current_headcount}</TableCell>
                  <TableCell className={`text-right font-mono text-xs font-medium ${vacancy > 0 ? 'text-warning' : 'text-success'}`}>
                    {vacancy > 0 ? vacancy : '—'}
                  </TableCell>
                </TableRow>
              );
            })}
            <TableRow className="font-medium">
              <TableCell colSpan={2} className="text-xs">Total</TableCell>
              <TableCell className="text-right font-mono text-xs">{totalTarget}</TableCell>
              <TableCell className="text-right font-mono text-xs">{totalCurrent}</TableCell>
              <TableCell className={`text-right font-mono text-xs ${totalTarget - totalCurrent > 0 ? 'text-warning' : 'text-success'}`}>
                {totalTarget - totalCurrent > 0 ? totalTarget - totalCurrent : '—'}
              </TableCell>
            </TableRow>
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
