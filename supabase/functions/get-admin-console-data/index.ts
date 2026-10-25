import "jsr:@supabase/functions-js/edge-runtime.d.ts";

async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { try { await reader.cancel(); } catch {} return null; } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set([
  "https://www.atmarekha.in",
  "https://atmarekha.in",
  "http://localhost:5173",
]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin":
      origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

function readSupabaseServiceRoleKey() {
  const configured = Deno.env.get("SUPABASE_SECRET_KEYS") || "";
  if (configured) {
    try {
      const parsed = JSON.parse(configured);
      if (parsed?.default) return String(parsed.default).trim();
    } catch (_) {}
  }
  return (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
}

async function collectAuthUsers(admin: any, wantedIds: Set<string>): Promise<Map<string, any>> {
  const found = new Map<string, any>();
  let page = 1;
  while (page <= 20 && found.size < wantedIds.size) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 });
    if (error) throw error;
    const pageUsers = data?.users || [];
    for (const authUser of pageUsers) {
      if (wantedIds.has(authUser.id)) found.set(authUser.id, authUser);
    }
    if (pageUsers.length < 1000) break;
    page += 1;
  }
  return found;
}

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const service = readSupabaseServiceRoleKey();
    if (!url || !service) return json({ error: "Supabase server configuration is missing." }, 500, origin);

    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return json({ error: "Authentication required." }, 401, origin);

    const admin = createClient(url, service);
    const { data: { user }, error: authError } = await admin.auth.getUser(token);
    if (authError || !user) return json({ error: "Authentication failed." }, 401, origin);

    const { data: adminRow, error: adminError } = await admin
      .from("admins")
      .select("role")
      .eq("user_id", user.id)
      .maybeSingle();

    if (adminError || !adminRow || !["owner", "admin"].includes(String(adminRow.role || "").trim().toLowerCase())) {
      return json({ error: "Admin access required." }, 403, origin);
    }

    const { data: rateAllowed, error: rateError } = await admin.rpc("consume_rate_limit", {
      p_rate_key: "admin-console-data:" + user.id,
      p_limit: 60,
      p_window_seconds: 60,
    });
    if (rateError) {
      console.error("Admin console rate-limit check failed.");
      return json({ error: "Admin data is temporarily unavailable." }, 503, origin);
    }
    if (rateAllowed === false) return json({ error: "Too many admin data requests. Please try again shortly." }, 429, origin);

    let body: Record<string, unknown> = {};
    const rawBody = await readLimitedBody(req, 8192);
    if (rawBody === null) return json({ error: "Request body is too large." }, 413, origin);
    if (rawBody.trim()) { try { body = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON body." }, 400, origin); } }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body." }, 400, origin);

    const action = String(body.action || "analytics");
    if (!["analytics", "membership", "users", "email_change_requests", "user-details", "notifications"].includes(action)) {
      return json({ error: "Unknown admin data action." }, 400, origin);
    }

    if (action === "user-details") {
      const targetId = String(body.user_id || "").trim();
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(targetId)) {
        return json({ error: "A valid reader ID is required." }, 400, origin);
      }

      const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(targetId);
      if (targetError || !targetResult?.user) return json({ error: "Reader account not found." }, 404, origin);
      const target = targetResult.user;
      const fetchRows = async (query: PromiseLike<any>) => {
        const { data, error } = await query;
        if (error) throw error;
        return data || [];
      };
      const countRows = async (table: string) => {
        const { count, error } = await admin.from(table).select("user_id", { count: "exact", head: true }).eq("user_id", targetId);
        if (error) throw error;
        return Number(count || 0);
      };

      const [
        { data: profile, error: profileError },
        reading, pdlplReading, comments, pdlplComments, ratings, pdlplRatings, bookmarks, pdlplBookmarks,
        memberships, payments, deletionRequests, groupMessages, communityReactions, emailChanges,
        readingCount, pdlplReadingCount, commentCount, pdlplCommentCount, ratingCount, pdlplRatingCount, bookmarkCount, pdlplBookmarkCount
      ] = await Promise.all([
        admin.from("profiles").select("id,username,display_name,bio,avatar_url,public_badge,created_at,updated_at").eq("id", targetId).maybeSingle(),
        fetchRows(admin.from("reading_history").select("chapter_id,page_number,updated_at,chapters(chapter_number,title,language)").eq("user_id", targetId).order("updated_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("pdlpl_reading_history").select("chapter_id,page_number,updated_at,pal_do_pal_ke_lamhe_chapters(chapter_number,title,language)").eq("user_id", targetId).order("updated_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("comments").select("id,content,created_at,chapter_id,announcement_id,community_post_id").eq("user_id", targetId).order("created_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("pdlpl_comments").select("id,content,created_at,chapter_id").eq("user_id", targetId).order("created_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("chapter_ratings").select("id,rating,created_at,chapter_id,chapters(chapter_number,title)").eq("user_id", targetId).order("created_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("pdlpl_chapter_ratings").select("id,rating,created_at,chapter_id,pal_do_pal_ke_lamhe_chapters(chapter_number,title)").eq("user_id", targetId).order("created_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("bookmarks").select("id,created_at,chapter_id,chapters(chapter_number,title)").eq("user_id", targetId).order("created_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("pdlpl_bookmarks").select("id,created_at,chapter_id,pal_do_pal_ke_lamhe_chapters(chapter_number,title)").eq("user_id", targetId).order("created_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("user_subscriptions").select("id,plan_id,status,current_period_start,current_period_end,cancel_at_period_end,created_at,updated_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(10)),
        fetchRows(admin.from("payments").select("amount,status,created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(8)),
        fetchRows(admin.from("dpdp_deletion_requests").select("id,status,requested_at,resolved_at,resolution_note").eq("user_id", targetId).order("requested_at", { ascending: false }).limit(5)),
        fetchRows(admin.from("group_chat_messages").select("id,content,created_at").eq("user_id", targetId).order("created_at", { ascending: false }).limit(5)),
        fetchRows(admin.from("community_post_reactions").select("id,reaction,created_at,post_id").eq("user_id", targetId).order("created_at", { ascending: false }).limit(5)),
        fetchRows(admin.from("email_change_requests").select("id,current_email,requested_email,status,requested_at,verified_at,closed_at").eq("user_id", targetId).order("requested_at", { ascending: false }).limit(5)),
        countRows("reading_history"), countRows("pdlpl_reading_history"), countRows("comments"), countRows("pdlpl_comments"),
        countRows("chapter_ratings"), countRows("pdlpl_chapter_ratings"), countRows("bookmarks"), countRows("pdlpl_bookmarks")
      ]);
      if (profileError) throw profileError;

      return json({
        user: {
          id: target.id,
          email: target.email || null,
          pending_email: target.new_email || null,
          email_confirmed_at: target.email_confirmed_at || null,
          email_change_sent_at: target.email_change_sent_at || null,
          created_at: target.created_at || null,
          last_sign_in_at: target.last_sign_in_at || null,
          banned_until: target.banned_until || null,
          is_anonymous: Boolean(target.is_anonymous)
        },
        profile: profile || null,
        stats: {
          reading_history: readingCount,
          pdlpl_reading_history: pdlplReadingCount,
          comments: commentCount + pdlplCommentCount,
          ratings: ratingCount + pdlplRatingCount,
          bookmarks: bookmarkCount + pdlplBookmarkCount,
          memberships: memberships.length,
          payments: payments.length
        },
        activity: {
          reading, pdlpl_reading: pdlplReading, comments, pdlpl_comments: pdlplComments,
          ratings, pdlpl_ratings: pdlplRatings, bookmarks, pdlpl_bookmarks: pdlplBookmarks,
          memberships, payments, deletion_requests: deletionRequests,
          group_messages: groupMessages, community_reactions: communityReactions,
          email_changes: emailChanges
        }
      }, 200, origin);
    }

    if (action === "email_change_requests") {
      const { data: requestRows, error: requestError } = await admin
        .from("email_change_requests")
        .select("id,user_id,current_email,requested_email,status,requested_at,verified_at,closed_at,last_admin_resend_at,last_admin_resend_by,resend_count")
        .order("requested_at", { ascending: false })
        .limit(100);
      if (requestError) throw requestError;

      const rows = requestRows || [];
      const wantedIds = new Set(rows.map((row: any) => row.user_id).filter(Boolean));
      const authById = await collectAuthUsers(admin, wantedIds);
      const reconciled = await Promise.all(rows.map(async (request: any) => {
        if (request.status !== "pending") return request;
        if (!request.user_id) {
          const { data: updated, error: updateError } = await admin
            .from("email_change_requests")
            .update({ status: "cancelled", closed_at: new Date().toISOString() })
            .eq("id", request.id)
            .eq("status", "pending")
            .select("id,user_id,current_email,requested_email,status,requested_at,verified_at,closed_at,last_admin_resend_at,last_admin_resend_by,resend_count")
            .maybeSingle();
          if (updateError) throw updateError;
          if (updated) {
            const { error: eventError } = await admin.from("email_change_request_events").insert({
              request_id: request.id, user_id: null, actor_user_id: user.id,
              event_type: "cancelled", details: { reason: "account_unavailable" },
            });
            if (eventError) throw eventError;
          }
          return updated || request;
        }

        const authUser = authById.get(request.user_id);
        if (!authUser) return request;
        const currentEmail = String(authUser.email || "").trim().toLowerCase();
        const pendingEmail = String(authUser.new_email || "").trim().toLowerCase();
        const targetEmail = String(request.requested_email || "").trim().toLowerCase();
        let nextStatus: string | null = null;
        let reason = "";
        if (!pendingEmail && currentEmail === targetEmail) {
          nextStatus = "verified";
          reason = "auth_email_matches_requested_address";
        } else if (pendingEmail && pendingEmail !== targetEmail) {
          nextStatus = "superseded";
          reason = "a_different_email_change_is_pending";
        } else if (!pendingEmail && currentEmail !== targetEmail) {
          nextStatus = "cancelled";
          reason = "auth_no_longer_has_this_pending_change";
        }
        if (!nextStatus) return request;

        const now = new Date().toISOString();
        const patch: Record<string, unknown> = {
          status: nextStatus,
          closed_at: now,
          ...(nextStatus === "verified" ? { verified_at: now } : {}),
        };
        const { data: updated, error: updateError } = await admin
          .from("email_change_requests")
          .update(patch)
          .eq("id", request.id)
          .eq("status", "pending")
          .select("id,user_id,current_email,requested_email,status,requested_at,verified_at,closed_at,last_admin_resend_at,last_admin_resend_by,resend_count")
          .maybeSingle();
        if (updateError) throw updateError;
        if (updated) {
          const { error: eventError } = await admin.from("email_change_request_events").insert({
            request_id: request.id, user_id: request.user_id, actor_user_id: user.id,
            event_type: nextStatus, details: { reason },
          });
          if (eventError) throw eventError;
        }
        return updated || request;
      }));

      const requestIds = reconciled.map((request: any) => request.id).filter(Boolean);
      let eventRows: any[] = [];
      if (requestIds.length) {
        const { data, error } = await admin
          .from("email_change_request_events")
          .select("id,request_id,event_type,actor_user_id,details,created_at")
          .in("request_id", requestIds)
          .order("created_at", { ascending: false })
          .limit(500);
        if (error) throw error;
        eventRows = data || [];
      }
      const eventsByRequest = new Map<string, any[]>();
      for (const event of eventRows) {
        const list = eventsByRequest.get(event.request_id) || [];
        list.push(event);
        eventsByRequest.set(event.request_id, list);
      }
      return json({
        requests: reconciled.map((request: any) => ({
          ...request,
          events: eventsByRequest.get(request.id) || [],
        })),
      }, 200, origin);
    }

    if (action === "notifications") {
      const { data: notificationRows, error: notificationError } = await admin
        .from("admin_notification_log")
        .select("id,title,body,target,target_count,sent_count,failed_count,removed_count,status,scheduled_for,sent_at,created_at,error")
        .order("created_at", { ascending: false })
        .limit(250);
      if (notificationError) throw notificationError;
      return json({ notifications: notificationRows || [] }, 200, origin);
    }

    if (action === "analytics") {
      const requestedDays = Number(body.days ?? 30);
      const days = [1, 7, 30, 90].includes(requestedDays) ? requestedDays : 30;
      const { data, error } = await admin.rpc("get_admin_analytics_for_user", {
        p_user_id: user.id,
        p_days: days,
      });
      if (error) throw error;
      return json({ data: data || {} }, 200, origin);
    }

    if (action === "membership") {
      const { data, error } = await admin.rpc("get_admin_membership_analytics_for_user", {
        p_user_id: user.id,
      });
      if (error) throw error;
      const { count, error: countError } = await admin
        .from("profiles")
        .select("id", { count: "exact", head: true });
      if (countError) throw countError;
      return json({ data: data || {}, registered_users: Number(count || 0) }, 200, origin);
    }

    const { data: directory, error } = await admin.rpc("get_admin_user_directory_for_user", {
      p_user_id: user.id,
    });
    if (error) throw error;
    const rows = Array.isArray(directory) ? directory : [];
    const ids = rows.map((row) => row.user_id).filter(Boolean);
    let avatars: Record<string, string | null> = {};
    if (ids.length) {
      const { data: profileRows, error: profileError } = await admin
        .from("profiles")
        .select("id,avatar_url")
        .in("id", ids);
      if (profileError) throw profileError;
      avatars = Object.fromEntries((profileRows || []).map((row) => [row.id, row.avatar_url || null]));
    }

    return json({
      users: rows.map((row) => ({
        id: row.user_id,
        username: row.username,
        display_name: row.display_name,
        email: row.email,
        avatar_url: avatars[row.user_id] || null,
        created_at: row.joined_at,
        subscription_status: row.subscription_status,
        plan_id: row.plan_id,
        plan_name: row.plan_name,
        plan_amount_inr: row.plan_amount_inr,
        plan_interval: row.plan_interval,
        current_period_end: row.current_period_end,
      })),
    }, 200, origin);
  } catch (error) {
    console.error("Admin console data failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Unable to load admin data." }, 500, origin);
  }
});
