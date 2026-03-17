import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockMembers, getTeamName, getPartName } from "@/lib/mockData";

const Directory = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Directory</h1>
        <p className="text-sm text-muted-foreground">All project members</p>
      </div>
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Members ({mockMembers.length})</CardTitle>
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
                  <TableCell>
                    <Badge variant="outline">{getTeamName(m.team_id)}</Badge>
                  </TableCell>
                  <TableCell>{getPartName(m.part_id)}</TableCell>
                  <TableCell className="text-muted-foreground">{m.duty_title}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
};

export default Directory;
