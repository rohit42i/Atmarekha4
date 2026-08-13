import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BF-_uIUlnpfpyFOaGb-k9rs8kmgKTJ8GwMj2_tdzwZnld0sBnbfCJ6haKsDCc9JBDSmOcv7jIUc5e4nOXueK9Fs';
const SUBSCRIPTION_KEY = 'atma-rekha-push-registered';

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/', updateViaCache: 'none' });
  try { await registration.update(); } catch (_) {}
  return navigator.serviceWorker.ready;
}

async function saveSubscription(subscription) {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;
  if (!endpoint || !p256dh || !auth) throw new Error('Push subscription keys are missing.');
  const { data, error } = await supabase.rpc('register_push_subscription', {
    p_endpoint: endpoint,
    p_p256dh: p256dh,
    p_auth: auth,
  });
  if (error) throw new Error(`Supabase push registration failed: ${error.message}`);
  if (!data) throw new Error('Supabase push registration returned no data.');
  localStorage.setItem(SUBSCRIPTION_KEY, '1');
  return data;
}

export async function enableAtmaRekhaNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('This browser does not support Web Push.');
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked in this browser.');
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) subscription = await registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) });
  const saved = await saveSubscription(subscription);
  console.log('[Atma Rekha Push] registered:', saved);
  return saved;
}

window.__atmaRekhaEnableNotifications = enableAtmaRekhaNotifications;

function syncBell() {
  const buttons = document.querySelectorAll('[aria-label*="notification" i], button[title*="notification" i], button[title*="chapter" i]');
  for (const button of buttons) {
    if (button.dataset.atmaPushBound === '1') continue;
    button.dataset.atmaPushBound = '1';
    button.addEventListener('click', async event => {
      event.preventDefault();
      event.stopPropagation();
      try {
        await enableAtmaRekhaNotifications();
        button.setAttribute('aria-label', 'Chapter notifications enabled');
        button.title = 'Chapter notifications enabled';
      } catch (error) { console.error('[Atma Rekha Push]', error); }
    });
  }
}

async function repairExistingPermission() {
  if (Notification.permission !== 'granted') return;
  try { await enableAtmaRekhaNotifications(); }
  catch (error) { console.error('[Atma Rekha Push] automatic registration failed:', error); }
}

async function verifyAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Please sign in to the admin account.');
  const { data, error } = await supabase.from('admins').select('user_id').eq('user_id', user.id).maybeSingle();
  if (error) throw new Error(`Admin verification failed: ${error.message}`);
  if (!data) throw new Error('Admin access required.');
}

function addAdminNotificationTool() {
  const nav = document.querySelector('.admin-tabs');
  if (!nav || nav.querySelector('[data-atma-admin-notification-tab="1"]')) return;
  const button = document.createElement('button');
  button.type = 'button';
  button.textContent = 'Notifications';
  button.dataset.atmaAdminNotificationTab = '1';
  button.className = 'admin-tab';
  nav.appendChild(button);
  button.addEventListener('click', event => {
    event.preventDefault();
    event.stopPropagation();
    openAdminNotificationPanel();
  });
}

function openAdminNotificationPanel() {
  const existing = document.getElementById('atma-admin-notifications');
  if (existing) {
    existing.scrollIntoView({ behavior: 'smooth', block: 'start' });
    return;
  }
  const host = document.querySelector('.admin-tabs')?.parentElement;
  if (!host) return;
  const panel = document.createElement('section');
  panel.id = 'atma-admin-notifications';
  panel.className = 'admin-card';
  panel.style.marginTop = '20px';
  panel.innerHTML = `
    <div class="admin-card-title"><div><span>WEB PUSH</span><h2>Send notification</h2><p>Send a custom notification to every active push subscriber. Recipients do not need an account or membership.</p></div></div>
    <form id="atma-admin-notification-form" class="admin-form">
      <input id="atma-notification-title" maxlength="100" placeholder="Notification title" required />
      <textarea id="atma-notification-message" maxlength="500" rows="5" placeholder="Notification message" required></textarea>
      <input id="atma-notification-url" value="/" placeholder="Open URL, e.g. /chapter/4" required />
      <div style="border:1px solid rgba(255,255,255,.1);border-radius:16px;padding:14px;color:#a1a1aa;font-size:14px"><strong style="color:white">Recipients:</strong> all active push subscribers</div>
      <button id="atma-send-notification" class="admin-submit" type="submit">🔔 Send notification to all</button>
      <div id="atma-notification-result" style="display:none"></div>
    </form>`;
  host.appendChild(panel);
  panel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  panel.querySelector('#atma-admin-notification-form').addEventListener('submit', async event => {
    event.preventDefault();
    const sendButton = panel.querySelector('#atma-send-notification');
    const result = panel.querySelector('#atma-notification-result');
    const title = panel.querySelector('#atma-notification-title').value.trim();
    const message = panel.querySelector('#atma-notification-message').value.trim();
    const url = panel.querySelector('#atma-notification-url').value.trim() || '/';
    if (!title || !message) return;
    if (!url.startsWith('/')) { result.style.display = 'block'; result.textContent = 'Open URL must begin with /. Example: /chapter/4'; return; }
    sendButton.disabled = true;
    sendButton.textContent = 'Sending…';
    result.style.display = 'none';
    try {
      await verifyAdmin();
      const { data, error } = await supabase.functions.invoke('send-chapter-notification-v2', { body: { title, body: message, url, tag: `custom-${Date.now()}`, renotify: true } });
      if (error) throw new Error(error.message || 'Notification request failed.');
      if (data?.error) throw new Error(data.error);
      result.style.display = 'block';
      result.style.border = '1px solid rgba(16,185,129,.35)';
      result.style.borderRadius = '16px';
      result.style.padding = '14px';
      result.style.marginTop = '8px';
      result.style.color = '#6ee7b7';
      result.textContent = `✅ Sent: ${data?.sent ?? 0} · Failed: ${data?.failed ?? 0} · Removed: ${data?.removed ?? 0} · Total: ${data?.total ?? 0}`;
      panel.querySelector('#atma-notification-title').value = '';
      panel.querySelector('#atma-notification-message').value = '';
    } catch (error) {
      console.error('[Atma Rekha Push] custom notification failed:', error);
      result.style.display = 'block';
      result.style.color = '#fda4af';
      result.textContent = `❌ ${error.message || 'Unable to send notification.'}`;
    } finally {
      sendButton.disabled = false;
      sendButton.textContent = '🔔 Send notification to all';
    }
  });
}

function start() {
  syncBell();
  repairExistingPermission();
  addAdminNotificationTool();
  const observer = new MutationObserver(() => {
    syncBell();
    addAdminNotificationTool();
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
