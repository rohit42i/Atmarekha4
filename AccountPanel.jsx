import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabase';
import { enableChapterNotifications, disableChapterNotifications, notificationsSupported } from './notifications';
import './account.css';

const AVATARS = Array.from({ length: 10 }, (_, index) => `/avatars/avatar-${index + 1}.svg`);
const emptyForm = { email: '', password: '', username: '' };

function avatarOrDefault(value) {
  return AVATARS.includes(value) ? value : AVATARS[0];
}

export default function AccountPanel({ onBack }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editing, setEditing] = useState(false);
  const [avatarPicker, setAvatarPicker] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState(false);
  const [history, setHistory] = useState([]);
  const [favorites, setFavorites] = useState([]);

  const loadProfile = async user => {
    if (!user) return;
    const { data, error: profileError } = await supabase.from('profiles').select('id, username, avatar_url, bio, updated_at').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    setProfile(data || { id: user.id, username: user.user_metadata?.username || '', avatar_url: AVATARS[0], bio: '', updated_at: new Date().toISOString() });
  };

  const loadNotificationState = async user => {
    if (!user || !notificationsSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return setNotifications(false);
    const { data } = await supabase.from('notification_subscriptions').select('id').eq('user_id', user.id).eq('endpoint', subscription.endpoint).maybeSingle();
    setNotifications(Boolean(data));
  };

  const loadLibrary = async user => {
    if (!user) return;
    const [{ data: historyRows, error: historyError }, { data: favoriteRows, error: favoriteError }] = await Promise.all([
      supabase.from('reading_history').select('chapter_id, page_number, updated_at').eq('user_id', user.id).order('updated_at', { ascending: false }).limit(20),
      supabase.from('bookmarks').select('chapter_id, created_at').eq('user_id', user.id).order('created_at', { ascending: false }).limit(20),
    ]);
    if (historyError) throw historyError;
    if (favoriteError) throw favoriteError;
    const ids = [...new Set([...(historyRows || []).map(row => row.chapter_id), ...(favoriteRows || []).map(row => row.chapter_id)])];
    if (!ids.length) return setHistory([]), setFavorites([]);
    const { data: chapters, error: chaptersError } = await supabase.from('chapters').select('id, chapter_number, title').in('id', ids);
    if (chaptersError) throw chaptersError;
    const byId = Object.fromEntries((chapters || []).map(row => [row.id, row]));
    setHistory((historyRows || []).map(row => ({ ...row, chapter: byId[row.chapter_id] })).filter(row => row.chapter));
    setFavorites((favoriteRows || []).map(row => ({ ...row, chapter: byId[row.chapter_id] })).filter(row => row.chapter));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session);
        if (data.session) await Promise.all([loadProfile(data.session.user), loadNotificationState(data.session.user), loadLibrary(data.session.user)]);
      } catch (err) {
        if (active) setError(err?.message || 'Unable to load your account.');
      } finally {
        if (active) setBusy(false);
      }
    };
    load();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next) {
        try { await Promise.all([loadProfile(next.user), loadNotificationState(next.user), loadLibrary(next.user)]); }
        catch (err) { setError(err?.message || 'Unable to load your account.'); }
      } else { setProfile(null); setHistory([]); setFavorites([]); }
    });
    return () => { active = false; listener.subscription.unsubscribe(); };
  }, []);

  const update = (key, value) => setForm(previous => ({ ...previous, [key]: value }));

  const submit = async event => {
    event.preventDefault(); setSaving(true); setError(''); setMessage('');
    try {
      if (mode === 'signin') {
        const { error: authError } = await supabase.auth.signInWithPassword({ email: form.email.trim(), password: form.password });
        if (authError) throw authError;
        setMessage('Signed in successfully.');
      } else if (mode === 'signup') {
        const username = form.username.trim().slice(0, 40);
        const { data, error: authError } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { username, avatar_url: AVATARS[0] } } });
        if (authError) throw authError;
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({ id: data.user.id, username: username || null, avatar_url: AVATARS[0], bio: '', updated_at: new Date().toISOString() }, { onConflict: 'id' });
          if (profileError) throw profileError;
        }
        setMessage(data.session ? 'Account created.' : 'Account created. Check your email to verify it, then sign in.'); setMode('signin');
      } else {
        const { error: resetError } = await supabase.auth.resetPasswordForEmail(form.email.trim(), { redirectTo: `${window.location.origin}/#account` });
        if (resetError) throw resetError;
        setMessage('If that email belongs to an account, a password reset link has been sent.'); setMode('signin');
      }
      setForm(emptyForm);
    } catch (err) { setError(err?.message || 'Unable to complete that request.'); }
    finally { setSaving(false); }
  };

  const saveProfile = async event => {
    event.preventDefault(); if (!session?.user) return; setSaving(true); setError(''); setMessage('');
    try {
      const username = String(profile?.username || '').trim().slice(0, 40);
      const bio = String(profile?.bio || '').trim().slice(0, 280);
      const avatar_url = avatarOrDefault(profile?.avatar_url);
      const { data, error: profileError } = await supabase.from('profiles').upsert({ id: session.user.id, username: username || null, avatar_url, bio, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select().single();
      if (profileError) throw profileError;
      setProfile(data); setEditing(false); setAvatarPicker(false); setMessage('Profile updated.');
    } catch (err) { setError(err?.message || 'Unable to save your profile.'); }
    finally { setSaving(false); }
  };

  const signOut = async () => { setSaving(true); await supabase.auth.signOut(); setSaving(false); };
  const deleteAccount = async () => {
    if (!window.confirm('Delete your Atma Rekha account permanently? This cannot be undone.')) return;
    setSaving(true); setError('');
    try { const { error: deleteError } = await supabase.functions.invoke('delete-account', { method: 'POST' }); if (deleteError) throw deleteError; await supabase.auth.signOut(); setMessage('Your account has been deleted.'); setTimeout(onBack, 800); }
    catch (err) { setError(err?.message || 'Unable to delete your account.'); }
    finally { setSaving(false); }
  };

  const email = session?.user?.email || '';
  const joined = session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
  const selectedAvatar = avatarOrDefault(profile?.avatar_url);
  const initials = useMemo(() => (profile?.username || 'Reader').slice(0, 1).toUpperCase(), [profile?.username]);

  if (busy) return <main className="account-page"><div className="account-card"><div className="loading-state"><span className="loading-spinner"/><p>Opening account…</p></div></div></main>;

  if (!session) return <main className="account-page"><section className="account-card account-auth-card"><button className="account-back" onClick={onBack}>← Back</button><p className="hero-eyebrow">ATMA REKHA</p><h1>{mode === 'signin' ? 'Welcome back.' : mode === 'signup' ? 'Create your account.' : 'Reset your password.'}</h1><p className="account-intro">Read freely. Sign in when you want favorites, reading progress, ratings, notifications and your own reader profile.</p><form className="account-form" onSubmit={submit}>{mode === 'signup' && <label>Display name<input value={form.username} onChange={e => update('username', e.target.value)} maxLength={40} placeholder="Your reader name" autoComplete="nickname"/></label>}<label>Email<input type="email" required value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" placeholder="you@example.com"/></label>{mode !== 'forgot' && <label>Password<input type="password" required minLength={6} value={form.password} onChange={e => update('password', e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 6 characters"/></label>}<button className="primary-button" disabled={saving}>{saving ? 'Please wait…' : mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Send reset link'}</button></form>{message && <p className="account-message">{message}</p>}{error && <p className="form-error">{error}</p>}<button className="account-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}>{mode === 'signin' ? 'New here? Create an account' : 'Back to sign in'}</button>{mode === 'signin' && <button className="account-switch" onClick={() => { setMode('forgot'); setError(''); setMessage(''); }}>Forgot password?</button>}<button className="account-back secondary" onClick={onBack}>Continue reading without signing in</button></section></main>;

  return <main className="account-page"><section className="account-card">
    <button className="account-back" onClick={onBack}>← Back</button>
    <div className="profile-hero">
      <div className="profile-avatar-wrap"><img className="profile-avatar" src={selectedAvatar} alt={`${profile?.username || 'Reader'} avatar`}/>{editing && <button className="avatar-pencil" type="button" onClick={() => setAvatarPicker(true)} aria-label="Change profile image" title="Change profile image">✎</button>}</div>
      <div className="profile-hero-copy"><p className="hero-eyebrow">READER PROFILE</p><h1>{profile?.username || 'Reader'}</h1><p className="profile-email">{email}</p>{profile?.bio && <p className="profile-bio">{profile.bio}</p>}</div>
      <button className={`profile-edit-button${editing ? ' active' : ''}`} type="button" onClick={() => { setEditing(value => !value); setAvatarPicker(false); setError(''); setMessage(''); }}>{editing ? 'Done' : 'Edit profile'}</button>
    </div>

    {editing ? <form className="account-form profile-editor" onSubmit={saveProfile}>
      <label>Display name<input value={profile?.username || ''} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} maxLength={40} placeholder="Reader"/></label>
      <label>Bio<span className="field-count">{String(profile?.bio || '').length}/280</span><textarea value={profile?.bio || ''} onChange={e => setProfile(p => ({ ...p, bio: e.target.value.slice(0, 280) }))} maxLength={280} rows={4} placeholder="Tell readers a little about yourself…"/></label>
      <div className="account-readonly"><span>Gmail / account email</span><strong>{email || '—'}</strong><small>Email changes are handled through account security, not profile editing.</small></div>
      <button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save changes'}</button>
    </form> : <div className="profile-summary"><div><span>Member since</span><strong>{joined}</strong></div><div><span>Favorites</span><strong>{favorites.length}</strong></div><div><span>Reading history</span><strong>{history.length}</strong></div></div>}

    {avatarPicker && <div className="avatar-modal-backdrop" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setAvatarPicker(false); }}><section className="avatar-modal" role="dialog" aria-modal="true" aria-label="Choose profile image"><div className="avatar-modal-head"><div><p className="hero-eyebrow">PROFILE IMAGE</p><h2>Choose your avatar</h2><p>Pick one of the 10 Atma Rekha avatars.</p></div><button type="button" className="icon-button" onClick={() => setAvatarPicker(false)} aria-label="Close">×</button></div><div className="avatar-grid">{AVATARS.map((avatar, index) => <button type="button" key={avatar} className={`avatar-option${selectedAvatar === avatar ? ' selected' : ''}`} onClick={() => { setProfile(p => ({ ...p, avatar_url: avatar })); setAvatarPicker(false); }} aria-label={`Choose avatar ${index + 1}`}><img src={avatar} alt={`Avatar ${index + 1}`}/></button>)}</div></section></div>}

    <div className="account-section"><div><h2>Chapter notifications</h2><p>One notification when a new Atma Rekha chapter is released.</p></div><button className="account-toggle" onClick={async () => { setError(''); setMessage(''); try { if (notifications) { await disableChapterNotifications(); setNotifications(false); setMessage('Chapter notifications turned off.'); } else { await enableChapterNotifications(session.user.id); setNotifications(true); setMessage('Chapter notifications enabled.'); } } catch (err) { setError(err?.message || 'Unable to change notification settings.'); } }}>{notifications ? 'Enabled' : 'Enable'}</button></div>
    {!notificationsSupported() && <p className="account-note">Browser notifications are not available on this device or browser.</p>}

    <div className="account-library">
      <div><div className="library-heading"><div><h2>Continue reading</h2><p>Pick up exactly where you left off.</p></div></div>{history.length ? history.slice(0, 6).map(item => <a key={item.chapter_id} href={`#read-chapter/${encodeURIComponent(item.chapter_id)}`}><span>Chapter {item.chapter.chapter_number} · {item.chapter.title || 'Untitled'}</span><small>Page {item.page_number || 1}</small></a>) : <p className="account-note">Your reading progress will appear here.</p>}</div>
      <div><div className="library-heading"><div><h2>Favorites</h2><p>Chapters you chose to keep close.</p></div></div>{favorites.length ? favorites.slice(0, 6).map(item => <a key={item.chapter_id} href={`#read-chapter/${encodeURIComponent(item.chapter_id)}`}><span>Chapter {item.chapter.chapter_number} · {item.chapter.title || 'Untitled'}</span><small>Favorite</small></a>) : <p className="account-note">Favorite chapters from the reader to build your library.</p>}</div>
    </div>

    <div className="account-actions"><button className="account-secondary" onClick={signOut} disabled={saving}>Sign out</button><button className="account-danger" onClick={deleteAccount} disabled={saving}>Delete account</button></div>
    {message && <p className="account-message">{message}</p>}{error && <p className="form-error">{error}</p>}
  </section></main>;
}
