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

const escapeHtml = (value: unknown) => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char] || char));

async function sendChapterReleaseEmail(db: ReturnType<typeof createClient>, chapter: { id: string; chapter_number: number | null; title: string | null }, actorId: string) {
  const resendKey = Deno.env.get("RESEND_API_KEY") || "";
  if (!resendKey) return { sent: 0, failed: 1, error: "RESEND_API_KEY is not configured." };

  const { data: existing, error: existingError } = await db.from("notification_event_dispatches")
    .select("id,status,sent_count,failed_count").eq("event_type", "chapter_release_email").eq("event_id", chapter.id).maybeSingle();
  if (existingError) throw existingError;
  if (existing?.status === "sent" || existing?.status === "skipped") {
    return { sent: Number(existing.sent_count || 0), failed: Number(existing.failed_count || 0), duplicate: true };
  }
  if (existing?.status === "sending") return { sent: 0, failed: 0, duplicate: true };
  if (existing?.status === "partial" && Number(existing.sent_count || 0) > 0) {
    return { sent: Number(existing.sent_count || 0), failed: Number(existing.failed_count || 0), duplicate: true, reason: "Partial sends are not retried automatically to avoid duplicate emails." };
  }

  let dispatchId: number | string;
  if (existing?.id) {
    if (existing.status !== "failed" || Number(existing.sent_count || 0) !== 0) {
      return { sent: Number(existing.sent_count || 0), failed: Number(existing.failed_count || 0), duplicate: true };
    }
    const { data: claimed, error: claimError } = await db.from("notification_event_dispatches")
      .update({ status: "sending", sender_user_id: actorId, sent_count: 0, failed_count: 0, completed_at: null })
      .eq("id", existing.id).eq("status", "failed").eq("sent_count", 0)
      .select("id").maybeSingle();
    if (claimError) throw claimError;
    if (!claimed) return { sent: 0, failed: 0, duplicate: true };
    dispatchId = claimed.id;
  } else {
    const { data: dispatch, error } = await db.from("notification_event_dispatches")
      .insert({ event_type: "chapter_release_email", event_id: chapter.id, sender_user_id: actorId, status: "sending" })
      .select("id").single();
    if (error) {
      if ((error as { code?: string }).code === "23505") return { sent: 0, failed: 0, duplicate: true };
      throw error;
    }
    dispatchId = dispatch.id;
  }

  try {
    const users: Array<{ id: string; email: string; email_confirmed_at?: string | null }> = [];
    for (let page = 1; page <= 20; page++) {
      const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 });
      if (error) throw error;
      for (const item of data.users || []) {
        if (item.id !== actorId && item.email && item.email_confirmed_at) users.push({ id: item.id, email: item.email, email_confirmed_at: item.email_confirmed_at });
      }
      if (!data.users?.length || data.users.length < 1000) break;
    }

    if (!users.length) {
      await db.from("notification_event_dispatches").update({ status: "skipped", sent_count: 0, failed_count: 0, completed_at: new Date().toISOString() }).eq("id", dispatchId);
      return { sent: 0, failed: 0, reason: "No confirmed reader email addresses." };
    }

    const marketingPreferences = new Map<string, { marketing_unsubscribed: boolean; unsubscribe_token: string }>();
    const marketingConsentUsers = new Set<string>();
    for (let i = 0; i < users.length; i += 500) {
      const ids = users.slice(i, i + 500).map(item => item.id);
      const { error: ensureError } = await db.from("email_marketing_preferences").upsert(ids.map(user_id => ({ user_id })), { onConflict: "user_id", ignoreDuplicates: true });
      if (ensureError) throw ensureError;
      const { data: marketingRows, error: marketingError } = await db.from("email_marketing_preferences").select("user_id,marketing_unsubscribed,unsubscribe_token").in("user_id", ids);
      if (marketingError) throw marketingError;
      for (const row of marketingRows || []) marketingPreferences.set(row.user_id, { marketing_unsubscribed: Boolean(row.marketing_unsubscribed), unsubscribe_token: String(row.unsubscribe_token || "") });
      const { data: consentRows, error: consentError } = await db.from("dpdp_consent_records")
        .select("user_id,purposes,withdrawn_at").in("user_id", ids);
      if (consentError) throw consentError;
      for (const row of consentRows || []) {
        if (!row.withdrawn_at && Array.isArray(row.purposes) &&
            (row.purposes.includes("atma_rekha_updates") || row.purposes.includes("chapter_announcements") || row.purposes.includes("marketing_email"))) {
          marketingConsentUsers.add(row.user_id);
        }
      }
    }
    // Chapter announcements follow the reader’s Atma Rekha updates preference and unsubscribe status.
    // Browser/push notification preferences are independent and must not block email.
    const recipients = users.filter(item =>
      marketingConsentUsers.has(item.id) &&
      marketingPreferences.get(item.id)?.marketing_unsubscribed !== true
    );
    if (!recipients.length) {
      await db.from("notification_event_dispatches").update({ status: "skipped", sent_count: 0, failed_count: 0, completed_at: new Date().toISOString() }).eq("id", dispatchId);
      return { sent: 0, failed: 0, reason: "All readers opted out of new-chapter notifications." };
    }

    const chapterNumber = chapter.chapter_number == null ? null : Number(chapter.chapter_number);
    const chapterLabel = chapterNumber == null ? "Special Chapter" : `Chapter ${chapterNumber}`;
    const chapterTitle = String(chapter.title || "").trim() || chapterLabel;
    const subject = "ATMA REKHA";
    // Keep this email visually unfilled: no body/table/background colors, only text and an outlined link.
    const chapterUrl = "https://www.atmarekha.in/";
    const safeLabel = escapeHtml(chapterLabel);
    const safeTitle = escapeHtml(chapterTitle);
    const safeUrl = escapeHtml(chapterUrl);
    const html = `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;padding:0;color:#222;font-family:Roboto,Arial,Helvetica,sans-serif;font-weight:500"><table role="presentation" width="100%" cellspacing="0" cellpadding="0" border="0"><tr><td align="center" style="padding:28px 18px"><table role="presentation" width="600" cellspacing="0" cellpadding="0" border="0" style="width:100%;max-width:600px"><tr><td style="padding:8px 0 22px;border-bottom:1px solid #ddd"><p style="margin:0;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:13px;line-height:1.5;font-weight:600;color:#222">ATMA REKHA</p></td></tr><tr><td style="padding:30px 0 18px"><p style="margin:0 0 12px;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6;font-weight:500;color:#222">Hey, hi, hello, namaste!</p><h1 style="margin:0 0 10px;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:27px;line-height:1.3;font-weight:600;color:#222">${safeLabel} is now out!</h1><h2 style="margin:0;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:20px;line-height:1.5;font-weight:500;color:#222">${safeTitle}</h2></td></tr><tr><td style="padding:0 0 26px;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.8;font-weight:500;color:#222"><p style="margin:0 0 14px">Whenever you get some free time, give it a read and leave a review in the comments. It would be a great help to me. I hope you enjoy it!</p></td></tr><tr><td style="padding:0 0 32px"><a href="${safeUrl}" style="display:inline-block;border:1px solid #222;border-radius:4px;color:#222;text-decoration:none;padding:11px 22px;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:14px;line-height:1.4;font-weight:600">Read ${escapeHtml(chapterLabel)} →</a></td></tr><tr><td style="border-top:1px solid #ddd;padding:20px 0 0"><p style="margin:0 0 4px;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;font-weight:600;color:#222">Thank you,</p><p style="margin:0;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:15px;line-height:1.5;font-weight:500;color:#222">Arkesh</p><p style="margin:16px 0 0;font-family:Roboto,Arial,Helvetica,sans-serif;font-size:12px;line-height:1.6;font-weight:500;color:#555">You are receiving this chapter announcement because Atma Rekha updates are enabled for your account. <a href="{{UNSUBSCRIBE_URL}}" style="color:#222;text-decoration:underline">Unsubscribe</a>.</p></td></tr></table></td></tr></table></body></html>`;
    const textBody = `Hey, hi, hello, namaste!\n\n${chapterLabel} is now out!\n\n${chapterTitle}\n\nWhenever you get some free time, give it a read and leave a review in the comments. It would be a great help to me. I hope you enjoy it!\n\nRead ${chapterLabel}: ${chapterUrl}\n\nThank you,\nArkesh`;

    let sent = 0;
    let failed = 0;
    const supabaseBaseUrl = (Deno.env.get("SUPABASE_URL") || "").replace(/\/$/, "");
    for (const recipient of recipients) {
      try {
        const token = marketingPreferences.get(recipient.id)?.unsubscribe_token;
        if (!token) throw new Error("Missing creator-email unsubscribe token.");
        const unsubscribeUrl = `${supabaseBaseUrl}/functions/v1/email-unsubscribe?token=${encodeURIComponent(token)}`;
        const recipientHtml = html.replaceAll("{{UNSUBSCRIBE_URL}}", escapeHtml(unsubscribeUrl));
        const recipientText = `${textBody}\n\nUnsubscribe from Atma Rekha updates: ${unsubscribeUrl}`;
        const result = await fetch("https://api.resend.com/emails", {
          method: "POST",
          headers: { Authorization: "Bearer " + resendKey, "Content-Type": "application/json", "Idempotency-Key": `atma-chapter-release-${chapter.id}-${recipient.id}` },
          body: JSON.stringify({
            from: "Atma Rekha <no-reply@atmarekha.in>",
            reply_to: ["atmarekhasupport@gmail.com"],
            to: [recipient.email],
            subject,
            html: recipientHtml,
            text: recipientText,
            headers: { "List-Unsubscribe": `<${unsubscribeUrl}>`, "List-Unsubscribe-Post": "List-Unsubscribe=One-Click" },
            tags: [{ name: "type", value: "chapter_release" }, { name: "chapter_id", value: chapter.id.slice(0, 256) }],
          }),
        });
        if (result.ok) sent++;
        else {
          failed++;
          console.error("Chapter release email rejected by Resend.", { status: result.status, chapterId: chapter.id });
        }
      } catch (error) {
        failed++;
        console.error("Chapter release email request failed.", { chapterId: chapter.id, error });
      }
    }

    await db.from("notification_event_dispatches").update({
      status: sent === recipients.length ? "sent" : sent > 0 ? "partial" : "failed",
      sent_count: sent,
      failed_count: failed,
      completed_at: new Date().toISOString(),
    }).eq("id", dispatchId);
    await db.from("admin_activity_log").insert({
      admin_user_id: actorId,
      action: "send_chapter_release_email",
      entity_type: "chapter",
      entity_id: chapter.id,
      details: { chapter_number: chapterNumber, title: chapterTitle, total: recipients.length, sent, failed },
    });
    return { sent, failed, total: recipients.length };
  } catch (error) {
    await db.from("notification_event_dispatches").update({ status: "failed", completed_at: new Date().toISOString() }).eq("id", dispatchId);
    throw error;
  }
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: headersFor(req) });
  if (req.method !== "POST") return respond(req, { ok: false, error: "Method not allowed." }, 405);
  let dispatchDb: ReturnType<typeof createClient> | null = null;
  let activeDispatchId: number | string | null = null;
  let sentDuringDispatch = 0;
  let failedDuringDispatch = 0;
  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const serviceKey = readSupabaseServiceRoleKey();
    const publicKey = Deno.env.get("VAPID_PUBLIC_KEY") || "";
    const privateKey = Deno.env.get("VAPID_PRIVATE_KEY") || "";
    if (!url || !serviceKey || !publicKey || !privateKey) return respond(req, { ok: false, error: "Notification service is not configured." }, 503);
    const token = (req.headers.get("Authorization") || "").replace(/^Bearer\s+/i, "").trim();
    if (!token) return respond(req, { ok: false, error: "Authentication required." }, 401);
    const db = createClient(url, serviceKey);
    dispatchDb = db;
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
    let emailResult: { sent: number; failed: number; total?: number; duplicate?: boolean; reason?: string; error?: string } = { sent: 0, failed: 0 };

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
      try {
        emailResult = await sendChapterReleaseEmail(db, chapter, user.id);
      } catch (emailError) {
        emailResult = { sent: 0, failed: 1, error: "Chapter email notification failed." };
        console.error("Chapter release email automation failed.", { chapterId: chapter.id, error: emailError });
      }
      const { data: subscriptions, error: subscriptionError } = await db.from("push_subscriptions").select("user_id").not("user_id", "is", null);
      if (subscriptionError) throw subscriptionError;
      recipientIds = [...new Set((subscriptions || []).map((row: { user_id: string | null }) => row.user_id).filter((id): id is string => Boolean(id)))];
      title = chapter.chapter_number ? `Atma Rekha Chapter ${chapter.chapter_number}` : String(chapter.title || "New chapter");
      message = String(chapter.title || "A new chapter is available.").slice(0, 140);
      targetUrl = chapter.chapter_number ? `/chapter/${encodeURIComponent(String(chapter.chapter_number))}` : "/chapters";
      adminOnly = true;
    }

    if (!recipientIds.length) return respond(req, { ok: true, sent: 0, reason: "No eligible push recipients.", emailSent: emailResult.sent, emailFailed: emailResult.failed, emailTotal: emailResult.total, emailError: emailResult.error });
    const uniqueIds = [...new Set(recipientIds)].filter(id => id !== user.id || eventType === "comments_replies");
    if (!uniqueIds.length) return respond(req, { ok: true, sent: 0, reason: "No eligible push recipients.", emailSent: emailResult.sent, emailFailed: emailResult.failed, emailTotal: emailResult.total, emailError: emailResult.error });
    const { data: insertedDispatch, error: dispatchError } = await db.from("notification_event_dispatches")
      .insert({ event_type: eventType, event_id: eventId, sender_user_id: user.id, status: "sending" })
      .select("id").single();
    activeDispatchId = insertedDispatch?.id ?? null;
    if (dispatchError) {
      if ((dispatchError as { code?: string }).code !== "23505") throw dispatchError;
      const { data: existingDispatch, error: existingDispatchError } = await db.from("notification_event_dispatches")
        .select("id,status,sent_count,failed_count")
        .eq("event_type", eventType).eq("event_id", eventId).maybeSingle();
      if (existingDispatchError) throw existingDispatchError;
      // Only failed attempts with zero successful sends are safe to retry automatically.
      // "sending", "sent", "skipped", and partial attempts remain deduplicated.
      if (!existingDispatch || existingDispatch.status !== "failed" || Number(existingDispatch.sent_count || 0) !== 0) {
        return respond(req, { ok: true, duplicate: true, sent: 0, emailSent: emailResult.sent, emailFailed: emailResult.failed, emailTotal: emailResult.total });
      }
      const { data: claimedDispatch, error: claimError } = await db.from("notification_event_dispatches")
        .update({ status: "sending", sender_user_id: user.id, sent_count: 0, failed_count: 0, completed_at: null })
        .eq("id", existingDispatch.id).eq("status", "failed").eq("sent_count", 0)
        .select("id").maybeSingle();
      if (claimError) throw claimError;
      if (!claimedDispatch) {
        return respond(req, { ok: true, duplicate: true, sent: 0, emailSent: emailResult.sent, emailFailed: emailResult.failed, emailTotal: emailResult.total });
      }
      activeDispatchId = claimedDispatch.id;
    }
    if (activeDispatchId == null) throw new Error("Notification dispatch did not return an ID.");
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
      await db.from("notification_event_dispatches").update({ status: "skipped", completed_at: new Date().toISOString() }).eq("id", activeDispatchId);
      return respond(req, { ok: true, sent: 0, reason: "Recipients have no active subscription or disabled this category.", emailSent: emailResult.sent, emailFailed: emailResult.failed, emailTotal: emailResult.total, emailError: emailResult.error });
    }
    webpush.setVapidDetails("mailto:atmarekhasupport@gmail.com", publicKey, privateKey);
    let sent = 0;
    let failed = 0;
    for (const subscription of eligible) {
      try {
        await webpush.sendNotification(
          { endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
          JSON.stringify({ title, body: message, icon: "/ishani.png", badge: "/ishani.png", url: targetUrl, tag: `atma-${category}-${eventId}`, renotify: false }),
        );
        sent++;
        sentDuringDispatch = sent;
      } catch (error) {
        failed++;
        failedDuringDispatch = failed;
        const code = (error as { statusCode?: number })?.statusCode;
        if (code === 404 || code === 410) await db.from("push_subscriptions").delete().eq("id", subscription.id);
      }
    }
    await db.from("notification_event_dispatches").update({ status: sent > 0 && failed === 0 ? "sent" : sent > 0 ? "partial" : "failed", sent_count: sent, failed_count: failed, completed_at: new Date().toISOString() }).eq("id", dispatch.id);
    if (adminOnly) await db.from("admin_activity_log").insert({ admin_user_id: user.id, action: "send_event_notification", entity_type: eventType, entity_id: eventId, details: { category, sent, failed, email_sent: emailResult.sent, email_failed: emailResult.failed, email_total: emailResult.total } });
    return respond(req, { ok: true, sent, failed, category, emailSent: emailResult.sent, emailFailed: emailResult.failed, emailTotal: emailResult.total, emailDuplicate: emailResult.duplicate, emailError: emailResult.error }, 200);
  } catch (error) {
    if (dispatchDb && activeDispatchId != null) {
      try {
        const { error: recoveryError } = await dispatchDb.from("notification_event_dispatches")
          .update({
            status: sentDuringDispatch > 0 ? "partial" : "failed",
            sent_count: sentDuringDispatch,
            failed_count: failedDuringDispatch,
            completed_at: new Date().toISOString(),
          })
          .eq("id", activeDispatchId).eq("status", "sending");
        if (recoveryError) console.error("Could not recover the failed notification dispatch state.", recoveryError.message);
      } catch (recoveryError) {
        console.error("Could not recover the failed notification dispatch state.", recoveryError instanceof Error ? recoveryError.message : "unknown error");
      }
    }
    console.error("Reader event notification failed.", error);
    return respond(req, { ok: false, error: "Could not send event notification." }, 500);
  }
});
