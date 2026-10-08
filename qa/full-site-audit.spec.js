import { test, expect } from '@playwright/test';

const routes = [
  '/',
  '/chapters',
  '/chapters?lang=en',
  '/pal-do-pal-ke-lamhe',
  '/info/about',
  '/info/contact',
  '/info/report',
  '/info/privacy',
  '/info/terms',
];

const destructive = /delete|remove|logout|sign out|purchase|buy|pay|submit payment|report/i;

async function collectConsoleAndNetwork(page) {
  const issues = [];
  page.on('console', msg => {
    if (msg.type() === 'error') issues.push({ type: 'console', text: msg.text() });
  });
  page.on('requestfailed', req => {
    issues.push({ type: 'network', text: req.url() + ' — ' + (req.failure()?.errorText || 'request failed') });
  });
  page.on('response', response => {
    if (response.status() >= 500) issues.push({ type: 'http', text: response.status() + ' ' + response.url() });
  });
  return issues;
}

async function auditPage(page, route) {
  const issues = await collectConsoleAndNetwork(page);
  const response = await page.goto(route, { waitUntil: 'domcontentloaded' });
  expect(response, 'route should return a response').not.toBeNull();
  expect(response.status(), route + ' returned HTTP error').toBeLessThan(400);
  await page.waitForLoadState('networkidle').catch(() => {});

  await expect(page.locator('body')).toBeVisible();

  const brokenImages = await page.locator('img').evaluateAll(imgs =>
    imgs.filter(img => !img.complete || img.naturalWidth === 0)
      .map(img => ({ src: img.currentSrc || img.src, alt: img.alt || '' }))
  );
  expect(brokenImages, 'broken images on ' + route).toEqual([]);

  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth
  }));
  expect(overflow.scrollWidth, 'horizontal overflow on ' + route).toBeLessThanOrEqual(overflow.clientWidth + 2);

  const unlabeledControls = await page.locator('button, input, textarea, select').evaluateAll(els =>
    els.filter(el => !el.disabled).filter(el => {
      const label = el.getAttribute('aria-label') || el.getAttribute('title');
      const text = (el.innerText || '').trim();
      const placeholder = el.getAttribute('placeholder') || '';
      return !label && !text && !placeholder;
    }).map(el => el.outerHTML.slice(0, 300))
  );
  expect(unlabeledControls, 'unlabeled interactive controls on ' + route).toEqual([]);

  const links = await page.locator('a[href]').evaluateAll(as =>
    as.map(a => a.href).filter(h => h.startsWith(location.origin))
  );
  for (const href of [...new Set(links)].slice(0, 60)) {
    const r = await page.request.get(href);
    expect(r.status(), 'broken internal URL: ' + href).toBeLessThan(400);
  }

  // Exercise safe, non-destructive controls to catch dead buttons/modals.
  const controls = page.locator('button:visible, [role="button"]:visible');
  const count = Math.min(await controls.count(), 80);
  for (let i = 0; i < count; i++) {
    const c = controls.nth(i);
    const label = ((await c.innerText().catch(() => '')) + ' ' + (await c.getAttribute('aria-label').catch(() => ''))).trim();
    if (!label || destructive.test(label)) continue;
    if (!(await c.isEnabled().catch(() => false))) continue;
    await c.click({ timeout: 3000 }).catch(() => {});
    await page.waitForTimeout(150);
  }

  expect(issues, 'console/network errors on ' + route).toEqual([]);
}

test.describe('Atma Rekha full website audit', () => {
  for (const route of routes) {
    test('route audit: ' + route, async ({ page }) => {
      await auditPage(page, route);
    });
  }

  test('chapter discovery exposes chapters and reader links', async ({ page }) => {
    await page.goto('/chapters', { waitUntil: 'domcontentloaded' });
    await page.waitForLoadState('networkidle').catch(() => {});
    const chapterLinks = page.locator('a[href*="/chapter/"]');
    const count = await chapterLinks.count();
    expect(count, 'published chapter links should exist').toBeGreaterThan(0);
    const hrefs = await chapterLinks.evaluateAll(as => as.map(a => a.getAttribute('href')).filter(Boolean));
    for (const href of [...new Set(hrefs)].slice(0, 12)) {
      const response = await page.request.get(new URL(href, page.url()).href);
      expect(response.status(), 'chapter URL failed: ' + href).toBeLessThan(400);
    }
  });

  test('dark/light theme controls do not create horizontal overflow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' });
    const themeControls = page.locator('button').filter({ hasText: /dark|light|theme/i });
    if (await themeControls.count()) {
      await themeControls.first().click().catch(() => {});
      await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth <= document.documentElement.clientWidth + 2)).toBeTruthy();
      await themeControls.first().click().catch(() => {});
    }
  });
});
