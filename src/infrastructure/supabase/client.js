import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "../../config/publicEnv.js";

const supabaseUrl = publicEnv.supabaseUrl;
const supabaseKey = publicEnv.supabasePublishableKey;
const SUPABASE_REQUEST_TIMEOUT_MS = 15_000;

async function fetchWithTimeout(input, init = {}) {
  if (typeof AbortController === "undefined") return fetch(input, init);

  const controller = new AbortController();
  const parentSignal = init?.signal;
  let timedOut = false;
  const forwardAbort = () => controller.abort(parentSignal.reason);

  if (parentSignal) {
    if (parentSignal.aborted) controller.abort(parentSignal.reason);
    else parentSignal.addEventListener("abort", forwardAbort, { once: true });
  }

  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, SUPABASE_REQUEST_TIMEOUT_MS);

  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut) {
      const timeoutError = new Error(
        "Request timed out. Please check your connection and try again.",
      );
      timeoutError.name = "TimeoutError";
      timeoutError.cause = error;
      throw timeoutError;
    }
    throw error;
  } finally {
    clearTimeout(timer);
    parentSignal?.removeEventListener?.("abort", forwardAbort);
  }
}

if (!supabaseUrl || !supabaseKey) {
  console.warn(
    "Supabase environment variables are missing. Set VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.",
  );
}

const client = createClient(
  supabaseUrl || "https://placeholder.supabase.co",
  supabaseKey || "placeholder-key",
  {
    auth: {
      flowType: "pkce",
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
    global: { fetch: fetchWithTimeout },
  },
);

export { client, supabaseUrl, supabaseKey };
