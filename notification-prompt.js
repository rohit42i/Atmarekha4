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
    #atma-notification-prompt{position:fixed;right:24px;bottom:24px;z-index:100000;display:none;width:min(392px,calc(100vw - 32px));padding:24px;border:1px solid #2b2b2f;border-radius:22px;background:#111214;color:#f7f7f8;box-shadow:0 20px 60px rgba(0,0,0,.42);font-family:inherit;animation:atmaNotifIn .24s ease;box-sizing:border-box}
    #atma-notification-prompt.atma-show{display:block}
    #atma-notification-prompt .atma-notif-close{position:absolute;top:12px;right:12px;width:40px;height:40px;border:0;border-radius:50%;background:#1c1d20;color:#f7f7f8;opacity:.78;font-size:21px;line-height:1;cursor:pointer;padding:0}
    #atma-notification-prompt .atma-notif-icon{width:44px;height:44px;display:grid;place-items:center;margin-bottom:16px;border:1px solid #2d3035;border-radius:14px;background:#191b1f;font-size:21px}
    #atma-notification-prompt h3{margin:0 44px 8px 0;font-size:20px;font-weight:650;line-height:1.2;letter-spacing:-.025em}
    #atma-notification-prompt p{margin:0 0 20px;max-width:330px;color:#aeb1b8;font-size:14px;line-height:1.55}
    #atma-notification-prompt .atma-notif-actions{display:grid;grid-template-columns:1fr 1.35fr;gap:10px}
    #atma-notification-prompt button[data-action]{min-height:46px;border:1px solid #303238;border-radius:12px;padding:0 14px;font:inherit;font-size:13px;font-weight:650;line-height:1.2;cursor:pointer}
    #atma-notification-prompt .atma-enable{background:#f5f5f5;color:#111214}
    #atma-notification-prompt .atma-later{background:#1a1c20;color:#f1f2f4}
    #atma-notification-prompt button[data-action]:hover{border-color:#484b53}
    #atma-notification-prompt button[data-action]:active{transform:scale(.98)}
    @keyframes atmaNotifIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}
  `;

  document.head.appendChild(style);
  if (!document.getElementById('atma-notification-prompt-mobile-style')) {
    const mobile = document.createElement('style');
    mobile.id = 'atma-notification-prompt-mobile-style';
    mobile.textContent = `@media(max-width:480px){#atma-notification-prompt{right:12px;bottom:calc(12px + env(safe-area-inset-bottom));width:calc(100vw - 24px);padding:20px;border-radius:20px}#atma-notification-prompt .atma-notif-actions{grid-template-columns:1fr;gap:8px}#atma-notification-prompt button[data-action]{min-height:48px}}`;
    document.head.appendChild(mobile);
  }
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
