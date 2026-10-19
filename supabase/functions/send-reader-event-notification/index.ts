import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import webpush from "npm:web-push@3.6.7";
import { createClient } from "npm:@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in", "https://atmarekha.in", "http://localhost:5173"]);
const headersFor = (req: Request) => {
  const origin = req.headers.get("origin") || "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
};
const respond = (req: Request, body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: headersFor(req) });

async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { try { await reader.cancel(); } catch {} return null; } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(req) });
  if (req.method !== "POST") return respond(req, { ok: false, error: "Method not allowed." }, 405);
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    if (!url || !serviceKey || !publicKey || !privateKey) return respond(req, { ok: false, error: "Notification service is not configured." }, 503);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return respond(req, { ok: false, error: "Authentication required." }, 401);
    const db = createClient(url, serviceKey);
    const { data: { user }, error: authError } = await db.auth.getUser(token);
    if (authError || !user) return respond(req, { ok: false, error: "Invalid authentication." }, 401);
    const raw = await readLimitedBody(req, 8192);
    if (raw === null) return respond(req, { ok: false, error: "Request body too large." }, 413);
    let body: Record<string, unknown>;
    try { body = JSON.parse(raw); } catch { return respond(req, { ok: false, error: "Invalid JSON." }, 400); }
    const eventType = String(body.eventType || "").trim();
    const eventId = String(body.eventId || "").trim();
    const categoryByEvent: Record<string, string> = {
      comments_replies: "comments_replies",
      group_chat: "group_chat",
      community_posts: "community_posts",
      new_chapters: "new_chapters",
    };
    if (!categoryByEvent[eventType] || !eventId || eventId.length > 100) return respond(req, { ok: false, error: "Invalid notification event." }, 422);
    const rate = await db.rpc("consume_rate_limit", { p_rate_key: `reader-event-push:${user.id}`, p_limit: 20, p_window_seconds: 60 });
    if (rate.error) return respond(req, { ok: false, error: "Notification service temporarily unavailable." }, 503);
    if (rate.data === false) return respond(req, { ok: false, error: "Too many notifications requested." }, 429);

    let recipientIds: string[] = [];
    let title = "Atma Rekha";
    let message = "There is a new update for you.";
    let targetUrl = "/";
    let adminOnly = false;

    if (eventType === "comments_replies") {
      const { data: comment, error } = await db.from("comments").select("id,user_id,parent_comment_id,chapter_id,announcement_id,community_post_id").eq("id", eventId).maybeSingle();
      if (error) throw error;
      if (!comment || comment.user_id !== user.id) return respond(req, { ok: false, error: "Comment not found or not owned by this account." }, 403);
      if (!comment.parent_comment_id) return respond(req, { ok: true, skipped: true, reason: "Top-level comments do not notify all readers." });
      const { data: parent, error: parentError } = await db.from("comments").select("user_id").eq("id", comment.parent_comment_id).maybeSingle();
      if (parentError) throw parentError;
      if (parent?.user_id && parent.user_id !== user.id) recipientIds = [parent.user_id];
      title = "Someone replied to your comment";
      message = "Open Atma Rekha to read the reply.";
      targetUrl = comment.community_post_id ? "/#community" : comment.announcement_id ? "/#community" : "/chapters";
    } else if (eventType === "group_chat") {
      const { data: chatMessage, error } = await db.from("group_chat_messages").select("id,user_id,content").eq("id", eventId).maybeSingle();
      if (error) throw error;
      if (!chatMessage || chatMessage.user_id !== user.id) return respond(req, { ok: false, error: "Chat message not found or not owned by this account." }, 403);
      const { data: subscriptions, error: subscriptionError } = await db.from("push_subscriptions").select("user_id").not("user_id", "is", null).neq("user_id", user.id);
      if (subscriptionError) throw subscriptionError;
      recipientIds = [...new Set((subscriptions || []).map((row: { user_id: string | null }) => row.user_id).filter((id): id is string => Boolean(id)))];
      title = "New group chat message";
      message = String(chatMessage.content || "A new message was posted.").trim().slice(0, 140);
      targetUrl = "/#group-chat";
    } else if (eventType === "community_posts") {
      const { data: admin } = await db.from("admins").select("user_id,role").eq("user_id", user.id).maybeSingle();
      if (!admin || !["owner", "admin"].includes(String(admin.role || "").toLowerCase())) return respond(req, { ok: false, error: "Admin access required." }, 403);
      const { data: post, error } = await db.from("community_posts").select("id,title,content,published_at").eq("id", eventId).maybeSingle();
      if (error) throw error;
      if (!post || !post.published_at) return respond(req, { ok: false, error: "Published community post not found." }, 404);
      const { data: subscriptions, error: subscriptionError } = await db.from("push_subscriptions").select("user_id").not("user_id", "is", null);
      if (subscriptionError) throw subscriptionError;
      recipientIds = [...new Set((subscriptions || []).map((row: { user_id: string | null }) => row.user_id).filter((id): id is string => Boolean(id)))];
      title = String(post.title || "Atma Rekha Community").slice(0, 100);
      message = String(post.content || "A new community update is available.").replace(/<[^>]*>/g, "").trim().slice(0, 140);
      targetUrl = "/#community";
      adminOnly = true;
    } else if (eventType === "new_chapters") {
      const { data: admin } = await db.from("admins").select("user_id,role").eq("user_id", user.id).maybeSingle();
      if (!admin || !["owner", "admin"].includes(String(admin.role || "").toLowerCase())) return respond(req, { ok: false, error: "Admin access required." }, 403);
      const { data: chapter, error } = await db.from("chapters").select("id,chapter_number,title,status").eq("id", eventId).maybeSingle();
      if (error) throw error;
      if (!chapter || String(chapter.status || "").toLowerCase() !== "published") return respond(req, { ok: false, error: "Published chapter not found." }, 404);
      const { data: subscriptions, error: subscriptionError } = await db.from("push_subscriptions").select("user_id").not("user_id", "is", null);
      if (subscriptionError) throw subscriptionError;
      recipientIds = [...new Set((subscriptions || []).map((row: { user_id: string | null }) => row.user_id).filter((id): id is string => Boolean(id)))];
      title = chapter.chapter_number ? `Atma Rekha Chapter ${chapter.chapter_number}` : String(chapter.title || "New chapter");
      message = String(chapter.title || "A new chapter is available.").slice(0, 140);
      targetUrl = chapter.chapter_number ? `/chapter/${encodeURIComponent(String(chapter.chapter_number))}` : "/chapters";
      adminOnly = true;
    }

    if (!recipientIds.length) return respond(req, { ok: true, sent: 0, reason: "No eligible recipients." });
    const uniqueIds = [...new Set(recipientIds)].filter(id => id !== user.id || eventType === "comments_replies");
    if (!uniqueIds.length) return respond(req, { ok: true, sent: 0, reason: "No eligible recipients." });
    const { data: dispatch, error: dispatchError } = await db.from("notification_event_dispatches").insert({ event_type: eventType, event_id: eventId, sender_user_id: user.id, status: "sending" }).select("id").single();
    if (dispatchError) {
      if ((dispatchError as { code?: string }).code === "23505") return respond(req, { ok: true, duplicate: true, sent: 0 });
      throw dispatchError;
    }
    const { data: prefs, error: preferenceError } = await db.from("notification_preferences").select("user_id,preferences").in("user_id", uniqueIds);
    if (preferenceError) throw preferenceError;
    const preferenceMap = new Map((prefs || []).map((row: { user_id: string; preferences: Record<string, boolean> | null }) => [row.user_id, row.preferences || {}]));
    const { data: subs, error: subsError } = await db.from("push_subscriptions").select("id,user_id,endpoint,p256dh,auth").in("user_id", uniqueIds);
    if (subsError) throw subsError;
    const category = categoryByEvent[eventType];
    const eligible = (subs || []).filter((row: { user_id: string; endpoint: string; p256dh: string; auth: string }) => {
      const preferences = preferenceMap.get(row.user_id);
      return !preferences || preferences[category] !== false;
    });
    if (!eligible.length) {
      await db.from("notification_event_dispatches").update({ status: "skipped", completed_at: new Date().toISOString() }).eq("id", dispatch.id);
      return respond(req, { ok: true, sent: 0, reason: "Recipients have no active subscription or disabled this category." });
    }
    webpush.setVapidDetails("mailto:atmarekhasupport@gmail.com", publicKey, privateKey);
    let sent = 0;
    let failed = 0;
    for (const subscription of eligible) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({ title, body: message, icon: "/favicon.png", badge: "/favicon.png", url: targetUrl, tag: `atma-${category}-${eventId}`, renotify: false }),
        );
        sent++;
      } catch (error) {
        failed++;
        const code = (error as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
    await db.from("notification_event_dispatches").update({ status: sent > 0 && failed === 0 ? "sent" : sent > 0 ? "partial" : "failed", sent_count: sent, failed_count: failed, completed_at: new Date().toISOString() }).eq("id", dispatch.id);
    if (adminOnly) await db.from("admin_activity_log").insert({ admin_user_id: user.id, action: "send_event_notification", entity_type: eventType, entity_id: eventId, details: { category, sent, failed } });
    return respond(req, { ok: true, sent, failed, category });
  } catch (error) {
    console.error("Reader event notification failed.", error);
    return respond(req, { ok: false, error: "Could not send event notification." }, 500);
  }
});
