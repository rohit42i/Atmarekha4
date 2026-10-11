const STORAGE_KEY = "atma-rekha-marketing-attribution-v1";
import {
  extractUtmParameters,
  mergeAttribution,
} from "./attributionDomain.js";

function readStored() {
  if (typeof window === "undefined") return null;

  try {
    const value = JSON.parse(window.localStorage.getItem(STORAGE_KEY) || "null");
    return value && typeof value === "object" && !Array.isArray(value)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function captureMarketingAttribution() {
  if (typeof window === "undefined") return null;

  let url;
  try {
    url = new URL(window.location.href);
  } catch {
    return readStored();
  }

  const current = extractUtmParameters(url.searchParams);
  if (!Object.keys(current).length) return readStored();

  const previous = readStored() || {};
  const next = mergeAttribution(previous, current);

  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    // Storage can be disabled. Attribution should never block reading manga.
  }

  return next;
}

export function getMarketingAttribution() {
  return readStored();
}
