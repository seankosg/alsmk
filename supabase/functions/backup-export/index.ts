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

const TABLES = [
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

    // Export all tables
    const backup: Record<string, unknown[]> = {};

    for (const table of TABLES) {
      const { data, error } = await adminClient
        .from(table)
        .select("*")
        .limit(50000);

      if (error) {
        console.error(`Error exporting ${table}:`, error.message);
        backup[table] = [];
      } else {
        backup[table] = data ?? [];
      }
    }

    const exportData = {
      version: 1,
      exported_at: new Date().toISOString(),
      tables: backup,
    };

    // Check if we should save to DB
    let saveToDb = false;
    let backupName = `auto_${new Date().toISOString().slice(0, 10)}`;
    try {
      const body = await req.json();
      saveToDb = body?.save_to_db === true;
      if (body?.backup_name && typeof body.backup_name === "string") {
        backupName = body.backup_name.trim().slice(0, 100) || backupName;
      }
    } catch {
      // No body or invalid JSON — just return the export
    }

    if (saveToDb) {
      const { error: insertError } = await adminClient
        .from("data_backups")
        .insert({
          name: `auto_${new Date().toISOString().slice(0, 10)}`,
          data: exportData,
        });

      if (insertError) {
        console.error("Failed to save backup to DB:", insertError.message);
      }
    }

    return jsonResponse(exportData);
  } catch (err) {
    console.error("Backup export error:", err.message);
    return jsonResponse({ error: err.message }, 500);
  }
});
