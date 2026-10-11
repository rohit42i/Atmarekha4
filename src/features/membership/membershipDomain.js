/** @type {Record<string, number>} */
const PLAN_PRIORITY = Object.freeze({
  premium: 3,
  supporter: 2,
  mini_member: 1,
  free: 0,
});

/**
 * @typedef {{
 *   user_id?: unknown,
 *   plan_id?: unknown,
 *   status?: unknown,
 *   current_period_end?: unknown
 * }} SubscriptionRow
 * @typedef {{ chapterNumber?: unknown, chapter_number?: unknown }} AtmaChapterAccessModel
 */

/**
 * Determine the highest currently effective tier for each user.
 *
 * Prefer one row per user instead of sorting then overwriting a Map: the latter
 * allowed a lower-tier duplicate row to replace a higher-tier membership.
 *
 * @param {SubscriptionRow[] | null | undefined} rows
 * @param {number} [now]
 * @returns {Map<string, string>}
 */
export function selectEffectiveMemberships(rows = [], now = Date.now()) {
  /** @type {Map<string, { planId: string, status: string, end: number | null }>} */
  const selected = new Map();
  const list = Array.isArray(rows) ? rows : [];

  for (const row of list) {
    const userId = String(row?.user_id ?? "").trim();
    const planId = String(row?.plan_id ?? "")
      .trim()
      .toLowerCase();
    const status = String(row?.status ?? "")
      .trim()
      .toLowerCase();
    if (!userId || !planId) continue;

    const rawEnd = row?.current_period_end;
    const end = rawEnd ? new Date(String(rawEnd)).getTime() : null;
    const periodIsValid = end === null || Number.isFinite(end);
    if (!periodIsValid) continue;

    const isActive = status === "active" && (end === null || end > now);
    const isCancelledButPaid = status === "cancelled" && end !== null && end > now;
    if (!isActive && !isCancelledButPaid) continue;

    const existingPlan = selected.get(userId);
    const candidateRank = PLAN_PRIORITY[planId] ?? 0;
    const existingRank = PLAN_PRIORITY[existingPlan?.planId ?? ""] ?? -1;
    const candidateStatusRank = status === "active" ? 1 : 0;
    const existingStatusRank = existingPlan?.status === "active" ? 1 : 0;
    const candidateEnd = end ?? Number.POSITIVE_INFINITY;
    const existingEnd = existingPlan?.end ?? Number.NEGATIVE_INFINITY;

    const candidateWins =
      !existingPlan ||
      candidateRank > existingRank ||
      (candidateRank === existingRank && candidateStatusRank > existingStatusRank) ||
      (candidateRank === existingRank &&
        candidateStatusRank === existingStatusRank &&
        candidateEnd > existingEnd);

    if (candidateWins) {
      selected.set(userId, { planId, status, end });
    }
  }

  return new Map([...selected.entries()].map(([userId, row]) => [userId, row.planId]));
}

const ATMA_MEMBER_PLAN_IDS = new Set(["mini_member", "supporter", "premium"]);

/**
 * Chapter numbers through eight, special chapters, and malformed/missing
 * numbers retain their existing public access behavior.
 *
 * @param {AtmaChapterAccessModel | null | undefined} chapter
 */
export function requiresAtmaMembership(chapter) {
  const raw = chapter?.chapterNumber ?? chapter?.chapter_number;
  const number = raw === null || raw === undefined || raw === "" ? null : Number(raw);

  return number !== null && Number.isFinite(number) && number > 8;
}

/**
 * This is a client-side UI decision only. Protected rows and media must still
 * be guarded by server-side RLS/Worker authorization.
 *
 * @param {unknown} planId
 * @param {unknown} role
 */
export function hasAtmaMembershipAccess(planId, role) {
  const normalizedPlan = String(planId ?? "")
    .trim()
    .toLowerCase();
  const normalizedRole = String(role ?? "")
    .trim()
    .toLowerCase();

  return (
    ATMA_MEMBER_PLAN_IDS.has(normalizedPlan) ||
    normalizedRole === "owner" ||
    normalizedRole === "admin"
  );
}
