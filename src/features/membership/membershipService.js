import { client } from "../../infrastructure/supabase/client.js";
import { selectEffectiveMemberships } from "./membershipDomain.js";

const MEMBERSHIP_QUERY_LIMIT = 500;
const PUBLIC_BADGE_PLANS = new Set(["mini_member", "supporter", "premium"]);

/**
 * Read display badges for reader lists. Returned data is limited to the
 * database rows visible to the current client and does not grant access.
 *
 * @param {unknown[]} userIds
 */
export async function getPublicReaderTiers(userIds = []) {
  const ids = [
    ...new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean)),
  ]
    .map(String)
    .slice(0, 50);

  if (!ids.length) return new Map();

  const { data, error } = await client
    .from("profiles")
    .select("id,public_badge")
    .in("id", ids);
  if (error) throw error;

  return new Map(
    (data || [])
      .filter(
        (row) => row?.id && PUBLIC_BADGE_PLANS.has(String(row.public_badge)),
      )
      .map((row) => [row.id, row.public_badge]),
  );
}

/**
 * Reads only rows allowed by user_subscriptions RLS; no privileged RPC is used.
 *
 * @param {unknown[]} userIds
 */
export async function getCurrentMemberships(userIds = []) {
  const ids = [
    ...new Set((Array.isArray(userIds) ? userIds : []).filter(Boolean)),
  ]
    .map(String)
    .slice(0, MEMBERSHIP_QUERY_LIMIT);

  if (!ids.length) return new Map();

  const { data, error } = await client
    .from("user_subscriptions")
    .select("user_id,plan_id,status,current_period_end")
    .in("user_id", ids)
    .in("status", ["active", "cancelled"]);

  if (error) throw error;
  return selectEffectiveMemberships(data || []);
}

/** @param {string | null | undefined} userId */
export async function getCurrentMembership(userId) {
  if (!userId) return null;
  return (await getCurrentMemberships([userId])).get(userId) || null;
}

/** @param {unknown[]} userIds */
export async function getCurrentlySubscribedUserIds(userIds = []) {
  return new Set((await getCurrentMemberships(userIds)).keys());
}

/** @param {string | null | undefined} userId */
export async function isCurrentlySubscribed(userId) {
  return Boolean(await getCurrentMembership(userId));
}
