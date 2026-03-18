import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isPm: boolean;
  isAdminOrPm: boolean;
  memberId: string | null;
  memberName: string | null;
  loading: boolean;
}

export function useAuth() {
  const [state, setState] = useState<AuthState>({
    user: null,
    session: null,
    isAdmin: false,
    isPm: false,
    isAdminOrPm: false,
    memberId: null,
    memberName: null,
    loading: true,
  });

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, session) => {
        if (session?.user) {
          // Defer role/member lookup to avoid deadlock with auth
          setTimeout(async () => {
            const [roleResult, memberResult] = await Promise.all([
              supabase.rpc("has_role", {
                _user_id: session.user.id,
                _role: "admin",
              }),
              supabase
                .from("members")
                .select("id, name, is_pm")
                .eq("user_id", session.user.id)
                .maybeSingle(),
            ]);

            const admin = roleResult.data === true;
            const pm = memberResult.data?.is_pm === true;
            setState({
              user: session.user,
              session,
              isAdmin: admin,
              isPm: pm,
              isAdminOrPm: admin || pm,
              memberId: memberResult.data?.id ?? null,
              memberName: memberResult.data?.name ?? null,
              loading: false,
            });
          }, 0);
        } else {
          setState({
            user: null,
            session: null,
            isAdmin: false,
            isPm: false,
            isAdminOrPm: false,
            memberId: null,
            memberName: null,
            loading: false,
          });
        }
      }
    );

    // Initial session check
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        setState((prev) => ({ ...prev, loading: false }));
      }
      // onAuthStateChange will handle the rest
    });

    return () => subscription.unsubscribe();
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
