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
  const [notice, setNotice] = useState('');
  const [user, setUser] = useState(null);
  const [preferences, setPreferences] = useState(DEFAULT_PREFERENCES);
  const [emailChapterAnnouncements, setEmailChapterAnnouncements] = useState(false);
  const [savedEmailChapterAnnouncements, setSavedEmailChapterAnnouncements] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [prefsLoading, setPrefsLoading] = useState(true);
  const [prefsLoadFailed, setPrefsLoadFailed] = useState(false);
  const [prefsSaving, setPrefsSaving] = useState(false);
  const [prefsNotice, setPrefsNotice] = useState('');

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const onPwaState = event => setPwa(event.detail || initialPwaState());
    window.addEventListener('atma:pwa-state', onPwaState);
    if (window.__atmaPwaState) setPwa(window.__atmaPwaState);

    const loadPreferences = async nextUser => {
      const request = ++requestId;
      setUser(nextUser || null);
      setPrefsNotice('');

      if (!nextUser) {
        setPreferences({ ...DEFAULT_PREFERENCES });
        setEmailChapterAnnouncements(false);
        setSavedEmailChapterAnnouncements(false);
        setPrefsLoadFailed(false);
        setPrefsLoading(false);
        return;
      }

      setPrefsLoading(true);
      setPrefsLoadFailed(false);
      try {
        const { data: row, error } = await supabase
          .from('notification_preferences')
          .select('preferences')
          .eq('user_id', nextUser.id)
          .maybeSingle();
        if (error) throw error;

        const saved = row?.preferences && typeof row.preferences === 'object' && !Array.isArray(row.preferences)
          ? row.preferences
          : {};
        const normalized = Object.fromEntries(CATEGORIES.map(([key]) => [key, saved[key] !== false]));
        if (active && request === requestId) setPreferences(normalized);
        const { data: emailChoice, error: emailChoiceError } = await supabase.functions.invoke('update-chapter-email-preference', { body: { action: 'get' } });
        if (emailChoiceError || emailChoice?.ok !== true) throw new Error('email-preferences-unavailable');
        if (active && request === requestId) {
          const enabled = emailChoice.enabled === true;
          setEmailChapterAnnouncements(enabled);
          setSavedEmailChapterAnnouncements(enabled);
        }
      } catch (loadError) {
        console.warn('Notification preferences could not be loaded.');
        if (active && request === requestId) {
          setPrefsLoadFailed(true);
          setPrefsNotice('Could not load your saved choices. Refresh the page and try again. Your saved settings were not changed.');
        }
      } finally {
        if (active && request === requestId) setPrefsLoading(false);
      }
    };

    const loadUser = async () => {
      try {
        const { data, error } = await supabase.auth.getUser();
        if (error) throw error;
        if (active) await loadPreferences(data?.user || null);
      } catch {
        if (!active) return;
        requestId += 1;
        setUser(null);
        setPreferences({ ...DEFAULT_PREFERENCES });
        setPrefsLoadFailed(true);
        setPrefsNotice('Unable to confirm your sign-in status. Refresh the page and try again.');
        setPrefsLoading(false);
      }
    };

    loadUser();
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      queueMicrotask(() => {
        if (active) loadPreferences(session?.user || null);
      });
    });

    return () => {
      active = false;
      requestId += 1;
      window.removeEventListener('atma:pwa-state', onPwaState);
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleInstall = async () => {
    setNotice('');
    const result = await window.__atmaPwaInstall?.();
    if (!result || result.status === 'manual') {
      setNotice(result?.platform === 'ios'
        ? 'On iPhone or iPad, use Share, then Add to Home Screen.'
        : 'For one-tap installation, open Atma Rekha in Chrome and tap Install again.');
    } else if (result.status === 'accepted' || result.status === 'installed') {
      setNotice('Atma Rekha is installed and will receive the latest website updates when you are online.');
    } else if (result.status === 'dismissed') {
      setNotice('Installation was cancelled. Tap Install to try again.');
    }
  };

  const savePreferences = async event => {
    event.preventDefault();
    if (!user || prefsSaving || prefsLoading || prefsLoadFailed) return;

    setPrefsSaving(true);
    setPrefsNotice('');
    const normalized = Object.fromEntries(CATEGORIES.map(([key]) => [key, Boolean(preferences[key])]));

    try {
      const { data: authData, error: authError } = await supabase.auth.getUser();
      if (authError || authData?.user?.id !== user.id) {
        throw new Error('session-mismatch');
      }

      const { data: savedRow, error } = await supabase
        .from('notification_preferences')
        .upsert({ user_id: authData.user.id, preferences: normalized }, { onConflict: 'user_id' })
        .select('preferences')
        .single();
      if (error) throw error;

      const saved = savedRow?.preferences && typeof savedRow.preferences === 'object' && !Array.isArray(savedRow.preferences)
        ? savedRow.preferences
        : normalized;
      setPreferences(Object.fromEntries(CATEGORIES.map(([key]) => [key, saved[key] !== false])));
      if (emailChapterAnnouncements !== savedEmailChapterAnnouncements) {
        const { data: emailResult, error: emailError } = await supabase.functions.invoke('update-chapter-email-preference', {
          body: { action: 'set', enabled: emailChapterAnnouncements },
        });
        if (emailError || !emailResult?.ok) throw new Error('Your notification settings were saved, but the chapter email preference could not be updated. Try saving again.');
        setSavedEmailChapterAnnouncements(emailChapterAnnouncements);
      }
      setPrefsNotice('Preferences saved. They apply to future notification alerts.');
    } catch (saveError) {
      console.warn('Notification preference save failed.');
      setPrefsNotice(saveError?.message === 'session-mismatch'
        ? 'Your sign-in session changed. Sign in again before saving.'
        : saveError?.message?.includes('chapter email preference could not be updated')
          ? 'Notification preferences were saved, but the chapter email choice could not be updated. Please retry saving.'
          : 'Could not save preferences. Check your connection and try again.');
    } finally {
      setPrefsSaving(false);
    }
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
        <button type="button" className="more-page-button" aria-expanded={settingsOpen} onClick={() => setSettingsOpen(value => !value)}>
          <span className="more-page-button-icon" aria-hidden="true">♧</span><span><strong>Notification preferences</strong><small>Choose which updates you want to receive.</small></span><b aria-hidden="true">{settingsOpen ? '−' : '→'}</b>
        </button>
        {settingsOpen && <form className="more-page-notification-settings" onSubmit={savePreferences}>
          <div className="more-page-settings-heading"><h3>Your notifications</h3><p>Choose the alerts that matter to you. Browser permission is managed separately by your device.</p></div>
          {prefsLoading ? <p className="more-page-notice" role="status">Loading saved notification preferences…</p> : !user ? <p className="more-page-notice" role="status">{prefsNotice || 'Sign in to save your notification choices.'}</p> : prefsLoadFailed ? <p className="more-page-notice" role="alert">{prefsNotice || 'Could not load your saved choices. Refresh the page and try again.'}</p> : <>
            <label className="more-page-pref-row">
              <span><strong>Email updates</strong><small>New chapter announcements and important Atma Rekha updates. You can turn these off here or unsubscribe from an email.</small></span>
              <input type="checkbox" checked={emailChapterAnnouncements} disabled={prefsSaving || prefsLoading || prefsLoadFailed || !user?.email_confirmed_at} onChange={event => setEmailChapterAnnouncements(event.target.checked)} />
            </label>
            {!user?.email_confirmed_at && <p className="more-page-notice">Verify your email address to enable chapter emails.</p>}
            {CATEGORIES.map(([key, title, description]) => <label className="more-page-pref-row" key={key}>
              <span><strong>{title}</strong><small>{description}</small></span>
              <input type="checkbox" checked={Boolean(preferences[key])} disabled={prefsSaving || prefsLoading || prefsLoadFailed} onChange={event => setPreferences(current => ({ ...current, [key]: event.target.checked }))} />
            </label>)}
            <div className="more-page-settings-actions">
              <button type="button" className="more-page-secondary" disabled={prefsSaving || prefsLoading || prefsLoadFailed} onClick={() => setPreferences({ ...DEFAULT_PREFERENCES })}>Reset defaults</button>
              <button type="submit" className="more-page-save" disabled={prefsSaving || prefsLoading || prefsLoadFailed}>{prefsSaving ? 'Saving…' : 'Save preferences'}</button>
            </div>
            <p className="more-page-notice" role={prefsNotice.startsWith('Could not') || prefsNotice.startsWith('Unable') || prefsNotice.startsWith('Your sign-in') ? 'alert' : 'status'} aria-live="polite">{prefsNotice}</p>
          </>}
        </form>}
        <button type="button" className="more-page-button more-page-install-button" onClick={handleInstall} disabled={pwa.installed} aria-describedby="more-page-install-note">
          <span className="more-page-button-icon" aria-hidden="true">↧</span><span><strong>{pwa.installed ? 'App installed' : 'Install Atma Rekha'}</strong><small>{pwa.installed ? 'Already installed. Updates automatically when you are online.' : 'Install the latest Atma Rekha website as an app.'}</small></span><b aria-hidden="true">{pwa.installed ? '✓' : '→'}</b>
        </button>
      </div>
      <p id="more-page-install-note" className="more-page-notice" role="status" aria-live="polite">{notice}</p>
    </section>
  </main>;
}
