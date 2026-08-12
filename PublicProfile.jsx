import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './account.css';

const AVATARS = Array.from({ length: 10 }, (_, index) => `/avatars/avatar-${index + 1}.svg`);
const safeAvatar = value => AVATARS.includes(value) ? value : AVATARS[0];
const isUuid = value => /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(value || ''));

export default function PublicProfile({ userId, username, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true); setError(''); setProfile(null);
      try {
        let query = supabase.from('profiles').select('id, username, avatar_url, bio').limit(1);
        if (isUuid(userId)) query = query.eq('id', userId);
        else if (String(username || userId || '').trim()) query = query.ilike('username', String(username || userId).trim());
        else throw new Error('This reader profile is no longer available.');
        const { data, error: queryError } = await query.maybeSingle();
        if (queryError) throw queryError;
        if (!active) return;
        if (!data) setError('This reader profile is no longer available.');
        else setProfile(data);
      } catch (err) {
        if (active) setError(err?.message || 'This reader profile is no longer available.');
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => { active = false; };
  }, [userId, username]);

  if (loading) return <main className="account-page"><div className="account-card"><div className="loading-state"><span className="loading-spinner"/><p>Opening profile…</p></div></div></main>;
  if (error || !profile) return <main className="account-page"><div className="account-card"><button className="account-back" onClick={onBack}>← Back</button><div className="empty-state"><h3>Profile unavailable</h3><p>{error || 'This reader profile is no longer available.'}</p></div></div></main>;

  return <main className="account-page public-profile-page"><section className="account-card public-profile-card">
    <button className="account-back" onClick={onBack}>← Back</button>
    <div className="public-profile-hero">
      <img className="profile-avatar public-profile-avatar" src={safeAvatar(profile.avatar_url)} alt={`${profile.username || 'Reader'} avatar`} />
      <div><p className="hero-eyebrow">ATMA REKHA READER</p><h1>{profile.username || 'Reader'}</h1></div>
    </div>
    <div className="public-profile-bio">
      <span>BIO</span>
      <p>{profile.bio?.trim() || 'This reader has not added a bio yet.'}</p>
    </div>
  </section></main>;
}
