import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { enableChapterNotifications, disableChapterNotifications, notificationsSupported } from './notifications';
import './account.css';

const emptyForm = { email: '', password: '', username: '' };

export default function AccountPanel({ onBack }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [mode, setMode] = useState('signin');
  const [form, setForm] = useState(emptyForm);
  const [busy, setBusy] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [notifications, setNotifications] = useState(false);

  const loadProfile = async user => {
    if (!user) return;
    const { data, error: profileError } = await supabase.from('profiles').select('id, username, avatar_url, updated_at').eq('id', user.id).maybeSingle();
    if (profileError) throw profileError;
    setProfile(data || { id: user.id, username: user.user_metadata?.username || '', avatar_url: '', updated_at: new Date().toISOString() });
  };
  const loadNotificationState = async user => {
    if (!user || !notificationsSupported()) return;
    const registration = await navigator.serviceWorker.getRegistration('/sw.js');
    const subscription = await registration?.pushManager?.getSubscription();
    if (!subscription) return setNotifications(false);
    const { data } = await supabase.from('notification_subscriptions').select('id').eq('user_id', user.id).eq('endpoint', subscription.endpoint).maybeSingle();
    setNotifications(Boolean(data));
  };

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const { data } = await supabase.auth.getSession();
        if (!active) return;
        setSession(data.session);
        if (data.session) { await loadProfile(data.session.user); await loadNotificationState(data.session.user); }
      } catch (err) { if (active) setError(err?.message || 'Unable to load your account.'); }
      finally { if (active) setBusy(false); }
    };
    load();
    const { data: listener } = supabase.auth.onAuthStateChange(async (_event, next) => {
      setSession(next);
      if (next) { try { await loadProfile(next.user); } catch (err) { setError(err?.message || 'Unable to load your profile.'); } }
      else setProfile(null);
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
      } else {
        const username = form.username.trim().slice(0, 40);
        const { data, error: authError } = await supabase.auth.signUp({ email: form.email.trim(), password: form.password, options: { data: { username } } });
        if (authError) throw authError;
        if (data.user) {
          const { error: profileError } = await supabase.from('profiles').upsert({ id: data.user.id, username: username || null, updated_at: new Date().toISOString() }, { onConflict: 'id' });
          if (profileError) throw profileError;
        }
        setMessage(data.session ? 'Account created.' : 'Account created. Check your email to verify it, then sign in.'); setMode('signin');
      }
      setForm(emptyForm);
    } catch (err) { setError(err?.message || 'Unable to complete that request.'); } finally { setSaving(false); }
  };
  const saveProfile = async event => {
    event.preventDefault(); if (!session?.user) return;
    setSaving(true); setError(''); setMessage('');
    try {
      const username = String(profile?.username || '').trim().slice(0, 40);
      const { data, error: profileError } = await supabase.from('profiles').upsert({ id: session.user.id, username: username || null, avatar_url: profile?.avatar_url || null, updated_at: new Date().toISOString() }, { onConflict: 'id' }).select().single();
      if (profileError) throw profileError;
      setProfile(data); setMessage('Profile saved.');
    } catch (err) { setError(err?.message || 'Unable to save your profile.'); } finally { setSaving(false); }
  };
  const signOut = async () => { setSaving(true); await supabase.auth.signOut(); setSaving(false); };
  const deleteAccount = () => setError('For security, account deletion is currently handled manually. Contact Atma Rekha if you need your account removed.');
  const email = session?.user?.email || '';
  const joined = session?.user?.created_at ? new Date(session.user.created_at).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  if (busy) return <main className="account-page"><div className="account-card"><div className="loading-state"><span className="loading-spinner"/><p>Opening account…</p></div></div></main>;
  if (!session) return <main className="account-page"><section className="account-card"><button className="account-back" onClick={onBack}>← Back</button><p className="hero-eyebrow">ATMA REKHA</p><h1>{mode === 'signin' ? 'Welcome back.' : 'Create your account.'}</h1><p className="account-intro">You can read Atma Rekha without an account. Sign in only when you want a profile, saved reading data, and chapter notifications.</p><form className="account-form" onSubmit={submit}>{mode === 'signup' && <label>Display name<input value={form.username} onChange={e => update('username', e.target.value)} maxLength={40} placeholder="Your reader name" autoComplete="nickname"/></label>}<label>Email<input type="email" required value={form.email} onChange={e => update('email', e.target.value)} autoComplete="email" placeholder="you@example.com"/></label><label>Password<input type="password" required minLength={6} value={form.password} onChange={e => update('password', e.target.value)} autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} placeholder="At least 6 characters"/></label><button className="primary-button" disabled={saving}>{saving ? 'Please wait…' : mode === 'signin' ? 'Sign in' : 'Create account'}</button></form>{message && <p className="account-message">{message}</p>}{error && <p className="form-error">{error}</p>}<button className="account-switch" onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(''); setMessage(''); }}>{mode === 'signin' ? 'New here? Create an account' : 'Already have an account? Sign in'}</button><button className="account-back secondary" onClick={onBack}>Continue reading without signing in</button></section></main>;
  return <main className="account-page"><section className="account-card"><button className="account-back" onClick={onBack}>← Back</button><div className="account-profile-head"><div className="account-avatar">{(profile?.username || email || 'R').slice(0, 1).toUpperCase()}</div><div><p className="hero-eyebrow">YOUR ACCOUNT</p><h1>{profile?.username || 'Reader'}</h1><p>{email}</p></div></div><form className="account-form" onSubmit={saveProfile}><label>Display name<input value={profile?.username || ''} onChange={e => setProfile(p => ({ ...p, username: e.target.value }))} maxLength={40} placeholder="Reader"/></label><label>Email<input value={email} disabled/></label><div className="account-meta"><span>Joined</span><strong>{joined}</strong></div><button className="primary-button" disabled={saving}>{saving ? 'Saving…' : 'Save profile'}</button></form><div className="account-section"><div><h2>Chapter notifications</h2><p>Get one notification when a new Atma Rekha chapter is released. Nothing else.</p></div><button className="account-toggle" onClick={async () => { setError(''); setMessage(''); try { if (notifications) { await disableChapterNotifications(); setNotifications(false); setMessage('Chapter notifications turned off.'); } else { await enableChapterNotifications(session.user.id); setNotifications(true); setMessage('Chapter notifications enabled.'); } } catch (err) { setError(err?.message || 'Unable to change notification settings.'); } }}>{notifications ? 'Enabled' : 'Enable'}</button></div>{!notificationsSupported() && <p className="account-note">Browser notifications are not available on this device or browser.</p>}<div className="account-actions"><button className="account-secondary" onClick={signOut} disabled={saving}>Sign out</button><button className="account-danger" onClick={deleteAccount}>Delete account</button></div>{message && <p className="account-message">{message}</p>}{error && <p className="form-error">{error}</p>}</section></main>;
}
