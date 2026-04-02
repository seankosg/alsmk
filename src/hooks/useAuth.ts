import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthState {
  user: User | null;
  session: Session | null;
  isAdmin: boolean;
  isPm: boolean;
  isAdminOrPm: boolean;
  isGuest: boolean;
  isSuperGuest: boolean;
  readOnly: boolean;
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
    isGuest: false,
    isSuperGuest: false,
    readOnly: false,
    memberId: null,
    memberName: null,
    loading: true,
  });

  const fetchingForRef = useRef<string | null>(null);

  useEffect(() => {
    let mounted = true;

    async function fetchRoles(user: User, session: Session) {
      if (fetchingForRef.current === user.id) return;
      fetchingForRef.current = user.id;

      try {
        const [adminResult, guestResult, superGuestResult, memberResult] = await Promise.all([
          supabase.rpc("has_role", { _user_id: user.id, _role: "admin" }),
          supabase.rpc("has_role", { _user_id: user.id, _role: "guest" }),
          supabase.rpc("has_role", { _user_id: user.id, _role: "super_guest" }),
          supabase
            .from("members")
            .select("id, name, is_pm")
            .eq("user_id", user.id)
            .maybeSingle(),
        ]);

        if (!mounted) return;

        if (adminResult.error || memberResult.error) {
          console.warn("Role fetch error:", adminResult.error, memberResult.error);
          setState((prev) => ({ ...prev, user, session, loading: false }));
          return;
        }

        const admin = adminResult.data === true;
        const pm = memberResult.data?.is_pm === true;
        const guest = guestResult.data === true;
        const superGuest = superGuestResult.data === true;
        const readOnly = guest || superGuest;

        setState({
          user,
          session,
          isAdmin: admin,
          isPm: pm,
          isAdminOrPm: admin || pm,
          isGuest: guest,
          isSuperGuest: superGuest,
          readOnly,
          memberId: memberResult.data?.id ?? null,
          memberName: memberResult.data?.name ?? null,
          loading: false,
        });
      } finally {
        if (fetchingForRef.current === user.id) {
          fetchingForRef.current = null;
        }
      }
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (session?.user) {
          setState((prev) => ({ ...prev, user: session.user, session }));
          fetchRoles(session.user, session);
        } else {
          fetchingForRef.current = null;
          setState({
            user: null,
            session: null,
            isAdmin: false,
            isPm: false,
            isAdminOrPm: false,
            isGuest: false,
            isSuperGuest: false,
            readOnly: false,
            memberId: null,
            memberName: null,
            loading: false,
          });
        }
      }
    );

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session && mounted) {
        setState((prev) => ({ ...prev, loading: false }));
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return { ...state, signOut };
}
