import { LayoutDashboard, Briefcase, Users, Settings, Upload, HardHat, Building2, LogOut, KeyRound, User, MessageSquare, CalendarDays, Network, ShieldAlert, Database, History } from "lucide-react";
import { useCpmLockStatus } from "@/hooks/useCpmLockStatus";
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

const allNavItems = [
  { title: "Project Dashboard", url: "/", icon: LayoutDashboard, guestVisible: true, superGuestVisible: true },
  { title: "Calendar", url: "/calendar", icon: CalendarDays, guestVisible: false, superGuestVisible: true },
  { title: "My Dashboard", url: "/my", icon: User, guestVisible: false, superGuestVisible: true },
  { title: "My Workspace", url: "/workspace", icon: Briefcase, guestVisible: false, superGuestVisible: true },
  { title: "CPM Manager", url: "/cpm", icon: Network, guestVisible: false, superGuestVisible: true },
  { title: "Orphan Center", url: "/cpm/orphans", icon: ShieldAlert, adminOrPmOnly: true, guestVisible: false, superGuestVisible: false },
  { title: "Messages", url: "/messages", icon: MessageSquare, guestVisible: false, superGuestVisible: true },
  { title: "Organization", url: "/organization", icon: Building2, guestVisible: false, superGuestVisible: true },
  { title: "Design Dashboard", url: "/design/dashboard", icon: LayoutDashboard, adminOrPmOnly: true, guestVisible: false, superGuestVisible: false },
  { title: "Design Summary", url: "/design/summary", icon: History, adminOrPmOnly: true, guestVisible: false, superGuestVisible: false },
  { title: "Design Raw Data", url: "/design", icon: Database, adminOrPmOnly: true, guestVisible: false, superGuestVisible: false },
  { title: "Admin", url: "/admin", icon: Settings, adminOnly: true, guestVisible: false, superGuestVisible: false },
  { title: "Import", url: "/tasks/import", icon: Upload, adminOnly: true, guestVisible: false, superGuestVisible: false },
];

export function AppSidebar() {
  const { state, isMobile, setOpenMobile } = useSidebar();
  const collapsed = state === "collapsed";
  const location = useLocation();
  const navigate = useNavigate();
  const { user, isAdmin, isAdminOrPm, isGuest, isSuperGuest, readOnly, memberName, signOut } = useAuthContext();
  const { unreadCount } = useUnreadMessages();
  const { cpmLocked } = useCpmLockStatus();

  // Filter nav items based on role
  const navItems = allNavItems.filter((item) => {
    if (isGuest) return item.guestVisible;
    if (isSuperGuest) return item.superGuestVisible && !((item as any).adminOrPmOnly);
    if ((item as any).adminOrPmOnly) return isAdminOrPm;
    if (item.adminOnly) return isAdmin;
    // CPM 검증 모드 잠금: 일반 사용자(Admin/PM 제외)는 CPM Manager 숨김
    if (item.url === "/cpm" && cpmLocked && !isAdminOrPm) return false;
    return true;
  });

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  const handleNavClick = () => {
    if (isMobile) {
      setOpenMobile(false);
    }
  };

  // Determine role badge
  const roleBadge = isAdmin
    ? { label: "Admin", className: "border-primary text-primary" }
    : isGuest
    ? { label: "Guest", className: "border-muted-foreground text-muted-foreground" }
    : isSuperGuest
    ? { label: "Super Guest", className: "border-accent-foreground text-accent-foreground" }
    : null;

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
                      end={item.url === "/" || item.url === "/design"}
                      className="hover:bg-sidebar-accent/50 min-h-[44px] flex items-center"
                      activeClassName="bg-sidebar-accent text-primary font-medium"
                      onClick={handleNavClick}
                    >
                      <item.icon className="mr-2 h-4 w-4 shrink-0" />
                      {!collapsed && <span>{item.title}</span>}
                    </NavLink>
                  </SidebarMenuButton>
                  {item.title === "Messages" && unreadCount > 0 && !collapsed && !readOnly && (
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
            {roleBadge && (
              <Badge variant="outline" className={`text-[10px] ${roleBadge.className}`}>
                {roleBadge.label}
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
      </SidebarFooter>
    </Sidebar>
  );
}
