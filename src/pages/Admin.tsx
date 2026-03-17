import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AdminTeams } from "@/components/admin/AdminTeams";
import { AdminParts } from "@/components/admin/AdminParts";
import { AdminMembers } from "@/components/admin/AdminMembers";
import { AdminMilestones } from "@/components/admin/AdminMilestones";

const Admin = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Manage teams, parts, members, and milestones</p>
      </div>
      <Tabs defaultValue="teams" className="w-full">
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
        </TabsList>
        <TabsContent value="teams" className="mt-4">
          <AdminTeams />
        </TabsContent>
        <TabsContent value="parts" className="mt-4">
          <AdminParts />
        </TabsContent>
        <TabsContent value="members" className="mt-4">
          <AdminMembers />
        </TabsContent>
        <TabsContent value="milestones" className="mt-4">
          <AdminMilestones />
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default Admin;
