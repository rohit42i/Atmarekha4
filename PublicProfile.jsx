import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './account.css';

const AVATARS = Array.from({ length: 10 }, (_, index) => `/avatars/avatar-${index + 1}.svg`);
const safeAvatar = value => AVATARS.includes(value) ? value : AVATARS[0];

export default function PublicProfile({ userId, onBack }) {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      const { data, error: queryError } = await supabase.from('profiles').select('username, avatar_url, bio').eq('id', userId).maybeSingle();
      if (!active) return;
      if (queryError) setError(queryError.message || 'Unable to load this profile.');
      else setProfile(data);
      setLoading(false);
    };
    if (userId) load();
    return () => { active = false; };
  }, [userId]);

  if (loading) return <main className="account-page"><div className="account-card"><div className="loading-state"><span className="loading-spinner"/><p>Opening profile…</p></div></div></main>;
  if (error || !profile) return <main className="account-page"><div className="account-card"><button className="account-back" onClick={onBack}>← Back</button><div className="empty-state"><h3>{error ? 'Profile unavailable' : 'Reader not found'}</h3><p>{error || 'This reader profile is no longer available.'}</p></div></div></main>;

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
