import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { AdminTeams } from "@/components/admin/AdminTeams";
import { AdminParts } from "@/components/admin/AdminParts";
import { AdminMembers } from "@/components/admin/AdminMembers";
import { AdminMilestones } from "@/components/admin/AdminMilestones";
import { AdminSettings } from "@/components/admin/AdminSettings";

const Admin = () => {
  const [activeTab, setActiveTab] = useState("teams");

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Admin Panel</h1>
        <p className="text-sm text-muted-foreground">Manage teams, parts, members, milestones, and settings</p>
      </div>
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList>
          <TabsTrigger value="teams">Teams</TabsTrigger>
          <TabsTrigger value="parts">Parts</TabsTrigger>
          <TabsTrigger value="members">Members</TabsTrigger>
          <TabsTrigger value="milestones">Milestones</TabsTrigger>
          <TabsTrigger value="settings">Settings</TabsTrigger>
        </TabsList>
        <div className="mt-4">
          {activeTab === "teams" && <AdminTeams />}
          {activeTab === "parts" && <AdminParts />}
          {activeTab === "members" && <AdminMembers />}
          {activeTab === "milestones" && <AdminMilestones />}
          {activeTab === "settings" && <AdminSettings />}
        </div>
      </Tabs>
    </div>
  );
};

export default Admin;
