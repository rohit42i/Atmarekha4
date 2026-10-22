import { Webhook } from "npm:svix@1.76.1";
import { createClient } from "npm:@supabase/supabase-js@2";

const json = (body: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json", "Cache-Control": "no-store" } });

async function readLimitedBody(req: Request, maxBytes: number): Promise<string | null> {
  const declared = Number(req.headers.get("content-length") || 0);
  if (Number.isFinite(declared) && declared > maxBytes) return null;
  if (!req.body) return "";
  const reader = req.body.getReader(); const chunks: Uint8Array[] = []; let total = 0;
  while (true) { const { done, value } = await reader.read(); if (done) break; total += value.byteLength; if (total > maxBytes) { try { await reader.cancel(); } catch {} return null; } chunks.push(value); }
  const bytes = new Uint8Array(total); let offset = 0; for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength; }
  return new TextDecoder().decode(bytes);
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
  if (req.method !== "POST") return json({ ok: false, error: "Method not allowed." }, 405);
  const secret = Deno.env.get("RESEND_WEBHOOK_SECRET") || "";
  const url = Deno.env.get("SUPABASE_URL") || "";
  const serviceKey = readSupabaseServiceRoleKey();
  if (!secret || !url || !serviceKey) return json({ ok: false, error: "Webhook service is not configured." }, 503);

  try {
    const raw = await readLimitedBody(req, 1024 * 1024);
    if (raw === null) return json({ ok: false, error: "Payload too large." }, 413);
    const headers = {
      "svix-id": req.headers.get("svix-id") || "",
      "svix-timestamp": req.headers.get("svix-timestamp") || "",
      "svix-signature": req.headers.get("svix-signature") || "",
    };
    const event = new Webhook(secret).verify(raw, headers) as Record<string, any>;
    const eventId = String(headers["svix-id"] || "").trim();
    const eventType = String(event.type || "").trim();
    const data = event.data && typeof event.data === "object" ? event.data : {};
    if (!eventId || !eventType) return json({ ok: false, error: "Invalid event payload." }, 422);
    const emailId = String(data.email_id || data.id || "").trim() || null;
    const recipients = Array.isArray(data.to) ? data.to : [data.to || data.email || null];
    const recipient = recipients.map((value: unknown) => String(value || "").trim()).find(Boolean) || null;
    const details = {
      bounce: data.bounce || null,
      reason: data.reason || null,
      tags: data.tags || null,
      link: data.link || null,
      click: data.click || null,
    };
    const db = createClient(url, serviceKey);
    const { error } = await db.from("email_delivery_events").upsert({
      event_id: eventId,
      email_id: emailId,
      event_type: eventType,
      recipient,
      subject: String(data.subject || "").slice(0, 200) || null,
      occurred_at: event.created_at || new Date().toISOString(),
      details,
    }, { onConflict: "event_id", ignoreDuplicates: true });
    if (error) throw error;
    return json({ ok: true });
  } catch (error) {
    console.error("Resend webhook event rejected or failed.", error);
    return json({ ok: false, error: "Invalid webhook signature or event could not be recorded." }, 400);
  }
});
