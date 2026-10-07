const CACHE = 'atma-rekha-offline-reading-v1';
const INDEX = 'atma-rekha-offline-index-v1';

async function readIndex() {
  try {
    const cache = await caches.open(INDEX);
    const response = await cache.match('/__offline_index__');
    return response ? await response.json() : {};
  } catch { return {}; }
}

async function writeIndex(index) {
  const cache = await caches.open(INDEX);
  await cache.put('/__offline_index__', new Response(JSON.stringify(index), { headers: { 'Content-Type': 'application/json' } }));
}

export async function saveOfflineChapter({ id, title, pageUrls = [] }) {
  const cleanUrls = [...new Set(pageUrls.filter(Boolean))];
  const cache = await caches.open(CACHE);
  await Promise.all(cleanUrls.map(async url => {
    try { const response = await fetch(url, { mode: 'cors', credentials: 'omit' }); if (response.ok) await cache.put(url, response.clone()); } catch {}
  }));
  const index = await readIndex();
  index[id] = { id, title, pageUrls: cleanUrls, savedAt: new Date().toISOString() };
  await writeIndex(index);
  window.dispatchEvent(new CustomEvent('atma-toast', { detail: { message: 'Chapter saved for offline reading.' } }));
  return index[id];
}

export async function removeOfflineChapter(id) {
  const cache = await caches.open(CACHE);
  const index = await readIndex();
  const item = index[id];
  for (const url of item?.pageUrls || []) await cache.delete(url);
  delete index[id];
  await writeIndex(index);
  window.dispatchEvent(new CustomEvent('atma-toast', { detail: { message: 'Offline copy removed.' } }));
}

export async function getOfflineChapter(id) {
  const index = await readIndex();
  return index[id] || null;
}

export async function listOfflineChapters() {
  return readIndex();
}
