import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';
import { buildChapters } from './chapters';

const PAGES = 'chapter_pages';

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your Supabase session has expired.');
  const role = await getAdminRole(user.id);
  if (!role) throw new Error('Admin access required.');
}

function probeImage(url) {
  return new Promise(resolve => {
    const value = String(url || '').trim();
    if (!/^https?:\/\//i.test(value)) return resolve(false);
    const image = new Image();
    const finish = ok => { image.onload = null; image.onerror = null; clearTimeout(timer); resolve(ok); };
    const timer = setTimeout(() => finish(false), 8000);
    image.onload = () => finish(image.naturalWidth > 0 && image.naturalHeight > 0);
    image.onerror = () => finish(false);
    image.src = value;
  });
}

function checkChapter(chapter, pages) {
  const issues = [];
  const sorted = [...pages].sort((a, b) => Number(a.page_number) - Number(b.page_number));
  const numbers = sorted.map(p => Number(p.page_number));
  const finite = numbers.filter(Number.isFinite);
  const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i && Number.isInteger(n));
  const max = finite.length ? Math.max(...finite) : 0;
  const missing = max ? Array.from({ length: max }, (_, i) => i + 1).filter(n => !numbers.includes(n)) : [];
  if (!chapter.title?.trim()) issues.push('Missing chapter title');
  if (!String(chapter.coverUrl || chapter.cover_url || chapter.cover || '').trim()) issues.push('Missing cover image');
  if (String(chapter.status).toLowerCase() === 'published' && !pages.length) issues.push('Published chapter has no pages');
  if (duplicates.length) issues.push(`Duplicate page numbers: ${[...new Set(duplicates)].join(', ')}`);
  if (missing.length) issues.push(`Missing pages: ${missing.join(', ')}`);
  if (sorted.some(p => !/^https?:\/\//i.test(String(p.image_url || '')))) issues.push('Broken or invalid image URL');
  return issues;
}

export default function AdminChapterHealth() {
  const [isAdmin, setIsAdmin] = useState(false), [open, setOpen] = useState(false), [loading, setLoading] = useState(false), [results, setResults] = useState([]), [notice, setNotice] = useState('');
  const [linkLoading, setLinkLoading] = useState(false), [linkResults, setLinkResults] = useState(null);

  useEffect(() => {
    let alive = true;
    const check = async () => { try { await requireAdmin(); if (alive) setIsAdmin(true); } catch { if (alive) setIsAdmin(false); } };
    check();
    const { data } = supabase.auth.onAuthStateChange(check);
    return () => { alive = false; data?.subscription?.unsubscribe(); };
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
  }, [isAdmin]);

  useEffect(() => { const handler = () => { setOpen(true); }; window.addEventListener('atma-admin-open-health', handler); return () => window.removeEventListener('atma-admin-open-health', handler); }, [isAdmin]);

  const runSiteLinkCheck = async () => {
    setLinkLoading(true); setNotice('');
    try {
      await requireAdmin();
      const sitemapResponse = await fetch('/sitemap.xml', { cache: 'no-store', credentials: 'same-origin' });
      if (!sitemapResponse.ok) throw new Error(`Sitemap request failed (HTTP ${sitemapResponse.status}).`);
      const sitemapText = await sitemapResponse.text();
      const xml = new DOMParser().parseFromString(sitemapText, 'application/xml');
      if (xml.querySelector('parsererror')) throw new Error('The sitemap is not valid XML.');
      const sitemapUrls = [...xml.querySelectorAll('url > loc')].map(node => node.textContent?.trim()).filter(Boolean);
      const sameOrigin = [...new Set(sitemapUrls.filter(value => { try { return new URL(value).origin === window.location.origin; } catch { return false; } }))];
      const links = [...document.querySelectorAll('a[href]')].map(node => node.href).filter(value => { try { const url = new URL(value); return url.origin === window.location.origin && url.pathname !== '/sitemap.xml' && url.pathname !== '/robots.txt'; } catch { return false; } });
      const targets = [...new Set([...sameOrigin, ...links])];
      const failed = [];
      let checked = 0;
      let cursor = 0;
      const worker = async () => {
        while (cursor < targets.length) {
          const index = cursor++;
          const target = targets[index];
          const controller = new AbortController();
          const timer = window.setTimeout(() => controller.abort(), 7000);
          try {
            const response = await fetch(target, { method: 'GET', cache: 'no-store', credentials: 'same-origin', redirect: 'follow', signal: controller.signal });
            if (!response.ok) failed.push({ url: target, status: response.status, reason: `HTTP ${response.status}` });
          } catch (error) {
            failed.push({ url: target, status: null, reason: error?.name === 'AbortError' ? 'Timed out' : 'Request failed' });
          } finally {
            window.clearTimeout(timer);
            checked++;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(6, targets.length) }, worker));
      setLinkResults({ checked, failed, sitemapCount: sameOrigin.length, domCount: links.length, checkedAt: new Date().toISOString() });
    } catch (error) {
      setNotice(error.message || 'Site link check failed.');
    } finally { setLinkLoading(false); }
  };

  const runCheck = async () => {
    setLoading(true); setNotice('');
    try {
      await requireAdmin();
      const chapters = await buildChapters();
      const { data, error } = await supabase.from(PAGES).select('id, chapter_id, page_number, image_url');
      if (error) throw error;
      const byChapter = new Map();
      for (const page of data || []) { if (!byChapter.has(page.chapter_id)) byChapter.set(page.chapter_id, []); byChapter.get(page.chapter_id).push(page); }
      const checked = await Promise.all(chapters.map(async chapter => {
        const pages = byChapter.get(chapter.id) || [];
        const issues = checkChapter(chapter, pages);
        const cover = String(chapter.coverUrl || chapter.cover_url || chapter.cover || '').trim();
        const urls = [...pages.map(page => page.image_url).filter(Boolean), ...(cover ? [cover] : [])];
        const failures = await Promise.all(urls.map(async url => ({ url, ok: await probeImage(url) })));
        const broken = failures.filter(item => !item.ok);
        if (broken.length) issues.push(`${broken.length} image(s) failed to load`);
        return { chapter, pages: pages.length, issues, brokenImages: broken.map(item => item.url) };
      }));
      setResults(checked);
    } catch (error) { setNotice(error.message || 'Health check failed.'); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (open) runCheck(); }, [open]);
  if (!isAdmin) return null;

  const problems = results.filter(item => item.issues.length);

  return <><style>{`.ar-health-tab{width:100%;min-height:44px;padding:0 13px;border:1px solid transparent;border-radius:10px;background:var(--card-bg);color:var(--text-color);display:flex;align-items:center;justify-content:space-between;font-size:11px;font-weight:850;cursor:pointer}.ar-health-tab:hover{background:var(--surface-2-color)}.ar-health-tab b{font-size:8px;padding:4px 7px;border-radius:99px;background:var(--surface-2-color);color:var(--muted-color)}.ar-health-backdrop{position:fixed;inset:0;z-index:10030;background:var(--overlay-color);backdrop-filter:blur(12px);display:grid;place-items:center;padding:24px;font-family:'Poppins',sans-serif}.ar-health-panel{width:min(1000px,100%);max-height:92vh;overflow:auto;background:var(--card-bg);color:var(--text-color);border:1px solid var(--border-color);border-radius:24px;box-shadow:0 35px 120px var(--shadow-color)}.ar-health-head{padding:22px 26px;border-bottom:1px solid var(--border-soft-color);display:flex;align-items:center;gap:18px}.ar-health-head h2{margin:0;font-size:25px;letter-spacing:-.04em}.ar-health-head p{margin:5px 0 0;color:var(--muted-color);font-size:10px}.ar-health-close{margin-left:auto;width:38px;height:38px;border:1px solid var(--border-color);border-radius:11px;background:var(--surface-2-color);color:var(--text-color);font-size:20px;cursor:pointer}.ar-health-body{padding:20px 26px 28px}.ar-health-summary{display:grid;grid-template-columns:repeat(3,1fr);gap:10px;margin-bottom:14px}.ar-health-stat{padding:15px;border:1px solid var(--border-color);border-radius:14px;background:var(--surface-color)}.ar-health-stat span{display:block;font-size:8px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:var(--faint-color)}.ar-health-stat strong{display:block;margin-top:6px;font-size:25px}.ar-health-list{display:grid;gap:8px}.ar-health-row{padding:14px 16px;border:1px solid var(--border-color);border-radius:14px;background:var(--surface-color)}.ar-health-row-top{display:flex;justify-content:space-between;gap:12px}.ar-health-row h3{margin:5px 0 0;font-size:11px}.ar-health-row p{margin:6px 0 0;color:var(--muted-color);font-size:9px}.ar-health-badge{font-size:8px;font-weight:900;white-space:nowrap}.ar-health-badge.bad{color:var(--danger-color)}.ar-health-badge.good{color:var(--success-color)}.ar-health-issues{margin:8px 0 0;padding-left:18px;color:var(--danger-color);font-size:9px;line-height:1.6}.ar-health-actions{display:flex;justify-content:flex-end;margin-top:14px}.ar-health-run{height:38px;padding:0 14px;border:1px solid var(--border-color);border-radius:10px;background:var(--surface-2-color);color:var(--text-color);font-size:9px;font-weight:850;cursor:pointer}@media(max-width:600px){.ar-health-backdrop{padding:0}.ar-health-panel{height:100%;max-height:none;border-radius:0}.ar-health-head,.ar-health-body{padding-left:15px;padding-right:15px}.ar-health-summary{grid-template-columns:1fr 1fr}.ar-health-summary .ar-health-stat:last-child{grid-column:1/-1}}`}</style>{open&&<div className="ar-health-backdrop" onMouseDown={e=>e.target===e.currentTarget&&setOpen(false)}><section className="ar-health-panel"><header className="ar-health-head"><div><h2>Chapter Health Check</h2><p>Check chapter pages and images, then test same-site URLs from the sitemap and current page.</p></div><button className="ar-health-close" onClick={()=>setOpen(false)}>×</button></header><div className="ar-health-body">{notice&&<div style={{color:'var(--danger-color)',fontSize:10,marginBottom:12}}>{notice}</div>}<div className="ar-health-summary"><div className="ar-health-stat"><span>Checked</span><strong>{loading?'—':results.length}</strong></div><div className="ar-health-stat"><span>Healthy</span><strong>{loading?'—':results.length-problems.length}</strong></div><div className="ar-health-stat"><span>Needs attention</span><strong>{loading?'—':problems.length}</strong></div></div><div className="ar-health-list">{loading?<div className="ar-health-row">Checking chapters…</div>:results.map(item=><article className="ar-health-row" key={item.chapter.id}><div className="ar-health-row-top"><div><strong>{item.chapter.chapterNumber?`Chapter ${item.chapter.chapterNumber}`:'Unnumbered'}</strong><h3>{item.chapter.title||'Untitled'}</h3></div><span className={`ar-health-badge ${item.issues.length?'bad':'good'}`}>{item.issues.length?'Needs attention':'✓ Ready'}</span></div>{item.issues.length?<><ul className="ar-health-issues">{item.issues.map(issue=><li key={issue}>{issue}</li>)}</ul>{item.brokenImages?.length>0&&<details style={{marginTop:8,fontSize:9}}><summary>View failed image URLs ({item.brokenImages.length})</summary><ul className="ar-health-issues">{item.brokenImages.map(url=><li key={url} style={{overflowWrap:'anywhere'}}>{url}</li>)}</ul></details>}</>:<p>{item.pages} page{item.pages===1?'':'s'} · No detected problems</p>}</article>)}</div>{linkResults&&<section className="ar-health-row" style={{marginTop:14}}><div className="ar-health-row-top"><div><strong>Site link check</strong><p>{linkResults.checked} same-site URLs checked · {linkResults.sitemapCount} sitemap URLs · {linkResults.domCount} page links</p></div><span className={`ar-health-badge ${linkResults.failed.length?'bad':'good'}`}>{linkResults.failed.length?linkResults.failed.length+' failed':'✓ All responded'}</span></div>{linkResults.failed.length>0&&<ul className="ar-health-issues">{linkResults.failed.map(item=><li key={item.url}><strong>{item.reason}</strong>: <span style={{overflowWrap:'anywhere'}}>{item.url}</span></li>)}</ul>}<p>Checked {new Date(linkResults.checkedAt).toLocaleString('en-IN')}.</p></section>}<div className="ar-health-actions" style={{gap:8,flexWrap:'wrap'}}><button className="ar-health-run" onClick={runSiteLinkCheck} disabled={linkLoading}>{linkLoading?'Checking links…':'Check site links'}</button><button className="ar-health-run" onClick={runCheck} disabled={loading}>{loading?'Checking…':'Check chapter images'}</button></div></div></section></div>}</>;
}
