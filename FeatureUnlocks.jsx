import { useEffect, useState } from 'react';
import Membership from './Membership.jsx';
import GroupChat, { GroupChatLauncher } from './GroupChat.jsx';
import { supabase } from './supabase';

const DEFAULT_FLAGS = { membership_unlocked: false, group_chat_unlocked: false };

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
  if (!sessionData?.session?.user) return null;
  const { data, error } = await supabase.rpc('record_feature_login');
  if (error) {
    console.warn('Feature login tracking failed:', error);
    return null;
  }
  return data || null;
}

function GroupChatLauncherGate() {
  const [user, setUser] = useState(null);

  useEffect(() => {
    let active = true;
    const load = async () => {
      const { data } = await supabase.auth.getSession();
      if (active) setUser(data?.session?.user || null);
    };
    load();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      if (active) setUser(session?.user || null);
    });
    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  return <GroupChatLauncher user={user} />;
}

export default function FeatureUnlocks() {
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
    {flags.membership_unlocked && <Membership />}
    {flags.group_chat_unlocked && <GroupChatLauncherGate />}
    {flags.group_chat_unlocked && <GroupChat />}
  </>;
}
