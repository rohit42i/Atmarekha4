const ACTIVE_TIME_KEY = 'atma-notification-active-seconds';
const NEXT_PROMPT_KEY = 'atma-notification-next-prompt-seconds';
const PROMPT_DONE_KEY = 'atma-notification-prompt-enabled';
const FIRST_PROMPT_SECONDS = 5 * 60;
const REPEAT_PROMPT_SECONDS = 60 * 60;
const SECOND_PROMPT_DELAY_SECONDS = 30 * 60;

function getNumber(key, fallback) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) && value >= 0 ? value : fallback;
}

function isActive() {
  return document.visibilityState === 'visible' && document.hasFocus();
}

function hasNotificationsEnabled() {
  return Notification.permission === 'granted' || localStorage.getItem(PROMPT_DONE_KEY) === '1';
}

function injectStyles() {
  if (document.getElementById('atma-notification-prompt-style')) return;
  const style = document.createElement('style');
  style.id = 'atma-notification-prompt-style';
  style.textContent = `
    #atma-notification-prompt{position:fixed;right:20px;bottom:20px;z-index:100000;display:none;width:min(380px,calc(100vw - 32px));padding:20px;border:1px solid rgba(255,255,255,.12);border-radius:20px;background:var(--background,#151515);color:var(--foreground,#fff);box-shadow:0 18px 55px rgba(0,0,0,.38);font-family:inherit;animation:atmaNotifIn .25s ease}
    #atma-notification-prompt.atma-show{display:block}
    #atma-notification-prompt .atma-notif-close{position:absolute;top:9px;right:11px;border:0;background:transparent;color:inherit;opacity:.55;font-size:20px;cursor:pointer;padding:4px}
    #atma-notification-prompt .atma-notif-icon{font-size:28px;margin-bottom:8px}
    #atma-notification-prompt h3{margin:0 28px 6px 0;font-size:18px;line-height:1.25}
    #atma-notification-prompt p{margin:0 0 16px;opacity:.72;font-size:14px;line-height:1.5}
    #atma-notification-prompt .atma-notif-actions{display:flex;gap:9px}
    #atma-notification-prompt button[data-action]{flex:1;border:0;border-radius:11px;padding:10px 13px;font:inherit;font-weight:600;cursor:pointer}
    #atma-notification-prompt .atma-enable{background:var(--accent,#e879f9);color:#fff}
    #atma-notification-prompt .atma-later{background:rgba(255,255,255,.08);color:inherit}
    @keyframes atmaNotifIn{from{opacity:0;transform:translateY(12px)}to{opacity:1;transform:translateY(0)}}
  `;
  document.head.appendChild(style);
}

function buildPrompt() {
  if (document.getElementById('atma-notification-prompt')) return document.getElementById('atma-notification-prompt');
  const prompt = document.createElement('section');
  prompt.id = 'atma-notification-prompt';
  prompt.setAttribute('role', 'dialog');
  prompt.setAttribute('aria-label', 'Chapter notifications');
  prompt.innerHTML = `
    <button class="atma-notif-close" type="button" aria-label="Maybe later">×</button>
    <div class="atma-notif-icon">🔔</div>
    <h3>Don't miss the next chapter</h3>
    <p>Turn on notifications and we'll let you know when a new Atma Rekha chapter is released.</p>
    <div class="atma-notif-actions">
      <button class="atma-later" data-action="later" type="button">Maybe later</button>
      <button class="atma-enable" data-action="enable" type="button">Turn on notifications</button>
    </div>`;
  document.body.appendChild(prompt);
  return prompt;
}

function showPrompt() {
  if (hasNotificationsEnabled() || Notification.permission === 'denied') return;
  const prompt = buildPrompt();
  prompt.classList.add('atma-show');
  prompt.querySelector('[data-action="later"]').onclick = rejectPrompt;
  prompt.querySelector('.atma-notif-close').onclick = rejectPrompt;
  prompt.querySelector('[data-action="enable"]').onclick = async () => {
    const button = prompt.querySelector('[data-action="enable"]');
    button.disabled = true;
    button.textContent = 'Enabling…';
    try {
      const result = await window.__atmaRekhaEnableNotifications?.();
      if (result || Notification.permission === 'granted') {
        localStorage.setItem(PROMPT_DONE_KEY, '1');
        prompt.classList.remove('atma-show');
      } else {
        button.disabled = false;
        button.textContent = 'Turn on notifications';
        rejectPrompt();
      }
    } catch (error) {
      console.warn('[Atma Rekha Push Prompt]', error);
      button.disabled = false;
      button.textContent = 'Turn on notifications';
      if (Notification.permission === 'denied') prompt.classList.remove('atma-show');
    }
  };
}

function rejectPrompt() {
  const active = getNumber(ACTIVE_TIME_KEY, 0);
  const shownCount = getNumber('atma-notification-prompt-count', 0) + 1;
  localStorage.setItem('atma-notification-prompt-count', String(shownCount));
  const delay = shownCount === 1 ? SECOND_PROMPT_DELAY_SECONDS : REPEAT_PROMPT_SECONDS;
  localStorage.setItem(NEXT_PROMPT_KEY, String(active + delay));
  document.getElementById('atma-notification-prompt')?.classList.remove('atma-show');
}

function tick() {
  if (!isActive() || hasNotificationsEnabled() || Notification.permission === 'denied') return;
  const active = getNumber(ACTIVE_TIME_KEY, 0) + 1;
  localStorage.setItem(ACTIVE_TIME_KEY, String(active));
  const next = getNumber(NEXT_PROMPT_KEY, FIRST_PROMPT_SECONDS);
  if (active >= next && !document.getElementById('atma-notification-prompt')?.classList.contains('atma-show')) showPrompt();
}

function start() {
  if (!('Notification' in window)) return;
  injectStyles();
  if (Notification.permission === 'granted') localStorage.setItem(PROMPT_DONE_KEY, '1');
  setInterval(tick, 1000);
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start, { once: true });
else start();
