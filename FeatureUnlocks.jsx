import { useEffect, useState } from 'react';
import Membership from './Membership.jsx';
import GroupChat from './GroupChat.jsx';
import { supabase } from './supabase';

const DEFAULT_FLAGS = { membership_unlocked: false, group_chat_unlocked: false };

// Public visibility is manually enabled.
const MANUAL_FEATURE_VISIBILITY = {
  membership: true,
  group_chat: true,
};

async function readFeatureFlags() {
  const { data, error } = await supabase
    .from('feature_unlock_config')
    .select('membership_unlocked,group_chat_unlocked')
    .eq('id', true)
    .maybeSingle();
  if (error || !data) return DEFAULT_FLAGS;
  return {
    membership_unlocked: data.membership_unlocked === true,
    group_chat_unlocked: data.group_chat_unlocked === true,
  };
}

async function recordLoginOncePerUser() {
  const { data: sessionData } = await supabase.auth.getSession();
  const user = sessionData?.session?.user;
  if (!user) return null;

  // The table intentionally denies direct client writes. Use the existing
  // SECURITY DEFINER RPC so the server can atomically count this login while
  // keeping feature_login_users protected by RLS.
  const { data, error } = await supabase.rpc('record_feature_login');
  if (error) {
    console.warn('Feature login tracking failed:', error);
    return null;
  }

  if (!data) return await readFeatureFlags();
  return {
    membership_unlocked: data.membership_unlocked === true,
    group_chat_unlocked: data.group_chat_unlocked === true,
  };
}
\nexport default function FeatureUnlocks() {
  const [flags, setFlags] = useState(DEFAULT_FLAGS);

  useEffect(() => {
    let active = true;

    const refresh = async () => {
      const tracked = await recordLoginOncePerUser();
      if (!active) return;

      if (tracked) {
        setFlags({
          membership_unlocked: tracked.membership_unlocked === true,
          group_chat_unlocked: tracked.group_chat_unlocked === true,
        });
        return;
      }

      const next = await readFeatureFlags();
      if (active) setFlags(next);
    };

    refresh();

    const { data: listener } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (!active) return;
      if (event === 'SIGNED_IN' && session?.user) {
        const tracked = await recordLoginOncePerUser();
        if (!active) return;
        if (tracked) {
          setFlags({
            membership_unlocked: tracked.membership_unlocked === true,
            group_chat_unlocked: tracked.group_chat_unlocked === true,
          });
          return;
        }
      }
      const next = await readFeatureFlags();
      if (active) setFlags(next);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <>
    {MANUAL_FEATURE_VISIBILITY.membership && <Membership />}
    {MANUAL_FEATURE_VISIBILITY.group_chat && <GroupChat />}
  </>;
}
