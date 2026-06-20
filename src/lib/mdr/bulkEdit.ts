import { supabase } from "@/integrations/supabase/client";

export const BULK_CHUNK_ROWS = 500;

export type MdrBulkField = "discipline" | "plan_finish" | "drawing_title";

export interface MdrBulkFieldDef {
  field: MdrBulkField;
  label: string;
  inputType: "select" | "date" | "text";
  options?: { value: string; label: string }[];
  group: string;
}

export const MDR_BULK_FIELDS: MdrBulkFieldDef[] = [
  {
    field: "discipline", label: "Discipline", inputType: "select", group: "분류",
    options: ["A", "S", "M", "E", "P", "C", "I"].map((v) => ({ value: v, label: v })),
  },
  { field: "plan_finish", label: "Plan Finish", inputType: "date", group: "일정" },
  { field: "drawing_title", label: "Drawing Title", inputType: "text", group: "내용" },
];

export interface ApplyBulkUpdateArgs {
  ids: string[];
  field: MdrBulkField;
  value: string | null;
  userName: string | null;
}

export interface ApplyBulkUpdateResult {
  ok: number;
  failed: number;
  errors: string[];
}

export async function applyMdrBulkUpdate({ ids, field, value, userName }: ApplyBulkUpdateArgs): Promise<ApplyBulkUpdateResult> {
  const result: ApplyBulkUpdateResult = { ok: 0, failed: 0, errors: [] };
  if (!ids.length) return result;

  for (let i = 0; i < ids.length; i += BULK_CHUNK_ROWS) {
    const chunk = ids.slice(i, i + BULK_CHUNK_ROWS);
    const payload: Record<string, any> = { [field]: value };
    const { data, error } = await (supabase
      .from("mdr_drawings" as never) as any)
      .update(payload)
      .in("id", chunk)
      .select("id");
    if (error) {
      result.failed += chunk.length;
      result.errors.push(error.message);
      continue;
    }
    const okCount = (data as any[] | null)?.length ?? 0;
    result.ok += okCount;
    result.failed += chunk.length - okCount;
  }

  // activity_log: batch당 1행 요약
  try {
    await supabase.from("activity_log" as never).insert({
      user_name: userName ?? "system",
      action: "bulk_edit",
      entity_type: "mdr_drawings",
      details: {
        field,
        value,
        count: result.ok,
        failed: result.failed,
        sample_ids: ids.slice(0, 50),
      },
    } as never);
  } catch {
    // logging failure should not block UX
  }

  return result;
}
