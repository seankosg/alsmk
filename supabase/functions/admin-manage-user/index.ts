import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

function jsonResponse(body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY");

    if (!supabaseUrl || !serviceRoleKey || !anonKey) {
      return jsonResponse({ error: "Server configuration error" }, 500);
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const body = await req.json();
    const { action } = body;

    // ── Check if first user (no roles exist yet) ──
    const { data: existingRoles } = await adminClient
      .from("user_roles")
      .select("id")
      .limit(1);
    const isFirstUser = !existingRoles || existingRoles.length === 0;

    // ── Authenticate caller (skip for first user) ──
    if (!isFirstUser) {
      const authHeader = req.headers.get("Authorization");
      if (!authHeader?.startsWith("Bearer ")) {
        return jsonResponse({ error: "Unauthorized" }, 401);
      }

      const token = authHeader.replace("Bearer ", "");

      // Validate token directly against the auth API to avoid SDK session issues in edge runtime
      const authResponse = await fetch(`${supabaseUrl}/auth/v1/user`, {
        headers: {
          apikey: anonKey,
          Authorization: `Bearer ${token}`,
        },
      });

      const authPayload = await authResponse.json();
      const callerId = authPayload?.id as string | undefined;

      if (!authResponse.ok || !callerId) {
        console.error("Auth failed:", authPayload?.msg ?? authPayload?.error_description ?? authPayload?.error ?? "Unknown auth error");
        return jsonResponse({ error: "Invalid token" }, 401);
      }

      // Check admin role
      const { data: hasAdmin } = await adminClient.rpc("has_role", {
        _user_id: callerId,
        _role: "admin",
      });

      if (!hasAdmin) {
        return jsonResponse({ error: "Admin required" }, 403);
      }
    }

    // ── ACTION: create ──
    if (action === "create") {
      const { email, password, member_id } = body;
      if (!email || !password || !member_id) {
        return jsonResponse({ error: "email, password, member_id required" }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
      }

      // Check member exists and has no account yet
      const { data: member, error: memberErr } = await adminClient
        .from("members")
        .select("id, user_id")
        .eq("id", member_id)
        .single();

      if (memberErr || !member) {
        return jsonResponse({ error: "Member not found" }, 404);
      }
      if (member.user_id) {
        return jsonResponse({ error: "Member already has an account" }, 409);
      }

      // Create auth user
      const { data: newUser, error: createErr } =
        await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });

      if (createErr) {
        return jsonResponse({ error: createErr.message }, 400);
      }

      // Link to member
      const { error: updateErr } = await adminClient
        .from("members")
        .update({ user_id: newUser.user.id, email })
        .eq("id", member_id);

      if (updateErr) {
        // Rollback: delete the created auth user
        await adminClient.auth.admin.deleteUser(newUser.user.id);
        return jsonResponse({ error: "Failed to link account: " + updateErr.message }, 500);
      }

      // If first user, auto-assign admin role
      if (isFirstUser) {
        await adminClient.from("user_roles").insert({
          user_id: newUser.user.id,
          role: "admin",
        });
      }

      return jsonResponse({
        success: true,
        user_id: newUser.user.id,
        is_first_user: isFirstUser,
      });
    }

    // ── ACTION: reset-password ──
    if (action === "reset-password") {
      const { user_id, password } = body;
      if (!user_id || !password) {
        return jsonResponse({ error: "user_id, password required" }, 400);
      }
      if (password.length < 6) {
        return jsonResponse({ error: "Password must be at least 6 characters" }, 400);
      }

      const { error } = await adminClient.auth.admin.updateUserById(user_id, { password });
      if (error) {
        return jsonResponse({ error: error.message }, 400);
      }

      return jsonResponse({ success: true });
    }

    // ── ACTION: toggle-admin ──
    if (action === "toggle-admin") {
      const { user_id, grant } = body;
      if (!user_id) {
        return jsonResponse({ error: "user_id required" }, 400);
      }

      if (grant) {
        const { error } = await adminClient.from("user_roles").upsert(
          { user_id, role: "admin" },
          { onConflict: "user_id,role" }
        );
        if (error) return jsonResponse({ error: error.message }, 400);
      } else {
        const { error } = await adminClient
          .from("user_roles")
          .delete()
          .eq("user_id", user_id)
          .eq("role", "admin");
        if (error) return jsonResponse({ error: error.message }, 400);
      }

      return jsonResponse({ success: true });
    }

    return jsonResponse({ error: "Unknown action" }, 400);
  } catch (err) {
    console.error("Unhandled error:", err.message);
    return jsonResponse({ error: err.message }, 500);
  }
});
