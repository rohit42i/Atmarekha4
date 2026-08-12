import { buildChapters } from './chapters';

const API_BASE = import.meta.env.VITE_API_BASE_URL || window.location.origin;
const ANNOUNCEMENT_KEY = 'atma-rekha-notification-last-announcement';
const CHAPTER_KEY = 'atma-rekha-notification-last-chapter';

function newestId(item) {
  return String(item?._id || item?.id || item?.createdAt || item?.created_at || '');
}

async function requestChapterNotifications() {
  if (!('Notification' in window)) {
    alert('This browser does not support notifications.');
    return;
  }

  if (Notification.permission === 'denied') {
    alert('Notifications are blocked for Atma Rekha. Please allow them in Chrome site settings.');
    return;
  }

  const permission = Notification.permission === 'granted'
    ? 'granted'
    : await Notification.requestPermission();

  if (permission !== 'granted') return;

  localStorage.setItem('atma-rekha-notifications-enabled', '1');
  updateBellState();

  // Give the reader immediate confirmation that Chrome notifications are enabled.
  new Notification('Atma Rekha notifications enabled', {
    body: 'You will be notified about new chapter updates.',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'atma-rekha-notification-enabled',
  });

  await establishBaselines();
}

async function establishBaselines() {
  try {
    const response = await fetch(`${API_BASE}/api/announcements`, { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      if (items[0]) localStorage.setItem(ANNOUNCEMENT_KEY, newestId(items[0]));
    }
  } catch (error) {
    console.warn('Announcement baseline skipped:', error);
  }

  try {
    const chapters = (await buildChapters())
      .filter(chapter => String(chapter?.status || '').toLowerCase() === 'published')
      .sort((a, b) => Number(b.chapterNumber) - Number(a.chapterNumber));
    if (chapters[0]) localStorage.setItem(CHAPTER_KEY, newestId(chapters[0]) || String(chapters[0].chapterNumber));
  } catch (error) {
    console.warn('Chapter notification baseline skipped:', error);
  }
}

async function checkForUpdates() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;

  try {
    const response = await fetch(`${API_BASE}/api/announcements`, { cache: 'no-store' });
    if (response.ok) {
      const payload = await response.json();
      const items = Array.isArray(payload?.data) ? payload.data : [];
      const newest = items[0];
      if (newest) {
        const id = newestId(newest);
        const previous = localStorage.getItem(ANNOUNCEMENT_KEY);
        if (previous && id && previous !== id) {
          localStorage.setItem(ANNOUNCEMENT_KEY, id);
          showNotification(newest.title || 'Atma Rekha update', newest.content || 'A new update is available.', id);
        } else if (!previous && id) {
          localStorage.setItem(ANNOUNCEMENT_KEY, id);
        }
      }
    }
  } catch (error) {
    console.warn('Announcement check skipped:', error);
  }

  try {
    const chapters = (await buildChapters())
      .filter(chapter => String(chapter?.status || '').toLowerCase() === 'published')
      .sort((a, b) => Number(b.chapterNumber) - Number(a.chapterNumber));
    const newest = chapters[0];
    if (!newest) return;

    const id = newestId(newest) || String(newest.chapterNumber);
    const previous = localStorage.getItem(CHAPTER_KEY);
    if (previous && id !== previous) {
      localStorage.setItem(CHAPTER_KEY, id);
      showNotification(
        `Chapter ${newest.chapterNumber} is live!`,
        newest.title ? `${newest.title} is now available to read.` : 'A new Atma Rekha chapter is now available.',
        `chapter-${id}`
      );
    } else if (!previous) {
      localStorage.setItem(CHAPTER_KEY, id);
    }
  } catch (error) {
    console.warn('Chapter check skipped:', error);
  }
}

function showNotification(title, body, tag) {
  new Notification(title, {
    body,
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: `atma-rekha-${tag}`,
  });
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
  // Capture the existing bell click before React's dropdown handler.
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

  // While the site is open, check once a minute for a new chapter/update.
  setInterval(checkForUpdates, 60000);
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', installNotificationFix, { once: true });
} else {
  installNotificationFix();
}
