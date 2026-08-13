import { buildChapters } from './chapters';
import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BF-_uIUlnpfpyFOaGb-k9rs8kmgKTJ8GwMj2_tdzwZnld0sBnbfCJ6haKsDCc9JBDSmOcv7jIUc5e4nOXueK9Fs';
const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const ANNOUNCEMENT_KEY = 'atma-rekha-notification-last-announcement';
const CHAPTER_KEY = 'atma-rekha-notification-last-chapter';

function newestId(item) { return String(item?._id || item?.id || item?.createdAt || item?.created_at || ''); }
function findBell() { return document.querySelector('[aria-label="Notifications"], [aria-label="Chapter notifications enabled"], [aria-label="Get chapter notifications"], button[title*="notification" i], button[title*="chapter" i]'); }
function syncBellVisibility() {
  const button = findBell(); if (!button) return;
  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const denied = supported && Notification.permission === 'denied';
  button.style.display = supported && !denied ? '' : 'none';
  if (supported && !denied) { const enabled = Notification.permission === 'granted'; button.setAttribute('aria-label', enabled ? 'Chapter notifications enabled' : 'Get chapter notifications'); button.title = enabled ? 'Chapter notifications enabled' : 'Get notified about new chapters'; button.dataset.notificationsEnabled = enabled ? 'true' : 'false'; }
}

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  return Uint8Array.from([...rawData].map(char => char.charCodeAt(0)));
}

async function savePushSubscription(subscription) {
  const { data: { user }, error: userError } = await supabase.auth.getUser();
  if (userError || !user) throw new Error('Please sign in to enable chapter notifications.');
  const json = subscription.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) throw new Error('Chrome returned an invalid push subscription.');
  const { error } = await supabase.from('push_subscriptions').upsert({ user_id: user.id, endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, updated_at: new Date().toISOString() }, { onConflict: 'endpoint' });
  if (error) throw error;
}

async function requestChapterNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission === 'denied') return syncBellVisibility();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    window.dispatchEvent(new CustomEvent('atma-auth-required', { detail: { reason: 'notifications' } }));
    return;
  }
  let permission;
  try { permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); }
  catch { return syncBellVisibility(); }
  if (permission !== 'granted') return syncBellVisibility();
  try {
    const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
    const ready = await navigator.serviceWorker.ready;
    let subscription = await ready.pushManager.getSubscription();
    if (!subscription) subscription = await ready.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
    await savePushSubscription(subscription);
    localStorage.setItem('atma-rekha-notifications-enabled', '1');
    syncBellVisibility();
    try { await ready.showNotification('Atma Rekha notifications enabled', { body: 'You will be notified when new chapters are released.', icon: '/favicon.png', badge: '/favicon.png', tag: 'atma-rekha-notification-enabled' }); } catch {}
    await establishBaselines();
  } catch (error) {
    console.warn('Push notification setup failed:', error);
    try { new Notification('Atma Rekha', { body: 'Notifications could not be enabled. Please try again.' }); } catch {}
  }
}

async function establishBaselines() {
  try { const response = await fetch(`${API_BASE}/api/announcements`, { cache: 'no-store' }); if (response.ok) { const payload = await response.json(); const items = Array.isArray(payload?.data) ? payload.data : []; if (items[0]) localStorage.setItem(ANNOUNCEMENT_KEY, newestId(items[0])); } } catch (error) { console.warn('Announcement baseline skipped:', error); }
  try { const chapters = (await buildChapters()).filter(chapter => String(chapter?.status || '').toLowerCase() === 'published').sort((a, b) => Number(b.chapterNumber) - Number(a.chapterNumber)); if (chapters[0]) localStorage.setItem(CHAPTER_KEY, newestId(chapters[0]) || String(chapters[0].chapterNumber)); } catch (error) { console.warn('Chapter notification baseline skipped:', error); }
}

function installNotificationFix() {
  document.addEventListener('click', event => { const button = event.target.closest?.('[aria-label="Notifications"], [aria-label="Chapter notifications enabled"], [aria-label="Get chapter notifications"], button[title*="notification" i], button[title*="chapter" i]'); if (!button) return; event.preventDefault(); event.stopImmediatePropagation(); requestChapterNotifications(); }, true);
  syncBellVisibility(); const observer = new MutationObserver(syncBellVisibility); observer.observe(document.body, { childList: true, subtree: true });
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installNotificationFix, { once: true }); else installNotificationFix();
