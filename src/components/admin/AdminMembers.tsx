import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockMembers, getTeamName, getPartName } from "@/lib/mockData";

export function AdminMembers() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Members</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Name</TableHead>
              <TableHead>Team</TableHead>
              <TableHead>Part</TableHead>
              <TableHead>Duty Title</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockMembers.map((m) => (
              <TableRow key={m.id}>
                <TableCell className="font-medium">{m.name}</TableCell>
                <TableCell><Badge variant="outline">{getTeamName(m.team_id)}</Badge></TableCell>
                <TableCell className="text-xs">{getPartName(m.part_id)}</TableCell>
                <TableCell className="text-xs text-muted-foreground">{m.duty_title}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
