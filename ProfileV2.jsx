import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';

const AVATARS = Array.from({ length: 10 }, (_, i) => `/avatars/avatar-${String(i + 1).padStart(2, '0')}.svg`);

function routeNow() { return window.location.hash.replace(/^#/, '') || 'home'; }

export default function ProfileV2() {
  const [route, setRoute] = useState(routeNow);
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [editing, setEditing] = useState(false);
  const [avatarPicker, setAvatarPicker] = useState(false);
  const [displayName, setDisplayName] = useState('');
  const [username, setUsername] = useState('');
  const [bio, setBio] = useState('');
  const [email, setEmail] = useState('');
  const [avatar, setAvatar] = useState(AVATARS[0]);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [tab, setTab] = useState(() => window.localStorage.getItem('atma-profile-tab') || 'history');
  const [history, setHistory] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [ratings, setRatings] = useState([]);

  const load = async currentUser => {
    if (!currentUser) return;
    setUser(currentUser);
    setEmail(currentUser.email || '');
    const { data } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    const next = data || {};
    setProfile(next);
    setDisplayName(next.display_name || currentUser.user_metadata?.full_name || 'Reader');
    setUsername(next.username || '');
    setBio(next.bio || '');
    setAvatar(next.avatar_url || AVATARS[0]);
    const [h, b, r] = await Promise.all([
      supabase.from('reading_history').select('chapter_id,page_number,updated_at,chapters(id,chapter_number,title,cover_url,status)').eq('user_id', currentUser.id).order('updated_at', { ascending: false }).limit(50),
      supabase.from('bookmarks').select('id,chapter_id,created_at,chapters(id,chapter_number,title,cover_url,status)').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50),
      supabase.from('chapter_ratings').select('id,chapter_id,rating,created_at,chapters(id,chapter_number,title,cover_url,status)').eq('user_id', currentUser.id).order('created_at', { ascending: false }).limit(50)
    ]);
    setHistory(h.data || []); setBookmarks(b.data || []); setRatings(r.data || []);
  };

  useEffect(() => {
    const onHash = () => setRoute(routeNow());
    window.addEventListener('hashchange', onHash);
    const savedTab = window.localStorage.getItem('atma-profile-tab');
    if (savedTab === 'history' || savedTab === 'bookmarks' || savedTab === 'ratings') setTab(savedTab);
    window.localStorage.removeItem('atma-profile-tab');
    supabase.auth.getSession().then(({ data }) => { if (data?.session?.user) load(data.session.user); });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => { if (session?.user) load(session.user); else setUser(null); });
    return () => { window.removeEventListener('hashchange', onHash); listener.subscription.unsubscribe(); };
  }, []);

  const save = async event => {
    event.preventDefault();
    if (!user || saving) return;
    setSaving(true); setError(''); setMessage('');
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    const updates = { username: cleanUsername || null, display_name: displayName.trim().slice(0, 60) || 'Reader', bio: bio.trim().slice(0, 240) || null, avatar_url: avatar || AVATARS[0] };
    const { data, error: profileError } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single();
    if (profileError) { setError(profileError.code === '23505' ? 'That username is already taken.' : profileError.message); setSaving(false); return; }
    if (email.trim() && email.trim() !== (user.email || '')) {
      const { error: emailError } = await supabase.auth.updateUser({ email: email.trim() });
      if (emailError) setError(emailError.message); else setMessage('Profile saved. Check your new email to confirm the email change.');
    } else setMessage('Profile saved.');
    setProfile(data); setEditing(false); setAvatarPicker(false); setSaving(false);
  };

  const list = useMemo(() => tab === 'history' ? history : tab === 'bookmarks' ? bookmarks : ratings, [tab, history, bookmarks, ratings]);
  const display = profile?.display_name || displayName || 'Reader';
  const joined = profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Recently';

  if (route !== 'profile' || !user) return null;

  return <main className="profile-v2-overlay">
    <div className="profile-v2-shell">
      <div className="profile-v2-top"><button type="button" onClick={() => { window.location.hash = 'home'; }}>←</button><span>ATMA REKHA</span></div>
      <section className="profile-v2-card">
        <div className="profile-v2-header">
          <div className="profile-v2-avatar-wrap">
            <img src={avatar || AVATARS[0]} alt="Profile avatar" />
            {editing && <button type="button" className="profile-v2-pencil" onClick={() => setAvatarPicker(value => !value)} aria-label="Choose profile picture">✎</button>}
            {editing && avatarPicker && <div className="profile-v2-avatar-picker">
              <div className="profile-v2-picker-title"><strong>Choose your profile picture</strong><button type="button" onClick={() => setAvatarPicker(false)}>×</button></div>
              <div className="profile-v2-avatar-grid">{AVATARS.map(src => <button type="button" key={src} className={avatar === src ? 'selected' : ''} onClick={() => { setAvatar(src); setAvatarPicker(false); }}><img src={src} alt="Choose avatar" /></button>)}</div>
            </div>}
          </div>
          <div className="profile-v2-heading"><p className="section-eyebrow">PROFILE</p><h1>{display}</h1><p>@{profile?.username || 'set-your-username'}</p><small>Joined {joined}</small></div>
          {!editing && <button type="button" className="profile-v2-edit-button" onClick={() => { setError(''); setMessage(''); setEditing(true); }}>Edit Profile</button>}
        </div>

        {editing ? <form className="profile-v2-edit-form" onSubmit={save}>
          <label>Display name<input value={displayName} onChange={e => setDisplayName(e.target.value)} maxLength={60} required /></label>
          <label>Username<input value={username} onChange={e => setUsername(e.target.value)} placeholder="your_handle" maxLength={24} /></label>
          <label>Email / Gmail<input type="email" value={email} onChange={e => setEmail(e.target.value)} autoComplete="email" required /></label>
          <label>Bio<textarea value={bio} onChange={e => setBio(e.target.value)} placeholder="A short bio (optional)" maxLength={240} rows="3" /></label>
          <div className="profile-v2-edit-actions"><button type="button" onClick={() => { setEditing(false); setAvatarPicker(false); setError(''); setMessage(''); load(user); }}>Cancel</button><button className="primary-button" type="submit" disabled={saving}>{saving ? 'Saving…' : 'Save Changes'}</button></div>
          {error && <p className="profile-v2-error">{error}</p>}{message && <p className="profile-v2-message">{message}</p>}
        </form> : <div className="profile-v2-bio">{profile?.bio ? <p>{profile.bio}</p> : <p className="muted">No bio yet.</p>}</div>}

        {!editing && <>
          <div className="profile-v2-stats"><div><strong>{history.length}</strong><span>Chapters read</span></div><div><strong>{bookmarks.length}</strong><span>Favourites</span></div><div><strong>{ratings.length}</strong><span>Ratings</span></div></div>
          <div className="profile-v2-tabs">{[['history','Reading History'],['bookmarks','Favourites'],['ratings','My Ratings']].map(([id,label]) => <button type="button" key={id} className={tab === id ? 'active' : ''} onClick={() => setTab(id)}>{label}</button>)}</div>
          <div className="profile-v2-list">{!list.length ? <div className="profile-v2-empty"><h3>{tab === 'history' ? 'No reading history yet' : tab === 'bookmarks' ? 'No favourites yet' : 'No ratings yet'}</h3><p>Start reading Atma Rekha and your activity will appear here.</p></div> : list.map(row => { const chapter = row.chapters; if (!chapter) return null; return <button type="button" key={row.id || row.chapter_id} className="profile-v2-list-item" onClick={() => { window.location.hash = `read-chapter/${encodeURIComponent(chapter.id)}`; }}><div>{chapter.cover_url ? <img src={chapter.cover_url} alt="" /> : <span>AR</span>}<div><small>CHAPTER {chapter.chapter_number}</small><strong>{chapter.title}</strong></div></div><b>{tab === 'ratings' ? `${row.rating}/10 ★` : tab === 'history' ? `Page ${row.page_number || 1} →` : 'Read →'}</b></button>; })}</div>
        </>}
      </section>
    </div>
  </main>;
}
