const UTM_KEYS = [
  "utm_source",
  "utm_medium",
  "utm_campaign",
  "utm_term",
  "utm_content",
];

/**
 * Extract only the known UTM keys; arbitrary query parameters are not persisted.
 * @param {URLSearchParams} searchParams
 * @returns {Record<string, string>}
 */
export function extractUtmParameters(searchParams) {
  return Object.fromEntries(
    UTM_KEYS.map((key) => [
      key,
      String(searchParams.get(key) || "")
        .trim()
        .slice(0, 200),
    ]).filter(([, value]) => value),
  );
}

/**
 * Keep the first recorded touch stable while allowing last-touch attribution
 * to change when a reader arrives through a later campaign.
 *
 * @param {Record<string, any>} previous
 * @param {Record<string, string>} current
 * @param {Date} [now]
 */
export function mergeAttribution(previous, current, now = new Date()) {
  const existingFirstTouch =
    previous.first_touch &&
    typeof previous.first_touch === "object" &&
    !Array.isArray(previous.first_touch)
      ? previous.first_touch
      : null;

  return {
    first_touch: existingFirstTouch || { ...current },
    last_touch: { ...current },
    captured_at:
      typeof previous.captured_at === "string" && previous.captured_at
        ? previous.captured_at
        : now.toISOString(),
  };
}
