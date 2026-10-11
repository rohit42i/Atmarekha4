import { publicEnv } from "../../config/publicEnv.js";
import { toUserMessage } from "../errors/toUserMessage.js";

const REQUEST_TIMEOUT_MS = 15_000;
const DEFAULT_ERROR_MESSAGE = "Analytics service is temporarily unavailable.";

/**
 * Send requests only to the supported, versioned analytics API.
 * Keeping host selection and transport behavior here prevents feature services
 * from embedding URLs, timeouts, and response parsing in business logic.
 *
 * @param {string} path
 * @param {RequestInit} [options]
 * @returns {Promise<any>}
 */
export async function requestAnalytics(path, options = {}) {
  const route = String(path || "").trim();
  if (!route.startsWith("/v1/") || route.startsWith("//")) {
    throw new TypeError("Analytics requests must use a versioned /v1/ route.");
  }

  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(publicEnv.analyticsWorkerUrl + route, {
      ...options,
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(options.headers || {}),
      },
    });

    if (!response.ok) {
      let providerMessage = "";
      try {
        const payload = await response.json();
        providerMessage = typeof payload?.error === "string" ? payload.error : "";
      } catch {
        // Non-JSON worker errors are not safe to expose to readers.
      }

      const message = providerMessage
        ? toUserMessage(new Error(providerMessage), DEFAULT_ERROR_MESSAGE)
        : DEFAULT_ERROR_MESSAGE;
      const error = new Error(message);
      error.name = "AnalyticsRequestError";
      /** @type {Error & { status?: number }} */ (error).status = response.status;
      throw error;
    }

    return await response.json();
  } catch (error) {
    if (timedOut || /** @type {Error} */ (error)?.name === "AbortError") {
      throw new Error("Analytics request timed out. Please try again.");
    }

    if (error instanceof TypeError) {
      // A TypeError may be an invalid JSON response as well as a network error.
      if (String(error.message).toLowerCase().includes("fetch")) {
        throw new Error("Connection problem. Check your internet and try again.");
      }
    }

    throw error;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Fetch public chapter counters with a bounded, deduplicated identifier list.
 * The worker remains authoritative for public exposure and rate limiting.
 *
 * @param {unknown[]} chapterIds
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchAnalyticsViews(chapterIds = []) {
  const ids = [...new Set((Array.isArray(chapterIds) ? chapterIds : []).filter(Boolean))]
    .map(String)
    .filter((id) => id.length <= 128)
    .slice(0, 100);

  if (!ids.length) return {};

  return requestAnalytics(
    "/v1/views?chapterIds=" + encodeURIComponent(ids.join(",")),
  );
}

/**
 * Fetch analytics accessible only to a verified signed-in administrator.
 * The worker still verifies role/authorization; this client-side guard only
 * avoids sending anonymous requests accidentally.
 *
 * @param {unknown} days
 * @param {string} accessToken
 */
export async function fetchAdminAnalytics(days, accessToken) {
  const period = Number(days);
  if (![1, 7, 30, 90].includes(period)) {
    throw new Error("Analytics period must be 1, 7, 30 or 90 days.");
  }
  const token = String(accessToken || "").trim();
  if (!token) throw new Error("Admin session required.");

  return requestAnalytics("/v1/admin/analytics?days=" + period, {
    headers: { Authorization: "Bearer " + token },
  });
}
