import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';
import './more-page-pwa.css';

const initialPwaState = () => window.__atmaPwaState || {
  installed: Boolean(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true),
  canInstall: false,
  ios: /iphone|ipad|ipod/i.test(window.navigator.userAgent || ''),
};
const CATEGORIES = [
  ['new_chapters', 'New chapters', 'When a new chapter is published.'],
  ['comments_replies', 'Comments and replies', 'Replies to your comments and relevant comment activity.'],
  ['group_chat', 'Group chat', 'New group chat messages and activity.'],
  ['community_posts', 'Community posts', 'New posts and updates from the community.'],
  ['announcements', 'Announcements', 'Important creator updates and site announcements.'],
  ['membership_account', 'Membership and account', 'Membership, security and account-related updates.'],
  ['other_updates', 'Other creator updates', 'Other updates you choose to receive.'],
];
const DEFAULT_PREFERENCES = Object.fromEntries(CATEGORIES.map(([key]) => [key, true]));

export default function MorePage() {
  const [pwa, setPwa] = useState(initialPwaState);
  const [showInstallHelp, setShowInstallHelp] = useState(false);
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsNotice, setPrefsNotice] = useState('');

  useEffect(() => {
    const onPwaState = event => setPwa(event.detail || initialPwaState());
    window.addEventListener('atma:pwa-state', onPwaState);
    if (window.__atmaPwaState) setPwa(window.__atmaPwaState);
    const loadUser = async () => {
      const { data } = await supabase.auth.getUser();
      setUser(data?.user || null);
      if (!data?.user) return;
      setPrefsLoading(true);
      const { data: row, error } = await supabase.from('notification_preferences').select('preferences').eq('user_id', data.user.id).maybeSingle();
      if (error) setPrefsNotice('Notification preferences could not be loaded. Please try again.');
      else setPreferences({ ...DEFAULT_PREFERENCES, ...(row?.preferences || {}) });
      setPrefsLoading(false);
    };
    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user || null;
      setUser(nextUser);
      if (!nextUser) {
        setPreferences(DEFAULT_PREFERENCES);
        return;
      }
      queueMicrotask(async () => {
        setPrefsLoading(true);
        const { data: row, error } = await supabase.from('notification_preferences').select('preferences').eq('user_id', nextUser.id).maybeSingle();
        if (error) setPrefsNotice('Notification preferences could not be loaded. Please try again.');
        else setPreferences({ ...DEFAULT_PREFERENCES, ...(row?.preferences || {}) });
        setPrefsLoading(false);
      });
    });
    return () => {
      window.removeEventListener('atma:pwa-state', onPwaState);
      listener.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!showInstallHelp) return undefined;
    const onKeyDown = event => { if (event.key === 'Escape') setShowInstallHelp(false); };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [showInstallHelp]);

  const handleInstall = async () => {
    setNotice('');
    const result = await window.__atmaPwaInstall?.();
    if (!result || result.status === 'manual') setShowInstallHelp(true);
    else if (result.status === 'accepted' || result.status === 'installed') setNotice('Atma Rekha is ready as an installed app.');
  };

  const savePreferences = async event => {
    event.preventDefault();
    if (!user || prefsSaving) return;
    setPrefsSaving(true);
    setPrefsNotice('');
    const { error } = await supabase.from('notification_preferences').upsert({
      user_id: user.id,
      preferences,
    }, { onConflict: 'user_id' });
    setPrefsSaving(false);
    setPrefsNotice(error ? 'Could not save your choices. Please try again.' : 'Notification preferences saved.');
  };

  return <main className="site-shell more-page">
    <header className="subpage-header">
      <button className="back-button" type="button" onClick={() => { window.location.hash = 'profile'; }} aria-label="Back to profile">←</button>
      <div><p className="header-kicker">PROFILE</p><h1>More &amp; Settings</h1></div>
    </header>
    <section className="more-page-content">
      <p className="section-eyebrow">ATMA REKHA</p>
      <h2>More &amp; Settings</h2>
      <p className="more-page-intro">Membership, community, security and useful features for your Atma Rekha experience.</p>
      <div className="more-page-list">
        <button type="button" className="more-page-button" onClick={() => { window.location.hash = 'membership'; }}>
          <span className="more-page-button-icon" aria-hidden="true">✦</span><span><strong>Membership</strong><small>Choose or manage your Atma Rekha membership.</small></span><b aria-hidden="true">→</b>
        </button>
        <button type="button" className="more-page-button" onClick={() => { window.location.hash = 'community'; }}>
          <span className="more-page-button-icon" aria-hidden="true">→</span><span><strong>Community</strong><small>Creator updates and messages from the Atma Rekha community.</small></span><b aria-hidden="true">→</b>
        </button>
        <button type="button" className="more-page-button" onClick={() => { window.location.hash = 'group-chat'; }}>
          <span className="more-page-button-icon" aria-hidden="true">💬</span><span><strong>Group Chat</strong><small>Talk with the Atma Rekha community.</small></span><b aria-hidden="true">→</b>
        </button>
        <button type="button" className="more-page-button" onClick={() => { window.location.hash = 'security'; }}>
          <span className="more-page-button-icon" aria-hidden="true">•</span><span><strong>Security</strong><small>Two-step verification and account security.</small></span><b aria-hidden="true">→</b>
        </button>
        <button type="button" className="more-page-button" aria-expanded={settingsOpen} onClick={() => { setSettingsOpen(value => !value); setPrefsNotice(''); }}>
          <span className="more-page-button-icon" aria-hidden="true">♧</span><span><strong>Notification preferences</strong><small>Choose which updates you want to receive.</small></span><b aria-hidden="true">{settingsOpen ? '−' : '→'}</b>
        </button>
        {settingsOpen && <form className="more-page-notification-settings" onSubmit={savePreferences}>
          <div className="more-page-settings-heading"><h3>Your notifications</h3><p>Choose the alerts that matter to you. Browser permission is managed separately by your device.</p></div>
          {!user ? <p className="more-page-notice" role="status">Sign in to save your notification choices.</p> : prefsLoading ? <p className="more-page-notice">Loading preferences…</p> : <>
            {CATEGORIES.map(([key, title, description]) => <label className="more-page-pref-row" key={key}>
              <span><strong>{title}</strong><small>{description}</small></span>
              <input type="checkbox" checked={Boolean(preferences[key])} onChange={event => setPreferences(current => ({ ...current, [key]: event.target.checked }))} />
            </label>)}
            <div className="more-page-settings-actions">
              <button type="button" className="more-page-secondary" onClick={() => setPreferences(DEFAULT_PREFERENCES)}>Reset</button>
              <button type="submit" className="more-page-save" disabled={prefsSaving || prefsLoading}>{prefsSaving ? 'Saving…' : 'Save preferences'}</button>
            </div>
            <p className="more-page-notice" role="status" aria-live="polite">{prefsNotice}</p>
          </>}
        </form>}
        <button type="button" className="more-page-button more-page-install-button" onClick={handleInstall} disabled={pwa.installed} aria-describedby="more-page-install-note">
          <span className="more-page-button-icon" aria-hidden="true">↧</span><span><strong>{pwa.installed ? 'App installed' : 'Install App'}</strong><small>{pwa.installed ? 'Atma Rekha is already installed on this device.' : 'Add Atma Rekha to your home screen for a faster, app-like experience.'}</small></span><b aria-hidden="true">{pwa.installed ? '✓' : '→'}</b>
        </button>
      </div>
      <p id="more-page-install-note" className="more-page-notice" role="status" aria-live="polite">{notice}</p>
    </section>
    {showInstallHelp && <div className="more-page-modal-backdrop" role="presentation" onMouseDown={event => { if (event.target === event.currentTarget) setShowInstallHelp(false); }}>
      <section className="more-page-modal" role="dialog" aria-modal="true" aria-labelledby="more-page-modal-title">
        <div className="more-page-modal-header"><div><p className="section-eyebrow">ATMA REKHA</p><h2 id="more-page-modal-title">Install the app</h2></div><button type="button" className="more-page-modal-close" onClick={() => setShowInstallHelp(false)} aria-label="Close install instructions">×</button></div>
        {pwa.ios ? <ol><li>Open the browser Share menu.</li><li>Choose <strong>Add to Home Screen</strong>.</li><li>Tap <strong>Add</strong> to finish.</li></ol> : <ol><li>Open your browser menu for this site.</li><li>Choose <strong>Install app</strong> or <strong>Add to Home screen</strong>.</li><li>Confirm the installation when your browser asks.</li></ol>}
        <p className="more-page-modal-footnote">Once installed, the app loads the latest Atma Rekha website build whenever you are online.</p>
      </section>
    </div>}
  </main>;
}
