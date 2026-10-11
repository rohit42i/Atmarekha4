/// <reference types="vite/client" />

/**
 * Only values intentionally exposed to the browser belong here.
 * Vite-prefixed variables are public at build time; never place secrets here.
 */
const viteEnvironment = import.meta.env || {};

/** @param {unknown} value */
const readPublicValue = (value) => String(value ?? "").trim();

/** @type {Readonly<{ siteUrl: string, supabaseUrl: string, supabasePublishableKey: string, mediaWorkerUrl: string, analyticsWorkerUrl: string }>} */
export const publicEnv = Object.freeze({
  siteUrl: readPublicValue(viteEnvironment.VITE_SITE_URL) || "https://www.atmarekha.in",
  supabaseUrl: readPublicValue(viteEnvironment.VITE_SUPABASE_URL).replace(/\/+$/, ""),
  supabasePublishableKey:
    readPublicValue(viteEnvironment.VITE_SUPABASE_PUBLISHABLE_KEY) ||
    readPublicValue(viteEnvironment.VITE_SUPABASE_ANON_KEY),
  mediaWorkerUrl:
    readPublicValue(viteEnvironment.VITE_MEDIA_WORKER_URL) ||
    "https://tiny-pond-c959.rohitbaswaraj.workers.dev",
  analyticsWorkerUrl:
    readPublicValue(viteEnvironment.VITE_ANALYTICS_WORKER_URL) ||
    "https://atma-rekha-analytics.rohitbaswaraj.workers.dev",
});

export function getMissingPublicEnvironment(config = publicEnv) {
  const missing = [];
  if (!config.supabaseUrl) missing.push("VITE_SUPABASE_URL");
  if (!config.supabasePublishableKey) {
    missing.push("VITE_SUPABASE_PUBLISHABLE_KEY");
  }
  return missing;
}

export const isSupabasePublicConfigReady = getMissingPublicEnvironment().length === 0;
