import { useEffect, useState } from 'react';
import { supabase } from './supabase';
import { getAdminRole } from './adminAuth';

const PAGES = 'chapter_pages';
const BUCKET = 'chapter-pages';

async function requireAdmin() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Your Supabase session has expired.');
  const role = await getAdminRole(user.id);
  if (!role) throw new Error('Admin access required.');
}

const imageLooksValid = url => /^https?:\/\//i.test(String(url || ''));

function checkChapter(chapter, pages) {
  const issues = [];
  const sorted = [...pages].sort((a, b) => Number(a.page_number) - Number(b.page_number));
  const numbers = sorted.map(p => Number(p.page_number));
  const expected = Array.from({ length: numbers.length }, (_, i) => i + 1);
  const duplicates = numbers.filter((n, i) => numbers.indexOf(n) !== i);
  const missing = expected.filter(n => !numbers.includes(n));
  if (!chapter.title?.trim()) issues.push('Missing chapter title');
  if (!chapter.cover?.trim()) issues.push('Missing cover image');
  if (String(chapter.status).toLowerCase() === 'published' && !pages.length) issues.push('Published chapter has no pages');
  if (duplicates.length) issues.push(`Duplicate page number${duplicates.length > 1 ? 's' : ''}: ${[...new Set(duplicates)].join(', ')}`);
  if (missing.length) issues.push(`Missing page${missing.length > 1 ? 's' : ''}: ${missing.join(', ')}`);
  if (sorted.some(p => !imageLooksValid(p.image_url))) issues.push('One or more pages have an invalid image URL');
  return issues;
}

export default function AdminChapterHealth({ chapters }) {
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [notice, setNotice] = useState('');

  const runCheck = async () => {
    setLoading(true); setNotice('');
    try {
      await requireAdmin();
      const { data, error } = await supabase.from(PAGES).select('id, chapter_id, page_number, image_url');
      if (error) throw error;
      const byChapter = new Map();
      for (const page of data || []) {
        if (!byChapter.has(page.chapter_id)) byChapter.set(page.chapter_id, []);
        byChapter.get(page.chapter_id).push(page);
      }
      const checked = chapters.map(chapter => {
        const pages = byChapter.get(chapter.id) || [];
        return { chapter, pages: pages.length, issues: checkChapter(chapter, pages) };
      });
      setResults(checked);
    } catch (error) {
      setNotice(error.message || 'Health check failed.');
    } finally { setLoading(false); }
  };

  useEffect(() => { runCheck(); }, [chapters]);

  const problems = results.filter(item => item.issues.length);
  const healthy = results.length - problems.length;

  return <section className="admin-stack">
    <section className="admin-card">
      <div className="admin-card-title">
        <div><span>QUALITY CONTROL</span><h2>Chapter Health Check</h2><p>Checks page numbering, missing content, covers, publication state, and image URLs.</p></div>
        <button type="button" onClick={runCheck} disabled={loading}>{loading ? 'Checking…' : 'Run check again'}</button>
      </div>
      {notice && <div className="mb-4 rounded-2xl border border-rose-900 bg-rose-950/40 p-4 text-sm text-rose-300">{notice}</div>}
      <div className="admin-overview-stats">
        <article className="admin-overview-stat accent"><span className="admin-overview-stat-label">Chapters checked</span><strong>{results.length}</strong></article>
        <article className="admin-overview-stat"><span className="admin-overview-stat-label">Healthy</span><strong>{healthy}</strong></article>
        <article className="admin-overview-stat"><span className="admin-overview-stat-label">Needs attention</span><strong>{problems.length}</strong></article>
      </div>
    </section>

    <section className="admin-card">
      <div className="admin-card-title"><div><span>RESULTS</span><h2>{problems.length ? 'Issues found' : 'Everything looks clean'}</h2></div></div>
      <div className="admin-chapter-list">
        {results.map(item => <article key={item.chapter.id}>
          <div>
            <div className="admin-status-line"><strong>{item.chapter.chapterNumber ? `Chapter ${item.chapter.chapterNumber}` : 'Unnumbered'}</strong><span>{item.issues.length ? 'Needs attention' : 'Healthy'}</span></div>
            <h3>{item.chapter.title || 'Untitled chapter'}</h3>
            {item.issues.length ? <ul className="mt-2 list-disc pl-5 text-sm text-rose-300">{item.issues.map(issue => <li key={issue}>{issue}</li>)}</ul> : <p>{item.pages} page{item.pages === 1 ? '' : 's'} · No detected problems</p>}
          </div>
        </article>)}
        {!results.length && !loading && <p className="muted center">No chapters available.</p>}
      </div>
    </section>
  </section>;
}
