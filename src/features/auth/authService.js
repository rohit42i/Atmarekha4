import {
  client,
  supabaseUrl,
  supabaseKey,
} from "../../infrastructure/supabase/client.js";

/**
 * Preserve auth codes alongside a short UI-safe message so login screens can
 * distinguish a locked account from ordinary invalid credentials.
 *
 * @param {string} message
 * @param {string} code
 * @param {number} status
 * @param {string | null} [lockedUntil]
 */
function createAuthError(message, code, status, lockedUntil = null) {
  return Object.assign(new Error(message), { code, status, lockedUntil });
}

/** @param {unknown} email @param {unknown} password */
export async function secureSignInWithPassword(email, password) {
  const normalizedEmail = String(email ?? "").trim();
  const value = String(password ?? "");

  if (!normalizedEmail || !value) {
    throw createAuthError("Invalid email or password.", "INVALID_LOGIN", 401);
  }
  if (!supabaseUrl || !supabaseKey) {
    throw new Error("Sign-in service is temporarily unavailable.");
  }

  const { data, error } = await client.functions.invoke("secure-password-login", {
    body: { email: normalizedEmail, password: value },
  });

  if (error) {
    let payload = null;
    try {
      if (error.context?.clone) {
        payload = await error.context.clone().json();
      } else if (typeof error.context?.json === "function") {
        payload = await error.context.json();
      }
    } catch {
      // Some Functions errors have no JSON response body.
    }

    const providerMessage =
      payload?.error ||
      (error.message === "Failed to send a request to the Edge Function"
        ? "Sign-in service is temporarily unavailable."
        : error.message);
    const code = String(payload?.code || "INVALID_LOGIN");
    const status = code === "ACCOUNT_LOCKED" ? 429 : Number(error.status || 401);

    throw createAuthError(
      providerMessage || "Invalid email or password.",
      code,
      status,
      payload?.locked_until ? String(payload.locked_until) : null,
    );
  }

  if (!data?.ok || !data?.session?.access_token || !data?.session?.refresh_token) {
    const code = String(data?.code || "INVALID_LOGIN");
    throw createAuthError(
      data?.error || "Invalid email or password.",
      code,
      code === "ACCOUNT_LOCKED" ? 429 : 401,
      data?.locked_until ? String(data.locked_until) : null,
    );
  }

  const { data: sessionData, error: sessionError } = await client.auth.setSession({
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
  if (sessionError) throw sessionError;

  return { data: sessionData, error: null };
}
