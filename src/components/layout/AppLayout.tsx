import { createContext, useContext, useEffect, useRef, useState } from "react";
import CpmScheduler from "@/pages/CpmScheduler";
import hyundaiLogo from "@/assets/hyundai-logo.png";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { UnreadMessagesDialog } from "./UnreadMessagesDialog";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

// Auth context so children can access auth state
interface AuthContextType {
  user: ReturnType<typeof useAuth>["user"];
  isAdmin: boolean;
  isPm: boolean;
  isAdminOrPm: boolean;
  isGuest: boolean;
  isSuperGuest: boolean;
  readOnly: boolean;
  memberId: string | null;
  memberName: string | null;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isPm: false,
  isAdminOrPm: false,
  isGuest: false,
  isSuperGuest: false,
  readOnly: false,
  memberId: null,
  memberName: null,
  signOut: async () => {},
});

export const useAuthContext = () => useContext(AuthContext);

// Routes accessible to each guest type
const GUEST_ALLOWED: string[] = ["/", "/change-password"];
const SUPER_GUEST_ALLOWED: string[] = [
  "/", "/calendar", "/my", "/workspace", "/cpm", "/messages", "/organization", "/change-password",
];

export function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();
  const [hasVisitedCpm, setHasVisitedCpm] = useState(false);
  const isCpmRoute = location.pathname === "/cpm";
  const isDashboardRoute = location.pathname === "/";
  const shouldMountCpm = hasVisitedCpm || isCpmRoute || isDashboardRoute;

  useEffect(() => {
    if ((isCpmRoute || isDashboardRoute) && !hasVisitedCpm) setHasVisitedCpm(true);
  }, [isCpmRoute, isDashboardRoute, hasVisitedCpm]);

  if (auth.loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="space-y-4 w-48">
          <Skeleton className="h-8 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
      </div>
    );
  }

  // Not logged in → redirect to login
  if (!auth.user) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Non-admin trying to access /admin or /tasks/import
  if (!auth.isAdmin && location.pathname === "/admin") {
    return <Navigate to="/" replace />;
  }

  if (auth.readOnly && location.pathname === "/tasks/import") {
    return <Navigate to="/" replace />;
  }

  // Guest route guard
  if (auth.isGuest && !GUEST_ALLOWED.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  // Super Guest route guard
  if (auth.isSuperGuest && !SUPER_GUEST_ALLOWED.includes(location.pathname)) {
    return <Navigate to="/" replace />;
  }

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isAdmin: auth.isAdmin,
        isPm: auth.isPm,
        isAdminOrPm: auth.isAdminOrPm,
        isGuest: auth.isGuest,
        isSuperGuest: auth.isSuperGuest,
        readOnly: auth.readOnly,
        memberId: auth.memberId,
        memberName: auth.memberName,
        signOut: auth.signOut,
      }}
    >
      <SidebarProvider>
        <div className="h-screen flex w-full overflow-hidden">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center justify-between border-b border-border px-3 sm:px-4 bg-card shrink-0">
              <div className="flex items-center gap-2 min-w-0">
                <SidebarTrigger className="shrink-0" />
                <img src={hyundaiLogo} alt="Hyundai E&C" className="h-5 hidden sm:inline-block" />
                <span className="font-mono text-xs sm:text-sm font-semibold text-muted-foreground truncate hidden sm:inline">
                  ALSMK Task Management System
                </span>
                <span className="font-mono text-xs font-semibold text-muted-foreground sm:hidden">
                  ALSMK
                </span>
              </div>
              <div className="flex items-center gap-2 sm:gap-3 shrink-0">
                <span className="text-[10px] text-muted-foreground/50 hidden sm:inline">© {new Date().getFullYear()} Sean B. KO. All rights reserved.</span>
                {!auth.readOnly && <NotificationBell />}
              </div>
            </header>
            <main className="flex-1 overflow-hidden p-3 sm:p-4 md:p-6 relative flex flex-col">
              {shouldMountCpm && (
                <div style={{ display: isCpmRoute ? 'block' : 'none' }} className="absolute inset-0">
                  <CpmScheduler />
                </div>
              )}
              <div style={{ display: isCpmRoute ? 'none' : 'flex' }} className="flex-col flex-1 min-h-0 overflow-auto">
                {children}
              </div>
            </main>
          </div>
        </div>
        {!auth.readOnly && <UnreadMessagesDialog />}
        {!auth.readOnly && <RealtimeDmToast memberId={auth.memberId} />}
      </SidebarProvider>
    </AuthContext.Provider>
  );
}

/** Global realtime DM toast — fires on every new message not sent by me */
function RealtimeDmToast({ memberId }: { memberId: string | null }) {
  const navigate = useNavigate();

  useEffect(() => {
    if (!memberId) return;

    const channel = supabase
      .channel("global-dm-toast")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "direct_messages" },
        async (payload) => {
          const msg = payload.new as any;
          if (msg.sender_id === memberId) return;

          // Resolve sender name
          const { data: sender } = await supabase
            .from("members")
            .select("name")
            .eq("id", msg.sender_id)
            .maybeSingle();

          const senderName = sender?.name || "Someone";
          const preview =
            msg.message.length > 50
              ? msg.message.slice(0, 50) + "…"
              : msg.message;

          toast.info(`💬 ${senderName}`, {
            description: preview,
            action: {
              label: "View",
              onClick: () => navigate(`/messages?conv=${msg.conversation_id}`),
            },
            duration: 6000,
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [memberId, navigate]);

  return null;
}
