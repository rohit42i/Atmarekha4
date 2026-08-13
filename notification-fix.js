import { supabase } from './supabase';

const VAPID_PUBLIC_KEY = 'BF-_uIUlnpfpyFOaGb-k9rs8kmgKTJ8GwMj2_tdzwZnld0sBnbfCJ6haKsDCc9JBDSmOcv7jIUc5e4nOXueK9Fs';
const SUBSCRIPTION_KEY = 'atma-rekha-push-registered';

function urlBase64ToUint8Array(value) {
  const padding = '='.repeat((4 - (value.length % 4)) % 4);
  const raw = atob((value + padding).replace(/-/g, '+').replace(/_/g, '/'));
  return Uint8Array.from([...raw].map(char => char.charCodeAt(0)));
}

async function registerServiceWorker() {
  const registration = await navigator.serviceWorker.register('/sw.js', {
    scope: '/',
    updateViaCache: 'none',
  });
  try { await registration.update(); } catch (_) {}
  return navigator.serviceWorker.ready;
}

async function saveSubscription(subscription) {
  const json = subscription.toJSON();
  const endpoint = json.endpoint;
  const p256dh = json.keys?.p256dh;
  const auth = json.keys?.auth;

  if (!endpoint || !p256dh || !auth) {
    throw new Error('Push subscription keys are missing.');
  }

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
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('This browser does not support Web Push.');
  }

  if (Notification.permission === 'denied') {
    throw new Error('Notifications are blocked in this browser.');
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') return null;

  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();

  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  const saved = await saveSubscription(subscription);
  console.log('[Atma Rekha Push] registered:', saved);
  return saved;
}

window.__atmaRekhaEnableNotifications = enableAtmaRekhaNotifications;

function syncBell() {
  const buttons = document.querySelectorAll(
    '[aria-label*="notification" i], button[title*="notification" i], button[title*="chapter" i]'
  );
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
      } catch (error) {
        console.error('[Atma Rekha Push]', error);
      }
    });
  }
}

async function repairExistingPermission() {
  if (Notification.permission !== 'granted') return;
  try {
    await enableAtmaRekhaNotifications();
  } catch (error) {
    console.error('[Atma Rekha Push] automatic registration failed:', error);
  }
}

function start() {
  syncBell();
  repairExistingPermission();
  const observer = new MutationObserver(syncBell);
  observer.observe(document.documentElement, { childList: true, subtree: true });
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', start, { once: true });
} else {
  start();
}
