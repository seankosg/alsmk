import { createContext, useContext } from "react";
import { SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { AppSidebar } from "./AppSidebar";
import { NotificationBell } from "./NotificationBell";
import { useAuth } from "@/hooks/useAuth";
import { Navigate, useLocation } from "react-router-dom";
import { Skeleton } from "@/components/ui/skeleton";

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

  // Regular member accessing / → redirect to /my
  if (!auth.isAdmin && !auth.isPm && location.pathname === "/") {
    return <Navigate to="/my" replace />;
  }

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
      </SidebarProvider>
    </AuthContext.Provider>
  );
}
