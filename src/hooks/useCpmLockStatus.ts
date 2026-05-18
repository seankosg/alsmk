import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

/**
 * CPM 검증 모드 잠금 상태
 * project_settings.cpm_locked = 'true' 이면 일반 사용자는 CPM 변경/접근이 차단됩니다.
 */
export function useCpmLockStatus() {
  const { data, isLoading } = useQuery({
    queryKey: ["project_settings", "cpm_locked"],
    queryFn: async () => {
      const { data } = await supabase
        .from("project_settings")
        .select("value")
        .eq("key", "cpm_locked")
        .maybeSingle();
      return data?.value === "true";
    },
    staleTime: 30_000,
  });

  return { cpmLocked: data === true, isLoading };
}
