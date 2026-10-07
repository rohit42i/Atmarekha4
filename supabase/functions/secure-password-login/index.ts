import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const SITE_ORIGINS = new Set([
  "https://www.atmarekha.in",
  "https://atmarekha.in",
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

function keyFromEnv(jsonName: string, legacyName: string) {
  const json = Deno.env.get(jsonName);
  if (json) {
    try {
      const parsed = JSON.parse(json);
      if (parsed?.default) return String(parsed.default);
    } catch (_) {}
  }
  return Deno.env.get(legacyName) || "";
}

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") || "";
  const allowOrigin = SITE_ORIGINS.has(origin) ? origin : "https://www.atmarekha.in";
  return {
    "Access-Control-Allow-Origin": allowOrigin,
    "Access-Control-Allow-Headers": "apikey, authorization, x-client-info, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Vary": "Origin",
    "Content-Type": "application/json",
    "Cache-Control": "no-store",
  };
}

function response(req: Request, body: Record<string, unknown>, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: corsHeaders(req) });
}

function normalizedEmail(value: unknown) {
  return String(value || "").trim().toLowerCase();
}

function validEmail(email: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/i.test(email);
}

function istTimeString(date = new Date()) {
  return new Intl.DateTimeFormat("en-IN", {
    timeZone: "Asia/Kolkata",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

async function sendSecurityAlert(resendKey: string, to: string, lockedUntil: string) {
  const subject = "Security alert: Atma Rekha sign-in blocked";
  const checkedAt = istTimeString();
  const unlockAt = istTimeString(new Date(lockedUntil));
  const html = [
    "<div style=\"font-family:Arial,sans-serif;line-height:1.6;color:#111;max-width:620px;margin:auto\">",
    "<h2 style=\"margin:0 0 16px\">Atma Rekha security alert</h2>",
    "<p>We detected 5 unsuccessful password sign-in attempts on your Atma Rekha account.</p>",
    "<p><strong>Your account is temporarily locked for 24 hours.</strong></p>",
    "<p>Attempt window: " + checkedAt + " IST<br>Automatic unlock: " + unlockAt + " IST</p>",
    "<p>If this was you, you can sign in again after the lock expires. If it was not you, change your password and enable Two-step verification as soon as you regain access.</p>",
    "<p style=\"color:#666;font-size:13px\">Atma Rekha — an original Indian fantasy adventure manga.</p>",
    "</div>",
  ].join("");

  const result = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + resendKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from: "Atma Rekha <atmarekhaoffical@gmail.com>",
      to: [to],
      subject,
      html,
    }),
  });

  if (!result.ok) {
    const body = await result.text().catch(() => "");
    throw new Error("Resend security alert failed: " + body.slice(0, 300));
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method === "GET") return response(req, { ok: true, service: "secure-password-login" });
  if (req.method !== "POST") return response(req, { ok: false, error: "Method not allowed." }, 405);

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") || "";
    const publishableKey = keyFromEnv("SUPABASE_PUBLISHABLE_KEYS", "SUPABASE_ANON_KEY");
    const secretKey = keyFromEnv("SUPABASE_SECRET_KEYS", "SUPABASE_SERVICE_ROLE_KEY");
    const resendKey = Deno.env.get("RESEND_API_KEY") || "";

    if (!supabaseUrl || !publishableKey || !secretKey) {
      console.error("Secure login server configuration is incomplete.");
      return response(req, { ok: false, error: "Sign-in service is temporarily unavailable." }, 503);
    }
    if (!resendKey) {
      console.error("RESEND_API_KEY is not configured.");
    }

    const body = await req.json().catch(() => ({}));
    const email = normalizedEmail(body.email);
    const password = String(body.password || "");

    if (!validEmail(email) || !password || password.length > 1024) {
      return response(req, { ok: false, error: "Invalid email or password.", code: "INVALID_LOGIN" }, 401);
    }

    const admin = createClient(supabaseUrl, secretKey, {
      auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    });

    const { data: stateRows, error: stateError } = await admin.rpc("prepare_password_login", { p_email: email });
    if (stateError) {
      console.error("Password protection precheck failed:", stateError);
      return response(req, { ok: false, error: "Sign-in service is temporarily unavailable." }, 503);
    }

    const state = Array.isArray(stateRows) ? stateRows[0] : null;
    if (state?.locked_until) {
      const lockedUntilMs = new Date(state.locked_until).getTime();
      if (Number.isFinite(lockedUntilMs) && lockedUntilMs > Date.now()) {
        return response(
          req,
          {
            ok: false,
            error: "Too many failed sign-in attempts. Your account is locked for 24 hours.",
            code: "ACCOUNT_LOCKED",
            locked_until: new Date(lockedUntilMs).toISOString(),
          },
          429,
        );
      }
    }

    const authResponse = await fetch(
      `${supabaseUrl}/auth/v1/token?grant_type=password`,
      {
        method: "POST",
        headers: {
          apikey: publishableKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email, password }),
      },
    );

    let authData: any = null;
    let authError: any = null;
    if (authResponse.ok) {
      authData = await authResponse.json().catch(() => null);
      if (!authData?.access_token || !authData?.refresh_token || !authData?.user) {
        authError = { message: "Authentication returned an invalid session." };
      }
    } else {
      const authBody = await authResponse.json().catch(() => ({}));
      authError = {
        message: String(authBody?.msg || authBody?.message || "Invalid email or password."),
        status: authResponse.status,
      };
    }

    if (authError) {
      if (state?.user_id && state?.email_confirmed && state?.has_password && !state?.mfa_enabled) {
        const { data: failureRows, error: failureError } = await admin.rpc(
          "record_password_login_failure",
          { p_user_id: state.user_id },
        );

        if (failureError) {
          console.error("Password failure recording failed:", failureError);
        } else {
          const failure = Array.isArray(failureRows) ? failureRows[0] : null;
          if (failure?.locked_until && new Date(failure.locked_until).getTime() > Date.now()) {
            const banUntil = new Date(failure.locked_until).toISOString();
            try {
              const { error: banError } = await admin.auth.admin.updateUserById(state.user_id, {
                ban_duration: "24h",
              });
              if (banError) console.error("Native Supabase account ban failed:", banError);
            } catch (banError) {
              console.error("Native Supabase account ban failed:", banError);
            }

            if (failure?.should_alert && resendKey) {
              try {
                await sendSecurityAlert(resendKey, state.email || email, failure.locked_until);
              } catch (emailError) {
                console.error(emailError);
              }
            }
            return response(
              req,
              {
                ok: false,
                error: "Too many failed sign-in attempts. Your account is locked for 24 hours.",
                code: "ACCOUNT_LOCKED",
                locked_until: banUntil,
              },
              429,
            );
          }
        }
      }

      return response(req, { ok: false, error: "Invalid email or password.", code: "INVALID_LOGIN" }, 401);
    }

    const userId = authData.user?.id;
    if (userId) {
      const { error: resetError } = await admin.rpc("reset_password_login_protection", { p_user_id: userId });
      if (resetError) console.error("Password protection reset failed:", resetError);
    }

    const { access_token, refresh_token, expires_in, expires_at, token_type, user } = authData;
    return response(req, {
      ok: true,
      user,
      session: { access_token, refresh_token, expires_in, expires_at, token_type, user },
    });
  } catch (error) {
    console.error("Secure login failed:", error);
    return response(req, { ok: false, error: "Sign-in service is temporarily unavailable." }, 500);
  }
});