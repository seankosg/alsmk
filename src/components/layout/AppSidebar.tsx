import { LayoutDashboard, Briefcase, Users, Settings, Upload, HardHat, Building2, LogOut, KeyRound, User, MessageSquare, CalendarDays, Network, ShieldAlert, Database, History, ChevronDown, FolderKanban } from "lucide-react";
import { useCpmLockStatus } from "@/hooks/useCpmLockStatus";
import { NavLink } from "@/components/NavLink";
import { useLocation, useNavigate } from "react-router-dom";
import {
  Sidebar, SidebarContent, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarMenu, SidebarMenuBadge, SidebarMenuButton, SidebarMenuItem,
  SidebarMenuSub, SidebarMenuSubButton, SidebarMenuSubItem,
  SidebarHeader, SidebarFooter, useSidebar,
} from "@/components/ui/sidebar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuthContext } from "./AppLayout";
import { useUnreadMessages } from "@/hooks/useUnreadMessages";

type FlatNavItem = { kind: "link"; title: string; url: string; icon: any; adminOnly?: boolean; adminOrPmOnly?: boolean; guestVisible: boolean; superGuestVisible: boolean };
type DesignGroupItem = { kind: "design-group" };
type NavItem = FlatNavItem | DesignGroupItem;

const allNavItems: NavItem[] = [
  { kind: "link", title: "Project Dashboard", url: "/", icon: LayoutDashboard, guestVisible: true, superGuestVisible: true },
  { kind: "design-group" },
  { kind: "link", title: "CPM Manager", url: "/cpm", icon: Network, guestVisible: false, superGuestVisible: true },
  { kind: "link", title: "My Dashboard", url: "/my", icon: User, guestVisible: false, superGuestVisible: true },
  { kind: "link", title: "My Workspace", url: "/workspace", icon: Briefcase, guestVisible: false, superGuestVisible: true },
  { kind: "link", title: "Calendar", url: "/calendar", icon: CalendarDays, guestVisible: false, superGuestVisible: true },
  { kind: "link", title: "Messages", url: "/messages", icon: MessageSquare, guestVisible: false, superGuestVisible: true },
  { kind: "link", title: "Organization", url: "/organization", icon: Building2, guestVisible: false, superGuestVisible: true },
  { kind: "link", title: "Admin", url: "/admin", icon: Settings, adminOnly: true, guestVisible: false, superGuestVisible: false },
  { kind: "link", title: "Import", url: "/tasks/import", icon: Upload, adminOnly: true, guestVisible: false, superGuestVisible: false },
];

const designSubItems = [
  { title: "Dashboard", url: "/design/dashboard", icon: LayoutDashboard, end: false },
  { title: "Summary", url: "/design/summary", icon: History, end: false },
  { title: "Raw Data", url: "/design", icon: Database, end: true },
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
  const navItems = allNavItems.filter((item): boolean => {
    if (item.kind === "design-group") return isAdminOrPm;
    if (isGuest) return item.guestVisible;
    if (isSuperGuest) return item.superGuestVisible && !item.adminOrPmOnly;
    if (item.adminOrPmOnly) return isAdminOrPm;
    if (item.adminOnly) return isAdmin;
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
              {navItems.map((item) => {
                if (item.kind === "design-group") {
                  return (
                    <Collapsible key="design-group" defaultOpen={location.pathname.startsWith("/design")} className="group/collapsible">
                      <SidebarMenuItem>
                        <CollapsibleTrigger asChild>
                          <SidebarMenuButton className="hover:bg-sidebar-accent/50 min-h-[44px]">
                            <FolderKanban className="mr-2 h-4 w-4 shrink-0" />
                            {!collapsed && (
                              <>
                                <span>Design Management</span>
                                <ChevronDown className="ml-auto h-4 w-4 transition-transform group-data-[state=open]/collapsible:rotate-180" />
                              </>
                            )}
                          </SidebarMenuButton>
                        </CollapsibleTrigger>
                        {!collapsed && (
                          <CollapsibleContent>
                            <SidebarMenuSub>
                              {designSubItems.map((sub) => (
                                <SidebarMenuSubItem key={sub.title}>
                                  <SidebarMenuSubButton asChild>
                                    <NavLink
                                      to={sub.url}
                                      end={sub.end}
                                      className="hover:bg-sidebar-accent/50"
                                      activeClassName="bg-sidebar-accent text-primary font-medium"
                                      onClick={handleNavClick}
                                    >
                                      <sub.icon className="mr-2 h-4 w-4 shrink-0" />
                                      <span>{sub.title}</span>
                                    </NavLink>
                                  </SidebarMenuSubButton>
                                </SidebarMenuSubItem>
                              ))}
                            </SidebarMenuSub>
                          </CollapsibleContent>
                        )}
                      </SidebarMenuItem>
                    </Collapsible>
                  );
                }
                return (
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
                    {item.title === "Messages" && unreadCount > 0 && !collapsed && !readOnly && (
                      <SidebarMenuBadge className="right-2 top-1/2 -translate-y-1/2 rounded-full bg-destructive px-1.5 text-[10px] font-bold text-destructive-foreground">
                        {unreadCount > 99 ? "99+" : unreadCount}
                      </SidebarMenuBadge>
                    )}
                  </SidebarMenuItem>
                );
              })}
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
