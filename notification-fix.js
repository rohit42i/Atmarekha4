const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const STORAGE_KEY = 'atma-rekha-notification-last-id';

async function requestChapterNotifications() {
  if (!('Notification' in window)) {
    alert('This browser does not support notifications.');
    return;
  }
  if (Notification.permission === 'denied') {
    alert('Notifications are blocked for Atma Rekha. Please allow them in Chrome site settings.');
    return;
  }
  const permission = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission();
  if (permission !== 'granted') return;
  localStorage.setItem('atma-rekha-notifications-enabled', '1');
  updateBellState();
  await checkForUpdates(true);
}

async function checkForUpdates(initial = false) {
  if (Notification.permission !== 'granted') return;
  try {
    const response = await fetch(`${API_BASE}/api/announcements`, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const items = Array.isArray(payload?.data) ? payload.data : [];
    if (!items.length) return;
    const newest = items[0];
    const newestId = String(newest._id || newest.id || newest.createdAt || newest.created_at || '');
    const previousId = localStorage.getItem(STORAGE_KEY);
    if (!previousId) {
      localStorage.setItem(STORAGE_KEY, newestId);
      return;
    }
    if (newestId === previousId) return;
    localStorage.setItem(STORAGE_KEY, newestId);
    if (initial) return;
    new Notification(newest.title || 'Atma Rekha update', {
      body: newest.content || 'A new Atma Rekha update is available.',
      icon: '/favicon.png',
      badge: '/favicon.png',
      tag: `atma-rekha-${newestId}`,
    });
  } catch (error) {
    console.warn('Notification update check skipped:', error);
  }
}

function updateBellState() {
  const button = document.querySelector('[aria-label="Notifications"], [aria-label="Chapter notifications enabled"], [aria-label="Get chapter notifications"]');
  if (!button) return;
  const enabled = 'Notification' in window && Notification.permission === 'granted';
  button.setAttribute('aria-label', enabled ? 'Chapter notifications enabled' : 'Get chapter notifications');
  button.title = enabled ? 'Chapter notifications enabled' : 'Get notified about new chapters';
  button.dataset.notificationsEnabled = enabled ? 'true' : 'false';
}

function installNotificationFix() {
  document.addEventListener('click', event => {
    const button = event.target.closest?.('[aria-label="Notifications"], [aria-label="Chapter notifications enabled"], [aria-label="Get chapter notifications"]');
    if (!button) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    requestChapterNotifications();
  }, true);
  updateBellState();
  const observer = new MutationObserver(updateBellState);
  observer.observe(document.body, { childList: true, subtree: true });
  setInterval(() => checkForUpdates(false), 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installNotificationFix, { once: true });
} else {
  installNotificationFix();
}
