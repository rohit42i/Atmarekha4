/* Atma Rekha Admin — self-hosted font loading
 * Font files are bundled through npm + Vite; no external font CDN.
 * This module only registers @font-face declarations and preloads the
 * critical Latin variable fonts. It does not style public-site elements.
 */
import manropeSrc from '@fontsource-variable/manrope/files/manrope-latin-wght-normal.woff2';
import spaceGroteskSrc from '@fontsource-variable/space-grotesk/files/space-grotesk-latin-wght-normal.woff2';

const FONT_STYLE_ID = 'ar-admin-font-faces';

if (typeof document !== 'undefined' && !document.getElementById(FONT_STYLE_ID)) {
  const fontDefinitions = [
    {
      family: 'AR Admin UI',
      source: manropeSrc,
      weight: '200 800',
    },
    {
      family: 'AR Admin Display',
      source: spaceGroteskSrc,
      weight: '300 700',
    },
  ];

  for (const font of fontDefinitions) {
    const preload = document.createElement('link');
    preload.rel = 'preload';
    preload.as = 'font';
    preload.type = 'font/woff2';
    preload.crossOrigin = 'anonymous';
    preload.fetchPriority = 'high';
    preload.href = font.source;
    preload.dataset.arAdminFont = font.family;
    document.head.appendChild(preload);
  }

  const style = document.createElement('style');
  style.id = FONT_STYLE_ID;
  style.textContent = fontDefinitions.map(font => `
@font-face {
  font-family: "${font.family}";
  src: url("${font.source}") format("woff2");
  font-style: normal;
  font-weight: ${font.weight};
  font-display: swap;
}`).join('\n');

  document.head.appendChild(style);
}
