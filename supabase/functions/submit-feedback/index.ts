import "jsr:@supabase/functions-js/edge-runtime.d.ts";

async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get('content-length') || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return '';
  const reader = req.body.getReader();
  const chunks: Uint8Array[] = [];
  let total = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    total += value.byteLength;
    if (total > maxBytes) {
      try { await reader.cancel(); } catch {}
      return null;
    }
    chunks.push(value);
  }
  const bytes = new Uint8Array(total);
  let offset = 0;
  for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
}

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const ALLOWED_ORIGINS = new Set(["https://www.atmarekha.in","https://atmarekha.in","http://localhost:5173"]);

function cors(origin: string | null) {
  return {
    "Access-Control-Allow-Origin": origin && ALLOWED_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, origin: string | null) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" },
  });
}

async function hash(value: string) {
  const bytes = new TextEncoder().encode(value);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2,"0")).join("");
}

function cleanText(value: unknown, max: number) {
  return String(value ?? "").replace(/\s+/g, " ").trim().slice(0, max);
}

Deno.serve(async req => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Method not allowed." }, 405, origin);

  try {
    const url = Deno.env.get("SUPABASE_URL") || "";
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
    if (!url || !key) return json({ error: "Server configuration is missing." }, 500, origin);

    const admin = createClient(url, key);
    const authHeader = req.headers.get("Authorization") || "";
    let userId: string | null = null;
    if (authHeader.startsWith("Bearer ")) {
      const { data } = await admin.auth.getUser(authHeader.slice(7).trim());
      userId = data.user?.id || null;
    }

    const rawBody = await readLimitedBody(req, 12 * 1024);
    if (rawBody === null) return json({ error: "Request body is too large." }, 413, origin);
    let body: any;
    try { body = JSON.parse(rawBody); } catch { return json({ error: "Invalid JSON body." }, 400, origin); }
    if (!body || typeof body !== "object" || Array.isArray(body)) return json({ error: "Invalid request body." }, 400, origin);
    const website = cleanText(body?.website, 100);
    if (website) return json({ ok: true }, 200, origin);

    const email = cleanText(body?.email, 254).toLowerCase();
    const name = cleanText(body?.name, 80);
    const message = cleanText(body?.message, 2000);
    const type = ["feedback","content-report","privacy","other"].includes(body?.type) ? body.type : "feedback";
    if (!/^\S+@\S+\.\S+$/.test(email)) return json({ error: "Enter a valid email address." }, 400, origin);
    if (!message) return json({ error: "Write a message first." }, 400, origin);

    const ip = req.headers.get("CF-Connecting-IP") || req.headers.get("X-Forwarded-For")?.split(",")[0]?.trim() || "unknown";
    const rateKey = await hash(ip + "|" + email);
    const { data: allowed, error: rateError } = await admin.rpc("check_feedback_rate_limit", { p_key: rateKey, p_limit: 5 });
    if (rateError) throw rateError;
    if (allowed === false) return json({ error: "Too many messages. Please try again later." }, 429, origin);

    const { error } = await admin.from("site_feedback").insert({
      user_id: userId,
      email,
      name: name || null,
      message,
      type,
      user_agent: cleanText(req.headers.get("User-Agent"), 500) || null,
    });
    if (error) throw error;
    return json({ ok: true }, 200, origin);
  } catch (error) {
    console.error("Feedback submission failed:", error);
    return json({ error: "Something went wrong, please try again." }, 500, origin);
  }
});
