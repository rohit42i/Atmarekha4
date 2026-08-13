import { buildChapters } from './chapters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY;
const VAPID_PUBLIC_KEY = 'BF-_uIUlnpfpyFOaGb-k9rs8kmgKTJ8GwMj2_tdzwZnld0sBnbfCJ6haKsDCc9JBDSmOcv7jIUc5e4nOXueK9Fs';

function findBell() { return document.querySelector('[aria-label="Notifications"],[aria-label="Chapter notifications enabled"],[aria-label="Get chapter notifications"],button[title*="notification" i],button[title*="chapter" i]'); }
function syncBellVisibility() {
  const button = findBell(); if (!button) return;
  const supported = 'Notification' in window && 'serviceWorker' in navigator && 'PushManager' in window;
  const denied = 'Notification' in window && Notification.permission === 'denied';
  button.style.display = supported && !denied ? '' : 'none';
  if (supported && !denied) { const enabled = Notification.permission === 'granted'; button.setAttribute('aria-label', enabled ? 'Chapter notifications enabled' : 'Get chapter notifications'); button.title = enabled ? 'Chapter notifications enabled' : 'Get notified about new chapters'; }
}
function urlBase64ToUint8Array(base64String) { const padding = '='.repeat((4 - (base64String.length % 4)) % 4); const rawData = atob((base64String + padding).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...rawData].map(c => c.charCodeAt(0))); }
async function registerServiceWorker() { const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' }); try { await registration.update(); } catch (_) {} return navigator.serviceWorker.ready; }
async function saveSubscription(subscription) {
  if (!SUPABASE_URL || !SUPABASE_KEY) throw new Error('Supabase configuration is missing.');
  const json = subscription.toJSON(); const endpoint = json.endpoint; const p256dh = json.keys?.p256dh; const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error('Push subscription keys are missing.');
  const response = await fetch(`${SUPABASE_URL}/rest/v1/push_subscriptions`, { method: 'POST', headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}`, 'Content-Type': 'application/json', Prefer: 'resolution=ignore-duplicates,return=minimal' }, body: JSON.stringify({ endpoint, p256dh, auth, user_id: null }) });
  if (!response.ok) { const text = await response.text(); throw new Error(`Push subscription save failed (${response.status}): ${text}`); }
}
async function subscribeToPush() { const registration = await registerServiceWorker(); let subscription = await registration.pushManager.getSubscription(); if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) }); await saveSubscription(subscription); return subscription; }
async function requestChapterNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window) || Notification.permission === 'denied') return;
  try { const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission(); if (permission !== 'granted') return; await subscribeToPush(); localStorage.setItem('atma-rekha-notifications-enabled', '1'); syncBellVisibility(); await establishBaselines(); console.log('Atma Rekha notifications: subscription saved successfully.'); } catch (error) { console.error('Atma Rekha notifications failed:', error); }
}
async function establishBaselines() {
  try { const response = await fetch(`${API_BASE}/api/announcements`, { cache: 'no-store' }); if (response.ok) { const payload = await response.json(); const items = Array.isArray(payload?.data) ? payload.data : []; if (items[0]) localStorage.setItem('atma-rekha-notification-last-announcement', String(items[0]._id || items[0].id || items[0].createdAt || items[0].created_at || '')); } } catch (_) {}
  try { const chapters = (await buildChapters()).filter(c => String(c?.status || '').toLowerCase() === 'published').sort((a,b) => Number(b.chapterNumber) - Number(a.chapterNumber)); if (chapters[0]) localStorage.setItem('atma-rekha-notification-last-chapter', String(chapters[0]._id || chapters[0].id || chapters[0].createdAt || chapters[0].created_at || chapters[0].chapterNumber)); } catch (_) {}
}
function installNotificationFix() { document.addEventListener('click', event => { const button = event.target.closest?.('[aria-label="Notifications"],[aria-label="Chapter notifications enabled"],[aria-label="Get chapter notifications"],button[title*="notification" i],button[title*="chapter" i]'); if (!button) return; event.preventDefault(); event.stopImmediatePropagation(); requestChapterNotifications(); }, true); syncBellVisibility(); new MutationObserver(syncBellVisibility).observe(document.body, { childList: true, subtree: true }); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', installNotificationFix, { once: true }); else installNotificationFix();