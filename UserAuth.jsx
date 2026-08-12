import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase } from './supabase';

const HOME = '#home';
const profileRoute = route => route === 'profile' || route === 'bookmarks' || route === 'history';

function routeNow() {
  return window.location.hash.replace(/^#/, '') || 'home';
}

function avatarFor(user, profile) {
  return profile?.avatar_url || user?.user_metadata?.avatar_url || user?.user_metadata?.picture || '';
}

function nameFor(user, profile) {
  return profile?.display_name || user?.user_metadata?.full_name || user?.user_metadata?.name || 'Reader';
}

function GoogleIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true" className="h-4 w-4"><path fill="#4285F4" d="M21.35 12.23c0-.67-.06-1.32-.17-1.94H12v3.67h5.23a4.47 4.47 0 0 1-1.94 2.94v2.44h3.14c1.84-1.69 2.92-4.18 2.92-7.11Z"/><path fill="#34A853" d="M12 21.5c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.3v2.52A9.74 9.74 0 0 0 12 21.5Z"/><path fill="#FBBC05" d="M6.54 13.59A5.85 5.85 0 0 1 6.23 12c0-.55.1-1.08.31-1.59V7.89H3.3A9.73 9.73 0 0 0 2.27 12c0 1.57.38 3.06 1.03 4.11l3.24-2.52Z"/><path fill="#EA4335" d="M12 6.38c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.45 14.63 2.5 12 2.5a9.74 9.74 0 0 0-8.7 5.39l3.24 2.52C7.31 8.1 9.46 6.38 12 6.38Z"/></svg>;
}

function UserMenu({ user, profile, onSignOut }) {
  const [open, setOpen] = useState(false);
  const avatar = avatarFor(user, profile);
  const name = nameFor(user, profile);
  return <div className="user-auth-menu">
    <button type="button" className="user-auth-avatar-button" onClick={() => setOpen(value => !value)} aria-expanded={open} aria-label="Open account menu">
      {avatar ? <img src={avatar} alt="" className="user-auth-avatar" referrerPolicy="no-referrer"/> : <span className="user-auth-avatar-fallback">{name.slice(0, 1).toUpperCase()}</span>}
      <span className="user-auth-name">{name}</span><span className="user-auth-chevron">⌄</span>
    </button>
    {open && <div className="user-auth-dropdown">
      <div className="user-auth-dropdown-head"><strong>{name}</strong><span>{user.email || 'Google account'}</span></div>
      <button onClick={() => { window.location.hash = 'profile'; setOpen(false); }}>Profile</button>
      <button onClick={() => { window.location.hash = 'bookmarks'; setOpen(false); }}>Bookmarks</button>
      <button onClick={() => { window.location.hash = 'history'; setOpen(false); }}>History</button>
      <button className="user-auth-signout" onClick={async () => { setOpen(false); await onSignOut(); }}>Sign out</button>
    </div>}
  </div>;
}

function ContinueReading({ rows, onOpen }) {
  if (!rows.length) return null;
  return <section className="home-continue-section">
    <div className="home-continue-heading"><div><p className="section-eyebrow">YOUR READING</p><h2>Continue Reading</h2></div><button type="button" onClick={() => { window.location.hash = 'history'; }}>History →</button></div>
    <div className="home-continue-row">{rows.slice(0, 3).map(row => {
      const chapter = row.chapters;
      const progress = Number(row.page_number || 1);
      if (!chapter) return null;
      return <button type="button" className="home-continue-card" key={row.chapter_id} onClick={() => onOpen(chapter.id)}>
        {chapter.cover_url ? <img src={chapter.cover_url} alt=""/> : <div className="home-continue-placeholder">AR</div>}
        <div><span>CHAPTER {chapter.chapter_number}</span><h3>{chapter.title}</h3><p>Resume from page {progress}</p></div><b>→</b>
      </button>;
    })}</div>
  </section>;
}

function ProfilePage({ user, profile, setProfile, activeTab, setActiveTab }) {
  const [username, setUsername] = useState(profile?.username || '');
  const [displayName, setDisplayName] = useState(profile?.display_name || '');
  const [bio, setBio] = useState(profile?.bio || '');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [rows, setRows] = useState([]);
  const [bookmarks, setBookmarks] = useState([]);
  const [ratings, setRatings] = useState([]);
  const [loading, setLoading] = useState(false);
  const avatar = avatarFor(user, profile);
  const display = nameFor(user, profile);
  const displayLocked = Boolean(profile?.display_name_locked);

  useEffect(() => { setUsername(profile?.username || ''); setDisplayName(profile?.display_name || ''); setBio(profile?.bio || ''); }, [profile]);
  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      const [historyResult, bookmarkResult, ratingResult] = await Promise.all([
        supabase.from('reading_history').select('chapter_id,page_number,updated_at,chapters(id,chapter_number,title,cover_url,status)').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(50),
        supabase.from('bookmarks').select('id,chapter_id,created_at,chapters(id,chapter_number,title,cover_url,status)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
        supabase.from('chapter_ratings').select('id,chapter_id,rating,created_at,chapters(id,chapter_number,title,cover_url,status)').eq('user_id', user.id).order('created_at', { ascending: false }).limit(50),
      ]);
      if (!cancelled) { setRows(historyResult.data || []); setBookmarks(bookmarkResult.data || []); setRatings(ratingResult.data || []); setLoading(false); }
    };
    load();
    return () => { cancelled = true; };
  }, [user.id, activeTab]);

  const save = async event => {
    event.preventDefault();
    if (saving) return;
    setSaving(true); setMessage('');
    const cleanUsername = username.trim().toLowerCase().replace(/[^a-z0-9_]/g, '').slice(0, 24);
    const updates = { username: cleanUsername || null, bio: bio.trim().slice(0, 240) || null, updated_at: new Date().toISOString() };
    if (!displayLocked) updates.display_name = displayName.trim().slice(0, 60) || display;
    const { data, error } = await supabase.from('profiles').update(updates).eq('id', user.id).select().single();
    if (error) setMessage(error.code === '23505' ? 'That username is already taken.' : error.message);
    else { setProfile(data); setMessage('Profile saved.'); }
    setSaving(false);
  };

  const list = activeTab === 'history' ? rows : activeTab === 'bookmarks' ? bookmarks : ratings;
  const stats = { history: rows.length, bookmarks: bookmarks.length, ratings: ratings.length };
  return <main className="user-profile-page">
    <div className="user-profile-top"><button className="user-profile-back" onClick={() => { window.location.hash = 'home'; }}>←</button><span>ATMA REKHA</span></div>
    <section className="user-profile-card">
      <div className="user-profile-identity">{avatar ? <img src={avatar} alt="" referrerPolicy="no-referrer"/> : <div className="user-profile-avatar-fallback">{display.slice(0, 1).toUpperCase()}</div>}<div><p className="section-eyebrow">READER PROFILE</p><h1>{display}</h1><p>@{profile?.username || 'set-your-username'}</p><small>Joined {profile?.created_at ? new Date(profile.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : 'recently'}</small></div></div>
      <form className="user-profile-form" onSubmit={save}><label>Display name<input value={displayName} disabled={displayLocked} onChange={event => setDisplayName(event.target.value)}/>{displayLocked && <small>Your Google display name has already been edited once.</small>}</label><label>Username<input value={username} onChange={event => setUsername(event.target.value)} placeholder="your_handle" maxLength={24}/></label><label>Bio<textarea value={bio} onChange={event => setBio(event.target.value)} placeholder="A short bio (optional)" maxLength={240} rows="3"/></label><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button>{message && <p className="user-profile-message">{message}</p>}</form>
      <div className="user-profile-stats"><div><strong>{stats.history}</strong><span>Chapters read</span></div><div><strong>{stats.bookmarks}</strong><span>Saved chapters</span></div><div><strong>{stats.ratings}</strong><span>Ratings given</span></div></div>
      <div className="user-profile-tabs">{[['history','History'],['bookmarks','Bookmarks'],['ratings','My Ratings']].map(([id,label]) => <button key={id} className={activeTab === id ? 'active' : ''} onClick={() => setActiveTab(id)}>{label}</button>)}</div>
      <div className="user-profile-list">{loading ? <div className="loading-state"><span className="loading-spinner"/><p>Loading…</p></div> : !list.length ? <div className="empty-state"><h3>{activeTab === 'history' ? 'No reading history yet' : activeTab === 'bookmarks' ? 'No bookmarks yet' : 'No ratings yet'}</h3><p>Start reading Atma Rekha and your activity will appear here.</p></div> : list.map(row => { const chapter = row.chapters; if (!chapter) return null; return <button key={row.id || row.chapter_id} className="user-profile-list-item" onClick={() => { window.location.hash = `read-chapter/${encodeURIComponent(chapter.id)}`; }}><div>{chapter.cover_url ? <img src={chapter.cover_url} alt=""/> : <span>AR</span>}<div><small>CHAPTER {chapter.chapter_number}</small><strong>{chapter.title}</strong></div></div><b>{activeTab === 'ratings' ? `${row.rating}/10 ★` : activeTab === 'history' ? `Page ${row.page_number || 1} →` : 'Read →'}</b></button>; })}</div>
    </section>
  </main>;
}

export default function UserAuth() {
  const [route, setRoute] = useState(routeNow);
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [continueRows, setContinueRows] = useState([]);
  const [profileTab, setProfileTab] = useState('history');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onHash = () => setRoute(routeNow());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  const loadUserData = async currentUser => {
    if (!currentUser) { setProfile(null); setContinueRows([]); return; }
    const { data: profileRow } = await supabase.from('profiles').select('*').eq('id', currentUser.id).maybeSingle();
    setProfile(profileRow || null);
    const { data: history } = await supabase.from('reading_history').select('chapter_id,page_number,updated_at,chapters(id,chapter_number,title,cover_url,status)').eq('user_id', currentUser.id).order('updated_at', { ascending: false }).limit(3);
    setContinueRows(history || []);
  };

  useEffect(() => {
    let alive = true;
    supabase.auth.getUser().then(({ data }) => { if (alive) { setSession(data?.user ? { user: data.user } : null); if (data?.user) loadUserData(data.user); } });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!alive) return;
      setSession(nextSession);
      if (nextSession?.user) loadUserData(nextSession.user); else { setProfile(null); setContinueRows([]); }
    });
    return () => { alive = false; listener.subscription.unsubscribe(); };
  }, []);

  const user = session?.user || null;
  const signIn = async () => {
    setBusy(true); setError('');
    const { error: authError } = await supabase.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: `${window.location.origin}${window.location.pathname}#home` } });
    if (authError) { setError(authError.message); setBusy(false); }
  };
  const signOut = async () => { await supabase.auth.signOut(); window.location.hash = 'home'; };

  useEffect(() => {
    if (!user) return;
    const match = route.match(/^read-chapter\/(.+)$/);
    if (!match) return;
    const chapterId = decodeURIComponent(match[1]);
    supabase.from('reading_history').upsert({ user_id: user.id, chapter_id: chapterId, page_number: 1, updated_at: new Date().toISOString() }, { onConflict: 'user_id,chapter_id' }).then(({ error: historyError }) => { if (historyError) console.warn('Reading history:', historyError.message); else loadUserData(user); });
  }, [route, user?.id]);

  const authControl = user ? <UserMenu user={user} profile={profile} onSignOut={signOut}/> : <button type="button" className="google-signin-button" onClick={signIn} disabled={busy}><GoogleIcon/>{busy ? 'Opening Google…' : 'Sign in with Google'}</button>;
  const profilePortal = user && profileRoute(route) ? createPortal(<ProfilePage user={user} profile={profile || {}} setProfile={setProfile} activeTab={profileTab} setActiveTab={setProfileTab}/>, document.body) : null;
  const homePortal = route === 'home' && user && continueRows.length ? createPortal(<ContinueReading rows={continueRows} onOpen={chapterId => { window.location.hash = `read-chapter/${encodeURIComponent(chapterId)}`; }}/>, document.querySelector('.home-page') || document.body) : null;
  const errorPortal = error ? createPortal(<div className="user-auth-toast" role="alert">{error}<button onClick={() => setError('')}>×</button></div>, document.body) : null;
  return <>{createPortal(<div className="user-auth-fixed">{authControl}</div>, document.body)}{profilePortal}{homePortal}{errorPortal}</>;
}
