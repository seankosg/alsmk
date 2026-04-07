import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // 1. Fetch overdue tasks (end_date < today, progress < 100, not deleted)
    const { data: overdueTasks, error: taskErr } = await supabase
      .from("tasks")
      .select("id, title, task_code, end_date, current_progress, assignee_id, team_id")
      .lt("end_date", today)
      .lt("current_progress", 100)
      .is("deleted_at", null);

    if (taskErr) throw taskErr;
    if (!overdueTasks || overdueTasks.length === 0) {
      return new Response(JSON.stringify({ message: "No overdue tasks" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 2. Check today's already-sent notifications to avoid duplicates
    const todayStart = `${today}T00:00:00.000Z`;
    const todayEnd = `${today}T23:59:59.999Z`;
    const overdueTaskIds = overdueTasks.map((t) => t.id);

    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("task_id")
      .eq("type", "overdue_alert")
      .gte("created_at", todayStart)
      .lte("created_at", todayEnd)
      .in("task_id", overdueTaskIds);

    const alreadySentTaskIds = new Set((existingNotifs || []).map((n) => n.task_id));

    // Filter out already-notified tasks
    const tasksToNotify = overdueTasks.filter((t) => !alreadySentTaskIds.has(t.id));
    if (tasksToNotify.length === 0) {
      return new Response(JSON.stringify({ message: "All overdue tasks already notified today" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // 3. Fetch all PMs (is_pm = true, not deleted)
    const teamIds = [...new Set(tasksToNotify.map((t) => t.team_id))];
    const { data: pms } = await supabase
      .from("members")
      .select("id, team_id")
      .eq("is_pm", true)
      .is("deleted_at", null)
      .in("team_id", teamIds);

    const pmsByTeam = new Map<string, string[]>();
    for (const pm of pms || []) {
      const list = pmsByTeam.get(pm.team_id) || [];
      list.push(pm.id);
      pmsByTeam.set(pm.team_id, list);
    }

    // 4. Build notification rows + DM data
    const notificationRows: any[] = [];
    const dmTargets: { recipientId: string; taskId: string; message: string }[] = [];

    for (const task of tasksToNotify) {
      const overdueDays = Math.round(
        (new Date(today).getTime() - new Date(task.end_date).getTime()) / 86400000
      );
      const title = `⚠ 기한 초과: ${task.task_code || "N/A"}`;
      const message = `${task.title} - ${overdueDays}일 초과`;

      // Collect unique recipient IDs (assignee + team PMs)
      const recipientIds = new Set<string>();
      if (task.assignee_id) recipientIds.add(task.assignee_id);
      const teamPms = pmsByTeam.get(task.team_id) || [];
      for (const pmId of teamPms) recipientIds.add(pmId);

      for (const recipientId of recipientIds) {
        notificationRows.push({
          recipient_id: recipientId,
          sender_id: null,
          task_id: task.id,
          type: "overdue_alert",
          title,
          message,
        });

        dmTargets.push({ recipientId, taskId: task.id, message: `${title}\n${message}` });
      }
    }

    // 5. Batch insert notifications
    if (notificationRows.length > 0) {
      const { error: notifErr } = await supabase.from("notifications").insert(notificationRows);
      if (notifErr) console.error("Notification insert error:", notifErr);
    }

    // 6. Send DMs - find or create system sender, then send messages
    // Use first PM as system sender for DMs
    let systemSenderId: string | null = null;
    const { data: systemMember } = await supabase
      .from("members")
      .select("id")
      .eq("name", "System")
      .is("deleted_at", null)
      .maybeSingle();

    if (systemMember) {
      systemSenderId = systemMember.id;
    } else {
      // Fallback: use first PM
      const { data: firstPm } = await supabase
        .from("members")
        .select("id")
        .eq("is_pm", true)
        .is("deleted_at", null)
        .limit(1)
        .maybeSingle();
      if (firstPm) systemSenderId = firstPm.id;
    }

    if (systemSenderId) {
      for (const dm of dmTargets) {
        if (dm.recipientId === systemSenderId) continue; // Don't DM yourself

        try {
          // Find existing direct conversation between system sender and recipient
          const { data: senderConvs } = await supabase
            .from("conversation_members")
            .select("conversation_id")
            .eq("member_id", systemSenderId);

          let conversationId: string | null = null;
          const senderConvIds = (senderConvs || []).map((c) => c.conversation_id);

          if (senderConvIds.length > 0) {
            const { data: sharedConvs } = await supabase
              .from("conversation_members")
              .select("conversation_id")
              .eq("member_id", dm.recipientId)
              .in("conversation_id", senderConvIds);

            for (const sc of sharedConvs || []) {
              const { data: conv } = await supabase
                .from("conversations")
                .select("id, type")
                .eq("id", sc.conversation_id)
                .eq("type", "direct")
                .maybeSingle();
              if (conv) {
                const { data: memberCount } = await supabase
                  .from("conversation_members")
                  .select("id")
                  .eq("conversation_id", conv.id);
                if (memberCount && memberCount.length === 2) {
                  conversationId = conv.id;
                  break;
                }
              }
            }
          }

          if (!conversationId) {
            const { data: newConv } = await supabase
              .from("conversations")
              .insert({ type: "direct" })
              .select("id")
              .single();
            if (newConv) {
              conversationId = newConv.id;
              await supabase.from("conversation_members").insert([
                { conversation_id: conversationId, member_id: systemSenderId },
                { conversation_id: conversationId, member_id: dm.recipientId },
              ]);
            }
          }

          if (conversationId) {
            await supabase.from("direct_messages").insert({
              conversation_id: conversationId,
              sender_id: systemSenderId,
              message: dm.message,
              referenced_task_id: dm.taskId,
            });
          }
        } catch (dmErr) {
          console.error("DM send error:", dmErr);
        }
      }
    }

    return new Response(
      JSON.stringify({
        message: `Processed ${tasksToNotify.length} overdue tasks, sent ${notificationRows.length} notifications`,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("check-overdue-tasks error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
