import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';

const DAY = 24 * 60 * 60 * 1000;

export default function AdminModerationTools() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [open, setOpen] = useState(false);
  const [reports, setReports] = useState([]);
  const [users, setUsers] = useState([]);
  const [profiles, setProfiles] = useState({});
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(null);

  useEffect(() => {
    let alive = true;
    const check = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!alive) return;
      if (!user) { setIsAdmin(false); return; }
      const role = await getAdminRole(user.id);
      if (alive) setIsAdmin(role === 'owner' || role === 'admin');
    };
    check();
    const { data: listener } = supabase.auth.onAuthStateChange(() => check());
    return () => { alive = false; listener?.subscription?.unsubscribe(); };
  }, []);

  const load = async () => {
    if (!isAdmin) return;
    setLoading(true); setNotice('');
    try {
      const [{ data: reportRows, error: reportError }, { data: userRows, error: userError }] = await Promise.all([
        supabase.from('moderation_reports').select('id,user_id,source_type,source_id,reason,offense_count,status,created_at').order('created_at', { ascending: false }).limit(100),
        supabase.from('user_moderation').select('user_id,offense_count,recent_offense_count,recent_window_start,flag_color,flagged_until,auto_reported_at,comment_banned_until,group_banned_until,updated_at').order('updated_at', { ascending: false }).limit(150),
      ]);
      if (reportError) throw reportError;
      if (userError) throw userError;
      const nextUsers = userRows || [];
      setReports(reportRows || []);
      setUsers(nextUsers);
      const ids = [...new Set([...nextUsers.map(row => row.user_id), ...(reportRows || []).map(row => row.user_id)].filter(Boolean))];
      if (ids.length) {
        const { data: rows, error } = await supabase.from('profiles').select('id,username,display_name,avatar_url').in('id', ids);
        if (error) throw error;
        setProfiles(Object.fromEntries((rows || []).map(row => [row.id, row])));
      } else setProfiles({});
    } catch (error) {
      setNotice(error?.message || 'Unable to load moderation data.');
    } finally { setLoading(false); }
  };

  useEffect(() => { if (open) load(); }, [open, isAdmin]);

  const filteredUsers = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return users;
    return users.filter(row => {
      const p = profiles[row.user_id];
      return `${row.user_id} ${p?.username || ''} ${p?.display_name || ''}`.toLowerCase().includes(q);
    });
  }, [users, profiles, search]);

  const setBan = async (userId, type, enabled) => {
    if (busy) return;
    setBusy(`${type}:${userId}`); setNotice('');
    try {
      const patch = { updated_at: new Date().toISOString() };
      patch[type === 'group' ? 'group_banned_until' : 'comment_banned_until'] = enabled ? new Date(Date.now() + DAY).toISOString() : null;
      const { error } = await supabase.from('user_moderation').update(patch).eq('user_id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(row => row.user_id === userId ? { ...row, ...patch } : row));
      setNotice(enabled ? `${type === 'group' ? 'Group chat' : 'Comments'} banned for 24 hours.` : 'Ban removed.');
    } catch (error) { setNotice(error?.message || 'Unable to change the ban.'); }
    finally { setBusy(null); }
  };

  const reviewReport = async report => {