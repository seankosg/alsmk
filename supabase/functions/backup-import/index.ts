import { createClient } from "https://esm.sh/@supabase/supabase-js@2.99.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Order matters: referenced tables first
const IMPORT_ORDER = [
  "teams",
  "parts",
  "members",
  "milestones",
  "tasks",
  "task_code_sequences",
  "task_comments",
  "issue_threads",
  "calendar_events",
  "cpm_activities",
  "cpm_snapshots",
  "cpm_task_mappings",
  "conversations",
  "conversation_members",
  "direct_messages",
  "personnel_targets",
  "project_settings",
  "notifications",
  "activity_log",
  "user_roles",
];

// Primary key column(s) for each table
const PK_MAP: Record<string, string> = {
  teams: "id",
  parts: "id",
  members: "id",
  milestones: "id",
  tasks: "id",
  task_code_sequences: "team_code,part_code,yymm",
  task_comments: "id",
  issue_threads: "id",
  calendar_events: "id",
  cpm_activities: "id",
  cpm_snapshots: "id",
  cpm_task_mappings: "id",
  conversations: "id",
  conversation_members: "id",
  direct_messages: "id",
  personnel_targets: "id",
  project_settings: "key",
  notifications: "id",
  activity_log: "id",
  user_roles: "id",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Authenticate caller as admin
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }

    const authClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await authClient.auth.getClaims(token);
    const callerId = claimsData?.claims?.sub;

    if (claimsError || !callerId) {
      return jsonResponse({ error: "Invalid token" }, 401);
    }

    const { data: isAdmin } = await adminClient.rpc("has_role", {
      _user_id: callerId,
      _role: "admin",
    });

    if (!isAdmin) {
      return jsonResponse({ error: "Admin required" }, 403);
    }

    const body = await req.json();
    const tables = body?.tables;

    if (!tables || typeof tables !== "object") {
      return jsonResponse({ error: "Invalid backup format. Expected { tables: { ... } }" }, 400);
    }

    const results: Record<string, { count: number; error?: string }> = {};

    for (const table of IMPORT_ORDER) {
      const rows = tables[table];
      if (!Array.isArray(rows) || rows.length === 0) {
        results[table] = { count: 0 };
        continue;
      }

      const pk = PK_MAP[table] ?? "id";

      // Upsert in batches of 500
      let totalUpserted = 0;
      const batchSize = 500;

      for (let i = 0; i < rows.length; i += batchSize) {
        const batch = rows.slice(i, i + batchSize);
        const { error } = await adminClient
          .from(table)
          .upsert(batch, { onConflict: pk, ignoreDuplicates: false });

        if (error) {
          results[table] = { count: totalUpserted, error: error.message };
          break;
        }
        totalUpserted += batch.length;
      }

      if (!results[table]) {
        results[table] = { count: totalUpserted };
      }
    }

    return jsonResponse({ success: true, results });
  } catch (err) {
    console.error("Backup import error:", err.message);
    return jsonResponse({ error: err.message }, 500);
  }
});
