import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in", "https://atmarekha.in", "http://localhost:5173"]);
function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Cache-Control": "no-store",
  };
}
function json(body: Record<string, unknown>, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), { status, headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8" } });
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
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);
  const declaredLength = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declaredLength) && declaredLength > 1024) return json({ error: "Request body is too large." }, 413, origin);

  const authHeader = req.headers.get("Authorization");
  if (!authHeader) return json({ error: "Authentication required." }, 401, origin);
  const supabaseUrl = Deno.env.get("SUPABASE_URL")?.trim() || "";
  const serviceRoleKey = readSupabaseServiceRoleKey();
  if (!supabaseUrl || !serviceRoleKey) return json({ error: "Account deletion is temporarily unavailable." }, 503, origin);

  try {
    const userClient = createClient(supabaseUrl, serviceRoleKey, { global: { headers: { Authorization: authHeader } } });
    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) return json({ error: "Authentication failed." }, 401, origin);

    const adminClient = createClient(supabaseUrl, serviceRoleKey);
    const { data: rateAllowed, error: rateError } = await adminClient.rpc("consume_rate_limit", {
      p_rate_key: "delete-account:" + user.id,
      p_limit: 3,
      p_window_seconds: 3600,
    });
    if (rateError) {
      console.error("Account-deletion rate-limit check failed.");
      return json({ error: "Account deletion is temporarily unavailable." }, 503, origin);
    }
    if (rateAllowed === false) return json({ error: "Too many deletion attempts. Please try again later." }, 429, origin);

    // Never hard-delete an account from this endpoint. Immediate auth deletion
    // cascades into payment/subscription records and can erase records that must
    // be retained for accounting, disputes, or fraud prevention. Queue the
    // request for verified, cross-system erasure through the Privacy Center.
    const { data: existing, error: existingError } = await adminClient
      .from("dpdp_deletion_requests")
      .select("id,status,requested_at")
      .eq("user_id", user.id)
      .in("status", ["pending", "processing"])
      .order("requested_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingError) {
      console.error("Account deletion request lookup failed.");
      return json({ error: "Account deletion is temporarily unavailable." }, 503, origin);
    }
    if (existing) return json({ success: true, request: existing, queued: true }, 200, origin);
    const { data: request, error: requestError } = await adminClient
      .from("dpdp_deletion_requests")
      .insert({ user_id: user.id, reason: "Account deletion requested" })
      .select("id,status,requested_at")
      .single();
    if (requestError) {
      console.error("Account deletion request could not be queued.");
      return json({ error: "Unable to submit your deletion request right now." }, 500, origin);
    }
    return json({ success: true, request, queued: true }, 202, origin);
  } catch (error) {
    console.error("Account deletion request failed:", error instanceof Error ? error.message : "unknown error");
    return json({ error: "Unable to delete your account right now." }, 500, origin);
  }
});
