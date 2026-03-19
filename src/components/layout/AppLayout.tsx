import { createContext, useContext, useEffect, useRef } from "react";
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
  memberId: string | null;
  memberName: string | null;
  signOut: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  isAdmin: false,
  isPm: false,
  isAdminOrPm: false,
  memberId: null,
  memberName: null,
  signOut: async () => {},
});

export const useAuthContext = () => useContext(AuthContext);

export function AppLayout({ children }: { children: React.ReactNode }) {
  const auth = useAuth();
  const location = useLocation();

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

  // Non-admin trying to access /admin
  if (!auth.isAdmin && location.pathname === "/admin") {
    return <Navigate to="/" replace />;
  }

  // Regular member accessing / → redirect to /my (removed: now all users can view Project Dashboard read-only)

  return (
    <AuthContext.Provider
      value={{
        user: auth.user,
        isAdmin: auth.isAdmin,
        isPm: auth.isPm,
        isAdminOrPm: auth.isAdminOrPm,
        memberId: auth.memberId,
        memberName: auth.memberName,
        signOut: auth.signOut,
      }}
    >
      <SidebarProvider>
        <div className="min-h-screen flex w-full">
          <AppSidebar />
          <div className="flex-1 flex flex-col min-w-0">
            <header className="h-12 flex items-center justify-between border-b border-border px-4 bg-card shrink-0">
              <div className="flex items-center gap-2">
                <SidebarTrigger />
                <img src={hyundaiLogo} alt="Hyundai E&C" className="h-5 hidden sm:inline-block" />
                <span className="font-mono text-sm font-semibold text-muted-foreground hidden sm:inline">
                  ALSMK Project Management
                </span>
              </div>
              <div className="flex items-center gap-3">
                {auth.memberName && (
                  <span className="text-sm font-bold text-primary">
                    {auth.memberName}
                  </span>
                )}
                <NotificationBell />
              </div>
            </header>
            <main className="flex-1 overflow-auto p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
        <UnreadMessagesDialog />
        <RealtimeDmToast memberId={auth.memberId} />
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
