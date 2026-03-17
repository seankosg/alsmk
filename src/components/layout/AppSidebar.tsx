import { LayoutDashboard, Briefcase, Users, Settings, Upload, HardHat, Building2, LogOut, KeyRound } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "./AppLayout";

export function AppSidebar() {
  const { state } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, memberName, signOut } = useAuthContext();

  const navItems = [
    { title: "Dashboard", url: "/", icon: LayoutDashboard },
    { title: "My Workspace", url: "/workspace", icon: Briefcase },
    { title: "Organization", url: "/organization", icon: Building2 },
    ...(isAdmin ? [
      { title: "Admin", url: "/admin", icon: Settings },
      { title: "Import", url: "/tasks/import", icon: Upload },
    ] : []),
  ];

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <HardHat className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <span className="font-mono text-lg font-bold tracking-tight text-sidebar-foreground">
              ALSMK
            </span>
          )}
        </div>
      </SidebarHeader>
      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Navigation</SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navItems.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton asChild>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border p-3 space-y-2">
        {!collapsed && user && (
          <div className="space-y-1">
            <p className="text-xs font-medium text-sidebar-foreground truncate">
              {memberName ?? user.email}
            </p>
            {isAdmin && (
              <Badge variant="outline" className="text-[10px] border-primary text-primary">
                Admin
              </Badge>
            )}
          </div>
        )}
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size={collapsed ? "icon" : "sm"}
            className="w-full justify-start text-xs"
            onClick={() => navigate("/change-password")}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="ml-1">Change Password</span>}
          </Button>
        </div>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-xs text-muted-foreground hover:text-destructive"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span className="ml-1">Sign Out</span>}
        </Button>
      </SidebarFooter>
    </Sidebar>
  );
}
