import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { mockMilestones } from "@/lib/mockData";

const statusColors: Record<string, string> = {
  completed: "bg-success/20 text-success border-success/30",
  in_progress: "bg-primary/20 text-primary border-primary/30",
  upcoming: "bg-muted text-muted-foreground border-border",
  delayed: "bg-destructive/20 text-destructive border-destructive/30",
};

export function AdminMilestones() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Milestones</CardTitle>
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-8">#</TableHead>
              <TableHead>Milestone</TableHead>
              <TableHead>Target Date</TableHead>
              <TableHead>Status</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {mockMilestones.map((ms) => (
              <TableRow key={ms.id}>
                <TableCell className="font-mono text-xs text-muted-foreground">{ms.sort_order}</TableCell>
                <TableCell className="font-medium">{ms.name}</TableCell>
                <TableCell className="font-mono text-xs">{ms.target_date}</TableCell>
                <TableCell>
                  <Badge variant="outline" className={statusColors[ms.status]}>
                    {ms.status.replace('_', ' ')}
                  </Badge>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
