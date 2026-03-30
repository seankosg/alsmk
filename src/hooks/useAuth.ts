import { useState, useEffect, useRef, useCallback } from "react";
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

  const fetchingForRef = useRef<string | null>(null);
  const mountedRef = useRef(true);

  const fetchRoles = useCallback(async (user: User, session: Session) => {
    // Prevent duplicate concurrent fetches for the same user
    if (fetchingForRef.current === user.id) return;
    fetchingForRef.current = user.id;

    try {
      const [roleResult, memberResult] = await Promise.all([
        supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
        supabase
          .from("members")
          .select("id, name, is_pm")
          .eq("user_id", user.id)
          .maybeSingle(),
      ]);

      if (!mountedRef.current) return;

      // If RPC errored, keep previous role values instead of defaulting to false
      if (roleResult.error || memberResult.error) {
        console.warn("Role fetch error:", roleResult.error, memberResult.error);
        setState((prev) => ({ ...prev, user, session, loading: false }));
        return;
      }

      const admin = roleResult.data === true;
      const pm = memberResult.data?.is_pm === true;
      setState({
        user,
        session,
        isAdmin: admin,
        isPm: pm,
        isAdminOrPm: admin || pm,
        memberId: memberResult.data?.id ?? null,
        memberName: memberResult.data?.name ?? null,
        loading: false,
      });
    } finally {
      if (fetchingForRef.current === user.id) {
        fetchingForRef.current = null;
      }
    }
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          // Set user/session immediately but keep loading until roles resolve
          setState((prev) => ({
            ...prev,
            user: session.user,
            session,
          }));
          fetchRoles(session.user, session);
        } else {
          fetchingForRef.current = null;
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

    return () => {
      mountedRef.current = false;
      subscription.unsubscribe();
    };
  }, [fetchRoles]);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
