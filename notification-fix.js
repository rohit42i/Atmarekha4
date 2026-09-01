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
  const { data, error } = await supabase.functions.invoke('register-push-subscription', {
    body: { p_endpoint: endpoint, p_p256dh: p256dh, p_auth: auth },
  });
  if (error) throw new Error(`Supabase push registration failed: ${error.message}`);
  if (!data?.data) throw new Error('Supabase push registration returned no data.');
  localStorage.setItem(SUBSCRIPTION_KEY, '1');
  return data.data;
}

export async function enableAtmaRekhaNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    throw new Error('This browser does not support Web Push.');
  }
  if (Notification.permission === 'denied') throw new Error('Notifications are blocked in this browser.');
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return null;
  const registration = await registerServiceWorker();
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }
  return saveSubscription(subscription);
}

// The notification prompt is the only user-facing opt-in entry point.
// Do not attach push registration to unrelated navigation or chapter buttons.
window.__atmaRekhaEnableNotifications = enableAtmaRekhaNotifications;
