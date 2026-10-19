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

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL")?.trim() || "";
    const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")?.trim() || "";
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

    if (adminError || !adminRow || !["owner", "admin"].includes(String(adminRow.role))) {
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
    if (!["analytics", "membership", "users", "send-verification"].includes(action)) {
      return json({ error: "Unknown admin data action." }, 400, origin);
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

    if (action === "send-verification") {
      const targetId = String(body.user_id || "").trim();
      if (!targetId || targetId.length > 100) return json({ error: "A valid user ID is required." }, 400, origin);
      const resendKey = Deno.env.get("RESEND_API_KEY")?.trim() || "";
      const fromEmail = Deno.env.get("RESEND_FROM_EMAIL")?.trim() || "";
      if (!resendKey || !fromEmail) return json({ error: "Email delivery is not configured. Add RESEND_API_KEY and RESEND_FROM_EMAIL to the function secrets." }, 503, origin);
      const { data: targetResult, error: targetError } = await admin.auth.admin.getUserById(targetId);
      if (targetError || !targetResult?.user) return json({ error: "Reader account not found." }, 404, origin);
      const target = targetResult.user;
      if (!target.email) return json({ error: "This account has no email address." }, 400, origin);
      if (target.email_confirmed_at) return json({ error: "This email is already verified." }, 409, origin);
      const { data: linkData, error: linkError } = await admin.auth.admin.generateLink({ type: "signup", email: target.email });
      if (linkError || !linkData?.properties?.action_link) {
        console.error("Verification link generation failed:", linkError?.message || "missing link");
        return json({ error: "Could not create a verification link. Please try again." }, 502, origin);
      }
      const actionLink = linkData.properties.action_link;
      const html = `<!doctype html><html><body style="margin:0;background:#f5f5f5;font-family:Arial,sans-serif;color:#171717"><div style="max-width:560px;margin:32px auto;padding:28px;background:#fff;border:1px solid #e5e5e5;border-radius:10px"><h1 style="font-size:22px;margin:0 0 14px">Verify your Atma Rekha account</h1><p style="font-size:15px;line-height:1.6">Please confirm your email address to finish setting up your Atma Rekha account.</p><p style="margin:24px 0"><a href="${actionLink}" style="display:inline-block;padding:12px 18px;background:#3255c6;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold">Verify email</a></p><p style="font-size:12px;line-height:1.6;color:#666">If you did not create this account, you can ignore this email.</p><p style="font-size:12px;color:#777">Atma Rekha</p></div></body></html>`;
      const mailResponse = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: { "Authorization": `Bearer ${resendKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({ from: fromEmail, to: [target.email], subject: "Verify your Atma Rekha account", html }),
      });
      if (!mailResponse.ok) {
        console.error("Verification email delivery failed:", mailResponse.status);
        return json({ error: "The verification email could not be sent. Check the Resend sender and domain configuration." }, 502, origin);
      }
      try {
        await admin.from("admin_activity_log").insert({
          admin_user_id: user.id, action: "send_verification_email", entity_type: "user", entity_id: target.id,
          details: { recipient: target.email, provider: "resend" },
        });
      } catch {}
      return json({ ok: true, email: target.email }, 200, origin);
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
