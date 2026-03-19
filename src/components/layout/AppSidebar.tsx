import { LayoutDashboard, Briefcase, Users, Settings, Upload, HardHat, Building2, LogOut, KeyRound, User, MessageSquare, CalendarDays } from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "./AppLayout";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isAdminOrPm, memberName, signOut } = useAuthContext();
  const { unreadCount } = useUnreadMessages();

  const navItems = [
    { title: "Project Dashboard", url: "/", icon: LayoutDashboard },
    { title: "Calendar", url: "/calendar", icon: CalendarDays },
    { title: "My Dashboard", url: "/my", icon: User },
    { title: "My Workspace", url: "/workspace", icon: Briefcase },
    { title: "Messages", url: "/messages", icon: MessageSquare },
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

  // Close sidebar on mobile after navigation
  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="border-b border-sidebar-border px-3 py-4">
        <div className="flex items-center gap-2">
          <HardHat className="h-6 w-6 text-primary shrink-0" />
          {!collapsed && (
            <div className="flex items-center gap-2 min-w-0">
              <span className="font-mono text-lg font-bold tracking-tight text-sidebar-foreground">
                ALSMK
              </span>
              {memberName && (
                <Badge variant="secondary" className="text-xs font-semibold bg-primary text-white border-primary/30 truncate max-w-[140px] px-2.5 py-0.5">
                  {memberName}
                </Badge>
              )}
            </div>
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
                  <SidebarMenuButton asChild className={item.title === "Messages" && unreadCount > 0 ? "pr-8" : undefined}>
                    <NavLink
                      to={item.url}
                      end={item.url === "/"}
                      className="hover:bg-sidebar-accent/50 min-h-[44px] flex items-center"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                  {item.title === "Messages" && unreadCount > 0 && !collapsed && (
                    <SidebarMenuBadge className="right-2 top-1/2 -translate-y-1/2 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </SidebarMenuBadge>
                  )}
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
            className="w-full justify-start text-xs min-h-[44px]"
            onClick={() => { navigate("/change-password"); handleNavClick(); }}
          >
            <KeyRound className="h-3.5 w-3.5 shrink-0" />
            {!collapsed && <span className="ml-1">Change Password</span>}
          </Button>
        </div>
        <Button
          variant="ghost"
          size={collapsed ? "icon" : "sm"}
          className="w-full justify-start text-xs text-muted-foreground hover:text-destructive min-h-[44px]"
          onClick={handleLogout}
        >
          <LogOut className="h-3.5 w-3.5 shrink-0" />
          {!collapsed && <span className="ml-1">Sign Out</span>}
        </Button>
        {!collapsed && (
          <p className="text-[10px] text-muted-foreground/50 text-center pt-1">
            © {new Date().getFullYear()} Sean B. KO. All rights reserved.
          </p>
        )}
      </SidebarFooter>
    </Sidebar>
  );
}
